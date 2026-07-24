import assert from 'node:assert/strict';
import {
  EXPEDITOR_PROGRESS_STEP_IDS,
  EXPEDITOR_PROGRESS_STEPS,
  EXPEDITOR_QUEUE_FILTERS,
  REQUIRED_EXPEDITOR_STEP_IDS,
  completedExpeditorStepIds,
  expeditorQueueCounts,
  filterExpeditorOrders,
  isApproachingEstimatedCompletion,
  isExpeditingHold,
  missingRequiredExpeditorSteps,
} from '../src/domain/expediting.js';
import { ServiceError } from '../src/services/contracts.js';
import { validateExpeditingAction } from '../src/services/validation.js';

assert.deepEqual(EXPEDITOR_PROGRESS_STEP_IDS, [
  'planning_received',
  'materials_checked',
  'materials_ordered',
  'awaiting_materials',
  'materials_received',
  'production_started',
  'assembly_in_progress',
  'calibration_or_testing',
  'quality_check',
  'paperwork_preparation',
  'ready_for_dispatch',
  'on_hold',
  'cancelled',
]);
assert.ok(EXPEDITOR_PROGRESS_STEPS.every((step, index, steps) => (
  index === 0 || step.sequence >= steps[index - 1].sequence
)), 'configured progress steps must retain a deterministic display sequence');
assert.deepEqual(REQUIRED_EXPEDITOR_STEP_IDS, [
  'planning_received',
  'materials_checked',
  'production_started',
  'calibration_or_testing',
  'quality_check',
  'paperwork_preparation',
  'ready_for_dispatch',
]);
assert.deepEqual(
  EXPEDITOR_QUEUE_FILTERS.map(filter => filter.id),
  ['all', 'newly_submitted', 'in_progress', 'on_hold', 'approaching_completion', 'awaiting_dispatch', 'priority'],
);

const base = {
  workflowType: 'order',
  company: 'Fabricated Test Company',
  contact: 'Test Contact',
  selectedRep: { name: 'Representative Test', code: 'REP-TEST' },
  sourceRfqReference: 'RQ-TEST-1000',
  planning: {
    internalJobNumber: 'JOB-TEST-1000',
    customerPoNumber: 'PO-TEST-1000',
    estimatedCompletionDate: '2026-07-28',
    priority: 'standard',
  },
  trackingHistory: [],
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-20T08:00:00.000Z',
};

const orders = [
  {
    ...base,
    id: 'new-order',
    reference: 'OR-TEST-1001',
    trackingStatus: 'submitted_to_expediting',
    emergency: 'yes',
    updatedAt: '2026-07-20T08:00:00.000Z',
  },
  {
    ...base,
    id: 'in-progress-order',
    reference: 'OR-TEST-1002',
    company: 'Alpha Fabricated Engineering',
    trackingStatus: 'expediting_in_progress',
    planning: { ...base.planning, internalJobNumber: 'JOB-SEARCH-2002', estimatedCompletionDate: '2026-07-26', priority: 'high' },
    expediting: {
      currentStep: 'production_started',
      completedStepIds: ['planning_received', 'materials_checked', 'production_started'],
      estimatedCompletionDate: '2026-07-26',
      updates: [{
        progressStep: 'production_started',
        createdAt: '2026-07-22T09:00:00.000Z',
      }],
    },
    updatedAt: '2026-07-22T09:00:00.000Z',
  },
  {
    ...base,
    id: 'held-order',
    reference: 'OR-TEST-1003',
    trackingStatus: 'on_hold',
    workflowContext: { resumeStatus: 'expediting_in_progress' },
    expediting: {
      currentStep: 'on_hold',
      completedStepIds: ['planning_received', 'materials_checked'],
      estimatedCompletionDate: '2026-08-10',
      updates: [{ progressStep: 'on_hold', createdAt: '2026-07-21T07:00:00.000Z' }],
    },
    updatedAt: '2026-07-21T07:00:00.000Z',
  },
  {
    ...base,
    id: 'dispatch-order',
    reference: 'OR-TEST-1004',
    sourceRfqReference: 'RQ-SEARCH-4004',
    trackingStatus: 'awaiting_dispatch',
    expediting: {
      currentStep: 'ready_for_dispatch',
      completedStepIds: [...REQUIRED_EXPEDITOR_STEP_IDS],
      estimatedCompletionDate: '2026-07-24',
      updates: [{ progressStep: 'ready_for_dispatch', createdAt: '2026-07-23T11:00:00.000Z' }],
    },
    updatedAt: '2026-07-23T11:00:00.000Z',
  },
  {
    ...base,
    id: 'planning-order',
    reference: 'OR-TEST-OUTSIDE',
    trackingStatus: 'planning_in_progress',
    updatedAt: '2026-07-18T08:00:00.000Z',
  },
];

