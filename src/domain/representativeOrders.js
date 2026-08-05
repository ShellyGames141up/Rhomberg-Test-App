export const ORDER_ORIGINS = Object.freeze({
  CUSTOMER_RFQ: 'customer_submitted_rfq_order',
  REPRESENTATIVE_LOADED: 'representative_loaded_order',
});

export const REPRESENTATIVE_ORDER_SOURCES = Object.freeze([
  Object.freeze({ id: 'email', label: 'Email' }),
  Object.freeze({ id: 'telephone', label: 'Telephone' }),
  Object.freeze({ id: 'in_person', label: 'In-person' }),
  Object.freeze({ id: 'existing_quotation', label: 'Existing quotation' }),
  Object.freeze({ id: 'other_approved_source', label: 'Other approved source' }),
]);

export const REPRESENTATIVE_ORDER_SOURCE_IDS = Object.freeze(
  REPRESENTATIVE_ORDER_SOURCES.map(source => source.id),
);

export const REPRESENTATIVE_ORDER_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

const stableConfiguration = configuration => Object.fromEntries(
  Object.entries(configuration || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value]),
);

export const representativeOrderProductSignature = items => JSON.stringify(
  (items || [])
    .map(item => ({
      productId: String(item.productId || ''),
      quantity: Number(item.quantity || 0),
      configuration: stableConfiguration(item.configuration),
    }))
    .sort((left, right) => `${left.productId}:${JSON.stringify(left.configuration)}`
      .localeCompare(`${right.productId}:${JSON.stringify(right.configuration)}`)),
);

const comparableReference = value => String(value || '').trim().toUpperCase();

export const findRepresentativeOrderDuplicates = ({ candidate, orders, now = new Date() }) => {
  const candidateSignature = representativeOrderProductSignature(candidate.items);
  const candidatePo = comparableReference(candidate.purchaseOrderNumber);
  const candidateQuotation = comparableReference(candidate.quotationNumber);
  const nowMs = new Date(now).getTime();

  const matches = (orders || []).filter(order => {
    if (order.companyId !== candidate.companyId || order.trackingStatus === 'cancelled') return false;
    const samePo = candidatePo && comparableReference(order.purchaseOrderNumber || order.customerPoNumber || order.poNumber) === candidatePo;
    const sameQuotation = candidateQuotation && comparableReference(order.quotationNumber || order.quotation?.number) === candidateQuotation;
    const sameProducts = candidateSignature === representativeOrderProductSignature(order.items);
    const submittedAt = new Date(order.createdAt || order.updatedAt || 0).getTime();
    const recent = Number.isFinite(submittedAt) && Math.abs(nowMs - submittedAt) <= REPRESENTATIVE_ORDER_DUPLICATE_WINDOW_MS;
    return samePo || sameQuotation || (sameProducts && recent);
  }).map(order => ({
    orderId: order.id,
    orderReference: order.reference,
    samePurchaseOrderNumber: comparableReference(order.purchaseOrderNumber || order.customerPoNumber || order.poNumber) === candidatePo,
    sameQuotationNumber: comparableReference(order.quotationNumber || order.quotation?.number) === candidateQuotation,
    sameProductLines: representativeOrderProductSignature(order.items) === candidateSignature,
    createdAt: order.createdAt,
  }));

  return Object.freeze({
    likelyDuplicate: matches.length > 0,
    requiresExplicitConfirmation: matches.length > 0,
    checkedAt: new Date(now).toISOString(),
    matches,
  });
};

export const representativeOrderDocumentMetadata = ({
  id,
  type,
  file,
  uploadedAt,
  uploadedBy,
  version = 1,
  replacesDocumentId = '',
  replacementReason = '',
  customerVisible = type === 'customer_quotation' || type === 'purchase_order',
}) => ({
  id,
  documentType: type,
  fileName: file.name,
  mimeType: file.type || 'application/octet-stream',
  sizeBytes: Number(file.size || 0),
  version,
  isCurrentVersion: true,
  replacesDocumentId,
  replacementReason,
  customerVisible,
  uploadedAt,
  uploadedBy,
  storageStatus: 'metadata_only',
  malwareScanStatus: 'production_backend_required',
});
