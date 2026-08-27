import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createFixture, ids, login } from './fixtures.js';

const multipart = (metadata, files) => {
  const boundary = `----fabricated-lab-${randomUUID()}`;
  const parts = [`--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify(metadata)}\r\n`];
  files.forEach((file, index) => parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${files.length > 1 ? 'certificates' : 'certificate'}"; filename="${index + 1}-${file.name}"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 fabricated certificate ${index + 1}\r\n`));
  parts.push(`--${boundary}--\r\n`);
  return { boundary, body: Buffer.from(parts.join('')) };
};

test('simplified Laboratory manager uploads, replaces and securely retrieves certificate content', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const source = repository._state.users.find(user => user.id === ids.representativeUser);
  repository._state.users.push({ ...structuredClone(source), id: '20000000-0000-4000-8000-000000000099', email: 'lab.manager@example.invalid', displayName: 'Fabricated Laboratory Manager', roles: ['laboratory_manager'], permissions: ['view_lab_queue','manage_certificates','download_certificates','read_audit_history'], companyIds: [] });
  const orderId = '40000000-0000-4000-8000-000000000099';
  repository._state.orders.push({ id: orderId, reference: 'OR-2099-000099', companyId: ids.companyA, company: 'Fabricated Company A', contact: 'Fabricated Customer A', representativeId: ids.representativeA, selectedRep: { id: ids.representativeA, name: 'Fabricated Representative A' }, trackingStatus: 'awaiting_lab', status: 'awaiting_lab', priority: 'standard', fulfilment: 'collect', application: 'Fabricated calibration test', details: {}, items: [{ id: '41000000-0000-4000-8000-000000000099', productId: 'fabricated-pressure-gauge', code: 'DEMO-PG', name: 'Fabricated pressure gauge', quantity: 1, configuration: { sanas: 'Yes — SANAS Calibration', certificateRecipientType: 'My Company' } }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const auth = await login(app, 'lab.manager@example.invalid');
  const queue = await app.inject({ url: '/api/v1/laboratory/orders', headers: { cookie: auth.cookie } });
  assert.equal(queue.statusCode, 200); const unit = queue.json().data[0].laboratory.units[0];
  const first = multipart({ certificateNumber: 'FAB-CERT-001', issueDate: '2099-01-10', serialNumber: 'FAB-SERIAL-1', confirmAssociation: true }, [{ name: 'fabricated-certificate.pdf' }]);
  const uploaded = await app.inject({ method: 'POST', url: `/api/v1/laboratory/orders/${orderId}/units/${unit.id}/certificate`, headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf, 'content-type': `multipart/form-data; boundary=${first.boundary}` }, payload: first.body });
  assert.equal(uploaded.statusCode, 200); const certificateId = uploaded.json().data.certificateId;
  const downloaded = await app.inject({ url: `/api/v1/certificates/${certificateId}/download`, headers: { cookie: auth.cookie } });
  assert.equal(downloaded.statusCode, 200); assert.equal(downloaded.headers['content-type'], 'application/pdf'); assert.match(downloaded.body, /^%PDF-1\.4 fabricated/);
  const replacement = multipart({ certificateNumber: 'FAB-CERT-001-R1', issueDate: '2099-01-11', serialNumber: 'FAB-SERIAL-1', confirmAssociation: true, reason: 'Corrected fabricated issue date' }, [{ name: 'fabricated-replacement.pdf' }]);
  const replaced = await app.inject({ method: 'POST', url: `/api/v1/laboratory/orders/${orderId}/units/${unit.id}/certificate/replace`, headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf, 'content-type': `multipart/form-data; boundary=${replacement.boundary}` }, payload: replacement.body });
  assert.equal(replaced.statusCode, 200); assert.equal(replaced.json().data.certificateVersions.length, 1);
  assert.equal(repository._state.audits.filter(event => event.eventType.startsWith('certificate.')).length, 2);
});

test('certificate access is tenant-safe and customer download remains quarantined until scanning completes', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const documentId = randomUUID(); repository._state.documents.push({ id: documentId, storageKey: 'memory/not-present', companyId: ids.companyA, kind: 'certificate', originalName: 'fabricated.pdf', mediaType: 'application/pdf', scanStatus: 'pending', customerVisible: true });
  const customerA = await login(app); const customerB = await login(app, 'customer.b@example.invalid');
  assert.equal((await app.inject({ url: `/api/v1/certificates/${documentId}/download`, headers: { cookie: customerA.cookie } })).statusCode, 423);
  assert.equal((await app.inject({ url: `/api/v1/certificates/${documentId}/download`, headers: { cookie: customerB.cookie } })).statusCode, 404);
});

test('certificate download rejects non-certificate documents even when company-visible', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const documentId = randomUUID();
  repository._state.documents.push({ id: documentId, storageKey: 'memory/not-present', companyId: ids.companyA, kind: 'quotation', originalName: 'fabricated.pdf', mediaType: 'application/pdf', scanStatus: 'clean', customerVisible: true });
  const customer = await login(app);
  assert.equal((await app.inject({ url: `/api/v1/certificates/${documentId}/download`, headers: { cookie: customer.cookie } })).statusCode, 404);
});
