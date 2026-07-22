import assert from 'node:assert/strict';
import {
  getAllowedWorkflowActions,
  ORDER_STATUSES,
  performWorkflowTransition,
  RFQ_STATUSES,
  SYSTEM_ACTOR_ROLE,
  WORKFLOW_STATUS_DEFINITIONS,
  WORKFLOW_TRANSITIONS,
} from '../src/domain/workflow.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';

const fixedNow = () => new Date('2026-07-22T10:00:00.000Z');
let idCounter = 0;
const idFactory = () => `test-${++idCounter}`;
const run = (entity, action, actor, input = {}, expectedVersion = entity.version) => performWorkflowTransition({
  entity, action, actor, input, expectedVersion, now: fixedNow, idFactory,
});

const customer = { id: 'customer-test', role: USER_ROLES.CUSTOMER, companyId: 'company-test', displayName: 'Customer Test' };
const assignedRep = { id: 'rep-user-test', role: USER_ROLES.SALES_REPRESENTATIVE, companyId: 'company-rhomberg', representativeId: 'REP-TEST', displayName: 'Representative Test' };
const otherRep = { ...assignedRep, id: 'rep-user-other', representativeId: 'REP-OTHER' };
const planning = { id: 'planning-test', role: USER_ROLES.PLANNING, companyId: 'company-rhomberg', displayName: 'Planning Test' };
const expeditor = { id: 'expeditor-test', role: USER_ROLES.EXPEDITOR, companyId: 'company-rhomberg', displayName: 'Expeditor Test' };
const dispatch = { id: 'dispatch-test', role: USER_ROLES.DISPATCH, companyId: 'company-rhomberg', displayName: 'Dispatch Test' };
const manager = { id: 'manager-test', role: USER_ROLES.MANAGER, companyId: 'company-rhomberg', displayName: 'Manager Test' };
const system = { id: 'workflow-system', role: SYSTEM_ACTOR_ROLE, displayName: 'Workflow service' };

assert.deepEqual(Object.keys(WORKFLOW_STATUS_DEFINITIONS.rfq), RFQ_STATUSES, 'RFQ status metadata must cover the controlled status list in order');
assert.deepEqual(Object.keys(WORKFLOW_STATUS_DEFINITIONS.order), ORDER_STATUSES, 'order status metadata must cover the controlled status list in order');
for (const definition of [...Object.values(WORKFLOW_STATUS_DEFINITIONS.rfq), ...Object.values(WORKFLOW_STATUS_DEFINITIONS.order)]) {
  for (const field of ['label', 'customerDescription', 'internalDescription', 'customerVisible']) assert.ok(field in definition, `${definition.id} must define ${field}`);
}
for (const definition of WORKFLOW_TRANSITIONS) {
  for (const field of ['roles', 'requiredFields', 'label', 'customerDescription', 'internalDescription', 'generatesNotification', 'requiresComment', 'recordsTimestamp', 'customerVisible']) {
    assert.ok(field in definition, `${definition.action} from ${definition.from} must define ${field}`);
  }
}

let rfq = {
  id: 'rfq-test', workflowType: 'rfq', trackingStatus: 'draft', status: 'Draft', version: 0,
  companyId: 'company-test', application: 'Pressure monitoring test application', items: [{ productId: 'pbb', quantity: 1 }],
  selectedRep: { id: 'REP-TEST', name: 'Representative Test' }, trackingHistory: [], createdAt: fixedNow().toISOString(),
};

let result = run(rfq, 'submit_rfq', customer, { comment: 'Submitted for testing.' });
rfq = result.entity;
assert.equal(rfq.trackingStatus, 'submitted');
assert.equal(rfq.submittedAt, fixedNow().toISOString());
assert.equal(result.auditEvent.outcome, 'success');
assert.equal(result.notification.required, true);
await assert.rejects(
  async () => run({ ...rfq, id: 'rfq-other-company', companyId: 'other-company', trackingStatus: 'draft', version: 0 }, 'cancel_rfq', customer, { comment: 'Outside company.' }, 0),
  error => error instanceof ServiceError && error.code === 'COMPANY_SCOPE_VIOLATION',
  'customer actions must never cross company boundaries',
);

result = run(rfq, 'assign_representative', system);
rfq = result.entity;
assert.equal(rfq.trackingStatus, 'assigned_to_rep');

assert.equal(getAllowedWorkflowActions(rfq, otherRep).some(action => action.action === 'start_rep_review'), false, 'an unassigned representative must not receive the review action');
await assert.rejects(
  async () => run(rfq, 'start_rep_review', otherRep),
  error => error instanceof ServiceError && error.code === 'REPRESENTATIVE_ASSIGNMENT_REQUIRED' && error.status === 403,
  'an unassigned representative must not accept the RFQ for review',
);

