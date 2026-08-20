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
import { laboratoryManagerCanHandle, snapshotCertificateRecipients } from '../../domain/laboratoryLaunch.js';
import {
  assertLabTransition,
  calculateLaboratoryWorksheet,
  LAB_METHODS,
  LABORATORY_BRANCHES,
  LABORATORY_ROLES,
  LAB_WORKFLOW_STATUSES,
  methodById,
  validStandardsForWorksheet,
  validateBooking,
  validateInspection,
  validateLaboratoryPointStructure,
  validateReceipt,
  validateStabilisation,
} from '../../domain/laboratoryCalibration.js';
import { FABRICATED_REFERENCE_STANDARDS, LABORATORY_STAFF } from './laboratorySeedData.js';
import {
  generateLaboratoryPdf,
  LAB_DOCUMENT_KINDS,
} from '../../domain/laboratoryDocuments.js';
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
  addHours,
  assertTechnicalTransition,
  isTechnicalSupportActive,
  technicalSupportMetrics,
  TECHNICAL_INFORMATION_TARGETS,
  TECHNICAL_MESSAGE_CLASSIFICATIONS,
  TECHNICAL_SUPPORT_ALLOWANCE_HOURS,
  TECHNICAL_SUPPORT_CATEGORIES,
  TECHNICAL_SUPPORT_PRIORITIES,
  TECHNICAL_SUPPORT_STATUSES,
  validateTechnicalMessage,
  validateTechnicalResponse,
  validateTechnicalSupportRequest,
} from '../../domain/technicalSupport.js';
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
import {
  generateManagementPdfReport,
  validateManagementReportOptions,
} from '../../domain/managementReports.js';
import { resolveManagementPeriod } from '../../domain/salesAnalytics.js';
import { PLANNING_PRIORITIES } from '../../domain/planningQueue.js';
import {
  clientVisitHealth,
  DEFAULT_VISIT_POLICY,
  distanceMetres,
  FABRICATED_OFFICE_LOCATIONS,
  FABRICATED_REP_CLIENTS,
  isWithinWorkingHours,
  validateAppointment,
  verificationStatus,
  visitComplianceMetrics,
} from '../../domain/clientVisits.js';
import {
  findRepresentativeOrderDuplicates,
  ORDER_ORIGINS,
  representativeOrderDocumentMetadata,
  REPRESENTATIVE_ORDER_SOURCES,
} from '../../domain/representativeOrders.js';
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
import { RFQ_DELIVERY_DESTINATION, sendRfqEmail } from '../../lib/rfqEmail.js';
import { buildRfqPdf, rfqPdfFilename } from '../../lib/rfqPdf.js';
import {
  createDefaultUserSettings,
  normaliseUserSettings,
  validateUserSettings,
} from '../../domain/userSettings.js';
import {
  ACCOUNT_STATUSES,
  ACTIVATION_METHODS,
  AUTHENTICATION_TYPES,
  generateTemporaryPassword,
  hashMockCredential,
  INTERNAL_DEPARTMENTS,
  normaliseEmployeeInput,
  validateEmployeeInput,
  validateEmployeeProfileImage,
} from '../../domain/employeeAccounts.js';
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
  MAX_REPRESENTATIVE_ORDER_DOCUMENT_BYTES,
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
  validateRepresentativeDocumentReplacement,
  validateRepresentativeLoadedOrder,
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

