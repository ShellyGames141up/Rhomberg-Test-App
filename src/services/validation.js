import {
  EXPEDITOR_DOCUMENT_TYPES,
  EXPEDITOR_PROGRESS_STEPS,
  expeditorProgressStepById,
} from '../domain/expediting.js';
import {
  DISPATCH_METHODS,
  DISPATCH_PROOF_TYPES,
} from '../domain/dispatch.js';
import {
  validateCustomerImage,
  validateCustomerPersonalisation,
} from '../shared/personalisation/personalisation.js';
import {
  normaliseNotificationPreferences,
  validateNotificationPreferences,
} from '../domain/notifications.js';
import { PLANNING_PRIORITY_VALUES, RFQ_ACCEPTANCE_TYPES, ServiceError } from './contracts.js';
import { REPRESENTATIVE_ORDER_SOURCE_IDS } from '../domain/representativeOrders.js';

export const MAX_PO_FILE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_PO_FILE_PATTERN = /\.(pdf|doc|docx|png|jpe?g|webp|gif|heic)$/i;
export const MAX_QUOTATION_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_ACCEPTANCE_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DISPATCH_PROOF_BYTES = 4 * 1024 * 1024;
export const MAX_REPRESENTATIVE_ORDER_DOCUMENT_BYTES = 4 * 1024 * 1024;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const referencePattern = /^[\p{L}\p{N}][\p{L}\p{N} ._/#-]*$/u;
const supportedDocumentMimePattern = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/[a-z0-9.+-]+)$/i;
const present = value => String(value || '').trim();

const throwValidation = (fieldErrors, fallback) => {
  const message = Object.values(fieldErrors)[0] || fallback;
  throw new ServiceError(message, { code: 'VALIDATION_ERROR', status: 422, fieldErrors });
};

const validateDocumentMetadata = (file, field) => {
  if (!file) return;
  const fileName = present(file.name);
  const mimeType = present(file.type);
  if (!fileName || /[\\/]/.test(fileName)) {
    throwValidation({ [field]: 'Choose a file with a valid name.' }, 'The uploaded document metadata is invalid.');
  }
  if (mimeType && !supportedDocumentMimePattern.test(mimeType)) {
    throwValidation({ [field]: 'Choose a PDF, DOCX, DOC or supported image.' }, 'The uploaded document type is not supported.');
  }
  if (!Number.isFinite(Number(file.size)) || Number(file.size) < 1) {
    throwValidation({ [field]: 'The selected document is empty or its size could not be verified.' }, 'The uploaded document metadata is invalid.');
  }
};

