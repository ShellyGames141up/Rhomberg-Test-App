export const DISPATCH_METHODS = Object.freeze([
  Object.freeze({ id: 'collection', label: 'Customer collection', fulfilment: 'collect' }),
  Object.freeze({ id: 'company_delivery', label: 'Rhomberg company delivery', fulfilment: 'delivery' }),
  Object.freeze({ id: 'courier', label: 'Courier', fulfilment: 'delivery' }),
  Object.freeze({ id: 'third_party_delivery', label: 'Third-party delivery', fulfilment: 'delivery' }),
]);

export const DISPATCH_PROOF_TYPES = Object.freeze([
  Object.freeze({ id: 'signed_delivery_note', label: 'Signed delivery note' }),
  Object.freeze({ id: 'collection_confirmation', label: 'Collection confirmation' }),
  Object.freeze({ id: 'courier_confirmation', label: 'Courier confirmation' }),
  Object.freeze({ id: 'photograph', label: 'Photograph reference' }),
  Object.freeze({ id: 'other', label: 'Other controlled proof' }),
]);

export const DISPATCH_PRIMARY_QUEUE_STATUSES = Object.freeze([
  'awaiting_lab_receipt_dispatch',
  'awaiting_dispatch',
  'ready_for_collection',
  'out_for_delivery',
]);

export const DISPATCH_COMPLETION_STATUSES = Object.freeze([
  'delivered',
  'collected',
]);

export const DISPATCH_QUEUE_STATUSES = Object.freeze([
  ...DISPATCH_PRIMARY_QUEUE_STATUSES,
  ...DISPATCH_COMPLETION_STATUSES,
]);

export const DISPATCH_QUEUE_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All Dispatch work' }),
  Object.freeze({ id: 'laboratory_receipt', label: 'Laboratory receipt' }),
  Object.freeze({ id: 'awaiting_dispatch', label: 'Awaiting Dispatch' }),
  Object.freeze({ id: 'collection', label: 'Collection orders' }),
  Object.freeze({ id: 'delivery', label: 'Delivery orders' }),
  Object.freeze({ id: 'handover_confirmed', label: 'Handover confirmed' }),
  Object.freeze({ id: 'emergency', label: 'Emergency orders' }),
]);

export const DISPATCH_SORT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'received_oldest', label: 'Dispatch received · oldest first' }),
  Object.freeze({ id: 'last_update', label: 'Last update · oldest first' }),
  Object.freeze({ id: 'ready_date', label: 'Ready date · earliest first' }),
  Object.freeze({ id: 'customer', label: 'Customer · A to Z' }),
]);

export const dispatchMethodById = id => (
  DISPATCH_METHODS.find(method => method.id === id)
  || Object.freeze({ id: id || '', label: 'Not selected', fulfilment: '' })
);

export const dispatchProofTypeById = id => (
  DISPATCH_PROOF_TYPES.find(type => type.id === id)
  || Object.freeze({ id: id || '', label: 'Controlled proof', fulfilment: '' })
);

export const dispatchReceivedAt = order => (
  order?.dispatch?.receivedAt
  || ''
);

export const dispatchLastActivityAt = order => (
  order?.dispatch?.lastUpdatedAt
  || order?.dispatch?.updates?.at(-1)?.createdAt
  || order?.updatedAt
  || dispatchReceivedAt(order)
);

export const dispatchReadyDate = order => (
  order?.dispatch?.readyDate
  || order?.readyForCollectionAt?.slice?.(0, 10)
  || ''
);

export const dispatchOrderPriority = order => (
  order?.emergency === 'yes'
    ? 'urgent'
    : order?.planning?.priority || order?.priority || 'standard'
);

export const dispatchOrderAgeDays = (order, now = new Date()) => {
  const received = new Date(
    dispatchReceivedAt(order)
    || order?.dispatch?.submittedAt
    || order?.submittedToDispatchAt
    || order?.updatedAt
    || order?.createdAt,
  );
  if (Number.isNaN(received.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - received.getTime()) / 86400000));
};

