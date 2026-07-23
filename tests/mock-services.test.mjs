import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createApiServices } from '../src/services/api/createApiServices.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { LEGACY_STORE_KEYS, STORE_KEYS } from '../src/services/mock/seedData.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';
import { representativesByBranch } from '../src/data/representatives.js';

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

const storage = new TestStorage();
let emailCalls = 0;
const emailSender = async enquiry => {
  emailCalls += 1;
  return { ok: true, recipient: 'test-routing@example.invalid', deliveryMode: 'test', pricedPdfAttached: false, enquiryId: enquiry.id };
};

const services = createMockServices({ storage, emailSender, now: () => new Date('2026-07-22T12:00:00.000Z') });
await services.initialize();

assert.deepEqual(Object.values(USER_ROLES), ['customer', 'sales_representative', 'planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator']);

const uiFiles = [
  path.resolve('src/App.jsx'),
  ...readdirSync(path.resolve('src/components'), { recursive: true })
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.resolve('src/components', file)),
];
for (const file of uiFiles) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.includes('localStorage'), false, `${path.basename(file)} must not access browser storage directly`);
  assert.equal(source.includes('lib/storage'), false, `${path.basename(file)} must not import the removed legacy storage module`);
  assert.equal(source.includes('/data/'), false, `${path.basename(file)} must receive persisted catalogue/account data through services rather than importing data modules`);
  assert.equal(source.includes('updateStatus('), false, `${path.basename(file)} must not use a raw status-changing API`);
}

const catalogue = await services.products.getCatalogue();
assert.ok(catalogue.categories.length >= 8, 'catalogue categories should load through the product service');
assert.ok(catalogue.products.length > 50, 'catalogue products should load through the product service');
assert.deepEqual(
  Object.fromEntries(Object.entries(representativesByBranch).map(([branch, reps]) => [branch, reps.map(rep => rep.name)])),
  {
    'cape-town': ['Alphonso Majiet', 'Andrew Japhtha', 'Quintin van Wyk', 'Arthur Daniels', 'Ericu Vercuiel'],
    durban: [],
    johannesburg: ['Danny', 'Siya', 'Reneil'],
    'port-elizabeth': ['Carmen Bellew'],
  },
  'only the approved branch representatives should be available',
);
assert.ok(catalogue.products.every(product => product.configurations.every(field => !field.options?.includes('No logo'))), 'logo removal must not be offered');

const customer = await services.auth.signIn({ email: 'demo@client.co.za', password: 'Demo123!' });
assert.equal(customer.role, 'customer');
assert.equal('password' in customer, false, 'passwords must not enter React-facing account state');

const customerEnquiries = await services.enquiries.list();
assert.ok(customerEnquiries.every(enquiry => enquiry.companyId === customer.companyId), 'customer list must be limited to the authorised company');
assert.ok(customerEnquiries.every(enquiry => enquiry.workflowType === 'rfq'), 'the RFQ service must not return order records');
assert.ok(customerEnquiries.every(enquiry => enquiry.trackingHistory.every(event => event.customerVisible !== false)), 'customer history must exclude internal-only events');
const customerOrders = await services.orders.list();
assert.ok(customerOrders.length >= 1, 'the customer should receive its demo orders from the separate order service');
assert.ok(customerOrders.every(order => order.companyId === customer.companyId && order.workflowType === 'order'), 'customer orders must be isolated to the authorised company');

await assert.rejects(
  () => services.enquiries.getById('enquiry-demo-cape-001'),
  error => error instanceof ServiceError && error.status === 404,
  'a customer must not retrieve another company RFQ by ID',
);
await assert.rejects(
  () => services.orders.getById('enquiry-demo-kzn-001'),
  error => error instanceof ServiceError && error.status === 404,
  'a customer must not retrieve another company order by ID',
);

