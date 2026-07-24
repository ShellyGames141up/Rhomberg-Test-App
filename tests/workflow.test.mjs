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
const runInternal = (entity, action, actor, input = {}, expectedVersion = entity.version) => performWorkflowTransition({
  entity, action, actor, input, expectedVersion, internal: true, now: fixedNow, idFactory,
});

const customer = { id: 'customer-test', role: USER_ROLES.CUSTOMER, companyId: 'company-test', displayName: 'Customer Test' };
const otherCustomer = { ...customer, id: 'customer-other', companyId: 'company-other' };
const assignedRep = { id: 'rep-user-test', role: USER_ROLES.SALES_REPRESENTATIVE, companyId: 'company-rhomberg', representativeId: 'REP-TEST', displayName: 'Representative Test' };
const otherRep = { ...assignedRep, id: 'rep-user-other', representativeId: 'REP-OTHER' };
const planning = { id: 'planning-test', role: USER_ROLES.PLANNING, companyId: 'company-rhomberg', displayName: 'Planning Test' };
const expeditor = { id: 'expeditor-test', role: USER_ROLES.EXPEDITOR, companyId: 'company-rhomberg', displayName: 'Expeditor Test' };
const dispatch = { id: 'dispatch-test', role: USER_ROLES.DISPATCH, companyId: 'company-rhomberg', displayName: 'Dispatch Test' };
const manager = { id: 'manager-test', role: USER_ROLES.MANAGER, companyId: 'company-rhomberg', displayName: 'Manager Test' };
const system = { id: 'workflow-system', role: SYSTEM_ACTOR_ROLE, displayName: 'Workflow service' };
const expeditingInput = (
  progressStep,
  customerMessage = `Customer update for ${progressStep}.`,
  overrides = {},
) => ({
  expeditingUpdate: {
    progressStep,
    customerMessage,
    internalNote: '',
    estimatedCompletionDate: '2026-07-30',
    delayReason: '',
    document: null,
    customerVisible: true,
    ...overrides,
  },
});

