import { ServiceError, USER_ROLES } from '../services/contracts.js';

export const RFQ_QUOTATION_STATUSES = Object.freeze([
  'draft', 'submitted', 'assigned_to_rep', 'under_rep_review', 'quotation_preparation',
  'quotation_sent', 'awaiting_customer_response', 'quotation_rejected',
  'amended_quotation_preparation', 'amended_quotation_sent',
  'customer_accepted_pending_rep_verification', 'po_correction_required',
  'converted_to_order', 'closed_rejected', 'expired', 'cancelled',
]);

export const QUOTATION_STATUSES = Object.freeze([
  'draft', 'ready_to_send', 'sent', 'awaiting_customer_response',
  'customer_accepted', 'customer_rejected', 'superseded', 'expired',
  'converted_to_order', 'rejection_acknowledged',
]);

export const DOCUMENT_CATEGORIES = Object.freeze([
  'customer_supporting_document', 'representative_quotation', 'customer_purchase_order',
  'corrected_purchase_order', 'planning_document', 'expediting_document',
  'dispatch_document', 'delivery_note', 'courier_note', 'proof_of_delivery',
  'internal_operational_document', 'other_internal_document',
]);

export const REJECTION_CATEGORIES = Object.freeze([
  'price_too_high', 'incorrect_product', 'incorrect_quantity', 'incorrect_configuration',
  'delivery_time_unacceptable', 'terms_unacceptable', 'missing_information',
  'customer_no_longer_requires_item', 'alternative_supplier_selected', 'other',
]);

export const CUSTOMER_DOWNLOADABLE_CATEGORIES = Object.freeze([
  'representative_quotation', 'customer_purchase_order', 'corrected_purchase_order',
  'delivery_note', 'courier_note',
]);

export const INTERNAL_DOCUMENT_ROLES = Object.freeze([
  USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.PLANNING, USER_ROLES.EXPEDITOR,
  USER_ROLES.DISPATCH, USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR,
]);

const ALLOWED_DOCUMENTS = Object.freeze({
  representative_quotation: {
    extensions: ['pdf', 'docx', 'xlsx'],
    mimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  customer_purchase_order: {
    extensions: ['pdf', 'docx', 'xlsx'],
    mimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
});

export const MAX_WORKFLOW_DOCUMENT_BYTES = 10 * 1024 * 1024;

const text = value => String(value || '').trim();
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value));
const id = (prefix, now = Date.now()) => `${prefix}-${now}-${Math.random().toString(36).slice(2, 9)}`;
const fail = (message, fieldErrors, code = 'VALIDATION_ERROR', status = 422) => {
  throw new ServiceError(message, { code, status, fieldErrors });
};

