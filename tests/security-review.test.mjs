import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  buildOrderSummaryModel,
  ORDER_COPY_TYPES,
  validateOrderEmailRequest,
} from '../src/domain/orderDocuments.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import {
  DEMO_LOGINS,
  STORE_KEYS,
} from '../src/services/mock/seedData.js';
import { ServiceError } from '../src/services/contracts.js';

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

const root = process.cwd();
const read = file => readFileSync(path.resolve(root, file), 'utf8');

const sourceRoots = ['src', 'scripts', 'netlify', 'docs', 'tests'];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.sql', '.txt', '.toml', '.webmanifest', '.yaml', '.yml']);
const textFiles = [];
const collectTextFiles = directory => {
  for (const entry of readdirSync(path.resolve(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTextFiles(relative);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) textFiles.push(relative);
  }
};
sourceRoots.forEach(collectTextFiles);
for (const rootFile of ['README.md', 'START-HERE.txt', 'package.json', 'runtime-config.js', 'netlify.toml']) {
  textFiles.push(rootFile);
}

const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub access token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['OpenAI-style secret key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['credential-bearing database URL', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/]+:[^@\s/]+@/i],
  ['real Rhomberg staff email address', /\b[A-Z0-9._%+-]+@rhom\.co\.za\b/i],
];
for (const file of [...new Set(textFiles)]) {
  const source = read(file);
  for (const [label, pattern] of secretPatterns) {
    assert.doesNotMatch(source, pattern, `${file} must not contain a ${label}`);
  }
}

const gitignore = read('.gitignore');
for (const protectedPath of ['.env', '.env.*', 'private/', 'dist-production/']) {
  assert.ok(gitignore.includes(protectedPath), `.gitignore must exclude ${protectedPath}`);
}
assert.ok(DEMO_LOGINS.length >= 8, 'the preview must retain fabricated role logins');
assert.ok(DEMO_LOGINS.every(login => /\.(?:invalid|test)$/i.test(login.email)), 'every mock login must use a reserved test domain');
const employeeAccountSource = read('src/domain/employeeAccounts.js');
assert.match(employeeAccountSource, /crypto\.getRandomValues\(bytes\)/, 'temporary passwords must use a cryptographically secure random source');
assert.doesNotMatch(employeeAccountSource.match(/export const generateTemporaryPassword[\s\S]*?\n};/)?.[0] || '', /Math\.random/, 'temporary password generation must never fall back to Math.random');

