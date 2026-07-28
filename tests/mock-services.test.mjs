import assert from 'node:assert/strict';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { ServiceError } from '../src/services/contracts.js';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new TestStorage();
let attachedSubmissionFile = 'not-called';
const services = createMockServices({
  storage,
  now: () => new Date('2026-07-28T12:00:00.000Z'),
  emailSender: async (_rfq, file) => {
    attachedSubmissionFile = file;
    return { ok: true, recipient: 'workflow@example.invalid', deliveryMode: 'test', pricedPdfAttached: false };
  },
});
await services.initialize();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const catalogue = await services.products.getCatalogue();
const product = catalogue.products.find(item => item.id === 'pbb') || catalogue.products[0];
const configuration = {};
for (let pass = 0; pass < 3; pass += 1) {
  for (const field of product.configurations || []) {
    if (!field.required || !shouldShowField(field, configuration) || configuration[field.key] !== undefined) continue;
    configuration[field.key] = optionsForField(field, configuration)[0] || 'Demo value';
  }
}
const line = { lineId: 'line-test', productId: product.id, code: product.code, name: product.name, quantity: 1, configuration };

const details = {
  application: 'Fabricated process monitoring application',
  medium: 'Water',
  area: 'Western Cape',
  selectedRep: { id: 'C-27' },
  emergency: 'no',
  fulfilment: 'collect',
  deliveryAddress: '',
  collectionBranch: 'Cape Town',
  notes: 'Demonstration RFQ without a PO.',
};

await assert.rejects(
  () => services.enquiries.submit({ ...details, poNumber: 'PO-NOT-ALLOWED' }, [line]),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.purchaseOrder),
  'the service boundary must reject PO fields during RFQ submission',
);
const submission = await services.enquiries.submit(details, [line]);
assert.equal(attachedSubmissionFile, null, 'RFQ delivery must never receive a PO file');
assert.equal(submission.enquiry.documents.length, 0);
assert.equal('poNumber' in submission.enquiry, false);
assert.equal(submission.enquiry.companyId, 'company-demo-cape');

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
let rfq = (await services.enquiries.listRepresentativeInbox()).find(item => item.id === submission.enquiry.id);
rfq = await services.workflow.performAction(rfq.id, { entityType: 'rfq', action: 'start_rep_review', data: {}, comment: '', expectedVersion: rfq.version });
await assert.rejects(
  () => services.workflow.performAction(rfq.id, {
    entityType: 'rfq', action: 'send_quotation', comment: '', expectedVersion: rfq.version,
    data: { quotationNumber: 'Q-TEST', quotationDate: '2026-07-28', quotationExpiryDate: '2026-08-28', customerMessage: 'Please review.' },
  }),
  error => error instanceof ServiceError && error.code === 'INVALID_DOCUMENT',
);
rfq = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq', action: 'send_quotation', comment: '', expectedVersion: rfq.version,
  data: { quotationNumber: 'Q-TEST', quotationDate: '2026-07-28', quotationExpiryDate: '2026-08-28', customerMessage: 'Please review the quotation.', documentFile: { name: 'Q-TEST.pdf', type: 'application/pdf', size: 2048 } },
});
assert.equal(rfq.quotationVersions[0].versionNumber, 1);
assert.equal(rfq.quotationVersions[0].internalNote || '', '');

await services.auth.signOut();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
rfq = await services.enquiries.getById(rfq.id);
assert.equal(rfq.quotationVersions[0].internalNote, undefined, 'internal notes must not leak into customer projections');
rfq = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq', action: 'accept_quotation', comment: '', expectedVersion: rfq.version,
  data: { purchaseOrderNumber: 'PO-TEST', confirmed: true, documentFile: { name: 'PO-TEST.pdf', type: 'application/pdf', size: 1024 } },
});
assert.equal(rfq.trackingStatus, 'customer_accepted_pending_rep_verification');

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
rfq = await services.enquiries.getById(rfq.id);
const converted = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq', action: 'verify_po_create_order', comment: '', expectedVersion: rfq.version,
  data: { verified: true, internalNote: 'PO matches current quotation.' },
});
assert.equal(converted.trackingStatus, 'converted_to_order');
assert.equal(converted.createdOrder.trackingStatus, 'awaiting_planning');
const replay = await services.workflow.performAction(rfq.id, {
  entityType: 'rfq', action: 'verify_po_create_order', comment: '', expectedVersion: converted.version,
  data: { verified: true },
});
assert.equal(replay.idempotent, true);

const quotationDocument = converted.documents.find(document => document.category === 'representative_quotation');
const download = await services.documents.download(quotationDocument.id);
assert.match(download.downloadUrl, /^data:text\/plain/);
await services.auth.signOut();
await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
const audit = await services.audit.list({ entityId: converted.id });
assert.ok(audit.some(event => event.action === 'workflow.send_quotation'));
assert.ok(audit.some(event => event.action === 'workflow.accept_quotation'));
assert.ok(audit.some(event => event.action === 'workflow.verify_po_create_order'));

console.log('Mock service RFQ-to-order and document integration tests passed.');