export const dispatchOrderAgeLabel = (order, now = new Date()) => {
  const days = dispatchOrderAgeDays(order, now);
  if (days === 0) return 'Received today';
  return `${days} day${days === 1 ? '' : 's'} in Dispatch`;
};

const dispatchStageFor = order => (
  order?.trackingStatus === 'on_hold'
    ? order?.workflowContext?.resumeStatus || ''
    : order?.trackingStatus || ''
);

export const isDispatchQueueOrder = order => DISPATCH_QUEUE_STATUSES.includes(dispatchStageFor(order));

const searchableText = order => [
  order?.reference,
  order?.sourceRfqReference,
  order?.company,
  order?.contact,
  order?.email,
  order?.phone,
  order?.selectedRep?.name,
  order?.selectedRep?.code,
  order?.planning?.internalJobNumber,
  order?.internalJobNumber,
  order?.planning?.customerPoNumber,
  order?.customerPoNumber,
  order?.poNumber,
  order?.deliveryAddress,
  order?.collectionBranch,
  order?.dispatch?.courierOrDriver,
  order?.dispatch?.trackingReference,
  order?.dispatch?.deliveryNoteNumber,
  order?.dispatch?.recipientName,
].filter(Boolean).join(' ').toLowerCase();

const matchesFilter = (order, filter) => {
  if (filter === 'all') return true;
  if (filter === 'laboratory_receipt') return dispatchStageFor(order) === 'awaiting_lab_receipt_dispatch';
  if (filter === 'awaiting_dispatch') return dispatchStageFor(order) === 'awaiting_dispatch';
  if (filter === 'collection') return order?.fulfilment === 'collect';
  if (filter === 'delivery') return order?.fulfilment === 'delivery';
  if (filter === 'handover_confirmed') return DISPATCH_COMPLETION_STATUSES.includes(dispatchStageFor(order));
  if (filter === 'emergency') return order?.emergency === 'yes';
  return dispatchStageFor(order) === filter;
};

const timestamp = value => {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const compareOrders = (left, right, sort) => {
  if (sort === 'customer') return String(left.company || '').localeCompare(String(right.company || ''));
  if (sort === 'ready_date') {
    const leftDate = dispatchReadyDate(left);
    const rightDate = dispatchReadyDate(right);
    if (!leftDate && rightDate) return 1;
    if (leftDate && !rightDate) return -1;
    return leftDate.localeCompare(rightDate) || timestamp(dispatchReceivedAt(left)) - timestamp(dispatchReceivedAt(right));
  }
  if (sort === 'last_update') return timestamp(dispatchLastActivityAt(left)) - timestamp(dispatchLastActivityAt(right));
  return timestamp(dispatchReceivedAt(left)) - timestamp(dispatchReceivedAt(right));
};

export const filterDispatchOrders = (
  orders,
  { search = '', filter = 'all', sort = 'received_oldest' } = {},
) => {
  const term = String(search || '').trim().toLowerCase();
  return [...(orders || [])]
    .filter(isDispatchQueueOrder)
    .filter(order => matchesFilter(order, filter))
    .filter(order => !term || searchableText(order).includes(term))
    .sort((left, right) => compareOrders(left, right, sort));
};

export const dispatchQueueCounts = orders => {
  const queue = (orders || []).filter(isDispatchQueueOrder);
  return {
    all: queue.length,
    laboratoryReceipt: queue.filter(order => dispatchStageFor(order) === 'awaiting_lab_receipt_dispatch').length,
    awaitingDispatch: queue.filter(order => dispatchStageFor(order) === 'awaiting_dispatch').length,
    collection: queue.filter(order => order.fulfilment === 'collect').length,
    delivery: queue.filter(order => order.fulfilment === 'delivery').length,
    handoverConfirmed: queue.filter(order => DISPATCH_COMPLETION_STATUSES.includes(dispatchStageFor(order))).length,
    emergency: queue.filter(order => order.emergency === 'yes').length,
  };
};
