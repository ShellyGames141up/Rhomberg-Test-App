import { accountCan, PERMISSIONS, ServiceError } from '../services/contracts.js';

const freeze = values => Object.freeze([...values]);
const clean = value => String(value || '').trim();

export const TECHNICAL_SUPPORT_CATEGORIES = freeze([
  'product_selection',
  'product_compatibility',
  'product_configuration',
  'application_suitability',
  'material_suitability',
  'pressure_range',
  'temperature_range',
  'connection_requirement',
  'electrical_requirement',
  'calibration_requirement',
  'sanas_or_traceable_requirement',
  'special_manufacturing_request',
  'installation_question',
  'missing_technical_information',
  'other',
]);

export const TECHNICAL_SUPPORT_PRIORITIES = freeze(['standard', 'high', 'urgent']);
export const TECHNICAL_MESSAGE_CLASSIFICATIONS = freeze(['internal_only', 'customer_safe']);
export const TECHNICAL_INFORMATION_TARGETS = freeze(['representative', 'customer']);
export const TECHNICAL_SUPPORT_ALLOWANCE_HOURS = 24;
export const MAX_TECHNICAL_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export const TECHNICAL_SUPPORT_STATUSES = Object.freeze({
  technical_support_requested: Object.freeze({ label: 'New request', customerLabel: 'Technical review required', terminal: false }),
  technical_support_assigned: Object.freeze({ label: 'Assigned', customerLabel: 'Technical review required', terminal: false }),
  technical_review_in_progress: Object.freeze({ label: 'In progress', customerLabel: 'Technical review in progress', terminal: false }),
  awaiting_representative_information: Object.freeze({ label: 'Awaiting Sales response', customerLabel: 'Technical review in progress', terminal: false }),
  awaiting_customer_information: Object.freeze({ label: 'Awaiting customer information', customerLabel: 'Additional information required', terminal: false }),
  technical_response_submitted: Object.freeze({ label: 'Response submitted', customerLabel: 'Technical review in progress', terminal: false }),
  technical_support_completed: Object.freeze({ label: 'Completed', customerLabel: 'Technical review completed', terminal: true }),
  technical_support_cancelled: Object.freeze({ label: 'Closed', customerLabel: 'Technical review closed', terminal: true }),
});

export const TECHNICAL_SUPPORT_TRANSITIONS = Object.freeze([
  Object.freeze({ action: 'assign', from: ['technical_support_requested'], to: 'technical_support_assigned', permission: PERMISSIONS.ASSIGN_TECHNICAL_SUPPORT, label: 'Assign request' }),
  Object.freeze({ action: 'start_review', from: ['technical_support_assigned'], to: 'technical_review_in_progress', permission: PERMISSIONS.RESPOND_TECHNICAL_SUPPORT, label: 'Start technical review' }),
  Object.freeze({ action: 'request_representative_information', from: ['technical_support_assigned', 'technical_review_in_progress', 'technical_response_submitted'], to: 'awaiting_representative_information', permission: PERMISSIONS.RESPOND_TECHNICAL_SUPPORT, label: 'Request Sales information' }),
  Object.freeze({ action: 'forward_customer_information_request', from: ['awaiting_representative_information'], to: 'awaiting_customer_information', permission: PERMISSIONS.REQUEST_TECHNICAL_SUPPORT, label: 'Request customer information' }),
  Object.freeze({ action: 'representative_reply', from: ['awaiting_representative_information'], to: 'technical_review_in_progress', permission: PERMISSIONS.REQUEST_TECHNICAL_SUPPORT, label: 'Send response to Technical Support' }),
  Object.freeze({ action: 'customer_reply', from: ['awaiting_customer_information'], to: 'technical_review_in_progress', permission: PERMISSIONS.RESPOND_CUSTOMER_TECHNICAL_REQUEST, label: 'Reply to information request' }),
  Object.freeze({ action: 'submit_response', from: ['technical_support_assigned', 'technical_review_in_progress', 'awaiting_representative_information', 'awaiting_customer_information'], to: 'technical_response_submitted', permission: PERMISSIONS.RESPOND_TECHNICAL_SUPPORT, label: 'Send response to Representative' }),
  Object.freeze({ action: 'approve_configuration', from: ['technical_support_assigned', 'technical_review_in_progress', 'technical_response_submitted'], to: 'technical_response_submitted', permission: PERMISSIONS.RESPOND_TECHNICAL_SUPPORT, label: 'Approve technical configuration' }),
  Object.freeze({ action: 'complete', from: ['technical_response_submitted'], to: 'technical_support_completed', permission: PERMISSIONS.COMPLETE_TECHNICAL_SUPPORT, label: 'Complete technical review' }),
  Object.freeze({ action: 'cancel', from: Object.keys(TECHNICAL_SUPPORT_STATUSES).filter(status => !TECHNICAL_SUPPORT_STATUSES[status].terminal), to: 'technical_support_cancelled', permission: PERMISSIONS.MANAGE_TECHNICAL_SUPPORT, label: 'Close technical request' }),
]);