const pbb = catalogue.products.find(product => product.id === 'pbb');
const completeConfiguration = {};
for (let pass = 0; pass < 3; pass += 1) {
  for (const field of pbb.configurations) {
    if (!field.required || !shouldShowField(field, completeConfiguration) || completeConfiguration[field.key] !== undefined) continue;
    const allowed = optionsForField(field, completeConfiguration);
    completeConfiguration[field.key] = allowed.length ? allowed[0] : 'Demo configuration requirement';
  }
}

const draftLine = {
  lineId: 'test-line-1',
  productId: 'pbb',
  code: 'PBB',
  name: 'Stainless steel process gauge',
  quantity: 2,
  configuration: completeConfiguration,
};
await services.enquiries.saveDraft([draftLine]);

const reopenedServices = createMockServices({ storage, emailSender, now: () => new Date('2026-07-22T12:00:00.000Z') });
await reopenedServices.initialize();
assert.equal((await reopenedServices.auth.getSession()).id, customer.id, 'session should survive a service reinitialisation');
assert.deepEqual(await reopenedServices.enquiries.getDraft(), [draftLine], 'draft should survive a browser-style reopen');

await assert.rejects(
  () => reopenedServices.enquiries.submit({ application: '', fulfilment: '' }, [draftLine]),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.application),
  'service boundary must reject an invalid RFQ',
);

const submission = await reopenedServices.enquiries.submit({
  application: 'Test pressure monitoring application',
  medium: 'Water',
  area: 'Gauteng',
  selectedRep: { id: 'J-21', code: '21', name: 'Danny', branchId: 'johannesburg', branchName: 'Johannesburg' },
  emergency: 'no',
  fulfilment: 'collect',
  deliveryAddress: '',
  collectionBranch: 'Johannesburg test branch',
  notes: '',
  poMode: 'none',
  poNumber: '',
  poFileName: '',
}, [draftLine]);

assert.match(submission.enquiry.reference, /^RQ-PREVIEW-/);
assert.equal(submission.enquiry.companyId, customer.companyId);
assert.equal(submission.enquiry.trackingStatus, 'submitted', 'internal assignment should remain hidden in the customer projection');
assert.equal(submission.delivery.ok, true);
assert.equal(emailCalls, 1, 'mock RFQ submission should use the injected delivery service once');
assert.deepEqual(await reopenedServices.enquiries.getDraft(), [], 'successful submission should clear the draft');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const assignedRfqs = await reopenedServices.enquiries.list();
assert.ok(assignedRfqs.every(enquiry => enquiry.selectedRep?.id === 'C-27'), 'sales representatives must receive only their assigned RFQs');
let salesRfq = assignedRfqs.find(enquiry => enquiry.id === 'enquiry-demo-cape-001');
assert.equal(salesRfq.trackingStatus, 'under_rep_review');
assert.ok(salesRfq.allowedWorkflowActions.some(action => action.action === 'mark_quoted'));

salesRfq = await reopenedServices.workflow.performAction(salesRfq.id, {
  entityType: 'rfq',
  action: 'mark_quoted',
  comment: '',
  data: { quotationSentAt: '2026-07-22T11:30:00.000Z', quotationReference: 'TEST-QUOTE-001' },
  expectedVersion: salesRfq.version,
});
salesRfq = await reopenedServices.workflow.performAction(salesRfq.id, {
  entityType: 'rfq',
  action: 'await_customer_acceptance',
  comment: '',
  data: {},
  expectedVersion: salesRfq.version,
});
salesRfq = await reopenedServices.workflow.performAction(salesRfq.id, {
  entityType: 'rfq',
  action: 'accept_rfq',
  comment: 'Test Purchase Order confirmed outside the app.',
  data: { acceptanceBasis: 'purchase_order' },
  expectedVersion: salesRfq.version,
});

