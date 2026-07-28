import { areas, branches } from '../../data/branches.js';
import { categories, industries, products, recommendedCategories } from '../../data/catalogue.js';
import { representativesForArea } from '../../data/representatives.js';
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
  createDefaultNotificationPreferences,
  createNotificationRecord,
  messageForNotificationRecipient,
  normaliseNotificationPreferences,
  normaliseNotificationRecord,
  notificationMatchesPreferences,
  notificationRequestsForWorkflowAction,
  retryMockDelivery,
} from '../../domain/notifications.js';
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
import { accountCan, PERMISSIONS, ServiceError, USER_ROLES, roleCan, toPublicAccount } from '../contracts.js';
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
  DEMO_ACCOUNT,
  DEMO_ENQUIRIES,
  DEMO_LOGINS,
  DISPATCH_ACCOUNT,
  EXPEDITOR_ACCOUNT,
  EXTRA_DEMO_ACCOUNTS,
  LEGACY_STORE_KEYS,
  MANAGER_ACCOUNT,
  PLANNING_ACCOUNT,
  SALES_ACCOUNT,
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
    document: documentIsVisible && quotation.document ? { ...quotation.document } : undefined,
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

const toCustomerVisibleRecord = enquiry => {
  const history = (enquiry.trackingHistory || [])
    .filter(isCustomerVisibleEvent)
    .map(toCustomerTimelineEvent);
  const lastVisible = history.at(-1);
  const visibleStatus = lastVisible?.toStatus || lastVisible?.status || (workflowStatusById(enquiry.trackingStatus, enquiry.workflowType)?.customerVisible ? enquiry.trackingStatus : 'submitted');
  const definition = workflowStatusById(visibleStatus);
  return {
    ...enquiry,
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
      const validated = validatePlanningSubmission(request.data);
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
        data: validateExpeditingAction(request.action, request.data),
      };
    }
    return request;
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
      DISPATCH_ACCOUNT,
      BUYER_ACCOUNT,
      MANAGER_ACCOUNT,
      ADMINISTRATOR_ACCOUNT,
      ...EXTRA_DEMO_ACCOUNTS,
    ]) {
      const index = accounts.findIndex(account => account.id === seed.id || account.email?.toLowerCase() === seed.email.toLowerCase());
      if (index >= 0) accounts[index] = normaliseAccount({ ...accounts[index], ...seed });
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
      for (const demo of DEMO_ENQUIRIES) {
        const record = normaliseEnquiry(demo);
        const collection = record.workflowType === 'order' ? workflowState.orders : workflowState.enquiries;
        if (!collection.some(existing => existing.id === record.id)) collection.push(record);
      }
      store.set(STORE_KEYS.seedVersion, true);
    }
    writeWorkflowState(workflowState);
    if (!store.has(STORE_KEYS.audit)) store.set(STORE_KEYS.audit, []);
    if (!store.has(STORE_KEYS.notifications)) store.set(STORE_KEYS.notifications, []);
    if (!store.has(STORE_KEYS.notificationPreferences)) store.set(STORE_KEYS.notificationPreferences, {});
    if (!store.has(STORE_KEYS.personalisation)) store.set(STORE_KEYS.personalisation, {});
    if (!store.has(STORE_KEYS.mockImages)) store.set(STORE_KEYS.mockImages, {});

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
      const email = credentials.email.trim().toLowerCase();
      const matched = readAccounts().find(account => account.email.toLowerCase() === email && account.password === credentials.password);
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
          .map(item => ({ id: item.companyId, name: item.company, area: item.area, industry: item.industry }));
      }
      if (roleCan(account.role, PERMISSIONS.VIEW_OWN_COMPANY_ACCOUNT)) {
        return [{ id: account.companyId, name: account.company, area: account.area, industry: account.industry }];
      }
      throw new ServiceError('Your role is not permitted to view company accounts.', { code: 'FORBIDDEN', status: 403 });
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
      const selectedRepresentative = validateRepresentativeAssignment(details.selectedRep, representativeDirectory.representatives);
      const { poFile, ...serialisableDetails } = details;
      const reference = nextRfqReference();
      const createdAt = now().toISOString();
      const assignedRepresentative = {
        ...clone(selectedRepresentative),
        branchName: representativeDirectory.branch.name,
      };
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
      await enquiries.saveDraft([]);
      return { enquiry: clone(presentRecord(account, enquiry)), delivery: clone(delivery) };
    },
  };

  const orders = {
    async list() {
      const account = requireAccount();
      return clone(readAllOrders().filter(order => canReadRecord(account, order)).map(order => presentRecord(account, order)));
    },

    async getById(orderId) {
      const account = requireAccount();
      const order = readAllOrders().find(item => item.id === orderId);
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
      const updated = normaliseEnquiry(result.entity);
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

  const audit = {
    async list({ entityId = '', entityType = '', outcome = '', search = '' } = {}) {
      const account = requireAccount();
      if (!accountCan(account, PERMISSIONS.READ_AUDIT_HISTORY)) throw new ServiceError('Your role cannot view audit history.', { code: 'FORBIDDEN', status: 403 });
      const term = String(search || '').trim().toLowerCase();
      return clone(readAuditEvents()
        .map(presentAuditEvent)
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
    enquiries,
    orders,
    workflow,
    tracking: workflow,
    audit,
    notifications,
    planning,
    expediting,
    dispatch,
    personalisation,
    products: productService,
    preferences,
    preview: {
      emailRecipient: RFQ_EMAIL_RECIPIENT,
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      maxQuotationDocumentBytes: MAX_QUOTATION_DOCUMENT_BYTES,
      maxAcceptanceDocumentBytes: MAX_ACCEPTANCE_DOCUMENT_BYTES,
      maxDispatchProofBytes: MAX_DISPATCH_PROOF_BYTES,
      persistenceLabel: 'this browser',
    },
  };
}
