import assert from 'node:assert/strict';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';
import { ORDER_COPY_TYPES } from '../src/domain/orderDocuments.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';

class TestStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const buildRequiredConfiguration = product => {
  const configuration = {};
  for (let pass = 0; pass < 5; pass += 1) {
    for (const field of product.configurations) {
      if (!field.required || !shouldShowField(field, configuration) || configuration[field.key] !== undefined) continue;
      const allowed = optionsForField(field, configuration);
      configuration[field.key] = field.key === 'sanas' ? 'No SANAS'
        : field.key === 'traceability' ? 'No Traceable Certificate'
          : allowed.length ? allowed[0] : 'Fabricated demonstration option';
    }
  }
  return configuration;
};

let currentInstant = new Date('2026-07-29T09:00:00.000Z');
const now = () => new Date(currentInstant);
const storage = new TestStorage();
const services = createMockServices({
  storage,
  now,
  emailSender: async enquiry => ({
    ok: true,
    recipient: 'fabricated-routing@example.invalid',
    deliveryMode: 'test',
    pricedPdfAttached: false,
    enquiryId: enquiry.id,
  }),
});
await services.initialize();

// 1-3. A fabricated customer creates a two-line RFQ and submits it to C-27.
const customer = await services.auth.signIn({
  email: 'cape.demo@client.test',
  password: 'Demo123!',
});
const catalogue = await services.products.getCatalogue();
const pbb = catalogue.products.find(product => product.id === 'pbb');
const pbg = catalogue.products.find(product => product.id === 'pbg');
assert.ok(pbb && pbg, 'the demonstration needs two configured catalogue products');

const lines = [
  {
    lineId: 'e2e-demo-line-pbb',
    productId: pbb.id,
    code: pbb.code,
    name: pbb.name,
    quantity: 2,
    configuration: buildRequiredConfiguration(pbb),
  },
  {
    lineId: 'e2e-demo-line-pbg',
    productId: pbg.id,
    code: pbg.code,
    name: pbg.name,
    quantity: 4,
    configuration: buildRequiredConfiguration(pbg),
  },
];
await services.enquiries.saveDraft(lines);
const submission = await services.enquiries.submit({
  submissionKey: 'e2e-demo-rfq-20260729',
  application: 'Fabricated dual pressure monitoring demonstration',
  medium: 'Water',
  area: 'Western Cape',
  selectedRep: { id: 'C-27' },
  fulfilment: 'collect',
  collectionBranch: 'Cape Town demonstration branch',
  notes: 'Fabricated customer note for the complete workflow demonstration.',
  poMode: 'none',
  poNumber: '',
}, lines);

const rfqId = submission.enquiry.id;
assert.match(submission.enquiry.reference, /^RQ-PREVIEW-/);
assert.equal(submission.enquiry.items.length, 2);
assert.deepEqual(submission.enquiry.items.map(item => item.quantity), [2, 4]);
assert.equal(submission.enquiry.selectedRep.id, 'C-27');
assert.equal(submission.enquiry.companyId, customer.companyId);
assert.equal(submission.enquiry.trackingHistory[0].action, 'submit_rfq');

// 4-6. The assigned representative receives, reviews, and marks the RFQ quoted.
await services.auth.signOut();
await services.auth.signIn({
  email: 'sales.workflow@example.invalid',
  password: 'Sales123!',
});
let rfq = (await services.enquiries.listRepresentativeInbox()).find(item => item.id === rfqId);
assert.equal(rfq.trackingStatus, 'assigned_to_rep');
assert.ok((await services.notifications.list()).some(item => (
  item.entityId === rfqId && item.eventType === 'rfq_assigned'
)));
rfq = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq',
  action: 'start_rep_review',
  comment: '',
  data: {},
  expectedVersion: rfq.version,
});
assert.equal(rfq.trackingStatus, 'under_rep_review');
rfq = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq',
  action: 'mark_quoted',
  comment: '',
  data: {
    quotationNumber: 'Q-DEMO-E2E-001',
    quotationDate: '2026-07-29',
    quotationExpiryMode: 'dated',
    quotationExpiryDate: '2026-08-29',
    quotationInternalNote: 'Fabricated internal quotation confirmation.',
    quotationCustomerNote: 'Your demonstration quotation was emailed separately.',
    quotationEmailed: true,
  },
  expectedVersion: rfq.version,
});
assert.equal(rfq.trackingStatus, 'quoted');
assert.equal(rfq.quotation.number, 'Q-DEMO-E2E-001');

