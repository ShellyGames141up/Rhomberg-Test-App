// Pure workflow definitions ship with the API and are shared by both interfaces.
import { EXPEDITOR_PROGRESS_STEPS, REQUIRED_EXPEDITOR_STEP_IDS } from '../../apps/api/src/domain/expeditingOptions.js';
export { EXPEDITOR_PROGRESS_STEPS, EXPEDITOR_PROGRESS_STEP_IDS, REQUIRED_EXPEDITOR_STEP_IDS, EXPEDITOR_DOCUMENT_TYPES } from '../../apps/api/src/domain/expeditingOptions.js';

export const EXPEDITOR_QUEUE_STATUSES = Object.freeze([
  'awaiting_lab_receipt_expediting',
  'submitted_to_expediting',
  'expediting_in_progress',
  'returned_to_expediting',
  'awaiting_qa',
  'awaiting_dispatch',
]);

export const EXPEDITOR_QUEUE_FILTERS = Object.freeze([
  { id: 'all', label: 'All Expediting work' },
  { id: 'laboratory_receipt', label: 'Laboratory receipt' },
  { id: 'newly_submitted', label: 'Newly submitted' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'qa_rework', label: 'QA corrective work' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'approaching_completion', label: 'Approaching completion' },
  { id: 'at_qa', label: 'At Quality Assurance' },
  { id: 'awaiting_dispatch', label: 'Awaiting dispatch' },
  { id: 'priority', label: 'Priority & emergency' },
]);

export const EXPEDITOR_SORT_OPTIONS = Object.freeze([
  { id: 'oldest_update', label: 'Oldest update first' },
  { id: 'estimated_completion', label: 'Estimated completion first' },
  { id: 'priority', label: 'Priority, then oldest' },
  { id: 'customer', label: 'Customer company A-Z' },
]);


export const expeditorProgressStepById = id => (
  EXPEDITOR_PROGRESS_STEPS.find(item => item.id === id)
  || {
    id: id || '',
    label: 'Progress update',
    customerLabel: 'Progress update',
    description: 'Order progress was updated.',
    sequence: 0,
    requiredForDispatch: false,
    selectableForUpdate: false,
  }
);

export const expeditorUpdateSteps = steps => (
  (steps?.length ? steps : EXPEDITOR_PROGRESS_STEPS).filter(item => item.selectableForUpdate)
);

const dateValue = value => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
};

export const expeditorOrderLastActivityAt = order => {
  const workflowTime = (order?.trackingHistory || []).at(-1)?.createdAt;
  const progressTime = (order?.expediting?.updates || []).at(-1)?.createdAt;
  return [workflowTime, progressTime, order?.updatedAt, order?.createdAt]
    .filter(Boolean)
    .sort((left, right) => dateValue(right) - dateValue(left))[0] || '';
};

export const expeditorEstimatedCompletionDate = order => (
  order?.expediting?.estimatedCompletionDate
  || order?.planning?.estimatedCompletionDate
  || ''
);

export const expeditorOrderPriority = order => {
  const value = order?.expediting?.priority || order?.planning?.priority || order?.priority;
  if (order?.emergency === 'yes') return 'urgent';
  return ['urgent', 'high', 'standard'].includes(value) ? value : 'standard';
};

export const isExpeditingHold = order => (
  order?.trackingStatus === 'on_hold'
  && ['submitted_to_expediting', 'expediting_in_progress'].includes(order?.workflowContext?.resumeStatus)
);

export const isApproachingEstimatedCompletion = (order, now = new Date(), thresholdDays = 3) => {
  const value = expeditorEstimatedCompletionDate(order);
  if (!value || !['submitted_to_expediting', 'expediting_in_progress', 'on_hold'].includes(order?.trackingStatus)) return false;
  const due = dateValue(`${value}T23:59:59`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + thresholdDays);
  limit.setHours(23, 59, 59, 999);
  return due > 0 && due <= limit.getTime();
};

export const completedExpeditorStepIds = order => new Set([
  ...(order?.expediting?.completedStepIds || []),
  ...(order?.expediting?.updates || []).map(update => update.progressStep),
].filter(id => id && !['on_hold', 'cancelled'].includes(id)));

export const missingRequiredExpeditorSteps = (order, requiredStepIds = REQUIRED_EXPEDITOR_STEP_IDS) => {
  const completed = completedExpeditorStepIds(order);
  return requiredStepIds.filter(id => !completed.has(id));
};