export function validateWorkflowDocument(file, category, existingDocuments = []) {
  const errors = {};
  const policy = ALLOWED_DOCUMENTS[category];
  if (!file) errors.document = 'Attach the required document.';
  if (!policy) errors.category = 'This document category is not accepted by this workflow action.';
  const filename = text(file?.name);
  const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  if (file && (!filename || filename.startsWith('.') || /[<>:"/\\|?*\u0000-\u001f]/.test(filename))) {
    errors.document = 'Use a safe, descriptive filename.';
  }
  if (file && policy && !policy.extensions.includes(extension)) errors.document = `Use ${policy.extensions.map(item => item.toUpperCase()).join(', ')}. PDF is preferred.`;
  if (file && policy && file.type && !policy.mimes.includes(file.type)) errors.document = 'The file MIME type does not match an approved document type.';
  if (file && Number(file.size || 0) <= 0) errors.document = 'The attached file is empty.';
  if (file && Number(file.size || 0) > MAX_WORKFLOW_DOCUMENT_BYTES) errors.document = 'The document must be 10 MB or smaller.';
  if (file && /\.(exe|js|mjs|cjs|html?|svg|bat|cmd|ps1|sh|zip|rar|7z)(\.|$)/i.test(filename)) errors.document = 'Executable, script, archive and active-content files are not supported.';
  if (file && existingDocuments.some(document => document.originalFilename?.toLowerCase() === filename.toLowerCase()
    && Number(document.fileSize || 0) === Number(file.size || 0) && document.active !== false)) {
    errors.document = 'This file has already been uploaded.';
  }
  if (Object.keys(errors).length) fail(Object.values(errors)[0], errors, 'INVALID_DOCUMENT');
  return { filename, extension };
}

export function createDocumentMetadata({
  file, category, rfq, quotationVersionId = '', orderId = '', actor, now = new Date(),
  customerVisible = false, internalVisible = true, version = 1,
}) {
  validateWorkflowDocument(file, category, rfq.documents || []);
  const createdAt = now.toISOString();
  return Object.freeze({
    id: id('document', now.getTime()), companyId: rfq.companyId, rfqId: rfq.id,
    quotationVersionId, orderId, category, originalFilename: text(file.name),
    storageKey: `mock-metadata/${rfq.companyId}/${id('file', now.getTime())}`,
    mimeType: file.type || 'application/octet-stream', fileSize: Number(file.size),
    uploadedBy: actor.id, uploadedRole: actor.role, uploadedAt: createdAt,
    customerVisible, internalVisible, integrity: { algorithm: 'sha256', digest: 'mock-not-calculated' },
    version, active: true, supersededAt: '', storageStatus: 'metadata_only',
    demonstrationFile: true,
  });
}

export function sendQuotation({ rfq, actor, input, now = new Date() }) {
  if (![USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR].includes(actor.role)) {
    fail('Your role cannot send quotations.', {}, 'FORBIDDEN', 403);
  }
  if (actor.role === USER_ROLES.SALES_REPRESENTATIVE && rfq.selectedRep?.id !== actor.representativeId) {
    fail('Only the assigned representative may send this quotation.', {}, 'FORBIDDEN', 403);
  }
  const errors = {};
  if (!text(input.quotationNumber)) errors.quotationNumber = 'Enter the quotation number.';
  if (!dateOnly(input.quotationDate)) errors.quotationDate = 'Enter a valid quotation date.';
  if (!dateOnly(input.quotationExpiryDate) || input.quotationExpiryDate < input.quotationDate) errors.quotationExpiryDate = 'Enter an expiry date on or after the quotation date.';
  if (text(input.customerMessage).length < 5) errors.customerMessage = 'Add a customer-facing message.';
  if (Object.keys(errors).length) fail(Object.values(errors)[0], errors);
  const previous = (rfq.quotationVersions || []).find(version => version.isCurrent);
  const nextVersion = Math.max(0, ...(rfq.quotationVersions || []).map(version => Number(version.versionNumber) || 0)) + 1;
  const quotationId = rfq.quotationId || id('quotation', now.getTime());
  const quotationVersionId = id('quotation-version', now.getTime());
  const document = createDocumentMetadata({
    file: input.documentFile, category: 'representative_quotation', rfq,
    quotationVersionId, actor, now, customerVisible: true, version: nextVersion,
  });
  const versions = (rfq.quotationVersions || []).map(version => version.isCurrent
    ? { ...version, isCurrent: false, status: 'superseded', supersededByVersionId: quotationVersionId, supersededAt: now.toISOString() }
    : version);
  const current = Object.freeze({
    id: quotationVersionId, quotationId, rfqId: rfq.id, companyId: rfq.companyId,
    versionNumber: nextVersion, quotationNumber: text(input.quotationNumber),
    quotationDate: input.quotationDate, expiryDate: input.quotationExpiryDate,
    documentId: document.id, document, sentBy: actor.id, sentByName: actor.displayName,
    sentAt: now.toISOString(), customerMessage: text(input.customerMessage),
    internalNote: text(input.internalNote), status: 'awaiting_customer_response',
    isCurrent: true, supersedesVersionId: previous?.id || '', supersededByVersionId: '',
  });
  return {
    ...rfq, quotationId, quotationVersions: [...versions, current],
    documents: [...(rfq.documents || []), document],
    trackingStatus: nextVersion === 1 ? 'awaiting_customer_response' : 'amended_quotation_sent',
    updatedAt: now.toISOString(),
  };
}

export function rejectQuotation({ rfq, actor, input, now = new Date() }) {
  const current = (rfq.quotationVersions || []).find(version => version.isCurrent);
  if (actor.role !== USER_ROLES.CUSTOMER || actor.companyId !== rfq.companyId) fail('You cannot reject this quotation.', {}, 'FORBIDDEN', 403);
  if (!current || current.status !== 'awaiting_customer_response') fail('This quotation is no longer available for a response.', {}, 'STALE_QUOTATION', 409);
  const category = text(input.category);
  const explanation = text(input.explanation);
  const errors = {};
  if (!REJECTION_CATEGORIES.includes(category)) errors.rejectionCategory = 'Choose a rejection category.';
  if (explanation.length < 10 || !/[a-z]{3}/i.test(explanation)) errors.rejectionExplanation = 'Provide a meaningful explanation of at least 10 characters.';
  if (category === 'other' && explanation.length < 15) errors.rejectionExplanation = 'Explain the other rejection reason in detail.';
  if (Object.keys(errors).length) fail(Object.values(errors)[0], errors);
  const rejection = Object.freeze({
    id: id('rejection', now.getTime()), quotationVersionId: current.id, companyId: rfq.companyId,
    category, explanation, rejectedBy: actor.id, rejectedAt: now.toISOString(),
  });
  return {
    ...rfq,
    quotationVersions: rfq.quotationVersions.map(version => version.id === current.id ? { ...version, status: 'customer_rejected' } : version),
    quotationRejections: [...(rfq.quotationRejections || []), rejection],
    trackingStatus: 'quotation_rejected', updatedAt: now.toISOString(),
  };
}

export function acceptQuotation({ rfq, actor, input, now = new Date() }) {
  const current = (rfq.quotationVersions || []).find(version => version.isCurrent);
  if (actor.role !== USER_ROLES.CUSTOMER || actor.companyId !== rfq.companyId) fail('You cannot accept this quotation.', {}, 'FORBIDDEN', 403);
  if (!current || current.status !== 'awaiting_customer_response') fail('Only the current quotation can be accepted.', {}, 'STALE_QUOTATION', 409);
  if (!text(input.purchaseOrderNumber)) fail('Enter the Purchase Order number.', { purchaseOrderNumber: 'Enter the Purchase Order number.' });
  if (input.confirmed !== true) fail('Confirm that the Purchase Order relates to this quotation.', { confirmed: 'Confirmation is required.' });
  if ((rfq.purchaseOrders || []).some(po => po.quotationVersionId === current.id && po.active)) fail('A Purchase Order was already submitted for this quotation.', {}, 'DUPLICATE_PO', 409);
  const document = createDocumentMetadata({
    file: input.documentFile, category: 'customer_purchase_order', rfq,
    quotationVersionId: current.id, actor, now, customerVisible: true, version: 1,
  });
  const purchaseOrder = Object.freeze({
    id: id('purchase-order', now.getTime()), companyId: rfq.companyId, rfqId: rfq.id,
    quotationVersionId: current.id, number: text(input.purchaseOrderNumber),
    documentId: document.id, document, customerMessage: text(input.customerMessage),
    uploadedBy: actor.id, uploadedAt: now.toISOString(), status: 'awaiting_verification',
    active: true, version: 1,
  });
  return {
    ...rfq,
    quotationVersions: rfq.quotationVersions.map(version => version.id === current.id ? { ...version, status: 'customer_accepted' } : version),
    purchaseOrders: [...(rfq.purchaseOrders || []), purchaseOrder],
    documents: [...(rfq.documents || []), document],
    acceptedQuotationVersionId: current.id,
    customerAcceptedAt: now.toISOString(), customerAcceptedBy: actor.id,
    trackingStatus: 'customer_accepted_pending_rep_verification', updatedAt: now.toISOString(),
  };
}

export function closeRejectedRfq({ rfq, actor, input, now = new Date() }) {
  if (![USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR].includes(actor.role)) fail('Your role cannot close this RFQ.', {}, 'FORBIDDEN', 403);
  if (rfq.trackingStatus !== 'quotation_rejected') fail('Only a rejected RFQ may be closed here.', {}, 'INVALID_STATE', 409);
  if (text(input.closureReason).length < 10) fail('Provide a meaningful closure reason.', { closureReason: 'Provide at least 10 characters.' });
  if (input.confirmed !== true) fail('Confirm the RFQ closure.', { confirmed: 'Confirmation is required.' });
  return {
    ...rfq, trackingStatus: 'closed_rejected', closedAt: now.toISOString(), closedBy: actor.id,
    closureReason: text(input.closureReason), closureInternalNote: text(input.internalNote),
    quotationVersions: (rfq.quotationVersions || []).map(version => version.isCurrent ? { ...version, status: 'rejection_acknowledged' } : version),
    updatedAt: now.toISOString(),
  };
}

export function canDownloadDocument({ actor, record, document }) {
  if (!actor || !record || !document || actor.companyId !== document.companyId && actor.role === USER_ROLES.CUSTOMER) return false;
  if (actor.role === USER_ROLES.CUSTOMER) {
    return document.customerVisible === true && CUSTOMER_DOWNLOADABLE_CATEGORIES.includes(document.category) && actor.companyId === record.companyId;
  }
  if (!INTERNAL_DOCUMENT_ROLES.includes(actor.role) || document.internalVisible !== true) return false;
  if ([USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR].includes(actor.role)) return true;
  if (actor.role === USER_ROLES.SALES_REPRESENTATIVE) return record.selectedRep?.id === actor.representativeId;
  const stageCategory = {
    [USER_ROLES.PLANNING]: ['customer_supporting_document', 'representative_quotation', 'customer_purchase_order', 'corrected_purchase_order', 'planning_document'],
    [USER_ROLES.EXPEDITOR]: ['customer_supporting_document', 'planning_document', 'expediting_document', 'delivery_note'],
    [USER_ROLES.DISPATCH]: ['dispatch_document', 'delivery_note', 'courier_note', 'proof_of_delivery'],
  };
  return (stageCategory[actor.role] || []).includes(document.category);
}

export function verifyAndCreateOrder({ rfq, actor, input = {}, now = new Date(), orderId, orderReference }) {
  if (![USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.MANAGER, USER_ROLES.ADMINISTRATOR].includes(actor.role)) fail('Your role cannot verify a PO.', {}, 'FORBIDDEN', 403);
  if (rfq.orderId) return { rfq, order: null, idempotent: true };
  if (input.verified !== true) fail('Confirm that you verified the Purchase Order.', { verified: 'Verification confirmation is required.' });
  const quotation = (rfq.quotationVersions || []).find(version => version.id === rfq.acceptedQuotationVersionId);
  const purchaseOrder = (rfq.purchaseOrders || []).find(po => po.quotationVersionId === quotation?.id && po.active);
  if (!quotation || quotation.status !== 'customer_accepted' || !purchaseOrder) fail('An accepted current quotation and Purchase Order are required.', {}, 'ACCEPTANCE_NOT_VERIFIABLE', 409);
  const createdAt = now.toISOString();
  const order = {
    id: orderId, reference: orderReference, version: 0, workflowType: 'order', trackingStatus: 'awaiting_planning',
    companyId: rfq.companyId, company: rfq.company, accountId: rfq.accountId, contact: rfq.contact,
    email: rfq.email, phone: rfq.phone, selectedRep: rfq.selectedRep, representativeId: rfq.representativeId,
    sourceEnquiryId: rfq.id, sourceRfqReference: rfq.reference, acceptedQuotationVersionId: quotation.id,
    quotationVersions: rfq.quotationVersions, purchaseOrders: rfq.purchaseOrders, documents: rfq.documents,
    customerPoNumber: purchaseOrder.number, items: rfq.items, createdAt, updatedAt: createdAt, trackingHistory: [],
  };
  return {
    rfq: {
      ...rfq, orderId, orderReference, trackingStatus: 'converted_to_order', convertedToOrderAt: createdAt,
      quotationVersions: rfq.quotationVersions.map(version => version.id === quotation.id ? { ...version, status: 'converted_to_order' } : version),
      purchaseOrders: rfq.purchaseOrders.map(po => po.id === purchaseOrder.id ? { ...po, status: 'verified', verifiedAt: createdAt, verifiedBy: actor.id } : po),
      updatedAt: createdAt,
    },
    order,
    idempotent: false,
  };
}