// 7. The customer receives a safe quote notification and acknowledges receipt.
await services.auth.signOut();
await services.auth.signIn({
  email: 'cape.demo@client.test',
  password: 'Demo123!',
});
const quotedNotification = (await services.notifications.list()).find(item => (
  item.entityId === rfqId && item.eventType === 'rfq_quoted'
));
assert.ok(quotedNotification?.message.includes('emailed separately'));
let customerRfq = (await services.enquiries.list()).find(item => item.id === rfqId);
assert.equal(customerRfq.quotation.internalNote, undefined);
customerRfq = await services.workflow.performAction(customerRfq.id, {
  entityType: 'rfq',
  action: 'acknowledge_quotation',
  comment: '',
  data: {},
  expectedVersion: customerRfq.version,
});
assert.equal(customerRfq.trackingStatus, 'awaiting_customer_acceptance');

// 8. The assigned representative verifies external acceptance and converts it.
await services.auth.signOut();
await services.auth.signIn({
  email: 'sales.workflow@example.invalid',
  password: 'Sales123!',
});
rfq = (await services.enquiries.listRepresentativeInbox()).find(item => item.id === rfqId);
const conversion = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq',
  action: 'accept_order',
  comment: '',
  data: {
    acceptanceType: 'purchase_order_received',
    acceptancePurchaseOrderNumber: 'PO-DEMO-E2E-001',
    acceptanceDate: '2026-07-29',
    acceptanceInternalNote: 'Fabricated external Purchase Order was verified by the assigned representative.',
    acceptanceDocumentReference: 'DOC-DEMO-E2E-PO',
    acceptanceVerified: true,
  },
  expectedVersion: rfq.version,
});
assert.equal(conversion.trackingStatus, 'converted_to_order');
assert.equal(conversion.createdOrder.trackingStatus, 'awaiting_planning');
assert.equal(conversion.createdOrder.items.length, 2);
const orderId = conversion.createdOrder.id;
const orderReference = conversion.createdOrder.reference;

// 9-11. Planning receives, plans, and submits the order to Expediting.
await services.auth.signOut();
await services.auth.signIn({
  email: 'planning.workflow@example.invalid',
  password: 'Planning123!',
});
let order = (await services.orders.list()).find(item => item.id === orderId);
assert.equal(order.trackingStatus, 'awaiting_planning');
assert.ok((await services.notifications.list()).some(item => (
  item.entityId === orderId && item.eventType === 'order_sent_to_planning'
)));
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'start_planning',
  comment: '',
  data: {},
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'planning_in_progress');
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'complete_planning',
  comment: '',
  data: {
    planningInternalJobNumber: 'JOB-DEMO-E2E-001',
    planningSalesOrderNumber: 'SO-DEMO-E2E-001',
    planningCustomerPoNumber: 'PO-DEMO-E2E-001',
    planningNotes: 'Fabricated internal Planning note.',
    planningStartDate: '2026-07-30',
    planningEstimatedCompletionDate: '2026-08-08',
    planningAssignedUserId: 'staff-planning-preview',
    planningProductionLocationId: 'cape-town',
    planningPriority: 'high',
    planningSubmissionDate: '2026-07-29',
    planningDocumentReferences: 'PLAN-DEMO-E2E-001',
  },
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'planned');
assert.equal(order.planning.internalJobNumber, 'JOB-DEMO-E2E-001');
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'submit_to_expediting',
  comment: '',
  data: {},
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'submitted_to_expediting');

// 12. Expediting starts work and records several customer-visible progress events.
await services.auth.signOut();
await services.auth.signIn({
  email: 'expeditor.workflow@example.invalid',
  password: 'Expedite123!',
});
assert.ok((await services.notifications.list()).some(item => (
  item.entityId === orderId && item.eventType === 'order_sent_to_expediting'
)));
order = (await services.orders.list()).find(item => item.id === orderId);
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'start_expediting',
  comment: '',
  data: {
    expeditingCustomerMessage: 'Your demonstration order has entered Expediting.',
    expeditingInternalNote: 'Fabricated internal Expeditor intake note.',
    expeditingEstimatedCompletionDate: '2026-08-08',
  },
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'expediting_in_progress');

for (const [step, message] of [
  ['materials_checked', 'Materials for your demonstration order have been checked.'],
  ['production_started', 'Production has started on your demonstration order.'],
  ['calibration_or_testing', 'Your demonstration units are undergoing calibration or testing.'],
  ['quality_check', 'Your demonstration order is undergoing quality review.'],
  ['paperwork_preparation', 'Dispatch paperwork for your demonstration order is being prepared.'],
]) {
  order = await services.workflow.performAction(order.id, {
    entityType: 'order',
    action: 'add_expediting_update',
    comment: '',
    data: {
      expeditingProgressStep: step,
      expeditingCustomerMessage: message,
      expeditingInternalNote: `Fabricated internal note for ${step}.`,
      expeditingEstimatedCompletionDate: '2026-08-08',
    },
    expectedVersion: order.version,
  });
}
assert.ok(order.expediting.completedStepIds.includes('quality_check'));

