import {
  EXPEDITOR_DOCUMENT_TYPES,
  EXPEDITOR_PROGRESS_STEPS,
  expeditorProgressStepById,
} from '../domain/expediting.js';
import { PLANNING_PRIORITY_VALUES, RFQ_ACCEPTANCE_TYPES, ServiceError } from './contracts.js';

export const MAX_PO_FILE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_PO_FILE_PATTERN = /\.(pdf|doc|docx|png|jpe?g|webp|gif|heic)$/i;
export const MAX_QUOTATION_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ACCEPTANCE_DOCUMENT_BYTES = 4 * 1024 * 1024;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const present = value => String(value || '').trim();

const throwValidation = (fieldErrors, fallback) => {
  const message = Object.values(fieldErrors)[0] || fallback;
  throw new ServiceError(message, { code: 'VALIDATION_ERROR', status: 422, fieldErrors });
};

export function validateSignIn({ email, password }) {
  const errors = {};
  if (!emailPattern.test(present(email))) errors.email = 'Enter a valid email address.';
  if (!present(password)) errors.password = 'Enter your password.';
  if (Object.keys(errors).length) throwValidation(errors, 'Check your sign-in details.');
}

export function validateRegistration(data) {
  const errors = {};
  if (present(data.company).length < 2) errors.company = 'Enter the company name.';
  if (present(data.contact).length < 2) errors.contact = 'Enter the contact person’s full name.';
  if (!emailPattern.test(present(data.email))) errors.email = 'Enter a valid company email address.';
  if (present(data.phone).length < 7) errors.phone = 'Enter a valid contact number.';
  if (!present(data.area)) errors.area = 'Select the company area.';
  if (!present(data.industry)) errors.industry = 'Select the company’s industry.';
  if (String(data.password || '').length < 8) errors.password = 'Create a password with at least eight characters.';
  if (Object.keys(errors).length) throwValidation(errors, 'Check the account details.');
}

export function validatePoFile(file) {
  if (!file) return;
  if (!ALLOWED_PO_FILE_PATTERN.test(file.name || '')) {
    throwValidation({ poFile: 'Choose a PDF, DOCX, DOC or image Purchase Order.' }, 'The Purchase Order file is not supported.');
  }
  if (Number(file.size || 0) > MAX_PO_FILE_BYTES) {
    throwValidation({ poFile: 'The Purchase Order document must be 4 MB or smaller.' }, 'The Purchase Order file is too large.');
  }
}

