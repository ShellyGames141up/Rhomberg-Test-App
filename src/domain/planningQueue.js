import { PLANNING_PRIORITY_VALUES } from '../services/contracts.js';

export const PLANNING_QUEUE_STATUSES = Object.freeze([
  'awaiting_planning',
  'planning_in_progress',
  'planned',
]);

export const PLANNING_PRIORITIES = Object.freeze(PLANNING_PRIORITY_VALUES.map(id => Object.freeze({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
})));

export const PLANNING_SORT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'priority', label: 'Priority, then oldest' }),
  Object.freeze({ id: 'oldest', label: 'Oldest order first' }),
  Object.freeze({ id: 'newest', label: 'Newest order first' }),
  Object.freeze({ id: 'recent_activity', label: 'Most recently updated' }),
  Object.freeze({ id: 'company', label: 'Customer company A-Z' }),
]);

const PRIORITY_RANK = Object.freeze({ urgent: 0, high: 1, standard: 2 });

const timeValue = value => {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const planningOrderPriority = order => {
  if (order?.emergency === 'yes') return 'urgent';
  const selected = String(order?.planning?.priority || order?.priority || '').toLowerCase();
  return PLANNING_PRIORITIES.some(item => item.id === selected) ? selected : 'standard';
};

export const planningOrderLastActivityAt = order => {
  const historyTime = (order?.trackingHistory || []).reduce(
    (latest, event) => Math.max(latest, timeValue(event.createdAt)),
    0,
  );
  return new Date(Math.max(historyTime, timeValue(order?.updatedAt), timeValue(order?.createdAt))).toISOString();
};

export const planningOrderAgeDays = (order, now = new Date()) => {
  const createdAt = timeValue(order?.createdAt);
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((timeValue(now) - createdAt) / 86_400_000));
};

export const planningOrderAgeLabel = (order, now = new Date()) => {
  const days = planningOrderAgeDays(order, now);
  if (days === 0) return 'Received today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
};

const searchTextFor = order => [
  order.reference,
  order.sourceRfqReference,
  order.company,
  order.contact,
  order.email,
  order.phone,
  order.selectedRep?.name,
  order.selectedRep?.code,
  order.selectedRep?.branchName,
  order.poNumber,
  order.poFileName,
  order.planning?.internalJobNumber,
  order.planning?.customerPoNumber,
  order.planning?.assignedPlanningUserName,
  order.planning?.productionLocationName,
].filter(Boolean).join(' ').toLowerCase();

const planningStageFor = order => order?.trackingStatus === 'on_hold'
  ? order?.workflowContext?.resumeStatus || ''
  : order?.trackingStatus || '';

export const isPlanningQueueOrder = order => PLANNING_QUEUE_STATUSES.includes(planningStageFor(order));

const comparePriority = (left, right) => {
  const priorityDifference = PRIORITY_RANK[planningOrderPriority(left)] - PRIORITY_RANK[planningOrderPriority(right)];
  if (priorityDifference) return priorityDifference;
  return timeValue(left.createdAt) - timeValue(right.createdAt);
};

const compareForSort = (left, right, sort) => {
  if (sort === 'oldest') return timeValue(left.createdAt) - timeValue(right.createdAt);
  if (sort === 'newest') return timeValue(right.createdAt) - timeValue(left.createdAt);
  if (sort === 'recent_activity') return timeValue(planningOrderLastActivityAt(right)) - timeValue(planningOrderLastActivityAt(left));
  if (sort === 'company') return String(left.company || '').localeCompare(String(right.company || ''), 'en-ZA');
  return comparePriority(left, right);
};

export const filterPlanningOrders = (orders, {
  search = '',
  status = 'all',
  priority = 'all',
  sort = 'priority',
} = {}) => {
  const term = String(search).trim().toLowerCase();
  return [...(orders || [])]
    .filter(isPlanningQueueOrder)
    .filter(order => status === 'all'
      || (status === 'on_hold' && order.trackingStatus === 'on_hold')
      || planningStageFor(order) === status)
    .filter(order => priority === 'all' || planningOrderPriority(order) === priority)
    .filter(order => !term || searchTextFor(order).includes(term))
    .sort((left, right) => compareForSort(left, right, sort));
};

export const planningQueueCounts = orders => {
  const queue = (orders || []).filter(isPlanningQueueOrder);
  return {
    all: queue.length,
    awaiting_planning: queue.filter(order => planningStageFor(order) === 'awaiting_planning').length,
    planning_in_progress: queue.filter(order => planningStageFor(order) === 'planning_in_progress').length,
    planned: queue.filter(order => planningStageFor(order) === 'planned').length,
    on_hold: queue.filter(order => order.trackingStatus === 'on_hold').length,
    emergency: queue.filter(order => order.emergency === 'yes').length,
  };
};
