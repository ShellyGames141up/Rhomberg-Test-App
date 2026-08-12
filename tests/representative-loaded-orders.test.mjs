import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import {
  PERMISSIONS,
  roleCan,
  ServiceError,
  USER_ROLES,
} from '../src/services/contracts.js';
import { navigationItemsForRole, normaliseViewForRole } from '../src/domain/accessControl.js';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';
import { STORE_KEYS } from '../src/services/mock/seedData.js';
import { validateEnquiry, validateRepresentativeLoadedOrder } from '../src/services/validation.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const rolesAllowedToLoad = [USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.SALES_MANAGER, USER_ROLES.ADMINISTRATOR];
for (const role of Object.values(USER_ROLES)) {
  assert.equal(
    roleCan(role, PERMISSIONS.LOAD_CUSTOMER_ORDER),
    rolesAllowedToLoad.includes(role),
    `${role} direct-order permission must follow the approved role list`,
  );
}
assert.ok(navigationItemsForRole(USER_ROLES.SALES_REPRESENTATIVE).some(item => item.id === 'load-order'));
assert.ok(navigationItemsForRole(USER_ROLES.SALES_MANAGER).some(item => item.id === 'load-order'));
assert.ok(navigationItemsForRole(USER_ROLES.ADMINISTRATOR).some(item => item.id === 'load-order'));
assert.equal(normaliseViewForRole(USER_ROLES.CUSTOMER, 'load-order'), 'home');
assert.equal(normaliseViewForRole(USER_ROLES.PLANNING, 'load-order'), 'expeditor');

const enquirySource = readFileSync('src/components/Enquiry.jsx', 'utf8');
assert.equal(enquirySource.includes('Is this an emergency request?'), false);
assert.equal(enquirySource.includes('setEmergency'), false);
assert.equal(enquirySource.includes('emergency,'), false);
assert.ok(readFileSync('styles.css', 'utf8').includes('/* Legacy customer emergency controls stay retired */'));
const loaderSource = readFileSync('src/components/RepresentativeOrderLoader.jsx', 'utf8');
assert.ok(loaderSource.includes('Load Customer Order'));
assert.ok(loaderSource.includes('Internal priority'));
assert.ok(loaderSource.includes('quotationFile'));
assert.ok(loaderSource.includes('purchaseOrderFile'));
assert.equal(readFileSync('src/lib/rfqEmail.js', 'utf8').includes('Emergency:'), false);
assert.equal(readFileSync('src/lib/rfqPdf.js', 'utf8').includes("'Emergency'"), false);

const customerRfq = {
  application: 'A valid pressure-monitoring application',
  area: 'Western Cape',
  selectedRep: { id: 'C-27' },
  fulfilment: 'collect',
  emergency: 'yes',
};
assert.throws(
  () => validateEnquiry(customerRfq, [{ productId: 'pbg', quantity: 1 }]),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.urgency),
  'customer RFQs must reject emergency or priority fields at the service boundary',
);

const storage = new TestStorage();
let clock = new Date('2026-08-04T08:00:00.000Z');
const services = createMockServices({ storage, now: () => new Date(clock) });
await services.initialize();

await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const options = await services.representativeOrders.getOptions();
assert.ok(options.companies.some(company => company.id === 'company-demo-cape'));
assert.ok(options.companies.every(company => company.id === 'company-demo-cape'), 'a representative must receive only assigned customer companies');
assert.deepEqual(options.representatives.map(rep => rep.id), ['C-27']);
assert.ok(options.priorities.some(priority => priority.id === 'urgent'), 'internal urgency must remain available');

const product = options.products.find(item => item.id === 'pbg');
const configuration = {};
for (let pass = 0; pass < 5; pass += 1) {
  for (const field of product.configurations || []) {
    if (!field.required || !shouldShowField(field, configuration) || configuration[field.key] !== undefined) continue;
    const choices = optionsForField(field, configuration);
    if (field.type === 'toggle') configuration[field.key] = false;
    else if (field.type === 'multiChoice') configuration[field.key] = choices.length ? [choices[0]] : ['No optional feature required'];
    else configuration[field.key] = choices[0] || 'Fabricated test requirement';
  }
}

const quotationFile = new File([new Uint8Array([1, 2, 3])], 'Q-DEMO-9001.pdf', { type: 'application/pdf' });
const purchaseOrderFile = new File([new Uint8Array([4, 5, 6, 7])], 'PO-DEMO-9001.pdf', { type: 'application/pdf' });
const baseInput = {
  submissionKey: 'representative-order-test-0001',
  companyId: 'company-demo-cape',
  customerContactId: 'company-demo-cape',
  branchId: 'cape-town',
  representativeId: 'C-27',
  orderSource: 'email',
  application: 'Fabricated pressure monitoring replacement order',
  fulfilment: 'collect',
  deliveryAddress: '',
  customerNotes: 'Fabricated customer-safe order note.',
  internalRepresentativeNotes: 'Fabricated internal note that must never reach the customer.',
  requiredDate: '2026-08-20',
  priority: 'urgent',
  quotationNumber: 'Q-DEMO-9001',
  quotationDate: '2026-08-04',
  quotationRevision: 'A',
  quotationFile,
  purchaseOrderNumber: 'PO-DEMO-9001',
  purchaseOrderDate: '2026-08-04',
  purchaseOrderFile,
  items: [{ lineId: 'rep-line-1', productId: product.id, quantity: 3, configuration }],
  sourceConfirmed: true,
  confirmationNote: 'Confirmed against the fabricated email instruction.',
};