const supportedAttachment = file => {
  const name = clean(file?.name).toLowerCase();
  const type = clean(file?.type).toLowerCase();
  return /\.(pdf|doc|docx|png|jpe?g|webp)$/i.test(name)
    && (type === 'application/pdf'
      || type === 'application/msword'
      || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || type.startsWith('image/'));
};

export const validateTechnicalAttachment = (file, field = 'attachment') => {
  if (!file) return null;
  if (!Number.isFinite(Number(file.size)) || Number(file.size) < 1) {
    throw new ServiceError('Choose a non-empty technical attachment.', { code: 'TECHNICAL_ATTACHMENT_INVALID', status: 422, fieldErrors: { [field]: 'Choose a non-empty file.' } });
  }
  if (Number(file.size) > MAX_TECHNICAL_ATTACHMENT_BYTES) {
    throw new ServiceError('The technical attachment is too large.', { code: 'TECHNICAL_ATTACHMENT_INVALID', status: 422, fieldErrors: { [field]: 'Use a file no larger than 4 MB.' } });
  }
  if (!supportedAttachment(file)) {
    throw new ServiceError('Choose an approved PDF, Word document or image.', { code: 'TECHNICAL_ATTACHMENT_INVALID', status: 422, fieldErrors: { [field]: 'Choose a PDF, DOC, DOCX, PNG, JPG or WEBP file.' } });
  }
  return file;
};

export const validateTechnicalSupportRequest = (input = {}, rfq = {}) => {
  const category = clean(input.category);
  const question = clean(input.question);
  const lineItemId = clean(input.lineItemId);
  const priority = clean(input.priority) || 'standard';
  const requestedDepartment = clean(input.requestedDepartment);
  const classification = clean(input.classification);
  const otherExplanation = clean(input.otherExplanation);
  const fieldErrors = {};
  if (!TECHNICAL_SUPPORT_CATEGORIES.includes(category)) fieldErrors.category = 'Select a technical assistance category.';
  if (question.length < 10) fieldErrors.question = 'Explain the technical question in at least 10 characters.';
  if (question.length > 4000) fieldErrors.question = 'Keep the technical question below 4,000 characters.';
  if (!(rfq.items || []).some(item => item.lineId === lineItemId)) fieldErrors.lineItemId = 'Select the RFQ line item that needs technical review.';
  if (!TECHNICAL_SUPPORT_PRIORITIES.includes(priority)) fieldErrors.priority = 'Select a valid internal technical priority.';
  if (!TECHNICAL_MESSAGE_CLASSIFICATIONS.includes(classification)) fieldErrors.classification = 'Choose whether the request summary is customer-safe or internal-only.';
  if (category === 'other' && otherExplanation.length < 10) fieldErrors.otherExplanation = 'Explain the other technical category in at least 10 characters.';
  if (input.confirmRequired !== true) fieldErrors.confirmRequired = 'Confirm that technical assistance is required before quotation.';
  validateTechnicalAttachment(input.attachment);
  if (Object.keys(fieldErrors).length) throw new ServiceError(Object.values(fieldErrors)[0], { code: 'TECHNICAL_SUPPORT_REQUEST_INVALID', status: 422, fieldErrors });
  return {
    category,
    otherExplanation,
    question,
    lineItemId,
    priority,
    requestedDepartment,
    requestedTechnicalUserId: clean(input.requestedTechnicalUserId),
    classification,
    confirmRequired: true,
    attachment: input.attachment || null,
  };
};

export const validateTechnicalMessage = (input = {}, { customer = false } = {}) => {
  const message = clean(input.message);
  const classification = customer ? 'customer_safe' : clean(input.classification);
  const fieldErrors = {};
  if (message.length < 2) fieldErrors.message = 'Enter a message.';
  if (message.length > 4000) fieldErrors.message = 'Keep the message below 4,000 characters.';
  if (!TECHNICAL_MESSAGE_CLASSIFICATIONS.includes(classification)) fieldErrors.classification = 'Choose a message visibility.';
  validateTechnicalAttachment(input.attachment);
  if (Object.keys(fieldErrors).length) throw new ServiceError(Object.values(fieldErrors)[0], { code: 'TECHNICAL_MESSAGE_INVALID', status: 422, fieldErrors });
  return { message, classification, attachment: input.attachment || null };
};