export function validateSignIn({ email, password }) {
  const errors = {};
  const identifier = present(email);
  const usernamePattern = /^[a-zA-Z][a-zA-Z0-9._-]{2,39}$/;
  if (!emailPattern.test(identifier) && !usernamePattern.test(identifier)) {
    errors.email = 'Enter a valid email address or sign-in name.';
  }
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

export function validatePersonalisation(candidate) {
  const errors = validateCustomerPersonalisation(candidate);
  if (Object.keys(errors).length) throwValidation(errors, 'Check the personalisation settings.');
  return candidate;
}

export function validatePersonalisationImage(file) {
  const message = validateCustomerImage(file);
  if (message) throwValidation({ image: message }, message);
  return file;
}

export function validateNotificationPreferenceSettings(candidate) {
  const normalised = normaliseNotificationPreferences(candidate);
  const errors = validateNotificationPreferences(normalised);
  if (Object.keys(errors).length) throwValidation(errors, 'Check the notification preferences.');
  return normalised;
}

export function validatePoFile(file) {
  if (!file) return;
  validateDocumentMetadata(file, 'poFile');
  if (!ALLOWED_PO_FILE_PATTERN.test(file.name || '')) {
    throwValidation({ poFile: 'Choose a PDF, DOCX, DOC or image Purchase Order.' }, 'The Purchase Order file is not supported.');
  }
  if (Number(file.size || 0) > MAX_PO_FILE_BYTES) {
    throwValidation({ poFile: 'The Purchase Order document must be 4 MB or smaller.' }, 'The Purchase Order file is too large.');
  }
}

export function validateEnquiry(details, items) {
  const errors = {};
  const customerUrgencyFields = ['emergency', 'urgent', 'priority', 'internalPriority'];
  if (customerUrgencyFields.some(field => Object.prototype.hasOwnProperty.call(details || {}, field))) {
    errors.urgency = 'Priority and urgent processing are managed only by authorised Rhomberg staff.';
  }
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

const validateRequiredSourceDocument = (file, field, label) => {
  if (!file) {
    throwValidation({ [field]: `Attach the customer ${label}.` }, `The customer ${label} is required.`);
  }
  validateDocumentMetadata(file, field);
  if (!ALLOWED_PO_FILE_PATTERN.test(file.name || '')) {
    throwValidation(
      { [field]: `Choose a PDF, DOCX, DOC or supported image ${label}.` },
      `The customer ${label} is not supported.`,
    );
  }
  if (Number(file.size || 0) > MAX_REPRESENTATIVE_ORDER_DOCUMENT_BYTES) {
    throwValidation(
      { [field]: `The ${label} must be 4 MB or smaller.` },
      `The customer ${label} is too large.`,
    );
  }
};

const sameFileMetadata = (left, right) => Boolean(left && right
  && present(left.name).toLowerCase() === present(right.name).toLowerCase()
  && Number(left.size || 0) === Number(right.size || 0)
  && present(left.type).toLowerCase() === present(right.type).toLowerCase());

export function validateRepresentativeLoadedOrder(data = {}, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = {};
  const customerType = present(data.customerType) || 'existing';
  const companyId = present(data.companyId);
  const customerContactId = present(data.customerContactId);
  const newCustomer = {
    companyName: present(data.newCustomer?.companyName),
    contactName: present(data.newCustomer?.contactName),
    workEmail: present(data.newCustomer?.workEmail).toLowerCase(),
    telephone: present(data.newCustomer?.telephone),
    address: present(data.newCustomer?.address),
    registrationInformation: present(data.newCustomer?.registrationInformation),
    notes: present(data.newCustomer?.notes),
  };
  const branchId = present(data.branchId);
  const representativeId = present(data.representativeId);
  const orderSource = present(data.orderSource);
  const orderSourceOther = present(data.orderSourceOther);
  const application = present(data.application);
  const fulfilment = present(data.fulfilment);
  const deliveryAddress = present(data.deliveryAddress);
  const customerNotes = present(data.customerNotes);
  const internalRepresentativeNotes = present(data.internalRepresentativeNotes);
  const requiredDate = present(data.requiredDate);
  const priority = present(data.priority) || 'standard';
  const quotationNumber = present(data.quotationNumber);
  const quotationDate = present(data.quotationDate);
  const quotationRevision = present(data.quotationRevision);
  const purchaseOrderNumber = present(data.purchaseOrderNumber);
  const purchaseOrderDate = present(data.purchaseOrderDate);
  const confirmationNote = present(data.confirmationNote);
  const submissionKey = present(data.submissionKey);
  const items = Array.isArray(data.items) ? data.items : [];
  const supportingDocuments = Array.isArray(data.supportingDocuments) ? data.supportingDocuments.filter(Boolean) : [];

  if (!['existing', 'new'].includes(customerType)) errors.customerType = 'Choose whether the customer already exists.';
  if (customerType === 'existing' && !companyId) errors.companyId = 'Select an existing customer company.';
  if (customerType === 'existing' && !customerContactId) errors.customerContactId = 'Select an authorised customer contact.';
  if (customerType === 'new') {
    if (newCustomer.companyName.length < 2) errors['newCustomer.companyName'] = 'Enter the customer company name.';
    if (newCustomer.contactName.length < 2) errors['newCustomer.contactName'] = 'Enter the customer contact name.';
    if (!emailPattern.test(newCustomer.workEmail)) errors['newCustomer.workEmail'] = 'Enter a valid work email address.';
    if (newCustomer.telephone.length < 7) errors['newCustomer.telephone'] = 'Enter a valid telephone number.';
    if (newCustomer.address.length < 5) errors['newCustomer.address'] = 'Enter the physical or company address.';
    if (newCustomer.registrationInformation.length > 300) errors['newCustomer.registrationInformation'] = 'Keep registration information below 300 characters.';
    if (newCustomer.notes.length > 2000) errors['newCustomer.notes'] = 'Keep customer profile notes below 2,000 characters.';
  }
  if (!branchId) errors.branchId = 'Select the assigned branch.';
  if (!representativeId) errors.representativeId = 'Select the dedicated representative.';
  if (!REPRESENTATIVE_ORDER_SOURCE_IDS.includes(orderSource)) errors.orderSource = 'Select an approved order source.';
  if (orderSource === 'other_approved_source' && orderSourceOther.length < 5) errors.orderSourceOther = 'Explain the other approved source.';
  if (application.length < 5) errors.application = 'Describe the customer application or requirement.';
  if (!['delivery', 'collect'].includes(fulfilment)) errors.fulfilment = 'Choose delivery or collection.';
  if (fulfilment === 'delivery' && deliveryAddress.length < 5) errors.deliveryAddress = 'Enter the authorised delivery address.';
  if (customerNotes.length > 2000) errors.customerNotes = 'Keep customer notes below 2,000 characters.';
  if (internalRepresentativeNotes.length > 2000) errors.internalRepresentativeNotes = 'Keep internal notes below 2,000 characters.';
  if (requiredDate && !validDateOnly(requiredDate)) errors.requiredDate = 'Enter a valid required date.';
  else if (requiredDate && requiredDate < today) errors.requiredDate = 'The required date cannot be in the past.';
  if (!PLANNING_PRIORITY_VALUES.includes(priority)) errors.priority = 'Select a valid internal priority.';
  if (!quotationNumber) errors.quotationNumber = 'Enter the quotation number.';
  else if (!referencePattern.test(quotationNumber) || quotationNumber.length > 100) errors.quotationNumber = 'Use a valid quotation number below 100 characters.';
  if (!validDateOnly(quotationDate)) errors.quotationDate = 'Enter a valid quotation date.';
  else if (quotationDate > today) errors.quotationDate = 'The quotation date cannot be in the future.';
  if (quotationRevision.length > 60) errors.quotationRevision = 'Keep the quotation revision below 60 characters.';
  if (!purchaseOrderNumber) errors.purchaseOrderNumber = 'Enter the customer Purchase Order number.';
  else if (!referencePattern.test(purchaseOrderNumber) || purchaseOrderNumber.length > 100) errors.purchaseOrderNumber = 'Use a valid Purchase Order number below 100 characters.';
  if (!validDateOnly(purchaseOrderDate)) errors.purchaseOrderDate = 'Enter a valid Purchase Order date.';
  else if (purchaseOrderDate > today) errors.purchaseOrderDate = 'The Purchase Order date cannot be in the future.';
  if (!items.length) errors.items = 'Add at least one configured product.';
  if (items.some(item => !present(item.productId))) errors.items = 'Every order line must identify a product.';
  if (items.some(item => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 9999)) {
    errors.items = 'Every product must have a quantity between 1 and 9,999.';
  }
  if (data.sourceConfirmed !== true) errors.sourceConfirmed = 'Confirm all representative order checks before submitting.';
  if (confirmationNote.length > 2000) errors.confirmationNote = 'Keep the confirmation note below 2,000 characters.';
  if (submissionKey.length < 8 || submissionKey.length > 160) errors.submission = 'Refresh the form to create a valid duplicate-protection key.';
  if (supportingDocuments.length > 8) errors.supportingDocuments = 'Attach no more than eight supporting documents.';
  if (['price', 'pricing', 'total', 'linePrices'].some(field => data[field] !== undefined)) {
    errors.commercialData = 'Pricing information is not permitted in this preview workflow.';
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the customer order details.');

  validateRequiredSourceDocument(data.quotationFile, 'quotationFile', 'quotation document');
  validateRequiredSourceDocument(data.purchaseOrderFile, 'purchaseOrderFile', 'Purchase Order document');
  if (sameFileMetadata(data.quotationFile, data.purchaseOrderFile)) {
    throwValidation(
      { purchaseOrderFile: 'The quotation and Purchase Order must be two different files.' },
      'Duplicate source documents are not permitted.',
    );
  }
  supportingDocuments.forEach((file, index) => validateRequiredSourceDocument(file, `supportingDocuments.${index}`, 'supporting document'));

  return {
    order: {
      submissionKey,
      customerType,
      companyId,
      customerContactId,
      newCustomer: customerType === 'new' ? newCustomer : null,
      branchId,
      representativeId,
      orderSource,
      orderSourceOther: orderSource === 'other_approved_source' ? orderSourceOther : '',
      application,
      fulfilment,
      deliveryAddress: fulfilment === 'delivery' ? deliveryAddress : '',
      customerNotes,
      internalRepresentativeNotes,
      requiredDate,
      priority,
      quotationNumber,
      quotationDate,
      quotationRevision,
      purchaseOrderNumber,
      purchaseOrderDate,
      confirmationNote,
      sourceConfirmed: true,
      duplicateConfirmed: data.duplicateConfirmed === true,
      items,
    },
    quotationFile: data.quotationFile,
    purchaseOrderFile: data.purchaseOrderFile,
    supportingDocuments,
  };
}

export function validateRepresentativeDocumentReplacement(data = {}) {
  const reason = present(data.reason);
  if (reason.length < 8 || reason.length > 1000) {
    throwValidation({ reason: 'Explain the correction in 8 to 1,000 characters.' }, 'A controlled replacement reason is required.');
  }
  validateRequiredSourceDocument(data.file, 'file', 'replacement document');
  return { reason, file: data.file };
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
  validateDocumentMetadata(file, 'quotationDocumentFile');
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
  const commercialTotal = Number(data.quotationCommercialTotal || 0);

  if (!number) errors.quotationNumber = 'Enter the quotation number.';
  else if (!referencePattern.test(number)) errors.quotationNumber = 'Use letters, numbers and normal reference punctuation only.';
  else if (number.length > 80) errors.quotationNumber = 'Keep the quotation number below 80 characters.';
  if (!validDateOnly(date)) errors.quotationDate = 'Enter a valid quotation date.';
  else if (date > new Date().toISOString().slice(0, 10)) errors.quotationDate = 'The quotation date cannot be in the future.';
  if (!['dated', 'not_applicable'].includes(expiryMode)) errors.quotationExpiryMode = 'Select whether the quotation has an expiry date.';
  if (expiryMode === 'dated') {
    if (!validDateOnly(expiryDate)) errors.quotationExpiryDate = 'Enter a valid quotation expiry date.';
    else if (validDateOnly(date) && expiryDate < date) errors.quotationExpiryDate = 'The expiry date cannot be before the quotation date.';
  }
  if (internalNote.length > 2000) errors.quotationInternalNote = 'Keep the internal note below 2,000 characters.';
  if (customerNote.length > 1000) errors.quotationCustomerNote = 'Keep the customer-facing note below 1,000 characters.';
  if (documentReference.length > 240) errors.quotationDocumentReference = 'Keep the document reference below 240 characters.';
  if (data.quotationCommercialTotal !== undefined && (!Number.isFinite(commercialTotal) || commercialTotal <= 0 || commercialTotal > 999_999_999.99)) {
    errors.quotationCommercialTotal = 'Enter a valid positive quotation total below ZAR 1 billion.';
  }
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
      commercialTotal: commercialTotal > 0 ? Math.round(commercialTotal * 100) / 100 : null,
      currency: commercialTotal > 0 ? 'ZAR' : '',
      subtotal: Number.isFinite(Number(data.quotationSubtotal)) ? Number(data.quotationSubtotal) : null,
      vatTotal: Number.isFinite(Number(data.quotationVatTotal)) ? Number(data.quotationVatTotal) : null,
      extractionStatus: present(data.quotationExtractionStatus) || (commercialTotal > 0 ? 'manually_verified' : 'not_recorded'),
      extractionConfidence: present(data.quotationExtractionConfidence) || (commercialTotal > 0 ? 'manual' : 'none'),
    },
    quotationDocumentFile: documentFile,
  };
}

export function validateAcceptanceDocument(file) {
  if (!file) return;
  validateDocumentMetadata(file, 'acceptanceDocumentFile');
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

export function validateDispatchProof(file) {
  if (!file) return;
  validateDocumentMetadata(file, 'dispatchProofFile');
  if (!ALLOWED_PO_FILE_PATTERN.test(file.name || '')) {
    throwValidation(
      { dispatchProofFile: 'Choose a PDF, DOCX, DOC or image proof file.' },
      'The proof-of-delivery file is not supported.',
    );
  }
  if (Number(file.size || 0) > MAX_DISPATCH_PROOF_BYTES) {
    throwValidation(
      { dispatchProofFile: 'The proof-of-delivery file must be 4 MB or smaller.' },
      'The proof-of-delivery file is too large.',
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
  else if (date > new Date().toISOString().slice(0, 10)) errors.acceptanceDate = 'The acceptance date cannot be in the future.';
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

export function validatePlanningSubmission(data = {}, { today = new Date().toISOString().slice(0, 10) } = {}) {
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
  else if (!referencePattern.test(internalJobNumber)) errors.planningInternalJobNumber = 'Use letters, numbers and normal reference punctuation only.';
  else if (internalJobNumber.length > 100) errors.planningInternalJobNumber = 'Keep the internal job number below 100 characters.';
  if (customerPoNumber.length > 100) errors.planningCustomerPoNumber = 'Keep the customer Purchase Order number below 100 characters.';
  else if (customerPoNumber && !referencePattern.test(customerPoNumber)) errors.planningCustomerPoNumber = 'Use letters, numbers and normal reference punctuation only.';
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
  if (estimatedCompletionDate && validDateOnly(estimatedCompletionDate) && estimatedCompletionDate < today) {
    errors.planningEstimatedCompletionDate = 'The estimated completion date cannot be in the past.';
  }
  if (!assignedPlanningUserId) errors.planningAssignedUserId = 'Select the Planning user responsible for this order.';
  if (!PLANNING_PRIORITY_VALUES.includes(priority)) errors.planningPriority = 'Select a valid Planning priority.';
  if (!validDateOnly(submissionDate)) errors.planningSubmissionDate = 'Enter the Planning submission date.';
  else if (submissionDate > today) errors.planningSubmissionDate = 'The Planning submission date cannot be in the future.';
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
  options = {},
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
  const today = options.today || new Date().toISOString().slice(0, 10);
  const effectiveProgressSteps = options.progressSteps || EXPEDITOR_PROGRESS_STEPS;
  const effectiveDocumentTypes = options.documentTypes || EXPEDITOR_DOCUMENT_TYPES;
  const allowedStepIds = effectiveProgressSteps.map(step => step.id);
  const stepDefinition = effectiveProgressSteps.find(step => step.id === progressStep)
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
  } else if (estimatedCompletionDate && estimatedCompletionDate < today) {
    errors.expeditingEstimatedCompletionDate = 'The estimated completion date cannot be in the past.';
  }
  if (delayReason.length > 1000) errors.expeditingDelayReason = 'Keep the delay reason below 1,000 characters.';
  if (action === 'place_on_hold' && delayReason.length < 5) {
    errors.expeditingDelayReason = 'Record why the order is being placed on hold.';
  }
  if (documentReference.length > 240) errors.expeditingDocumentReference = 'Keep the controlled reference below 240 characters.';
  if (documentReference && !effectiveDocumentTypes.some(type => type.id === documentType)) {
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

const DISPATCH_ACTIONS = Object.freeze([
  'mark_ready_for_collection',
  'start_delivery',
  'confirm_collection',
  'confirm_delivery',
  'complete_collection',
  'complete_delivery',
  'report_delivery_problem',
]);

const dispatchValue = (data, field, legacyField) => (
  data?.dispatchUpdate?.[field]
  ?? data?.[legacyField]
  ?? data?.[field]
);

export function validateDispatchReceipt(data = {}) {
  const input = data.dispatchReceipt || data;
  const sourceDepartment = present(input.sourceDepartment || data.dispatchReceiptSourceDepartment);
  const numberOfPackages = Number(input.numberOfPackages ?? data.dispatchReceiptNumberOfPackages);
  const internalNote = present(input.internalNote || data.dispatchReceiptInternalNote);
  const exceptionReason = present(input.exceptionReason || data.dispatchReceiptExceptionReason);
  const customerMessage = present(
    input.customerMessage
    || data.dispatchReceiptCustomerMessage
    || 'Your order has been received by Dispatch and is being prepared for handover.',
  );
  const allowedSources = ['laboratory', 'quality_assurance', 'expediting', 'planning', 'authorised_exception'];
  const errors = {};
  if (!allowedSources.includes(sourceDepartment)) {
    errors.dispatchReceiptSourceDepartment = 'Select the department that handed the order to Dispatch.';
  }
  if (!Number.isInteger(numberOfPackages) || numberOfPackages < 1 || numberOfPackages > 999) {
    errors.dispatchReceiptNumberOfPackages = 'Enter a package quantity between 1 and 999.';
  }
  if (sourceDepartment === 'authorised_exception' && exceptionReason.length < 10) {
    errors.dispatchReceiptExceptionReason = 'Explain the authorised exception in at least 10 characters.';
  }
  if (internalNote.length > 2000) errors.dispatchReceiptInternalNote = 'Keep the internal note below 2,000 characters.';
  if (customerMessage.length < 5 || customerMessage.length > 1000) {
    errors.dispatchReceiptCustomerMessage = 'Enter a clear customer message below 1,000 characters.';
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the Dispatch receipt information.');
  return {
    sourceDepartment,
    numberOfPackages,
    internalNote,
    exceptionReason,
    customerMessage,
  };
}

export function validateDispatchAction(
  action,
  data = {},
  {
    methods = DISPATCH_METHODS,
    proofTypes = DISPATCH_PROOF_TYPES,
  } = {},
) {
  const errors = {};
  if (!DISPATCH_ACTIONS.includes(action)) {
    throwValidation({ action: 'Select a recognised Dispatch action.' }, 'The Dispatch action is not supported.');
  }

  const method = present(dispatchValue(data, 'method', 'dispatchMethod'));
  const readyDate = present(dispatchValue(data, 'readyDate', 'dispatchReadyDate'));
  const collectionDate = present(dispatchValue(data, 'collectionDate', 'dispatchCollectionDate'));
  const deliveryDate = present(dispatchValue(data, 'deliveryDate', 'dispatchDeliveryDate'));
  const courierOrDriver = present(dispatchValue(data, 'courierOrDriver', 'dispatchCourierOrDriver'));
  const trackingReference = present(dispatchValue(data, 'trackingReference', 'dispatchTrackingReference'));
  const numberOfPackages = Number(dispatchValue(data, 'numberOfPackages', 'dispatchNumberOfPackages'));
  const deliveryNoteNumber = present(dispatchValue(data, 'deliveryNoteNumber', 'dispatchDeliveryNoteNumber'));
  const recipientName = present(dispatchValue(data, 'recipientName', 'dispatchRecipientName'));
  const internalNotes = present(dispatchValue(data, 'internalNotes', 'dispatchInternalNotes'));
  const customerMessage = present(dispatchValue(data, 'customerMessage', 'dispatchCustomerMessage'));
  const problemReason = present(dispatchValue(data, 'problemReason', 'dispatchProblemReason'));
  const proofType = present(
    dispatchValue(data, 'proofType', 'dispatchProofType')
    || data?.dispatchUpdate?.proofOfDelivery?.type,
  );
  const proofReference = present(
    dispatchValue(data, 'proofReference', 'dispatchProofReference')
    || data?.dispatchUpdate?.proofOfDelivery?.reference,
  );
  const proofFile = data?.dispatchProofFile || data?.dispatchUpdate?.proofFile || null;
  const methodDefinition = methods.find(item => item.id === method);

  if (!methodDefinition) errors.dispatchMethod = 'Select a recognised Dispatch method.';
  if (action === 'mark_ready_for_collection' && methodDefinition?.fulfilment !== 'collect') {
    errors.dispatchMethod = 'Collection orders must use the customer collection method.';
  }
  if (['start_delivery', 'confirm_delivery', 'report_delivery_problem'].includes(action) && methodDefinition?.fulfilment !== 'delivery') {
    errors.dispatchMethod = 'Select a delivery method for this action.';
  }
  if (action === 'confirm_collection' && methodDefinition?.fulfilment !== 'collect') {
    errors.dispatchMethod = 'Collection confirmation requires the customer collection method.';
  }

  if (['mark_ready_for_collection', 'start_delivery'].includes(action) && !validDateOnly(readyDate)) {
    errors.dispatchReadyDate = 'Enter the date this order became ready for handover.';
  } else if (readyDate && !validDateOnly(readyDate)) {
    errors.dispatchReadyDate = 'Enter a valid ready date.';
  }
  if (action === 'confirm_collection' && !validDateOnly(collectionDate)) {
    errors.dispatchCollectionDate = 'Enter the confirmed collection date.';
  } else if (collectionDate && !validDateOnly(collectionDate)) {
    errors.dispatchCollectionDate = 'Enter a valid collection date.';
  }
  if (action === 'confirm_delivery' && !validDateOnly(deliveryDate)) {
    errors.dispatchDeliveryDate = 'Enter the confirmed delivery date.';
  } else if (deliveryDate && !validDateOnly(deliveryDate)) {
    errors.dispatchDeliveryDate = 'Enter a valid delivery date.';
  }
  if (readyDate && collectionDate && validDateOnly(readyDate) && validDateOnly(collectionDate) && collectionDate < readyDate) {
    errors.dispatchCollectionDate = 'The collection date cannot be before the ready date.';
  }
  if (readyDate && deliveryDate && validDateOnly(readyDate) && validDateOnly(deliveryDate) && deliveryDate < readyDate) {
    errors.dispatchDeliveryDate = 'The delivery date cannot be before the ready date.';
  }

  if (
    ['mark_ready_for_collection', 'start_delivery'].includes(action)
    && (!Number.isInteger(numberOfPackages) || numberOfPackages < 1 || numberOfPackages > 999)
  ) {
    errors.dispatchNumberOfPackages = 'Enter a package quantity between 1 and 999.';
  }
  if (
    Number.isFinite(numberOfPackages)
    && numberOfPackages !== 0
    && (!Number.isInteger(numberOfPackages) || numberOfPackages < 1 || numberOfPackages > 999)
  ) {
    errors.dispatchNumberOfPackages = 'Enter a package quantity between 1 and 999.';
  }
  if (
    ['start_delivery', 'confirm_delivery'].includes(action)
    && methodDefinition?.fulfilment === 'delivery'
    && courierOrDriver.length < 2
  ) {
    errors.dispatchCourierOrDriver = 'Enter the courier, driver or delivery provider.';
  }
  if (['confirm_collection', 'confirm_delivery'].includes(action) && recipientName.length < 2) {
    errors.dispatchRecipientName = 'Enter the person who received or collected the order.';
  }
  if (action === 'report_delivery_problem' && problemReason.length < 5) {
    errors.dispatchProblemReason = 'Describe the delivery problem clearly.';
  }
  if (customerMessage.length < 5) errors.dispatchCustomerMessage = 'Add a clear customer-facing Dispatch message.';
  else if (customerMessage.length > 1000) errors.dispatchCustomerMessage = 'Keep the customer-facing message below 1,000 characters.';
  if (internalNotes.length > 2000) errors.dispatchInternalNotes = 'Keep internal Dispatch notes below 2,000 characters.';
  if (problemReason.length > 1000) errors.dispatchProblemReason = 'Keep the delivery problem below 1,000 characters.';
  if (courierOrDriver.length > 160) errors.dispatchCourierOrDriver = 'Keep the courier or driver below 160 characters.';
  if (trackingReference.length > 160) errors.dispatchTrackingReference = 'Keep the tracking reference below 160 characters.';
  if (deliveryNoteNumber.length > 160) errors.dispatchDeliveryNoteNumber = 'Keep the delivery note number below 160 characters.';
  if (recipientName.length > 160) errors.dispatchRecipientName = 'Keep the recipient name below 160 characters.';
  if (proofReference.length > 240) errors.dispatchProofReference = 'Keep the proof reference below 240 characters.';
  if ((proofReference || proofFile) && !proofTypes.some(type => type.id === proofType)) {
    errors.dispatchProofType = 'Select the type of proof being recorded.';
  }
  if (proofType && !proofReference && !proofFile) {
    errors.dispatchProofReference = 'Enter a controlled proof reference or choose a proof file.';
  }
  if (Object.keys(errors).length) throwValidation(errors, 'Check the Dispatch information.');
  validateDispatchProof(proofFile);

  return {
    dispatchUpdate: {
      method,
      readyDate,
      collectionDate,
      deliveryDate,
      courierOrDriver,
      trackingReference,
      numberOfPackages: Number.isInteger(numberOfPackages) && numberOfPackages > 0 ? numberOfPackages : 0,
      deliveryNoteNumber,
      recipientName,
      internalNotes,
      customerMessage,
      problemReason,
      proofOfDelivery: proofType ? {
        type: proofType,
        reference: proofReference,
        storageStatus: 'metadata_only',
        customerVisible: true,
      } : null,
      customerVisible: true,
    },
    dispatchProofFile: proofFile,
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