const workflowBeforeConversion = JSON.parse(storage.getItem(STORE_KEYS.workflowState));
const conversion = await reopenedServices.workflow.performAction(salesRfq.id, {
  entityType: 'rfq',
  action: 'convert_to_order',
  comment: '',
  data: {},
  expectedVersion: salesRfq.version,
});
assert.equal(conversion.trackingStatus, 'converted_to_order');
assert.equal(conversion.createdOrder.workflowType, 'order');
assert.equal(conversion.createdOrder.trackingStatus, 'awaiting_planning');
assert.equal(conversion.orderId, conversion.createdOrder.id, 'converted RFQ must link to the generated order');
assert.equal(conversion.createdOrder.sourceEnquiryId, conversion.id);
assert.equal(conversion.createdOrder.items[0].sourceLineId, salesRfq.items[0].lineId);
assert.deepEqual(conversion.createdOrder.items[0].configurationSnapshot, salesRfq.items[0].configuration);

const workflowAfterConversion = JSON.parse(storage.getItem(STORE_KEYS.workflowState));
assert.equal(workflowAfterConversion.orders.length, workflowBeforeConversion.orders.length + 1, 'RFQ conversion must create exactly one separate order');
assert.ok(workflowAfterConversion.enquiries.some(enquiry => enquiry.id === conversion.id && enquiry.trackingStatus === 'converted_to_order'));
assert.ok(workflowAfterConversion.orders.some(order => order.id === conversion.createdOrder.id && order.sourceEnquiryId === conversion.id));
await assert.rejects(
  () => reopenedServices.workflow.performAction(conversion.id, {
    entityType: 'rfq', action: 'convert_to_order', comment: '', data: {}, expectedVersion: conversion.version,
  }),
  error => error instanceof ServiceError && error.code === 'INVALID_WORKFLOW_TRANSITION',
  'an RFQ must never create a duplicate order',
);

const salesNotifications = await reopenedServices.notifications.list();
const salesConversionNotice = salesNotifications.find(notification => notification.status === 'converted_to_order');
assert.ok(salesConversionNotice, 'the assigned representative must receive the conversion notification');
const readSalesNotice = await reopenedServices.notifications.markRead(salesConversionNotice.id);
assert.ok(readSalesNotice.readAt, 'notification read state must be recorded per signed-in user');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'planning.workflow@example.invalid', password: 'Planning123!' });
assert.deepEqual(await reopenedServices.enquiries.list(), [], 'Planning must not receive RFQ records through the RFQ service');
let plannedOrder = (await reopenedServices.orders.list()).find(order => order.id === conversion.createdOrder.id);
plannedOrder = await reopenedServices.workflow.performAction(plannedOrder.id, {
  entityType: 'order', action: 'start_planning', comment: '', data: {}, expectedVersion: plannedOrder.version,
});
plannedOrder = await reopenedServices.workflow.performAction(plannedOrder.id, {
  entityType: 'order',
  action: 'complete_planning',
  comment: '',
  data: { internalJobNumber: 'JOB-TEST-001', customerPoNumber: 'PO-TEST-001' },
  expectedVersion: plannedOrder.version,
});
plannedOrder = await reopenedServices.workflow.performAction(plannedOrder.id, {
  entityType: 'order', action: 'submit_to_expediting', comment: '', data: {}, expectedVersion: plannedOrder.version,
});
assert.equal(plannedOrder.trackingStatus, 'submitted_to_expediting');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'expeditor.test@rhom.co.za', password: 'Expedite123!' });
const operationalOrders = await reopenedServices.orders.list();
const migratedProductionOrder = operationalOrders.find(order => order.id === 'enquiry-demo-jhb-001');
assert.equal(migratedProductionOrder.trackingStatus, 'expediting_in_progress', 'legacy combined records should migrate into the separate order collection');
let expeditedOrder = operationalOrders.find(order => order.id === conversion.createdOrder.id);
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order', action: 'start_expediting', comment: '', data: {}, expectedVersion: expeditedOrder.version,
});
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order',
  action: 'complete_expediting',
  comment: 'All controlled test checks are complete.',
  data: { completionCheckConfirmed: true },
  expectedVersion: expeditedOrder.version,
});
assert.equal(expeditedOrder.trackingStatus, 'awaiting_dispatch');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'dispatch.workflow@example.invalid', password: 'Dispatch123!' });
let dispatchedOrder = (await reopenedServices.orders.list()).find(order => order.id === conversion.createdOrder.id);
dispatchedOrder = await reopenedServices.workflow.performAction(dispatchedOrder.id, {
  entityType: 'order', action: 'mark_ready_for_collection', comment: '', data: {}, expectedVersion: dispatchedOrder.version,
});
dispatchedOrder = await reopenedServices.workflow.performAction(dispatchedOrder.id, {
  entityType: 'order', action: 'confirm_collection', comment: 'Collected by the authorised test contact.', data: {}, expectedVersion: dispatchedOrder.version,
});
dispatchedOrder = await reopenedServices.workflow.performAction(dispatchedOrder.id, {
  entityType: 'order', action: 'complete_collection', comment: '', data: {}, expectedVersion: dispatchedOrder.version,
});
assert.equal(dispatchedOrder.trackingStatus, 'completed');