export const validateTechnicalResponse = (input = {}) => {
  const response = clean(input.response);
  const recommendation = clean(input.recommendation);
  const fieldErrors = {};
  if (response.length < 10) fieldErrors.response = 'Enter a clear technical response.';
  if (recommendation.length < 5) fieldErrors.recommendation = 'Record the technical recommendation.';
  if (clean(input.internalNote).length > 4000) fieldErrors.internalNote = 'Keep the internal note below 4,000 characters.';
  if (clean(input.customerSafeNote).length > 2000) fieldErrors.customerSafeNote = 'Keep the customer-safe note below 2,000 characters.';
  validateTechnicalAttachment(input.attachment);
  if (Object.keys(fieldErrors).length) throw new ServiceError(Object.values(fieldErrors)[0], { code: 'TECHNICAL_RESPONSE_INVALID', status: 422, fieldErrors });
  return {
    response,
    recommendation,
    approvedProductOrConfiguration: clean(input.approvedProductOrConfiguration),
    conditions: clean(input.conditions),
    additionalInformationRequired: clean(input.additionalInformationRequired),
    internalNote: clean(input.internalNote),
    customerSafeNote: clean(input.customerSafeNote),
    recommendedQuotationWording: clean(input.recommendedQuotationWording),
    certificationRequirement: clean(input.certificationRequirement),
    riskWarning: clean(input.riskWarning),
    attachment: input.attachment || null,
    attachmentCustomerVisible: input.attachmentCustomerVisible === true,
  };
};

export const technicalTransitionFor = (request, action) => TECHNICAL_SUPPORT_TRANSITIONS.find(transition => (
  transition.action === action && transition.from.includes(request?.status)
)) || null;

export const assertTechnicalTransition = (request, action, account) => {
  const transition = technicalTransitionFor(request, action);
  if (!transition) throw new ServiceError('This Technical Support action is not available at the current stage.', { code: 'TECHNICAL_TRANSITION_INVALID', status: 409 });
  if (!accountCan(account, transition.permission)) throw new ServiceError('Your role cannot perform this Technical Support action.', { code: 'FORBIDDEN', status: 403 });
  return transition;
};

export const isTechnicalSupportActive = request => Boolean(request && !TECHNICAL_SUPPORT_STATUSES[request.status]?.terminal);
export const isQuotationBlockedByTechnicalSupport = rfq => (
  isTechnicalSupportActive(rfq?.technicalSupport)
  && rfq?.technicalSupport?.quotationOverride?.active !== true
);

export const addHours = (value, hours) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export const technicalSupportMetrics = requests => {
  const list = [...(requests || [])];
  const completed = list.filter(request => request.completedAt);
  const completedDurations = completed.map(request => (new Date(request.completedAt) - new Date(request.requestedAt)) / 36e5).filter(Number.isFinite);
  const categoryCounts = Object.fromEntries(TECHNICAL_SUPPORT_CATEGORIES.map(category => [category, list.filter(request => request.category === category).length]));
  const monthlyCounts = Object.fromEntries([...new Set(list.map(request => String(request.requestedAt || '').slice(0, 7)).filter(Boolean))].map(month => [month, list.filter(request => String(request.requestedAt || '').startsWith(month)).length]));
  return {
    total: list.length,
    completed: completed.length,
    completedWithin24Hours: completed.filter(request => new Date(request.completedAt) <= new Date(addHours(request.requestedAt, 24))).length,
    overdue: list.filter(request => isTechnicalSupportActive(request) && new Date(request.revisedQuotationTargetAt) < new Date()).length,
    awaitingCustomerInformation: list.filter(request => request.status === 'awaiting_customer_information').length,
    quotationExtensions: list.filter(request => request.extensionAppliedAt).length,
    quotationDelaysCausedByTechnicalReview: list.filter(request => request.extensionAppliedAt).length,
    highPriority: list.filter(request => ['high', 'urgent'].includes(request.priority)).length,
    averageResponseHours: completedDurations.length ? Math.round((completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length) * 10) / 10 : 0,
    categories: categoryCounts,
    requestsPerMonth: monthlyCounts,
    mostCommonCategory: Object.entries(categoryCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || '',
  };
};

export const technicalStatusLabel = status => TECHNICAL_SUPPORT_STATUSES[status]?.label || String(status || '').replaceAll('_', ' ');