const bytesToDataUrl = (bytes, mediaType = 'application/octet-stream') => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mediaType};base64,${globalThis.btoa(binary)}`;
};

const hashFileSha256 = async file => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  let fallback = 2166136261;
  bytes.forEach(value => { fallback = Math.imul(fallback ^ value, 16777619); });
  return `mock-fnv-${(fallback >>> 0).toString(16).padStart(8, '0')}`;
};

const departmentForRole = role => ({
  [USER_ROLES.SALES_REPRESENTATIVE]: 'Sales', [USER_ROLES.SALES_MANAGER]: 'Sales', [USER_ROLES.BRANCH_MANAGER]: 'Sales',
  [USER_ROLES.TECHNICAL_SUPPORT]: 'Technical Support', [USER_ROLES.TECHNICAL_MANAGER]: 'Technical Support', [USER_ROLES.TECHNICAL_DIRECTOR]: 'Technical Support',
  [USER_ROLES.PLANNING]: 'Planning', [USER_ROLES.EXPEDITOR]: 'Expediting',
  [USER_ROLES.LABORATORY_USER]: 'Pressure Laboratory', [USER_ROLES.LABORATORY_TECHNICIAN]: 'Pressure Laboratory', [USER_ROLES.LABORATORY_TEMPERATURE_TECHNICIAN]: 'Temperature Laboratory',
  [USER_ROLES.LABORATORY_MANAGER]: 'Pressure Laboratory', [USER_ROLES.LABORATORY_MANAGER_PRESSURE]: 'Pressure Laboratory', [USER_ROLES.LABORATORY_MANAGER_TEMPERATURE]: 'Temperature Laboratory',
  [USER_ROLES.TECHNICAL_SIGNATORY]: 'Pressure Laboratory', [USER_ROLES.LABORATORY_ADMINISTRATOR]: 'Pressure Laboratory',
  [USER_ROLES.QUALITY_ASSURANCE]: 'Quality Assurance', [USER_ROLES.QUALITY_MANAGER]: 'Quality Assurance',
  [USER_ROLES.DISPATCH]: 'Dispatch', [USER_ROLES.COMPANY_OWNER]: 'Executive', [USER_ROLES.ADMINISTRATOR]: 'Administration',
}[role] || 'Administration');
const inferredBranchId = account => account.branchId || String(account.labBranchId || '').replaceAll('_', '-') || ({ 'Cape Town': 'cape-town', Johannesburg: 'johannesburg', Durban: 'durban', 'Port Elizabeth': 'port-elizabeth' }[account.area] || '');

const normaliseAccount = account => {
  const role = account.role || USER_ROLES.CUSTOMER;
  return {
    ...account,
    role,
    roles: [...new Set([role, ...(Array.isArray(account.roles) ? account.roles : []), ...(Array.isArray(account.labRoles) ? account.labRoles : [])])],
    authRealm: account.authRealm || (role === USER_ROLES.CUSTOMER ? 'customer' : 'internal'),
    status: account.status || 'active',
    signInName: account.signInName || '',
    companyId: account.companyId || (roleCan(role, PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE) ? account.id : 'company-rhomberg'),
    branchId: inferredBranchId(account),
    department: account.department || (role === USER_ROLES.CUSTOMER ? '' : departmentForRole(role)),
    authenticationType: account.authenticationType || 'password',
    activationMethod: account.activationMethod || 'administrator_temporary_password',
    forcePasswordChange: Boolean(account.forcePasswordChange),
    firstLoginCompleted: account.firstLoginCompleted !== false,
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
  const safeEnquiry = { ...enquiry };
  const priority = ['standard', 'high', 'urgent'].includes(enquiry.priority)
    ? enquiry.priority
    : (enquiry.emergency === 'yes' || enquiry.urgent === true ? 'urgent' : 'standard');
  delete safeEnquiry.emergency;
  delete safeEnquiry.urgent;
  let trackingStatus = migrateStatus(enquiry.trackingStatus || 'submitted');
  if (!RFQ_STATUSES.includes(trackingStatus) && !ORDER_STATUSES.includes(trackingStatus)) trackingStatus = 'submitted';
  const createdAt = enquiry.createdAt || new Date().toISOString();
  const workflowType = enquiry.workflowType || (ORDER_STATUSES.includes(trackingStatus) ? 'order' : 'rfq');
  const definition = workflowStatusById(trackingStatus, workflowType);
  const isLegacyOrder = workflowType === 'order';
  const isRepresentativeLoadedOrder = enquiry.orderOrigin === ORDER_ORIGINS.REPRESENTATIVE_LOADED;
  return {
    ...safeEnquiry,
    priority,
    version: Math.max(0, Number(enquiry.version) || 0),
    companyId: enquiry.companyId || enquiry.accountId,
    workflowType,
    trackingStatus,
    status: definition?.label || 'Workflow update',
    sourceRfqStatus: enquiry.sourceRfqStatus || (isLegacyOrder && !isRepresentativeLoadedOrder ? 'converted_to_order' : ''),
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
    version: document.version || 1,
    isCurrentVersion: document.isCurrentVersion !== false,
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
    notes: enquiry.notes,
    customerNotes: enquiry.customerNotes,
    poMode: enquiry.poMode,
    poNumber: enquiry.poNumber,
    purchaseOrderNumber: enquiry.purchaseOrderNumber,
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
      .filter(document => document.isCurrentVersion !== false)
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
    quotationTargetAt: enquiry.revisedQuotationTargetAt || enquiry.quotationTargetAt || '',
    technicalSupport: enquiry.technicalSupport ? {
      reference: enquiry.technicalSupport.reference,
      status: enquiry.technicalSupport.status,
      requestedAt: enquiry.technicalSupport.requestedAt,
      revisedQuotationTargetAt: enquiry.technicalSupport.revisedQuotationTargetAt,
      additionalAllowanceHours: enquiry.technicalSupport.additionalAllowanceHours,
      customerMessage: isTechnicalSupportActive(enquiry.technicalSupport)
        ? 'Technical review is required for your enquiry. Your representative remains your point of contact.'
        : 'The technical review for your enquiry is complete.',
      messages: (enquiry.technicalSupport.messages || [])
        .filter(message => message.classification === 'customer_safe')
        .map(message => ({
          id: message.id,
          message: message.message,
          sender: message.senderRole === USER_ROLES.CUSTOMER ? 'You' : 'Rhomberg Instruments',
          senderRole: message.senderRole === USER_ROLES.CUSTOMER ? USER_ROLES.CUSTOMER : 'rhomberg_staff',
          createdAt: message.createdAt,
          readAt: message.readAt || '',
          attachments: (message.attachments || []).filter(document => document.customerVisible).map(toCustomerVisibleDocument).filter(Boolean),
        })),
      customerInformationRequest: enquiry.technicalSupport.customerInformationRequest?.active ? {
        message: enquiry.technicalSupport.customerInformationRequest.message,
        requestedAt: enquiry.technicalSupport.customerInformationRequest.requestedAt,
      } : null,
    } : undefined,
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
    salesOrderNumber: undefined,
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
  const readUserSettings = () => store.get(STORE_KEYS.userSettings, {});
  const writeUserSettings = records => store.set(STORE_KEYS.userSettings, records);
  const readMockImages = () => store.get(STORE_KEYS.mockImages, {});
  const writeMockImages = records => store.set(STORE_KEYS.mockImages, records);
  const readCertificateFiles = () => store.get(STORE_KEYS.certificateFiles, {});
  const writeCertificateFiles = records => store.set(STORE_KEYS.certificateFiles, records);
  const readCredentialChallenges = () => store.get(STORE_KEYS.credentialChallenges, []);
  const writeCredentialChallenges = records => store.set(STORE_KEYS.credentialChallenges, records);
  const readCustomerRepresentativeAssignments = () => store.get(STORE_KEYS.customerRepresentativeAssignments, {});
  const writeCustomerRepresentativeAssignments = records => store.set(STORE_KEYS.customerRepresentativeAssignments, records);
  const readPendingCustomerProfiles = () => store.get(STORE_KEYS.pendingCustomerProfiles, []);
  const writePendingCustomerProfiles = records => store.set(STORE_KEYS.pendingCustomerProfiles, records);
  const readAdministrationCatalogueOverrides = () => store.get(STORE_KEYS.administrationCatalogueOverrides, { categories: {}, products: {} });
  const writeAdministrationCatalogueOverrides = records => store.set(STORE_KEYS.administrationCatalogueOverrides, records);
  const readUserLoginHistory = () => store.get(STORE_KEYS.userLoginHistory, []);
  const writeUserLoginHistory = records => store.set(STORE_KEYS.userLoginHistory, records);
  const appendUserLoginHistory = event => writeUserLoginHistory([...readUserLoginHistory(), event]);
  const readUserProfileImages = () => store.get(STORE_KEYS.userProfileImages, {});
  const writeUserProfileImages = records => store.set(STORE_KEYS.userProfileImages, records);
  const fabricatedAppointments = () => ([
    { id: 'appointment-demo-scheduled', clientId: 'client-demo-11', customer: 'Fabricated Water Utility', representativeId: 'J-14', branchId: 'johannesburg', address: 'Fabricated customer address 11', customerContact: 'Tumi Contact', scheduledAt: new Date(now().getTime() + 3 * 86400000).toISOString(), expectedDurationMinutes: 60, purpose: 'Fabricated scheduled monthly visit', status: 'scheduled', verificationStatus: 'unverified', fabricated: true, createdAt: now().toISOString(), immutableHistory: [{ action: 'appointment_created', at: now().toISOString(), actorId: 'mock-seed' }] },
    { id: 'appointment-demo-missed', clientId: 'client-demo-10', customer: 'Fabricated Steel Services', representativeId: 'J-14', branchId: 'johannesburg', address: 'Fabricated customer address 10', customerContact: 'Robin Contact', scheduledAt: new Date(now().getTime() - 2 * 86400000).toISOString(), expectedDurationMinutes: 45, purpose: 'Fabricated missed monthly visit', status: 'missed_visit', verificationStatus: 'unverified', fabricated: true, createdAt: new Date(now().getTime() - 4 * 86400000).toISOString(), immutableHistory: [{ action: 'appointment_created', at: new Date(now().getTime() - 4 * 86400000).toISOString(), actorId: 'mock-seed' }, { action: 'visit_missed', at: new Date(now().getTime() - 86400000).toISOString(), actorId: 'mock-system' }] },
  ]);
  const readClientAppointments = () => clone(store.get(STORE_KEYS.clientAppointments, fabricatedAppointments()));
  const writeClientAppointments = records => store.set(STORE_KEYS.clientAppointments, records);
  const readClientVisits = () => store.get(STORE_KEYS.clientVisits, []);
  const writeClientVisits = records => store.set(STORE_KEYS.clientVisits, records);
  const readVisitQrTokens = () => store.get(STORE_KEYS.visitQrTokens, []);
  const writeVisitQrTokens = records => store.set(STORE_KEYS.visitQrTokens, records);
  const readVisitPolicy = () => ({ ...DEFAULT_VISIT_POLICY, ...store.get(STORE_KEYS.visitPolicy, {}) });
  const writeVisitPolicy = policy => store.set(STORE_KEYS.visitPolicy, { ...DEFAULT_VISIT_POLICY, ...policy });
  const readOfficeLocations = () => clone(store.get(STORE_KEYS.officeLocations, FABRICATED_OFFICE_LOCATIONS));
  const writeOfficeLocations = records => store.set(STORE_KEYS.officeLocations, records);
  const effectiveCategories = () => {
    const overrides = readAdministrationCatalogueOverrides().categories || {};
    return categories.map(category => ({ ...category, ...(overrides[category.id] || {}) }));
  };
  const effectiveProducts = () => {
    const overrides = readAdministrationCatalogueOverrides().products || {};
    return products.map(product => ({ ...product, ...(overrides[product.id] || {}) }));
  };
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
    if (!session) return null;
    const stored = readAccounts().find(account => account.id === session.accountId) || null;
    if (!stored) return null;
    const allowedRoles = stored.roles || [stored.role];
    return session.activeRole && allowedRoles.includes(session.activeRole)
      ? { ...stored, role: session.activeRole }
      : stored;
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
    accounts = accounts
      .filter(account => ![
        'staff-technical-manager-demo',
        'staff-laboratory-end-to-end-preview',
        'staff-laboratory-preview',
        'staff-lab-cape-demo-2',
        'staff-lab-manager-demo-2',
        'staff-lab-jhb-demo-2',
        'staff-lab-jhb-demo-1',
        'staff-lab-signatory-demo',
        'staff-lab-administrator-demo',
      ].includes(account.id) && ![
        'technical.manager@example.invalid',
        'laboratory.endtoend@example.invalid',
      ].includes(account.email?.toLowerCase()))
      .map(normaliseAccount);
    for (const seed of [
      DEMO_ACCOUNT,
      SALES_ACCOUNT,
      PLANNING_ACCOUNT,
      EXPEDITOR_ACCOUNT,
      LAB_MANAGER_ACCOUNT,
      QA_ACCOUNT,
      QA_MANAGER_ACCOUNT,
      DISPATCH_ACCOUNT,
      BUYER_ACCOUNT,
      SALES_MANAGER_ACCOUNT,
      COMPANY_OWNER_ACCOUNT,
      MANAGER_ACCOUNT,
      ADMINISTRATOR_ACCOUNT,
      ...EXTRA_DEMO_ACCOUNTS.filter(account => !String(account.role).startsWith('laboratory_') && account.role !== 'technical_signatory'),
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
        salesOrderNumber: record.salesOrderNumber || record.planning?.salesOrderNumber
          || currentSeed.salesOrderNumber || currentSeed.planning?.salesOrderNumber
          || `SO-${String(record.reference || record.id).replace(/[^A-Z0-9]/gi, '').slice(-12)}`,
        customerPoNumber: record.customerPoNumber || currentSeed.customerPoNumber || '',
        planning: {
          ...(record.planning || currentSeed.planning || {}),
          salesOrderNumber: record.planning?.salesOrderNumber || record.salesOrderNumber
            || currentSeed.planning?.salesOrderNumber || currentSeed.salesOrderNumber
            || `SO-${String(record.reference || record.id).replace(/[^A-Z0-9]/gi, '').slice(-12)}`,
        },
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
    if (!store.has(STORE_KEYS.userSettings)) store.set(STORE_KEYS.userSettings, {});
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
    if (!store.has(STORE_KEYS.administrationCatalogueOverrides)) {
      writeAdministrationCatalogueOverrides({ categories: {}, products: {} });
    }
    if (!store.has(STORE_KEYS.userLoginHistory)) writeUserLoginHistory([]);
    if (!store.has(STORE_KEYS.userProfileImages)) writeUserProfileImages({});

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
      const accounts = readAccounts();
      const matched = accounts.find(account => (
        (String(account.email || '').toLowerCase() === identifier || account.signInName?.toLowerCase() === identifier)
        && (!credentials.realm || account.authRealm === credentials.realm)
      ));
      const suppliedHash = matched?.passwordHash ? await hashMockCredential(matched.id, credentials.password) : '';
      const credentialMatches = Boolean(matched && (matched.password === credentials.password || matched.passwordHash === suppliedHash));
      const occurredAt = now().toISOString();
      if (!credentialMatches || !matched || ['temporarily_locked', 'disabled', 'suspended', 'archived'].includes(matched.status)) {
        appendUserLoginHistory({ id: makeId('login'), userId: matched?.id || '', identifier, outcome: 'failure', reason: matched && !credentialMatches ? 'invalid_credential' : matched?.status || 'unknown_identity', occurredAt });
        throw new ServiceError('The email address or password does not match an active preview account.', { code: 'INVALID_CREDENTIALS', status: 401 });
      }
      const index = accounts.findIndex(account => account.id === matched.id);
      accounts[index] = { ...matched, lastLoginAt: occurredAt };
      writeAccounts(accounts);
      appendUserLoginHistory({ id: makeId('login'), userId: matched.id, identifier, outcome: 'success', reason: '', occurredAt });
      store.set(STORE_KEYS.session, { accountId: matched.id, activeRole: matched.role, signedInAt: occurredAt });
      return toPublicAccount(accounts[index]);
    },

    async switchWorkspace(role) {
      const current = requireAccount();
      const roles = current.roles || [current.role];
      if (!roles.includes(role)) throw new ServiceError('That workspace is not assigned to your account.', { code: 'WORKSPACE_FORBIDDEN', status: 403 });
      const session = store.get(STORE_KEYS.session, null);
      store.set(STORE_KEYS.session, { ...session, activeRole: role });
      return toPublicAccount({ ...readAccounts().find(item => item.id === current.id), role });
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
      const sessionAccount = currentStoredAccount();
      const assignment = sessionAccount?.companyId
        ? readCustomerRepresentativeAssignments()[sessionAccount.companyId]
        : null;
      const preferredRepresentative = assignment ? representativeById(assignment.representativeId) : null;
      return {
        areas: clone(areas),
        industries: clone(industries),
        branches: clone(branches),
        areaDirectory,
        preferredRepresentative: preferredRepresentative ? clone({
          ...preferredRepresentative,
          branchName: branches.find(branch => branch.id === preferredRepresentative.branchId)?.name || '',
          assignedAt: assignment.assignedAt || '',
        }) : null,
      };
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
      const [localPart, domain] = String(account.email || '').split('@');
      const maskedEmail = domain ? `${localPart.slice(0, 2)}***@${domain}` : `administrator-assisted verification for ${account.signInName}`;
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
      let activatedOnChange = false;
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
        const existingHash = allAccounts[accountIndex].passwordHash;
        if (password === allAccounts[accountIndex].password || existingHash && await hashMockCredential(account.id, password) === existingHash) {
          throw new ServiceError('Choose a password that is different from the current password.', {
            code: 'PASSWORD_REUSED',
            status: 422,
            fieldErrors: { newPassword: 'Choose a new password.' },
          });
        }
        const wasFirstLogin = Boolean(allAccounts[accountIndex].forcePasswordChange || allAccounts[accountIndex].status === 'pending_activation');
        activatedOnChange = wasFirstLogin;
        updated = {
          ...allAccounts[accountIndex],
          password: undefined,
          passwordHash: await hashMockCredential(account.id, password),
          passwordChangedAt: occurredAt.toISOString(),
          forcePasswordChange: false,
          firstLoginCompleted: true,
          status: wasFirstLogin ? 'active' : allAccounts[accountIndex].status,
          activatedAt: wasFirstLogin ? occurredAt.toISOString() : allAccounts[accountIndex].activatedAt,
        };
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
      if (challenge.changeType === 'password' && activatedOnChange) appendAuditEvent({
        id: makeId('audit'),
        action: 'authentication.account_activated',
        outcome: 'success',
        entityType: 'user',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        fieldsChanged: ['status', 'firstLoginCompleted'],
        previousValue: { status: account.status, firstLoginCompleted: false },
        newValue: { status: 'active', firstLoginCompleted: true },
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
      return { categories: clone(effectiveCategories()), products: clone(effectiveProducts()), recommendedCategories: clone(recommendedCategories) };
    },

    async list({ categoryId, query } = {}) {
      const term = String(query || '').trim().toLowerCase();
      return clone(effectiveProducts().filter(product => product.status !== 'inactive' && (!categoryId || product.category === categoryId) && (!term || `${product.code} ${product.name} ${product.description} ${product.measuringRange}`.toLowerCase().includes(term))));
    },

    async getById(productId) {
      const product = effectiveProducts().find(item => item.id === productId && item.status !== 'inactive');
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
        priority: 'standard',
        documents: documentMetadata,
        items: clone(snapshotCertificateRecipients(lines, account, createdAt)),
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

  const representativeOrderCustomersFor = account => {
    const assignments = readCustomerRepresentativeAssignments();
    const customerAccounts = readAccounts().filter(item => roleCan(item.role, PERMISSIONS.VIEW_OWN_COMPANY_ACCOUNT));
    const canViewAll = accountCan(account, PERMISSIONS.VIEW_ALL_COMPANIES);
    const assignedCompanyIds = new Set(readAllRecords()
      .filter(record => (record.representativeId || record.selectedRep?.id) === account.representativeId)
      .map(record => record.companyId));
    return customerAccounts.filter(customer => {
      if (Array.isArray(account.authorisedCompanyIds) && account.authorisedCompanyIds.length && !account.authorisedCompanyIds.includes(customer.companyId)) return false;
      if (canViewAll) return true;
      return assignments[customer.companyId]?.representativeId === account.representativeId
        || assignedCompanyIds.has(customer.companyId);
    });
  };

  const representativeOrders = {
    async getOptions() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.LOAD_CUSTOMER_ORDER)) {
        throw new ServiceError('Your role cannot load customer orders.', { code: 'FORBIDDEN', status: 403 });
      }
      const customerAccounts = representativeOrderCustomersFor(account);
      const companies = [...new Map(customerAccounts.map(customer => [customer.companyId, {
        id: customer.companyId,
        name: customer.company,
        area: customer.area,
        industry: customer.industry,
      }])).values()];
      const contacts = customerAccounts.map(customer => ({
        id: customer.id,
        companyId: customer.companyId,
        name: customer.contact,
        email: customer.email,
        phone: customer.phone,
      }));
      const availableRepresentatives = accountCan(account, PERMISSIONS.VIEW_ALL_COMPANIES)
        ? representatives
        : representatives.filter(representative => representative.id === account.representativeId);
      return clone({
        companies,
        contacts,
        branches,
        representatives: availableRepresentatives.map(representative => ({
          ...representative,
          branchName: branches.find(branch => branch.id === representative.branchId)?.name || '',
        })),
        products: effectiveProducts().filter(product => product.status !== 'inactive'),
        orderSources: REPRESENTATIVE_ORDER_SOURCES,
        priorities: PLANNING_PRIORITIES,
      });
    },

    async checkDuplicate(candidate = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.LOAD_CUSTOMER_ORDER)) {
        throw new ServiceError('Your role cannot check customer orders.', { code: 'FORBIDDEN', status: 403 });
      }
      const allowedCompanyIds = new Set(representativeOrderCustomersFor(account).map(customer => customer.companyId));
      if (!allowedCompanyIds.has(candidate.companyId)) {
        throw new ServiceError('The selected company is outside your authorised customer scope.', { code: 'COMPANY_NOT_AUTHORISED', status: 403 });
      }
      return clone(findRepresentativeOrderDuplicates({ candidate, orders: readAllOrders(), now: now() }));
    },

    async create(input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.LOAD_CUSTOMER_ORDER)) {
        throw new ServiceError('Your role cannot load customer orders.', { code: 'FORBIDDEN', status: 403 });
      }
      const submissionKey = String(input.submissionKey || '').trim();
      const idempotencyRecords = readIdempotencyRecords();
      const idempotencyRecord = idempotencyRecords[`representative-order:${account.id}:${submissionKey}`];
      if (idempotencyRecord) {
        const existingOrder = readAllOrders().find(order => order.id === idempotencyRecord.entityId);
        if (existingOrder && canReadRecord(account, existingOrder)) {
          return clone({ order: presentRecord(account, existingOrder), idempotent: true, duplicateCheck: existingOrder.duplicateCheckResult });
        }
      }

      const validated = validateRepresentativeLoadedOrder(input);
      const candidate = validated.order;
      validateConfiguredProducts(candidate.items);
      const customerAccounts = representativeOrderCustomersFor(account);
      let pendingCustomerProfile = null;
      let customer = customerAccounts.find(item => item.id === candidate.customerContactId && item.companyId === candidate.companyId);
      if (candidate.customerType === 'new') {
        const pendingProfiles = readPendingCustomerProfiles();
        const matchingProfile = pendingProfiles.find(profile => profile.workEmail === candidate.newCustomer.workEmail
          && profile.companyName.toLowerCase() === candidate.newCustomer.companyName.toLowerCase());
        const companyId = matchingProfile?.companyId || makeId('pending-company');
        const contactId = matchingProfile?.contactId || makeId('pending-contact');
        pendingCustomerProfile = {
          id: matchingProfile?.id || makeId('pending-customer-profile'),
          companyId,
          contactId,
          ...candidate.newCustomer,
          branchId: candidate.branchId,
          representativeId: candidate.representativeId,
          status: 'pending_review',
          portalAccess: false,
          createdBy: account.id,
          createdAt: matchingProfile?.createdAt || now().toISOString(),
          updatedAt: now().toISOString(),
        };
        customer = {
          id: contactId,
          companyId,
          company: candidate.newCustomer.companyName,
          contact: candidate.newCustomer.contactName,
          email: candidate.newCustomer.workEmail,
          phone: candidate.newCustomer.telephone,
          area: branches.find(item => item.id === candidate.branchId)?.name || '',
          industry: 'Pending customer profile',
        };
        candidate.companyId = companyId;
        candidate.customerContactId = contactId;
      }
      if (!customer) {
        throw new ServiceError('Select an authorised contact for an available customer company.', {
          code: 'CUSTOMER_CONTACT_NOT_AUTHORISED',
          status: 403,
          fieldErrors: { customerContactId: 'This contact is outside your authorised customer scope.' },
        });
      }
      const selectedRepresentative = representativeById(candidate.representativeId);
      if (!selectedRepresentative) {
        throw new ServiceError('Select a representative from the approved directory.', { code: 'REPRESENTATIVE_NOT_FOUND', status: 422, fieldErrors: { representativeId: 'Select an approved representative.' } });
      }
      if (!accountCan(account, PERMISSIONS.VIEW_ALL_COMPANIES) && selectedRepresentative.id !== account.representativeId) {
        throw new ServiceError('Representatives may load orders only under their own assignment.', { code: 'REPRESENTATIVE_ASSIGNMENT_REQUIRED', status: 403 });
      }
      if (selectedRepresentative.branchId !== candidate.branchId) {
        throw new ServiceError('The branch must match the dedicated representative.', { code: 'BRANCH_REPRESENTATIVE_MISMATCH', status: 422, fieldErrors: { branchId: 'Choose the representative\'s assigned branch.' } });
      }
      const branch = branches.find(item => item.id === candidate.branchId);
      if (!branch) throw new ServiceError('Select an approved Rhomberg branch.', { code: 'BRANCH_NOT_FOUND', status: 422 });

      const productDirectory = effectiveProducts();
      const items = candidate.items.map(item => {
        const product = productDirectory.find(entry => entry.id === item.productId);
        const lineId = makeId('order-line');
        return {
          lineId,
          orderItemId: lineId,
          productId: product.id,
          code: product.code,
          name: product.name,
          description: product.description,
          image: product.image,
          category: product.category,
          variant: product.variant || '',
          quantity: Number(item.quantity),
          configuration: clone(item.configuration || {}),
          configurationSnapshot: clone(item.configuration || {}),
        };
      });
      const duplicateCheck = findRepresentativeOrderDuplicates({
        candidate: { ...candidate, items },
        orders: readAllOrders(),
        now: now(),
      });
      if (duplicateCheck.likelyDuplicate && !candidate.duplicateConfirmed) {
        throw new ServiceError('A possible duplicate order was found. Review it before creating another order.', {
          code: 'LIKELY_DUPLICATE_ORDER',
          status: 409,
          fieldErrors: { duplicateConfirmation: 'Confirm that this is a separate authorised order before resubmitting.' },
          details: { duplicateCheck },
        });
      }

      if (pendingCustomerProfile) {
        const pendingProfiles = readPendingCustomerProfiles();
        writePendingCustomerProfiles([
          ...pendingProfiles.filter(profile => profile.id !== pendingCustomerProfile.id),
          pendingCustomerProfile,
        ]);
      }

      const createdAt = now().toISOString();
      const orderId = makeId('order');
      const reference = nextOrderReference(readAllOrders());
      const actor = createWorkflowActor(account);
      const uploader = { id: account.id, role: account.role, displayName: account.contact };
      const quotationDocument = representativeOrderDocumentMetadata({
        id: makeId('document'), type: 'customer_quotation', file: validated.quotationFile, uploadedAt: createdAt, uploadedBy: uploader,
      });
      const purchaseOrderDocument = representativeOrderDocumentMetadata({
        id: makeId('document'), type: 'purchase_order', file: validated.purchaseOrderFile, uploadedAt: createdAt, uploadedBy: uploader,
      });
      const supportingDocuments = validated.supportingDocuments.map(file => representativeOrderDocumentMetadata({
        id: makeId('document'), type: 'supporting_document', file, uploadedAt: createdAt, uploadedBy: uploader, customerVisible: false,
      }));
      const sourceRecordId = makeId('representative-loaded-order');
      const selectedRep = {
        ...clone(selectedRepresentative),
        branchName: branch.name,
      };
      const creationEvent = {
        id: makeId('workflow-event'),
        entityType: 'order',
        action: 'create_representative_order',
        fromStatus: '',
        toStatus: 'awaiting_planning',
        status: 'awaiting_planning',
        label: 'Awaiting planning',
        note: 'Your order has been created and sent to Planning.',
        customerDescription: 'Your order has been created and sent to Planning.',
        internalDescription: 'Order loaded by Sales Representative from an approved offline source.',
        customerVisible: true,
        actorId: account.id,
        actorRole: account.role,
        actor: account.contact,
        createdAt,
      };
      const order = saveOrder({
        id: orderId,
        reference,
        version: 0,
        workflowType: 'order',
        orderOrigin: ORDER_ORIGINS.REPRESENTATIVE_LOADED,
        orderSource: candidate.orderSource,
        orderSourceOther: candidate.orderSourceOther,
        sourceRecordId,
        createdByRepresentative: true,
        createdByRepresentativeId: account.id,
        createdBy: uploader,
        representativeLoadedOrder: {
          id: sourceRecordId,
          source: candidate.orderSource,
          sourceExplanation: candidate.orderSourceOther,
          createdByRepresentativeId: account.id,
          createdAt,
          customerType: candidate.customerType,
          pendingCustomerProfileId: pendingCustomerProfile?.id || '',
        },
        accountId: customer.id,
        companyId: customer.companyId,
        company: customer.company,
        companySnapshot: { id: customer.companyId, name: customer.company, area: customer.area, industry: customer.industry },
        contact: customer.contact,
        email: customer.email,
        phone: customer.phone,
        customerContactId: customer.id,
        submittingCustomerId: customer.id,
        submittingCustomer: { id: customer.id, name: customer.contact, email: customer.email, phone: customer.phone },
        selectedRep,
        representativeId: selectedRep.id,
        assignedAt: createdAt,
        branchId: branch.id,
        application: candidate.application,
        fulfilment: candidate.fulfilment,
        deliveryAddress: candidate.deliveryAddress,
        collectionBranch: candidate.fulfilment === 'collect' ? `${branch.name} - ${branch.address}` : '',
        customerNotes: candidate.customerNotes,
        notes: candidate.customerNotes,
        internalRepresentativeNotes: candidate.internalRepresentativeNotes,
        requiredDate: candidate.requiredDate,
        priority: candidate.priority,
        internalUrgency: candidate.priority === 'urgent',
        items,
        quotationNumber: candidate.quotationNumber,
        purchaseOrderNumber: candidate.purchaseOrderNumber,
        customerPoNumber: candidate.purchaseOrderNumber,
        poMode: 'upload',
        poNumber: candidate.purchaseOrderNumber,
        poFileName: purchaseOrderDocument.fileName,
        quotationDocumentId: quotationDocument.id,
        purchaseOrderDocumentId: purchaseOrderDocument.id,
        quotation: {
          number: candidate.quotationNumber,
          date: candidate.quotationDate,
          revision: candidate.quotationRevision,
          emailed: true,
          acceptedExternally: true,
          documentCustomerVisible: true,
          document: quotationDocument,
        },
        purchaseOrder: {
          number: candidate.purchaseOrderNumber,
          date: candidate.purchaseOrderDate,
          documentId: purchaseOrderDocument.id,
        },
        documents: [quotationDocument, purchaseOrderDocument, ...supportingDocuments],
        sourceConfirmation: {
          confirmed: true,
          confirmedBy: uploader,
          confirmedAt: createdAt,
          note: candidate.confirmationNote,
          statements: [
            'quotation_sent_and_accepted',
            'purchase_order_matches_customer',
            'quotation_and_purchase_order_match',
            'products_and_quantities_checked',
            'representative_authorised',
          ],
        },
        duplicateCheckResult: { ...duplicateCheck, explicitlyConfirmed: duplicateCheck.likelyDuplicate && candidate.duplicateConfirmed },
        trackingStatus: 'awaiting_planning',
        status: 'Awaiting planning',
        trackingHistory: [creationEvent],
        acceptedAt: createdAt,
        submittedAt: createdAt,
        submittedToPlanningAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      });

      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'representative_loaded_order_created',
        action: 'order.representative_loaded',
        outcome: 'success',
        entityType: 'order',
        entityId: order.id,
        companyId: order.companyId,
        companyName: order.company,
        reference: order.reference,
        actorId: account.id,
        actorRole: account.role,
        actorDisplayName: account.contact,
        fromStatus: '',
        toStatus: 'awaiting_planning',
        fieldsChanged: ['orderOrigin', 'orderSource', 'items', 'quotationDocumentId', 'purchaseOrderDocumentId', 'trackingStatus'],
        details: { sourceRecordId, duplicateCheck, pricingStored: false },
        immutable: true,
        createdAt,
      });
      if (pendingCustomerProfile) appendAuditEvent({
        id: makeId('audit'),
        eventType: 'pending_customer_profile_created',
        action: 'customer.pending_profile_created',
        outcome: 'success',
        entityType: 'customer_profile',
        entityId: pendingCustomerProfile.id,
        companyId: pendingCustomerProfile.companyId,
        companyName: pendingCustomerProfile.companyName,
        reference: order.reference,
        actorId: account.id,
        actorRole: account.role,
        actorDisplayName: account.contact,
        fieldsChanged: ['companyName', 'contactName', 'workEmail', 'telephone', 'address', 'registrationInformation', 'notes', 'branchId', 'representativeId', 'status'],
        details: { portalAccessGranted: false, status: 'pending_review' },
        immutable: true,
        createdAt,
      });
      for (const document of order.documents) {
        appendAuditEvent({
          id: makeId('audit'),
          eventType: 'document_uploaded',
          action: 'document.uploaded',
          outcome: 'success',
          entityType: 'order',
          entityId: order.id,
          companyId: order.companyId,
          reference: order.reference,
          actorId: account.id,
          actorRole: account.role,
          documentMetadata: [{ id: document.id, documentType: document.documentType, fileName: document.fileName, mimeType: document.mimeType, sizeBytes: document.sizeBytes, version: document.version }],
          immutable: true,
          createdAt,
        });
      }
      publishWorkflowNotifications({ action: 'create_representative_order', record: order, actor });
      if (duplicateCheck.likelyDuplicate && candidate.duplicateConfirmed) {
        publishWorkflowNotifications({ action: 'confirm_representative_order_duplicate', record: order, actor });
        appendAuditEvent({
          id: makeId('audit'), action: 'order.possible_duplicate_confirmed', outcome: 'success', entityType: 'order', entityId: order.id,
          companyId: order.companyId, reference: order.reference, actorId: account.id, actorRole: account.role,
          details: { duplicateCheck }, immutable: true, createdAt,
        });
      }
      idempotencyRecords[`representative-order:${account.id}:${submissionKey}`] = {
        entityType: 'order', entityId: order.id, createdAt,
      };
      writeIdempotencyRecords(idempotencyRecords);
      return clone({ order: presentRecord(account, order), idempotent: false, duplicateCheck });
    },

    async listDocuments(orderId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.DOWNLOAD_ORDER_SOURCE_DOCUMENT)) throw new ServiceError('Your role cannot access order source documents.', { code: 'FORBIDDEN', status: 403 });
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      const available = (order.documents || []).filter(document => isInternalRole(account.role)
        || (document.customerVisible !== false && document.isCurrentVersion !== false));
      return clone(available);
    },

    async downloadDocument(orderId, documentId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.DOWNLOAD_ORDER_SOURCE_DOCUMENT)) throw new ServiceError('Your role cannot download order source documents.', { code: 'FORBIDDEN', status: 403 });
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      const document = (order.documents || []).find(item => item.id === documentId);
      if (!document || (!isInternalRole(account.role) && (document.customerVisible === false || document.isCurrentVersion === false))) throw new ServiceError('The document was not found or is not authorised for this account.', { code: 'DOCUMENT_NOT_FOUND', status: 404 });
      appendAuditEvent({
        id: makeId('audit'), eventType: 'document_downloaded', action: 'document.downloaded', outcome: 'success', entityType: 'order', entityId: order.id,
        companyId: order.companyId, reference: order.reference, actorId: account.id, actorRole: account.role,
        documentMetadata: [{ id: document.id, documentType: document.documentType, fileName: document.fileName, version: document.version }], immutable: true, createdAt: now().toISOString(),
      });
      return clone({ ...document, simulated: true, downloadUrl: '', message: 'Document access was authorised and audited. The GitHub Pages mock stores metadata only.' });
    },

    async replaceDocument(orderId, documentId, input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.REPLACE_ORDER_SOURCE_DOCUMENT)) throw new ServiceError('Your role cannot replace order source documents.', { code: 'FORBIDDEN', status: 403 });
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The order was not found.', { code: 'ORDER_NOT_FOUND', status: 404 });
      const documentIndex = (order.documents || []).findIndex(document => document.id === documentId && document.isCurrentVersion !== false);
      if (documentIndex < 0) throw new ServiceError('The current document version was not found.', { code: 'DOCUMENT_NOT_FOUND', status: 404 });
      const current = order.documents[documentIndex];
      if (!['customer_quotation', 'purchase_order'].includes(current.documentType)) throw new ServiceError('Only the quotation or Purchase Order can be replaced through this workflow.', { code: 'DOCUMENT_TYPE_NOT_REPLACEABLE', status: 422 });
      const replacement = validateRepresentativeDocumentReplacement(input);
      if (current.fileName.toLowerCase() === replacement.file.name.toLowerCase() && current.sizeBytes === Number(replacement.file.size || 0)) {
        throw new ServiceError('Choose a different document for the corrected version.', { code: 'DUPLICATE_DOCUMENT', status: 409, fieldErrors: { file: 'This file matches the current document metadata.' } });
      }
      const occurredAt = now().toISOString();
      const documents = order.documents.map((document, index) => index === documentIndex ? { ...document, isCurrentVersion: false } : document);
      const updatedDocument = representativeOrderDocumentMetadata({
        id: makeId('document'),
        type: current.documentType,
        file: replacement.file,
        uploadedAt: occurredAt,
        uploadedBy: { id: account.id, role: account.role, displayName: account.contact },
        version: Number(current.version || 1) + 1,
        replacesDocumentId: current.id,
        replacementReason: replacement.reason,
      });
      documents.push(updatedDocument);
      const updated = saveOrder({
        ...order,
        documents,
        quotationDocumentId: current.documentType === 'customer_quotation' ? updatedDocument.id : order.quotationDocumentId,
        purchaseOrderDocumentId: current.documentType === 'purchase_order' ? updatedDocument.id : order.purchaseOrderDocumentId,
        quotation: current.documentType === 'customer_quotation' ? { ...order.quotation, document: updatedDocument } : order.quotation,
        purchaseOrder: current.documentType === 'purchase_order' ? { ...order.purchaseOrder, documentId: updatedDocument.id } : order.purchaseOrder,
        updatedAt: occurredAt,
      });
      appendAuditEvent({
        id: makeId('audit'), eventType: 'document_replaced', action: 'document.replaced', outcome: 'success', entityType: 'order', entityId: updated.id,
        companyId: updated.companyId, reference: updated.reference, actorId: account.id, actorRole: account.role,
        reason: replacement.reason, fieldsChanged: ['documents'], documentMetadata: [{ id: updatedDocument.id, replacesDocumentId: current.id, documentType: updatedDocument.documentType, fileName: updatedDocument.fileName, version: updatedDocument.version }],
        immutable: true, createdAt: occurredAt,
      });
      return clone(updatedDocument);
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
      orderOrigin: ORDER_ORIGINS.CUSTOMER_RFQ,
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
          order.reference, order.sourceRfqReference, order.internalJobNumber, order.salesOrderNumber, order.customerPoNumber,
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

  const commercialReportingRoles = new Set([USER_ROLES.COMPANY_OWNER, USER_ROLES.SALES_MANAGER]);
  const canUseCommercialReporting = account => (
    commercialReportingRoles.has(account?.role)
    && accountCan(account, PERMISSIONS.VIEW_COMMERCIAL_ANALYTICS)
  );
  const reportRecordDate = record => String(
    record.quotation?.date
    || record.quotedAt
    || record.acceptedAt
    || record.createdAt
    || '',
  ).slice(0, 10);

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
        includeSalesPerformance: canUseCommercialReporting(account),
        salesOptions: {
          periodMode: filters.periodMode || 'rolling_months',
          rollingMonths: filters.rollingMonths || 12,
          startDate: filters.startDate,
          endDate: filters.endDate,
          representativeId: filters.representativeId || 'all',
          branchId: filters.branch || 'all',
        },
      }));
    },

    async getPerformanceReportOptions() {
      const account = requireAccount();
      if (!canUseCommercialReporting(account)) {
        throw new ServiceError('Only the Company Owner and Sales Manager can configure commercial performance reports.', { code: 'FORBIDDEN', status: 403 });
      }
      return clone({
        representatives: representatives.map(representative => ({
          id: representative.id,
          name: representative.name,
          branchId: representative.branchId,
          branchName: branches.find(branch => branch.id === representative.branchId)?.name || representative.branchId,
        })),
        branches: branches.map(branch => ({ id: branch.id, name: branch.name })),
        rollingMonthOptions: [1, 3, 6, 12, 24, 36],
      });
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

    async exportPerformancePdf(input = {}) {
      const account = requireAccount();
      if (!canUseCommercialReporting(account) || !accountCan(account, PERMISSIONS.EXPORT_MANAGEMENT_PDF)) {
        throw new ServiceError('Only the Company Owner and Sales Manager can export this commercial performance PDF.', { code: 'FORBIDDEN', status: 403 });
      }
      let options;
      let period;
      try {
        options = validateManagementReportOptions(input);
        period = resolveManagementPeriod(options, now());
      } catch (validationError) {
        throw new ServiceError(validationError.message, { code: 'MANAGEMENT_REPORT_INVALID', status: 422 });
      }
      const authorisedRecords = readAllRecords().filter(record => canReadRecord(account, record));
      const scopedRecords = authorisedRecords
        .filter(record => options.representativeId === 'all' || record.selectedRep?.id === options.representativeId)
        .filter(record => options.branchId === 'all' || record.selectedRep?.branchId === options.branchId)
        .filter(record => {
          const key = reportRecordDate(record);
          return key && key >= period.startDate && key <= period.endDate;
        });
      const auditEvents = readAuditEvents().map(presentAuditEvent).filter(event => {
        if (!event.company?.id) return true;
        return canReadRecord(account, {
          workflowType: event.entityType === 'order' ? 'order' : 'rfq',
          companyId: event.company.id,
        });
      });
      const dashboard = buildManagementDashboard({
        records: scopedRecords,
        salesRecords: authorisedRecords,
        auditEvents,
        now: now(),
        includeSalesPerformance: true,
        salesOptions: options,
      });
      const generatedAt = now().toISOString();
      const bytesBase64 = await generateManagementPdfReport({
        dashboard,
        options,
        generatedAt,
        generatedBy: account.contact,
        roleLabel: account.role === USER_ROLES.COMPANY_OWNER ? 'Company Owner' : 'Sales Manager',
      });
      const report = {
        id: makeId('management-performance-report'),
        fileName: `rhomberg-management-performance-${period.startDate}-to-${period.endDate}.pdf`,
        mimeType: 'application/pdf',
        classification: 'RESTRICTED MANAGEMENT REPORT',
        generatedAt,
        generatedBy: { id: account.id, displayName: account.contact, role: account.role },
        period,
        sections: options.sections,
        representativeId: options.representativeId,
        branchId: options.branchId,
        rowCount: dashboard.records.length,
        sizeBytes: Math.ceil(bytesBase64.length * 0.75),
        bytesBase64,
      };
      writeManagementExports([...readManagementExports(), { ...report, bytesBase64: undefined }]);
      appendAuditEvent({
        id: makeId('audit'),
        eventType: 'management_performance_pdf_exported',
        action: 'management.performance_pdf_exported',
        outcome: 'success',
        entityType: 'management_report',
        entityId: report.id,
        actorId: account.id,
        actorDisplayName: account.contact,
        actorRole: account.role,
        fieldsChanged: [],
        reason: `Exported ${report.sections.length} authorised management sections for ${period.label}.`,
        documentMetadata: [{
          id: report.id,
          fileName: report.fileName,
          mimeType: report.mimeType,
          classification: report.classification,
          sizeBytes: report.sizeBytes,
        }],
        details: {
          period,
          sections: report.sections,
          representativeId: report.representativeId,
          branchId: report.branchId,
          rowCount: report.rowCount,
        },
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

  const legacyUnitStatus = workflowStatus => {
    if (workflowStatus === 'received_in_lab' || workflowStatus === 'thermal_stabilisation' || workflowStatus === 'inspection_pending' || workflowStatus === 'inspection_failed' || workflowStatus === 'booked_in' || workflowStatus === 'worksheet_ready') return 'received';
    if (workflowStatus === 'calibration_in_progress' || workflowStatus === 'calculation_review_required') return 'calibration_in_progress';
    if (workflowStatus === 'calibration_on_hold' || workflowStatus === 'management_changes_required') return 'calibration_on_hold';
    if (['calibration_completed', 'labelling_pending', 'labelling_completed', 'bom_signoff_pending', 'ready_for_dispatch', 'certificate_data_pending', 'draft_certificate_ready', 'management_review', 'approved_for_signature', 'awaiting_signed_certificate', 'signed_certificate_uploaded', 'certificate_released'].includes(workflowStatus)) return 'calibration_completed';
    if (workflowStatus === 'released_to_dispatch' || workflowStatus === 'completed' || workflowStatus === 'archived') return 'released';
    return 'awaiting_lab';
  };

  const laboratoryContext = (account, orderId, unitId, permission) => {
    if (!accountCan(account, permission)) throw new ServiceError('Your account cannot perform that Laboratory action.', { code: 'FORBIDDEN', status: 403 });
    const source = readAllOrders().find(item => item.id === orderId);
    if (!source || !canReadRecord(account, source) || !orderRequiresLaboratory(source)) throw new ServiceError('The Laboratory order was not found.', { code: 'LAB_ORDER_NOT_FOUND', status: 404 });
    const order = ensureLaboratoryRecord(source);
    const index = order.laboratory.units.findIndex(unit => unit.id === unitId);
    if (index < 0) throw new ServiceError('The physical calibration unit was not found.', { code: 'LAB_UNIT_NOT_FOUND', status: 404 });
    const unit = order.laboratory.units[index];
    const allowedBranches = account.authorisedLabBranchIds || (account.labBranchId ? [account.labBranchId] : []);
    if (allowedBranches.length && unit.labWork?.branchId && !allowedBranches.includes(unit.labWork.branchId)) throw new ServiceError('That calibration unit belongs to another Laboratory branch.', { code: 'LAB_BRANCH_FORBIDDEN', status: 403 });
    return { order, unit, index };
  };

  const canOperateLaboratoryMethod = (account, method) => {
    const roles = new Set([account.role, ...(account.labRoles || [])]);
    if (method?.discipline === 'temperature') return roles.has(USER_ROLES.LABORATORY_TEMPERATURE_TECHNICIAN);
    return roles.has(USER_ROLES.LABORATORY_USER) || roles.has(USER_ROLES.LABORATORY_TECHNICIAN);
  };

  const requireMethodTechnician = (account, method) => {
    if (!method || !canOperateLaboratoryMethod(account, method)) {
      const discipline = method?.discipline === 'temperature' ? 'Temperature' : 'Pressure';
      throw new ServiceError(`An authorised ${discipline} Laboratory technician must complete this action.`, { code: 'LAB_METHOD_TECHNICIAN_REQUIRED', status: 403 });
    }
  };

  const persistLaboratoryUnit = ({ account, order, index, nextUnit, action, reason = '', customerMessage = '' }) => {
    const occurredAt = now().toISOString();
    const previousUnit = order.laboratory.units[index];
    const event = {
      id: makeId('lab-event'),
      eventType: action,
      previousStatus: previousUnit.labWork?.status || 'awaiting_lab_receipt',
      newStatus: nextUnit.labWork?.status || previousUnit.labWork?.status || 'awaiting_lab_receipt',
      actorId: account.id,
      actorRole: account.role,
      actorName: account.contact,
      reason: String(reason || '').trim(),
      createdAt: occurredAt,
      immutable: true,
    };
    const completedUnit = {
      ...nextUnit,
      status: legacyUnitStatus(nextUnit.labWork?.status),
      updatedAt: occurredAt,
      updatedBy: actorSnapshot(account),
      labWork: {
        ...nextUnit.labWork,
        events: [...(nextUnit.labWork?.events || []), event],
      },
    };
    const units = [...order.laboratory.units];
    units[index] = completedUnit;
    const updated = saveOrder({
      ...order,
      version: Number(order.version || 0) + 1,
      updatedAt: occurredAt,
      laboratory: { ...order.laboratory, branchId: completedUnit.labWork?.branchId || order.laboratory.branchId, units, lastUpdatedAt: occurredAt },
    });
    appendAuditEvent({
      id: makeId('audit'),
      action: `laboratory.${action}`,
      outcome: 'success',
      entityType: 'laboratory_unit',
      entityId: completedUnit.id,
      companyId: updated.companyId,
      reference: updated.reference,
      actorId: account.id,
      actorRole: account.role,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      reason: event.reason,
      fieldsChanged: ['laboratory.units.labWork'],
      previousValue: previousUnit.labWork,
      newValue: completedUnit.labWork,
      details: { orderId: order.id, unitNumber: completedUnit.unitNumber, previousValue: previousUnit.labWork, newValue: completedUnit.labWork, reason: event.reason },
      immutable: true,
      createdAt: occurredAt,
    });
    if (customerMessage) publishWorkflowNotifications({
      action: 'laboratory_progress_updated',
      record: updated,
      actor: createWorkflowActor(account),
      input: { customerMessage },
    });
    return clone(completedUnit);
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
        launchMode: 'certificate_upload_only',
        technicianWorkflowEnabled: false,
      });
    },

    async listOrders() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_LAB_QUEUE)) {
        throw new ServiceError('Your account cannot access the Laboratory queue.', { code: 'FORBIDDEN', status: 403 });
      }
      const allowedBranches = account.authorisedLabBranchIds || (account.labBranchId ? [account.labBranchId] : []);
      return clone(readAllOrders()
        .filter(order => orderRequiresLaboratory(order) && canReadRecord(account, order))
        .filter(order => !allowedBranches.length || !order.laboratory?.branchId || allowedBranches.includes(order.laboratory.branchId))
        .map(ensureLaboratoryRecord)
        .filter(order => order.laboratory.units.some(unit => laboratoryManagerCanHandle(account, unit.certificationType)))
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

    async receive(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.RECEIVE_LAB_ORDER);
      const receipt = validateReceipt(input);
      const status = assertLabTransition(unit.labWork.status, 'receive');
      const occurredAt = now().toISOString();
      return persistLaboratoryUnit({
        account, order, index, action: 'unit_received',
        nextUnit: { ...unit, receivedAt: occurredAt, labWork: { ...unit.labWork, status, branchId: receipt.branchId, receipt: { ...receipt, receivedAt: occurredAt, receivedBy: actorSnapshot(account) } } },
        customerMessage: 'Your instrument has been received by the Rhomberg Calibration Laboratory.',
      });
    },

    async startStabilisation(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.UPDATE_LAB_WORK);
      const details = validateStabilisation(input);
      const status = assertLabTransition(unit.labWork.status, 'start_stabilisation');
      return persistLaboratoryUnit({ account, order, index, action: 'stabilisation_started', nextUnit: { ...unit, labWork: { ...unit.labWork, status, stabilisation: { ...details, startedAt: now().toISOString(), startedBy: actorSnapshot(account), completedAt: '' } } } });
    },

    async completeStabilisation(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.UPDATE_LAB_WORK);
      const details = validateStabilisation(input, { completing: true });
      const status = assertLabTransition(unit.labWork.status, 'complete_stabilisation');
      return persistLaboratoryUnit({ account, order, index, action: 'stabilisation_completed', nextUnit: { ...unit, labWork: { ...unit.labWork, status, stabilisation: { ...(unit.labWork.stabilisation || {}), ...details, completedAt: now().toISOString(), completedBy: actorSnapshot(account) } } } });
    },

    async inspect(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.INSPECT_LAB_UNIT);
      const inspection = validateInspection(input);
      const cannotContinue = ['customer_or_representative_approval_required', 'repair_required', 'calibration_cannot_proceed'].includes(inspection.outcome);
      const transition = cannotContinue ? 'fail_inspection' : 'record_inspection';
      const status = assertLabTransition(unit.labWork.status, transition);
      return persistLaboratoryUnit({
        account, order, index, action: cannotContinue ? 'inspection_failed' : 'inspection_completed', reason: inspection.reason,
        nextUnit: { ...unit, labWork: { ...unit.labWork, status, inspection: { ...inspection, inspectedAt: now().toISOString(), inspectedBy: actorSnapshot(account) } } },
        customerMessage: cannotContinue ? 'Our Laboratory identified an issue requiring review before calibration can continue.' : '',
      });
    },

    async bookIn(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.BOOK_IN_LAB_UNIT);
      const booking = validateBooking(input);
      const status = assertLabTransition(unit.labWork.status, 'book_in');
      const branchCode = unit.labWork.branchId === 'johannesburg' ? 'JHB' : 'CT';
      const referenceToken = String(order.reference || order.id).replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase();
      const jobNumber = String(input.jobNumber || `LAB-${branchCode}-${referenceToken}-${unit.unitNumber}`).trim();
      const certificateNumber = String(input.certificateNumber || `CAL-${branchCode}-${referenceToken}-${unit.unitNumber}`).trim();
      const allUnits = certificateQueueForOrders(readAllOrders());
      if (allUnits.some(item => item.id !== unit.id && item.jobNumber?.toLowerCase() === jobNumber.toLowerCase())) throw new ServiceError('That Laboratory job number is already in use.', { code: 'DUPLICATE_LAB_JOB_NUMBER', status: 409, fieldErrors: { jobNumber: 'Use a unique Laboratory job number.' } });
      if (allUnits.some(item => item.id !== unit.id && item.certificateNumber?.toLowerCase() === certificateNumber.toLowerCase())) throw new ServiceError('That certificate number is already in use.', { code: 'DUPLICATE_CERTIFICATE_NUMBER', status: 409, fieldErrors: { certificateNumber: 'Use a unique certificate number.' } });
      return persistLaboratoryUnit({
        account, order, index, action: 'unit_booked_in',
        nextUnit: { ...unit, jobNumber, certificateNumber, serialNumber: booking.serialNumber, labWork: { ...unit.labWork, status, booking: { ...booking, jobNumber, certificateNumber, bookedAt: now().toISOString(), bookedBy: actorSnapshot(account) } } },
      });
    },

    async assignTechnician(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.EDIT_LAB_MANAGEMENT_FIELDS);
      const reason = String(input.reason || '').trim();
      if (reason.length < 8) throw new ServiceError('Provide a reason for the technician assignment.', { code: 'LAB_ASSIGNMENT_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Provide a clear assignment reason.' } });
      const staff = LABORATORY_STAFF.find(item => item.id === input.technicianId && item.roles.some(role => [LABORATORY_ROLES.TECHNICIAN, LABORATORY_ROLES.TEMPERATURE_TECHNICIAN].includes(role)));
      if (!staff || staff.branchId !== unit.labWork.branchId) throw new ServiceError('Select a technician authorised for this Laboratory branch.', { code: 'LAB_TECHNICIAN_INVALID', status: 422, fieldErrors: { technicianId: 'Select an authorised branch technician.' } });
      return persistLaboratoryUnit({ account, order, index, action: 'technician_assigned', reason, nextUnit: { ...unit, assignedTechnicianId: staff.id, labWork: { ...unit.labWork, assignedTechnicianId: staff.id } } });
    },

    async saveWorksheet(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.ENTER_RAW_CALIBRATION_DATA);
      const method = methodById(input.methodId || unit.labWork.booking?.methodId);
      if (!method) throw new ServiceError('Select the calibration method.', { code: 'LAB_METHOD_REQUIRED', status: 422, fieldErrors: { methodId: 'Select a method.' } });
      requireMethodTechnician(account, method);
      if (!['worksheet_ready', 'calibration_in_progress', 'calibration_on_hold', 'management_changes_required'].includes(unit.labWork.status)) throw new ServiceError('Complete booking-in before entering worksheet data.', { code: 'LAB_WORKSHEET_STAGE_INVALID', status: 409 });
      const testPoints = (input.testPoints || []).map((point, pointIndex) => ({
        id: point.id || `point-${pointIndex + 1}`,
        direction: method.discipline === 'pressure' && ['increasing', 'repeatability', 'decreasing'].includes(point.direction) ? point.direction : 'temperature',
        applied: Number(point.applied),
        standardCorrection: Number(point.standardCorrection || 0),
        readings: (point.readings || []).filter(value => value !== '').map(Number),
        referenceReadings: (point.referenceReadings || []).filter(value => value !== '').map(Number),
        readingTimestamps: (point.readingTimestamps || []).map(value => String(value || '')),
        ambientTemperature: point.ambientTemperature === '' ? null : Number(point.ambientTemperature),
        immersionDepth: String(point.immersionDepth || '').trim().slice(0, 100),
        stabilisationConfirmed: point.stabilisationConfirmed === true,
        resultStatus: point.resultStatus === 'review_required' ? 'review_required' : 'satisfactory',
        technicianNotes: String(point.technicianNotes || '').trim().slice(0, 1000),
        notes: String(point.notes || '').trim().slice(0, 500),
      }));
      if (!testPoints.length || testPoints.some(point => !Number.isFinite(point.applied) || !point.readings.length || point.readings.some(value => !Number.isFinite(value)))) throw new ServiceError('Enter valid calibration points and numeric readings.', { code: 'LAB_WORKSHEET_READINGS_INVALID', status: 422 });
      validateLaboratoryPointStructure(method, testPoints);
      const validStandards = validStandardsForWorksheet({ standards: FABRICATED_REFERENCE_STANDARDS, branchId: unit.labWork.branchId, methodId: method.id, minimum: unit.labWork.booking?.rangeMinimum, maximum: unit.labWork.booking?.rangeMaximum, asOf: now().toISOString().slice(0, 10) });
      const standardIds = [...new Set(input.standardIds || [])];
      if (!standardIds.length || standardIds.some(id => !validStandards.some(standard => standard.id === id))) throw new ServiceError('Select an active, in-range reference standard approved for this method.', { code: 'LAB_REFERENCE_STANDARD_INVALID', status: 422, fieldErrors: { standardIds: 'Select a valid reference standard.' } });
      const uncertaintyContributions = (input.uncertaintyContributions || []).map(item => ({ ...item, source: String(item.source || '').trim().slice(0, 160), uncertainty: Number(item.uncertainty), divisor: item.divisor === '' ? undefined : Number(item.divisor), sensitivity: item.sensitivity === '' ? 1 : Number(item.sensitivity), degreesOfFreedom: item.degreesOfFreedom === '' ? null : Number(item.degreesOfFreedom) }));
      if (!uncertaintyContributions.length) throw new ServiceError('Add the approved uncertainty-budget contributions.', { code: 'LAB_UNCERTAINTY_REQUIRED', status: 422 });
      const previousWorksheet = unit.labWork.worksheet;
      const worksheet = {
        id: previousWorksheet?.id || makeId('lab-worksheet'), methodId: method.id, methodVersion: method.version,
        sourceTemplate: method.sourceTemplate, procedureNumber: method.procedureNumber, standardIds, testPoints,
        uncertaintyContributions, coverageFactor: Number(input.coverageFactor || 2), decimals: Number(input.decimals ?? 6),
        environmental: { temperature: input.environmental?.temperature === '' ? null : Number(input.environmental?.temperature), humidity: input.environmental?.humidity === '' ? null : Number(input.environmental?.humidity) },
        notes: String(input.notes || '').trim().slice(0, 2000), revision: Number(previousWorksheet?.revision || 0) + 1,
        previousVersions: previousWorksheet ? [...(previousWorksheet.previousVersions || []), { ...previousWorksheet, previousVersions: undefined }] : [],
        savedAt: now().toISOString(), savedBy: actorSnapshot(account), locked: false,
      };
      const nextStatus = unit.labWork.status === 'management_changes_required' ? 'calibration_in_progress' : unit.labWork.status;
      return persistLaboratoryUnit({ account, order, index, action: 'worksheet_saved', nextUnit: { ...unit, labWork: { ...unit.labWork, status: nextStatus, worksheet, calculation: null } } });
    },

    async startCalibration(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.START_LAB_CALIBRATION);
      if (!unit.labWork.worksheet) throw new ServiceError('Save the structured worksheet before calibration starts.', { code: 'LAB_WORKSHEET_REQUIRED', status: 409 });
      requireMethodTechnician(account, methodById(unit.labWork.worksheet.methodId));
      const status = assertLabTransition(unit.labWork.status, 'start_calibration');
      return persistLaboratoryUnit({ account, order, index, action: 'calibration_started', nextUnit: { ...unit, startedAt: unit.startedAt || now().toISOString(), labWork: { ...unit.labWork, status, calibrationStartedAt: unit.labWork.calibrationStartedAt || now().toISOString(), startNote: String(input.note || '').trim().slice(0, 1000) } }, customerMessage: 'Calibration of your instrument has started.' });
    },

    async holdCalibration(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.START_LAB_CALIBRATION);
      requireMethodTechnician(account, methodById(unit.labWork.worksheet?.methodId));
      const reason = String(input.reason || '').trim();
      if (reason.length < 8) throw new ServiceError('Record why calibration is being put on hold.', { code: 'LAB_HOLD_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Provide a clear hold reason.' } });
      const status = assertLabTransition(unit.labWork.status, 'hold_calibration');
      return persistLaboratoryUnit({ account, order, index, action: 'calibration_put_on_hold', reason, nextUnit: { ...unit, labWork: { ...unit.labWork, status, hold: { reason, heldAt: now().toISOString(), heldBy: actorSnapshot(account) } } }, customerMessage: 'Calibration is temporarily on hold while our Laboratory completes a review.' });
    },

    async calculate(orderId, unitId) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.ENTER_RAW_CALIBRATION_DATA);
      if (unit.labWork.status !== 'calibration_in_progress') throw new ServiceError('Start calibration before calculating the worksheet.', { code: 'LAB_CALCULATION_STAGE_INVALID', status: 409 });
      requireMethodTechnician(account, methodById(unit.labWork.worksheet?.methodId));
      const calculation = calculateLaboratoryWorksheet(unit.labWork.worksheet);
      const status = assertLabTransition(unit.labWork.status, 'submit_raw_data');
      return persistLaboratoryUnit({ account, order, index, action: 'calculation_completed', nextUnit: { ...unit, labWork: { ...unit.labWork, status, worksheet: { ...unit.labWork.worksheet, locked: true }, calculation: { ...calculation, calculatedBy: actorSnapshot(account) } } } });
    },

    async approveFormulaValidation(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.APPROVE_CALCULATION_REVIEW);
      const reason = String(input.reason || '').trim();
      if (input.confirmed !== true || reason.length < 12) throw new ServiceError('Confirm the mock technical review and record a detailed reason.', { code: 'LAB_FORMULA_REVIEW_CONFIRMATION_REQUIRED', status: 422, fieldErrors: { reason: 'Provide at least 12 characters.' } });
      if (!unit.labWork.calculation) throw new ServiceError('Calculate the worksheet before review.', { code: 'LAB_CALCULATION_REQUIRED', status: 409 });
      return persistLaboratoryUnit({ account, order, index, action: 'formula_validation_reviewed', reason, nextUnit: { ...unit, labWork: { ...unit.labWork, formulaValidationReview: { status: 'accepted_for_mock_demo', reason, reviewedAt: now().toISOString(), reviewedBy: actorSnapshot(account), formalProductionApprovalRequired: true } } } });
    },

    async completeCalibration(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.COMPLETE_LAB_CALIBRATION);
      requireMethodTechnician(account, methodById(unit.labWork.worksheet?.methodId));
      if (!unit.labWork.calculation) throw new ServiceError('Run and review the calculation before completing calibration.', { code: 'LAB_CALCULATION_REQUIRED', status: 409 });
      if (unit.labWork.formulaValidationReview?.status !== 'accepted_for_mock_demo') throw new ServiceError('Laboratory Management must review the unresolved reference-template warnings before this mock workflow can continue.', { code: 'LAB_FORMULA_VALIDATION_REQUIRED', status: 409 });
      if (input.technicianConfirmed !== true) throw new ServiceError('Confirm that the raw readings and required repeatability readings are complete.', { code: 'LAB_TECHNICIAN_CONFIRMATION_REQUIRED', status: 422 });
      const status = assertLabTransition(unit.labWork.status, 'complete_calibration');
      return persistLaboratoryUnit({ account, order, index, action: 'calibration_completed', nextUnit: { ...unit, completedAt: now().toISOString(), calibrationResult: String(input.resultSummary || 'Structured worksheet completed').slice(0, 1000), labWork: { ...unit.labWork, status, calibrationCompletedAt: now().toISOString(), technicianConfirmation: actorSnapshot(account) } }, customerMessage: 'Calibration of your instrument has been completed. The certificate is being finalised.' });
    },

    async completeLabelling(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.RECORD_LABELLING);
      if (input.calibrationLabelApplied !== true || input.identificationChecked !== true) throw new ServiceError('Confirm the calibration label and instrument identification.', { code: 'LAB_LABELLING_INCOMPLETE', status: 422 });
      const status = assertLabTransition(unit.labWork.status, 'complete_labelling');
      const labelling = { calibrationLabelApplied: true, certificateNumber: unit.certificateNumber, calibrationDate: String(input.calibrationDate || '').trim(), recalibrationDate: String(input.recalibrationDate || '').trim(), identificationChecked: true, sealApplied: input.sealApplied === true, labelledAt: now().toISOString(), labelledBy: actorSnapshot(account), checkedBy: String(input.checkedBy || '').trim() };
      return persistLaboratoryUnit({ account, order, index, action: 'labelling_completed', nextUnit: { ...unit, labWork: { ...unit.labWork, status, labelling } } });
    },

    async releaseUnitToDispatch(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.RELEASE_UNIT_TO_DISPATCH);
      if (input.bomSignedOff !== true) throw new ServiceError('Complete the BOM or applicable production sign-off.', { code: 'LAB_BOM_SIGNOFF_REQUIRED', status: 422 });
      const packages = Math.max(1, Math.trunc(Number(input.numberOfPackages) || 0));
      const status = assertLabTransition(unit.labWork.status, 'release_to_dispatch');
      const releasedAt = now().toISOString();
      const completedUnit = persistLaboratoryUnit({ account, order, index, action: 'unit_released_to_dispatch', nextUnit: { ...unit, releasedAt, movementStatus: 'released', labWork: { ...unit.labWork, status, release: { bomSignedOff: true, numberOfPackages: packages, destination: input.destination === 'expediting' ? 'expediting' : 'dispatch', internalNote: String(input.internalNote || '').trim().slice(0, 2000), releasedAt, releasedBy: actorSnapshot(account) } } }, customerMessage: 'Calibration of your instrument has been completed and the unit is moving to Dispatch. The calibration certificate is being finalised.' });
      const refreshed = ensureLaboratoryRecord(readAllOrders().find(item => item.id === orderId));
      const allReleased = refreshed.laboratory.units.every(item => ['released_to_dispatch', 'certificate_released', 'completed', 'archived'].includes(item.labWork?.status));
      if (allReleased && input.destination !== 'expediting' && refreshed.trackingStatus !== 'awaiting_lab_receipt_dispatch') {
        saveOrder({
          ...refreshed,
          trackingStatus: 'awaiting_lab_receipt_dispatch',
          status: 'Awaiting Dispatch receipt from Laboratory',
          laboratory: { ...refreshed.laboratory, status: 'released', releasedAt, releasedBy: actorSnapshot(account), releaseNote: 'All physical calibration units transferred to Dispatch.' },
          trackingHistory: [...(refreshed.trackingHistory || []), normaliseHistoryEvent({ id: makeId('event'), status: 'awaiting_lab_receipt_dispatch', note: 'All calibrated physical units were transferred to Dispatch. Certificate preparation may continue separately.', actor: account.contact, actorRole: account.role, customerVisible: true, createdAt: releasedAt }, releasedAt)],
        });
      }
      return completedUnit;
    },

    async generateReviewPdf(orderId, unitId) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.REVIEW_RAW_LAB_DATA);
      if (!unit.labWork.calculation) throw new ServiceError('Calculate the worksheet before generating the review package.', { code: 'LAB_CALCULATION_REQUIRED', status: 409 });
      const generatedAt = now().toISOString();
      const documentId = makeId('lab-document');
      const base64 = await generateLaboratoryPdf({ kind: LAB_DOCUMENT_KINDS.REVIEW, order, unit, generatedAt, generatedBy: account.contact });
      const files = readCertificateFiles();
      files[documentId] = { id: documentId, orderId, unitId, companyId: order.companyId, dataUrl: `data:application/pdf;base64,${base64}`, immutable: true, createdAt: generatedAt };
      writeCertificateFiles(files);
      const document = { id: documentId, type: 'calculation_review', fileName: `${unit.jobNumber || unit.id}-calculation-review.pdf`, version: (unit.labWork.documents.filter(item => item.type === 'calculation_review').length + 1), status: 'generated', visibility: 'internal', generatedAt, generatedBy: actorSnapshot(account), relatedUnitId: unit.id, immutable: true };
      persistLaboratoryUnit({ account, order, index, action: 'review_pdf_generated', nextUnit: { ...unit, labWork: { ...unit.labWork, documents: [...unit.labWork.documents, document] } } });
      return clone({ ...document, dataUrl: files[documentId].dataUrl });
    },

    async generateDraftCertificate(orderId, unitId) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.GENERATE_DRAFT_CERTIFICATE);
      const status = assertLabTransition(unit.labWork.status, 'generate_draft');
      const generatedAt = now().toISOString();
      const documentId = makeId('lab-document');
      const base64 = await generateLaboratoryPdf({ kind: LAB_DOCUMENT_KINDS.DRAFT_CERTIFICATE, order, unit, generatedAt, generatedBy: account.contact });
      const files = readCertificateFiles();
      files[documentId] = { id: documentId, orderId, unitId, companyId: order.companyId, dataUrl: `data:application/pdf;base64,${base64}`, immutable: true, createdAt: generatedAt };
      writeCertificateFiles(files);
      const version = { id: documentId, type: 'draft_certificate', fileName: `${unit.certificateNumber || unit.id}-draft.pdf`, version: unit.labWork.certificateWorkflow.draftVersions.length + 1, status: 'draft', visibility: 'management', generatedAt, generatedBy: actorSnapshot(account), rawDataRevision: unit.labWork.worksheet?.revision, calculationVersion: unit.labWork.calculation?.methodVersion, immutable: true };
      const nextUnit = { ...unit, labWork: { ...unit.labWork, status, documents: [...unit.labWork.documents, version], certificateWorkflow: { ...unit.labWork.certificateWorkflow, draftVersions: [...unit.labWork.certificateWorkflow.draftVersions, version] } } };
      persistLaboratoryUnit({ account, order, index, action: 'draft_certificate_generated', nextUnit });
      return clone({ ...version, dataUrl: files[documentId].dataUrl });
    },

    async submitCertificateForReview(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.GENERATE_DRAFT_CERTIFICATE);
      const status = assertLabTransition(unit.labWork.status, 'submit_review');
      return persistLaboratoryUnit({ account, order, index, action: 'certificate_submitted_for_review', nextUnit: { ...unit, labWork: { ...unit.labWork, status, certificateWorkflow: { ...unit.labWork.certificateWorkflow, reviewEvents: [...unit.labWork.certificateWorkflow.reviewEvents, { action: 'submitted', comment: String(input.comment || '').trim(), createdAt: now().toISOString(), actor: actorSnapshot(account), immutable: true }] } } } });
    },

    async returnCertificateForCorrection(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.APPROVE_CALCULATION_REVIEW);
      const reason = String(input.reason || '').trim();
      if (reason.length < 8) throw new ServiceError('Record the reason for returning the certificate.', { code: 'LAB_CORRECTION_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Provide a clear correction reason.' } });
      const status = assertLabTransition(unit.labWork.status, 'return_correction');
      return persistLaboratoryUnit({ account, order, index, action: 'certificate_returned_for_correction', reason, nextUnit: { ...unit, labWork: { ...unit.labWork, status, certificateWorkflow: { ...unit.labWork.certificateWorkflow, reviewEvents: [...unit.labWork.certificateWorkflow.reviewEvents, { action: 'returned', reason, createdAt: now().toISOString(), actor: actorSnapshot(account), immutable: true }] } } } });
    },

    async approveForSignature(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.APPROVE_CALCULATION_REVIEW);
      if (unit.labWork.formulaValidationReview?.status !== 'accepted_for_mock_demo') throw new ServiceError('Formal method-validation evidence is still required before approval.', { code: 'LAB_METHOD_APPROVAL_REQUIRED', status: 409 });
      if (input.confirmed !== true) throw new ServiceError('Confirm the raw data, method, standards and certificate values.', { code: 'LAB_MANAGEMENT_CONFIRMATION_REQUIRED', status: 422 });
      const status = assertLabTransition(unit.labWork.status, 'approve_signature');
      return persistLaboratoryUnit({ account, order, index, action: 'certificate_approved_for_signature', nextUnit: { ...unit, labWork: { ...unit.labWork, status, certificateWorkflow: { ...unit.labWork.certificateWorkflow, signatoryName: String(input.signatoryName || account.contact).trim(), issue: String(input.issue || 'Issue 1').trim(), approvedAt: now().toISOString(), approvedBy: actorSnapshot(account) } } } });
    },

    async generateUnsignedCertificate(orderId, unitId) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.GENERATE_DRAFT_CERTIFICATE);
      const status = assertLabTransition(unit.labWork.status, 'generate_unsigned');
      const generatedAt = now().toISOString();
      const documentId = makeId('lab-document');
      const base64 = await generateLaboratoryPdf({ kind: LAB_DOCUMENT_KINDS.UNSIGNED_CERTIFICATE, order, unit, generatedAt, generatedBy: account.contact });
      const files = readCertificateFiles();
      files[documentId] = { id: documentId, orderId, unitId, companyId: order.companyId, dataUrl: `data:application/pdf;base64,${base64}`, immutable: true, createdAt: generatedAt };
      writeCertificateFiles(files);
      const version = { id: documentId, type: 'unsigned_final_certificate', fileName: `${unit.certificateNumber || unit.id}-unsigned.pdf`, version: unit.labWork.certificateWorkflow.unsignedVersions.length + 1, status: 'unsigned', visibility: 'management', generatedAt, generatedBy: actorSnapshot(account), immutable: true };
      persistLaboratoryUnit({ account, order, index, action: 'unsigned_certificate_generated', nextUnit: { ...unit, labWork: { ...unit.labWork, status, documents: [...unit.labWork.documents, version], certificateWorkflow: { ...unit.labWork.certificateWorkflow, unsignedVersions: [...unit.labWork.certificateWorkflow.unsignedVersions, version] } } } });
      return clone({ ...version, dataUrl: files[documentId].dataUrl });
    },

    async uploadSignedCertificate(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.UPLOAD_SIGNED_CERTIFICATE);
      const status = assertLabTransition(unit.labWork.status, 'upload_signed');
      const existingActive = unit.labWork.certificateWorkflow.signedVersions.find(item => item.status === 'active');
      const reason = String(input.reason || '').trim();
      if (existingActive && reason.length < 8) throw new ServiceError('Provide a reason for replacing the signed certificate.', { code: 'LAB_SIGNED_REPLACEMENT_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Provide a replacement reason.' } });
      const otherCertificates = readAllOrders().flatMap(item => item.laboratory?.units || []).filter(item => item.id !== unit.id).map(item => item.certificate).filter(Boolean);
      const certificate = validateCertificateUpload({ ...input, certificateNumber: input.certificateNumber || unit.certificateNumber }, otherCertificates);
      const dataUrl = await fileToDataUrl(input.file);
      const hash = await hashFileSha256(input.file);
      const certificateId = makeId('certificate');
      const uploadedAt = now().toISOString();
      const files = readCertificateFiles();
      files[certificateId] = { id: certificateId, orderId, unitId, companyId: order.companyId, dataUrl, sha256: hash, immutable: true, createdAt: uploadedAt };
      writeCertificateFiles(files);
      const signedVersions = unit.labWork.certificateWorkflow.signedVersions.map(item => item.status === 'active' ? { ...item, status: 'superseded', supersededAt: uploadedAt, supersededReason: reason } : item);
      const signed = { id: certificateId, ...certificate, type: 'signed_final_certificate', version: signedVersions.length + 1, status: 'active', visibility: 'management', sha256: hash, uploadedAt, uploadedBy: actorSnapshot(account), immutable: true, malwareScanStatus: 'required_in_production' };
      signedVersions.push(signed);
      const nextUnit = { ...unit, certificateId, certificateNumber: certificate.certificateNumber, certificateStatus: 'uploaded', certificateUploadedAt: uploadedAt, certificate: { ...signed, customerVisible: false, storageStatus: 'browser_mock' }, labWork: { ...unit.labWork, status, documents: [...unit.labWork.documents.map(item => item.id === existingActive?.id ? { ...item, status: 'superseded' } : item), signed], certificateWorkflow: { ...unit.labWork.certificateWorkflow, signedVersions } } };
      persistLaboratoryUnit({ account, order, index, action: 'signed_certificate_uploaded', reason, nextUnit });
      return clone(signed);
    },

    async releaseCertificate(orderId, unitId, input = {}) {
      const account = requireAccount();
      const { order, unit, index } = laboratoryContext(account, orderId, unitId, PERMISSIONS.RELEASE_CERTIFICATE);
      const recipientRule = ['representative_only', 'customer_and_representative'].includes(input.recipientRule) ? input.recipientRule : '';
      if (!recipientRule) throw new ServiceError('Select the approved certificate recipient rule.', { code: 'LAB_CERTIFICATE_RECIPIENT_REQUIRED', status: 422, fieldErrors: { recipientRule: 'Select the recipient rule.' } });
      const status = assertLabTransition(unit.labWork.status, 'release_certificate');
      const releasedAt = now().toISOString();
      const nextUnit = { ...unit, certificateStatus: 'verified', certificate: { ...unit.certificate, customerVisible: recipientRule === 'customer_and_representative', releasedAt, recipientRule }, labWork: { ...unit.labWork, status, certificateWorkflow: { ...unit.labWork.certificateWorkflow, releasedAt, releasedBy: actorSnapshot(account), recipientRule } } };
      return persistLaboratoryUnit({ account, order, index, action: 'certificate_released', nextUnit, customerMessage: recipientRule === 'customer_and_representative' ? `Calibration certificate ${unit.certificateNumber} has been released.` : '' });
    },

    async downloadLabDocument(documentId) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.DOWNLOAD_DRAFT_CERTIFICATE) && !accountCan(account, PERMISSIONS.DOWNLOAD_CERTIFICATES)) throw new ServiceError('Your account cannot download Laboratory documents.', { code: 'FORBIDDEN', status: 403 });
      const order = readAllOrders().find(item => (item.laboratory?.units || []).some(unit => (unit.labWork?.documents || []).some(document => document.id === documentId)) && canReadRecord(account, item));
      const unit = order?.laboratory?.units?.find(item => (item.labWork?.documents || []).some(document => document.id === documentId));
      const document = unit?.labWork?.documents?.find(item => item.id === documentId);
      const file = readCertificateFiles()[documentId];
      if (!order || !document || !file || document.visibility === 'internal' && account.role === USER_ROLES.CUSTOMER) throw new ServiceError('The Laboratory document was not found for your authorised records.', { code: 'LAB_DOCUMENT_NOT_FOUND', status: 404 });
      appendAuditEvent({ id: makeId('audit'), action: 'laboratory.document_downloaded', outcome: 'success', entityType: 'lab_document', entityId: documentId, companyId: order.companyId, reference: order.reference, actorId: account.id, actorRole: account.role, documentMetadata: [{ id: documentId, fileName: document.fileName, type: document.type }], immutable: true, createdAt: now().toISOString() });
      return clone({ ...document, dataUrl: file.dataUrl });
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
      if (!laboratoryManagerCanHandle(account, unit.certificationType)) throw new ServiceError('This certificate type is outside your Laboratory Manager discipline.', { code: 'FORBIDDEN', status: 403 });
      if (String(input.serialNumber || '').trim().length < 1) throw new ServiceError('Enter the unit serial number.', { code: 'SERIAL_NUMBER_REQUIRED', status: 422, fieldErrors: { serialNumber: 'Enter the physical unit serial number.' } });
      if (input.confirmAssociation !== true) throw new ServiceError('Confirm that the certificate belongs to this order and unit.', { code: 'CERTIFICATE_ASSOCIATION_REQUIRED', status: 422, fieldErrors: { confirmAssociation: 'Confirmation is required.' } });
      if (input.certificationType && input.certificationType !== unit.certificationType) throw new ServiceError('The certificate type must match the configured unit.', { code: 'CERTIFICATE_TYPE_MISMATCH', status: 422 });
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
        serialNumber: String(input.serialNumber).trim(),
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
      const completed = units.every(item => ['uploaded', 'verified', 'archived'].includes(item.certificateStatus));
      const updated = saveOrder({
        ...prepared,
        version: Number(prepared.version || 0) + 1,
        updatedAt: occurredAt,
        laboratory: { ...prepared.laboratory, status: completed ? 'completed' : 'awaiting_certificate', completedAt: completed ? occurredAt : '', units, lastUpdatedAt: occurredAt },
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
      if (completed) {
        appendAuditEvent({ id: makeId('audit'), action: 'laboratory.certificate_task_completed', outcome: 'success', entityType: 'laboratory_task', entityId: updated.id, companyId: updated.companyId, reference: updated.reference, actorId: account.id, actorRole: account.role, fieldsChanged: ['laboratory.status'], details: { certificateCount: units.length }, immutable: true, createdAt: occurredAt });
        publishWorkflowNotifications({ action: 'certificate_uploaded', record: updated, actor: createWorkflowActor(account), input: { customerMessage: 'All calibration certificates for this order are now available.' } });
      }
      return clone(units[index].certificate);
    },

    async uploadCertificatesBatch(orderId, entries = []) {
      if (!Array.isArray(entries) || entries.length < 1) {
        throw new ServiceError('Select at least one certificate to upload.', { code: 'CERTIFICATE_BATCH_EMPTY', status: 422 });
      }
      const unitIds = entries.map(entry => entry.unitId);
      if (new Set(unitIds).size !== unitIds.length) {
        throw new ServiceError('Each physical unit may only appear once in a certificate batch.', { code: 'CERTIFICATE_BATCH_DUPLICATE_UNIT', status: 422 });
      }
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.MANAGE_CERTIFICATES)) throw new ServiceError('Your account cannot upload certificates.', { code: 'FORBIDDEN', status: 403 });
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order) || !orderRequiresLaboratory(order)) throw new ServiceError('The Laboratory order was not found.', { code: 'LAB_ORDER_NOT_FOUND', status: 404 });
      const prepared = ensureLaboratoryRecord(order);
      const existingCertificates = certificateQueueForOrders(readAllOrders()).filter(item => item.certificateId).map(item => ({ id: item.certificateId, certificateNumber: item.certificateNumber }));
      for (const entry of entries) {
        const unit = prepared.laboratory.units.find(item => item.id === entry.unitId);
        if (!unit || unit.certificateId) throw new ServiceError('One of the selected physical units cannot accept a new certificate.', { code: 'DUPLICATE_UNIT_CERTIFICATE', status: 409 });
        if (!laboratoryManagerCanHandle(account, unit.certificationType)) throw new ServiceError('A selected certificate type is outside your Laboratory Manager discipline.', { code: 'FORBIDDEN', status: 403 });
        if (!String(entry.serialNumber || '').trim()) throw new ServiceError('Enter the unit serial number for every selected certificate.', { code: 'SERIAL_NUMBER_REQUIRED', status: 422 });
        if (entry.confirmAssociation !== true) throw new ServiceError('Confirm every certificate belongs to its selected physical unit.', { code: 'CERTIFICATE_ASSOCIATION_REQUIRED', status: 422 });
        validateCertificateUpload(entry, existingCertificates);
        existingCertificates.push({ id: `pending-${entry.unitId}`, certificateNumber: entry.certificateNumber });
      }
      const results = [];
      for (const entry of entries) results.push(await laboratory.uploadCertificate(orderId, entry.unitId, entry));
      return results;
    },

    async replaceCertificate(orderId, unitId, input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.MANAGE_CERTIFICATES)) throw new ServiceError('Your account cannot replace certificates.', { code: 'FORBIDDEN', status: 403 });
      const order = readAllOrders().find(item => item.id === orderId);
      if (!order || !canReadRecord(account, order)) throw new ServiceError('The Laboratory order was not found.', { code: 'LAB_ORDER_NOT_FOUND', status: 404 });
      const prepared = ensureLaboratoryRecord(order);
      const index = prepared.laboratory.units.findIndex(unit => unit.id === unitId);
      const unit = prepared.laboratory.units[index];
      if (!unit?.certificateId) throw new ServiceError('Upload the first certificate before replacing it.', { code: 'CERTIFICATE_NOT_FOUND', status: 404 });
      const reason = String(input.reason || '').trim();
      if (reason.length < 5) throw new ServiceError('Enter a reason for replacing the certificate.', { code: 'REPLACEMENT_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'A clear replacement reason is required.' } });
      const previous = unit.certificate;
      const certificate = validateCertificateUpload({ ...input, id: previous.id }, certificateQueueForOrders(readAllOrders()).filter(item => item.certificateId).map(item => ({ id: item.certificateId, certificateNumber: item.certificateNumber })));
      const occurredAt = now().toISOString();
      const certificateId = makeId('certificate');
      const files = readCertificateFiles();
      files[certificateId] = { id: certificateId, orderId, unitId, companyId: order.companyId, dataUrl: await fileToDataUrl(input.file), createdAt: occurredAt };
      writeCertificateFiles(files);
      const versions = [...(unit.certificateVersions || []), { ...previous, status: 'superseded', supersededAt: occurredAt, supersededBy: certificateId, replacementReason: reason }];
      const units = [...prepared.laboratory.units];
      units[index] = { ...unit, certificateId, certificateNumber: certificate.certificateNumber, certificateVersions: versions, certificate: { id: certificateId, ...certificate, certificationType: unit.certificationType, unitId, orderId, companyId: order.companyId, uploadedAt: occurredAt, uploadedBy: actorSnapshot(account), storageStatus: 'browser_mock', customerVisible: true, version: versions.length + 1 }, certificateUploadedAt: occurredAt, updatedAt: occurredAt };
      const updated = saveOrder({ ...prepared, version: Number(prepared.version || 0) + 1, updatedAt: occurredAt, laboratory: { ...prepared.laboratory, units, lastUpdatedAt: occurredAt } });
      appendAuditEvent({ id: makeId('audit'), action: 'laboratory.certificate_replaced', outcome: 'success', entityType: 'certificate', entityId: certificateId, companyId: updated.companyId, reference: updated.reference, actorId: account.id, actorRole: account.role, fieldsChanged: ['laboratory.units.certificate'], details: { previousCertificateId: previous.id, reason }, immutable: true, createdAt: occurredAt });
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
      const customerAwaitingRelease = account.role === USER_ROLES.CUSTOMER && unit?.certificate?.customerVisible !== true;
      if (!order || !unit?.certificate || !file || customerAwaitingRelease) {
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
      if (!accountCan(account, PERMISSIONS.ARCHIVE_LAB_JOB)) {
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

  const visitAudit = (account, action, entityId, details = {}) => appendAuditEvent({
    id: makeId('audit'), action: `client_visit.${action}`, eventType: action, outcome: 'success', entityType: 'client_visit', entityId,
    companyId: 'company-rhomberg', actorId: account.id, actorRole: account.role, actorDisplayName: account.contact,
    details: { ...details, fabricated: true }, createdAt: now().toISOString(), immutable: true,
  });
  const requireVisitPermission = (account, permission) => {
    if (!accountCan(account, permission)) throw new ServiceError('Your account cannot perform that client-visit action.', { code: 'VISIT_FORBIDDEN', status: 403 });
  };
  const clientForAccount = (account, clientId) => {
    const client = FABRICATED_REP_CLIENTS.find(item => item.id === clientId);
    if (!client) throw new ServiceError('The assigned customer was not found.', { code: 'VISIT_CLIENT_NOT_FOUND', status: 404 });
    if (account.role === USER_ROLES.SALES_REPRESENTATIVE && client.representativeId !== account.representativeId) throw new ServiceError('This customer is assigned to another Representative.', { code: 'VISIT_CLIENT_FORBIDDEN', status: 403 });
    return client;
  };
  const appointmentsForAccount = account => readClientAppointments().filter(item => account.role !== USER_ROLES.SALES_REPRESENTATIVE || item.representativeId === account.representativeId);
  const effectiveVisitClients = account => FABRICATED_REP_CLIENTS
    .filter(client => account.role !== USER_ROLES.SALES_REPRESENTATIVE || client.representativeId === account.representativeId)
    .map(client => {
      const latest = readClientVisits().filter(visit => visit.clientId === client.id && visit.verificationStatus === 'verified').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
      const current = latest ? { ...client, lastVerifiedVisitAt: latest.completedAt } : client;
      return { ...current, ...clientVisitHealth(current, readVisitPolicy(), now().getTime()) };
    });

  const clientVisits = {
    async listClients() {
      const account = requireAccount(); requireVisitPermission(account, account.role === USER_ROLES.SALES_REPRESENTATIVE ? PERMISSIONS.VIEW_ASSIGNED_CLIENTS : PERMISSIONS.VIEW_VISIT_COMPLIANCE);
      return clone(effectiveVisitClients(account));
    },
    async getOverview() {
      const account = requireAccount();
      const clients = effectiveVisitClients(account); const appointments = appointmentsForAccount(account);
      clients.filter(client => client.status === 'amber' || client.status === 'red').forEach(client => {
        const eventType = client.status === 'red' ? 'client_visit_overdue' : 'client_visit_due_soon';
        const exists = readNotifications().some(item => item.eventType === eventType && item.entityId === client.id && item.representativeId === client.representativeId);
        if (!exists) appendNotification({ id: makeId('notification'), eventType, category: 'companyAnnouncements', title: client.status === 'red' ? 'Client visit overdue' : 'Client visit due soon', message: `${client.company}: ${client.daysRemaining < 0 ? Math.abs(client.daysRemaining) + ' days overdue' : client.daysRemaining + ' days remaining'}.`, entityType: 'client', entityId: client.id, reference: client.company, companyId: 'company-rhomberg', representativeId: client.representativeId, recipients: ['assigned_representative'], customerVisible: false, link: { entityType: 'client', entityId: client.id, reference: client.company, internalView: 'clients' }, createdAt: now().toISOString() });
      });
      return clone({ ...visitComplianceMetrics(clients, appointments, readVisitPolicy()), periodLabel: 'Current month', fabricated: true });
    },
    async listAppointments() { const account = requireAccount(); return clone(appointmentsForAccount(account)); },
    async schedule(clientId, input) {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.SCHEDULE_CLIENT_VISITS);
      const client = clientForAccount(account, clientId); const value = validateAppointment(input);
      const appointment = { id: makeId('appointment'), clientId, customer: client.company, representativeId: client.representativeId, branchId: client.branchId, address: value.address, customerContact: value.contact, scheduledAt: value.scheduledAt, expectedDurationMinutes: value.expectedDurationMinutes, purpose: String(value.purpose).trim(), notes: String(value.notes || '').trim(), agenda: String(value.agenda || '').trim(), reminder: Boolean(value.reminder), followUpRequired: Boolean(value.followUpRequired), status: 'scheduled', verificationStatus: 'unverified', createdAt: now().toISOString(), fabricated: true, immutableHistory: [{ action: 'appointment_created', at: now().toISOString(), actorId: account.id }] };
      writeClientAppointments([...readClientAppointments(), appointment]); visitAudit(account, 'appointment_created', appointment.id, { clientId, scheduledAt: appointment.scheduledAt }); return clone(appointment);
    },
    async start(appointmentId) {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VERIFY_CLIENT_VISITS);
      const records = readClientAppointments(); const index = records.findIndex(item => item.id === appointmentId && item.representativeId === account.representativeId);
      if (index < 0) throw new ServiceError('The appointment was not found in your visit list.', { code: 'VISIT_APPOINTMENT_NOT_FOUND', status: 404 });
      records[index] = { ...records[index], status: 'in_progress', startedAt: now().toISOString(), signals: { ...(records[index].signals || {}), appointmentExists: true, visitStarted: true }, immutableHistory: [...records[index].immutableHistory, { action: 'visit_started', at: now().toISOString(), actorId: account.id }] };
      writeClientAppointments(records); visitAudit(account, 'visit_started', appointmentId); return clone(records[index]);
    },
    async locationCheck(appointmentId, input = {}) {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VERIFY_CLIENT_VISITS);
      if (input.permissionStatus !== 'enabled') throw new ServiceError(input.permissionStatus === 'denied' ? 'Location permission was denied. Use customer QR confirmation as the privacy-safe fallback.' : 'Location is unavailable. Use customer QR confirmation as the fallback.', { code: input.permissionStatus === 'denied' ? 'LOCATION_PERMISSION_DENIED' : 'LOCATION_UNAVAILABLE', status: 422 });
      const records = readClientAppointments(); const index = records.findIndex(item => item.id === appointmentId && item.representativeId === account.representativeId);
      if (index < 0) throw new ServiceError('The appointment was not found.', { code: 'VISIT_APPOINTMENT_NOT_FOUND', status: 404 });
      const client = clientForAccount(account, records[index].clientId); const measuredDistance = distanceMetres(input, client); const matched = measuredDistance <= client.verificationRadiusMetres;
      records[index] = { ...records[index], signals: { ...(records[index].signals || {}), repGeofenceMatch: matched }, geofenceCheck: { measuredDistance: Math.round(measuredDistance), radiusMetres: client.verificationRadiusMetres, matched, permissionStatus: input.permissionStatus, checkedAt: now().toISOString(), fabricated: true }, immutableHistory: [...records[index].immutableHistory, { action: matched ? 'rep_location_confirmation' : 'verification_failed', at: now().toISOString(), actorId: account.id }] };
      writeClientAppointments(records); visitAudit(account, matched ? 'rep_location_confirmation' : 'verification_failed', appointmentId, { measuredDistance: Math.round(measuredDistance), matched }); return clone(records[index].geofenceCheck);
    },
    async customerConfirm(appointmentId) {
      const account = requireAccount(); const records = readClientAppointments(); const index = records.findIndex(item => item.id === appointmentId);
      if (index < 0) throw new ServiceError('The visit appointment was not found.', { code: 'VISIT_APPOINTMENT_NOT_FOUND', status: 404 });
      records[index] = { ...records[index], signals: { ...(records[index].signals || {}), customerConfirmation: true }, customerConfirmation: { confirmedAt: now().toISOString(), fabricated: true }, immutableHistory: [...records[index].immutableHistory, { action: 'customer_confirmation', at: now().toISOString(), actorId: account.id }] };
      writeClientAppointments(records); visitAudit(account, 'customer_confirmation', appointmentId); return clone(records[index]);
    },
    async createQr(appointmentId) {
      const account = requireAccount(); const appointment = readClientAppointments().find(item => item.id === appointmentId);
      if (!appointment) throw new ServiceError('The visit appointment was not found.', { code: 'VISIT_APPOINTMENT_NOT_FOUND', status: 404 });
      const token = { id: makeId('visit-qr'), token: `DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, appointmentId, clientId: appointment.clientId, expiresAt: new Date(now().getTime() + readVisitPolicy().qrLifetimeMinutes * 60000).toISOString(), usedAt: '', fabricated: true };
      writeVisitQrTokens([...readVisitQrTokens(), token]); visitAudit(account, 'qr_created', appointmentId, { tokenId: token.id, expiresAt: token.expiresAt }); return clone(token);
    },
    async verifyQr(appointmentId, tokenValue) {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VERIFY_CLIENT_VISITS); const tokens = readVisitQrTokens(); const tokenIndex = tokens.findIndex(item => item.appointmentId === appointmentId && item.token === tokenValue);
      if (tokenIndex < 0) throw new ServiceError('The customer QR confirmation is invalid.', { code: 'VISIT_QR_INVALID', status: 422 });
      if (tokens[tokenIndex].usedAt) throw new ServiceError('This customer QR confirmation has already been used.', { code: 'VISIT_QR_REUSED', status: 409 });
      if (new Date(tokens[tokenIndex].expiresAt).getTime() < now().getTime()) throw new ServiceError('The customer QR confirmation has expired.', { code: 'VISIT_QR_EXPIRED', status: 410 });
      tokens[tokenIndex] = { ...tokens[tokenIndex], usedAt: now().toISOString(), usedBy: account.id }; writeVisitQrTokens(tokens);
      const records = readClientAppointments(); const index = records.findIndex(item => item.id === appointmentId);
      records[index] = { ...records[index], signals: { ...(records[index].signals || {}), qrVerified: true }, immutableHistory: [...records[index].immutableHistory, { action: 'qr_verification', at: now().toISOString(), actorId: account.id }] }; writeClientAppointments(records); visitAudit(account, 'qr_verification', appointmentId, { tokenId: tokens[tokenIndex].id }); return clone(records[index]);
    },
    async complete(appointmentId, input = {}) {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VERIFY_CLIENT_VISITS); const records = readClientAppointments(); const index = records.findIndex(item => item.id === appointmentId && item.representativeId === account.representativeId);
      if (index < 0) throw new ServiceError('The appointment was not found.', { code: 'VISIT_APPOINTMENT_NOT_FOUND', status: 404 });
      const completedAt = now().toISOString(); const durationMinutes = Math.max(0, Math.round((new Date(completedAt) - new Date(records[index].startedAt)) / 60000));
      const signals = { ...(records[index].signals || {}), visitEnded: true, validDuration: durationMinutes >= 5 }; const verification = verificationStatus(signals);
      records[index] = { ...records[index], status: 'completed', completedAt, durationMinutes, signals, verificationStatus: verification.status, verificationScore: verification.score, completionNotes: String(input.notes || '').trim(), immutableHistory: [...records[index].immutableHistory, { action: 'visit_completed', at: completedAt, actorId: account.id }, ...(verification.status === 'verified' ? [{ action: 'visit_verified', at: completedAt, actorId: account.id }] : [])] };
      writeClientAppointments(records); writeClientVisits([...readClientVisits(), { id: makeId('visit'), appointmentId, clientId: records[index].clientId, representativeId: records[index].representativeId, startedAt: records[index].startedAt, completedAt, durationMinutes, verificationStatus: verification.status, signals, fabricated: true }]); visitAudit(account, verification.status === 'verified' ? 'visit_verified' : 'visit_completed', appointmentId, { verification }); return clone(records[index]);
    },
    async detectMissed() {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VIEW_VISIT_COMPLIANCE); const records = readClientAppointments(); let changed = 0;
      records.forEach((item, index) => { if (item.status === 'scheduled' && new Date(item.scheduledAt).getTime() + item.expectedDurationMinutes * 60000 < now().getTime()) { records[index] = { ...item, status: 'missed_visit', immutableHistory: [...item.immutableHistory, { action: 'visit_missed', at: now().toISOString(), actorId: account.id }] }; changed += 1; visitAudit(account, 'visit_missed', item.id); appendNotification({ id: makeId('notification'), eventType: 'client_visit_missed', category: 'companyAnnouncements', title: 'Missed client visit', message: `${item.customer}: the appointment passed without valid verification.`, entityType: 'client_visit', entityId: item.id, reference: item.customer, companyId: 'company-rhomberg', representativeId: item.representativeId, recipients: ['assigned_representative', USER_ROLES.SALES_MANAGER], customerVisible: false, link: { entityType: 'client_visit', entityId: item.id, reference: item.customer, internalView: 'clients' }, createdAt: now().toISOString() }); } });
      writeClientAppointments(records); return { changed, appointments: clone(appointmentsForAccount(account)) };
    },
    async submitMissedReason(appointmentId, input = {}) {
      const account = requireAccount(); const records = readClientAppointments(); const index = records.findIndex(item => item.id === appointmentId && (account.role !== USER_ROLES.SALES_REPRESENTATIVE || item.representativeId === account.representativeId));
      if (index < 0 || records[index].status !== 'missed_visit') throw new ServiceError('The missed appointment was not found.', { code: 'MISSED_VISIT_NOT_FOUND', status: 404 });
      if (String(input.reason || '').trim().length < 8) throw new ServiceError('Provide a clear reason for the missed visit.', { code: 'MISSED_VISIT_REASON_REQUIRED', status: 422 });
      records[index] = { ...records[index], missedReason: String(input.reason).trim(), internalNote: String(input.internalNote || '').trim(), rescheduledAt: input.rescheduledAt || '', immutableHistory: [...records[index].immutableHistory, { action: input.rescheduledAt ? 'visit_rescheduled' : 'missed_reason_submitted', at: now().toISOString(), actorId: account.id }] }; writeClientAppointments(records); visitAudit(account, input.rescheduledAt ? 'visit_rescheduled' : 'missed_reason_submitted', appointmentId); return clone(records[index]);
    },
    async getCompliance() {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VIEW_VISIT_COMPLIANCE);
      FABRICATED_REP_CLIENTS.filter(client => clientVisitHealth(client, readVisitPolicy(), now().getTime()).status === 'red').forEach(client => {
        const exists = readNotifications().some(item => item.eventType === 'client_visit_overdue_manager' && item.entityId === client.id);
        if (!exists) appendNotification({ id: makeId('notification'), eventType: 'client_visit_overdue_manager', category: 'companyAnnouncements', title: 'Overdue customer visit', message: `${client.company} is outside the configured visit cycle.`, entityType: 'client', entityId: client.id, reference: client.company, companyId: 'company-rhomberg', representativeId: client.representativeId, recipients: [USER_ROLES.SALES_MANAGER], customerVisible: false, link: { entityType: 'client', entityId: client.id, reference: client.company, internalView: 'clients' }, createdAt: now().toISOString() });
      });
      const representatives = [...new Set(FABRICATED_REP_CLIENTS.map(client => client.representativeId))];
      return clone(representatives.map(representativeId => { const clients = FABRICATED_REP_CLIENTS.filter(client => client.representativeId === representativeId); const appointments = readClientAppointments().filter(item => item.representativeId === representativeId); return { representativeId, representativeName: representativeId === 'C-27' ? 'Fabricated Representative A' : 'Fabricated Representative B', branchId: clients[0]?.branchId || '', ...visitComplianceMetrics(clients, appointments, readVisitPolicy()), averageDaysBetweenVisits: 29, averageVisitDurationMinutes: 54, officeHours: 18, clientVisitHours: 12, fieldHours: 9, unclassifiedHours: 3, fabricated: true }; }));
    },
    async getLocations() { const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.MANAGE_LOCATION_SETTINGS); return clone(readOfficeLocations()); },
    async saveLocation(input) {
      const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.MANAGE_LOCATION_SETTINGS); const radiusMetres = Number(input.radiusMetres);
      if (!input.branchId || !String(input.address || '').trim() || !Number.isFinite(Number(input.latitude)) || !Number.isFinite(Number(input.longitude)) || !Number.isFinite(radiusMetres) || radiusMetres < 25) throw new ServiceError('Branch, address, coordinates and a valid geofence radius are required.', { code: 'OFFICE_LOCATION_INVALID', status: 422 });
      const records = readOfficeLocations(); const index = records.findIndex(item => item.id === input.id); const record = { ...input, id: input.id || makeId('office'), latitude: Number(input.latitude), longitude: Number(input.longitude), radiusMetres, fabricated: true, updatedAt: now().toISOString() };
      if (index >= 0) records[index] = record; else records.push(record); writeOfficeLocations(records); visitAudit(account, index >= 0 ? 'office_location_changed' : 'office_location_created', record.id, { branchId: record.branchId }); return clone(record);
    },
    async getPolicy() { const account = requireAccount(); requireVisitPermission(account, account.role === USER_ROLES.ADMINISTRATOR ? PERMISSIONS.MANAGE_LOCATION_SETTINGS : PERMISSIONS.VIEW_VISIT_COMPLIANCE); return clone(readVisitPolicy()); },
    async savePolicy(input) { const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.MANAGE_LOCATION_SETTINGS); const policy = { ...readVisitPolicy(), ...input, defaultVisitCycleDays: Math.max(7, Number(input.defaultVisitCycleDays) || 30), advanceReminderDays: Math.max(1, Number(input.advanceReminderDays) || 7), routineLocationAnalyticsEnabled: false }; writeVisitPolicy(policy); visitAudit(account, 'visit_policy_changed', 'visit-policy', { policy }); return clone(policy); },
    async getOwnWorkSummary() { const account = requireAccount(); requireVisitPermission(account, PERMISSIONS.VIEW_OWN_WORK_LOCATION_SUMMARY); const office = readOfficeLocations().find(item => item.branchId === inferredBranchId(account)); return clone({ period: new Date().toISOString().slice(0, 7), officeHours: 18, clientVisitHours: 12, fieldHours: 9, unclassifiedHours: 3, locationUnavailableHours: 2, routineCollectionEnabled: false, workingHoursOnly: true, officeLocation: office?.branch || '', fabricated: true, precisionNotice: 'Location-derived statistics are approximate and must not be used alone for employment decisions.' }); },
    isWithinWorkingHours,
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
      if (kind !== 'profileImage') {
        throw new ServiceError('Customer-controlled application branding is disabled. Only a profile image may be uploaded.', { code: 'INVALID_IMAGE_KIND', status: 422, fieldErrors: { image: 'Choose a personal profile image.' } });
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

  const requireAdministrator = permission => {
    const account = requireAccount();
    if (!accountCan(account, PERMISSIONS.ADMINISTER_USERS)) {
      throw new ServiceError('Administrator access is required.', { code: 'FORBIDDEN', status: 403 });
    }
    if (permission && !accountCan(account, permission)) {
      throw new ServiceError('Your administrator account does not have this capability.', { code: 'FORBIDDEN', status: 403 });
    }
    return account;
  };

  const administrativeReason = value => {
    const reason = String(value || '').trim();
    if (reason.length < 8) throw new ServiceError('Enter a clear reason of at least 8 characters.', {
      code: 'ADMIN_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Enter at least 8 characters.' },
    });
    return reason;
  };

  const verifyHighRiskAdministration = (actor, verification) => {
    if (!verification || String(verification) !== String(actor.password || '')) {
      throw new ServiceError('Administrator verification failed. Enter the current mock administrator password.', {
        code: 'ADMIN_VERIFICATION_FAILED', status: 403, fieldErrors: { verification: 'Password confirmation is required.' },
      });
    }
  };

  const canAdministerCompany = (actor, companyId) => (
    companyId === 'company-rhomberg'
    || !Array.isArray(actor.authorisedCompanyIds)
    || !actor.authorisedCompanyIds.length
    || actor.authorisedCompanyIds.includes(companyId)
  );

  const administrationAudit = ({ actor, action, entityType, entityId, companyId = '', previousValue, newValue, reason, fieldsChanged }) => {
    const occurredAt = now().toISOString();
    appendAuditEvent({
      id: makeId('audit'),
      eventType: action.replace(/^administration\./, ''),
      action,
      outcome: 'success',
      entityType,
      entityId,
      companyId,
      actorId: actor.id,
      actorDisplayName: actor.contact,
      actorRole: actor.role,
      fieldsChanged,
      reason,
      previousValue: clone(previousValue),
      newValue: clone(newValue),
      details: { previousValue: clone(previousValue), newValue: clone(newValue) },
      immutable: true,
      createdAt: occurredAt,
    });
    return occurredAt;
  };

  const buildAdministrationOverview = actor => {
    const allAccountRecords = readAccounts();
    const accountRecords = allAccountRecords.filter(item => canAdministerCompany(actor, item.companyId));
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
          branchId: account.branchId || '',
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
        internalAccounts: accountRecords.filter(item => item.authRealm === 'internal').length,
        rfqs: workflowRecords.enquiries.length,
        orders: workflowRecords.orders.length,
        auditEvents: readAuditEvents().length,
        notifications: notificationRecords.length,
        documents: documentRecords.length,
      },
      users: accountRecords.map(item => ({
        ...toPublicAccount(item),
        category: item.authRealm === 'customer' ? 'customer' : 'internal',
        profileImageUrl: readUserProfileImages()[item.id]?.dataUrl || '',
        loginHistoryCount: readUserLoginHistory().filter(event => event.userId === item.id).length,
        notificationPreferences: notificationPreferencesForAccount(item),
      })),
      companies: [...companyMap.values()],
      representatives: representatives.map(item => ({
        id: item.id,
        name: item.name,
        branch: branches.find(branch => branch.id === item.branchId)?.name || item.branchCode,
        areas: item.areas || [],
      })),
      branches: branches.map(item => ({ id: item.id, name: item.name, role: item.role })),
      areas: [...areas],
      departments: [...INTERNAL_DEPARTMENTS],
      accountStatuses: [...ACCOUNT_STATUSES],
      authenticationTypes: [...AUTHENTICATION_TYPES],
      activationMethods: [...ACTIVATION_METHODS],
      roles: Object.values(USER_ROLES).map(role => ({
        id: role,
        label: role.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
        permissions: permissionsForRole(role),
      })),
      representativeAssignments: Object.values(assignments),
      catalogue: {
        categories: effectiveCategories().map(item => ({ id: item.id, number: item.number, name: item.name, short: item.short, description: item.description, status: item.status || 'active' })),
        products: effectiveProducts().map(item => ({ id: item.id, code: item.code, name: item.name, category: item.category, description: item.description, status: item.status || 'active' })),
      },
      archivedRecords: workflowRecords.orders
        .filter(item => item.retentionStatus === 'archived' && canAdministerCompany(actor, item.companyId))
        .map(item => ({ id: item.id, reference: item.reference, company: item.company, archivedAt: item.archivedAt, legalHold: Boolean(item.legalHold?.active) })),
      correctionRecords: [...workflowRecords.enquiries, ...workflowRecords.orders]
        .filter(item => canAdministerCompany(actor, item.companyId))
        .map(item => ({
          id: item.id, workflowType: item.workflowType, reference: item.reference, companyId: item.companyId, company: item.company,
          contact: item.contact, internalJobNumber: item.internalJobNumber || item.planning?.internalJobNumber || '',
          salesOrderNumber: item.salesOrderNumber || item.planning?.salesOrderNumber || '',
          customerPoNumber: item.customerPoNumber || item.poNumber || item.planning?.customerPoNumber || '',
          items: clone(item.items || []),
          trackingStatus: item.trackingStatus, version: item.version,
        })),
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
      const actor = requireAdministrator();
      return clone(buildAdministrationOverview(actor));
    },

    async createEmployee(input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_INTERNAL_ACCOUNTS);
      const reason = administrativeReason(input.reason);
      const { value, fieldErrors, valid } = validateEmployeeInput(input.values || {}, { branchIds: branches.map(branch => branch.id) });
      if (!valid) throw new ServiceError(Object.values(fieldErrors)[0], { code: 'EMPLOYEE_INVALID', status: 422, fieldErrors });
      const accountRecords = readAccounts();
      if (accountRecords.some(item => value.email && String(item.email || '').toLowerCase() === value.email || value.username && String(item.signInName || '').toLowerCase() === value.username)) {
        throw new ServiceError('That work email address or username is already in use.', { code: 'ACCOUNT_IDENTITY_CONFLICT', status: 409 });
      }
      const id = makeId('staff');
      const temporaryPassword = value.activationMethod === 'administrator_temporary_password' ? generateTemporaryPassword() : '';
      const createdAt = now().toISOString();
      const account = normaliseAccount({
        id,
        companyId: 'company-rhomberg',
        company: 'Rhomberg Instruments',
        contact: value.displayName,
        firstName: value.firstName,
        surname: value.surname,
        email: value.email,
        signInName: value.username,
        phone: '',
        area: branches.find(branch => branch.id === value.branchId)?.name || '',
        branchId: value.branchId,
        department: value.department,
        role: value.roles[0],
        roles: value.roles,
        authRealm: 'internal',
        authenticationType: value.authenticationType,
        activationMethod: value.activationMethod,
        status: 'pending_activation',
        forcePasswordChange: Boolean(temporaryPassword),
        firstLoginCompleted: false,
        passwordHash: temporaryPassword ? await hashMockCredential(id, temporaryPassword) : '',
        createdAt,
        createdBy: actor.id,
      });
      writeAccounts([...accountRecords, account]);
      administrationAudit({
        actor,
        action: 'administration.user_created',
        entityType: 'user',
        entityId: id,
        companyId: account.companyId,
        previousValue: null,
        newValue: { ...toPublicAccount(account), credentialPrepared: Boolean(temporaryPassword) },
        fieldsChanged: ['identity', 'branchId', 'department', 'roles', 'status', 'authenticationType'],
        reason,
      });
      return { account: toPublicAccount(account), temporaryPassword: temporaryPassword || undefined, displayOnce: Boolean(temporaryPassword) };
    },

    async assignAccountRoles(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_ROLES_PERMISSIONS);
      const reason = administrativeReason(input.reason);
      verifyHighRiskAdministration(actor, input.verification);
      if (accountId === actor.id) throw new ServiceError('A second authorised administrator must change your roles.', { code: 'SELF_ROLE_CHANGE_BLOCKED', status: 409 });
      const requested = [...new Set(Array.isArray(input.roles) ? input.roles : [])];
      if (!requested.length || requested.some(role => !Object.values(USER_ROLES).includes(role) || role === USER_ROLES.CUSTOMER)) throw new ServiceError('Choose at least one valid internal role.', { code: 'ACCOUNT_ROLE_INVALID', status: 422 });
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId && item.authRealm === 'internal');
      if (index < 0) throw new ServiceError('The internal account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const current = accountRecords[index];
      const previousValue = { roles: current.roles || [current.role] };
      accountRecords[index] = { ...current, role: requested[0], roles: requested, labRoles: requested.filter(role => role.startsWith('laboratory_')), permissions: undefined, updatedAt: now().toISOString() };
      writeAccounts(accountRecords);
      administrationAudit({ actor, action: 'administration.user_roles_changed', entityType: 'user', entityId: accountId, companyId: current.companyId, previousValue, newValue: { roles: requested }, fieldsChanged: ['roles'], reason });
      return toPublicAccount(accountRecords[index]);
    },

    async assignAccountBranch(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_INTERNAL_ACCOUNTS);
      const reason = administrativeReason(input.reason);
      const branchId = String(input.branchId || '');
      const effectiveDate = String(input.effectiveDate || '');
      if (!branches.some(branch => branch.id === branchId)) throw new ServiceError('Choose a valid branch.', { code: 'ACCOUNT_BRANCH_INVALID', status: 422 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new ServiceError('Choose the branch-change effective date.', { code: 'EFFECTIVE_DATE_REQUIRED', status: 422 });
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId && item.authRealm === 'internal');
      if (index < 0) throw new ServiceError('The internal account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const current = accountRecords[index];
      const branch = branches.find(item => item.id === branchId);
      const activeResponsibilities = current.representativeId ? readAllRecords().filter(record => record.representativeId === current.representativeId && !['completed', 'cancelled', 'archived'].includes(record.trackingStatus)).map(record => record.reference) : [];
      accountRecords[index] = { ...current, branchId, area: branch.name, updatedAt: now().toISOString() };
      writeAccounts(accountRecords);
      administrationAudit({ actor, action: 'administration.user_branch_changed', entityType: 'user', entityId: accountId, companyId: current.companyId, previousValue: { branchId: current.branchId || '' }, newValue: { branchId, effectiveDate, activeResponsibilities }, fieldsChanged: ['branchId'], reason });
      return { account: toPublicAccount(accountRecords[index]), activeResponsibilities };
    },

    async resetUserLogin(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.RESET_USER_LOGIN);
      const reason = administrativeReason(input.reason);
      verifyHighRiskAdministration(actor, input.verification);
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId && item.authRealm === 'internal' && item.status !== 'archived');
      if (index < 0) throw new ServiceError('The active internal account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const temporaryPassword = generateTemporaryPassword();
      const current = accountRecords[index];
      accountRecords[index] = { ...current, password: undefined, passwordHash: await hashMockCredential(current.id, temporaryPassword), forcePasswordChange: true, status: 'pending_activation', updatedAt: now().toISOString() };
      writeAccounts(accountRecords);
      administrationAudit({ actor, action: 'administration.password_reset_requested', entityType: 'user', entityId: accountId, companyId: current.companyId, previousValue: { status: current.status, credentialVersion: current.credentialVersion || 0 }, newValue: { status: 'pending_activation', credentialVersion: (current.credentialVersion || 0) + 1 }, fieldsChanged: ['credential', 'status'], reason });
      return { account: toPublicAccount(accountRecords[index]), temporaryPassword, displayOnce: true };
    },

    async archiveEmployee(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_INTERNAL_ACCOUNTS);
      const reason = administrativeReason(input.reason);
      verifyHighRiskAdministration(actor, input.verification);
      if (accountId === actor.id) throw new ServiceError('You cannot archive the administrator account currently in use.', { code: 'ACTIVE_ADMIN_ARCHIVE_BLOCKED', status: 409 });
      const lastWorkingDate = String(input.lastWorkingDate || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWorkingDate)) throw new ServiceError('Choose the employee last working date.', { code: 'LAST_WORKING_DATE_REQUIRED', status: 422 });
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId && item.authRealm === 'internal');
      if (index < 0) throw new ServiceError('The internal account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const current = accountRecords[index];
      const responsibilities = current.representativeId ? readAllRecords().filter(record => record.representativeId === current.representativeId && !['completed', 'cancelled', 'archived'].includes(record.trackingStatus)).map(record => record.reference) : [];
      if (responsibilities.length && !String(input.replacementEmployeeId || '').trim()) throw new ServiceError('Choose a replacement employee before archiving an account with active responsibilities.', { code: 'REPLACEMENT_REQUIRED', status: 422, details: { responsibilities } });
      accountRecords[index] = { ...current, status: 'archived', archivedAt: now().toISOString(), lastWorkingDate, futureNotificationsDisabled: true, updatedAt: now().toISOString() };
      writeAccounts(accountRecords);
      administrationAudit({ actor, action: 'administration.user_archived', entityType: 'user', entityId: accountId, companyId: current.companyId, previousValue: { status: current.status }, newValue: { status: 'archived', lastWorkingDate, replacementEmployeeId: input.replacementEmployeeId || '', responsibilities }, fieldsChanged: ['status', 'archivedAt'], reason });
      return toPublicAccount(accountRecords[index]);
    },

    async uploadEmployeeProfileImage(accountId, file, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_USER_PROFILE_IMAGES);
      const reason = administrativeReason(input.reason);
      const validation = validateEmployeeProfileImage(file);
      if (!validation.valid) throw new ServiceError(validation.error, { code: 'PROFILE_IMAGE_INVALID', status: 422 });
      const target = readAccounts().find(item => item.id === accountId && item.authRealm === 'internal');
      if (!target) throw new ServiceError('The internal account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const images = readUserProfileImages();
      const previousValue = images[accountId] ? { name: images[accountId].name, type: images[accountId].type, size: images[accountId].size } : null;
      const image = { id: makeId('profile'), name: file.name, type: file.type, size: file.size, dataUrl: await fileToDataUrl(file), uploadedAt: now().toISOString() };
      images[accountId] = image;
      writeUserProfileImages(images);
      administrationAudit({ actor, action: 'administration.user_profile_image_changed', entityType: 'user_profile_image', entityId: accountId, companyId: target.companyId, previousValue, newValue: { id: image.id, name: image.name, type: image.type, size: image.size }, fieldsChanged: ['profileImage'], reason });
      return { ...image, dataUrl: undefined, previewUrl: image.dataUrl };
    },

    async getUserAudit(accountId) {
      const actor = requireAdministrator(PERMISSIONS.READ_AUDIT_HISTORY);
      if (!readAccounts().some(item => item.id === accountId && canAdministerCompany(actor, item.companyId))) throw new ServiceError('The account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      return readAuditEvents().filter(event => event.entityId === accountId && (event.entityType === 'user' || event.entityType === 'user_profile_image')).map(presentAuditEvent);
    },

    async getUserLoginHistory(accountId) {
      const actor = requireAdministrator(PERMISSIONS.VIEW_LOGIN_HISTORY);
      if (!readAccounts().some(item => item.id === accountId && canAdministerCompany(actor, item.companyId))) throw new ServiceError('The account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      return clone(readUserLoginHistory().filter(event => event.userId === accountId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    },

    async setAccountStatus(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.ADMINISTER_USERS);
      const status = String(input.status || '');
      const reason = administrativeReason(input.reason);
      if (!ACCOUNT_STATUSES.includes(status)) {
        throw new ServiceError('Choose a valid account status.', {
          code: 'ACCOUNT_STATUS_INVALID',
          status: 422,
          fieldErrors: { status: 'Choose a valid account status.' },
        });
      }
      if (accountId === actor.id && ['suspended', 'disabled', 'archived'].includes(status)) {
        throw new ServiceError('You cannot suspend the administrator account currently in use.', {
          code: 'ACTIVE_ADMIN_SUSPENSION_BLOCKED',
          status: 409,
        });
      }
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId);
      if (index < 0) throw new ServiceError('The account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      if (!canAdministerCompany(actor, accountRecords[index].companyId)) throw new ServiceError('The account is outside your authorised company scope.', { code: 'FORBIDDEN', status: 403 });
      const permission = accountRecords[index].role === USER_ROLES.CUSTOMER ? PERMISSIONS.MANAGE_CUSTOMER_CONTACTS : PERMISSIONS.MANAGE_INTERNAL_ACCOUNTS;
      if (!accountCan(actor, permission)) throw new ServiceError('Your administrator account cannot change this account realm.', { code: 'FORBIDDEN', status: 403 });
      if (['suspended', 'disabled', 'archived'].includes(status)) verifyHighRiskAdministration(actor, input.verification);
      const previousValue = { status: accountRecords[index].status };
      const occurredAt = now().toISOString();
      accountRecords[index] = { ...accountRecords[index], status, updatedAt: occurredAt };
      writeAccounts(accountRecords);
      administrationAudit({
        actor,
        action: 'administration.account_status_changed',
        entityType: 'user',
        entityId: accountId,
        companyId: accountRecords[index].companyId,
        previousValue,
        newValue: { status },
        fieldsChanged: ['status'],
        reason,
      });
      return toPublicAccount(accountRecords[index]);
    },

    async assignRepresentative(companyId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_CUSTOMER_COMPANIES);
      const representativeId = String(input.representativeId || '');
      const reason = administrativeReason(input.reason);
      const company = buildAdministrationOverview(actor).companies.find(item => item.id === companyId);
      const representative = representativeById(representativeId);
      if (!company) throw new ServiceError('The customer company was not found.', { code: 'COMPANY_NOT_FOUND', status: 404 });
      if (!representative) throw new ServiceError('Choose a valid representative.', {
        code: 'REPRESENTATIVE_NOT_FOUND',
        status: 422,
        fieldErrors: { representativeId: 'Choose a valid representative.' },
      });
      const occurredAt = now().toISOString();
      const assignments = readCustomerRepresentativeAssignments();
      const previousValue = clone(assignments[companyId] || { representativeId: company.representativeId || '' });
      assignments[companyId] = {
        companyId,
        representativeId,
        assignedAt: occurredAt,
        assignedBy: actor.id,
        source: 'administrator',
      };
      writeCustomerRepresentativeAssignments(assignments);
      administrationAudit({
        actor,
        action: 'administration.company_representative_assigned',
        entityType: 'company',
        entityId: companyId,
        companyId,
        previousValue,
        newValue: clone(assignments[companyId]),
        fieldsChanged: ['representativeId'],
        reason,
      });
      return clone(assignments[companyId]);
    },

    async updateCompany(companyId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_CUSTOMER_COMPANIES);
      if (!canAdministerCompany(actor, companyId)) throw new ServiceError('The company is outside your authorised scope.', { code: 'FORBIDDEN', status: 403 });
      const reason = administrativeReason(input.reason);
      const accountRecords = readAccounts();
      const indexes = accountRecords.map((item, index) => ({ item, index })).filter(entry => entry.item.companyId === companyId && entry.item.role === USER_ROLES.CUSTOMER);
      if (!indexes.length) throw new ServiceError('The customer company was not found.', { code: 'COMPANY_NOT_FOUND', status: 404 });
      const values = input.values || {};
      const name = String(values.name || '').trim();
      const area = String(values.area || '').trim();
      const industry = String(values.industry || '').trim();
      const branchId = String(values.branchId || '').trim();
      if (name.length < 2 || !areas.includes(area) || !branches.some(branch => branch.id === branchId)) {
        throw new ServiceError('Check the company name, area and branch.', { code: 'COMPANY_UPDATE_INVALID', status: 422 });
      }
      const previousValue = { name: indexes[0].item.company, area: indexes[0].item.area, industry: indexes[0].item.industry, branchId: indexes[0].item.branchId || '' };
      const occurredAt = now().toISOString();
      for (const entry of indexes) accountRecords[entry.index] = { ...entry.item, company: name, area, industry, branchId, updatedAt: occurredAt };
      writeAccounts(accountRecords);
      const newValue = { name, area, industry, branchId };
      administrationAudit({ actor, action: 'administration.company_updated', entityType: 'company', entityId: companyId, companyId, previousValue, newValue, fieldsChanged: Object.keys(newValue).filter(key => newValue[key] !== previousValue[key]), reason });
      return clone(newValue);
    },

    async updateAccount(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.ADMINISTER_USERS);
      const reason = administrativeReason(input.reason);
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId);
      if (index < 0) throw new ServiceError('The account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const current = accountRecords[index];
      if (!canAdministerCompany(actor, current.companyId)) throw new ServiceError('The account is outside your authorised company scope.', { code: 'FORBIDDEN', status: 403 });
      const customerRealm = current.role === USER_ROLES.CUSTOMER;
      const requiredPermission = customerRealm ? PERMISSIONS.MANAGE_CUSTOMER_CONTACTS : PERMISSIONS.MANAGE_INTERNAL_ACCOUNTS;
      if (!accountCan(actor, requiredPermission)) throw new ServiceError('Your administrator account cannot edit this account realm.', { code: 'FORBIDDEN', status: 403 });
      const values = input.values || {};
      const next = {
        ...current,
        contact: String(values.contact ?? current.contact).trim(),
        email: String(values.email ?? current.email).trim().toLowerCase(),
        signInName: String(values.signInName ?? current.signInName ?? '').trim(),
        phone: String(values.phone ?? current.phone ?? '').trim(),
        area: String(values.area ?? current.area ?? '').trim(),
        branchId: String(values.branchId ?? current.branchId ?? '').trim(),
      };
      if (next.contact.length < 2 || next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email) || !next.email && !next.signInName) throw new ServiceError('Enter a valid name and either a work email or username.', { code: 'ACCOUNT_UPDATE_INVALID', status: 422 });
      if (next.branchId && !branches.some(branch => branch.id === next.branchId)) throw new ServiceError('Choose a valid branch.', { code: 'ACCOUNT_BRANCH_INVALID', status: 422 });
      if (accountRecords.some(item => item.id !== accountId && (item.email.toLowerCase() === next.email || next.signInName && item.signInName?.toLowerCase() === next.signInName.toLowerCase()))) {
        throw new ServiceError('That email address or username is already in use.', { code: 'ACCOUNT_IDENTITY_CONFLICT', status: 409 });
      }
      if (!customerRealm && values.role && values.role !== current.role) throw new ServiceError('Use the audited role-assignment action to change employee roles.', { code: 'ROLE_CHANGE_ACTION_REQUIRED', status: 409 });
      if (!customerRealm && values.department !== undefined) {
        if (!INTERNAL_DEPARTMENTS.includes(values.department)) throw new ServiceError('Choose a valid department.', { code: 'ACCOUNT_DEPARTMENT_INVALID', status: 422 });
        next.department = values.department;
      }
      const editableFields = ['contact', 'email', 'signInName', 'phone', 'area', 'branchId', 'department'];
      const previousValue = Object.fromEntries(editableFields.map(key => [key, current[key] || '']));
      const newValue = Object.fromEntries(editableFields.map(key => [key, next[key] || '']));
      const fieldsChanged = editableFields.filter(key => previousValue[key] !== newValue[key]);
      if (!fieldsChanged.length) throw new ServiceError('No account changes were supplied.', { code: 'NO_CHANGES', status: 422 });
      next.updatedAt = now().toISOString();
      accountRecords[index] = next;
      writeAccounts(accountRecords);
      administrationAudit({ actor, action: 'administration.account_updated', entityType: 'user', entityId: accountId, companyId: next.companyId, previousValue, newValue, fieldsChanged, reason });
      return toPublicAccount(next);
    },

    async setAccountPermissions(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_ROLES_PERMISSIONS);
      const reason = administrativeReason(input.reason);
      verifyHighRiskAdministration(actor, input.verification);
      if (accountId === actor.id) throw new ServiceError('Use a second authorised administrator to change your own permissions.', { code: 'SELF_PERMISSION_CHANGE_BLOCKED', status: 409 });
      const accountRecords = readAccounts();
      const index = accountRecords.findIndex(item => item.id === accountId && item.role !== USER_ROLES.CUSTOMER);
      if (index < 0) throw new ServiceError('The internal account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const requested = [...new Set(Array.isArray(input.permissions) ? input.permissions : [])];
      if (requested.some(permission => !Object.values(PERMISSIONS).includes(permission))) throw new ServiceError('One or more permissions are invalid.', { code: 'PERMISSION_INVALID', status: 422 });
      const required = [PERMISSIONS.ACCESS_INTERNAL_WORKSPACE];
      const nextPermissions = [...new Set([...required, ...requested])];
      const previousValue = { permissions: toPublicAccount(accountRecords[index]).permissions };
      accountRecords[index] = { ...accountRecords[index], permissions: nextPermissions, updatedAt: now().toISOString() };
      writeAccounts(accountRecords);
      administrationAudit({ actor, action: 'administration.account_permissions_changed', entityType: 'user', entityId: accountId, companyId: accountRecords[index].companyId, previousValue, newValue: { permissions: nextPermissions }, fieldsChanged: ['permissions'], reason });
      return toPublicAccount(accountRecords[index]);
    },

    async updateNotificationPreferences(accountId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_NOTIFICATION_PREFERENCES);
      const reason = administrativeReason(input.reason);
      const target = readAccounts().find(item => item.id === accountId && canAdministerCompany(actor, item.companyId));
      if (!target) throw new ServiceError('The account was not found.', { code: 'ACCOUNT_NOT_FOUND', status: 404 });
      const records = readNotificationPreferenceRecords();
      const previousValue = notificationPreferencesForAccount(target);
      const next = normaliseNotificationPreferences({ ...input.preferences, updatedAt: now().toISOString() });
      records[accountId] = next;
      writeNotificationPreferenceRecords(records);
      administrationAudit({ actor, action: 'administration.notification_preferences_changed', entityType: 'user_preference', entityId: accountId, companyId: target.companyId, previousValue, newValue: next, fieldsChanged: ['channels', 'categories'], reason });
      return clone(next);
    },

    async saveCatalogueItem(kind, itemId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.MANAGE_PRODUCTS);
      const reason = administrativeReason(input.reason);
      if (!['category', 'product'].includes(kind)) throw new ServiceError('Choose a catalogue category or product.', { code: 'CATALOGUE_KIND_INVALID', status: 422 });
      const collection = kind === 'category' ? effectiveCategories() : effectiveProducts();
      const current = collection.find(item => item.id === itemId);
      if (!current) throw new ServiceError('The catalogue item was not found.', { code: 'CATALOGUE_ITEM_NOT_FOUND', status: 404 });
      const allowedFields = kind === 'category' ? ['name', 'short', 'description', 'status'] : ['code', 'name', 'category', 'description', 'status'];
      const values = Object.fromEntries(allowedFields.map(key => [key, String(input.values?.[key] ?? current[key] ?? '').trim()]));
      if (values.name.length < 2 || values.description.length < 5 || !['active', 'inactive'].includes(values.status)) throw new ServiceError('Check the catalogue name, description and status.', { code: 'CATALOGUE_ITEM_INVALID', status: 422 });
      if (kind === 'product' && !effectiveCategories().some(category => category.id === values.category)) throw new ServiceError('Choose a valid product category.', { code: 'PRODUCT_CATEGORY_INVALID', status: 422 });
      const overrides = readAdministrationCatalogueOverrides();
      const bucket = kind === 'category' ? 'categories' : 'products';
      overrides[bucket] = { ...(overrides[bucket] || {}), [itemId]: values };
      writeAdministrationCatalogueOverrides(overrides);
      const previousValue = Object.fromEntries(allowedFields.map(key => [key, current[key] || '']));
      administrationAudit({ actor, action: `administration.catalogue_${kind}_updated`, entityType: `catalogue_${kind}`, entityId: itemId, companyId: actor.companyId, previousValue, newValue: values, fieldsChanged: allowedFields.filter(key => previousValue[key] !== values[key]), reason });
      return clone({ ...current, ...values });
    },

    async correctRecord(recordId, input = {}) {
      const actor = requireAdministrator(PERMISSIONS.CORRECT_APPROVED_RECORDS);
      const reason = administrativeReason(input.reason);
      verifyHighRiskAdministration(actor, input.verification);
      const state = readWorkflowState();
      const located = locateWorkflowRecord(state, recordId);
      if (!located || !canAdministerCompany(actor, located.record.companyId)) throw new ServiceError('The RFQ or order was not found in your authorised scope.', { code: 'WORKFLOW_RECORD_NOT_FOUND', status: 404 });
      if (Number(input.expectedVersion) !== Number(located.record.version)) throw new ServiceError('This record changed. Refresh before applying the correction.', { code: 'VERSION_CONFLICT', status: 409 });
      const forbidden = ['trackingStatus', 'trackingHistory', 'quotation', 'quotationHistory', 'certificates', 'laboratory', 'audit', 'internalNotes'];
      if (forbidden.some(key => Object.hasOwn(input.values || {}, key))) throw new ServiceError('Signed certificates, workflow state, quotation history and audit data cannot be corrected here.', { code: 'IMMUTABLE_FIELD', status: 409 });
      const allowed = located.entityType === 'order' ? ['contact', 'internalJobNumber', 'salesOrderNumber', 'customerPoNumber'] : ['contact'];
      const supplied = Object.keys(input.values || {});
      if (!supplied.length || supplied.some(key => !allowed.includes(key))) throw new ServiceError('Only approved reference and contact fields may be corrected.', { code: 'CORRECTION_FIELD_INVALID', status: 422 });
      const previousValue = Object.fromEntries(supplied.map(key => [key, located.record[key] || '']));
      const newValue = Object.fromEntries(supplied.map(key => [key, String(input.values[key] || '').trim()]));
      if (Object.values(newValue).some(value => value.length < 2)) throw new ServiceError('Corrected values must be meaningful.', { code: 'CORRECTION_VALUE_INVALID', status: 422 });
      const updated = { ...located.record, ...newValue, version: Number(located.record.version) + 1, updatedAt: now().toISOString() };
      located.collection[located.index] = updated;
      writeWorkflowState(state);
      administrationAudit({ actor, action: 'administration.approved_record_corrected', entityType: located.entityType, entityId: updated.id, companyId: updated.companyId, previousValue, newValue, fieldsChanged: supplied, reason });
      return clone(presentRecord(actor, updated));
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
        STORE_KEYS.administrationCatalogueOverrides,
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
      return clone(buildAdministrationOverview(actor));
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

  const technicalOptions = () => ({
    categories: TECHNICAL_SUPPORT_CATEGORIES.map(id => ({ id, label: id.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()) })),
    priorities: TECHNICAL_SUPPORT_PRIORITIES,
    classifications: TECHNICAL_MESSAGE_CLASSIFICATIONS,
    informationTargets: TECHNICAL_INFORMATION_TARGETS,
    statuses: TECHNICAL_SUPPORT_STATUSES,
    technicalUsers: readAccounts()
      .filter(candidate => accountCan(candidate, PERMISSIONS.VIEW_TECHNICAL_QUEUE))
      .map(candidate => ({ id: candidate.id, name: candidate.contact, role: candidate.role })),
  });

  const technicalAttachmentMetadata = (file, actor, customerVisible = false) => file ? ({
    id: makeId('technical-document'),
    documentType: 'technical_support_attachment',
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: Number(file.size),
    version: 1,
    isCurrentVersion: true,
    customerVisible,
    storageStatus: 'mock_metadata_only',
    uploadedBy: actor,
    uploadedAt: now().toISOString(),
  }) : null;

  const locateTechnicalRfq = requestIdOrRfqId => {
    const rfq = readAllEnquiries().find(candidate => (
      candidate.id === requestIdOrRfqId
      || candidate.technicalSupport?.id === requestIdOrRfqId
      || candidate.technicalSupport?.reference === requestIdOrRfqId
    ));
    if (!rfq?.technicalSupport && rfq?.id !== requestIdOrRfqId) return null;
    return rfq || null;
  };

  const assertTechnicalRecordAccess = (account, rfq) => {
    if (!rfq || !canReadRecord(account, rfq)) {
      throw new ServiceError('The Technical Support request was not found or is outside your authorised scope.', { code: 'TECHNICAL_SUPPORT_NOT_FOUND', status: 404 });
    }
  };

  const assertAssignedTechnicalUser = (account, request) => {
    if (
      accountCan(account, PERMISSIONS.ASSIGN_TECHNICAL_SUPPORT)
      || accountCan(account, PERMISSIONS.VIEW_ALL_RFQS)
      || request.assignedTechnicalUser?.id === account.id
    ) return;
    throw new ServiceError('This Technical Support request is assigned to another technical user.', { code: 'TECHNICAL_SUPPORT_NOT_ASSIGNED', status: 403 });
  };

  const addTechnicalAudit = ({ rfq, action, actor, previousStatus = '', newStatus = '', messageType = '', attachments = [], reason = '', overrideReason = '' }) => {
    const request = rfq.technicalSupport;
    const occurredAt = now().toISOString();
    appendAuditEvent({
      id: makeId('audit'), eventType: action, action: `technical_support.${action}`, outcome: 'success',
      entityType: 'rfq', entityId: rfq.id, companyId: rfq.companyId, companyName: rfq.company,
      reference: rfq.reference, technicalRequestId: request?.id || '', technicalRequestReference: request?.reference || '',
      representativeId: rfq.representativeId || rfq.selectedRep?.id || '', technicalUserId: request?.assignedTechnicalUser?.id || '',
      actorId: actor.id, actorRole: actor.role, actorDisplayName: actor.displayName,
      previousStatus, newStatus, fromStatus: previousStatus, toStatus: newStatus,
      messageType, documentMetadata: attachments, originalDueDate: request?.originalQuotationTargetAt || '',
      revisedDueDate: request?.revisedQuotationTargetAt || '', reason, overrideReason,
      requestId: request?.id || makeId('technical-request'), correlationId: request?.correlationId || request?.id || '',
      immutable: true, createdAt: occurredAt,
    });
  };

  const addTechnicalTimeline = (rfq, { action, note, customerVisible = false, previousStatus = '', newStatus = '', actor }) => ({
    ...rfq,
    trackingHistory: [...(rfq.trackingHistory || []), {
      id: makeId('event'), entityType: 'rfq', action: `technical_support.${action}`,
      fromStatus: previousStatus || rfq.trackingStatus, toStatus: newStatus || rfq.trackingStatus,
      status: rfq.trackingStatus, label: note, note, customerDescription: customerVisible ? note : '',
      actor: customerVisible && actor.role !== USER_ROLES.CUSTOMER ? 'Rhomberg Instruments' : actor.displayName,
      actorRole: actor.role, customerVisible, createdAt: now().toISOString(),
    }],
  });

  const technicalMessage = (input, account, { customer = false } = {}) => {
    const validated = validateTechnicalMessage(input, { customer });
    const actor = createWorkflowActor(account);
    const attachment = technicalAttachmentMetadata(validated.attachment, actor, validated.classification === 'customer_safe');
    return {
      id: makeId('technical-message'), message: validated.message, classification: validated.classification,
      senderId: account.id, senderName: account.contact || account.company, senderRole: account.role,
      attachments: attachment ? [attachment] : [], readBy: [account.id], createdAt: now().toISOString(),
    };
  };

  const technicalSupport = {
    async getOptions() {
      requireAccount();
      return clone(technicalOptions());
    },

    async getByRfq(rfqId) {
      const account = requireAccount();
      const rfq = readAllEnquiries().find(candidate => candidate.id === rfqId);
      assertTechnicalRecordAccess(account, rfq);
      if (!rfq.technicalSupport) return null;
      return clone(presentRecord(account, rfq).technicalSupport);
    },

    async listQueue({ query = '', status = '', priority = '', sort = 'oldest' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_TECHNICAL_QUEUE) && !accountCan(account, PERMISSIONS.VIEW_TECHNICAL_METRICS)) {
        throw new ServiceError('Your role cannot access the Technical Support queue.', { code: 'FORBIDDEN', status: 403 });
      }
      const term = String(query || '').trim().toLowerCase();
      const records = readAllEnquiries().filter(rfq => rfq.technicalSupport && canReadRecord(account, rfq)).filter(rfq => {
        const request = rfq.technicalSupport;
        return (!status || request.status === status)
          && (!priority || request.priority === priority)
          && (!term || `${rfq.reference} ${rfq.company} ${rfq.contact} ${rfq.selectedRep?.name || ''} ${request.category} ${request.question}`.toLowerCase().includes(term));
      });
      for (const rfq of records.filter(item => isTechnicalSupportActive(item.technicalSupport))) {
        const hoursRemaining = (new Date(rfq.technicalSupport.revisedQuotationTargetAt) - now()) / 36e5;
        const eventType = hoursRemaining <= 0 ? 'technical_request_overdue' : hoursRemaining <= 24 ? 'technical_approaching_due' : '';
        if (eventType && !readNotifications().some(notification => notification.entityId === rfq.id && notification.eventType === eventType)) {
          publishWorkflowNotifications({ action: eventType === 'technical_request_overdue' ? 'technical_support_overdue' : 'technical_support_approaching_due', record: rfq, actor: { id: 'technical-deadline-service', role: SYSTEM_ACTOR_ROLE, displayName: 'Technical deadline service' } });
        }
      }
      records.sort((left, right) => (sort === 'newest' ? -1 : 1) * (new Date(left.technicalSupport.requestedAt) - new Date(right.technicalSupport.requestedAt)));
      return clone(records.map(rfq => presentRecord(account, rfq)));
    },

    async request(rfqId, input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.REQUEST_TECHNICAL_SUPPORT)) throw new ServiceError('Your role cannot request Technical Support.', { code: 'FORBIDDEN', status: 403 });
      const rfq = readAllEnquiries().find(candidate => candidate.id === rfqId);
      assertTechnicalRecordAccess(account, rfq);
      const assignedRepresentativeId = rfq.representativeId || rfq.selectedRep?.id || '';
      if (!accountCan(account, PERMISSIONS.VIEW_ALL_RFQS) && assignedRepresentativeId !== account.representativeId) {
        throw new ServiceError('Only the assigned representative may request Technical Support for this RFQ.', { code: 'RFQ_NOT_ASSIGNED', status: 403 });
      }
      if (isTechnicalSupportActive(rfq.technicalSupport)) throw new ServiceError('An active Technical Support request already exists for this RFQ.', { code: 'TECHNICAL_SUPPORT_ALREADY_ACTIVE', status: 409 });
      if (!['assigned_to_rep', 'under_rep_review'].includes(rfq.trackingStatus)) throw new ServiceError('Technical Support can be requested only after the RFQ reaches the representative.', { code: 'TECHNICAL_SUPPORT_STAGE_INVALID', status: 409 });
      const validated = validateTechnicalSupportRequest(input, rfq);
      const actor = createWorkflowActor(account);
      const occurredAt = now().toISOString();
      const originalQuotationTargetAt = rfq.quotationTargetAt || addHours(rfq.submittedAt || rfq.createdAt || occurredAt, 72);
      const revisedQuotationTargetAt = addHours(originalQuotationTargetAt, TECHNICAL_SUPPORT_ALLOWANCE_HOURS);
      const attachment = technicalAttachmentMetadata(validated.attachment, actor, validated.classification === 'customer_safe');
      const existingTechnicalRequestCount = readAllEnquiries().reduce((total, item) => total + (item.technicalSupport ? 1 : 0) + (item.technicalSupportHistory || []).length, 0);
      const request = {
        id: makeId('technical-request'), reference: `TS-PREVIEW-${String(existingTechnicalRequestCount + 1).padStart(4, '0')}`,
        correlationId: makeId('technical-correlation'), rfqId: rfq.id, companyId: rfq.companyId,
        representativeId: assignedRepresentativeId, category: validated.category, otherExplanation: validated.otherExplanation,
        question: validated.question, lineItemId: validated.lineItemId, priority: validated.priority,
        requestedDepartment: validated.requestedDepartment, requestedTechnicalUserId: validated.requestedTechnicalUserId,
        classification: validated.classification, status: 'technical_support_requested', requestedAt: occurredAt,
        requestedBy: actor, assignedTechnicalUser: null, originalQuotationTargetAt, revisedQuotationTargetAt,
        additionalAllowanceHours: TECHNICAL_SUPPORT_ALLOWANCE_HOURS, extensionAppliedAt: occurredAt,
        extensionReason: 'Technical review required before quotation.', messages: [], attachments: attachment ? [attachment] : [],
        statusEvents: [{ id: makeId('technical-status'), previousStatus: '', newStatus: 'technical_support_requested', actor, createdAt: occurredAt }],
        customerInformationRequest: null, response: null, quotationOverride: null, completedAt: '', updatedAt: occurredAt,
      };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupportHistory: [...(rfq.technicalSupportHistory || []), ...(rfq.technicalSupport ? [rfq.technicalSupport] : [])], technicalSupport: request, quotationTargetAt: originalQuotationTargetAt, revisedQuotationTargetAt, updatedAt: occurredAt }, {
        action: 'requested', note: 'Technical review is required. The quotation timeframe has been extended by up to 24 hours.', customerVisible: true, actor,
      }));
      addTechnicalAudit({ rfq: saved, action: 'requested', actor, newStatus: request.status, attachments: request.attachments, reason: request.extensionReason });
      addTechnicalAudit({ rfq: saved, action: 'quotation_due_date_extended', actor, previousStatus: originalQuotationTargetAt, newStatus: revisedQuotationTargetAt, reason: request.extensionReason });
      publishWorkflowNotifications({ action: 'request_technical_support', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async assign(requestId, input = {}) {
      const account = requireAccount();
      const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq);
      const request = rfq.technicalSupport; const transition = assertTechnicalTransition(request, 'assign', account);
      const technicalUser = readAccounts().find(candidate => candidate.id === input.technicalUserId && accountCan(candidate, PERMISSIONS.RESPOND_TECHNICAL_SUPPORT));
      if (!technicalUser) throw new ServiceError('Select an authorised Technical Support user.', { code: 'TECHNICAL_USER_INVALID', status: 422, fieldErrors: { technicalUserId: 'Select a Technical Support user.' } });
      const actor = createWorkflowActor(account); const occurredAt = now().toISOString();
      const updatedRequest = { ...request, status: transition.to, assignedTechnicalUser: createWorkflowActor(technicalUser), assignedAt: occurredAt, updatedAt: occurredAt, statusEvents: [...request.statusEvents, { id: makeId('technical-status'), previousStatus: request.status, newStatus: transition.to, actor, createdAt: occurredAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: occurredAt }, { action: 'assigned', note: `Technical request assigned to ${technicalUser.contact}.`, previousStatus: request.status, newStatus: transition.to, actor }));
      addTechnicalAudit({ rfq: saved, action: 'assigned', actor, previousStatus: request.status, newStatus: transition.to });
      publishWorkflowNotifications({ action: 'assign_technical_support', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async startReview(requestId) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq);
      assertAssignedTechnicalUser(account, rfq.technicalSupport);
      const transition = assertTechnicalTransition(rfq.technicalSupport, 'start_review', account); const actor = createWorkflowActor(account); const occurredAt = now().toISOString();
      const updatedRequest = { ...rfq.technicalSupport, status: transition.to, reviewStartedAt: occurredAt, updatedAt: occurredAt, statusEvents: [...rfq.technicalSupport.statusEvents, { id: makeId('technical-status'), previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor, createdAt: occurredAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: occurredAt }, { action: 'review_started', note: 'Technical review started.', previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor }));
      addTechnicalAudit({ rfq: saved, action: 'review_started', actor, previousStatus: rfq.technicalSupport.status, newStatus: transition.to });
      return clone(presentRecord(account, saved));
    },

    async postMessage(requestId, input = {}) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq);
      const request = rfq.technicalSupport; const customer = account.role === USER_ROLES.CUSTOMER;
      if (customer) {
        if (!accountCan(account, PERMISSIONS.RESPOND_CUSTOMER_TECHNICAL_REQUEST) || request.status !== 'awaiting_customer_information') throw new ServiceError('A customer reply is not currently requested.', { code: 'TECHNICAL_CUSTOMER_REPLY_NOT_ALLOWED', status: 403 });
      } else if (!accountCan(account, PERMISSIONS.POST_TECHNICAL_MESSAGE) && !accountCan(account, PERMISSIONS.RESPOND_TECHNICAL_SUPPORT)) throw new ServiceError('Your role cannot post Technical Support messages.', { code: 'FORBIDDEN', status: 403 });
      const message = technicalMessage(input, account, { customer }); const actor = createWorkflowActor(account);
      let status = request.status;
      if (customer) status = assertTechnicalTransition(request, 'customer_reply', account).to;
      else if (request.status === 'awaiting_representative_information' && accountCan(account, PERMISSIONS.REQUEST_TECHNICAL_SUPPORT)) status = assertTechnicalTransition(request, 'representative_reply', account).to;
      const updatedRequest = { ...request, status, messages: [...request.messages, message], updatedAt: message.createdAt, customerInformationRequest: customer ? { ...request.customerInformationRequest, active: false, respondedAt: message.createdAt } : request.customerInformationRequest, statusEvents: status === request.status ? request.statusEvents : [...request.statusEvents, { id: makeId('technical-status'), previousStatus: request.status, newStatus: status, actor, createdAt: message.createdAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: message.createdAt }, { action: customer ? 'customer_response_received' : 'message_posted', note: message.classification === 'customer_safe' ? message.message : 'An internal Technical Support message was posted.', customerVisible: message.classification === 'customer_safe', previousStatus: request.status, newStatus: status, actor }));
      addTechnicalAudit({ rfq: saved, action: customer ? 'customer_response_received' : 'message_posted', actor, previousStatus: request.status, newStatus: status, messageType: message.classification, attachments: message.attachments });
      if (customer || status !== request.status) publishWorkflowNotifications({ action: 'technical_information_received', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async requestInformation(requestId, input = {}) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq); assertAssignedTechnicalUser(account, rfq.technicalSupport);
      const transition = assertTechnicalTransition(rfq.technicalSupport, 'request_representative_information', account);
      const target = TECHNICAL_INFORMATION_TARGETS.includes(input.target) ? input.target : 'representative';
      const requestKind = input.returnForCorrection === true ? 'rfq_correction' : 'more_information';
      const message = technicalMessage({ message: input.message, classification: 'internal_only', attachment: input.attachment }, account); const actor = createWorkflowActor(account);
      const updatedRequest = { ...rfq.technicalSupport, status: transition.to, messages: [...rfq.technicalSupport.messages, message], pendingInformationTarget: target, pendingRequestKind: requestKind, updatedAt: message.createdAt, statusEvents: [...rfq.technicalSupport.statusEvents, { id: makeId('technical-status'), previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor, createdAt: message.createdAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: message.createdAt }, { action: requestKind === 'rfq_correction' ? 'returned_for_correction' : 'information_requested', note: requestKind === 'rfq_correction' ? 'Technical Support returned the RFQ to Sales for correction.' : 'Technical Support requested more information from Sales.', previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor }));
      addTechnicalAudit({ rfq: saved, action: requestKind === 'rfq_correction' ? 'returned_for_correction' : 'information_requested', actor, previousStatus: rfq.technicalSupport.status, newStatus: transition.to, messageType: 'internal_only', attachments: message.attachments });
      publishWorkflowNotifications({ action: 'request_technical_information', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async forwardCustomerRequest(requestId, input = {}) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq);
      const transition = assertTechnicalTransition(rfq.technicalSupport, 'forward_customer_information_request', account);
      const assignedRepresentativeId = rfq.representativeId || rfq.selectedRep?.id || '';
      if (!accountCan(account, PERMISSIONS.VIEW_ALL_RFQS) && assignedRepresentativeId !== account.representativeId) throw new ServiceError('Only the assigned representative may contact this customer.', { code: 'RFQ_NOT_ASSIGNED', status: 403 });
      const message = technicalMessage({ message: input.message, classification: 'customer_safe', attachment: input.attachment }, account); const actor = createWorkflowActor(account);
      const updatedRequest = { ...rfq.technicalSupport, status: transition.to, messages: [...rfq.technicalSupport.messages, message], customerInformationRequest: { active: true, message: message.message, requestedAt: message.createdAt, requestedBy: actor }, updatedAt: message.createdAt, statusEvents: [...rfq.technicalSupport.statusEvents, { id: makeId('technical-status'), previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor, createdAt: message.createdAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: message.createdAt }, { action: 'customer_information_requested', note: message.message, customerVisible: true, previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor }));
      addTechnicalAudit({ rfq: saved, action: 'customer_information_requested', actor, previousStatus: rfq.technicalSupport.status, newStatus: transition.to, messageType: 'customer_safe', attachments: message.attachments });
      publishWorkflowNotifications({ action: 'request_customer_technical_information', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async respond(requestId, input = {}) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq); assertAssignedTechnicalUser(account, rfq.technicalSupport);
      const transition = assertTechnicalTransition(rfq.technicalSupport, input.approveConfiguration ? 'approve_configuration' : 'submit_response', account);
      const response = validateTechnicalResponse(input); const actor = createWorkflowActor(account); const occurredAt = now().toISOString();
      const attachment = technicalAttachmentMetadata(response.attachment, actor, response.attachmentCustomerVisible);
      const responseMessage = { id: makeId('technical-message'), message: response.response, classification: 'internal_only', senderId: account.id, senderName: account.contact, senderRole: account.role, attachments: attachment ? [attachment] : [], readBy: [account.id], createdAt: occurredAt };
      const customerMessage = response.customerSafeNote ? { ...responseMessage, id: makeId('technical-message'), message: response.customerSafeNote, classification: 'customer_safe', attachments: attachment?.customerVisible ? [attachment] : [] } : null;
      const updatedRequest = { ...rfq.technicalSupport, status: transition.to, response: { ...response, attachment: attachment || null, submittedBy: actor, submittedAt: occurredAt }, messages: [...rfq.technicalSupport.messages, responseMessage, ...(customerMessage ? [customerMessage] : [])], updatedAt: occurredAt, statusEvents: [...rfq.technicalSupport.statusEvents, { id: makeId('technical-status'), previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor, createdAt: occurredAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: occurredAt }, { action: 'recommendation_submitted', note: response.customerSafeNote || 'A technical recommendation was submitted to the representative.', customerVisible: Boolean(response.customerSafeNote), previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor }));
      addTechnicalAudit({ rfq: saved, action: 'recommendation_submitted', actor, previousStatus: rfq.technicalSupport.status, newStatus: transition.to, messageType: 'technical_response', attachments: attachment ? [attachment] : [] });
      publishWorkflowNotifications({ action: 'submit_technical_response', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async complete(requestId, input = {}) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq); assertAssignedTechnicalUser(account, rfq.technicalSupport);
      const transition = assertTechnicalTransition(rfq.technicalSupport, 'complete', account); const actor = createWorkflowActor(account); const occurredAt = now().toISOString();
      const updatedRequest = { ...rfq.technicalSupport, status: transition.to, completedAt: occurredAt, completionNote: String(input.note || '').trim(), completedBy: actor, updatedAt: occurredAt, statusEvents: [...rfq.technicalSupport.statusEvents, { id: makeId('technical-status'), previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor, createdAt: occurredAt }] };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: occurredAt }, { action: 'completed', note: 'Technical review completed. Quotation preparation may continue.', customerVisible: true, previousStatus: rfq.technicalSupport.status, newStatus: transition.to, actor }));
      addTechnicalAudit({ rfq: saved, action: 'completed', actor, previousStatus: rfq.technicalSupport.status, newStatus: transition.to });
      publishWorkflowNotifications({ action: 'complete_technical_support', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async override(requestId, input = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.OVERRIDE_TECHNICAL_QUOTATION_BLOCK)) throw new ServiceError('Your role cannot override the Technical Review quotation block.', { code: 'FORBIDDEN', status: 403 });
      const reason = String(input.reason || '').trim();
      if (reason.length < 10) throw new ServiceError('Record a clear reason for the Technical Review override.', { code: 'TECHNICAL_OVERRIDE_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Enter at least 10 characters.' } });
      const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq);
      if (!isTechnicalSupportActive(rfq.technicalSupport)) throw new ServiceError('This Technical Support request is no longer active.', { code: 'TECHNICAL_OVERRIDE_NOT_REQUIRED', status: 409 });
      const actor = createWorkflowActor(account); const occurredAt = now().toISOString();
      const updatedRequest = { ...rfq.technicalSupport, quotationOverride: { active: true, reason, approvedBy: actor, approvedAt: occurredAt }, updatedAt: occurredAt };
      const saved = saveEnquiry(addTechnicalTimeline({ ...rfq, technicalSupport: updatedRequest, updatedAt: occurredAt }, { action: 'override_used', note: 'An authorised quotation workflow override was recorded.', actor }));
      addTechnicalAudit({ rfq: saved, action: 'override_used', actor, previousStatus: rfq.technicalSupport.status, newStatus: rfq.technicalSupport.status, overrideReason: reason });
      publishWorkflowNotifications({ action: 'override_technical_support', record: saved, actor });
      return clone(presentRecord(account, saved));
    },

    async downloadAttachment(requestId, attachmentId) {
      const account = requireAccount(); const rfq = locateTechnicalRfq(requestId); assertTechnicalRecordAccess(account, rfq);
      if (!accountCan(account, PERMISSIONS.DOWNLOAD_TECHNICAL_DOCUMENTS)) throw new ServiceError('Your role cannot download Technical Support documents.', { code: 'FORBIDDEN', status: 403 });
      const documents = [...(rfq.technicalSupport.attachments || []), ...(rfq.technicalSupport.messages || []).flatMap(message => message.attachments || []), ...(rfq.technicalSupport.response?.attachment ? [rfq.technicalSupport.response.attachment] : [])];
      const document = documents.find(candidate => candidate.id === attachmentId);
      if (!document || (account.role === USER_ROLES.CUSTOMER && !document.customerVisible)) throw new ServiceError('The document was not found or is not available to your account.', { code: 'DOCUMENT_NOT_FOUND', status: 404 });
      addTechnicalAudit({ rfq, action: 'document_downloaded', actor: createWorkflowActor(account), messageType: 'document_download', attachments: [document] });
      return clone({ ...document, downloadUrl: '', mockMessage: 'The GitHub Pages preview stores document metadata only.' });
    },

    async downloadRfq(requestId) {
      const account = requireAccount();
      const rfq = locateTechnicalRfq(requestId);
      assertTechnicalRecordAccess(account, rfq);
      if (account.role === USER_ROLES.CUSTOMER || !accountCan(account, PERMISSIONS.DOWNLOAD_TECHNICAL_DOCUMENTS)) throw new ServiceError('The complete Technical Support RFQ is available to authorised internal users only.', { code: 'FORBIDDEN', status: 403 });
      const bytes = await buildRfqPdf(rfq);
      addTechnicalAudit({ rfq, action: 'rfq_pdf_downloaded', actor: createWorkflowActor(account), messageType: 'rfq_pdf_download' });
      return clone({
        fileName: rfqPdfFilename(rfq),
        mediaType: 'application/pdf',
        dataUrl: bytesToDataUrl(bytes, 'application/pdf'),
      });
    },

    async getMetrics() {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.VIEW_TECHNICAL_METRICS)) throw new ServiceError('Your role cannot view Technical Support reporting.', { code: 'FORBIDDEN', status: 403 });
      const requests = readAllEnquiries().filter(rfq => rfq.technicalSupport && canReadRecord(account, rfq)).map(rfq => ({ ...rfq.technicalSupport, representativeName: rfq.selectedRep?.name || '', productFamily: rfq.items?.find(item => item.lineId === rfq.technicalSupport.lineItemId)?.category || rfq.items?.find(item => item.lineId === rfq.technicalSupport.lineItemId)?.code || 'Other' }));
      return clone({ ...technicalSupportMetrics(requests), byRepresentative: Object.fromEntries([...new Set(requests.map(request => request.representativeName || 'Unassigned'))].map(name => [name, requests.filter(request => (request.representativeName || 'Unassigned') === name).length])), byProductFamily: Object.fromEntries([...new Set(requests.map(request => request.productFamily))].map(name => [name, requests.filter(request => request.productFamily === name).length])) });
    },
  };

  const preferences = {
    async getTheme() {
      return store.get(STORE_KEYS.theme, null) || 'light';
    },

    async setTheme(theme) {
      const safeTheme = theme === 'dark' ? 'dark' : 'light';
      store.set(STORE_KEYS.theme, safeTheme);
      return safeTheme;
    },
  };

  const userSettings = {
    async get() {
      const account = requireAccount();
      return clone(normaliseUserSettings(readUserSettings()[account.id] || createDefaultUserSettings()));
    },

    async save(candidate) {
      const account = requireAccount();
      const next = normaliseUserSettings(candidate);
      const errors = validateUserSettings(next);
      if (Object.keys(errors).length) throw new ServiceError('Check the application settings.', { code: 'VALIDATION_ERROR', status: 422, fieldErrors: errors });
      const records = readUserSettings();
      const previous = normaliseUserSettings(records[account.id]);
      const saved = { ...next, updatedAt: now().toISOString() };
      records[account.id] = saved;
      writeUserSettings(records);
      appendAuditEvent({
        id: makeId('audit'),
        action: 'user.settings_saved',
        outcome: 'success',
        entityType: 'user_setting',
        entityId: account.id,
        companyId: account.companyId,
        actorId: account.id,
        actorRole: account.role,
        details: { previous, next: saved },
        createdAt: saved.updatedAt,
      });
      return clone(saved);
    },

    async completeWelcome() {
      const current = await this.get();
      return this.save({ ...current, onboarding: { ...current.onboarding, welcomeCompleted: true } });
    },

    async saveTutorialProgress({ step = 0, tutorialKind = 'full', completed = false } = {}) {
      const current = await this.get();
      return this.save({ ...current, onboarding: { ...current.onboarding, tutorialProgress: Math.max(0, Math.trunc(Number(step) || 0)), tutorialKind, tutorialCompleted: Boolean(completed) } });
    },

    async resetTutorial() {
      const current = await this.get();
      return this.save({ ...current, onboarding: { ...current.onboarding, tutorialProgress: 0, tutorialKind: 'full', tutorialCompleted: false } });
    },

    async reset() {
      const current = await this.get();
      return this.save({ ...createDefaultUserSettings(), onboarding: { ...current.onboarding } });
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
    representativeOrders,
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
    technicalSupport,
    clientVisits,
    administration,
    executiveDemo,
    personalisation,
    userSettings,
    products: productService,
    preferences,
    preview: {
      emailRecipient: RFQ_DELIVERY_DESTINATION,
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      maxQuotationDocumentBytes: MAX_QUOTATION_DOCUMENT_BYTES,
      maxAcceptanceDocumentBytes: MAX_ACCEPTANCE_DOCUMENT_BYTES,
      maxDispatchProofBytes: MAX_DISPATCH_PROOF_BYTES,
      maxRepresentativeOrderDocumentBytes: MAX_REPRESENTATIVE_ORDER_DOCUMENT_BYTES,
      maxCertificateBytes: MAX_CERTIFICATE_BYTES,
      persistenceLabel: 'this browser',
    },
  };
}
