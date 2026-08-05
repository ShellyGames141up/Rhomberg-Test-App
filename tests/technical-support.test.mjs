import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseViewForRole } from '../src/domain/accessControl.js';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { PERMISSIONS, roleCan, ServiceError, USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const requiredConfiguration = product => {
  const configuration = {};
  for (let pass = 0; pass < 5; pass += 1) for (const field of product.configurations || []) {
    if (!field.required || !shouldShowField(field, configuration) || configuration[field.key] !== undefined) continue;
    const values = optionsForField(field, configuration);
    configuration[field.key] = field.type === 'toggle' ? false : field.type === 'multiChoice' ? [values[0]] : values[0] || 'Fabricated option';
  }
  return configuration;
};

assert.equal(normaliseViewForRole(USER_ROLES.CUSTOMER, 'technical'), 'home', 'direct customer URL access must be rejected');
assert.equal(normaliseViewForRole(USER_ROLES.TECHNICAL_SUPPORT, 'technical'), 'technical');
assert.equal(roleCan(USER_ROLES.CUSTOMER, PERMISSIONS.REQUEST_TECHNICAL_SUPPORT), false);
assert.equal(roleCan(USER_ROLES.SALES_REPRESENTATIVE, PERMISSIONS.REQUEST_TECHNICAL_SUPPORT), true);
assert.equal(roleCan(USER_ROLES.PLANNING, PERMISSIONS.REQUEST_TECHNICAL_SUPPORT), false);
assert.equal(roleCan(USER_ROLES.SALES_MANAGER, PERMISSIONS.OVERRIDE_TECHNICAL_QUOTATION_BLOCK), true);
assert.equal(roleCan(USER_ROLES.MANAGER, PERMISSIONS.OVERRIDE_TECHNICAL_QUOTATION_BLOCK), false);
assert.equal(readFileSync('src/components/Enquiry.jsx', 'utf8').includes('emergency'), false, 'customer RFQ UI must not restore emergency controls');
assert.ok(readFileSync('src/components/TechnicalSupport.jsx', 'utf8').includes('Technical Support Required'));

let clock = new Date('2026-08-05T08:00:00.000Z');
const services = createMockServices({ storage: new TestStorage(), now: () => new Date(clock), emailSender: async () => ({ ok: true }) });
await services.initialize();

await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const catalogue = await services.products.getCatalogue();
const product = catalogue.products.find(item => item.id === 'pbg');
const lines = [{ lineId: 'technical-test-line', productId: product.id, code: product.code, name: product.name, quantity: 2, configuration: requiredConfiguration(product) }];
const submission = await services.enquiries.submit({ submissionKey: 'technical-support-rfq-test', application: 'Fabricated application requiring compatibility advice', medium: 'Process water', area: 'Western Cape', selectedRep: { id: 'C-27' }, fulfilment: 'collect', collectionBranch: 'Cape Town demonstration branch', notes: 'Fabricated test only.', poMode: 'none', poNumber: '' }, lines);
const rfqId = submission.enquiry.id;
await assert.rejects(() => services.technicalSupport.request(rfqId, {}), error => error instanceof ServiceError && error.status === 403);
await assert.rejects(() => services.technicalSupport.listQueue(), error => error instanceof ServiceError && error.status === 403);

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
let rfq = (await services.enquiries.listRepresentativeInbox()).find(item => item.id === rfqId);
rfq = await services.workflow.performAction(rfqId, { entityType: 'rfq', action: 'start_rep_review', expectedVersion: rfq.version, data: {} });
await assert.rejects(() => services.technicalSupport.request(rfqId, { category: '', question: 'short', lineItemId: '', classification: '', confirmRequired: false }), error => error instanceof ServiceError && error.code === 'TECHNICAL_SUPPORT_REQUEST_INVALID');
rfq = await services.technicalSupport.request(rfqId, { category: 'product_compatibility', question: 'Please confirm whether this fabricated gauge configuration is compatible with the application.', lineItemId: lines[0].lineId, priority: 'high', requestedDepartment: 'Technical Support', classification: 'internal_only', confirmRequired: true });
const requestId = rfq.technicalSupport.id;
assert.equal(rfq.technicalSupport.status, 'technical_support_requested');
assert.equal(new Date(rfq.technicalSupport.revisedQuotationTargetAt) - new Date(rfq.technicalSupport.originalQuotationTargetAt), 24 * 36e5);
await assert.rejects(() => services.technicalSupport.request(rfqId, { category: 'product_selection', question: 'A second active request must not extend the target again.', lineItemId: lines[0].lineId, priority: 'standard', classification: 'internal_only', confirmRequired: true }), error => error instanceof ServiceError && error.code === 'TECHNICAL_SUPPORT_ALREADY_ACTIVE');
await assert.rejects(() => services.workflow.performAction(rfqId, { entityType: 'rfq', action: 'mark_quoted', expectedVersion: rfq.version, data: { quotationNumber: 'Q-BLOCKED', quotationDate: '2026-08-05', quotationExpiryMode: 'dated', quotationExpiryDate: '2026-09-05' } }), error => error instanceof ServiceError && error.code === 'TECHNICAL_REVIEW_PENDING');

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.manager@example.invalid', password: 'SalesManager123!' });
await assert.rejects(() => services.technicalSupport.override(requestId, { reason: 'short' }), error => error instanceof ServiceError && error.code === 'TECHNICAL_OVERRIDE_REASON_REQUIRED');
await services.technicalSupport.override(requestId, { reason: 'Fabricated manager-approved quotation exception for automated testing.' });
const overridden = await services.enquiries.getById(rfqId);
assert.equal(overridden.technicalSupport.quotationOverride.active, true);

await services.auth.signOut();
await services.auth.signIn({ email: 'technical.manager@example.invalid', password: 'TechnicalManager123!' });
let queue = await services.technicalSupport.listQueue();
assert.ok(queue.some(item => item.id === rfqId));
await services.technicalSupport.assign(requestId, { technicalUserId: 'staff-technical-support-demo' });

await services.auth.signOut();
await services.auth.signIn({ email: 'technical.support@example.invalid', password: 'TechnicalDemo123!' });
await services.technicalSupport.startReview(requestId);
await services.technicalSupport.requestInformation(requestId, { target: 'customer', message: 'Please ask the customer to confirm the fabricated process connection orientation.' });

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
await services.technicalSupport.forwardCustomerRequest(requestId, { message: 'Please confirm the required process connection orientation for this enquiry.' });

await services.auth.signOut();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerRfq = await services.enquiries.getById(rfqId);
assert.equal(customerRfq.technicalSupport.question, undefined, 'internal representative question must not leak to the customer');
assert.ok(customerRfq.technicalSupport.messages.every(message => message.classification === undefined));
assert.ok(customerRfq.technicalSupport.customerInformationRequest.message.includes('connection orientation'));
await services.technicalSupport.postMessage(requestId, { message: 'The fabricated requirement is bottom entry.' });

await services.auth.signOut();
await services.auth.signIn({ email: 'technical.support@example.invalid', password: 'TechnicalDemo123!' });
await services.technicalSupport.respond(requestId, { response: 'The submitted configuration is technically suitable for this fabricated application.', recommendation: 'Proceed with the selected PBG configuration.', approvedProductOrConfiguration: 'PBG test configuration', customerSafeNote: 'The selected instrument configuration has passed technical review.', internalNote: 'Fabricated calculation omitted from customer view.' });
clock = new Date('2026-08-05T12:00:00.000Z');
await services.technicalSupport.complete(requestId, { note: 'Fabricated review complete.' });
const completed = await services.enquiries.getById(rfqId);
assert.equal(completed.technicalSupport.status, 'technical_support_completed');
await services.auth.signOut();
await services.auth.signIn({ email: 'administrator.workflow@example.invalid', password: 'Admin123!' });
const audits = await services.audit.list();
assert.ok(audits.some(event => event.action === 'technical_support.requested'));
assert.ok(audits.some(event => event.action === 'technical_support.customer_response_received'));
assert.ok(audits.some(event => event.action === 'technical_support.completed'));

await services.auth.signOut();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerNotifications = await services.notifications.list();
assert.ok(customerNotifications.some(notification => notification.entityId === rfqId && notification.eventType === 'technical_deadline_extended'));
assert.ok(customerNotifications.some(notification => notification.entityId === rfqId && notification.eventType === 'technical_review_completed'));
const otherCompanyRecords = await services.enquiries.list();
assert.ok(otherCompanyRecords.every(record => record.companyId === 'company-demo-cape'), 'company isolation must remain enforced');

console.log('Technical Support workflow tests passed.');