assert.deepEqual(Object.keys(WORKFLOW_STATUS_DEFINITIONS.rfq), RFQ_STATUSES, 'RFQ status metadata must cover the controlled status list in order');
assert.deepEqual(Object.keys(WORKFLOW_STATUS_DEFINITIONS.order), ORDER_STATUSES, 'order status metadata must cover the controlled status list in order');
for (const definition of [...Object.values(WORKFLOW_STATUS_DEFINITIONS.rfq), ...Object.values(WORKFLOW_STATUS_DEFINITIONS.order)]) {
  for (const field of ['label', 'customerDescription', 'internalDescription', 'customerVisible']) assert.ok(field in definition, `${definition.id} must define ${field}`);
}
for (const definition of WORKFLOW_TRANSITIONS) {
  for (const field of ['permission', 'roles', 'requiredFields', 'label', 'customerDescription', 'internalDescription', 'generatesNotification', 'requiresComment', 'recordsTimestamp', 'customerVisible']) {
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
assert.equal(result.notification.required, false, 'submission confirmation is shown directly to the customer; representative notification is created after assignment');
await assert.rejects(
  async () => run({ ...rfq, id: 'rfq-other-company', companyId: 'other-company', trackingStatus: 'draft', version: 0 }, 'cancel_rfq', customer, { comment: 'Outside company.' }, 0),
  error => error instanceof ServiceError && error.code === 'COMPANY_SCOPE_VIOLATION',
  'customer actions must never cross company boundaries',
);

result = run(rfq, 'assign_representative', system);
rfq = result.entity;
assert.equal(rfq.trackingStatus, 'assigned_to_rep');
assert.equal(result.notification.required, true);
assert.deepEqual(result.notification.recipients, ['assigned_representative']);

assert.equal(getAllowedWorkflowActions(rfq, otherRep).some(action => action.action === 'start_rep_review'), false, 'an unassigned representative must not receive the review action');
await assert.rejects(
  async () => run(rfq, 'start_rep_review', otherRep),
  error => error instanceof ServiceError && error.code === 'REPRESENTATIVE_ASSIGNMENT_REQUIRED' && error.status === 403,
  'an unassigned representative must not accept the RFQ for review',
);

rfq = run(rfq, 'start_rep_review', assignedRep).entity;
assert.equal(rfq.trackingStatus, 'under_rep_review');
await assert.rejects(
  async () => run(rfq, 'mark_quoted', customer, { quotation: { number: 'Q-TEST', date: '2026-07-22', expiryMode: 'not_applicable' } }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'customers must not change internal RFQ statuses',
);
await assert.rejects(
  async () => run(rfq, 'mark_quoted', assignedRep),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_REQUIRED_FIELD_MISSING' && Boolean(error.fieldErrors['quotation.number']),
  'quotation confirmation must require its core metadata',
);
await assert.rejects(
  async () => run(rfq, 'mark_quoted', otherRep, { quotation: { number: 'Q-TEST', date: '2026-07-22', expiryMode: 'not_applicable' } }),
  error => error instanceof ServiceError && error.code === 'REPRESENTATIVE_ASSIGNMENT_REQUIRED',
  'an unassigned representative must not mark the RFQ as quoted',
);
await assert.rejects(
  async () => run(rfq, 'mark_quoted', assignedRep, { quotation: { number: 'Q-TEST', date: '2026-07-22', expiryMode: 'dated', expiryDate: '2026-07-21' } }),
  error => error instanceof ServiceError && error.code === 'QUOTATION_CONFIRMATION_INVALID' && Boolean(error.fieldErrors.quotationExpiryDate),
  'the quotation expiry date must be valid and cannot precede the quotation date',
);

result = run(rfq, 'mark_quoted', assignedRep, {
  quotation: {
    number: 'Q-TEST-001',
    date: '2026-07-22',
    expiryMode: 'dated',
    expiryDate: '2026-08-22',
    emailed: true,
    internalNote: 'Internal test note.',
    customerNote: 'Please review the quotation sent through Outlook.',
    documentReference: 'OUTLOOK-TEST-001',
    documentCustomerVisible: false,
  },
});
rfq = result.entity;
assert.equal(rfq.trackingStatus, 'quoted');
assert.equal(rfq.quotation.number, 'Q-TEST-001');
assert.equal(rfq.quotedAt, fixedNow().toISOString());
assert.equal(rfq.quotedBy.id, assignedRep.id);
assert.equal(result.workflowEvent.note, 'Please review the quotation sent through Outlook.');
assert.equal(result.auditEvent.comment, 'Internal test note.');
assert.deepEqual(result.notification.recipients, ['customer', 'assigned_representative']);
assert.ok(result.notification.messages.customer.includes('emailed separately'));
assert.ok(result.notification.messages.assigned_representative.includes('customer was notified'));
assert.equal(getAllowedWorkflowActions(rfq, assignedRep).some(action => action.action === 'acknowledge_quotation'), false);
assert.ok(getAllowedWorkflowActions(rfq, customer).some(action => action.action === 'acknowledge_quotation' && action.label === 'I received the quotation'));
await assert.rejects(
  async () => run(rfq, 'acknowledge_quotation', otherCustomer),
  error => error instanceof ServiceError && error.code === 'COMPANY_SCOPE_VIOLATION',
  'a customer from another company must not acknowledge the quotation',
);
await assert.rejects(
  async () => run(rfq, 'acknowledge_quotation', assignedRep),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'the representative must not acknowledge quotation receipt for the customer',
);
result = run(rfq, 'acknowledge_quotation', customer);
rfq = result.entity;
assert.equal(rfq.trackingStatus, 'awaiting_customer_acceptance');
assert.equal(rfq.quotationAcknowledgedAt, fixedNow().toISOString());
assert.equal(rfq.quotationAcknowledgedBy.id, customer.id);
assert.equal(rfq.orderId, undefined, 'receipt acknowledgement must not create or accept an order');
assert.deepEqual(result.notification.recipients, ['assigned_representative']);
assert.ok(result.notification.messages.assigned_representative.includes('not order acceptance'));
await assert.rejects(
  async () => run(rfq, 'accept_order', otherRep, {
    acceptance: {
      type: 'purchase_order_received',
      purchaseOrderNumber: 'PO-TEST-001',
      date: '2026-07-22',
      internalNote: 'Not this representative\'s RFQ.',
      verified: true,
    },
  }),
  error => error instanceof ServiceError && error.code === 'REPRESENTATIVE_ASSIGNMENT_REQUIRED',
  'an unassigned representative must not accept the RFQ',
);
await assert.rejects(
  async () => run(rfq, 'accept_order', assignedRep, {
    acceptance: {
      type: 'purchase_order_received',
      date: '2026-07-22',
      internalNote: 'Purchase Order evidence checked.',
      verified: true,
    },
  }),
  error => error instanceof ServiceError && error.code === 'ORDER_ACCEPTANCE_INVALID' && Boolean(error.fieldErrors.acceptancePurchaseOrderNumber),
  'Purchase Order acceptance must include the Purchase Order number',
);
const acceptanceAction = getAllowedWorkflowActions(rfq, assignedRep).find(action => action.action === 'accept_order');
assert.equal(acceptanceAction?.label, 'Accept Order');
assert.equal(acceptanceAction?.toStatus, 'converted_to_order', 'the UI action must describe the complete atomic conversion result');
result = run(rfq, 'accept_order', assignedRep, {
  acceptance: {
    type: 'purchase_order_received',
    purchaseOrderNumber: 'PO-TEST-001',
    paymentReference: '',
    date: '2026-07-22',
    internalNote: 'External test Purchase Order confirmed.',
    documentReference: 'OUTLOOK-PO-TEST-001',
    verified: true,
  },
});
rfq = result.entity;
assert.equal(rfq.trackingStatus, 'accepted');
assert.equal(rfq.acceptance.purchaseOrderNumber, 'PO-TEST-001');
assert.equal(rfq.acceptedBy.id, assignedRep.id);
assert.equal(result.auditEvent.comment, 'External test Purchase Order confirmed.');
await assert.rejects(
  async () => run(rfq, 'convert_to_order', assignedRep, { orderId: 'order-test', orderReference: 'OR-TEST-0001' }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ACTION_INTERNAL_ONLY',
  'direct client conversion must be blocked because only the service may complete the atomic conversion',
);
rfq = runInternal(rfq, 'convert_to_order', assignedRep, { orderId: 'order-test', orderReference: 'OR-TEST-0001' }).entity;
assert.equal(rfq.trackingStatus, 'converted_to_order');
assert.equal(rfq.orderId, 'order-test');
assert.equal(rfq.orderReference, 'OR-TEST-0001');

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
assert.equal(order.planningStartedBy.id, planning.id);
const validPlanningInput = {
  planning: {
    internalJobNumber: 'JOB-TEST',
    customerPoNumber: 'PO-TEST',
    customerPoException: null,
    notes: 'Fabricated Planning test note.',
    plannedStartDate: '2026-07-23',
    estimatedCompletionDate: '2026-07-30',
    assignedPlanningUserId: planning.id,
    assignedPlanningUserName: planning.displayName,
    productionLocationId: 'cape-town',
    productionLocationName: 'Cape Town',
    priority: 'high',
    documentReferences: ['DOC-PLAN-TEST'],
    submissionDate: '2026-07-22',
  },
  internalJobNumber: 'JOB-TEST',
  customerPoNumber: 'PO-TEST',
};
await assert.rejects(
  async () => run(order, 'complete_planning', planning, validPlanningInput, order.version - 1),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_VERSION_CONFLICT',
  'a stale client must not overwrite a newer workflow state',
);
await assert.rejects(
  async () => run(order, 'start_expediting', expeditor),
  error => error instanceof ServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION',
  'Expediting cannot skip Planning completion and handoff',
);
await assert.rejects(
  async () => run(order, 'complete_planning', planning, {
    ...validPlanningInput,
    planning: { ...validPlanningInput.planning, customerPoNumber: '', customerPoException: null },
    customerPoNumber: '',
  }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.planningPoExceptionAuthorised),
  'Planning must capture a customer PO or an authorised exception',
);
await assert.rejects(
  async () => run({ ...order, selectedRep: null }, 'complete_planning', planning, validPlanningInput),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_REQUIRED_FIELD_MISSING' && Boolean(error.fieldErrors['entity.selectedRep.id']),
  'Planning cannot complete an order without an assigned representative',
);
const exceptionPlan = run(order, 'complete_planning', planning, {
  ...validPlanningInput,
  planning: {
    ...validPlanningInput.planning,
    customerPoNumber: '',
    customerPoException: { authorised: true, reason: 'Authorised fabricated test exception.' },
  },
  customerPoNumber: '',
}).entity;
assert.equal(exceptionPlan.trackingStatus, 'planned', 'an authorised PO exception must permit Planning completion');
assert.equal(exceptionPlan.planning.customerPoException.authorised, true);

result = run(order, 'complete_planning', planning, validPlanningInput);
order = result.entity;
assert.equal(order.internalJobNumber, 'JOB-TEST');
assert.equal(order.planning.assignedPlanningUserId, planning.id);
assert.equal(order.plannedBy.id, planning.id);
assert.equal(result.auditEvent.comment, 'Fabricated Planning test note.');
await assert.rejects(
  async () => run(order, 'start_expediting', expeditor),
  error => error instanceof ServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION',
  'Expeditor cannot process an order before Planning submits it',
);
result = run(order, 'submit_to_expediting', planning);
order = result.entity;
assert.equal(order.submittedToExpeditingBy.id, planning.id);
assert.deepEqual(result.notification.recipients, ['customer', 'assigned_representative', 'expeditor']);
assert.ok(result.notification.messages.customer.includes('fulfilment queue'));
assert.ok(result.notification.messages.assigned_representative.includes('Planning has processed'));
assert.ok(result.notification.messages.expeditor.includes('Expediting queue'));
await assert.rejects(
  async () => run(order, 'start_expediting', planning),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'Planning cannot perform the Expeditor action',
);
result = run(order, 'start_expediting', expeditor, expeditingInput(
  'planning_received',
  'Your planned order has been received and Expediting has started work.',
  { internalNote: 'Fabricated Expeditor intake note.' },
));
order = result.entity;
assert.equal(order.expediting.currentStep, 'planning_received');
assert.equal(order.expediting.updates.length, 1);
assert.equal(result.workflowEvent.note, 'Your planned order has been received and Expediting has started work.');
assert.equal(result.auditEvent.comment, 'Fabricated Expeditor intake note.');
assert.deepEqual(result.notification.recipients, ['customer', 'assigned_representative']);

await assert.rejects(
  async () => run(order, 'add_expediting_update', planning, expeditingInput('materials_checked')),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'Planning cannot add an Expeditor progress update',
);
await assert.rejects(
  async () => run(order, 'add_expediting_update', expeditor, expeditingInput('on_hold')),
  error => error instanceof ServiceError && error.code === 'EXPEDITING_UPDATE_INVALID',
  'operational hold states must use their controlled workflow action',
);
result = run(order, 'add_expediting_update', expeditor, expeditingInput(
  'materials_checked',
  'The material requirements for your order have been checked.',
  {
    internalNote: 'Fabricated stock check complete.',
    document: { type: 'quality_record', reference: 'QA-TEST-001', storageStatus: 'metadata_only' },
  },
));
order = result.entity;
assert.equal(order.trackingStatus, 'expediting_in_progress', 'a progress update must not bypass the order workflow state');
assert.equal(order.expediting.currentStep, 'materials_checked');
assert.ok(order.expediting.completedStepIds.includes('materials_checked'));
assert.equal(result.workflowEvent.note, 'The material requirements for your order have been checked.');
assert.equal(result.auditEvent.comment, 'Fabricated stock check complete.');

let held = run(order, 'place_on_hold', expeditor, expeditingInput(
  'on_hold',
  'Your order is temporarily on hold while a test component is received.',
  {
    internalNote: 'Fabricated supplier follow-up is restricted to internal staff.',
    delayReason: 'Waiting for a fabricated test component.',
  },
)).entity;
assert.equal(held.trackingStatus, 'on_hold');
assert.equal(held.workflowContext.resumeStatus, 'expediting_in_progress');
await assert.rejects(
  async () => run(held, 'resume_order', planning, { comment: 'Incorrect owner.' }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_ROLE_FORBIDDEN',
  'only the owner of the paused stage or management may resume it',
);
order = run(held, 'resume_order', expeditor, expeditingInput(
  'materials_checked',
  'The required test component was received and work has resumed.',
  { internalNote: 'Fabricated component receipt verified.' },
)).entity;
assert.equal(order.trackingStatus, 'expediting_in_progress');
assert.equal(order.expediting.currentDelayReason, '');

await assert.rejects(
  async () => run(order, 'complete_expediting', expeditor, {
    ...expeditingInput('ready_for_dispatch', 'Your order is moving to Dispatch.'),
    completionCheckConfirmed: true,
    expeditingHandoff: { completionCheckConfirmed: true, authorisedException: false },
  }),
  error => error instanceof ServiceError
    && error.code === 'EXPEDITING_HANDOFF_INVALID'
    && Boolean(error.fieldErrors.expeditingReadyExceptionAuthorised),
  'handoff to Dispatch must require the configured completion steps or a controlled exception',
);
for (const [progressStep, customerMessage] of [
  ['production_started', 'Production has started on your order.'],
  ['calibration_or_testing', 'Your units are undergoing calibration or functional testing.'],
  ['quality_check', 'Your order is undergoing its quality review.'],
  ['paperwork_preparation', 'The required dispatch paperwork is being prepared.'],
]) {
  order = run(order, 'add_expediting_update', expeditor, expeditingInput(progressStep, customerMessage)).entity;
}
result = run(order, 'complete_expediting', expeditor, {
  ...expeditingInput(
    'ready_for_dispatch',
    'Your order has completed Expediting and is moving to Dispatch.',
    { internalNote: 'All fabricated Expeditor hand-off checks complete.' },
  ),
  completionCheckConfirmed: true,
  expeditingHandoff: { completionCheckConfirmed: true, authorisedException: false },
});
order = result.entity;
assert.equal(order.trackingStatus, 'awaiting_dispatch');
assert.equal(order.expediting.currentStep, 'ready_for_dispatch');
assert.deepEqual(result.notification.recipients, ['customer', 'assigned_representative', 'dispatch']);
assert.equal(result.notification.message, 'Your order has completed Expediting and is moving to Dispatch.');
assert.ok(result.notification.messages.dispatch.includes('Dispatch queue'));
const exceptionHandoffSource = {
  ...order,
  id: 'order-expediting-exception-test',
  trackingStatus: 'expediting_in_progress',
  status: 'Expediting in progress',
  version: 1,
  expediting: {
    currentStep: 'planning_received',
    completedStepIds: ['planning_received'],
    updates: [expeditingInput('planning_received').expeditingUpdate],
  },
  trackingHistory: [],
};
const exceptionHandoff = run(exceptionHandoffSource, 'complete_expediting', expeditor, {
  ...expeditingInput('ready_for_dispatch', 'Your order is moving to Dispatch after an authorised internal review.'),
  completionCheckConfirmed: true,
  expeditingHandoff: {
    completionCheckConfirmed: true,
    authorisedException: true,
    exceptionReason: 'Fabricated manager-approved test exception for incomplete standard steps.',
    exceptionAuthorisationReference: 'MGR-TEST-001',
  },
});
assert.equal(exceptionHandoff.entity.trackingStatus, 'awaiting_dispatch');
assert.equal(exceptionHandoff.entity.expediting.handoffException.authorisationReference, 'MGR-TEST-001');
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