const now = new Date('2026-07-24T12:00:00.000Z');
assert.equal(isExpeditingHold(orders[2]), true);
assert.equal(isApproachingEstimatedCompletion(orders[1], now), true);
assert.equal(isApproachingEstimatedCompletion(orders[2], now), false);
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'all' }, now).map(order => order.id), [
  'new-order',
  'held-order',
  'in-progress-order',
  'dispatch-order',
], 'the default queue must be oldest-update-first and exclude pre-Expediting orders');
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'newly_submitted' }, now).map(order => order.id), ['new-order']);
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'in_progress' }, now).map(order => order.id), ['in-progress-order']);
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'on_hold' }, now).map(order => order.id), ['held-order']);
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'approaching_completion' }, now).map(order => order.id), ['in-progress-order']);
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'awaiting_dispatch' }, now).map(order => order.id), ['dispatch-order']);
assert.deepEqual(filterExpeditorOrders(orders, { filter: 'priority' }, now).map(order => order.id), ['new-order', 'in-progress-order']);
assert.equal(filterExpeditorOrders(orders, { search: 'Alpha Fabricated' }, now)[0].id, 'in-progress-order');
assert.equal(filterExpeditorOrders(orders, { search: 'Representative Test' }, now).length, 4);
assert.equal(filterExpeditorOrders(orders, { search: 'RQ-SEARCH-4004' }, now)[0].id, 'dispatch-order');
assert.equal(filterExpeditorOrders(orders, { search: 'OR-TEST-1001' }, now)[0].id, 'new-order');
assert.equal(filterExpeditorOrders(orders, { search: 'JOB-SEARCH-2002' }, now)[0].id, 'in-progress-order');
assert.equal(filterExpeditorOrders(orders, { search: 'PO-TEST-1000' }, now).length, 4);

const counts = expeditorQueueCounts(orders, now);
assert.deepEqual(counts, {
  all: 4,
  newlySubmitted: 1,
  inProgress: 1,
  onHold: 1,
  approachingCompletion: 1,
  awaitingDispatch: 1,
  priority: 2,
});

const completed = completedExpeditorStepIds(orders[1]);
assert.ok(completed.has('production_started'));
assert.equal(completed.has('on_hold'), false);
assert.deepEqual(missingRequiredExpeditorSteps(orders[1]), [
  'calibration_or_testing',
  'quality_check',
  'paperwork_preparation',
  'ready_for_dispatch',
]);
assert.deepEqual(missingRequiredExpeditorSteps(orders[3]), []);

const serverConfiguredStep = {
  id: 'specialist_test_stage',
  label: 'Specialist test stage',
  customerLabel: 'Specialist testing',
  description: 'A server-configured test-only progress step.',
  sequence: 85,
  requiredForDispatch: false,
  selectableForUpdate: true,
  operational: false,
  terminal: false,
};
const configuredUpdate = validateExpeditingAction(
  'add_expediting_update',
  {
    expeditingProgressStep: serverConfiguredStep.id,
    expeditingCustomerMessage: 'Your order is undergoing a specialist test.',
  },
  {
    progressSteps: [...EXPEDITOR_PROGRESS_STEPS, serverConfiguredStep],
    documentTypes: [{ id: 'document', label: 'Document reference' }],
  },
);
assert.equal(configuredUpdate.expeditingUpdate.progressStep, serverConfiguredStep.id, 'API-provided progress configuration must be accepted without JSX changes');
await assert.rejects(
  async () => validateExpeditingAction('add_expediting_update', {
    expeditingProgressStep: serverConfiguredStep.id,
    expeditingCustomerMessage: 'Your order is undergoing a specialist test.',
  }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.expeditingProgressStep),
  'an unconfigured progress-step code must be rejected',
);

console.log('Expeditor queue configuration, search, filtering and completion-rule tests passed.');