const auditEvents = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(auditEvents.some(event => event.action === 'order.created_from_rfq' && event.entityId === conversion.createdOrder.id), 'atomic conversion must create a separate order-creation audit entry');
assert.ok(auditEvents.some(event => event.action === 'workflow.complete_expediting' && event.outcome === 'success'), 'successful workflow actions must create audit entries');
const storedNotifications = JSON.parse(storage.getItem(STORE_KEYS.notifications));
assert.ok(storedNotifications.some(item => item.entityId === conversion.createdOrder.id && item.status === 'awaiting_dispatch'), 'notifiable transitions must queue a mock notification');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const capeRfqs = await reopenedServices.enquiries.list();
const capeOrders = await reopenedServices.orders.list();
assert.ok(capeRfqs.every(record => record.companyId === 'company-demo-cape'));
assert.ok(capeOrders.every(record => record.companyId === 'company-demo-cape'));
assert.equal(capeOrders.find(order => order.id === conversion.createdOrder.id).trackingStatus, 'completed', 'customer tracking must show the completed order from its own company');
const customerNotifications = await reopenedServices.notifications.list();
assert.ok(customerNotifications.length > 0 && customerNotifications.every(notification => notification.companyId === 'company-demo-cape'), 'customer notifications must remain company-isolated');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'demo@client.co.za', password: 'Demo123!' });
await assert.rejects(
  () => reopenedServices.workflow.performAction(submission.enquiry.id, { entityType: 'rfq', action: 'start_rep_review', comment: '', data: {}, expectedVersion: submission.enquiry.version }),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not perform an internal representative action',
);
const auditsAfterDenial = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(auditsAfterDenial.some(event => event.action === 'workflow.start_rep_review' && event.outcome === 'denied'), 'denied workflow attempts must create audit entries');

await assert.rejects(
  () => reopenedServices.auth.register({ company: '', contact: '', email: 'bad', phone: '', area: '', industry: '', password: 'short' }),
  error => error instanceof ServiceError && Object.keys(error.fieldErrors).length >= 6,
  'registration validation should return field-level errors',
);

const legacySessionStorage = new TestStorage();
legacySessionStorage.setItem(LEGACY_STORE_KEYS.session, JSON.stringify({
  accountId: 'staff-sales-preview',
  signedInAt: '2026-07-21T08:00:00.000Z',
}));
const legacySessionServices = createMockServices({ storage: legacySessionStorage });
await legacySessionServices.initialize();
assert.equal((await legacySessionServices.auth.getSession())?.role, USER_ROLES.SALES_REPRESENTATIVE, 'a legacy session should migrate once');
assert.equal(legacySessionStorage.getItem(LEGACY_STORE_KEYS.session), null, 'the migrated legacy session key should be retired');
await legacySessionServices.auth.signOut();
await legacySessionServices.initialize();
assert.equal(await legacySessionServices.auth.getSession(), null, 'sign-out must not restore a retired legacy session');