for (const [field, message] of [
  ['quotationFile', 'quotation attachment'],
  ['purchaseOrderFile', 'Purchase Order attachment'],
  ['companyId', 'customer'],
  ['items', 'products'],
]) {
  const candidate = { ...baseInput };
  if (field === 'items') candidate.items = [];
  else delete candidate[field];
  assert.throws(
    () => validateRepresentativeLoadedOrder(candidate, { today: '2026-08-04' }),
    error => error instanceof ServiceError,
    `validation must require ${message}`,
  );
}
assert.throws(
  () => validateRepresentativeLoadedOrder({ ...baseInput, items: [{ ...baseInput.items[0], quantity: 0 }] }, { today: '2026-08-04' }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.items),
  'every line requires its own positive quantity',
);
assert.throws(
  () => validateRepresentativeLoadedOrder({ ...baseInput, purchaseOrderFile: quotationFile }, { today: '2026-08-04' }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.purchaseOrderFile),
  'quotation and PO attachments may not be the same file',
);
for (const [file, expectedField] of [
  [new File([], 'Q-DEMO-empty.pdf', { type: 'application/pdf' }), 'quotationFile'],
  [new File([new Uint8Array([1])], 'Q-DEMO-script.exe', { type: 'application/octet-stream' }), 'quotationFile'],
  [new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'Q-DEMO-too-large.pdf', { type: 'application/pdf' }), 'quotationFile'],
]) {
  assert.throws(
    () => validateRepresentativeLoadedOrder({ ...baseInput, quotationFile: file }, { today: '2026-08-04' }),
    error => error instanceof ServiceError && Boolean(error.fieldErrors[expectedField]),
    'source-document validation must reject empty, unsupported and oversized files',
  );
}

const created = await services.representativeOrders.create(baseInput);
assert.equal(created.order.trackingStatus, 'awaiting_planning');
assert.equal(created.order.orderOrigin, 'representative_loaded_order');
assert.equal(created.order.sourceEnquiryId, undefined, 'direct orders must not create or require an RFQ');
assert.equal(created.order.sourceRfqStatus, '', 'direct orders must not pretend to have a converted source RFQ');
assert.equal(created.order.priority, 'urgent');
assert.equal(created.order.documents.length, 2);
assert.equal(created.order.documents.every(document => document.storageStatus === 'metadata_only'), true);
assert.equal(created.order.quotationDocumentId, created.order.documents.find(document => document.documentType === 'customer_quotation').id);
assert.equal(created.order.purchaseOrderDocumentId, created.order.documents.find(document => document.documentType === 'purchase_order').id);
assert.equal(created.order.sourceConfirmation.confirmed, true);
assert.equal(created.order.trackingHistory[0].action, 'create_representative_order');

const repeated = await services.representativeOrders.create(baseInput);
assert.equal(repeated.idempotent, true);
assert.equal(repeated.order.id, created.order.id, 'repeated clicks must return the same order');

clock = new Date('2026-08-04T08:05:00.000Z');
const duplicateInput = { ...baseInput, submissionKey: 'representative-order-test-0002' };
await assert.rejects(
  () => services.representativeOrders.create(duplicateInput),
  error => error instanceof ServiceError && error.code === 'LIKELY_DUPLICATE_ORDER' && error.details?.duplicateCheck?.likelyDuplicate,
);
const confirmedDuplicate = await services.representativeOrders.create({ ...duplicateInput, duplicateConfirmed: true });
assert.equal(confirmedDuplicate.order.duplicateCheckResult.explicitlyConfirmed, true);

await assert.rejects(
  () => services.representativeOrders.create({ ...baseInput, submissionKey: 'representative-order-test-wrong-rep', representativeId: 'J-21', branchId: 'johannesburg' }),
  error => error instanceof ServiceError && error.status === 403,
  'a representative cannot load under another representative assignment',
);