export function validateEnquiry(details, items) {
  const errors = {};
  if (present(details.application).length < 5) errors.application = 'Please describe the application before submitting the RFQ.';
  if (!present(details.area)) errors.area = 'Please select the area.';
  if (!details.selectedRep?.id) errors.selectedRep = 'Please select a representative for this RFQ.';
  if (!['delivery', 'collect'].includes(details.fulfilment)) errors.fulfilment = 'Please choose delivery or collection.';
  if (details.fulfilment === 'delivery' && present(details.deliveryAddress).length < 5) errors.deliveryAddress = 'Please enter the delivery address.';
  if (details.poMode === 'number' && !present(details.poNumber)) errors.poNumber = 'Please enter the Purchase Order number.';
  if (details.poMode === 'upload' && !details.poFile) errors.poFile = 'Please select the Purchase Order document.';
  if (!Array.isArray(items) || !items.length) errors.items = 'Please add and configure at least one unit before submitting the RFQ.';
  if (Array.isArray(items) && items.some(item => !item.productId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 9999)) {
    errors.items = 'Each configured unit must have a valid product and a quantity between 1 and 9,999.';
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the RFQ details.');
  validatePoFile(details.poFile);
}

export function validateCustomerAccountForRfq(account) {
  const errors = {};
  if (!present(account?.id)) errors.account = 'Your customer account could not be verified. Please sign in again.';
  if (!present(account?.companyId)) errors.companyId = 'Your account is not linked to an authorised company.';
  if (present(account?.company).length < 2) errors.company = 'Your company profile is incomplete.';
  if (present(account?.contact).length < 2) errors.contact = 'Your customer contact profile is incomplete.';
  if (!emailPattern.test(present(account?.email))) errors.email = 'Your customer email address is invalid.';
  if (present(account?.phone).length < 7) errors.phone = 'Your customer contact number is incomplete.';
  if (Object.keys(errors).length) {
    throwValidation(errors, 'Your customer account must be completed before an RFQ can be submitted.');
  }
}

export function validateRepresentativeAssignment(selectedRepresentative, allowedRepresentatives = []) {
  const representative = allowedRepresentatives.find(item => item.id === selectedRepresentative?.id);
  if (!representative) {
    throwValidation(
      { selectedRep: 'Select a representative assigned to the chosen application area.' },
      'The selected representative is not available for this RFQ.',
    );
  }
  return representative;
}

const validDateOnly = value => {
  const text = present(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
};

export function validateQuotationDocument(file) {
  if (!file) return;
  if (!ALLOWED_PO_FILE_PATTERN.test(file.name || '')) {
    throwValidation(
      { quotationDocumentFile: 'Choose a PDF, DOCX, DOC or image quotation copy.' },
      'The quotation document is not supported.',
    );
  }
  if (Number(file.size || 0) > MAX_QUOTATION_DOCUMENT_BYTES) {
    throwValidation(
      { quotationDocumentFile: 'The quotation document must be 4 MB or smaller.' },
      'The quotation document is too large.',
    );
  }
}

export function validateQuotationConfirmation(data = {}) {
  const errors = {};
  const number = present(data.quotationNumber);
  const date = present(data.quotationDate);
  const expiryMode = present(data.quotationExpiryMode);
  const expiryDate = present(data.quotationExpiryDate);
  const internalNote = present(data.quotationInternalNote);
  const customerNote = present(data.quotationCustomerNote);
  const documentReference = present(data.quotationDocumentReference);
  const documentFile = data.quotationDocumentFile || null;

  if (!number) errors.quotationNumber = 'Enter the quotation number.';
  else if (number.length > 80) errors.quotationNumber = 'Keep the quotation number below 80 characters.';
  if (!validDateOnly(date)) errors.quotationDate = 'Enter a valid quotation date.';
  if (!['dated', 'not_applicable'].includes(expiryMode)) errors.quotationExpiryMode = 'Select whether the quotation has an expiry date.';
  if (expiryMode === 'dated') {
    if (!validDateOnly(expiryDate)) errors.quotationExpiryDate = 'Enter a valid quotation expiry date.';
    else if (validDateOnly(date) && expiryDate < date) errors.quotationExpiryDate = 'The expiry date cannot be before the quotation date.';
  }
  if (internalNote.length > 2000) errors.quotationInternalNote = 'Keep the internal note below 2,000 characters.';
  if (customerNote.length > 1000) errors.quotationCustomerNote = 'Keep the customer-facing note below 1,000 characters.';
  if (documentReference.length > 240) errors.quotationDocumentReference = 'Keep the document reference below 240 characters.';
  if (Object.keys(errors).length) throwValidation(errors, 'Check the quotation confirmation.');
  validateQuotationDocument(documentFile);

  const documentCustomerVisible = Boolean(data.quotationDocumentCustomerVisible && (documentFile || documentReference));
  return {
    quotation: {
      number,
      date,
      expiryMode,
      expiryDate: expiryMode === 'dated' ? expiryDate : '',
      internalNote,
      customerNote,
      emailed: Boolean(data.quotationEmailed),
      documentReference,
      documentCustomerVisible,
    },
    quotationDocumentFile: documentFile,
  };
}

export function validateAcceptanceDocument(file) {
  if (!file) return;
  if (!ALLOWED_PO_FILE_PATTERN.test(file.name || '')) {
    throwValidation(
      { acceptanceDocumentFile: 'Choose a PDF, DOCX, DOC or image supporting document.' },
      'The acceptance supporting document is not supported.',
    );
  }
  if (Number(file.size || 0) > MAX_ACCEPTANCE_DOCUMENT_BYTES) {
    throwValidation(
      { acceptanceDocumentFile: 'The acceptance supporting document must be 4 MB or smaller.' },
      'The acceptance supporting document is too large.',
    );
  }
}

export function validateOrderAcceptance(data = {}) {
  const errors = {};
  const type = present(data.acceptanceType);
  const purchaseOrderNumber = present(data.acceptancePurchaseOrderNumber);
  const paymentReference = present(data.acceptancePaymentReference);
  const date = present(data.acceptanceDate);
  const internalNote = present(data.acceptanceInternalNote);
  const documentReference = present(data.acceptanceDocumentReference);
  const documentFile = data.acceptanceDocumentFile || null;

  if (!RFQ_ACCEPTANCE_TYPES.includes(type)) errors.acceptanceType = 'Select how the customer acceptance was received.';
  if (!validDateOnly(date)) errors.acceptanceDate = 'Enter a valid acceptance date.';
  if (type === 'purchase_order_received' && !purchaseOrderNumber) errors.acceptancePurchaseOrderNumber = 'Enter the received Purchase Order number.';
  if (type === 'payment_confirmed' && !paymentReference) errors.acceptancePaymentReference = 'Enter the external payment or transaction reference.';
  if (!internalNote) errors.acceptanceInternalNote = 'Add an internal note describing the evidence you verified.';
  if (purchaseOrderNumber.length > 100) errors.acceptancePurchaseOrderNumber = 'Keep the Purchase Order number below 100 characters.';
  if (paymentReference.length > 160) errors.acceptancePaymentReference = 'Keep the payment reference below 160 characters.';
  if (internalNote.length > 2000) errors.acceptanceInternalNote = 'Keep the internal note below 2,000 characters.';
  if (documentReference.length > 240) errors.acceptanceDocumentReference = 'Keep the supporting-document reference below 240 characters.';
  if (data.acceptanceVerified !== true) errors.acceptanceVerified = 'Confirm that you verified the acceptance evidence.';
  if (['price', 'pricing', 'total', 'linePrices'].some(field => data[field] !== undefined)) {
    errors.acceptance = 'Pricing data is not permitted in the acceptance workflow.';
  }
  const prohibitedCredentialFields = ['cardNumber', 'cvv', 'pin', 'password', 'bankAccount', 'bankingCredentials', 'routingNumber'];
  if (prohibitedCredentialFields.some(field => data[field] !== undefined)) {
    errors.acceptance = 'Card, banking and password information must not be entered or stored.';
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the order acceptance details.');
  validateAcceptanceDocument(documentFile);

  return {
    acceptance: {
      type,
      purchaseOrderNumber,
      paymentReference,
      date,
      internalNote,
      documentReference,
      verified: true,
    },
    acceptanceDocumentFile: documentFile,
  };
}

const planningValue = (data, field, legacyField) => (
  data?.planning?.[field] ?? data?.[legacyField] ?? data?.[field]
);

const normaliseDocumentReferences = value => {
  if (Array.isArray(value)) return value.map(present).filter(Boolean);
  return String(value || '').split(/\r?\n/).map(present).filter(Boolean);
};

export function validatePlanningSubmission(data = {}) {
  const errors = {};
  const internalJobNumber = present(planningValue(data, 'internalJobNumber', 'planningInternalJobNumber'));
  const customerPoNumber = present(planningValue(data, 'customerPoNumber', 'planningCustomerPoNumber'));
  const poExceptionAuthorised = planningValue(data, 'poExceptionAuthorised', 'planningPoExceptionAuthorised') === true
    || data?.planning?.customerPoException?.authorised === true;
  const poExceptionReason = present(
    planningValue(data, 'poExceptionReason', 'planningPoExceptionReason')
    || data?.planning?.customerPoException?.reason,
  );
  const notes = present(planningValue(data, 'notes', 'planningNotes'));
  const plannedStartDate = present(planningValue(data, 'plannedStartDate', 'planningStartDate'));
  const estimatedCompletionDate = present(planningValue(data, 'estimatedCompletionDate', 'planningEstimatedCompletionDate'));
  const assignedPlanningUserId = present(planningValue(data, 'assignedPlanningUserId', 'planningAssignedUserId'));
  const productionLocationId = present(planningValue(data, 'productionLocationId', 'planningProductionLocationId'));
  const priority = present(planningValue(data, 'priority', 'planningPriority')) || 'standard';
  const submissionDate = present(planningValue(data, 'submissionDate', 'planningSubmissionDate'));
  const documentReferences = normaliseDocumentReferences(planningValue(data, 'documentReferences', 'planningDocumentReferences'));

  if (!internalJobNumber) errors.planningInternalJobNumber = 'Enter the internal job number.';
  else if (internalJobNumber.length > 100) errors.planningInternalJobNumber = 'Keep the internal job number below 100 characters.';
  if (customerPoNumber.length > 100) errors.planningCustomerPoNumber = 'Keep the customer Purchase Order number below 100 characters.';
  if (!customerPoNumber && !poExceptionAuthorised) {
    errors.planningPoExceptionAuthorised = 'Enter the customer Purchase Order number or record an authorised exception.';
  }
  if (!customerPoNumber && poExceptionAuthorised && poExceptionReason.length < 8) {
    errors.planningPoExceptionReason = 'Explain the authorised Purchase Order exception in at least 8 characters.';
  }
  if (poExceptionReason.length > 1000) errors.planningPoExceptionReason = 'Keep the Purchase Order exception reason below 1,000 characters.';
  if (notes.length > 2000) errors.planningNotes = 'Keep Planning notes below 2,000 characters.';
  if (plannedStartDate && !validDateOnly(plannedStartDate)) errors.planningStartDate = 'Enter a valid planned start date.';
  if (estimatedCompletionDate && !validDateOnly(estimatedCompletionDate)) errors.planningEstimatedCompletionDate = 'Enter a valid estimated completion date.';
  if (
    plannedStartDate
    && estimatedCompletionDate
    && validDateOnly(plannedStartDate)
    && validDateOnly(estimatedCompletionDate)
    && estimatedCompletionDate < plannedStartDate
  ) {
    errors.planningEstimatedCompletionDate = 'The estimated completion date cannot be before the planned start date.';
  }
  if (!assignedPlanningUserId) errors.planningAssignedUserId = 'Select the Planning user responsible for this order.';
  if (!PLANNING_PRIORITY_VALUES.includes(priority)) errors.planningPriority = 'Select a valid Planning priority.';
  if (!validDateOnly(submissionDate)) errors.planningSubmissionDate = 'Enter the Planning submission date.';
  if (documentReferences.length > 10) errors.planningDocumentReferences = 'Add no more than 10 document references.';
  if (documentReferences.some(reference => reference.length > 240)) {
    errors.planningDocumentReferences = 'Keep each document reference below 240 characters.';
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the Planning information.');

  return {
    planning: {
      internalJobNumber,
      customerPoNumber,
      customerPoException: customerPoNumber ? null : {
        authorised: true,
        reason: poExceptionReason,
      },
      notes,
      plannedStartDate,
      estimatedCompletionDate,
      assignedPlanningUserId,
      assignedPlanningUserName: '',
      productionLocationId,
      productionLocationName: '',
      priority,
      documentReferences,
      submissionDate,
    },
    internalJobNumber,
    customerPoNumber,
  };
}

const expeditingValue = (data, field, legacyField) => (
  data?.expeditingUpdate?.[field]
  ?? data?.expeditingHandoff?.[field]
  ?? data?.[legacyField]
  ?? data?.[field]
);

const EXPEDITOR_UPDATE_ACTIONS = Object.freeze([
  'start_expediting',
  'add_expediting_update',
  'place_on_hold',
  'resume_order',
  'complete_expediting',
]);

export function validateExpeditingAction(
  action,
  data = {},
  {
    progressSteps = EXPEDITOR_PROGRESS_STEPS,
    documentTypes = EXPEDITOR_DOCUMENT_TYPES,
  } = {},
) {
  const errors = {};
  if (!EXPEDITOR_UPDATE_ACTIONS.includes(action)) {
    throwValidation({ action: 'Select a recognised Expediting action.' }, 'The Expediting action is not supported.');
  }

  const forcedStep = {
    start_expediting: 'planning_received',
    place_on_hold: 'on_hold',
    complete_expediting: 'ready_for_dispatch',
  }[action];
  const progressStep = forcedStep || present(expeditingValue(data, 'progressStep', 'expeditingProgressStep'));
  const allowedStepIds = progressSteps.map(step => step.id);
  const stepDefinition = progressSteps.find(step => step.id === progressStep)
    || expeditorProgressStepById(progressStep);
  const customerMessage = present(expeditingValue(data, 'customerMessage', 'expeditingCustomerMessage'));
  const internalNote = present(expeditingValue(data, 'internalNote', 'expeditingInternalNote'));
  const estimatedCompletionDate = present(expeditingValue(data, 'estimatedCompletionDate', 'expeditingEstimatedCompletionDate'));
  const delayReason = present(expeditingValue(data, 'delayReason', 'expeditingDelayReason'));
  const documentType = present(
    expeditingValue(data, 'documentType', 'expeditingDocumentType')
    || data?.expeditingUpdate?.document?.type,
  );
  const documentReference = present(
    expeditingValue(data, 'documentReference', 'expeditingDocumentReference')
    || data?.expeditingUpdate?.document?.reference,
  );
  const completionCheckConfirmed = data?.expeditingHandoff?.completionCheckConfirmed === true
    || data?.completionCheckConfirmed === true
    || data?.expeditingCompletionCheckConfirmed === true;
  const authorisedException = data?.expeditingHandoff?.authorisedException === true
    || data?.expeditingReadyExceptionAuthorised === true;
  const exceptionReason = present(
    data?.expeditingHandoff?.exceptionReason
    || data?.expeditingReadyExceptionReason,
  );
  const exceptionAuthorisationReference = present(
    data?.expeditingHandoff?.exceptionAuthorisationReference
    || data?.expeditingReadyExceptionReference,
  );

  if (!allowedStepIds.includes(progressStep)) {
    errors.expeditingProgressStep = 'Select a recognised Expediting progress step.';
  } else if (action === 'add_expediting_update' && !stepDefinition.selectableForUpdate) {
    errors.expeditingProgressStep = 'Use the controlled workflow action for this progress step.';
  } else if (action === 'resume_order' && stepDefinition.operational) {
    errors.expeditingProgressStep = 'Resume the order at a normal production or fulfilment step.';
  }
  if (customerMessage.length < 5) errors.expeditingCustomerMessage = 'Add a clear customer-facing progress message.';
  else if (customerMessage.length > 1000) errors.expeditingCustomerMessage = 'Keep the customer-facing message below 1,000 characters.';
  if (internalNote.length > 2000) errors.expeditingInternalNote = 'Keep the internal note below 2,000 characters.';
  if (estimatedCompletionDate && !validDateOnly(estimatedCompletionDate)) {
    errors.expeditingEstimatedCompletionDate = 'Enter a valid estimated completion date.';
  }
  if (delayReason.length > 1000) errors.expeditingDelayReason = 'Keep the delay reason below 1,000 characters.';
  if (action === 'place_on_hold' && delayReason.length < 5) {
    errors.expeditingDelayReason = 'Record why the order is being placed on hold.';
  }
  if (documentReference.length > 240) errors.expeditingDocumentReference = 'Keep the controlled reference below 240 characters.';
  if (documentReference && !documentTypes.some(type => type.id === documentType)) {
    errors.expeditingDocumentType = 'Select the type of controlled document or image reference.';
  }
  if (documentType && !documentReference) {
    errors.expeditingDocumentReference = 'Enter the controlled document or image reference.';
  }
  if (action === 'complete_expediting') {
    if (!completionCheckConfirmed) errors.expeditingCompletionCheckConfirmed = 'Confirm that the Expeditor hand-off checks are complete.';
    if (authorisedException && exceptionReason.length < 10) {
      errors.expeditingReadyExceptionReason = 'Explain the authorised exception in at least 10 characters.';
    }
    if (authorisedException && exceptionAuthorisationReference.length < 3) {
      errors.expeditingReadyExceptionReference = 'Record the manager or controlled authorisation reference.';
    }
    if (exceptionReason.length > 1000) errors.expeditingReadyExceptionReason = 'Keep the exception reason below 1,000 characters.';
    if (exceptionAuthorisationReference.length > 160) {
      errors.expeditingReadyExceptionReference = 'Keep the authorisation reference below 160 characters.';
    }
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the Expediting update.');

  return {
    expeditingUpdate: {
      progressStep,
      customerMessage,
      internalNote,
      estimatedCompletionDate,
      delayReason,
      document: documentReference ? {
        type: documentType,
        reference: documentReference,
        storageStatus: 'metadata_only',
      } : null,
      customerVisible: true,
    },
    ...(action === 'complete_expediting' ? {
      completionCheckConfirmed: true,
      expeditingHandoff: {
        completionCheckConfirmed: true,
        authorisedException,
        exceptionReason: authorisedException ? exceptionReason : '',
        exceptionAuthorisationReference: authorisedException ? exceptionAuthorisationReference : '',
      },
    } : {}),
  };
}

export function validateWorkflowActionRequest({ action, comment, data, expectedVersion } = {}) {
  const errors = {};
  if (!present(action)) errors.action = 'Select an available workflow action.';
  if (String(comment || '').length > 1000) errors.comment = 'Keep the workflow comment below 1,000 characters.';
  if (data !== undefined && (data === null || Array.isArray(data) || typeof data !== 'object')) errors.data = 'Workflow action data must be a structured object.';
  if (expectedVersion === undefined || !Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) < 0) errors.expectedVersion = 'Refresh the record and try again.';
  if (Object.keys(errors).length) throwValidation(errors, 'Check the workflow action.');
  return {
    action: present(action),
    comment: present(comment),
    data: data || {},
    expectedVersion: Number(expectedVersion),
  };
}