// 13. Customer and representative receive the same customer-visible progress.
await services.auth.signOut();
await services.auth.signIn({
  email: 'cape.demo@client.test',
  password: 'Demo123!',
});
let customerOrder = (await services.orders.list()).find(item => item.id === orderId);
assert.equal(customerOrder.planning, undefined);
assert.ok(customerOrder.customerTimeline.some(item => item.progressStep === 'quality_check'));
assert.equal(customerOrder.expediting.updates.some(item => 'internalNote' in item), false);
const customerProgressNotifications = (await services.notifications.list()).filter(item => (
  item.entityId === orderId && item.eventType === 'customer_progress_update'
));
assert.ok(customerProgressNotifications.some(item => (
  item.entityId === orderId
  && item.message.includes('quality review')
)));
assert.ok(customerProgressNotifications.length >= 5, 'the customer must receive the customer-visible progress updates');

await services.auth.signOut();
await services.auth.signIn({
  email: 'sales.workflow@example.invalid',
  password: 'Sales123!',
});
const representativeProgressNotifications = (await services.notifications.list()).filter(item => (
  item.entityId === orderId && item.eventType === 'customer_progress_update'
));
assert.ok(representativeProgressNotifications.some(item => (
  item.entityId === orderId
  && item.message.includes('quality review')
)));
assert.ok(representativeProgressNotifications.length >= 5, 'the representative must receive the customer-visible progress updates');

// 14. Expediting completes its required checks and hands the standard order to QA.
await services.auth.signOut();
await services.auth.signIn({
  email: 'expeditor.workflow@example.invalid',
  password: 'Expedite123!',
});
order = (await services.orders.list()).find(item => item.id === orderId);
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'complete_expediting',
  comment: '',
  data: {
    expeditingCustomerMessage: 'Your demonstration order is moving to Quality Assurance.',
    expeditingInternalNote: 'Fabricated internal hand-off check completed.',
    expeditingEstimatedCompletionDate: '2026-08-08',
    expeditingCompletionCheckConfirmed: true,
  },
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'awaiting_qa');

// 14a. QA completes the controlled inspection and releases the order to Dispatch.
await services.auth.signOut();
await services.auth.signIn({
  email: 'quality.workflow@example.invalid',
  password: 'Quality123!',
});
order = (await services.qualityAssurance.listOrders()).find(item => item.id === orderId);
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'start_qa',
  comment: '',
  data: { qaStart: { checklistReference: 'QA-DEMO-E2E-001', internalNote: 'Fabricated QA intake note.' } },
  expectedVersion: order.version,
});
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'pass_qa',
  comment: '',
  data: { qaPass: { customerMessage: 'Your demonstration order passed final quality inspection.', internalNote: 'Fabricated QA pass note.' } },
  expectedVersion: order.version,
});
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'release_qa_order',
  comment: '',
  data: {},
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'awaiting_dispatch');

// 15-17. Dispatch releases, confirms collection, and completes the order.
await services.auth.signOut();
await services.auth.signIn({
  email: 'dispatch.workflow@example.invalid',
  password: 'Dispatch123!',
});
assert.ok((await services.notifications.list()).some(item => (
  item.entityId === orderId && item.eventType === 'order_sent_to_dispatch'
)));
order = (await services.orders.list()).find(item => item.id === orderId);
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'confirm_dispatch_receipt',
  comment: '',
  data: {
    sourceDepartment: 'quality_assurance',
    numberOfPackages: 2,
    internalNote: 'Fabricated QA-to-Dispatch handover confirmation.',
  },
  expectedVersion: order.version,
});
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'mark_ready_for_collection',
  comment: '',
  data: {
    dispatchMethod: 'collection',
    dispatchReadyDate: '2026-08-08',
    dispatchNumberOfPackages: 2,
    dispatchDeliveryNoteNumber: 'DN-DEMO-E2E-001',
    dispatchCustomerMessage: 'Your demonstration order is ready for collection.',
    dispatchInternalNotes: 'Fabricated internal release note.',
  },
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'ready_for_collection');
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'confirm_collection',
  comment: '',
  data: {
    dispatchMethod: 'collection',
    dispatchReadyDate: '2026-08-08',
    dispatchCollectionDate: '2026-08-08',
    dispatchNumberOfPackages: 2,
    dispatchDeliveryNoteNumber: 'DN-DEMO-E2E-001',
    dispatchRecipientName: 'Fabricated Demo Collector',
    dispatchProofType: 'collection_confirmation',
    dispatchProofReference: 'POD-DEMO-E2E-001',
    dispatchCustomerMessage: 'Your demonstration order was collected.',
    dispatchInternalNotes: 'Fabricated internal collection record.',
  },
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'collected');
order = await services.workflow.performAction(order.id, {
  entityType: 'order',
  action: 'complete_collection',
  comment: '',
  data: {
    dispatchMethod: 'collection',
    dispatchReadyDate: '2026-08-08',
    dispatchCollectionDate: '2026-08-08',
    dispatchNumberOfPackages: 2,
    dispatchDeliveryNoteNumber: 'DN-DEMO-E2E-001',
    dispatchRecipientName: 'Fabricated Demo Collector',
    dispatchCustomerMessage: 'Your collected demonstration order is complete.',
    dispatchInternalNotes: 'Fabricated internal closure note.',
  },
  expectedVersion: order.version,
});
assert.equal(order.trackingStatus, 'completed');

