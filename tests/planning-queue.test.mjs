import assert from 'node:assert/strict';
import {
  filterPlanningOrders,
  isPlanningQueueOrder,
  planningOrderAgeLabel,
  planningOrderPriority,
  planningQueueCounts,
} from '../src/domain/planningQueue.js';

const now = new Date('2026-07-24T10:00:00.000Z');
const orders = [
  {
    id: 'order-standard',
    reference: 'OR-PLAN-001',
    sourceRfqReference: 'RQ-PLAN-001',
    workflowType: 'order',
    trackingStatus: 'awaiting_planning',
    company: 'Alpha Demo',
    contact: 'A Customer',
    selectedRep: { name: 'Rep One' },
    emergency: 'no',
    priority: 'standard',
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
  },
  {
    id: 'order-urgent',
    reference: 'OR-PLAN-002',
    sourceRfqReference: 'RQ-PLAN-002',
    workflowType: 'order',
    trackingStatus: 'planning_in_progress',
    company: 'Beta Demo',
    contact: 'B Customer',
    selectedRep: { name: 'Rep Two' },
    emergency: 'yes',
    createdAt: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-23T10:00:00.000Z',
  },
  {
    id: 'order-planned',
    reference: 'OR-PLAN-003',
    sourceRfqReference: 'RQ-PLAN-003',
    workflowType: 'order',
    trackingStatus: 'planned',
    company: 'Gamma Demo',
    contact: 'C Customer',
    selectedRep: { name: 'Rep Three' },
    planning: {
      priority: 'high',
      internalJobNumber: 'JOB-PLAN-003',
      customerPoNumber: 'PO-PLAN-003',
      assignedPlanningUserName: 'Planner Test',
    },
    createdAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-24T08:00:00.000Z',
  },
  {
    id: 'order-expediting',
    reference: 'OR-NOT-PLANNING',
    workflowType: 'order',
    trackingStatus: 'submitted_to_expediting',
    company: 'Outside Queue',
    createdAt: '2026-07-20T10:00:00.000Z',
  },
];

assert.equal(isPlanningQueueOrder(orders[0]), true);
assert.equal(isPlanningQueueOrder(orders[3]), false);
assert.equal(planningOrderPriority(orders[1]), 'urgent', 'emergency orders must always sort as urgent');
assert.equal(planningOrderPriority(orders[2]), 'high', 'saved Planning priority must be respected');
assert.equal(planningOrderAgeLabel(orders[0], now), '4 days old');

assert.deepEqual(
  filterPlanningOrders(orders).map(order => order.id),
  ['order-urgent', 'order-planned', 'order-standard'],
  'default Planning sort must show urgent/high work before standard work',
);
assert.deepEqual(
  filterPlanningOrders(orders, { search: 'JOB-PLAN-003' }).map(order => order.id),
  ['order-planned'],
  'Planning search must include internal planning references',
);
assert.deepEqual(
  filterPlanningOrders(orders, { status: 'planning_in_progress' }).map(order => order.id),
  ['order-urgent'],
);
assert.deepEqual(
  filterPlanningOrders(orders, { priority: 'high' }).map(order => order.id),
  ['order-planned'],
);
assert.deepEqual(
  filterPlanningOrders(orders, { sort: 'company' }).map(order => order.company),
  ['Alpha Demo', 'Beta Demo', 'Gamma Demo'],
);
assert.deepEqual(planningQueueCounts(orders), {
  all: 3,
  awaiting_planning: 1,
  planning_in_progress: 1,
  planned: 1,
  on_hold: 0,
  emergency: 1,
});

console.log('Planning queue search, filtering, priority, age and sorting tests passed.');