rfq = run(rfq, 'start_rep_review', assignedRep).entity;
assert.equal(rfq.trackingStatus, 'under_rep_review');
await assert.rejects(
  async () => run(rfq, 'mark_quoted', customer, { quotationSentAt: fixedNow().toISOString() }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'customers must not change internal RFQ statuses',
);
await assert.rejects(
  async () => run(rfq, 'mark_quoted', assignedRep),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_REQUIRED_FIELD_MISSING' && Boolean(error.fieldErrors.quotationSentAt),
  'quotation confirmation must require its evidence field',
);

rfq = run(rfq, 'mark_quoted', assignedRep, { quotationSentAt: fixedNow().toISOString() }).entity;
rfq = run(rfq, 'await_customer_acceptance', assignedRep).entity;
await assert.rejects(
  async () => run(rfq, 'accept_rfq', otherRep, { acceptanceBasis: 'purchase_order', comment: 'Not this representative\'s RFQ.' }),
  error => error instanceof ServiceError && error.code === 'REPRESENTATIVE_ASSIGNMENT_REQUIRED',
  'an unassigned representative must not accept the RFQ',
);
await assert.rejects(
  async () => run(rfq, 'accept_rfq', assignedRep, { acceptanceBasis: 'purchase_order' }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_COMMENT_REQUIRED',
  'acceptance must include an audit comment',
);
rfq = run(rfq, 'accept_rfq', assignedRep, { acceptanceBasis: 'purchase_order', comment: 'External test PO confirmed.' }).entity;
assert.equal(rfq.trackingStatus, 'accepted');
await assert.rejects(
  async () => run(rfq, 'convert_to_order', assignedRep),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_REQUIRED_FIELD_MISSING',
  'conversion must link a created order',
);
rfq = run(rfq, 'convert_to_order', assignedRep, { orderId: 'order-test' }).entity;
assert.equal(rfq.trackingStatus, 'converted_to_order');
assert.equal(rfq.orderId, 'order-test');

let order = {
  id: 'order-test', workflowType: 'order', trackingStatus: 'awaiting_planning', status: 'Awaiting planning', version: 0,
  companyId: 'company-test', representativeId: 'REP-TEST', selectedRep: { id: 'REP-TEST' },
  sourceRfqStatus: 'converted_to_order', acceptedAt: fixedNow().toISOString(), fulfilment: 'delivery', trackingHistory: [],
};

await assert.rejects(
  async () => run({ ...order, acceptedAt: '' }, 'start_planning', planning),
  error => error instanceof ServiceError && error.code === 'ORDER_NOT_ACCEPTED',
  'Planning must not process an order without accepted RFQ evidence',
);
order = run(order, 'start_planning', planning).entity;
assert.equal(order.trackingStatus, 'planning_in_progress');
await assert.rejects(
  async () => run(order, 'complete_planning', planning, { internalJobNumber: 'JOB-TEST', customerPoNumber: 'PO-TEST' }, order.version - 1),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_VERSION_CONFLICT',
  'a stale client must not overwrite a newer workflow state',
);
await assert.rejects(
  async () => run(order, 'start_expediting', expeditor),
  error => error instanceof ServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION',
  'Expediting cannot skip Planning completion and handoff',
);
await assert.rejects(
  async () => run(order, 'complete_planning', planning, { internalJobNumber: 'JOB-TEST' }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.customerPoNumber),
  'Planning must capture both required references',
);
order = run(order, 'complete_planning', planning, { internalJobNumber: 'JOB-TEST', customerPoNumber: 'PO-TEST' }).entity;
assert.equal(order.internalJobNumber, 'JOB-TEST');
await assert.rejects(
  async () => run(order, 'start_expediting', expeditor),
  error => error instanceof ServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION',
  'Expeditor cannot process an order before Planning submits it',
);
order = run(order, 'submit_to_expediting', planning).entity;
await assert.rejects(
  async () => run(order, 'start_expediting', planning),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'Planning cannot perform the Expeditor action',
);
order = run(order, 'start_expediting', expeditor).entity;

let held = run(order, 'place_on_hold', expeditor, { comment: 'Waiting for a test component.' }).entity;
assert.equal(held.trackingStatus, 'on_hold');
assert.equal(held.workflowContext.resumeStatus, 'expediting_in_progress');
await assert.rejects(
  async () => run(held, 'resume_order', planning, { comment: 'Incorrect owner.' }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'only the owner of the paused stage or management may resume it',
);
order = run(held, 'resume_order', expeditor, { comment: 'Test component received.' }).entity;
assert.equal(order.trackingStatus, 'expediting_in_progress');

await assert.rejects(
  async () => run(order, 'complete_expediting', expeditor, { completionCheckConfirmed: true }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_COMMENT_REQUIRED',
  'handoff to Dispatch must include a comment',
);
order = run(order, 'complete_expediting', expeditor, { completionCheckConfirmed: true, comment: 'All test checks complete.' }).entity;
assert.equal(order.trackingStatus, 'awaiting_dispatch');
await assert.rejects(
  async () => run(order, 'confirm_delivery', dispatch, { comment: 'Attempted skip.' }),
  error => error instanceof ServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION',
  'Dispatch cannot mark an order delivered before it is out for delivery',
);
await assert.rejects(
  async () => run(order, 'mark_ready_for_collection', dispatch),
  error => error instanceof ServiceError && error.code === 'INVALID_FULFILMENT_TRANSITION',
  'delivery orders cannot enter the collection path',
);
order = run(order, 'start_delivery', dispatch, { comment: 'Released to test courier.' }).entity;
order = run(order, 'confirm_delivery', dispatch, { comment: 'Test delivery confirmed.' }).entity;
order = run(order, 'complete_delivery', dispatch).entity;
assert.equal(order.trackingStatus, 'completed');

const overrideSource = { ...order, id: 'order-override-test', trackingStatus: 'awaiting_planning', status: 'Awaiting planning', version: 0, trackingHistory: [] };
await assert.rejects(
  async () => run(overrideSource, 'override_workflow', manager, { targetStatus: 'completed', comment: 'Correction.' }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.overrideReason),
  'an override must record a distinct reason',
);
const overridden = run(overrideSource, 'override_workflow', manager, { targetStatus: 'completed', overrideReason: 'Approved test-data correction.', comment: 'Corrected after controlled review.' });
assert.equal(overridden.entity.trackingStatus, 'completed');
assert.equal(overridden.workflowEvent.isOverride, true);
assert.equal(overridden.auditEvent.isOverride, true);

console.log('Controlled RFQ and order workflow transition tests passed.');