// Customer projection remains safe after Dispatch completion.
await services.auth.signOut();
await services.auth.signIn({
  email: 'cape.demo@client.test',
  password: 'Demo123!',
});
customerOrder = (await services.orders.list()).find(item => item.id === orderId);
assert.equal(customerOrder.trackingStatus, 'completed');
assert.equal('internalNotes' in customerOrder.dispatch, false);
assert.equal(customerOrder.dispatch.updates.some(item => 'internalNotes' in item), false);
assert.ok((await services.notifications.list()).some(item => (
  item.entityId === orderId && item.eventType === 'completed'
)));

await services.auth.signOut();
await services.auth.signIn({
  email: 'sales.workflow@example.invalid',
  password: 'Sales123!',
});
assert.ok((await services.notifications.list()).some(item => (
  item.entityId === orderId && item.eventType === 'completed'
)), 'the assigned representative must receive final completion');

// 18-19. An authorised internal user creates both PDF classifications.
await services.auth.signOut();
await services.auth.signIn({
  email: 'manager.workflow@example.invalid',
  password: 'Manager123!',
});
const internalPdf = await services.orderDocuments.generate(orderId, {
  copyType: ORDER_COPY_TYPES.INTERNAL,
});
const customerPdf = await services.orderDocuments.generate(orderId, {
  copyType: ORDER_COPY_TYPES.CUSTOMER,
});
assert.ok(internalPdf.bytesBase64.startsWith('JVBERi0'));
assert.ok(customerPdf.bytesBase64.startsWith('JVBERi0'));
assert.equal(internalPdf.classification, 'INTERNAL - OPERATIONAL COPY');
assert.equal(customerPdf.classification, 'CUSTOMER COPY');

// 20. Advancing the injected clock proves this completed order becomes eligible.
currentInstant = new Date('2026-11-15T09:00:00.000Z');
const archiveEligible = (await services.archive.list()).find(item => item.id === orderId);
assert.equal(archiveEligible.retentionStatus, 'archive_eligible');
assert.equal(archiveEligible.reference, orderReference);

const rfqAudit = await services.audit.list({ entityId: rfqId });
const orderAudit = await services.audit.list({ entityId: orderId });
for (const action of [
  'workflow.submit_rfq',
  'workflow.assign_representative',
  'workflow.start_rep_review',
  'workflow.mark_quoted',
  'workflow.acknowledge_quotation',
  'workflow.accept_order',
  'workflow.convert_to_order',
]) {
  assert.ok(rfqAudit.some(event => event.action === action), `${action} must be audited`);
}
for (const action of [
  'order.created_from_rfq',
  'workflow.start_planning',
  'workflow.complete_planning',
  'workflow.submit_to_expediting',
  'workflow.start_expediting',
  'workflow.add_expediting_update',
  'workflow.complete_expediting',
  'workflow.start_qa',
  'workflow.pass_qa',
  'workflow.release_qa_order',
  'workflow.mark_ready_for_collection',
  'workflow.confirm_collection',
  'workflow.complete_collection',
  'retention.archive_eligible',
]) {
  assert.ok(orderAudit.some(event => event.action === action), `${action} must be audited`);
}
assert.equal(
  orderAudit.filter(event => event.eventType === 'order_summary_pdf_generated').length,
  2,
  'both PDF generations must have append-only audit evidence',
);
assert.ok(orderAudit.every(event => event.immutable === true));

console.log('Complete fabricated RFQ-to-archive-eligibility integration scenario passed.');
