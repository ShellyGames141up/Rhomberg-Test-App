import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createApiServices } from '../src/services/api/createApiServices.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';

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

const services = createMockServices({ storage, emailSender, now: () => new Date('2026-07-21T12:00:00.000Z') });
await services.initialize();

assert.deepEqual(Object.values(USER_ROLES), ['customer', 'sales_representative', 'expeditor', 'buyer', 'manager', 'administrator']);

const uiFiles = [
  path.resolve('src/App.jsx'),
  ...readdirSync(path.resolve('src/components'), { recursive: true })
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.resolve('src/components', file)),
];
for (const file of uiFiles) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.includes('localStorage'), false, `${path.basename(file)} must not access browser storage directly`);
  assert.equal(source.includes("lib/storage"), false, `${path.basename(file)} must not import the removed legacy storage module`);
  assert.equal(source.includes('/data/'), false, `${path.basename(file)} must receive persisted catalogue/account data through services rather than importing data modules`);
}

const catalogue = await services.products.getCatalogue();
assert.ok(catalogue.categories.length >= 8, 'catalogue categories should load through the product service');
assert.ok(catalogue.products.length > 50, 'catalogue products should load through the product service');

const customer = await services.auth.signIn({ email: 'demo@client.co.za', password: 'Demo123!' });
assert.equal(customer.role, 'customer');
assert.equal('password' in customer, false, 'passwords must not enter React-facing account state');

const customerEnquiries = await services.enquiries.list();
assert.ok(customerEnquiries.length >= 1);
assert.ok(customerEnquiries.every(enquiry => enquiry.companyId === customer.companyId), 'customer list must be limited to the authorised company');

await assert.rejects(
  () => services.enquiries.getById('enquiry-demo-cape-001'),
  error => error instanceof ServiceError && error.status === 404,
  'a customer must not retrieve another company RFQ by ID',
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

const reopenedServices = createMockServices({ storage, emailSender, now: () => new Date('2026-07-21T12:00:00.000Z') });
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
  selectedRep: { id: 'J-20', code: '20', name: 'Tammy Landey', branchId: 'johannesburg', branchName: 'Johannesburg' },
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
assert.equal(submission.delivery.ok, true);
assert.equal(emailCalls, 1, 'mock RFQ submission should use the injected delivery service once');
assert.deepEqual(await reopenedServices.enquiries.getDraft(), [], 'successful submission should clear the draft');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'expeditor.test@rhom.co.za', password: 'Expedite123!' });
const operationalQueue = await reopenedServices.enquiries.list();
assert.ok(operationalQueue.some(enquiry => enquiry.companyId === 'company-demo-cape'), 'expeditor should see the authorised operational test queue');
const updated = await reopenedServices.tracking.updateStatus(submission.enquiry.id, {
  status: 'under-review',
  note: 'Configuration is being checked.',
  actor: 'Expeditor Test',
});
assert.equal(updated.trackingStatus, 'under-review');
assert.equal(updated.trackingHistory.at(-1).note, 'Configuration is being checked.');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'demo@client.co.za', password: 'Demo123!' });
await assert.rejects(
  () => reopenedServices.tracking.updateStatus(submission.enquiry.id, { status: 'completed', note: '' }),
  error => error instanceof ServiceError && error.status === 403,
  'customer roles must not update tracking',
);

await assert.rejects(
  () => reopenedServices.auth.register({ company: '', contact: '', email: 'bad', phone: '', area: '', industry: '', password: 'short' }),
  error => error instanceof ServiceError && Object.keys(error.fieldErrors).length >= 6,
  'registration validation should return field-level errors',
);

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
  if (url.pathname.endsWith('/tracking-events')) return jsonResponse({ id: '00000000-0000-4000-8000-000000000003', reference: 'RQ-API-TEST', trackingStatus: 'under-review' }, 201);
  return jsonResponse([]);
};

const apiServices = createApiServices({ apiBaseUrl: '/api/v1', requestTimeoutMs: 1000, fetchImplementation: apiFetch, storage: new TestStorage() });
await apiServices.initialize();
assert.equal((await apiServices.auth.getSession()).companyId, apiUser.companyId);
await apiServices.auth.signIn({ email: 'api@example.invalid', password: 'Example123!' });
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
await apiServices.tracking.updateStatus(apiSubmission.enquiry.id, { status: 'under-review', note: 'API test' });
assert.ok(apiRequests.every(request => request.options.credentials === 'include'), 'API calls must use secure cookie credentials');
const apiStateChanges = apiRequests.filter(request => !['GET', 'HEAD'].includes(request.options.method));
assert.ok(apiStateChanges.every(request => request.options.headers['X-CSRF-Token']), 'state-changing API calls must include a CSRF token');
assert.ok(apiRequests.find(request => request.path.endsWith('/enquiries') && request.options.method === 'POST').options.body instanceof FormData, 'RFQ API request must use multipart form data');
assert.ok(apiRequests.find(request => request.path.endsWith('/tracking-events')).options.headers['Idempotency-Key'], 'tracking updates must carry an idempotency key');

console.log('Mock persistence, company isolation, validation and API contract-adapter tests passed.');
