const step = ({
  id,
  label,
  customerLabel,
  description,
  sequence,
  requiredForDispatch = false,
  selectableForUpdate = true,
  operational = false,
  terminal = false,
}) => Object.freeze({
  id,
  label,
  customerLabel,
  description,
  sequence,
  requiredForDispatch,
  selectableForUpdate,
  operational,
  terminal,
});

export const EXPEDITOR_PROGRESS_STEPS = Object.freeze([
  step({
    id: 'planning_received',
    label: 'Planning received',
    customerLabel: 'Planning received',
    description: 'The planned order has been accepted into the Expediting queue.',
    sequence: 10,
    requiredForDispatch: true,
    selectableForUpdate: false,
  }),
  step({
    id: 'materials_checked',
    label: 'Materials checked',
    customerLabel: 'Materials checked',
    description: 'Material availability and requirements have been checked.',
    sequence: 20,
    requiredForDispatch: true,
  }),
  step({
    id: 'materials_ordered',
    label: 'Materials ordered',
    customerLabel: 'Materials ordered',
    description: 'Required materials have been ordered.',
    sequence: 30,
  }),
  step({
    id: 'awaiting_materials',
    label: 'Awaiting materials',
    customerLabel: 'Awaiting materials',
    description: 'The order is waiting for required materials.',
    sequence: 40,
  }),
  step({
    id: 'materials_received',
    label: 'Materials received',
    customerLabel: 'Materials received',
    description: 'Required materials have been received.',
    sequence: 50,
  }),
  step({
    id: 'production_started',
    label: 'Production started',
    customerLabel: 'Production started',
    description: 'Production or fulfilment work has started.',
    sequence: 60,
    requiredForDispatch: true,
  }),
  step({
    id: 'assembly_in_progress',
    label: 'Assembly in progress',
    customerLabel: 'Assembly in progress',
    description: 'Assembly is currently in progress.',
    sequence: 70,
  }),
  step({
    id: 'calibration_or_testing',
    label: 'Calibration or testing',
    customerLabel: 'Calibration or testing',
    description: 'Calibration or functional testing is in progress.',
    sequence: 80,
    requiredForDispatch: true,
  }),
  step({
    id: 'quality_check',
    label: 'Quality check',
    customerLabel: 'Quality check',
    description: 'The order is undergoing its quality review.',
    sequence: 90,
    requiredForDispatch: true,
  }),
  step({
    id: 'paperwork_preparation',
    label: 'Paperwork preparation',
    customerLabel: 'Paperwork preparation',
    description: 'The required dispatch paperwork is being prepared.',
    sequence: 100,
    requiredForDispatch: true,
  }),
  step({
    id: 'ready_for_dispatch',
    label: 'Ready for dispatch',
    customerLabel: 'Ready for dispatch',
    description: 'The order is ready to be handed to Dispatch.',
    sequence: 110,
    requiredForDispatch: true,
  }),
  step({
    id: 'on_hold',
    label: 'On hold',
    customerLabel: 'On hold',
    description: 'Work is paused while information, approval or materials are awaited.',
    sequence: 900,
    selectableForUpdate: false,
    operational: true,
  }),
  step({
    id: 'cancelled',
    label: 'Cancelled',
    customerLabel: 'Cancelled',
    description: 'The order was cancelled through the controlled management workflow.',
    sequence: 999,
    selectableForUpdate: false,
    operational: true,
    terminal: true,
  }),
]);

export const EXPEDITOR_PROGRESS_STEP_IDS = Object.freeze(EXPEDITOR_PROGRESS_STEPS.map(item => item.id));
export const REQUIRED_EXPEDITOR_STEP_IDS = Object.freeze(
  EXPEDITOR_PROGRESS_STEPS.filter(item => item.requiredForDispatch).map(item => item.id),
);

export const EXPEDITOR_QUEUE_STATUSES = Object.freeze([
  'submitted_to_expediting',
  'expediting_in_progress',
  'awaiting_dispatch',
]);

export const EXPEDITOR_QUEUE_FILTERS = Object.freeze([
  { id: 'all', label: 'All Expediting work' },
  { id: 'newly_submitted', label: 'Newly submitted' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'approaching_completion', label: 'Approaching completion' },
  { id: 'awaiting_dispatch', label: 'Awaiting dispatch' },
  { id: 'priority', label: 'Priority & emergency' },
]);

export const EXPEDITOR_SORT_OPTIONS = Object.freeze([
  { id: 'oldest_update', label: 'Oldest update first' },
  { id: 'estimated_completion', label: 'Estimated completion first' },
  { id: 'priority', label: 'Priority, then oldest' },
  { id: 'customer', label: 'Customer company A-Z' },
]);

export const EXPEDITOR_DOCUMENT_TYPES = Object.freeze([
  { id: 'document', label: 'Document reference' },
  { id: 'image', label: 'Image reference' },
  { id: 'quality_record', label: 'Quality record' },
  { id: 'other', label: 'Other controlled reference' },
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
  order?.customerPoNumber,
  order?.planning?.customerPoNumber,
  order?.poNumber,
].filter(Boolean).join(' ').toLowerCase();

const matchesFilter = (order, filter, now) => {
  if (filter === 'all') return EXPEDITOR_QUEUE_STATUSES.includes(order?.trackingStatus) || isExpeditingHold(order);
  if (filter === 'newly_submitted') return order?.trackingStatus === 'submitted_to_expediting';
  if (filter === 'in_progress') return order?.trackingStatus === 'expediting_in_progress';
  if (filter === 'on_hold') return isExpeditingHold(order);
  if (filter === 'approaching_completion') return isApproachingEstimatedCompletion(order, now);
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
  newlySubmitted: filterExpeditorOrders(orders, { filter: 'newly_submitted' }, now).length,
  inProgress: filterExpeditorOrders(orders, { filter: 'in_progress' }, now).length,
  onHold: filterExpeditorOrders(orders, { filter: 'on_hold' }, now).length,
  approachingCompletion: filterExpeditorOrders(orders, { filter: 'approaching_completion' }, now).length,
  awaitingDispatch: filterExpeditorOrders(orders, { filter: 'awaiting_dispatch' }, now).length,
  priority: filterExpeditorOrders(orders, { filter: 'priority' }, now).length,
});