const searchableText = order => [
  order?.reference,
  order?.sourceRfqReference,
  order?.sourceEnquiryReference,
  order?.company,
  order?.contact,
  order?.selectedRep?.name,
  order?.selectedRep?.code,
  order?.selectedRep?.branchName,
  order?.internalJobNumber,
  order?.planning?.internalJobNumber,
  order?.salesOrderNumber,
  order?.planning?.salesOrderNumber,
  order?.customerPoNumber,
  order?.planning?.customerPoNumber,
  order?.poNumber,
].filter(Boolean).join(' ').toLowerCase();

const matchesFilter = (order, filter, now) => {
  if (filter === 'all') return EXPEDITOR_QUEUE_STATUSES.includes(order?.trackingStatus) || isExpeditingHold(order);
  if (filter === 'laboratory_receipt') return order?.trackingStatus === 'awaiting_lab_receipt_expediting';
  if (filter === 'newly_submitted') return order?.trackingStatus === 'submitted_to_expediting';
  if (filter === 'in_progress') return order?.trackingStatus === 'expediting_in_progress';
  if (filter === 'qa_rework') return ['qa_failed', 'returned_to_expediting'].includes(order?.trackingStatus);
  if (filter === 'on_hold') return isExpeditingHold(order);
  if (filter === 'approaching_completion') return isApproachingEstimatedCompletion(order, now);
  if (filter === 'at_qa') return order?.trackingStatus === 'awaiting_qa';
  if (filter === 'awaiting_dispatch') return order?.trackingStatus === 'awaiting_dispatch';
  if (filter === 'priority') return expeditorOrderPriority(order) !== 'standard' || order?.emergency === 'yes';
  return false;
};

const priorityRank = order => ({ urgent: 0, high: 1, standard: 2 })[expeditorOrderPriority(order)] ?? 3;

export const filterExpeditorOrders = (
  orders,
  { search = '', filter = 'all', sort = 'oldest_update' } = {},
  now = new Date(),
) => {
  const term = String(search || '').trim().toLowerCase();
  return [...(orders || [])]
    .filter(order => matchesFilter(order, filter, now))
    .filter(order => !term || searchableText(order).includes(term))
    .sort((left, right) => {
      if (sort === 'estimated_completion') {
        const leftDate = dateValue(expeditorEstimatedCompletionDate(left)) || Number.MAX_SAFE_INTEGER;
        const rightDate = dateValue(expeditorEstimatedCompletionDate(right)) || Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate || dateValue(expeditorOrderLastActivityAt(left)) - dateValue(expeditorOrderLastActivityAt(right));
      }
      if (sort === 'priority') {
        return priorityRank(left) - priorityRank(right)
          || dateValue(expeditorOrderLastActivityAt(left)) - dateValue(expeditorOrderLastActivityAt(right));
      }
      if (sort === 'customer') {
        return String(left?.company || '').localeCompare(String(right?.company || ''))
          || dateValue(expeditorOrderLastActivityAt(left)) - dateValue(expeditorOrderLastActivityAt(right));
      }
      return dateValue(expeditorOrderLastActivityAt(left)) - dateValue(expeditorOrderLastActivityAt(right));
    });
};

export const expeditorQueueCounts = (orders, now = new Date()) => ({
  all: filterExpeditorOrders(orders, { filter: 'all' }, now).length,
  laboratoryReceipt: filterExpeditorOrders(orders, { filter: 'laboratory_receipt' }, now).length,
  newlySubmitted: filterExpeditorOrders(orders, { filter: 'newly_submitted' }, now).length,
  inProgress: filterExpeditorOrders(orders, { filter: 'in_progress' }, now).length,
  qaRework: filterExpeditorOrders(orders, { filter: 'qa_rework' }, now).length,
  onHold: filterExpeditorOrders(orders, { filter: 'on_hold' }, now).length,
  approachingCompletion: filterExpeditorOrders(orders, { filter: 'approaching_completion' }, now).length,
  atQa: filterExpeditorOrders(orders, { filter: 'at_qa' }, now).length,
  awaitingDispatch: filterExpeditorOrders(orders, { filter: 'awaiting_dispatch' }, now).length,
  priority: filterExpeditorOrders(orders, { filter: 'priority' }, now).length,
});