const catalogueSource = read('src/data/catalogue.js');
const seedSource = read('src/services/mock/seedData.js');
for (const [name, source] of [['catalogue', catalogueSource], ['mock seed', seedSource]]) {
  assert.doesNotMatch(
    source,
    /\b(?:unitPrice|costPrice|privatePrice|pricingResult|supplierCost)\s*:\s*(?:\d|['"]R\s*\d)/i,
    `${name} data must not contain protected pricing values`,
  );
}
const privatePricingSource = read('netlify/functions/lib/pricing.mjs');
assert.match(privatePricingSource, /RHOMBERG_PRICEBOOK_GZIP_BASE64/);
assert.doesNotMatch(privatePricingSource, /\bbaseRules\s*:\s*\[/, 'the repository must not embed the private price book');
assert.doesNotMatch(privatePricingSource, /\bunitPrice\s*:\s*\d/, 'the repository must not embed unit price values');

const productionBuildSource = read('scripts/build-production.mjs');
for (const marker of [
  'src/services/apiEntry.js',
  'createMockServices',
  'DEMO_LOGINS',
  'RHOMBERG_PRICEBOOK',
  'REP-ONLY PRICED RFQ',
  'unitPrice',
]) {
  assert.ok(productionBuildSource.includes(marker), `production build safety scan must cover ${marker}`);
}
assert.doesNotMatch(read('src/services/apiEntry.js'), /mock\/createMockServices|seedData/);
assert.doesNotMatch(read('runtime-config.js'), /DATABASE_URL|API_KEY|CLIENT_SECRET|SIGNING_KEY/);

const apiClientSource = read('src/services/api/HttpClient.js');
assert.match(apiClientSource, /credentials:\s*'include'/);
assert.match(apiClientSource, /'X-CSRF-Token'/);
const openapi = read('docs/api/openapi.yaml');
assert.match(openapi, /sessionCookie:/);
assert.match(openapi, /csrfHeader:/);
assert.doesNotMatch(openapi, /\/(?:enquiries|orders)\/\{[^}]+\}\/status:/, 'the API must not expose a raw status-update route');

const schema = read('docs/database/postgresql-schema.sql');
for (const requiredControl of [
  'CREATE TRIGGER audit_events_immutable',
  'CREATE POLICY audit_events_management_read',
  'CREATE POLICY documents_authorised_scope',
  'scan_status app.scan_status',
  'customer_visibility_authorised_by',
  'CREATE TABLE app.order_deletion_requests',
  'CREATE TABLE app.order_deletion_log',
  'Browser/application roles never receive DELETE on app.orders',
]) {
  assert.ok(schema.includes(requiredControl), `PostgreSQL proposal must retain ${requiredControl}`);
}

const submitFunction = read('netlify/functions/submit-rfq.mjs');
assert.doesNotMatch(submitFunction, /console\.error\('RFQ submission failed',\s*error\)/);
assert.doesNotMatch(submitFunction, /message:\s*error\?\.message/);
assert.match(submitFunction, /requestId/);
assert.match(read('src/components/ErrorBoundary.jsx'), /console\.error\('Rhomberg app rendering error'\)/);

const storage = new TestStorage();
const now = () => new Date('2026-07-29T10:00:00.000Z');
const services = createMockServices({ storage, now });
await services.initialize();

const state = JSON.parse(storage.getItem(STORE_KEYS.workflowState));
const ownOrder = state.orders.find(order => order.companyId === 'company-demo-mining');
assert.ok(ownOrder, 'security test requires a fabricated customer order');
ownOrder.internalFutureNote = 'SECURITY-PROBE-INTERNAL-FUTURE-NOTE';
ownOrder.staffOnlyMessage = 'SECURITY-PROBE-UNKNOWN-STAFF-FIELD';
ownOrder.privatePricing = { unitPrice: 987654, supplierCost: 'SECURITY-PROBE-SUPPLIER-COST' };
ownOrder.auditMetadata = { requestId: 'SECURITY-PROBE-AUDIT-ID' };
ownOrder.apiToken = 'SECURITY-PROBE-API-TOKEN';
ownOrder.selectedRep = {
  ...ownOrder.selectedRep,
  staffAssignmentNote: 'SECURITY-PROBE-REP-ASSIGNMENT',
};
ownOrder.quotation = {
  number: 'QT-SECURITY-0001',
  date: '2026-07-29',
  customerNote: 'Fabricated customer-safe quotation note.',
  internalNote: 'SECURITY-PROBE-QUOTATION-NOTE',
  pricingTotal: 987654,
  documentCustomerVisible: true,
  document: {
    id: 'quotation-document-security-test',
    documentType: 'quotation',
    fileName: 'fabricated-customer-quotation.pdf',
    storageObjectKey: 'SECURITY-PROBE-QUOTATION-OBJECT-KEY',
  },
};
ownOrder.items[0].configuration = {
  ...ownOrder.items[0].configuration,
  internalContacts: 'Single internal contact',
  unitPrice: 987654,
  protectedSupplierContext: 'SECURITY-PROBE-PROTECTED-CONFIG',
};
ownOrder.documents = [
  {
    id: 'customer-document-security-test',
    documentType: 'purchase_order',
    fileName: 'fabricated-customer-document.pdf',
    customerVisible: true,
    storageObjectKey: 'SECURITY-PROBE-DOCUMENT-OBJECT-KEY',
    scanDetails: 'SECURITY-PROBE-DOCUMENT-SCAN-DETAILS',
  },
  {
    id: 'internal-document-security-test',
    documentType: 'internal_quality_record',
    fileName: 'SECURITY-PROBE-INTERNAL-DOCUMENT.pdf',
    customerVisible: false,
  },
];
ownOrder.expediting = {
  ...(ownOrder.expediting || {}),
  updates: [{
    id: 'security-expediting-update',
    progressStep: 'quality_check',
    customerMessage: 'Customer-safe quality update.',
    internalNote: 'SECURITY-PROBE-EXPEDITING-NOTE',
    delayReason: 'SECURITY-PROBE-SUPPLIER-DELAY',
    document: { reference: 'SECURITY-PROBE-EXPEDITING-DOCUMENT' },
    customerVisible: true,
    updatedBy: { id: 'staff-expeditor-preview', displayName: 'Expeditor Test' },
    createdAt: now().toISOString(),
  }],
};
ownOrder.dispatch = {
  ...(ownOrder.dispatch || {}),
  customerMessage: 'Customer-safe Dispatch update.',
  internalNotes: 'SECURITY-PROBE-DISPATCH-NOTE',
  currentProblemReason: 'SECURITY-PROBE-DISPATCH-PROBLEM',
};

state.enquiries.push({
  id: 'security-customer-quoted-rfq',
  reference: 'RQ-SECURITY-0001',
  version: 2,
  accountId: 'company-demo-mining',
  companyId: 'company-demo-mining',
  company: 'Demo Mining Solutions',
  contact: 'Thabo Client',
  email: 'customer.demo@example.invalid',
  phone: '+27 82 000 0000',
  application: 'Fabricated security workflow test.',
  selectedRep: { id: 'J-21', name: 'Fabricated Assigned Rep' },
  representativeId: 'J-21',
  items: [{ lineId: 'security-line', productId: 'pbg', code: 'PBG', name: 'Gauge', quantity: 1, configuration: { range: '0 to 10 bar' } }],
  workflowType: 'rfq',
  trackingStatus: 'quoted',
  status: 'Quoted',
  trackingHistory: [{
    id: 'security-rfq-quoted-event',
    entityType: 'rfq',
    action: 'mark_quoted',
    fromStatus: 'under_rep_review',
    toStatus: 'quoted',
    status: 'quoted',
    label: 'Quoted',
    note: 'The fabricated quotation was sent separately.',
    customerVisible: true,
    createdAt: now().toISOString(),
  }],
  createdAt: now().toISOString(),
  updatedAt: now().toISOString(),
});
state.enquiries.push({
  id: 'security-unassigned-rfq',
  reference: 'RQ-SECURITY-0002',
  version: 1,
  accountId: 'company-demo-mining',
  companyId: 'company-demo-mining',
  company: 'Demo Mining Solutions',
  contact: 'Thabo Client',
  email: 'customer.demo@example.invalid',
  phone: '+27 82 000 0000',
  application: 'Fabricated representative isolation test.',
  selectedRep: { id: 'J-21', name: 'Fabricated Assigned Rep' },
  representativeId: 'J-21',
  items: [{ lineId: 'security-line-2', productId: 'pbg', code: 'PBG', name: 'Gauge', quantity: 1, configuration: { range: '0 to 6 bar' } }],
  workflowType: 'rfq',
  trackingStatus: 'assigned_to_rep',
  status: 'Assigned to representative',
  trackingHistory: [],
  createdAt: now().toISOString(),
  updatedAt: now().toISOString(),
});
storage.setItem(STORE_KEYS.workflowState, JSON.stringify(state));

await services.auth.signIn({ email: 'customer.demo@example.invalid', password: 'Demo123!' });
const customerOrders = await services.orders.list();
assert.ok(customerOrders.every(order => order.companyId === 'company-demo-mining'));
const customerOrder = await services.orders.getById(ownOrder.id);
const customerPayload = JSON.stringify(customerOrder);
for (const protectedValue of [
  'SECURITY-PROBE-INTERNAL-FUTURE-NOTE',
  'SECURITY-PROBE-UNKNOWN-STAFF-FIELD',
  'SECURITY-PROBE-SUPPLIER-COST',
  'SECURITY-PROBE-AUDIT-ID',
  'SECURITY-PROBE-API-TOKEN',
  'SECURITY-PROBE-REP-ASSIGNMENT',
  'SECURITY-PROBE-QUOTATION-NOTE',
  'SECURITY-PROBE-QUOTATION-OBJECT-KEY',
  'SECURITY-PROBE-DOCUMENT-OBJECT-KEY',
  'SECURITY-PROBE-DOCUMENT-SCAN-DETAILS',
  'SECURITY-PROBE-PROTECTED-CONFIG',
  'SECURITY-PROBE-INTERNAL-DOCUMENT.pdf',
  'SECURITY-PROBE-EXPEDITING-NOTE',
  'SECURITY-PROBE-SUPPLIER-DELAY',
  'SECURITY-PROBE-EXPEDITING-DOCUMENT',
  'SECURITY-PROBE-DISPATCH-NOTE',
  'SECURITY-PROBE-DISPATCH-PROBLEM',
  '987654',
]) {
  assert.equal(customerPayload.includes(protectedValue), false, `customer payload must exclude ${protectedValue}`);
}
assert.match(customerPayload, /Single internal contact/, 'legitimate customer-selected internal-contact configuration must remain visible');
assert.match(customerPayload, /Customer-safe quality update/);
assert.match(customerPayload, /Customer-safe Dispatch update/);
assert.match(customerPayload, /fabricated-customer-document\.pdf/);
assert.match(customerPayload, /fabricated-customer-quotation\.pdf/);

await assert.rejects(
  () => services.orders.getById('order-demo-dispatch-delivery-001'),
  error => error instanceof ServiceError && error.status === 404,
  'customer must not retrieve another company order by changing the ID',
);
await assert.rejects(
  () => services.audit.list(),
  error => error instanceof ServiceError && error.status === 403,
  'ordinary customers must not read the audit history',
);
assert.deepEqual(Object.keys(services.audit), ['list'], 'ordinary service consumers must not receive an audit mutation API');

const acknowledged = await services.workflow.performAction('security-customer-quoted-rfq', {
  entityType: 'rfq',
  action: 'acknowledge_quotation',
  comment: '',
  data: {
    trackingStatus: 'converted_to_order',
    status: 'Completed',
    targetStatus: 'converted_to_order',
  },
  expectedVersion: 2,
});
assert.equal(acknowledged.trackingStatus, 'awaiting_customer_acceptance', 'browser-supplied status fields must not forge a transition');
await assert.rejects(
  () => services.workflow.performAction(ownOrder.id, {
    entityType: 'order',
    action: 'override_workflow',
    comment: 'Attempted customer status forgery.',
    data: {
      targetStatus: 'completed',
      overrideReason: 'Attempted customer status forgery.',
    },
    expectedVersion: customerOrder.version,
  }),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not invoke an internal workflow override',
);

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const representativeInbox = await services.enquiries.listRepresentativeInbox();
assert.ok(representativeInbox.every(rfq => rfq.representativeId === 'C-27' || rfq.selectedRep?.id === 'C-27'));
await assert.rejects(
  () => services.enquiries.getById('security-unassigned-rfq'),
  error => error instanceof ServiceError && error.status === 404,
  'a representative must not open an unassigned RFQ',
);
await assert.rejects(
  () => services.workflow.performAction('security-unassigned-rfq', {
    entityType: 'rfq',
    action: 'start_rep_review',
    comment: '',
    data: {},
    expectedVersion: 1,
  }),
  error => error instanceof ServiceError && error.status === 404,
  'a representative must not act on an unassigned RFQ',
);

await services.auth.signOut();
const accounts = JSON.parse(storage.getItem(STORE_KEYS.accounts));
const manager = accounts.find(account => account.email === 'manager.workflow@example.invalid');
manager.authorisedCompanyIds = ['company-demo-mining'];
storage.setItem(STORE_KEYS.accounts, JSON.stringify(accounts));
const existingAudit = JSON.parse(storage.getItem(STORE_KEYS.audit));
existingAudit.push(
  {
    id: 'security-audit-authorised',
    action: 'security.authorised_event',
    outcome: 'success',
    entityType: 'order',
    entityId: ownOrder.id,
    companyId: 'company-demo-mining',
    createdAt: now().toISOString(),
  },
  {
    id: 'security-audit-other-company',
    action: 'security.other_company_event',
    outcome: 'success',
    entityType: 'order',
    entityId: 'order-demo-archived-001',
    companyId: 'company-demo-cape',
    createdAt: now().toISOString(),
  },
);
storage.setItem(STORE_KEYS.audit, JSON.stringify(existingAudit));

await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
const scopedCompanies = await services.accounts.listCompanies();
assert.ok(scopedCompanies.length > 0);
assert.ok(scopedCompanies.every(company => company.id === 'company-demo-mining'));
const scopedArchive = await services.archive.list();
assert.ok(scopedArchive.every(order => order.companyId === 'company-demo-mining'));
const scopedAudit = await services.audit.list();
assert.ok(scopedAudit.some(event => event.id === 'security-audit-authorised'));
assert.equal(scopedAudit.some(event => event.id === 'security-audit-other-company'), false);

for (const attempt of [
  () => services.archive.archiveOrder('order-demo-archived-001', { reason: 'Cross-company archive attempt.' }),
  () => services.archive.restoreOrder('order-demo-archived-001', { reason: 'Cross-company restore attempt.' }),
  () => services.archive.setLegalHold('order-demo-archived-001', { active: true, reason: 'Cross-company hold attempt.' }),
  () => services.archive.exportBeforeDeletion('order-demo-archived-001'),
]) {
  await assert.rejects(
    attempt,
    error => error instanceof ServiceError && error.status === 404,
    'restricted management operations must not reveal or modify another company archive',
  );
}

const customerPdfModel = buildOrderSummaryModel({
  order: ownOrder,
  copyType: ORDER_COPY_TYPES.CUSTOMER,
  generatedAt: now().toISOString(),
  generatedBy: 'Fabricated Manager',
});
const customerPdfPayload = JSON.stringify(customerPdfModel);
for (const protectedValue of [
  'SECURITY-PROBE-INTERNAL-FUTURE-NOTE',
  'SECURITY-PROBE-SUPPLIER-COST',
  'SECURITY-PROBE-AUDIT-ID',
  'SECURITY-PROBE-EXPEDITING-NOTE',
  'SECURITY-PROBE-DISPATCH-NOTE',
  '987654',
]) {
  assert.equal(customerPdfPayload.includes(protectedValue), false, `customer PDF model must exclude ${protectedValue}`);
}
assert.equal(customerPdfModel.internal, null);

const recipientOptions = {
  representative: { email: 'representative@example.invalid' },
  internalRecipients: [{ email: 'planning@example.invalid' }],
};
assert.throws(
  () => validateOrderEmailRequest({
    recipientType: 'manual',
    recipientEmail: 'external@example.invalid',
    confirmedExternal: false,
  }, recipientOptions),
  /Confirm the external recipient/,
);
assert.throws(
  () => validateOrderEmailRequest({
    recipientType: 'manual',
    recipientEmail: 'external@example.invalid\r\nBcc: attacker@example.invalid',
    confirmedExternal: true,
  }, recipientOptions),
  /valid recipient email/,
);

assert.match(read('docs/MOCK_MODE_LIMITATIONS.md'), /not a hosted business system/i);
assert.match(read('docs/PRODUCTION-DEPLOYMENT.md'), /Do not log passwords, session cookies, CSRF tokens/i);

console.log('Security isolation, projection, workflow-forgery, secret, pricing, PDF, email, archive and production-contract tests passed.');