const apiRequests = [];
const apiUser = { id: '00000000-0000-4000-8000-000000000001', companyId: '00000000-0000-4000-8000-000000000002', company: 'API Demo Company', contact: 'API Demo User', email: 'api@example.invalid', role: 'customer', permissions: [] };
const jsonResponse = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify({ data }), {
  status,
  headers: status === 204 ? {} : { 'Content-Type': 'application/json' },
});
const apiFetch = async (url, options) => {
  const request = { url: String(url), path: url.pathname, options };
  apiRequests.push(request);
  if (url.pathname.endsWith('/auth/csrf-token')) return jsonResponse({ token: 'test-csrf-token' });
  if (url.pathname.endsWith('/auth/me')) return jsonResponse(apiUser);
  if (url.pathname.endsWith('/auth/login')) return jsonResponse({ user: apiUser, csrfToken: 'rotated-test-token' });
  if (url.pathname.endsWith('/enquiries') && options.method === 'POST') return jsonResponse({ enquiry: { id: '00000000-0000-4000-8000-000000000003', reference: 'RQ-API-TEST', companyId: apiUser.companyId }, delivery: { ok: true, deliveryMode: 'queued' } }, 201);
  if (url.pathname.endsWith('/workflow-actions') && options.method === 'POST') return jsonResponse({ id: '00000000-0000-4000-8000-000000000003', reference: 'RQ-API-TEST', workflowType: 'order', trackingStatus: 'awaiting_dispatch', version: 6 }, 201);
  return jsonResponse([]);
};

const apiServices = createApiServices({ apiBaseUrl: '/api/v1', requestTimeoutMs: 1000, fetchImplementation: apiFetch, storage: new TestStorage() });
await apiServices.initialize();
assert.equal((await apiServices.auth.getSession()).companyId, apiUser.companyId);
await apiServices.auth.signIn({ email: 'api@example.invalid', password: 'Example123!' });
await apiServices.enquiries.list();
await apiServices.orders.list();
assert.ok(apiRequests.some(request => request.path.endsWith('/enquiries') && request.options.method === 'GET'), 'API RFQ reads must use the RFQ collection endpoint');
assert.ok(apiRequests.some(request => request.path.endsWith('/orders') && request.options.method === 'GET'), 'API order reads must use the separate order collection endpoint');
const apiSubmission = await apiServices.enquiries.submit({
  application: 'API contract test application',
  area: 'Gauteng',
  selectedRep: { id: '00000000-0000-4000-8000-000000000004' },
  emergency: 'no',
  fulfilment: 'collect',
  collectionBranch: 'Test branch',
  poMode: 'none',
}, [draftLine]);
assert.equal(apiSubmission.enquiry.reference, 'RQ-API-TEST');
await apiServices.workflow.performAction(apiSubmission.enquiry.id, {
  entityType: 'order', action: 'complete_expediting', comment: 'API contract test.', data: { completionCheckConfirmed: true }, expectedVersion: 5,
});
assert.ok(apiRequests.every(request => request.options.credentials === 'include'), 'API calls must use secure cookie credentials');
const apiStateChanges = apiRequests.filter(request => !['GET', 'HEAD'].includes(request.options.method));
assert.ok(apiStateChanges.every(request => request.options.headers['X-CSRF-Token']), 'state-changing API calls must include a CSRF token');
assert.ok(apiRequests.find(request => request.path.endsWith('/enquiries') && request.options.method === 'POST').options.body instanceof FormData, 'RFQ API request must use multipart form data');
const workflowRequest = apiRequests.find(request => request.path.endsWith('/orders/00000000-0000-4000-8000-000000000003/workflow-actions'));
assert.ok(workflowRequest, 'API adapter must route order actions to the controlled workflow endpoint');
assert.ok(workflowRequest.options.headers['Idempotency-Key'], 'workflow actions must carry an idempotency key');
assert.equal(JSON.parse(workflowRequest.options.body).action, 'complete_expediting', 'API workflow request must send an action rather than a target status');

console.log('Mock persistence, workflow audit, company isolation, validation and API adapter tests passed.');
