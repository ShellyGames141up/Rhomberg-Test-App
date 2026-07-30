import { areas, branches } from '../../data/branches.js';
import { categories, industries, products, recommendedCategories } from '../../data/catalogue.js';
import { representativeById, representatives, representativesForArea } from '../../data/representatives.js';
import {
  canAccessNotification,
  canAccessRecord,
  isInternalRole,
} from '../../domain/accessControl.js';
import {
  EXPEDITOR_DOCUMENT_TYPES,
  EXPEDITOR_PROGRESS_STEPS,
  REQUIRED_EXPEDITOR_STEP_IDS,
} from '../../domain/expediting.js';
import {
  DISPATCH_METHODS,
  DISPATCH_PROOF_TYPES,
} from '../../domain/dispatch.js';
import {
  allRequiredCertificatesPresent,
  certificateQueueForOrders,
  ensureLaboratoryRecord,
  laboratoryMetrics,
  MAX_CERTIFICATE_BYTES,
  orderRequiresLaboratory,
  validateCertificateUpload,
  validateLaboratoryUnitUpdate,
} from '../../domain/certification.js';
import {
  QA_PROBLEM_CATEGORIES,
  QA_REWORK_DESTINATIONS,
  QA_SEVERITIES,
  orderRequiresQualityAssurance,
  qualityMetrics,
  validateQaFailure,
  validateQaPass,
  validateQaRework,
  validateQaStart,
} from '../../domain/qualityAssurance.js';
import { buildPhase21Analytics } from '../../domain/analytics.js';
import {
  DEFAULT_EXECUTIVE_DEMO_STATE,
  EXECUTIVE_DEMO_ROLES,
  EXECUTIVE_DEMO_SCENARIOS,
  executiveScenarioById,
  normaliseExecutiveDemoState,
} from '../../domain/executiveDemo.js';
import {
  createDefaultNotificationPreferences,
  createNotificationRecord,
  messageForNotificationRecipient,
  normaliseNotificationPreferences,
  normaliseNotificationRecord,
  notificationMatchesPreferences,
  notificationRequestsForWorkflowAction,
  retryMockDelivery,
} from '../../domain/notifications.js';
import {
  buildOrderSummaryModel,
  generateOrderSummaryPdf,
  ORDER_COPY_TYPES,
  validateOrderEmailRequest,
} from '../../domain/orderDocuments.js';
import {
  applyRetentionState,
  assertArchiveAllowed,
  DEFAULT_RETENTION_POLICY,
  normaliseRetentionPolicy,
} from '../../domain/retention.js';
import {
  buildManagementDashboard,
  createOperationalReportCsv,
} from '../../domain/management.js';
import { PLANNING_PRIORITIES } from '../../domain/planningQueue.js';
import {
  createDeniedWorkflowAudit,
  createWorkflowActor,
  getAllowedWorkflowActions,
  inferWorkflowEntityType,
  ORDER_STATUSES,
  performWorkflowTransition,
  RFQ_STATUSES,
  SYSTEM_ACTOR_ROLE,
  workflowStatusById,
} from '../../domain/workflow.js';
import { optionsForField, shouldShowField } from '../../domain/productConfiguration.js';
import { RFQ_EMAIL_RECIPIENT, sendRfqEmail } from '../../lib/rfqEmail.js';
import {
  createDefaultCustomerPersonalisation,
  normaliseCustomerPersonalisation,
} from '../../shared/personalisation/personalisation.js';
import {
  accountCan,
  PERMISSIONS,
  permissionsForRole,
  ServiceError,
  USER_ROLES,
  roleCan,
  toPublicAccount,
} from '../contracts.js';
import {
  MAX_ACCEPTANCE_DOCUMENT_BYTES,
  MAX_DISPATCH_PROOF_BYTES,
  MAX_PO_FILE_BYTES,
  MAX_QUOTATION_DOCUMENT_BYTES,
  validateOrderAcceptance,
  validatePersonalisation,
  validatePersonalisationImage,
  validateNotificationPreferenceSettings,
  validatePlanningSubmission,
  validateCustomerAccountForRfq,
  validateDispatchAction,
  validateDispatchReceipt,
  validateEnquiry,
  validateExpeditingAction,
  validateQuotationConfirmation,
  validateRegistration,
  validateRepresentativeAssignment,
  validateSignIn,
  validateWorkflowActionRequest,
} from '../validation.js';
import { createBrowserStore } from '../browserStore.js';
import {
  ADMINISTRATOR_ACCOUNT,
  BUYER_ACCOUNT,
  COMPANY_OWNER_ACCOUNT,
  DEMO_ACCOUNT,
  DEMO_ENQUIRIES,
  DEMO_LOGINS,
  DISPATCH_ACCOUNT,
  EXPEDITOR_ACCOUNT,
  EXTRA_DEMO_ACCOUNTS,
  LAB_ACCOUNT,
  LAB_MANAGER_ACCOUNT,
  LEGACY_STORE_KEYS,
  MANAGER_ACCOUNT,
  PHASE21_DEMO_ORDERS,
  PLANNING_ACCOUNT,
  QA_ACCOUNT,
  QA_MANAGER_ACCOUNT,
  SALES_ACCOUNT,
  SALES_MANAGER_ACCOUNT,
  STORE_KEYS,
} from './seedData.js';

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const makeId = prefix => {
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${token}`;
};

const fileToDataUrl = file => new Promise((resolve, reject) => {
  if (typeof FileReader === 'function') {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new ServiceError('The image could not be read. Please choose it again.', { code: 'IMAGE_READ_FAILED', status: 422 }));
    reader.readAsDataURL(file);
    return;
  }
  file.arrayBuffer()
    .then(buffer => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      resolve(`data:${file.type};base64,${globalThis.btoa(binary)}`);
    })
    .catch(() => reject(new ServiceError('The image could not be read. Please choose it again.', { code: 'IMAGE_READ_FAILED', status: 422 })));
});

const normaliseAccount = account => {
  const role = account.role || USER_ROLES.CUSTOMER;
  return {
    ...account,
    role,
    authRealm: account.authRealm || (role === USER_ROLES.CUSTOMER ? 'customer' : 'internal'),
    status: account.status || 'active',
    signInName: account.signInName || '',
    companyId: account.companyId || (roleCan(role, PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE) ? account.id : 'company-rhomberg'),
  };
};

const LEGACY_STATUS_MAP = Object.freeze({
  'rfq-submitted': 'submitted',
  'under-review': 'under_rep_review',
  'quotation-sent': 'awaiting_customer_acceptance',
  'po-received': 'awaiting_planning',
  scheduled: 'submitted_to_expediting',
  'in-production': 'expediting_in_progress',
  'quality-check': 'expediting_in_progress',
  ready: 'awaiting_dispatch',
  dispatched: 'out_for_delivery',
  completed: 'completed',
  'on-hold': 'on_hold',
});

const migrateStatus = value => LEGACY_STATUS_MAP[value] || value;

const normaliseHistoryEvent = (event, fallbackCreatedAt) => {
  const toStatus = migrateStatus(event.toStatus || event.status || 'submitted');
  const eventEntityType = ORDER_STATUSES.includes(toStatus) ? 'order' : 'rfq';
  const definition = workflowStatusById(toStatus, eventEntityType);
  return {
    ...event,
    entityType: event.entityType || eventEntityType,
    action: event.action || 'legacy_status_imported',
    fromStatus: migrateStatus(event.fromStatus || ''),
    toStatus,
    status: toStatus,
    label: event.label || definition?.label || 'Workflow update',
    note: event.note || definition?.customerDescription || 'Workflow status updated.',
    customerVisible: event.customerVisible ?? definition?.customerVisible ?? false,
    createdAt: event.createdAt || fallbackCreatedAt,
  };
};

const normaliseEnquiry = enquiry => {
  let trackingStatus = migrateStatus(enquiry.trackingStatus || 'submitted');
  if (!RFQ_STATUSES.includes(trackingStatus) && !ORDER_STATUSES.includes(trackingStatus)) trackingStatus = 'submitted';
  const createdAt = enquiry.createdAt || new Date().toISOString();
  const workflowType = enquiry.workflowType || (ORDER_STATUSES.includes(trackingStatus) ? 'order' : 'rfq');
  const definition = workflowStatusById(trackingStatus, workflowType);
  const isLegacyOrder = workflowType === 'order';
  return {
    ...enquiry,
    version: Math.max(0, Number(enquiry.version) || 0),
    companyId: enquiry.companyId || enquiry.accountId,
    workflowType,
    trackingStatus,
    status: definition?.label || 'Workflow update',
    sourceRfqStatus: enquiry.sourceRfqStatus || (isLegacyOrder ? 'converted_to_order' : ''),
    acceptedAt: enquiry.acceptedAt || (isLegacyOrder ? createdAt : ''),
    trackingHistory: enquiry.trackingHistory?.length
      ? enquiry.trackingHistory.map(event => normaliseHistoryEvent(event, createdAt))
      : [normaliseHistoryEvent({ id: makeId('event'), status: trackingStatus, note: 'RFQ saved to the customer account.', actor: 'Customer', createdAt }, createdAt)],
  };
};

const isCustomerVisibleEvent = event => event.customerVisible !== false
  && workflowStatusById(event.toStatus || event.status, event.entityType)?.customerVisible !== false;

const toCustomerVisibleDocument = document => {
  if (!document || document.customerVisible === false) return undefined;
  return {
    id: document.id,
    documentType: document.documentType,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.uploadedAt,
    storageStatus: document.storageStatus,
  };
};

const toCustomerTimelineEvent = event => ({
  id: event.id,
  eventType: event.action || event.eventType || event.toStatus || event.status,
  action: event.action || event.eventType || '',
  entityType: event.entityType,
  fromStatus: event.fromStatus,
  toStatus: event.toStatus || event.status,
  status: event.status || event.toStatus,
  label: event.label,
  note: event.customerDescription || event.note,
  customerDescription: event.customerDescription || event.note,
  actor: event.actorRole === USER_ROLES.CUSTOMER ? 'You' : 'Rhomberg Instruments',
  progressStep: event.progressStep || '',
  dispatchMethod: event.dispatchMethod || '',
  createdAt: event.createdAt,
});

const toCustomerVisibleQuotation = quotation => {
  if (!quotation) return undefined;
  const documentIsVisible = Boolean(quotation.documentCustomerVisible);
  return {
    number: quotation.number,
    date: quotation.date,
    expiryMode: quotation.expiryMode,
    expiryDate: quotation.expiryDate,
    customerNote: quotation.customerNote,
    emailed: quotation.emailed,
    documentReference: documentIsVisible ? quotation.documentReference : '',
    document: documentIsVisible ? toCustomerVisibleDocument(quotation.document) : undefined,
  };
};

const toCustomerVisibleExpediting = expediting => {
  if (!expediting) return undefined;
  return {
    currentStep: expediting.currentStep,
    estimatedCompletionDate: expediting.estimatedCompletionDate,
    updates: (expediting.updates || [])
      .filter(update => update.customerVisible !== false)
      .map(update => ({
        id: update.id,
        progressStep: update.progressStep,
        customerMessage: update.customerMessage,
        estimatedCompletionDate: update.estimatedCompletionDate,
        updatedBy: update.updatedBy ? { displayName: update.updatedBy.displayName } : undefined,
        createdAt: update.createdAt,
      })),
  };
};

const toCustomerVisibleDispatch = dispatch => {
  if (!dispatch) return undefined;
  const safeProof = proof => proof && proof.customerVisible !== false ? {
    type: proof.type,
    reference: proof.reference,
    fileName: proof.fileName,
    mimeType: proof.mimeType,
    sizeBytes: proof.sizeBytes,
    storageStatus: proof.storageStatus,
  } : undefined;
  return {
    method: dispatch.method,
    readyDate: dispatch.readyDate,
    collectionDate: dispatch.collectionDate,
    deliveryDate: dispatch.deliveryDate,
    courierOrDriver: dispatch.courierOrDriver,
    trackingReference: dispatch.trackingReference,
    numberOfPackages: dispatch.numberOfPackages,
    deliveryNoteNumber: dispatch.deliveryNoteNumber,
    recipientName: dispatch.recipientName,
    proofOfDelivery: safeProof(dispatch.proofOfDelivery),
    customerMessage: dispatch.customerMessage,
    receivedAt: dispatch.receivedAt,
    lastUpdatedAt: dispatch.lastUpdatedAt,
    updates: (dispatch.updates || [])
      .filter(update => update.customerVisible !== false)
      .map(update => ({
        id: update.id,
        action: update.action,
        method: update.method,
        readyDate: update.readyDate,
        collectionDate: update.collectionDate,
        deliveryDate: update.deliveryDate,
        courierOrDriver: update.courierOrDriver,
        trackingReference: update.trackingReference,
        numberOfPackages: update.numberOfPackages,
        deliveryNoteNumber: update.deliveryNoteNumber,
        recipientName: update.recipientName,
        proofOfDelivery: safeProof(update.proofOfDelivery),
        customerMessage: update.customerMessage,
        updatedBy: update.updatedBy ? { displayName: update.updatedBy.displayName } : undefined,
        createdAt: update.createdAt,
      })),
  };
};

const toCustomerVisibleLaboratory = laboratory => {
  if (!laboratory) return undefined;
  return {
    status: laboratory.status,
    currentMessage: laboratory.currentMessage,
    receivedAt: laboratory.receivedAt,
    releasedAt: laboratory.releasedAt,
    lastUpdatedAt: laboratory.lastUpdatedAt,
    units: (laboratory.units || []).map(unit => ({
      id: unit.id,
      productCode: unit.productCode,
      productName: unit.productName,
      unitNumber: unit.unitNumber,
      quantityInLine: unit.quantityInLine,
      certificationType: unit.certificationType,
      status: unit.status,
      certificateStatus: unit.certificateStatus,
      certificateId: unit.certificateId,
      certificateNumber: unit.certificateNumber,
      certificateUploadedAt: unit.certificateUploadedAt || unit.certificate?.uploadedAt || '',
      customerVisibleMessage: unit.customerVisibleMessage,
      updatedAt: unit.updatedAt,
    })),
    updates: (laboratory.updates || [])
      .filter(update => update.customerVisible !== false)
      .map(update => ({
        id: update.id,
        action: update.action,
        message: update.customerMessage,
        createdAt: update.createdAt,
      })),
  };
};

const toCustomerVisibleQuality = qualityAssurance => {
  if (!qualityAssurance) return undefined;
  return {
    attempt: qualityAssurance.attempt,
    reworkCycle: qualityAssurance.reworkCycle,
    customerMessage: qualityAssurance.customerMessage,
    lastUpdatedAt: qualityAssurance.lastUpdatedAt,
    inspections: (qualityAssurance.inspections || []).map(inspection => ({
      id: inspection.id,
      attempt: inspection.attempt,
      result: inspection.result,
      customerMessage: inspection.customerMessage,
      createdAt: inspection.createdAt,
    })),
  };
};

const CUSTOMER_RESTRICTED_FIELD_TOKENS = new Set([
  'audit',
  'cost',
  'credential',
  'credentials',
  'internal',
  'margin',
  'password',
  'price',
  'pricing',
  'private',
  'protected',
  'raw',
  'secret',
  'supplier',
  'token',
]);
const CUSTOMER_ALLOWED_CONFIGURATION_FIELDS = new Set(['internalContacts']);

const customerFieldIsRestricted = (key, path = []) => {
  if (
    CUSTOMER_ALLOWED_CONFIGURATION_FIELDS.has(key)
    && path.at(-1) === 'configuration'
  ) return false;
  const tokens = String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return tokens.some(token => CUSTOMER_RESTRICTED_FIELD_TOKENS.has(token));
};

const sanitiseCustomerValue = (value, path = []) => {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => sanitiseCustomerValue(item, [...path, String(index)]))
      .filter(item => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  if (value.customerVisible === false) return undefined;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !customerFieldIsRestricted(key, path))
    .map(([key, nested]) => [key, sanitiseCustomerValue(nested, [...path, key])])
    .filter(([, nested]) => nested !== undefined));
};

const toCustomerVisibleRecord = enquiry => {
  const history = (enquiry.trackingHistory || [])
    .filter(isCustomerVisibleEvent)
    .map(toCustomerTimelineEvent);
  const lastVisible = history.at(-1);
  const visibleStatus = lastVisible?.toStatus || lastVisible?.status || (workflowStatusById(enquiry.trackingStatus, enquiry.workflowType)?.customerVisible ? enquiry.trackingStatus : 'submitted');
  const definition = workflowStatusById(visibleStatus);
  const customerSafeRecord = {
    id: enquiry.id,
    reference: enquiry.reference,
    version: enquiry.version,
    companyId: enquiry.companyId,
    company: enquiry.company,
    companySnapshot: enquiry.companySnapshot ? {
      id: enquiry.companySnapshot.id,
      name: enquiry.companySnapshot.name,
      area: enquiry.companySnapshot.area,
      industry: enquiry.companySnapshot.industry,
    } : undefined,
    contact: enquiry.contact,
    email: enquiry.email,
    phone: enquiry.phone,
    submittingCustomerId: enquiry.submittingCustomerId,
    submittingCustomer: enquiry.submittingCustomer ? {
      id: enquiry.submittingCustomer.id,
      name: enquiry.submittingCustomer.name,
      email: enquiry.submittingCustomer.email,
      phone: enquiry.submittingCustomer.phone,
    } : undefined,
    application: enquiry.application,
    medium: enquiry.medium,
    area: enquiry.area,
    fulfilment: enquiry.fulfilment,
    deliveryAddress: enquiry.deliveryAddress,
    collectionBranch: enquiry.collectionBranch,
    emergency: enquiry.emergency,
    notes: enquiry.notes,
    customerNotes: enquiry.customerNotes,
    priority: enquiry.priority,
    poMode: enquiry.poMode,
    poNumber: enquiry.poNumber,
    poFileName: enquiry.poFileName,
    items: (enquiry.items || []).map(item => ({
      lineId: item.lineId,
      productId: item.productId,
      code: item.code,
      name: item.name,
      image: item.image,
      description: item.description,
      quantity: item.quantity,
      configuration: sanitiseCustomerValue(item.configuration || {}, ['configuration']),
    })),
    documents: (enquiry.documents || [])
      .map(toCustomerVisibleDocument)
      .filter(Boolean),
    selectedRep: enquiry.selectedRep ? {
      id: enquiry.selectedRep.id,
      code: enquiry.selectedRep.code,
      name: enquiry.selectedRep.name,
      branchId: enquiry.selectedRep.branchId,
      branchName: enquiry.selectedRep.branchName,
    } : undefined,
    workflowType: enquiry.workflowType,
    sourceEnquiryId: enquiry.sourceEnquiryId,
    sourceRfqReference: enquiry.sourceRfqReference,
    sourceRfqStatus: enquiry.sourceRfqStatus,
    assignedAt: enquiry.assignedAt,
    submittedAt: enquiry.submittedAt,
    quotedAt: enquiry.quotedAt,
    quotationAcknowledgedAt: enquiry.quotationAcknowledgedAt,
    acceptedAt: enquiry.acceptedAt,
    readyForCollectionAt: enquiry.readyForCollectionAt,
    outForDeliveryAt: enquiry.outForDeliveryAt,
    completedAt: enquiry.completedAt,
    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
    isDemo: enquiry.isDemo,
  };
  return {
    ...customerSafeRecord,
    trackingStatus: visibleStatus,
    status: definition?.label || enquiry.status,
    trackingHistory: history,
    customerTimeline: history,
    quotation: toCustomerVisibleQuotation(enquiry.quotation),
    quotedBy: enquiry.quotedBy ? { displayName: enquiry.quotedBy.displayName } : undefined,
    quotationAcknowledgedBy: undefined,
    acceptance: undefined,
    acceptedBy: undefined,
    planning: undefined,
    expediting: toCustomerVisibleExpediting(enquiry.expediting),
    laboratory: toCustomerVisibleLaboratory(enquiry.laboratory),
    qualityAssurance: toCustomerVisibleQuality(enquiry.qualityAssurance),
    routing: enquiry.routing ? {
      requiresLaboratory: enquiry.routing.requiresLaboratory === true,
      certificationTypes: [...(enquiry.routing.certificationTypes || [])],
    } : undefined,
    dispatch: toCustomerVisibleDispatch(enquiry.dispatch),
    internalJobNumber: undefined,
    customerPoNumber: undefined,
    workflowContext: undefined,
    planningStartedBy: undefined,
    plannedBy: undefined,
    submittedToExpeditingBy: undefined,
    expeditingStartedBy: undefined,
    lastExpeditingUpdatedBy: undefined,
    submittedToDispatchBy: undefined,
    readyForCollectionBy: undefined,
    outForDeliveryBy: undefined,
    deliveredBy: undefined,
    collectedBy: undefined,
    completedBy: undefined,
    lastDispatchUpdatedBy: undefined,
    allowedWorkflowActions: [],
  };
};

const isEmpty = value => value === undefined || value === null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === '');

const validateConfiguredProducts = lines => {
  const fieldErrors = {};
  lines.forEach((line, lineIndex) => {
    const product = products.find(item => item.id === line.productId);
    if (!product) {
      fieldErrors[`items.${lineIndex}.productId`] = `The product on line ${lineIndex + 1} is no longer available.`;
      return;
    }
    const configuration = line.configuration || {};
    for (const field of product.configurations || []) {
      const visible = shouldShowField(field, configuration);
      const value = configuration[field.key];
      if (!visible && !isEmpty(value) && value !== false) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `${field.label} is not available with the other selections on line ${lineIndex + 1}.`;
        continue;
      }
      if (visible && field.required && isEmpty(value)) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `Complete “${field.label}” for ${product.code}.`;
        continue;
      }
      if (!visible || isEmpty(value) || value === false || !['choice', 'select', 'multiChoice'].includes(field.type)) continue;
      const allowed = optionsForField(field, configuration);
      const selections = Array.isArray(value) ? value : [value];
      if (selections.some(selection => !allowed.includes(selection))) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `Review “${field.label}” for ${product.code}; one selection is not available.`;
      } else if (field.exclusiveOption && selections.includes(field.exclusiveOption) && selections.length > 1) {
        fieldErrors[`items.${lineIndex}.configuration.${field.key}`] = `Choose either “${field.exclusiveOption}” or specific options for ${product.code}, not both.`;
      }
    }
    if (configuration.sanas && product.category !== 'pressure') fieldErrors[`items.${lineIndex}.configuration.sanas`] = 'SANAS calibration is available only for Pressure instruments.';
    if (configuration.traceability && product.category !== 'temperature') fieldErrors[`items.${lineIndex}.configuration.traceability`] = 'Traceability is available only for Temperature units.';
  });
  if (Object.keys(fieldErrors).length) {
    throw new ServiceError(Object.values(fieldErrors)[0], { code: 'INVALID_PRODUCT_CONFIGURATION', status: 422, fieldErrors });
  }
};

export function createMockServices({ storage, emailSender = sendRfqEmail, now = () => new Date() } = {}) {
  const store = createBrowserStore(storage);

  const readAccounts = () => store.get(STORE_KEYS.accounts, []).map(normaliseAccount);
  const writeAccounts = accounts => store.set(STORE_KEYS.accounts, accounts.map(normaliseAccount));
  const normaliseWorkflowState = state => ({
    enquiries: (state?.enquiries || []).map(record => normaliseEnquiry({ ...record, workflowType: 'rfq' })),
    orders: (state?.orders || []).map(record => normaliseEnquiry({ ...record, workflowType: 'order' })),
  });
  const readWorkflowState = () => normaliseWorkflowState(store.get(STORE_KEYS.workflowState, { enquiries: [], orders: [] }));
  const writeWorkflowState = state => store.set(STORE_KEYS.workflowState, normaliseWorkflowState(state));
  const readAllEnquiries = () => readWorkflowState().enquiries;
  const readAllOrders = () => readWorkflowState().orders;
  const readAllRecords = () => {
    const state = readWorkflowState();
    return [...state.enquiries, ...state.orders];
  };
  const readAuditEvents = () => store.get(STORE_KEYS.audit, []);
  const appendAuditEvent = event => store.set(STORE_KEYS.audit, [...readAuditEvents(), event]);
  const readOrderDocuments = () => store.get(STORE_KEYS.orderDocuments, []);
  const writeOrderDocuments = documents => store.set(STORE_KEYS.orderDocuments, documents);
  const readRetentionPolicy = () => normaliseRetentionPolicy(store.get(STORE_KEYS.retentionPolicy, DEFAULT_RETENTION_POLICY));
  const writeRetentionPolicy = policy => store.set(STORE_KEYS.retentionPolicy, normaliseRetentionPolicy(policy));
  const readRetentionExports = () => store.get(STORE_KEYS.retentionExports, []);
  const writeRetentionExports = exports => store.set(STORE_KEYS.retentionExports, exports);
  const readIdempotencyRecords = () => store.get(STORE_KEYS.idempotency, {});
  const writeIdempotencyRecords = records => store.set(STORE_KEYS.idempotency, records);
  const readManagementExports = () => store.get(STORE_KEYS.managementExports, []);
  const writeManagementExports = exports => store.set(STORE_KEYS.managementExports, exports);
  const presentAuditEvent = event => {
    const record = readAllRecords().find(item => item.id === event.entityId);
    const actor = readAccounts().find(item => item.id === event.actorId);
    const deliveryStatuses = event.notificationResults
      || event.details?.deliveryStatuses
      || [];
    return {
      ...event,
      eventType: event.eventType || String(event.action || '').replace(/^workflow\./, ''),
      previousStatus: event.previousStatus ?? event.fromStatus ?? '',
      newStatus: event.newStatus ?? event.toStatus ?? '',
      actingUser: {
        id: event.actorId || '',
        displayName: event.actorDisplayName || actor?.contact || actor?.company || event.actorRole || 'Workflow service',
      },
      actingRole: event.actorRole || '',
      timestamp: event.createdAt,
      requestId: event.requestId || event.details?.requestId || event.id,
      correlationId: event.correlationId || event.details?.correlationId || event.id,
      company: {
        id: event.companyId || record?.companyId || '',
        name: event.companyName || record?.company || '',
      },
      reference: event.reference || record?.reference || '',
      fieldsChanged: event.fieldsChanged?.length
        ? event.fieldsChanged
        : (event.fromStatus !== event.toStatus ? ['trackingStatus'] : []),
      reason: event.reason || event.comment || event.details?.reason || '',
      notificationResults: Array.isArray(deliveryStatuses)
        ? deliveryStatuses
        : [],
      override: {
        used: event.isOverride === true,
        reason: event.overrideReason || '',
      },
      documentMetadata: event.documentMetadata || event.details?.documentMetadata || [],
      immutable: true,
    };
  };
  const readNotifications = () => store.get(STORE_KEYS.notifications, []).map(normaliseNotificationRecord);
  const writeNotifications = notifications => store.set(STORE_KEYS.notifications, notifications.map(normaliseNotificationRecord));
  const appendNotification = notification => writeNotifications([...readNotifications(), notification]);
  const readNotificationPreferenceRecords = () => store.get(STORE_KEYS.notificationPreferences, {});
  const writeNotificationPreferenceRecords = records => store.set(STORE_KEYS.notificationPreferences, records);
  const readPersonalisation = () => store.get(STORE_KEYS.personalisation, {});
  const writePersonalisation = records => store.set(STORE_KEYS.personalisation, records);
  const readMockImages = () => store.get(STORE_KEYS.mockImages, {});
  const writeMockImages = records => store.set(STORE_KEYS.mockImages, records);
  const readCertificateFiles = () => store.get(STORE_KEYS.certificateFiles, {});
  const writeCertificateFiles = records => store.set(STORE_KEYS.certificateFiles, records);
  const readCredentialChallenges = () => store.get(STORE_KEYS.credentialChallenges, []);
  const writeCredentialChallenges = records => store.set(STORE_KEYS.credentialChallenges, records);
  const readCustomerRepresentativeAssignments = () => store.get(STORE_KEYS.customerRepresentativeAssignments, {});
  const writeCustomerRepresentativeAssignments = records => store.set(STORE_KEYS.customerRepresentativeAssignments, records);
  const presentPersonalisation = record => {
    const images = readMockImages();
    const hydrate = image => image ? { ...image, previewUrl: images[image.id]?.dataUrl || '' } : null;
    const normalised = normaliseCustomerPersonalisation(record);
    return {
      ...normalised,
      profileImage: hydrate(normalised.profileImage),
      companyLogo: hydrate(normalised.companyLogo),
    };
  };
  const nextRfqReference = () => {
    const highestStoredReference = readAllEnquiries().reduce((highest, enquiry) => {
      const match = /^RQ-PREVIEW-(\d+)$/.exec(enquiry.reference || '');
      return Math.max(highest, Number(match?.[1] || 0));
    }, 0);
    const nextSequence = Math.max(Number(store.get(STORE_KEYS.rfqSequence, 0)) || 0, highestStoredReference) + 1;
    store.set(STORE_KEYS.rfqSequence, nextSequence);
    return `RQ-PREVIEW-${String(nextSequence).padStart(4, '0')}`;
  };
  const nextOrderReference = existingOrders => {
    const highestReference = existingOrders.reduce((highest, order) => {
      const match = /^OR-PREVIEW-(\d+)$/.exec(order.reference || '');
      return Math.max(highest, Number(match?.[1] || 0));
    }, 0);
    return `OR-PREVIEW-${String(highestReference + 1).padStart(4, '0')}`;
  };

  const currentStoredAccount = () => {
    const session = store.get(STORE_KEYS.session, null);
    return session ? readAccounts().find(account => account.id === session.accountId) || null : null;
  };

  const requireAccount = () => {
    const account = currentStoredAccount();
    if (!account) throw new ServiceError('Your session has ended. Please sign in again.', { code: 'UNAUTHENTICATED', status: 401 });
    return account;
  };

  const canReadRecord = (account, record) => canAccessRecord(account, record);

  const presentRecord = (account, record) => {
    if (!isInternalRole(account.role)) {
      return {
        ...toCustomerVisibleRecord(record),
        allowedWorkflowActions: getAllowedWorkflowActions(record, createWorkflowActor(account)),
      };
    }
    return { ...record, allowedWorkflowActions: getAllowedWorkflowActions(record, createWorkflowActor(account)) };
  };

  const saveEnquiry = enquiry => {
    const state = readWorkflowState();
    const saved = normaliseEnquiry(enquiry);
    const index = state.enquiries.findIndex(item => item.id === saved.id);
    if (index >= 0) state.enquiries[index] = saved;
    else state.enquiries.unshift(saved);
    writeWorkflowState(state);
    return saved;
  };

  const saveOrder = order => {
    const state = readWorkflowState();
    const saved = normaliseEnquiry({ ...order, workflowType: 'order' });
    const index = state.orders.findIndex(item => item.id === saved.id);
    if (index >= 0) state.orders[index] = saved;
    else state.orders.unshift(saved);
    writeWorkflowState(state);
    return saved;
  };

  const planningUsers = () => readAccounts()
    .filter(account => (
      accountCan(account, PERMISSIONS.VIEW_PLANNING_QUEUE)
      && accountCan(account, PERMISSIONS.ADD_PLANNING_INFORMATION)
      && !accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)
    ))
    .map(account => ({
      id: account.id,
      name: account.contact || account.company || 'Planning user',
      email: account.email,
    }));

  const prepareWorkflowRequest = (input, account) => {
    const request = validateWorkflowActionRequest(input);
    if (request.action === 'mark_quoted') {
      const { quotation, quotationDocumentFile } = validateQuotationConfirmation(request.data);
      const document = quotationDocumentFile ? {
        id: makeId('quotation-document'),
        documentType: 'quotation',
        fileName: String(quotationDocumentFile.name || 'quotation-document'),
        mimeType: String(quotationDocumentFile.type || 'application/octet-stream'),
        sizeBytes: Number(quotationDocumentFile.size || 0),
        uploadedAt: now().toISOString(),
        storageStatus: 'metadata_only',
        customerVisible: quotation.documentCustomerVisible,
      } : undefined;
      return {
        ...request,
        data: {
          quotation: {
            ...quotation,
            document,
          },
        },
      };
    }
    if (request.action === 'accept_order') {
      const { acceptance, acceptanceDocumentFile } = validateOrderAcceptance(request.data);
      const document = acceptanceDocumentFile ? {
        id: makeId('acceptance-document'),
        documentType: 'order_acceptance_evidence',
        fileName: String(acceptanceDocumentFile.name || 'acceptance-document'),
        mimeType: String(acceptanceDocumentFile.type || 'application/octet-stream'),
        sizeBytes: Number(acceptanceDocumentFile.size || 0),
        uploadedAt: now().toISOString(),
        storageStatus: 'metadata_only',
        customerVisible: false,
      } : undefined;
      return {
        ...request,
        data: {
          acceptance: {
            ...acceptance,
            document,
          },
        },
      };
    }
    if (request.action === 'complete_planning') {
      const validated = validatePlanningSubmission(request.data, { today: now().toISOString().slice(0, 10) });
      const assignedPlanningUser = planningUsers().find(user => user.id === validated.planning.assignedPlanningUserId);
      if (!assignedPlanningUser) {
        throw new ServiceError('Select an authorised Planning user.', {
          code: 'INVALID_PLANNING_USER',
          status: 422,
          fieldErrors: { planningAssignedUserId: 'Select an authorised Planning user.' },
        });
      }
      const productionLocation = validated.planning.productionLocationId
        ? branches.find(branch => branch.id === validated.planning.productionLocationId)
        : null;
      if (validated.planning.productionLocationId && !productionLocation) {
        throw new ServiceError('Select a recognised production location or branch.', {
          code: 'INVALID_PRODUCTION_LOCATION',
          status: 422,
          fieldErrors: { planningProductionLocationId: 'Select a recognised production location or branch.' },
        });
      }
      if (!accountCan(account, PERMISSIONS.ADD_PLANNING_INFORMATION)) {
        throw new ServiceError('Your account cannot add Planning information.', { code: 'FORBIDDEN', status: 403 });
      }
      return {
        ...request,
        data: {
          ...validated,
          planning: {
            ...validated.planning,
            assignedPlanningUserName: assignedPlanningUser.name,
            productionLocationName: productionLocation?.name || '',
          },
        },
      };
    }
    if (request.action === 'start_qa' || request.action === 'start_qa_reinspection') {
      return { ...request, data: { qaStart: validateQaStart(request.data?.qaStart || request.data) } };
    }
    if (request.action === 'pass_qa') {
      return { ...request, data: { qaPass: validateQaPass(request.data?.qaPass || request.data) } };
    }
    if (request.action === 'fail_qa') {
      return { ...request, data: { qaFailure: validateQaFailure(request.data?.qaFailure || request.data) } };
    }
    if (request.action === 'resubmit_to_qa') {
      return { ...request, data: { qaRework: validateQaRework(request.data?.qaRework || request.data) } };
    }
    if (request.action === 'confirm_dispatch_receipt') {
      return { ...request, data: { dispatchReceipt: validateDispatchReceipt(request.data) } };
    }
    if ([
      'mark_ready_for_collection',
      'start_delivery',
      'confirm_collection',
      'confirm_delivery',
      'complete_collection',
      'complete_delivery',
      'report_delivery_problem',
    ].includes(request.action)) {
      if (
        !accountCan(account, PERMISSIONS.CONFIRM_DELIVERY)
        && !accountCan(account, PERMISSIONS.CONFIRM_COLLECTION)
      ) {
        throw new ServiceError('Your account cannot update Dispatch handovers.', { code: 'FORBIDDEN', status: 403 });
      }
      const validated = validateDispatchAction(request.action, request.data);
      const proofFile = validated.dispatchProofFile;
      const proofOfDelivery = validated.dispatchUpdate.proofOfDelivery
        ? {
          ...validated.dispatchUpdate.proofOfDelivery,
          ...(proofFile ? {
            id: makeId('dispatch-proof'),
            fileName: String(proofFile.name || 'dispatch-proof'),
            mimeType: String(proofFile.type || 'application/octet-stream'),
            sizeBytes: Number(proofFile.size || 0),
            uploadedAt: now().toISOString(),
          } : {}),
        }
        : null;
      return {
        ...request,
        data: {
          dispatchUpdate: {
            ...validated.dispatchUpdate,
            proofOfDelivery,
          },
        },
      };
    }
    const hasExpeditingPayload = Boolean(
      request.data?.expeditingUpdate
      || request.data?.expeditingCustomerMessage
      || request.data?.expeditingProgressStep
      || request.data?.expeditingReadyExceptionAuthorised,
    );
    if (
      ['start_expediting', 'add_expediting_update', 'complete_expediting'].includes(request.action)
      || (['place_on_hold', 'resume_order'].includes(request.action) && hasExpeditingPayload)
    ) {
      if (!accountCan(account, PERMISSIONS.UPDATE_ORDER_PROGRESS) && !accountCan(account, PERMISSIONS.MOVE_TO_DISPATCH)) {
        throw new ServiceError('Your account cannot update Expediting progress.', { code: 'FORBIDDEN', status: 403 });
      }
      return {
        ...request,
        data: validateExpeditingAction(request.action, request.data, { today: now().toISOString().slice(0, 10) }),
      };
    }
    return request;
  };

  const actorSnapshot = account => ({
    id: account.id,
    role: account.role,
    displayName: account.contact || account.company || account.role,
  });

  const applyPhase21WorkflowData = (entity, action, data, account) => {
    const occurredAt = now().toISOString();
    let updated = { ...entity };
    if (action === 'submit_to_expediting') {
      updated = orderRequiresLaboratory(updated)
        ? ensureLaboratoryRecord(updated)
        : {
          ...updated,
          routing: {
            ...(updated.routing || {}),
            requiresLaboratory: false,
            certificationTypes: [],
            qaRequired: true,
            route: 'planning_expediting_qa_dispatch',
          },
        };
    }
    if ([
      'receive_lab_order',
      'start_lab_calibration',
      'hold_lab_calibration',
      'resume_lab_calibration',
      'complete_lab_calibration',
      'mark_lab_ready_for_release',
      'release_from_lab',
    ].includes(action)) {
      updated = ensureLaboratoryRecord(updated);
      const statusByAction = {
        receive_lab_order: 'received',
        start_lab_calibration: 'calibration_in_progress',
        hold_lab_calibration: 'calibration_on_hold',
        resume_lab_calibration: 'calibration_in_progress',
        complete_lab_calibration: 'calibration_completed',
        mark_lab_ready_for_release: 'awaiting_release',
        release_from_lab: 'released',
      };
      const update = {
        id: makeId('laboratory-update'),
        action,
        status: statusByAction[action],
        customerMessage: String(data?.labUpdate?.customerMessage || data?.comment || '').trim(),
        internalNote: String(data?.labUpdate?.internalNote || '').trim(),
        customerVisible: action !== 'mark_lab_ready_for_release',
        updatedBy: actorSnapshot(account),
        createdAt: occurredAt,
      };
      updated.laboratory = {
        ...updated.laboratory,
        status: statusByAction[action],
        currentMessage: update.customerMessage || updated.laboratory.currentMessage || '',
        receivedAt: action === 'receive_lab_order' ? occurredAt : updated.laboratory.receivedAt,
        receivedBy: action === 'receive_lab_order' ? actorSnapshot(account) : updated.laboratory.receivedBy,
        releasedAt: action === 'release_from_lab' ? occurredAt : updated.laboratory.releasedAt,
        releasedBy: action === 'release_from_lab' ? actorSnapshot(account) : updated.laboratory.releasedBy,
        releaseNote: action === 'release_from_lab' ? String(data?.labRelease?.note || '').trim() : updated.laboratory.releaseNote,
        releaseDestination: action === 'release_from_lab' ? data?.labRelease?.destination : updated.laboratory.releaseDestination,
        updates: [...(updated.laboratory.updates || []), update],
        lastUpdatedAt: occurredAt,
      };
      if (action === 'receive_lab_order') {
        updated.laboratory.units = updated.laboratory.units.map(unit => ({
          ...unit,
          status: unit.status === 'awaiting_lab' ? 'received' : unit.status,
          receivedAt: unit.receivedAt || occurredAt,
          updatedAt: occurredAt,
          updatedBy: actorSnapshot(account),
        }));
      }
      if (action === 'release_from_lab') {
        updated.laboratory.units = updated.laboratory.units.map(unit => ({
          ...unit,
          status: 'released',
          movementStatus: 'released',
          releasedAt: unit.releasedAt || occurredAt,
          updatedAt: occurredAt,
        }));
      }
    }
    if (['confirm_lab_receipt_expediting', 'confirm_lab_receipt_dispatch'].includes(action)) {
      updated = ensureLaboratoryRecord(updated);
      const receivingDepartment = action === 'confirm_lab_receipt_dispatch' ? 'dispatch' : 'expediting';
      const receipt = {
        id: makeId('laboratory-receipt'),
        receivingDepartment,
        receivedAt: occurredAt,
        receivedBy: actorSnapshot(account),
      };
      updated.laboratory = {
        ...updated.laboratory,
        movementStatus: 'released_from_lab',
        receivingDepartment,
        receivedAfterLabAt: occurredAt,
        receivedAfterLabBy: actorSnapshot(account),
        receipts: [...(updated.laboratory.receipts || []), receipt],
        units: updated.laboratory.units.map(unit => ({
          ...unit,
          movementStatus: 'received_after_lab',
          receivedAfterLabAt: occurredAt,
          receivedAfterLabBy: actorSnapshot(account),
        })),
        lastUpdatedAt: occurredAt,
      };
    }
    if (['start_qa', 'start_qa_reinspection', 'pass_qa', 'fail_qa', 'start_qa_rework', 'resubmit_to_qa', 'release_qa_order'].includes(action)) {
      const previous = updated.qualityAssurance || { attempt: 0, reworkCycle: 0, inspections: [], reworkHistory: [] };
      const isInspectionStart = ['start_qa', 'start_qa_reinspection'].includes(action);
      const attempt = isInspectionStart ? Number(previous.attempt || 0) + 1 : Number(previous.attempt || 1);
      let inspections = [...(previous.inspections || [])];
      if (action === 'pass_qa') {
        inspections.push({
          id: makeId('qa-inspection'),
          attempt,
          result: 'passed',
          ...data.qaPass,
          inspectedBy: actorSnapshot(account),
          createdAt: occurredAt,
        });
      }
      if (action === 'fail_qa') {
        inspections.push({
          id: makeId('qa-inspection'),
          attempt,
          result: 'failed',
          ...data.qaFailure,
          inspectedBy: actorSnapshot(account),
          createdAt: occurredAt,
        });
      }
      const reworkCycle = action === 'start_qa_rework' ? Number(previous.reworkCycle || 0) + 1 : Number(previous.reworkCycle || 0);
      const reworkHistory = [...(previous.reworkHistory || [])];
      if (action === 'start_qa_rework') {
        reworkHistory.push({
          id: makeId('qa-rework'),
          cycle: reworkCycle,
          status: 'in_progress',
          problem: previous.currentProblem ? { ...previous.currentProblem } : null,
          responsibleDepartment: previous.currentProblem?.reworkDestination || 'expediting',
          startedBy: actorSnapshot(account),
          startedAt: occurredAt,
        });
      }
      if (action === 'resubmit_to_qa') {
        const index = reworkHistory.findLastIndex(item => Number(item.cycle) === Number(reworkCycle));
        const completed = {
          ...(index >= 0 ? reworkHistory[index] : { id: makeId('qa-rework'), cycle: reworkCycle }),
          ...data.qaRework,
          status: 'completed',
          completedBy: actorSnapshot(account),
          completedAt: occurredAt,
        };
        if (index >= 0) reworkHistory[index] = completed;
        else reworkHistory.push(completed);
      }
      updated.qualityAssurance = {
        ...previous,
        attempt,
        reworkCycle,
        inspections,
        reworkHistory,
        currentProblem: action === 'fail_qa' ? { ...data.qaFailure } : (action === 'pass_qa' ? null : previous.currentProblem || null),
        customerMessage: data.qaFailure?.customerMessage || data.qaPass?.customerMessage || data.qaRework?.customerMessage || previous.customerMessage || '',
        lastUpdatedAt: occurredAt,
        lastUpdatedBy: actorSnapshot(account),
        ...(isInspectionStart ? {
          startedAt: occurredAt,
          startedBy: actorSnapshot(account),
          checklistReference: data.qaStart?.checklistReference || previous.checklistReference || '',
        } : {}),
        ...(action === 'release_qa_order' ? {
          handoverStatus: 'handed_to_dispatch',
          handedToDispatchAt: occurredAt,
          handedToDispatchBy: actorSnapshot(account),
        } : {}),
      };
      updated.routing = {
        ...(updated.routing || {}),
        requiresLaboratory: false,
        qaRequired: true,
        route: 'planning_expediting_qa_dispatch',
      };
    }
    return updated;
  };

  const notificationMatchesAccount = (account, notification) => canAccessNotification(account, notification);
  const notificationPreferencesForAccount = account => {
    const stored = readNotificationPreferenceRecords()[account.id];
    if (stored) return normaliseNotificationPreferences(stored);
    const defaults = createDefaultNotificationPreferences();
    if (account.role !== USER_ROLES.CUSTOMER) return defaults;
    const personalisation = normaliseCustomerPersonalisation(readPersonalisation()[account.id]);
    return normaliseNotificationPreferences({
      ...defaults,
      categories: personalisation.notificationPreferences,
    });
  };

  const deliveryRecipientsForAccount = (account, notification) => {
    if (account.role === USER_ROLES.CUSTOMER) return ['customer'];
    if (account.role === USER_ROLES.SALES_REPRESENTATIVE) return ['assigned_representative', 'selected_representative'];
    if (accountCan(account, PERMISSIONS.VIEW_ALL_RFQS) || accountCan(account, PERMISSIONS.VIEW_ALL_ORDERS)) {
      return notification.recipients || [];
    }
    return [account.role];
  };

  const presentNotification = (account, notification, preferences = notificationPreferencesForAccount(account)) => {
    const recipientKeys = deliveryRecipientsForAccount(account, notification);
    const enabledChannels = new Set([
      'in_app',
      ...(preferences.channels.email ? ['email'] : []),
      ...(preferences.channels.push ? ['push'] : []),
    ]);
    return {
      ...notification,
      message: messageForNotificationRecipient(notification, account.role),
      messages: undefined,
      deliveries: (notification.deliveries || []).filter(delivery => (
        recipientKeys.includes(delivery.recipient) && enabledChannels.has(delivery.channel)
      )),
      readAt: (notification.readBy || []).includes(account.id)
        ? notification.readAtBy?.[account.id] || notification.createdAt
        : '',
    };
  };

  const publishWorkflowNotifications = ({
    action,
    record,
    createdOrder = null,
    actor,
    input = {},
  }) => {
    const occurredAt = now().toISOString();
    const requests = notificationRequestsForWorkflowAction({
      action,
      record,
      createdOrder,
      input,
    });
    const created = requests.map(request => createNotificationRecord({
      id: makeId('notification'),
      actor,
      occurredAt,
      ...request,
    }));
    for (const notification of created) {
      appendNotification(notification);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'notification_created',
        action: 'notification.created',
        outcome: 'success',
        entityType: notification.entityType,
        entityId: notification.entityId,
        companyId: notification.companyId,
        companyName: notification.companyName || '',
        reference: notification.reference,
        actorId: actor?.id || 'workflow-service',
        actorRole: actor?.role || SYSTEM_ACTOR_ROLE,
        actorDisplayName: actor?.displayName || 'Workflow service',
        requestId: notification.audit?.requestId || notification.id,
        correlationId: notification.audit?.correlationId || notification.id,
        fieldsChanged: [],
        reason: `Notification generated for ${notification.eventType}.`,
        notificationResults: notification.deliveries.map(delivery => ({
          channel: delivery.channel,
          recipient: delivery.recipient,
          status: delivery.status,
          simulated: delivery.simulated === true,
        })),
        documentMetadata: [],
        isOverride: false,
        immutable: true,
        details: {
          notificationId: notification.id,
          eventType: notification.eventType,
          recipients: notification.recipients,
          deliveryStatuses: notification.deliveries.map(delivery => delivery.status),
        },
        createdAt: occurredAt,
      });
    }
    return created;
  };

  const initialize = async () => {
    let accounts = store.get(STORE_KEYS.accounts, null);
    if (!accounts) accounts = store.get(LEGACY_STORE_KEYS.accounts, []);
    accounts = accounts.map(normaliseAccount);
    for (const seed of [
      DEMO_ACCOUNT,
      SALES_ACCOUNT,
      PLANNING_ACCOUNT,
      EXPEDITOR_ACCOUNT,
      LAB_ACCOUNT,
      LAB_MANAGER_ACCOUNT,
      QA_ACCOUNT,
      QA_MANAGER_ACCOUNT,
      DISPATCH_ACCOUNT,
      BUYER_ACCOUNT,
      SALES_MANAGER_ACCOUNT,
      COMPANY_OWNER_ACCOUNT,
      MANAGER_ACCOUNT,
      ADMINISTRATOR_ACCOUNT,
      ...EXTRA_DEMO_ACCOUNTS,
    ]) {
      const index = accounts.findIndex(account => account.id === seed.id || account.email?.toLowerCase() === seed.email.toLowerCase());
      if (index >= 0) accounts[index] = normaliseAccount({
        ...accounts[index],
        ...seed,
        password: accounts[index].password || seed.password,
        signInName: accounts[index].signInName || seed.signInName || '',
        passwordChangedAt: accounts[index].passwordChangedAt || '',
      });
      else accounts.push(normaliseAccount(seed));
    }
    writeAccounts(accounts);

    let workflowState;
    if (store.has(STORE_KEYS.workflowState)) {
      workflowState = readWorkflowState();
    } else {
      const currentRecords = store.get(STORE_KEYS.enquiries, null);
      const legacyRecords = currentRecords || store.get(LEGACY_STORE_KEYS.enquiries, []);
      const separatelyStoredOrders = store.get(STORE_KEYS.orders, []);
      const migratedRecords = [...legacyRecords, ...separatelyStoredOrders].map(normaliseEnquiry);
      workflowState = {
        enquiries: migratedRecords.filter(record => record.workflowType === 'rfq'),
        orders: migratedRecords.filter(record => record.workflowType === 'order'),
      };
    }
    workflowState.orders = workflowState.orders.map(record => {
      const currentSeed = record.isDemo
        ? DEMO_ENQUIRIES.find(seed => seed.id === record.id && seed.workflowType === 'order')
        : null;
      if (!currentSeed) return record;
      return {
        ...record,
        reference: currentSeed.reference || record.reference,
        sourceRfqReference: record.sourceRfqReference || currentSeed.sourceRfqReference || '',
        internalJobNumber: record.internalJobNumber || currentSeed.internalJobNumber || '',
        customerPoNumber: record.customerPoNumber || currentSeed.customerPoNumber || '',
      };
    });
    if (!store.has(STORE_KEYS.seedVersion)) {
      for (const demo of [...DEMO_ENQUIRIES, ...PHASE21_DEMO_ORDERS]) {
        const record = normaliseEnquiry(demo);
        const collection = record.workflowType === 'order' ? workflowState.orders : workflowState.enquiries;
        if (!collection.some(existing => existing.id === record.id)) collection.push(record);
      }
      store.set(STORE_KEYS.seedVersion, true);
    }
    workflowState.orders = workflowState.orders.map(order => (
      orderRequiresLaboratory(order) ? ensureLaboratoryRecord(order) : order
    ));
    writeWorkflowState(workflowState);
    if (!store.has(STORE_KEYS.audit)) store.set(STORE_KEYS.audit, []);
    if (!store.has(STORE_KEYS.orderDocuments)) store.set(STORE_KEYS.orderDocuments, []);
    if (!store.has(STORE_KEYS.retentionPolicy)) writeRetentionPolicy(DEFAULT_RETENTION_POLICY);
    if (!store.has(STORE_KEYS.retentionExports)) store.set(STORE_KEYS.retentionExports, []);
    if (!store.has(STORE_KEYS.deletionLog)) store.set(STORE_KEYS.deletionLog, []);
    if (!store.has(STORE_KEYS.idempotency)) writeIdempotencyRecords({});
    if (!store.has(STORE_KEYS.managementExports)) writeManagementExports([]);
    if (!store.has(STORE_KEYS.notifications)) store.set(STORE_KEYS.notifications, []);
    if (!store.has(STORE_KEYS.notificationPreferences)) store.set(STORE_KEYS.notificationPreferences, {});
    if (!store.has(STORE_KEYS.personalisation)) store.set(STORE_KEYS.personalisation, {});
    if (!store.has(STORE_KEYS.mockImages)) store.set(STORE_KEYS.mockImages, {});
    if (!store.has(STORE_KEYS.certificateFiles)) store.set(STORE_KEYS.certificateFiles, {});
    if (!store.has(STORE_KEYS.credentialChallenges)) store.set(STORE_KEYS.credentialChallenges, []);
    if (!store.has(STORE_KEYS.customerRepresentativeAssignments)) {
      const assignments = {};
      for (const record of [...workflowState.enquiries, ...workflowState.orders]) {
        if (record.companyId && record.representativeId && !assignments[record.companyId]) {
          assignments[record.companyId] = {
            companyId: record.companyId,
            representativeId: record.representativeId,
            assignedAt: record.assignedAt || record.createdAt,
            source: 'seed_or_existing_record',
          };
        }
      }
      writeCustomerRepresentativeAssignments(assignments);
    }

    if (!store.has(STORE_KEYS.session)) {
      const legacySession = store.get(LEGACY_STORE_KEYS.session, null);
      if (legacySession) {
        store.set(STORE_KEYS.session, legacySession);
        store.remove(LEGACY_STORE_KEYS.session);
      }
    }
  };

  const auth = {
    async getSession() {
      return toPublicAccount(currentStoredAccount());
    },

    async signIn(credentials) {
      validateSignIn(credentials);
      const identifier = credentials.email.trim().toLowerCase();
      const matched = readAccounts().find(account => (
        (account.email.toLowerCase() === identifier || account.signInName?.toLowerCase() === identifier)
        && account.password === credentials.password
        && account.status !== 'suspended'
        && (!credentials.realm || account.authRealm === credentials.realm)
      ));
      if (!matched) throw new ServiceError('The email address or password does not match a preview account.', { code: 'INVALID_CREDENTIALS', status: 401 });
      store.set(STORE_KEYS.session, { accountId: matched.id, signedInAt: now().toISOString() });
      return toPublicAccount(matched);
    },

    async register(data) {
      validateRegistration(data);
      const accounts = readAccounts();
      const email = data.email.trim().toLowerCase();
      if (accounts.some(account => account.email.toLowerCase() === email)) {
        throw new ServiceError('An account with this email address already exists on this device.', { code: 'ACCOUNT_EXISTS', status: 409, fieldErrors: { email: 'This email is already registered.' } });
      }
      const accountId = makeId('account');
      const account = normaliseAccount({
        id: accountId,
        companyId: makeId('company'),
        company: data.company.trim(),
        contact: data.contact.trim(),
        email,
        phone: data.phone.trim(),
        area: data.area,
        industry: data.industry,
        role: USER_ROLES.CUSTOMER,
        authRealm: 'customer',
        password: data.password,
        createdAt: now().toISOString(),
      });
      writeAccounts([...accounts, account]);
      store.set(STORE_KEYS.session, { accountId: account.id, signedInAt: now().toISOString() });
      return toPublicAccount(account);
    },

    async signOut() {
      store.remove(STORE_KEYS.session);
      store.remove(LEGACY_STORE_KEYS.session);
    },

    async getDemoLogins() {
      return clone(DEMO_LOGINS);
    },
  };

  const accounts = {
    async getCurrent() {
      return toPublicAccount(requireAccount());
    },

    async getRegistrationOptions() {
      const areaDirectory = Object.fromEntries(areas.map(area => {
        const { branch, representatives } = representativesForArea(area);
        return [area, { branch: clone(branch), representatives: clone(representatives) }];
      }));
      return { areas: clone(areas), industries: clone(industries), branches: clone(branches), areaDirectory };
    },

    async listCompanies() {
      const account = requireAccount();
      if (roleCan(account.role, PERMISSIONS.VIEW_ALL_COMPANIES)) {
        return readAccounts()
          .filter(item => roleCan(item.role, PERMISSIONS.VIEW_OWN_COMPANY_ACCOUNT))
          .filter(item => (
            !Array.isArray(account.authorisedCompanyIds)
            || !account.authorisedCompanyIds.length
            || account.authorisedCompanyIds.includes(item.companyId)
          ))
          .map(item => ({ id: item.companyId, name: item.company, area: item.area, industry: item.industry }));
      }
      if (roleCan(account.role, PERMISSIONS.VIEW_OWN_COMPANY_ACCOUNT)) {
        return [{ id: account.companyId, name: account.company, area: account.area, industry: account.industry }];
      }
      throw new ServiceError('Your role is not permitted to view company accounts.', { code: 'FORBIDDEN', status: 403 });
    },
  };

  const credentials = {
    async requestVerification({ changeType } = {}) {
      const account = requireAccount();
      if (!['username', 'password'].includes(changeType)) {
        throw new ServiceError('Choose a username or password change.', {
          code: 'CREDENTIAL_CHANGE_TYPE_INVALID',
          status: 422,
          fieldErrors: { changeType: 'Choose a supported credential change.' },
        });
      }
      const requestedAt = now();
      const recent = readCredentialChallenges().filter(challenge => (
        challenge.accountId === account.id
        && requestedAt - new Date(challenge.createdAt) < 60 * 60 * 1000
      ));
      if (recent.length >= 3) {
        throw new ServiceError('Too many verification requests. Wait before trying again.', {
          code: 'CREDENTIAL_VERIFICATION_RATE_LIMITED',
          status: 429,
        });
      }
      const challenge = {
        id: makeId('credential-challenge'),
        accountId: account.id,
        authRealm: account.authRealm,
        changeType,
        code: String(Math.floor(100000 + Math.random() * 900000)),
        attempts: 0,
        maxAttempts: 5,
        createdAt: requestedAt.toISOString(),
        expiresAt: new Date(requestedAt.getTime() + 10 * 60 * 1000).toISOString(),
        usedAt: '',
      };
      writeCredentialChallenges([...readCredentialChallenges(), challenge]);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'authentication.credential_verification_requested',
        outcome: 'success',
        entityType: 'user',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { changeType, simulatedEmail: true },
        immutable: true,
        createdAt: challenge.createdAt,
      });
      const [localPart, domain] = account.email.split('@');
      const maskedEmail = `${localPart.slice(0, 2)}***@${domain}`;
      return clone({
        challengeId: challenge.id,
        changeType,
        maskedEmail,
        expiresAt: challenge.expiresAt,
        maxAttempts: challenge.maxAttempts,
        deliveryStatus: 'email_sent_simulated',
        demoVerificationCode: challenge.code,
      });
    },

    async confirmChange({ challengeId, code, newUsername, newPassword } = {}) {
      const account = requireAccount();
      const challenges = readCredentialChallenges();
      const index = challenges.findIndex(challenge => challenge.id === challengeId && challenge.accountId === account.id);
      if (index < 0) throw new ServiceError('The verification request could not be found.', { code: 'CREDENTIAL_CHALLENGE_NOT_FOUND', status: 404 });
      const challenge = challenges[index];
      const occurredAt = now();
      if (challenge.usedAt) throw new ServiceError('This verification code has already been used.', { code: 'CREDENTIAL_CODE_ALREADY_USED', status: 409 });
      if (occurredAt > new Date(challenge.expiresAt)) throw new ServiceError('The verification code has expired. Request a new one.', { code: 'CREDENTIAL_CODE_EXPIRED', status: 410 });
      if (challenge.attempts >= challenge.maxAttempts) throw new ServiceError('The verification request is locked after too many attempts.', { code: 'CREDENTIAL_CHALLENGE_LOCKED', status: 423 });
      if (String(code || '').trim() !== challenge.code) {
        challenges[index] = { ...challenge, attempts: challenge.attempts + 1 };
        writeCredentialChallenges(challenges);
        appendAuditEvent({
          id: makeId('audit'),
          action: 'authentication.credential_verification_failed',
          outcome: 'denied',
          entityType: 'user',
          entityId: account.id,
          companyId: account.companyId,
          actorId: account.id,
          actorRole: account.role,
          details: { changeType: challenge.changeType, attempts: challenge.attempts + 1 },
          immutable: true,
          createdAt: occurredAt.toISOString(),
        });
        throw new ServiceError('The verification code is incorrect.', {
          code: 'CREDENTIAL_CODE_INVALID',
          status: 422,
          fieldErrors: { verificationCode: 'Check the six-digit code and try again.' },
        });
      }
      const allAccounts = readAccounts();
      const accountIndex = allAccounts.findIndex(item => item.id === account.id);
      let updated;
      if (challenge.changeType === 'username') {
        const username = String(newUsername || '').trim();
        if (!/^[a-zA-Z][a-zA-Z0-9._-]{2,39}$/.test(username)) {
          throw new ServiceError('Use 3–40 characters, beginning with a letter.', {
            code: 'USERNAME_INVALID',
            status: 422,
            fieldErrors: { newUsername: 'Use letters, numbers, dots, underscores or hyphens.' },
          });
        }
        if (allAccounts.some(item => item.id !== account.id && item.signInName?.toLowerCase() === username.toLowerCase())) {
          throw new ServiceError('That username is already in use.', {
            code: 'USERNAME_EXISTS',
            status: 409,
            fieldErrors: { newUsername: 'Choose a different username.' },
          });
        }
        updated = { ...allAccounts[accountIndex], signInName: username, usernameChangedAt: occurredAt.toISOString() };
      } else {
        const password = String(newPassword || '');
        const strong = password.length >= 10
          && /[a-z]/.test(password)
          && /[A-Z]/.test(password)
          && /\d/.test(password)
          && /[^a-zA-Z0-9]/.test(password);
        if (!strong) {
          throw new ServiceError('Use at least 10 characters with upper-case, lower-case, number and symbol.', {
            code: 'PASSWORD_WEAK',
            status: 422,
            fieldErrors: { newPassword: 'Use a stronger password.' },
          });
        }
        if (password === allAccounts[accountIndex].password) {
          throw new ServiceError('Choose a password that is different from the current password.', {
            code: 'PASSWORD_REUSED',
            status: 422,
            fieldErrors: { newPassword: 'Choose a new password.' },
          });
        }
        updated = { ...allAccounts[accountIndex], password, passwordChangedAt: occurredAt.toISOString() };
      }
      allAccounts[accountIndex] = updated;
      writeAccounts(allAccounts);
      challenges[index] = { ...challenge, code: '', usedAt: occurredAt.toISOString(), attempts: challenge.attempts + 1 };
      writeCredentialChallenges(challenges);
      appendAuditEvent({
        id: makeId('audit'),
        action: `authentication.${challenge.changeType}_changed`,
        outcome: 'success',
        entityType: 'user',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        fieldsChanged: [challenge.changeType === 'username' ? 'signInName' : 'passwordHash'],
        details: { authRealm: account.authRealm, sessionsInvalidated: challenge.changeType === 'password' },
        immutable: true,
        createdAt: occurredAt.toISOString(),
      });
      const sessionEnded = challenge.changeType === 'password';
      if (sessionEnded) store.remove(STORE_KEYS.session);
      return clone({ account: toPublicAccount(updated), sessionEnded });
    },
  };

  const productService = {
    async getCatalogue() {
      return { categories: clone(categories), products: clone(products), recommendedCategories: clone(recommendedCategories) };
    },

    async list({ categoryId, query } = {}) {
      const term = String(query || '').trim().toLowerCase();
      return clone(products.filter(product => (!categoryId || product.category === categoryId) && (!term || `${product.code} ${product.name} ${product.description} ${product.measuringRange}`.toLowerCase().includes(term))));
    },

    async getById(productId) {
      const product = products.find(item => item.id === productId);
      if (!product) throw new ServiceError('That product could not be found.', { code: 'PRODUCT_NOT_FOUND', status: 404 });
      return clone(product);
    },
  };

  const enquiries = {
    async list() {
      const account = requireAccount();
      return clone(readAllEnquiries().filter(enquiry => canReadRecord(account, enquiry)).map(enquiry => presentRecord(account, enquiry)));
    },

    async getById(enquiryId) {
      const account = requireAccount();
      const enquiry = readAllEnquiries().find(item => item.id === enquiryId);
      if (!enquiry || !canReadRecord(account, enquiry)) throw new ServiceError('The RFQ was not found or is outside your authorised company account.', { code: 'ENQUIRY_NOT_FOUND', status: 404 });
      return clone(presentRecord(account, enquiry));
    },

    async listRepresentativeInbox() {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.VIEW_ASSIGNED_RFQS) || !account.representativeId) {
        throw new ServiceError('Your account does not have a representative RFQ inbox.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone(readAllEnquiries()
        .filter(enquiry => canReadRecord(account, enquiry))
        .map(enquiry => presentRecord(account, enquiry)));
    },

    async getDraft() {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.CREATE_RFQ)) return [];
      const drafts = store.get(STORE_KEYS.draft, {});
      return clone(Array.isArray(drafts) ? drafts : drafts[account.id] || []);
    },

    async saveDraft(lines) {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.CREATE_RFQ)) throw new ServiceError('This account cannot save an RFQ draft.', { code: 'FORBIDDEN', status: 403 });
      const stored = store.get(STORE_KEYS.draft, {});
      const drafts = Array.isArray(stored) ? {} : stored;
      drafts[account.id] = clone(lines);
      store.set(STORE_KEYS.draft, drafts);
      return clone(lines);
    },

    async submit(details, lines) {
      const account = requireAccount();
      if (!roleCan(account.role, PERMISSIONS.CREATE_RFQ)) throw new ServiceError('This account cannot submit customer RFQs.', { code: 'FORBIDDEN', status: 403 });
      validateCustomerAccountForRfq(account);
      validateEnquiry(details, lines);
      validateConfiguredProducts(lines);
      const representativeDirectory = representativesForArea(details.area);
      const companyAssignments = readCustomerRepresentativeAssignments();
      const existingAssignment = companyAssignments[account.companyId];
      const dedicatedRepresentative = existingAssignment
        ? representativeById(existingAssignment.representativeId)
        : null;
      const selectedRepresentative = dedicatedRepresentative
        || validateRepresentativeAssignment(details.selectedRep, representativeDirectory.representatives);
      const submissionKey = String(details?.submissionKey || '').trim();
      if (!submissionKey || submissionKey.length < 8 || submissionKey.length > 160) {
        throw new ServiceError('Refresh the RFQ form and try again.', {
          code: 'INVALID_IDEMPOTENCY_KEY',
          status: 422,
          fieldErrors: { submission: 'A valid submission key is required to prevent duplicate RFQs.' },
        });
      }
      const idempotencyRecords = readIdempotencyRecords();
      const existingSubmission = idempotencyRecords[`rfq:${account.id}:${submissionKey}`];
      if (existingSubmission) {
        const existingEnquiry = readAllEnquiries().find(item => item.id === existingSubmission.entityId);
        if (existingEnquiry && canReadRecord(account, existingEnquiry)) {
          return {
            enquiry: clone(presentRecord(account, existingEnquiry)),
            delivery: clone(existingSubmission.delivery),
            idempotent: true,
          };
        }
      }
      const { poFile, submissionKey: _submissionKey, ...serialisableDetails } = details;
      const reference = nextRfqReference();
      const createdAt = now().toISOString();
      const assignedRepresentative = {
        ...clone(selectedRepresentative),
        branchName: branches.find(branch => branch.id === selectedRepresentative.branchId)?.name
          || representativeDirectory.branch.name,
      };
      if (!existingAssignment) {
        companyAssignments[account.companyId] = {
          companyId: account.companyId,
          representativeId: assignedRepresentative.id,
          assignedAt: createdAt,
          assignedBy: 'customer_first_rfq',
        };
        writeCustomerRepresentativeAssignments(companyAssignments);
        appendAuditEvent({
          id: makeId('audit'),
          action: 'company.representative_assigned',
          outcome: 'success',
          entityType: 'company',
          entityId: account.companyId,
          companyId: account.companyId,
          actorId: account.id,
          actorRole: account.role,
          fieldsChanged: ['representativeId'],
          immutable: true,
          createdAt,
        });
      }
      const documentMetadata = poFile ? [{
        id: makeId('document'),
        documentType: 'purchase_order',
        fileName: poFile.name,
        mimeType: poFile.type || 'application/octet-stream',
        sizeBytes: Number(poFile.size || 0),
        uploadedAt: createdAt,
        storageStatus: 'metadata_only',
      }] : [];
      const baseEnquiry = {
        id: makeId('enquiry'),
        reference,
        version: 0,
        accountId: account.id,
        companyId: account.companyId,
        company: account.company,
        contact: account.contact,
        email: account.email,
        phone: account.phone,
        ...serialisableDetails,
        selectedRep: assignedRepresentative,
        representativeId: assignedRepresentative.id,
        submittingCustomerId: account.id,
        submittingCustomer: {
          id: account.id,
          name: account.contact,
          email: account.email,
          phone: account.phone,
        },
        companySnapshot: {
          id: account.companyId,
          name: account.company,
          area: account.area,
          industry: account.industry,
        },
        customerNotes: serialisableDetails.notes || '',
        priority: serialisableDetails.emergency === 'yes' ? 'urgent' : 'standard',
        documents: documentMetadata,
        items: clone(lines),
        workflowType: 'rfq',
        trackingStatus: 'draft',
        status: 'Draft',
        trackingHistory: [],
        emailDeliveryStatus: 'sending',
        createdAt,
        updatedAt: createdAt,
      };
      const customerActor = createWorkflowActor(account);
      const submitted = performWorkflowTransition({
        entity: baseEnquiry,
        action: 'submit_rfq',
        actor: customerActor,
        input: { comment: 'RFQ submitted by the customer and saved to the account.' },
        now,
      });
      const assigned = performWorkflowTransition({
        entity: submitted.entity,
        action: 'assign_representative',
        actor: { id: 'mock-workflow-system', role: SYSTEM_ACTOR_ROLE, displayName: 'Workflow service' },
        input: {},
        now,
      });
      appendAuditEvent(submitted.auditEvent);
      appendAuditEvent(assigned.auditEvent);
      publishWorkflowNotifications({
        action: 'submit_rfq',
        record: submitted.entity,
        actor: customerActor,
      });
      publishWorkflowNotifications({
        action: 'assign_representative',
        record: assigned.entity,
        actor: { id: 'mock-workflow-system', role: SYSTEM_ACTOR_ROLE, displayName: 'Workflow service' },
      });
      let enquiry = saveEnquiry(assigned.entity);

      let delivery;
      try {
        delivery = await emailSender(enquiry, poFile);
      } catch (error) {
        delivery = { ok: false, message: 'The RFQ is saved, but the test email could not be sent. Please use the email fallback or try again later.', warning: error?.message || '' };
      }
      delivery ||= { ok: false, message: 'The RFQ is saved, but the email service returned no result.' };

      enquiry = saveEnquiry({
        ...enquiry,
        emailDeliveryStatus: delivery.ok ? 'submitted' : 'pending',
        emailRecipient: delivery.recipient || '',
        deliveryMode: delivery.deliveryMode || 'saved-locally',
        pricedPdfAttached: Boolean(delivery.pricedPdfAttached),
        emailSubmittedAt: delivery.ok ? now().toISOString() : '',
        emailError: delivery.ok ? '' : delivery.message,
      });
      appendAuditEvent({
        id: makeId('audit'),
        action: 'rfq.email_delivery_requested',
        outcome: delivery.ok ? 'success' : 'failed',
        entityType: 'rfq',
        entityId: enquiry.id,
        companyId: enquiry.companyId,
        actorId: account.id,
        actorRole: account.role,
        createdAt: now().toISOString(),
      });
      idempotencyRecords[`rfq:${account.id}:${submissionKey}`] = {
        entityType: 'rfq',
        entityId: enquiry.id,
        delivery: clone(delivery),
        createdAt: now().toISOString(),
      };
      writeIdempotencyRecords(idempotencyRecords);
      await enquiries.saveDraft([]);
      return { enquiry: clone(presentRecord(account, enquiry)), delivery: clone(delivery) };
    },
  };

  const refreshRetentionStates = () => {
    const state = readWorkflowState();
    const policy = readRetentionPolicy();
    let changed = false;
    state.orders = state.orders.map(order => {
      const updated = applyRetentionState(order, policy, now());
      if (updated.retentionStatus !== order.retentionStatus || updated.archiveEligibleAt !== order.archiveEligibleAt) {
        changed = true;
        if (updated.retentionStatus === 'archive_eligible' && order.retentionStatus !== 'archive_eligible') {
          appendAuditEvent({
            id: makeId('audit'),
            eventType: 'order_archive_eligible',
            action: 'retention.archive_eligible',
            outcome: 'success',
            entityType: 'order',
            entityId: order.id,
            companyId: order.companyId,
            companyName: order.company,
            reference: order.reference,
            actorRole: SYSTEM_ACTOR_ROLE,
            fieldsChanged: ['retentionStatus', 'archiveEligibleAt'],
            details: { retentionPolicyId: policy.id },
            createdAt: now().toISOString(),
          });
        }
      }
      return updated;
    });
    if (changed) writeWorkflowState(state);
    return state.orders;
  };

  const orders = {
    async list() {
      const account = requireAccount();
      return clone(refreshRetentionStates()
        .filter(order => order.retentionStatus !== 'archived')
        .filter(order => canReadRecord(account, order))
        .map(order => presentRecord(account, order)));
    },

    async getById(orderId) {
      const account = requireAccount();
      const order = refreshRetentionStates().find(item => item.id === orderId && item.retentionStatus !== 'archived');
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found or is outside your authorised company account.', { code: 'ORDER_NOT_FOUND', status: 404 });
      return clone(presentRecord(account, order));
    },
  };

  const locateWorkflowRecord = (state, recordId, requestedType = '') => {
    const types = requestedType === 'order' ? ['order'] : requestedType === 'rfq' ? ['rfq'] : ['rfq', 'order'];
    for (const entityType of types) {
      const collection = entityType === 'order' ? state.orders : state.enquiries;
      const index = collection.findIndex(record => record.id === recordId);
      if (index >= 0) return { entityType, collection, index, record: collection[index] };
    }
    return null;
  };

  const createOrderFromRfq = ({ rfq, convertedRfq, orderId, orderReference, actor }) => {
    const {
      id: _rfqId,
      reference: _rfqReference,
      version: _rfqVersion,
      workflowType: _rfqType,
      trackingStatus: _rfqStatus,
      status: _rfqStatusLabel,
      trackingHistory: _rfqHistory,
      orderId: _linkedOrderId,
      ...customerSnapshot
    } = convertedRfq;
    const occurredAt = now().toISOString();
    const reference = orderReference;
    const items = (rfq.items || []).map(item => {
      const lineId = makeId('order-line');
      return {
        ...clone(item),
        lineId,
        orderItemId: lineId,
        sourceLineId: item.lineId,
        configurationSnapshot: clone(item.configuration || {}),
      };
    });
    const creationEvent = {
      id: makeId('workflow-event'),
      entityType: 'order',
      action: 'order_created_from_rfq',
      fromStatus: '',
      toStatus: 'awaiting_planning',
      status: 'awaiting_planning',
      label: 'Awaiting planning',
      note: 'Accepted RFQ converted into an order and submitted to Planning.',
      customerDescription: 'Your accepted RFQ has been converted into an order.',
      internalDescription: 'The service created an immutable order snapshot from the accepted RFQ.',
      customerVisible: true,
      actorId: actor.id,
      actorRole: actor.role,
      actor: actor.displayName,
      createdAt: occurredAt,
    };
    return normaliseEnquiry({
      ...customerSnapshot,
      id: orderId,
      reference,
      version: 0,
      workflowType: 'order',
      sourceEnquiryId: rfq.id,
      sourceRfqReference: rfq.reference,
      sourceRfqStatus: convertedRfq.trackingStatus,
      acceptedAt: convertedRfq.acceptedAt || rfq.acceptedAt,
      convertedFromRfqAt: occurredAt,
      trackingStatus: 'awaiting_planning',
      status: 'Awaiting planning',
      items,
      trackingHistory: [creationEvent],
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
  };

  const workflow = {
    async list() {
      const account = requireAccount();
      return clone(readAllRecords().filter(record => canReadRecord(account, record)).map(record => presentRecord(account, record)));
    },

    async getAllowedActions(recordId, { entityType = '' } = {}) {
      const account = requireAccount();
      const located = locateWorkflowRecord(readWorkflowState(), recordId, entityType);
      if (!located || !canReadRecord(account, located.record)) throw new ServiceError('The RFQ or order could not be found.', { code: 'WORKFLOW_RECORD_NOT_FOUND', status: 404 });
      return clone(getAllowedWorkflowActions(located.record, createWorkflowActor(account)));
    },

    async performAction(recordId, input) {
      const account = requireAccount();
      const request = prepareWorkflowRequest(input, account);
      const state = readWorkflowState();
      const located = locateWorkflowRecord(state, recordId, input?.entityType || '');
      if (!located) throw new ServiceError('The RFQ or order could not be found.', { code: 'WORKFLOW_RECORD_NOT_FOUND', status: 404 });
      const existing = located.record;
      const actor = createWorkflowActor(account);
      if (!canReadRecord(account, existing)) {
        const error = new ServiceError('The RFQ or order could not be found.', { code: 'WORKFLOW_RECORD_NOT_FOUND', status: 404 });
        appendAuditEvent(createDeniedWorkflowAudit({ entity: existing, action: request.action, actor, error, now }));
        throw error;
      }
      const isAcceptanceConversion = located.entityType === 'rfq' && request.action === 'accept_order';
      if (isAcceptanceConversion && existing.trackingStatus === 'converted_to_order') {
        const existingOrder = state.orders.find(order => order.id === existing.orderId || order.sourceEnquiryId === existing.id);
        if (!existingOrder) {
          const error = new ServiceError('This RFQ is marked as converted, but its linked order could not be found.', { code: 'ORDER_CONVERSION_INCONSISTENT', status: 409 });
          appendAuditEvent(createDeniedWorkflowAudit({ entity: existing, action: request.action, actor, error, now }));
          throw error;
        }
        appendAuditEvent({
          id: makeId('audit'),
          action: 'workflow.accept_order',
          outcome: 'idempotent_replay',
          entityType: 'rfq',
          entityId: existing.id,
          linkedOrderId: existingOrder.id,
          companyId: existing.companyId,
          actorId: actor.id,
          actorRole: actor.role,
          fromStatus: existing.trackingStatus,
          toStatus: existing.trackingStatus,
          createdAt: now().toISOString(),
        });
        return clone({
          ...presentRecord(account, existing),
          createdOrder: presentRecord(account, existingOrder),
          idempotent: true,
        });
      }
      const generatedOrderId = isAcceptanceConversion ? makeId('order') : '';
      const generatedOrderReference = isAcceptanceConversion ? nextOrderReference(state.orders) : '';
      let result;
      let acceptanceResult = null;
      try {
        if (isAcceptanceConversion) {
          acceptanceResult = performWorkflowTransition({
            entity: existing,
            action: 'accept_order',
            actor,
            input: { ...request.data, comment: request.comment },
            expectedVersion: request.expectedVersion,
            now,
          });
          result = performWorkflowTransition({
            entity: acceptanceResult.entity,
            action: 'convert_to_order',
            actor,
            input: { orderId: generatedOrderId, orderReference: generatedOrderReference },
            expectedVersion: acceptanceResult.entity.version,
            internal: true,
            now,
          });
        } else {
          result = performWorkflowTransition({
            entity: existing,
            action: request.action,
            actor,
            input: { ...request.data, comment: request.comment },
            expectedVersion: request.expectedVersion,
            now,
          });
        }
      } catch (error) {
        appendAuditEvent(createDeniedWorkflowAudit({ entity: existing, action: request.action, actor, error, now }));
        throw error;
      }
      const updated = normaliseEnquiry(applyPhase21WorkflowData(result.entity, request.action, request.data, account));
      located.collection[located.index] = updated;
      let createdOrder = null;
      if (isAcceptanceConversion) {
        createdOrder = createOrderFromRfq({
          rfq: existing,
          convertedRfq: updated,
          orderId: generatedOrderId,
          orderReference: generatedOrderReference,
          actor,
        });
        state.orders.unshift(createdOrder);
      }
      writeWorkflowState(state);
      if (acceptanceResult) appendAuditEvent(acceptanceResult.auditEvent);
      appendAuditEvent(result.auditEvent);
      if (createdOrder) {
        appendAuditEvent({
          id: makeId('audit'),
          action: 'order.created_from_rfq',
          outcome: 'success',
          entityType: 'order',
          entityId: createdOrder.id,
          sourceEntityId: updated.id,
          companyId: createdOrder.companyId,
          actorId: actor.id,
          actorRole: actor.role,
          fromStatus: '',
          toStatus: 'awaiting_planning',
          createdAt: now().toISOString(),
        });
      }
      publishWorkflowNotifications({
        action: request.action,
        record: updated,
        createdOrder,
        actor,
        input: request.data,
      });
      return clone({
        ...presentRecord(account, updated),
        ...(createdOrder ? { createdOrder: presentRecord(account, createdOrder) } : {}),
      });
    },
  };

  const orderDocuments = {
    async getSharingOptions(orderId) {
      const account = requireAccount();
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      if (!accountCan(account, PERMISSIONS.EXPORT_ORDER_PDF)) throw new ServiceError('Your role cannot export order summaries.', { code: 'FORBIDDEN', status: 403 });
      const representativeId = order.representativeId || order.selectedRep?.id || '';
      const representativeAccount = readAccounts().find(item => item.representativeId === representativeId);
      const representativeName = order.selectedRep?.name || representativeAccount?.contact || 'Assigned representative';
      const simulatedRepresentativeEmail = `${representativeName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'representative'}@rhomberg.example.invalid`;
      return clone({
        canEmail: accountCan(account, PERMISSIONS.EMAIL_ORDER_SUMMARY),
        representative: {
          name: representativeName,
          email: representativeAccount?.email || simulatedRepresentativeEmail,
        },
        internalRecipients: readAccounts()
          .filter(item => accountCan(item, PERMISSIONS.ACCESS_INTERNAL_WORKSPACE))
          .map(item => ({ id: item.id, name: item.contact, role: item.role, email: item.email }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      });
    },

    async generate(orderId, { copyType = ORDER_COPY_TYPES.CUSTOMER } = {}) {
      const account = requireAccount();
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      if (!accountCan(account, PERMISSIONS.EXPORT_ORDER_PDF)) {
        appendAuditEvent({
          id: makeId('audit'), eventType: 'order_summary_pdf_denied', action: 'order_summary.pdf_generated', outcome: 'denied',
          entityType: 'order', entityId: order.id, companyId: order.companyId, companyName: order.company, reference: order.reference,
          actorId: account.id, actorDisplayName: account.contact, actorRole: account.role, reason: 'Missing export_order_pdf permission',
          details: { copyType }, createdAt: now().toISOString(),
        });
        throw new ServiceError('Your role cannot export order summaries.', { code: 'FORBIDDEN', status: 403 });
      }
      if (!Object.values(ORDER_COPY_TYPES).includes(copyType)) {
        appendAuditEvent({
          id: makeId('audit'), eventType: 'order_summary_pdf_failed', action: 'order_summary.pdf_generated', outcome: 'failed',
          entityType: 'order', entityId: order.id, companyId: order.companyId, companyName: order.company, reference: order.reference,
          actorId: account.id, actorDisplayName: account.contact, actorRole: account.role, reason: 'Invalid PDF copy type',
          details: { copyType }, createdAt: now().toISOString(),
        });
        throw new ServiceError('Choose a recognised PDF copy type.', { code: 'INVALID_COPY_TYPE', status: 422 });
      }
      const generatedAt = now().toISOString();
      const documentId = makeId('order-summary');
      const model = buildOrderSummaryModel({
        order,
        copyType,
        generatedAt,
        generatedBy: account.contact || account.email,
      });
      const bytesBase64 = await generateOrderSummaryPdf(model);
      const fileName = `${order.reference}-${copyType === ORDER_COPY_TYPES.INTERNAL ? 'internal-operational' : 'customer-copy'}.pdf`;
      const metadata = {
        id: documentId,
        orderId,
        orderReference: order.reference,
        companyId: order.companyId,
        copyType,
        classification: model.classification,
        fileName,
        mimeType: 'application/pdf',
        sizeBytes: Math.ceil(bytesBase64.length * 0.75),
        generatedAt,
        generatedBy: { id: account.id, displayName: account.contact, role: account.role },
      };
      writeOrderDocuments([...readOrderDocuments(), metadata]);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'order_summary_pdf_generated',
        action: 'order_summary.pdf_generated',
        outcome: 'success',
        entityType: 'order',
        entityId: order.id,
        companyId: order.companyId,
        companyName: order.company,
        reference: order.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: [],
        documentMetadata: [metadata],
        details: { copyType, classification: model.classification },
        createdAt: generatedAt,
      });
      return clone({ ...metadata, bytesBase64 });
    },

    async email(orderId, input = {}) {
      const account = requireAccount();
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      if (!accountCan(account, PERMISSIONS.EMAIL_ORDER_SUMMARY)) {
        appendAuditEvent({
          id: makeId('audit'), eventType: 'order_summary_email_denied', action: 'order_summary.email_sent', outcome: 'denied',
          entityType: 'order', entityId: order.id, companyId: order.companyId, companyName: order.company, reference: order.reference,
          actorId: account.id, actorDisplayName: account.contact, actorRole: account.role, reason: 'Missing email_order_summary permission',
          details: { documentId: input.documentId || '', recipientType: input.recipientType || '' }, createdAt: now().toISOString(),
        });
        throw new ServiceError('Your role cannot email order summaries.', { code: 'FORBIDDEN', status: 403 });
      }
      const document = readOrderDocuments().find(item => item.id === input.documentId && item.orderId === orderId);
      if (!document) {
        appendAuditEvent({
          id: makeId('audit'), eventType: 'order_summary_email_failed', action: 'order_summary.email_sent', outcome: 'failed',
          entityType: 'order', entityId: order.id, companyId: order.companyId, companyName: order.company, reference: order.reference,
          actorId: account.id, actorDisplayName: account.contact, actorRole: account.role, reason: 'Generated document not found',
          details: { documentId: input.documentId || '', recipientType: input.recipientType || '' }, createdAt: now().toISOString(),
        });
        throw new ServiceError('Generate a fresh PDF before emailing it.', { code: 'ORDER_DOCUMENT_NOT_FOUND', status: 404 });
      }
      const options = await orderDocuments.getSharingOptions(orderId);
      let recipient;
      try {
        recipient = validateOrderEmailRequest(input, options);
      } catch (error) {
        appendAuditEvent({
          id: makeId('audit'), eventType: 'order_summary_email_denied', action: 'order_summary.email_sent', outcome: 'denied',
          entityType: 'order', entityId: order.id, companyId: order.companyId, companyName: order.company, reference: order.reference,
          actorId: account.id, actorDisplayName: account.contact, actorRole: account.role, reason: error.message,
          documentMetadata: [document],
          details: { recipientType: input.recipientType || '', recipientEmail: String(input.recipientEmail || '').trim().toLowerCase(), confirmedExternal: input.confirmedExternal === true },
          createdAt: now().toISOString(),
        });
        throw new ServiceError(error.message, { code: 'INVALID_EMAIL_RECIPIENT', status: 422, fieldErrors: { recipientEmail: error.message } });
      }
      if (document.copyType === ORDER_COPY_TYPES.INTERNAL && recipient.external) {
        appendAuditEvent({
          id: makeId('audit'), eventType: 'order_summary_email_denied', action: 'order_summary.email_sent', outcome: 'denied',
          entityType: 'order', entityId: order.id, companyId: order.companyId, companyName: order.company, reference: order.reference,
          actorId: account.id, actorDisplayName: account.contact, actorRole: account.role, reason: 'Internal copy cannot be sent externally',
          documentMetadata: [document],
          details: { recipientType: recipient.recipientType, recipientEmail: recipient.recipientEmail, external: true, confirmedExternal: true },
          createdAt: now().toISOString(),
        });
        throw new ServiceError('Internal operational copies cannot be sent to an external recipient. Generate a customer-safe copy instead.', { code: 'INTERNAL_COPY_EXTERNAL_RECIPIENT', status: 422 });
      }
      const sentAt = now().toISOString();
      const delivery = {
        id: makeId('order-summary-email'),
        channel: 'email',
        status: 'email_sent',
        simulated: true,
        recipientType: recipient.recipientType,
        recipientEmail: recipient.recipientEmail,
        external: recipient.external,
        documentId: document.id,
        sentAt,
      };
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'order_summary_email_sent',
        action: 'order_summary.email_sent',
        outcome: 'success',
        entityType: 'order',
        entityId: order.id,
        companyId: order.companyId,
        companyName: order.company,
        reference: order.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: [],
        notificationResults: [{ channel: 'email', status: 'email_sent', simulated: true }],
        documentMetadata: [document],
        details: {
          recipientType: recipient.recipientType,
          recipientEmail: recipient.recipientEmail,
          external: recipient.external,
          confirmedExternal: recipient.external ? input.confirmedExternal === true : false,
          simulated: true,
        },
        createdAt: sentAt,
      });
      return clone(delivery);
    },
  };

  const archive = {
    async getPolicy() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ARCHIVE_ORDERS) && !accountCan(account, PERMISSIONS.RESTORE_ARCHIVED_ORDERS)) {
        throw new ServiceError('Your role cannot access retention management.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone(readRetentionPolicy());
    },

    async savePolicy(candidate) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.MANAGE_RETENTION_POLICY)) {
        throw new ServiceError('Only an administrator may change the demonstration retention settings.', { code: 'FORBIDDEN', status: 403 });
      }
      const previous = readRetentionPolicy();
      const policy = normaliseRetentionPolicy(candidate);
      writeRetentionPolicy(policy);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'retention_policy_updated',
        action: 'retention.policy_updated',
        outcome: 'success',
        entityType: 'retention_policy',
        entityId: policy.id,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: Object.keys(policy).filter(key => policy[key] !== previous[key]),
        reason: 'Demonstration policy settings updated. Production approval remains outstanding.',
        createdAt: now().toISOString(),
      });
      refreshRetentionStates();
      return clone(policy);
    },

    async list(filters = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ARCHIVE_ORDERS) && !accountCan(account, PERMISSIONS.RESTORE_ARCHIVED_ORDERS)) {
        throw new ServiceError('Your role cannot access archived orders.', { code: 'FORBIDDEN', status: 403 });
      }
      const term = String(filters.search || '').trim().toLowerCase();
      const stateFilter = String(filters.state || 'all');
      const legalHoldFilter = String(filters.legalHold || 'all');
      const records = refreshRetentionStates()
        .filter(order => canReadRecord(account, order))
        .filter(order => ['archive_eligible', 'archived'].includes(order.retentionStatus))
        .filter(order => stateFilter === 'all' || order.retentionStatus === stateFilter)
        .filter(order => legalHoldFilter === 'all' || Boolean(order.legalHold?.active) === (legalHoldFilter === 'held'))
        .filter(order => !term || [
          order.reference, order.sourceRfqReference, order.internalJobNumber, order.customerPoNumber,
          order.poNumber, order.company, order.contact, order.selectedRep?.name, order.archiveReason,
          order.legalHold?.reason,
        ].some(value => String(value || '').toLowerCase().includes(term)));
      return clone(records.map(order => ({
        ...order,
        allowedArchiveActions: {
          archive: order.retentionStatus === 'archive_eligible' && accountCan(account, PERMISSIONS.ARCHIVE_ORDERS),
          approve: order.retentionStatus === 'archive_eligible'
            && !order.archiveApproval?.approved
            && accountCan(account, PERMISSIONS.APPROVE_ARCHIVAL),
          restore: order.retentionStatus === 'archived' && accountCan(account, PERMISSIONS.RESTORE_ARCHIVED_ORDERS),
          export: accountCan(account, PERMISSIONS.EXPORT_ARCHIVED_ORDERS),
          legalHold: accountCan(account, PERMISSIONS.MANAGE_LEGAL_HOLD),
          permanentDeletion: false,
        },
      })));
    },

    async approveArchival(orderId, { reason = '' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.APPROVE_ARCHIVAL)) {
        throw new ServiceError('Your role cannot approve archival actions.', { code: 'FORBIDDEN', status: 403 });
      }
      const order = refreshRetentionStates().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) {
        throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      }
      try {
        assertArchiveAllowed(order);
      } catch (error) {
        throw new ServiceError(error.message, { code: 'ORDER_NOT_ARCHIVE_ELIGIBLE', status: 409 });
      }
      const approvalReason = String(reason || '').trim();
      if (approvalReason.length < 5) {
        throw new ServiceError('Enter a clear archival approval reason.', {
          code: 'ARCHIVE_APPROVAL_REASON_REQUIRED',
          status: 422,
          fieldErrors: { reason: 'Enter at least 5 characters.' },
        });
      }
      const approvedAt = now().toISOString();
      const updated = saveOrder({
        ...order,
        archiveApproval: {
          approved: true,
          reason: approvalReason,
          approvedAt,
          approvedBy: { id: account.id, displayName: account.contact, role: account.role },
        },
        updatedAt: approvedAt,
      });
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'order_archival_approved',
        action: 'management.archival_approved',
        outcome: 'success',
        entityType: 'order',
        entityId: updated.id,
        companyId: updated.companyId,
        companyName: updated.company,
        reference: updated.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: ['archiveApproval'],
        reason: approvalReason,
        createdAt: approvedAt,
      });
      return clone(updated);
    },

    async archiveOrder(orderId, { reason = '' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ARCHIVE_ORDERS)) throw new ServiceError('Your role cannot archive orders.', { code: 'FORBIDDEN', status: 403 });
      const order = refreshRetentionStates().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      try {
        assertArchiveAllowed(order);
      } catch (error) {
        throw new ServiceError(error.message, { code: 'ORDER_NOT_ARCHIVE_ELIGIBLE', status: 409 });
      }
      if (!order.archiveApproval?.approved) {
        throw new ServiceError('A manager or administrator must approve this archival action first.', {
          code: 'ARCHIVAL_APPROVAL_REQUIRED',
          status: 409,
        });
      }
      const archivedAt = now().toISOString();
      const updated = saveOrder({
        ...order,
        retentionStatus: 'archived',
        archivedAt,
        archiveReason: String(reason || '').trim() || 'Archived under the demonstration retention policy.',
        archivedBy: { id: account.id, displayName: account.contact, role: account.role },
        retentionPolicyId: readRetentionPolicy().id,
        updatedAt: archivedAt,
      });
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'order_archived',
        action: 'retention.order_archived',
        outcome: 'success',
        entityType: 'order',
        entityId: updated.id,
        companyId: updated.companyId,
        companyName: updated.company,
        reference: updated.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: ['retentionStatus', 'archivedAt', 'archiveReason'],
        reason: updated.archiveReason,
        details: { retentionPolicyId: updated.retentionPolicyId },
        createdAt: archivedAt,
      });
      return clone(updated);
    },

    async restoreOrder(orderId, { reason = '' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.RESTORE_ARCHIVED_ORDERS)) throw new ServiceError('Your role cannot restore archived orders.', { code: 'FORBIDDEN', status: 403 });
      const order = refreshRetentionStates().find(item => item.id === orderId && item.retentionStatus === 'archived');
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The archived order was not found.', { code: 'ARCHIVED_ORDER_NOT_FOUND', status: 404 });
      const restoredAt = now().toISOString();
      const updated = saveOrder({
        ...order,
        retentionStatus: 'active',
        archivedAt: '',
        archiveReason: '',
        restoredAt,
        restoredBy: { id: account.id, displayName: account.contact, role: account.role },
        updatedAt: restoredAt,
      });
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'order_restored',
        action: 'retention.order_restored',
        outcome: 'success',
        entityType: 'order',
        entityId: updated.id,
        companyId: updated.companyId,
        companyName: updated.company,
        reference: updated.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: ['retentionStatus', 'archivedAt', 'restoredAt'],
        reason: String(reason || '').trim() || 'Restored to the completed-order history.',
        createdAt: restoredAt,
      });
      return clone(updated);
    },

    async setLegalHold(orderId, { active, reason = '' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.MANAGE_LEGAL_HOLD)) throw new ServiceError('Your role cannot manage legal holds.', { code: 'FORBIDDEN', status: 403 });
      const order = refreshRetentionStates().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      const holdReason = String(reason || '').trim();
      if (active === true && holdReason.length < 5) {
        throw new ServiceError('Enter a meaningful legal-hold or investigation reason.', { code: 'LEGAL_HOLD_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Enter at least 5 characters.' } });
      }
      const occurredAt = now().toISOString();
      const updated = saveOrder({
        ...order,
        legalHold: active === true
          ? { active: true, reason: holdReason, placedAt: occurredAt, placedBy: { id: account.id, displayName: account.contact, role: account.role } }
          : { active: false, reason: '', releasedAt: occurredAt, releasedBy: { id: account.id, displayName: account.contact, role: account.role } },
        updatedAt: occurredAt,
      });
      appendAuditEvent({
        id: makeId('audit'),
        eventType: active === true ? 'order_legal_hold_applied' : 'order_legal_hold_released',
        action: active === true ? 'retention.legal_hold_applied' : 'retention.legal_hold_released',
        outcome: 'success',
        entityType: 'order',
        entityId: updated.id,
        companyId: updated.companyId,
        companyName: updated.company,
        reference: updated.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: ['legalHold'],
        reason: active === true ? holdReason : (holdReason || 'Legal hold released.'),
        createdAt: occurredAt,
      });
      return clone(updated);
    },

    async exportBeforeDeletion(orderId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.EXPORT_ARCHIVED_ORDERS)) throw new ServiceError('Your role cannot export archived orders.', { code: 'FORBIDDEN', status: 403 });
      const order = refreshRetentionStates().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order) || !['archive_eligible', 'archived'].includes(order.retentionStatus)) {
        throw new ServiceError('The archive record was not found.', { code: 'ARCHIVED_ORDER_NOT_FOUND', status: 404 });
      }
      const generatedAt = now().toISOString();
      const model = buildOrderSummaryModel({
        order,
        copyType: ORDER_COPY_TYPES.INTERNAL,
        generatedAt,
        generatedBy: account.contact || account.email,
      });
      const bytesBase64 = await generateOrderSummaryPdf(model);
      const record = {
        id: makeId('retention-export'),
        orderId: order.id,
        orderReference: order.reference,
        companyId: order.companyId,
        fileName: `${order.reference}-retention-export.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: Math.ceil(bytesBase64.length * 0.75),
        classification: 'INTERNAL - RETENTION EXPORT',
        includesTimeline: true,
        includesAuditReference: true,
        generatedAt,
        generatedBy: { id: account.id, displayName: account.contact, role: account.role },
      };
      writeRetentionExports([...readRetentionExports(), record]);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'order_retention_exported',
        action: 'retention.export_created',
        outcome: 'success',
        entityType: 'order',
        entityId: order.id,
        companyId: order.companyId,
        companyName: order.company,
        reference: order.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        documentMetadata: [record],
        details: { requiredBeforePermanentDeletion: true },
        createdAt: generatedAt,
      });
      return clone({ ...record, bytesBase64 });
    },

    async requestPermanentDeletion() {
      requireAccount();
      throw new ServiceError('Permanent deletion is disabled in mock mode and must be performed by an approved backend workflow.', { code: 'BACKEND_DELETION_REQUIRED', status: 501 });
    },
  };

  const management = {
    async getDashboard(filters = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_REPORTS)) {
        throw new ServiceError('Your role cannot access management oversight.', { code: 'FORBIDDEN', status: 403 });
      }
      const records = readAllRecords().filter(record => canReadRecord(account, record));
      const auditEvents = readAuditEvents()
        .map(presentAuditEvent)
        .filter(event => {
          if (!event.company?.id) return true;
          return canReadRecord(account, {
            workflowType: event.entityType === 'order' ? 'order' : 'rfq',
            companyId: event.company.id,
          });
        });
      return clone(buildManagementDashboard({
        records,
        auditEvents,
        search: filters.search,
        status: filters.status,
        branch: filters.branch,
        now: now(),
      }));
    },

    async getRepresentativeOptions() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.REASSIGN_REPRESENTATIVE)) {
        throw new ServiceError('Your role cannot reassign representatives.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone(representatives.map(representative => ({
        ...representative,
        branchName: branches.find(branch => branch.id === representative.branchId)?.name || representative.branchId,
      })));
    },

    async reassignRepresentative(recordId, { representativeId, reason = '', expectedVersion } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.REASSIGN_REPRESENTATIVE)) {
        throw new ServiceError('Your role cannot reassign representatives.', { code: 'FORBIDDEN', status: 403 });
      }
      const state = readWorkflowState();
      const located = locateWorkflowRecord(state, recordId);
      if (!located || !canReadRecord(account, located.record)) {
        throw new ServiceError('The RFQ or order was not found.', { code: 'WORKFLOW_RECORD_NOT_FOUND', status: 404 });
      }
      if (Number(expectedVersion) !== Number(located.record.version)) {
        throw new ServiceError('This record changed while you were reviewing it. Refresh and try again.', {
          code: 'VERSION_CONFLICT',
          status: 409,
        });
      }
      if (['cancelled', 'expired', 'archived'].includes(located.record.trackingStatus)) {
        throw new ServiceError('Terminal or archived records cannot be reassigned.', { code: 'REASSIGNMENT_NOT_ALLOWED', status: 409 });
      }
      const representative = representativeById(String(representativeId || ''));
      if (!representative) {
        throw new ServiceError('Select an authorised Rhomberg representative.', {
          code: 'INVALID_REPRESENTATIVE',
          status: 422,
          fieldErrors: { representativeId: 'Select an authorised representative.' },
        });
      }
      const reassignmentReason = String(reason || '').trim();
      if (reassignmentReason.length < 5) {
        throw new ServiceError('Enter a clear reassignment reason.', {
          code: 'REASSIGNMENT_REASON_REQUIRED',
          status: 422,
          fieldErrors: { reason: 'Enter at least 5 characters.' },
        });
      }
      const previousRepresentative = located.record.selectedRep || null;
      const updatedAt = now().toISOString();
      const updated = normaliseEnquiry({
        ...located.record,
        selectedRep: {
          ...representative,
          branchName: branches.find(branch => branch.id === representative.branchId)?.name || representative.branchId,
        },
        representativeId: representative.id,
        version: Number(located.record.version) + 1,
        updatedAt,
      });
      located.collection[located.index] = updated;
      writeWorkflowState(state);
      const assignments = readCustomerRepresentativeAssignments();
      assignments[updated.companyId] = {
        companyId: updated.companyId,
        representativeId: representative.id,
        assignedAt: updatedAt,
        assignedBy: account.id,
        reason: reassignmentReason,
      };
      writeCustomerRepresentativeAssignments(assignments);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'representative_reassigned',
        action: 'management.representative_reassigned',
        outcome: 'success',
        entityType: located.entityType,
        entityId: updated.id,
        companyId: updated.companyId,
        companyName: updated.company,
        reference: updated.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: ['selectedRep', 'representativeId', 'companyRepresentativeAssignment'],
        reason: reassignmentReason,
        details: {
          previousRepresentativeId: previousRepresentative?.id || '',
          newRepresentativeId: representative.id,
        },
        createdAt: updatedAt,
      });
      return clone(presentRecord(account, updated));
    },

    async approveWorkflowOverride(recordId, {
      targetStatus,
      reason = '',
      entityType = '',
      expectedVersion,
    } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.APPROVE_WORKFLOW_OVERRIDE)) {
        throw new ServiceError('Your role cannot approve workflow overrides.', { code: 'FORBIDDEN', status: 403 });
      }
      const overrideReason = String(reason || '').trim();
      if (overrideReason.length < 10) {
        throw new ServiceError('Explain the controlled override in at least 10 characters.', {
          code: 'OVERRIDE_REASON_REQUIRED',
          status: 422,
          fieldErrors: { reason: 'Enter at least 10 characters.' },
        });
      }
      const updated = await workflow.performAction(recordId, {
        action: 'override_workflow',
        comment: overrideReason,
        data: { targetStatus, overrideReason },
        entityType,
        expectedVersion,
      });
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'workflow_override_approved',
        action: 'management.workflow_override_approved',
        outcome: 'success',
        entityType: updated.workflowType,
        entityId: updated.id,
        companyId: updated.companyId,
        companyName: updated.company,
        reference: updated.reference,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: ['trackingStatus'],
        reason: overrideReason,
        isOverride: true,
        overrideReason,
        createdAt: now().toISOString(),
      });
      return updated;
    },

    async exportOperationalReport(filters = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.EXPORT_OPERATIONAL_REPORTS)) {
        throw new ServiceError('Your role cannot export operational reports.', { code: 'FORBIDDEN', status: 403 });
      }
      const dashboard = await this.getDashboard(filters);
      const generatedAt = now().toISOString();
      const report = {
        id: makeId('management-report'),
        fileName: `rhomberg-operational-report-${generatedAt.slice(0, 10)}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        classification: 'INTERNAL OPERATIONAL REPORT',
        generatedAt,
        generatedBy: { id: account.id, displayName: account.contact, role: account.role },
        rowCount: dashboard.records.length,
        csv: createOperationalReportCsv(dashboard),
      };
      writeManagementExports([...readManagementExports(), report]);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'operational_report_exported',
        action: 'management.operational_report_exported',
        outcome: 'success',
        entityType: 'management_report',
        entityId: report.id,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: [],
        reason: `Exported ${report.rowCount} authorised records.`,
        documentMetadata: [{
          id: report.id,
          fileName: report.fileName,
          mimeType: report.mimeType,
          classification: report.classification,
        }],
        createdAt: generatedAt,
      });
      return clone(report);
    },
  };

  const audit = {
    async list({ entityId = '', entityType = '', outcome = '', search = '' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY)) throw new ServiceError('Your role cannot view audit history.', { code: 'FORBIDDEN', status: 403 });
      const term = String(search || '').trim().toLowerCase();
      return clone(readAuditEvents()
        .map(presentAuditEvent)
        .filter(event => {
          const companyId = event.company?.id || event.companyId || '';
          if (!companyId) return true;
          return canReadRecord(account, {
            workflowType: event.entityType === 'order' ? 'order' : 'rfq',
            companyId,
          });
        })
        .filter(event => !entityId || event.entityId === entityId)
        .filter(event => !entityType || event.entityType === entityType)
        .filter(event => !outcome || event.outcome === outcome)
        .filter(event => !term || [
          event.eventType,
          event.action,
          event.reference,
          event.company?.name,
          event.actingUser?.displayName,
          event.requestId,
          event.correlationId,
        ].some(value => String(value || '').toLowerCase().includes(term)))
        .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp)));
    },
  };

  const notifications = {
    async list(filters = {}) {
      const account = requireAccount();
      const preferences = notificationPreferencesForAccount(account);
      const items = readNotifications()
        .filter(item => notificationMatchesAccount(account, item))
        .filter(item => notificationMatchesPreferences(item, preferences))
        .map(item => presentNotification(account, item, preferences))
        .filter(item => !filters.unreadOnly || !item.readAt)
        .filter(item => !filters.entityType || item.entityType === filters.entityType)
        .filter(item => !filters.eventType || item.eventType === filters.eventType)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      return clone(items);
    },

    async markRead(notificationId) {
      const account = requireAccount();
      const items = readNotifications();
      const index = items.findIndex(item => item.id === notificationId && notificationMatchesAccount(account, item));
      if (index < 0) throw new ServiceError('The notification could not be found.', { code: 'NOTIFICATION_NOT_FOUND', status: 404 });
      const readAt = now().toISOString();
      items[index] = {
        ...items[index],
        readBy: [...new Set([...(items[index].readBy || []), account.id])],
        readAtBy: { ...(items[index].readAtBy || {}), [account.id]: readAt },
      };
      writeNotifications(items);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'notification.read',
        outcome: 'success',
        entityType: items[index].entityType,
        entityId: items[index].entityId,
        companyId: items[index].companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { notificationId },
        createdAt: readAt,
      });
      return clone(presentNotification(account, items[index]));
    },

    async markAllRead() {
      const account = requireAccount();
      const readAt = now().toISOString();
      const items = readNotifications();
      let updatedCount = 0;
      const updated = items.map(item => {
        if (!notificationMatchesAccount(account, item) || (item.readBy || []).includes(account.id)) return item;
        updatedCount += 1;
        return {
          ...item,
          readBy: [...new Set([...(item.readBy || []), account.id])],
          readAtBy: { ...(item.readAtBy || {}), [account.id]: readAt },
        };
      });
      writeNotifications(updated);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'notification.read_all',
        outcome: 'success',
        entityType: 'notification_inbox',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { updatedCount },
        createdAt: readAt,
      });
      return clone({ updatedCount, readAt });
    },

    async getPreferences() {
      return clone(notificationPreferencesForAccount(requireAccount()));
    },

    async savePreferences(candidate) {
      const account = requireAccount();
      const saved = {
        ...validateNotificationPreferenceSettings(candidate),
        updatedAt: now().toISOString(),
      };
      const records = readNotificationPreferenceRecords();
      records[account.id] = saved;
      writeNotificationPreferenceRecords(records);
      if (account.role === USER_ROLES.CUSTOMER) {
        const personalisationRecords = readPersonalisation();
        const current = normaliseCustomerPersonalisation(personalisationRecords[account.id]);
        personalisationRecords[account.id] = {
          ...current,
          notificationPreferences: { ...saved.categories },
          updatedAt: saved.updatedAt,
        };
        writePersonalisation(personalisationRecords);
      }
      appendAuditEvent({
        id: makeId('audit'),
        action: 'notification.preferences_updated',
        outcome: 'success',
        entityType: 'user_preference',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: {
          emailSimulation: saved.channels.email,
          pushSimulation: saved.channels.push,
          enabledCategories: Object.entries(saved.categories).filter(([, enabled]) => enabled).map(([category]) => category),
        },
        createdAt: saved.updatedAt,
      });
      return clone(saved);
    },

    async retryDelivery(notificationId, deliveryId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.RETRY_NOTIFICATION_DELIVERY)) {
        throw new ServiceError('Your role cannot retry notification delivery.', { code: 'FORBIDDEN', status: 403 });
      }
      const items = readNotifications();
      const notificationIndex = items.findIndex(item => item.id === notificationId && notificationMatchesAccount(account, item));
      if (notificationIndex < 0) throw new ServiceError('The notification could not be found.', { code: 'NOTIFICATION_NOT_FOUND', status: 404 });
      const deliveryIndex = (items[notificationIndex].deliveries || []).findIndex(delivery => delivery.id === deliveryId);
      if (deliveryIndex < 0) throw new ServiceError('The delivery attempt could not be found.', { code: 'NOTIFICATION_DELIVERY_NOT_FOUND', status: 404 });
      const existingDelivery = items[notificationIndex].deliveries[deliveryIndex];
      if (!existingDelivery.retryable) {
        throw new ServiceError('Only a failed simulated delivery can be retried.', { code: 'NOTIFICATION_DELIVERY_NOT_RETRYABLE', status: 409 });
      }
      const retriedAt = now().toISOString();
      const retried = retryMockDelivery(existingDelivery, retriedAt);
      items[notificationIndex] = {
        ...items[notificationIndex],
        deliveries: items[notificationIndex].deliveries.map((delivery, index) => index === deliveryIndex ? retried : delivery),
      };
      writeNotifications(items);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'notification.delivery_retry_requested',
        outcome: retried.status.endsWith('_sent') ? 'success' : 'failed',
        entityType: items[notificationIndex].entityType,
        entityId: items[notificationIndex].entityId,
        companyId: items[notificationIndex].companyId,
        actorId: account.id,
        actorRole: account.role,
        details: {
          notificationId,
          deliveryId,
          channel: retried.channel,
          attemptCount: retried.attemptCount,
          status: retried.status,
        },
        createdAt: retriedAt,
      });
      return clone(retried);
    },
  };

  const planning = {
    async getWorkspaceOptions() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ADD_PLANNING_INFORMATION)) {
        throw new ServiceError('Your account cannot access Planning reference data.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone({
        users: planningUsers(),
        locations: branches.map(branch => ({ id: branch.id, name: branch.name, role: branch.role })),
        priorities: PLANNING_PRIORITIES,
      });
    },
  };

  const expediting = {
    async getWorkspaceOptions() {
      const account = requireAccount();
      if (
        !accountCan(account, PERMISSIONS.VIEW_EXPEDITING_QUEUE)
        && !accountCan(account, PERMISSIONS.UPDATE_ORDER_PROGRESS)
        && !accountCan(account, PERMISSIONS.MOVE_TO_DISPATCH)
      ) {
        throw new ServiceError('Your account cannot access Expediting reference data.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone({
        progressSteps: EXPEDITOR_PROGRESS_STEPS,
        requiredStepIds: REQUIRED_EXPEDITOR_STEP_IDS,
        documentTypes: EXPEDITOR_DOCUMENT_TYPES,
        approachingCompletionDays: 3,
      });
    },
  };

  const dispatch = {
    async getWorkspaceOptions() {
      const account = requireAccount();
      if (
        !accountCan(account, PERMISSIONS.VIEW_DISPATCH_QUEUE)
        && !accountCan(account, PERMISSIONS.CONFIRM_DELIVERY)
        && !accountCan(account, PERMISSIONS.CONFIRM_COLLECTION)
      ) {
        throw new ServiceError('Your account cannot access Dispatch reference data.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone({
        methods: DISPATCH_METHODS,
        proofTypes: DISPATCH_PROOF_TYPES,
        maxProofBytes: MAX_DISPATCH_PROOF_BYTES,
      });
    },
  };

  const laboratory = {
    async getWorkspaceOptions() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_LAB_QUEUE)) {
        throw new ServiceError('Your account cannot access the Laboratory workspace.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone({
        certificationTypes: [
          { id: 'sanas', label: 'SANAS calibration' },
          { id: 'traceable', label: 'Traceable calibration' },
        ],
        maxCertificateBytes: MAX_CERTIFICATE_BYTES,
        certificateMimeTypes: ['application/pdf'],
        releaseDestinations: [
          { id: 'expediting', label: 'Expediting' },
          { id: 'dispatch', label: 'Dispatch' },
        ],
      });
    },

    async listOrders() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_LAB_QUEUE)) {
        throw new ServiceError('Your account cannot access the Laboratory queue.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone(readAllOrders()
        .filter(order => orderRequiresLaboratory(order) && canReadRecord(account, order))
        .map(order => ({ ...order, allowedWorkflowActions: getAllowedWorkflowActions(order, createWorkflowActor(account)) })));
    },

    async getDashboard() {
      const orders = await laboratory.listOrders();
      return clone({
        metrics: laboratoryMetrics(orders),
        orders,
        certificateQueue: certificateQueueForOrders(orders),
      });
    },

    async updateUnit(orderId, unitId, action, input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.UPDATE_LAB_WORK)) {
        throw new ServiceError('Your account cannot update Laboratory units.', { code: 'FORBIDDEN', status: 403 });
      }
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order) || !orderRequiresLaboratory(order)) {
        throw new ServiceError('The Laboratory order was not found.', { code: 'LAB_ORDER_NOT_FOUND', status: 404 });
      }
      if (!['calibration_in_progress', 'calibration_on_hold'].includes(order.trackingStatus)) {
        throw new ServiceError('Start Laboratory calibration before updating physical units.', { code: 'LAB_ORDER_NOT_ACTIVE', status: 409 });
      }
      const prepared = ensureLaboratoryRecord(order);
      const index = prepared.laboratory.units.findIndex(unit => unit.id === unitId);
      if (index < 0) throw new ServiceError('The physical unit task was not found.', { code: 'LAB_UNIT_NOT_FOUND', status: 404 });
      const allowed = {
        start: ['awaiting_lab', 'received'],
        hold: ['calibration_in_progress'],
        resume: ['calibration_on_hold'],
        complete: ['calibration_in_progress'],
      };
      if (!allowed[action]?.includes(prepared.laboratory.units[index].status)) {
        throw new ServiceError('That unit action is not available at its current stage.', { code: 'LAB_UNIT_TRANSITION_INVALID', status: 409 });
      }
      const details = validateLaboratoryUnitUpdate(input, { requireResult: action === 'complete' });
      const occurredAt = now().toISOString();
      const statusByAction = {
        start: 'calibration_in_progress',
        hold: 'calibration_on_hold',
        resume: 'calibration_in_progress',
        complete: 'calibration_completed',
      };
      const previous = prepared.laboratory.units[index];
      const unit = {
        ...previous,
        ...details,
        customerVisibleMessage: details.customerMessage || previous.customerVisibleMessage,
        status: statusByAction[action],
        certificateStatus: action === 'complete' ? 'pending' : previous.certificateStatus,
        startedAt: action === 'start' ? occurredAt : previous.startedAt,
        completedAt: action === 'complete' ? occurredAt : previous.completedAt,
        updatedAt: occurredAt,
        updatedBy: actorSnapshot(account),
      };
      const units = [...prepared.laboratory.units];
      units[index] = unit;
      const updated = saveOrder({
        ...prepared,
        version: Number(prepared.version || 0) + 1,
        updatedAt: occurredAt,
        laboratory: {
          ...prepared.laboratory,
          units,
          lastUpdatedAt: occurredAt,
        },
      });
      appendAuditEvent({
        id: makeId('audit'),
        action: `laboratory.unit_${action}`,
        outcome: 'success',
        entityType: 'laboratory_unit',
        entityId: unit.id,
        companyId: updated.companyId,
        reference: updated.reference,
        actorId: account.id,
        actorRole: account.role,
        fieldsChanged: ['laboratory.units'],
        details: { orderId, unitNumber: unit.unitNumber, certificationType: unit.certificationType },
        immutable: true,
        createdAt: occurredAt,
      });
      publishWorkflowNotifications({
        action: 'laboratory_progress_updated',
        record: updated,
        actor: createWorkflowActor(account),
        input: { customerMessage: unit.customerVisibleMessage || 'Laboratory progress was updated.' },
      });
      return clone(unit);
    },

    async uploadCertificate(orderId, unitId, input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.MANAGE_CERTIFICATES)) {
        throw new ServiceError('Your account cannot upload certificates.', { code: 'FORBIDDEN', status: 403 });
      }
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order) || !orderRequiresLaboratory(order)) {
        throw new ServiceError('The Laboratory order was not found.', { code: 'LAB_ORDER_NOT_FOUND', status: 404 });
      }
      const prepared = ensureLaboratoryRecord(order);
      const index = prepared.laboratory.units.findIndex(unit => unit.id === unitId);
      if (index < 0) throw new ServiceError('The physical unit task was not found.', { code: 'LAB_UNIT_NOT_FOUND', status: 404 });
      const unit = prepared.laboratory.units[index];
      if (
        !unit.completedAt
        && !['calibration_completed', 'certificate_uploaded', 'released'].includes(unit.status)
      ) {
        throw new ServiceError('Complete this physical unit before uploading its certificate.', { code: 'LAB_UNIT_NOT_COMPLETE', status: 409 });
      }
      if (unit.certificateId) {
        throw new ServiceError('This physical unit already has its required certificate.', {
          code: 'DUPLICATE_UNIT_CERTIFICATE',
          status: 409,
          fieldErrors: { certificateFile: 'Each physical unit accepts one final certificate in this phase.' },
        });
      }
      const existingCertificates = certificateQueueForOrders(readAllOrders())
        .filter(item => item.certificateId)
        .map(item => ({ id: item.certificateId, certificateNumber: item.certificateNumber }));
      const certificate = validateCertificateUpload(input, existingCertificates);
      const occurredAt = now().toISOString();
      const certificateId = makeId('certificate');
      const dataUrl = await fileToDataUrl(input.file);
      const files = readCertificateFiles();
      files[certificateId] = {
        id: certificateId,
        orderId,
        unitId,
        companyId: order.companyId,
        dataUrl,
        createdAt: occurredAt,
      };
      writeCertificateFiles(files);
      const units = [...prepared.laboratory.units];
      units[index] = {
        ...unit,
        status: unit.movementStatus === 'released' || unit.status === 'released'
          ? 'released'
          : 'certificate_uploaded',
        certificateStatus: 'uploaded',
        certificateId,
        certificateNumber: certificate.certificateNumber,
        certificate: {
          id: certificateId,
          ...certificate,
          certificationType: unit.certificationType,
          unitId,
          orderId,
          companyId: order.companyId,
          uploadedAt: occurredAt,
          uploadedBy: actorSnapshot(account),
          storageStatus: 'browser_mock',
          customerVisible: true,
        },
        certificateUploadedAt: occurredAt,
        updatedAt: occurredAt,
      };
      const updated = saveOrder({
        ...prepared,
        version: Number(prepared.version || 0) + 1,
        updatedAt: occurredAt,
        laboratory: { ...prepared.laboratory, units, lastUpdatedAt: occurredAt },
      });
      appendAuditEvent({
        id: makeId('audit'),
        action: 'laboratory.certificate_uploaded',
        outcome: 'success',
        entityType: 'certificate',
        entityId: certificateId,
        companyId: updated.companyId,
        reference: updated.reference,
        actorId: account.id,
        actorRole: account.role,
        fieldsChanged: ['laboratory.units.certificate'],
        documentMetadata: [{ id: certificateId, fileName: certificate.fileName, mimeType: certificate.mimeType, sizeBytes: certificate.sizeBytes }],
        immutable: true,
        createdAt: occurredAt,
      });
      publishWorkflowNotifications({
        action: 'certificate_uploaded',
        record: updated,
        actor: createWorkflowActor(account),
        input: {
          customerMessage: `Certificate ${certificate.certificateNumber} is ready for ${unit.productCode} unit ${unit.unitNumber}.`,
        },
      });
      return clone(units[index].certificate);
    },

    async downloadCertificate(certificateId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.DOWNLOAD_CERTIFICATES)) {
        throw new ServiceError('Your account cannot download calibration certificates.', { code: 'FORBIDDEN', status: 403 });
      }
      const order = readAllOrders().find(item => (
        (item.laboratory?.units || []).some(unit => unit.certificateId === certificateId)
        && canReadRecord(account, item)
      ));
      const unit = order?.laboratory?.units?.find(item => item.certificateId === certificateId);
      const file = readCertificateFiles()[certificateId];
      if (!order || !unit?.certificate || !file) {
        throw new ServiceError('The certificate was not found for your authorised records.', { code: 'CERTIFICATE_NOT_FOUND', status: 404 });
      }
      appendAuditEvent({
        id: makeId('audit'),
        action: 'laboratory.certificate_downloaded',
        outcome: 'success',
        entityType: 'certificate',
        entityId: certificateId,
        companyId: order.companyId,
        reference: order.reference,
        actorId: account.id,
        actorRole: account.role,
        immutable: true,
        createdAt: now().toISOString(),
      });
      return clone({ ...unit.certificate, dataUrl: file.dataUrl });
    },

    async archiveCertificates(orderId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.RELEASE_LAB_ORDER)) {
        throw new ServiceError('Only authorised managers can archive Laboratory certificates.', { code: 'FORBIDDEN', status: 403 });
      }
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      if (order.legalHold?.active || order.investigationFlag === true) {
        throw new ServiceError('This Laboratory task is protected by a legal hold or investigation flag.', {
          code: 'CERTIFICATE_ARCHIVE_LEGAL_HOLD',
          status: 409,
        });
      }
      const occurredAt = now().toISOString();
      const prepared = ensureLaboratoryRecord(order);
      if (!prepared.laboratory?.releasedAt || !prepared.laboratory.units.every(unit => (
        unit.completedAt && (unit.releasedAt || unit.movementStatus === 'released' || unit.status === 'released')
      ))) {
        throw new ServiceError('Complete and physically release every Laboratory unit before archiving the task.', {
          code: 'CERTIFICATE_ARCHIVE_UNIT_ACTIVE',
          status: 409,
        });
      }
      if (!allRequiredCertificatesPresent(prepared)) {
        throw new ServiceError('Upload one certificate PDF for every required physical unit before archiving.', {
          code: 'CERTIFICATE_ARCHIVE_PENDING',
          status: 409,
        });
      }
      const updated = saveOrder({
        ...prepared,
        version: Number(prepared.version || 0) + 1,
        updatedAt: occurredAt,
        laboratory: {
          ...prepared.laboratory,
          status: 'lab_archived',
          archivedAt: occurredAt,
          archivedBy: actorSnapshot(account),
          units: prepared.laboratory.units.map(unit => ({
            ...unit,
            certificateStatus: unit.certificateId ? 'archived' : unit.certificateStatus,
            archivedAt: occurredAt,
            certificate: unit.certificate ? { ...unit.certificate, archivedAt: occurredAt } : unit.certificate,
          })),
        },
      });
      appendAuditEvent({
        id: makeId('audit'),
        action: 'laboratory.certificates_archived',
        outcome: 'success',
        entityType: 'order',
        entityId: orderId,
        companyId: order.companyId,
        actorId: account.id,
        actorRole: account.role,
        immutable: true,
        createdAt: occurredAt,
      });
      return clone(updated.laboratory.units);
    },
  };

  const qualityAssurance = {
    async getWorkspaceOptions() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_QA_QUEUE)) {
        throw new ServiceError('Your account cannot access the Quality Assurance workspace.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone({
        problemCategories: QA_PROBLEM_CATEGORIES,
        severities: QA_SEVERITIES,
        reworkDestinations: QA_REWORK_DESTINATIONS,
      });
    },

    async listOrders() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_QA_QUEUE)) {
        throw new ServiceError('Your account cannot access the Quality Assurance queue.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone(readAllOrders()
        .filter(order => orderRequiresQualityAssurance(order) && canReadRecord(account, order))
        .map(order => ({ ...order, allowedWorkflowActions: getAllowedWorkflowActions(order, createWorkflowActor(account)) })));
    },

    async getDashboard() {
      const orders = await qualityAssurance.listOrders();
      return clone({ metrics: qualityMetrics(orders), orders });
    },
  };

  const personalisation = {
    async get() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE)) {
        throw new ServiceError('Customer personalisation is available only in Rhomberg Connect.', { code: 'FORBIDDEN', status: 403 });
      }
      const records = readPersonalisation();
      return clone(presentPersonalisation(records[account.id] || createDefaultCustomerPersonalisation()));
    },

    async save(candidate) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE)) {
        throw new ServiceError('Customer personalisation is available only in Rhomberg Connect.', { code: 'FORBIDDEN', status: 403 });
      }
      const normalised = normaliseCustomerPersonalisation(candidate);
      validatePersonalisation(normalised);
      const stripPreview = image => image ? (({ previewUrl: _previewUrl, ...metadata }) => metadata)(image) : null;
      const saved = {
        ...normalised,
        profileImage: stripPreview(normalised.profileImage),
        companyLogo: stripPreview(normalised.companyLogo),
        updatedAt: now().toISOString(),
      };
      const records = readPersonalisation();
      const previous = normaliseCustomerPersonalisation(records[account.id]);
      records[account.id] = saved;
      writePersonalisation(records);
      const notificationPreferenceRecords = readNotificationPreferenceRecords();
      notificationPreferenceRecords[account.id] = {
        ...normaliseNotificationPreferences(notificationPreferenceRecords[account.id] || createDefaultNotificationPreferences()),
        categories: { ...saved.notificationPreferences },
        updatedAt: saved.updatedAt,
      };
      writeNotificationPreferenceRecords(notificationPreferenceRecords);
      const retainedImageIds = new Set([saved.profileImage?.id, saved.companyLogo?.id].filter(Boolean));
      const removedImageIds = [previous.profileImage?.id, previous.companyLogo?.id]
        .filter((id, index, values) => id && values.indexOf(id) === index && !retainedImageIds.has(id));
      if (removedImageIds.length) {
        const images = readMockImages();
        for (const imageId of removedImageIds) {
          if (images[imageId]?.ownerAccountId === account.id && images[imageId]?.companyId === account.companyId) {
            delete images[imageId];
          }
        }
        writeMockImages(images);
      }
      appendAuditEvent({
        id: makeId('audit'),
        action: 'customer.personalisation_saved',
        outcome: 'success',
        entityType: 'user_preference',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        createdAt: saved.updatedAt,
      });
      for (const imageId of removedImageIds) {
        appendAuditEvent({
          id: makeId('audit'),
          action: 'customer.personalisation_image_removed',
          outcome: 'success',
          entityType: 'user_preference',
          entityId: account.id,
          companyId: account.companyId,
          actorId: account.id,
          actorRole: account.role,
          details: { imageId, reason: 'preference_replaced' },
          createdAt: saved.updatedAt,
        });
      }
      return clone(presentPersonalisation(saved));
    },

    async complete(candidate) {
      return this.save({ ...candidate, setupCompleted: true });
    },

    async reset({ reopenSetup = false } = {}) {
      const account = requireAccount();
      const current = createDefaultCustomerPersonalisation();
      const saved = await this.save({ ...current, setupCompleted: !reopenSetup });
      appendAuditEvent({
        id: makeId('audit'),
        action: 'customer.personalisation_reset',
        outcome: 'success',
        entityType: 'user_preference',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { reopenSetup: Boolean(reopenSetup) },
        createdAt: now().toISOString(),
      });
      return saved;
    },

    async uploadImage(file, kind, position = { x: 50, y: 50 }) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE)) {
        throw new ServiceError('Customer image upload is available only in Rhomberg Connect.', { code: 'FORBIDDEN', status: 403 });
      }
      if (!['profileImage', 'companyLogo'].includes(kind)) {
        throw new ServiceError('Choose a profile image or company logo.', { code: 'INVALID_IMAGE_KIND', status: 422, fieldErrors: { image: 'Choose a supported image type.' } });
      }
      validatePersonalisationImage(file);
      const id = makeId('customer-image');
      const uploadedAt = now().toISOString();
      const dataUrl = await fileToDataUrl(file);
      const images = readMockImages();
      images[id] = {
        id,
        ownerAccountId: account.id,
        companyId: account.companyId,
        dataUrl,
        createdAt: uploadedAt,
      };
      writeMockImages(images);
      const metadata = {
        id,
        kind,
        fileName: String(file.name || 'customer-image'),
        mimeType: String(file.type || ''),
        sizeBytes: Number(file.size || 0),
        position: {
          x: Math.min(100, Math.max(0, Number(position?.x) || 50)),
          y: Math.min(100, Math.max(0, Number(position?.y) || 50)),
        },
        storageStatus: 'browser_mock',
        uploadedAt,
        previewUrl: dataUrl,
      };
      appendAuditEvent({
        id: makeId('audit'),
        action: 'customer.personalisation_image_uploaded',
        outcome: 'success',
        entityType: 'user_preference',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { kind, imageId: id, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes },
        createdAt: uploadedAt,
      });
      return clone(metadata);
    },

    async removeImage(imageId) {
      const account = requireAccount();
      const images = readMockImages();
      const image = images[imageId];
      if (!image || image.ownerAccountId !== account.id || image.companyId !== account.companyId) {
        throw new ServiceError('The image was not found for this customer account.', { code: 'IMAGE_NOT_FOUND', status: 404 });
      }
      delete images[imageId];
      writeMockImages(images);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'customer.personalisation_image_removed',
        outcome: 'success',
        entityType: 'user_preference',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { imageId },
        createdAt: now().toISOString(),
      });
      return { removed: true };
    },
  };

  const requireAdministrator = () => {
    const account = requireAccount();
    if (!accountCan(account, PERMISSIONS.ADMINISTER_USERS)) {
      throw new ServiceError('Administrator access is required.', { code: 'FORBIDDEN', status: 403 });
    }
    return account;
  };

  const buildAdministrationOverview = () => {
    const accountRecords = readAccounts();
    const workflowRecords = readWorkflowState();
    const notificationRecords = readNotifications();
    const documentRecords = readOrderDocuments();
    const assignments = readCustomerRepresentativeAssignments();
    const companyMap = new Map();
    for (const account of accountRecords.filter(item => item.role === USER_ROLES.CUSTOMER)) {
      if (!companyMap.has(account.companyId)) {
        companyMap.set(account.companyId, {
          id: account.companyId,
          name: account.company,
          area: account.area,
          industry: account.industry,
          contacts: 0,
          representativeId: assignments[account.companyId]?.representativeId || '',
        });
      }
      companyMap.get(account.companyId).contacts += 1;
    }
    const notificationDeliveryStatus = notificationRecords.reduce((counts, notification) => {
      for (const delivery of notification.deliveries || []) {
        counts[delivery.status] = (counts[delivery.status] || 0) + 1;
      }
      return counts;
    }, {});
    return {
      generatedAt: now().toISOString(),
      summary: {
        users: accountRecords.length,
        customerCompanies: companyMap.size,
        internalAccounts: accountRecords.filter(item => item.role !== USER_ROLES.CUSTOMER).length,
        rfqs: workflowRecords.enquiries.length,
        orders: workflowRecords.orders.length,
        auditEvents: readAuditEvents().length,
        notifications: notificationRecords.length,
        documents: documentRecords.length,
      },
      users: accountRecords.map(item => ({
        ...toPublicAccount(item),
        category: item.role === USER_ROLES.CUSTOMER ? 'customer' : 'internal',
      })),
      companies: [...companyMap.values()],
      representatives: representatives.map(item => ({
        id: item.id,
        name: item.name,
        branch: branches.find(branch => branch.id === item.branchId)?.name || item.branchCode,
        areas: item.areas || [],
      })),
      branches: branches.map(item => ({ id: item.id, name: item.name, role: item.role })),
      roles: Object.values(USER_ROLES).map(role => ({
        id: role,
        label: role.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
        permissions: permissionsForRole(role),
      })),
      representativeAssignments: Object.values(assignments),
      notificationDeliveryStatus,
      retentionPolicy: readRetentionPolicy(),
      configurations: {
        laboratory: {
          certificationTypes: ['sanas', 'traceable'],
          certificateMimeTypes: ['application/pdf'],
          releaseDestinations: ['expediting', 'dispatch'],
        },
        qualityAssurance: {
          problemCategories: QA_PROBLEM_CATEGORIES,
          severities: QA_SEVERITIES,
          reworkDestinations: QA_REWORK_DESTINATIONS,
        },
        dispatch: {
          methods: DISPATCH_METHODS,
          proofTypes: DISPATCH_PROOF_TYPES,
        },
      },
      integrationPlaceholders: [
        'Private-cloud API and PostgreSQL',
        'Microsoft 365 or approved SMTP email delivery',
        'Object storage with malware scanning',
        'Mobile push through APNs and FCM',
        'Central monitoring, backups and disaster recovery',
      ],
    };
  };

  const administration = {
    async getOverview() {
      requireAdministrator();
      return clone(buildAdministrationOverview());
    },

    async setAccountStatus(accountId, status) {
      const actor = requireAdministrator();
      if (!['active', 'suspended'].includes(status)) {
        throw new ServiceError('Choose active or suspended.', {
          code: 'ACCOUNT_STATUS_INVALID',
          status: 422,
          fieldErrors: { status: 'Choose active or suspended.' },
        });
      }
      if (accountId === actor.id && status === 'suspended') {
        throw new ServiceError('You cannot suspend the administrator account currently in use.', {
          code: 'ACTIVE_ADMIN_SUSPENSION_BLOCKED',
          status: 409,
        });
      }
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId);
      if (index < 0) throw new ServiceError('The account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const occurredAt = now().toISOString();
      accountRecords[index] = { ...accountRecords[index], status, updatedAt: occurredAt };
      writeAccounts(accountRecords);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'administration.account_status_changed',
        outcome: 'success',
        entityType: 'user',
        entityId: accountId,
        companyId: accountRecords[index].companyId,
        actorId: actor.id,
        actorRole: actor.role,
        details: { status },
        immutable: true,
        createdAt: occurredAt,
      });
      return toPublicAccount(accountRecords[index]);
    },

    async assignRepresentative(companyId, representativeId) {
      const actor = requireAdministrator();
      const company = buildAdministrationOverview().companies.find(item => item.id === companyId);
      const representative = representativeById(representativeId);
      if (!company) throw new ServiceError('The customer company was not found.', { code: 'COMPANY_NOT_FOUND', status: 404 });
      if (!representative) throw new ServiceError('Choose a valid representative.', {
        code: 'REPRESENTATIVE_NOT_FOUND',
        status: 422,
        fieldErrors: { representativeId: 'Choose a valid representative.' },
      });
      const occurredAt = now().toISOString();
      const assignments = readCustomerRepresentativeAssignments();
      assignments[companyId] = {
        companyId,
        representativeId,
        assignedAt: occurredAt,
        assignedBy: actor.id,
        source: 'administrator',
      };
      writeCustomerRepresentativeAssignments(assignments);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'administration.company_representative_assigned',
        outcome: 'success',
        entityType: 'company',
        entityId: companyId,
        companyId,
        actorId: actor.id,
        actorRole: actor.role,
        details: { representativeId },
        immutable: true,
        createdAt: occurredAt,
      });
      return clone(assignments[companyId]);
    },

    async resetDemoData() {
      const actor = requireAdministrator();
      for (const key of [
        STORE_KEYS.workflowState,
        STORE_KEYS.audit,
        STORE_KEYS.orderDocuments,
        STORE_KEYS.retentionExports,
        STORE_KEYS.deletionLog,
        STORE_KEYS.idempotency,
        STORE_KEYS.managementExports,
        STORE_KEYS.notifications,
        STORE_KEYS.notificationPreferences,
        STORE_KEYS.certificateFiles,
        STORE_KEYS.customerRepresentativeAssignments,
        STORE_KEYS.rfqSequence,
        STORE_KEYS.seedVersion,
      ]) store.remove(key);
      await initialize();
      appendAuditEvent({
        id: makeId('audit'),
        action: 'administration.demo_data_reset',
        outcome: 'success',
        entityType: 'system',
        entityId: 'mock-preview',
        companyId: actor.companyId,
        actorId: actor.id,
        actorRole: actor.role,
        details: { fabricatedDataOnly: true },
        immutable: true,
        createdAt: now().toISOString(),
      });
      return clone(buildAdministrationOverview());
    },
  };

  const readExecutiveDemoState = () => normaliseExecutiveDemoState(
    store.get(STORE_KEYS.executiveDemo, DEFAULT_EXECUTIVE_DEMO_STATE),
  );
  const saveExecutiveDemoState = patch => {
    const current = readExecutiveDemoState();
    const timestamp = now().toISOString();
    const next = normaliseExecutiveDemoState({
      ...current,
      ...patch,
      startedAt: current.startedAt || timestamp,
      updatedAt: timestamp,
    });
    store.set(STORE_KEYS.executiveDemo, next);
    return next;
  };

  const executiveDemo = {
    async getState() {
      return clone(readExecutiveDemoState());
    },

    async selectScenario(scenarioId) {
      if (!EXECUTIVE_DEMO_SCENARIOS.some(item => item.id === scenarioId)) {
        throw new ServiceError('Choose a valid executive demonstration scenario.', {
          code: 'DEMO_SCENARIO_INVALID',
          status: 422,
        });
      }
      return clone(saveExecutiveDemoState({ scenarioId, stepIndex: 0 }));
    },

    async setStep(stepIndex) {
      return clone(saveExecutiveDemoState({ stepIndex }));
    },

    async setPresentationMode(presentationMode) {
      return clone(saveExecutiveDemoState({ presentationMode: Boolean(presentationMode) }));
    },

    async setLayoutMode(layoutMode) {
      return clone(saveExecutiveDemoState({ layoutMode }));
    },

    async setDevicePreview(devicePreview) {
      return clone(saveExecutiveDemoState({ devicePreview }));
    },

    async resetScenario() {
      const current = readExecutiveDemoState();
      return clone(saveExecutiveDemoState({ scenarioId: current.scenarioId, stepIndex: 0 }));
    },

    async switchRole(role) {
      if (!EXECUTIVE_DEMO_ROLES.some(item => item.role === role)) {
        throw new ServiceError('That role is not part of the executive demonstration.', {
          code: 'DEMO_ROLE_INVALID',
          status: 422,
        });
      }
      const accountRecords = readAccounts();
      const selected = role === USER_ROLES.CUSTOMER
        ? accountRecords.find(item => item.id === DEMO_ACCOUNT.id)
        : accountRecords.find(item => item.role === role);
      if (!selected) throw new ServiceError('The fabricated role account is unavailable.', {
        code: 'DEMO_ACCOUNT_NOT_FOUND',
        status: 404,
      });
      const occurredAt = now().toISOString();
      store.set(STORE_KEYS.session, { accountId: selected.id, signedInAt: occurredAt, executiveDemo: true });
      appendAuditEvent({
        id: makeId('audit'),
        action: 'executive_demo.role_switched',
        outcome: 'success',
        entityType: 'demo_session',
        entityId: selected.id,
        companyId: selected.companyId,
        actorId: selected.id,
        actorRole: selected.role,
        details: { fabricatedDataOnly: true },
        immutable: true,
        createdAt: occurredAt,
      });
      return toPublicAccount(selected);
    },

    async getCatalogue() {
      const current = readExecutiveDemoState();
      return clone({
        scenarios: EXECUTIVE_DEMO_SCENARIOS,
        roles: EXECUTIVE_DEMO_ROLES,
        current,
        currentScenario: executiveScenarioById(current.scenarioId),
      });
    },
  };

  const preferences = {
    async getTheme() {
      return store.get(STORE_KEYS.theme, null) || (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },

    async setTheme(theme) {
      const safeTheme = theme === 'dark' ? 'dark' : 'light';
      store.set(STORE_KEYS.theme, safeTheme);
      return safeTheme;
    },
  };

  return {
    mode: 'mock',
    initialize,
    auth,
    accounts,
    credentials,
    enquiries,
    orders,
    workflow,
    tracking: workflow,
    orderDocuments,
    archive,
    management,
    audit,
    notifications,
    planning,
    expediting,
    laboratory,
    qualityAssurance,
    dispatch,
    administration,
    executiveDemo,
    personalisation,
    products: productService,
    preferences,
    preview: {
      emailRecipient: RFQ_EMAIL_RECIPIENT,
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      maxQuotationDocumentBytes: MAX_QUOTATION_DOCUMENT_BYTES,
      maxAcceptanceDocumentBytes: MAX_ACCEPTANCE_DOCUMENT_BYTES,
      maxDispatchProofBytes: MAX_DISPATCH_PROOF_BYTES,
      maxCertificateBytes: MAX_CERTIFICATE_BYTES,
      persistenceLabel: 'this browser',
    },
  };
}