await services.auth.signOut();
await services.auth.signIn({ email: 'planning.workflow@example.invalid', password: 'Planning123!' });
const planningOrders = await services.orders.list();
assert.ok(planningOrders.some(order => order.id === created.order.id), 'Planning must receive the direct order');
const planningNotifications = await services.notifications.list();
assert.ok(planningNotifications.some(notification => notification.entityId === created.order.id && notification.eventType === 'planning_order_received'));
const directPlanningOrder = planningOrders.find(order => order.id === created.order.id);
const startedDirectOrder = await services.workflow.performAction(directPlanningOrder.id, {
  entityType: 'order', action: 'start_planning', comment: '', data: {}, expectedVersion: directPlanningOrder.version,
});
assert.equal(startedDirectOrder.trackingStatus, 'planning_in_progress', 'Planning must be able to start a verified representative-loaded order');
await assert.rejects(
  () => services.representativeOrders.getOptions(),
  error => error instanceof ServiceError && error.status === 403,
  'Planning must not access the direct-order form',
);

await services.auth.signOut();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerOrders = await services.orders.list();
const customerOrder = customerOrders.find(order => order.id === created.order.id);
assert.ok(customerOrder, 'the authorised customer must see a representative-created order');
assert.equal(customerOrder.companyId, 'company-demo-cape');
assert.equal(customerOrder.purchaseOrderNumber, baseInput.purchaseOrderNumber);
assert.equal(customerOrder.documents.length, 2);
assert.equal('priority' in customerOrder, false);
assert.equal('internalUrgency' in customerOrder, false);
assert.equal('internalRepresentativeNotes' in customerOrder, false);
assert.equal('orderOrigin' in customerOrder, false, 'internal origin detail must not be exposed to the customer');
assert.ok((await services.notifications.list()).some(notification => notification.entityId === created.order.id && notification.eventType === 'customer_order_available'));
const customerDocument = customerOrder.documents.find(document => document.documentType === 'customer_quotation');
const download = await services.representativeOrders.downloadDocument(customerOrder.id, customerDocument.id);
assert.equal(download.simulated, true);
await assert.rejects(
  () => services.representativeOrders.replaceDocument(customerOrder.id, customerDocument.id, { reason: 'Customer edit', file: new File([new Uint8Array([9])], 'replacement.pdf', { type: 'application/pdf' }) }),
  error => error instanceof ServiceError && error.status === 403,
);

await services.auth.signOut();
await services.auth.signIn({ email: 'customer.demo@example.invalid', password: 'Demo123!' });
await assert.rejects(
  () => services.orders.getById(created.order.id),
  error => error instanceof ServiceError && error.status === 404,
  'another company must not access the direct order',
);
await assert.rejects(
  () => services.representativeOrders.getOptions(),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not access Load Customer Order',
);

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const internalOrder = await services.orders.getById(created.order.id);
const currentQuote = internalOrder.documents.find(document => document.documentType === 'customer_quotation' && document.isCurrentVersion !== false);
const replacementFile = new File([new Uint8Array([8, 8, 8, 8, 8])], 'Q-DEMO-9001-revision-B.pdf', { type: 'application/pdf' });
const replacement = await services.representativeOrders.replaceDocument(internalOrder.id, currentQuote.id, { reason: 'Corrected approved quotation revision.', file: replacementFile });
assert.equal(replacement.version, 2);
const versionedDocuments = await services.representativeOrders.listDocuments(internalOrder.id);
assert.equal(versionedDocuments.filter(document => document.documentType === 'customer_quotation').length, 2);
assert.equal(versionedDocuments.find(document => document.id === currentQuote.id).isCurrentVersion, false);

await services.auth.signOut();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerAfterReplacement = await services.orders.getById(created.order.id);
assert.equal(customerAfterReplacement.documents.filter(document => document.documentType === 'customer_quotation').length, 1);
assert.equal(customerAfterReplacement.documents.find(document => document.documentType === 'customer_quotation').version, 2);
await assert.rejects(
  () => services.representativeOrders.downloadDocument(created.order.id, currentQuote.id),
  error => error instanceof ServiceError && error.status === 404,
  'customers must not download a superseded source-document version',
);

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });

const audits = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(audits.some(event => event.entityId === created.order.id && event.action === 'order.representative_loaded'));
assert.ok(audits.some(event => event.entityId === created.order.id && event.action === 'document.uploaded'));
assert.ok(audits.some(event => event.entityId === created.order.id && event.action === 'document.downloaded'));
assert.ok(audits.some(event => event.entityId === created.order.id && event.action === 'document.replaced'));
assert.ok(audits.every(event => event.immutable !== false), 'workflow audit entries must remain immutable');

await services.auth.signOut();
for (const credentials of [
  { email: 'sales.manager@example.invalid', password: 'SalesManager123!' },
  { email: 'administrator.workflow@example.invalid', password: 'Admin123!' },
]) {
  const account = await services.auth.signIn(credentials);
  assert.ok(roleCan(account.role, PERMISSIONS.LOAD_CUSTOMER_ORDER));
  assert.ok((await services.representativeOrders.getOptions()).companies.length >= 3);
  await services.auth.signOut();
}

await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
await assert.rejects(
  () => services.representativeOrders.getOptions(),
  error => error instanceof ServiceError && error.status === 403,
  'generic operational managers are not sales managers and must not load customer orders',
);

console.log('Customer urgency removal and representative-loaded order workflow tests passed.');
