import { ServiceError } from './contracts.js';

export const MAX_PO_FILE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_PO_FILE_PATTERN = /\.(pdf|doc|docx|png|jpe?g|webp|gif|heic)$/i;

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
