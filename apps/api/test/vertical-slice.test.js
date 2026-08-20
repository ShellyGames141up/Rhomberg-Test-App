import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, createRfq, ids, login, validRfq } from './fixtures.js';

test('customer creates, lists and retrieves an RFQ with audit and representative notification', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const auth = await login(app); const response = await createRfq(app, auth);
  assert.equal(response.statusCode, 201);
  const enquiry = response.json().data.enquiry;
  assert.equal(enquiry.companyId, ids.companyA); assert.equal(enquiry.trackingStatus, 'assigned_to_rep'); assert.equal(enquiry.priority, 'standard');
  assert.equal(repository._state.audits.some(event => event.eventType === 'rfq.created' && event.entityId === enquiry.id), true);
  assert.equal(repository._state.notifications.some(notification => notification.recipientUserId === ids.representativeUser && notification.companyId === ids.companyA), true);
  const list = await app.inject({ url: '/api/v1/enquiries', headers: { cookie: auth.cookie } });
  assert.equal(list.json().data.length, 1);
  const detail = await app.inject({ url: `/api/v1/enquiries/${enquiry.id}`, headers: { cookie: auth.cookie } });
  assert.equal(detail.statusCode, 200); assert.equal(detail.json().data.reference, enquiry.reference);
});

test('invalid payload and client-supplied ownership, role, status or priority are rejected', async t => {
  const { app } = await createFixture(); t.after(() => app.close()); const auth = await login(app);
  const invalid = await createRfq(app, auth, { details: { application: 'x' }, items: [] });
  assert.equal(invalid.statusCode, 422); assert.equal(invalid.json().error.code, 'VALIDATION_ERROR');
  for (const [field, value] of [['companyId', ids.companyB], ['role', 'administrator'], ['status', 'quoted'], ['priority', 'urgent']]) {
    const payload = validRfq(); payload.details[field] = value;
    const response = await createRfq(app, auth, payload);
    assert.equal(response.statusCode, 422, `${field} should be rejected`);
  }
  const priced = validRfq(); priced.items[0].unitPrice = 123;
  assert.equal((await createRfq(app, auth, priced)).statusCode, 422);
});

test('idempotent retry returns the same RFQ and conflicting replay is rejected', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close()); const auth = await login(app); const key = 'fabricated-stable-idempotency-key';
  const first = await createRfq(app, auth, validRfq(), key); const second = await createRfq(app, auth, validRfq(), key);
  assert.equal(first.statusCode, 201); assert.equal(second.statusCode, 200);
  assert.equal(first.json().data.enquiry.id, second.json().data.enquiry.id); assert.equal(repository._state.enquiries.length, 1);
  const changed = validRfq(); changed.items[0].quantity = 3;
  const conflict = await createRfq(app, auth, changed, key);
  assert.equal(conflict.statusCode, 409); assert.equal(conflict.json().error.code, 'IDEMPOTENCY_CONFLICT');
});

test('company isolation blocks list, direct RFQ access and document metadata access', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const authA = await login(app); const createdA = await createRfq(app, authA);
  const authB = await login(app, 'customer.b@example.invalid'); const createdB = await createRfq(app, authB, validRfq(ids.representativeB));
  assert.equal(createdA.statusCode, 201); assert.equal(createdB.statusCode, 201);
  const enquiryB = createdB.json().data.enquiry;
  assert.equal((await app.inject({ url: `/api/v1/enquiries/${enquiryB.id}`, headers: { cookie: authA.cookie } })).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/v1/enquiries', headers: { cookie: authA.cookie } })).json().data.length, 1);
  const foreignDocumentId = '40000000-0000-4000-8000-000000000001';
  repository._state.documents.push({ id: foreignDocumentId, companyId: ids.companyB, rfqId: enquiryB.id, originalName: 'fabricated.pdf' });
  assert.equal((await app.inject({ url: `/api/v1/documents/${foreignDocumentId}`, headers: { cookie: authA.cookie } })).statusCode, 404);
  assert.equal(repository._state.audits.some(event => event.eventType === 'security.access_denied' && event.companyId === ids.companyA), true);
});

test('multipart document metadata remains private and no public download URL is returned', async t => {
  const { app, repository, storage } = await createFixture(); t.after(() => app.close()); const auth = await login(app);
  const boundary = '----fabricated-boundary';
  const body = Buffer.from([
    `--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(validRfq())}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="purchaseOrder"; filename="fabricated-po.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 fabricated harmless test\r\n`,
    `--${boundary}--\r\n`,
  ].join(''));
  const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf, 'idempotency-key': 'fabricated-document-key', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: body });
  assert.equal(response.statusCode, 201);
  const document = response.json().data.enquiry.documents[0];
  assert.equal(document.fileName, 'fabricated-po.pdf'); assert.equal('storageKey' in document, false); assert.equal('downloadUrl' in document, false);
  assert.equal(storage._objects.size, 1); assert.equal(repository._state.documents[0].companyId, ids.companyA);
  const metadata = await app.inject({ url: `/api/v1/documents/${document.id}`, headers: { cookie: auth.cookie } });
  assert.equal(metadata.statusCode, 200);
  assert.equal(repository._state.audits.some(event => event.eventType === 'document.metadata_created' && event.entityId === document.id), true);
  assert.equal(repository._state.audits.some(event => event.eventType === 'document.metadata_accessed' && event.entityId === document.id), true);
});
