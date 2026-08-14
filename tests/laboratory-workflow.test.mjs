import assert from 'node:assert/strict';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { DEMO_ACCOUNT, LAB_ACCOUNT, LAB_MANAGER_ACCOUNT } from '../src/services/mock/seedData.js';
import { ServiceError } from '../src/services/contracts.js';
import { products } from '../src/data/catalogue.js';
import { certificateRecipientSnapshot, LABORATORY_LAUNCH } from '../src/domain/laboratoryLaunch.js';

class TestStorage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }
const services = createMockServices({ storage: new TestStorage(), now: () => new Date('2026-08-14T10:00:00.000Z') });
await services.initialize();
const signIn = async account => { await services.auth.signOut(); return services.auth.signIn({ email: account.email, password: account.password }); };
const pdf = name => ({ name, type: 'application/pdf', size: 256, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 fabricated').buffer });

assert.equal(LABORATORY_LAUNCH.technicianWorkflowEnabled, false);
await assert.rejects(() => signIn(LAB_ACCOUNT), error => error instanceof ServiceError && error.code === 'INVALID_CREDENTIALS');
const manager = await signIn(LAB_MANAGER_ACCOUNT);
assert.ok(manager.permissions.includes('manage_certificates'));
assert.ok(!manager.permissions.includes('enter_raw_calibration_data'));
const orders = await services.laboratory.listOrders();
const order = orders.find(item => item.laboratory?.units?.length >= 2);
assert.ok(order, 'a fabricated multi-unit certificate task must exist');
const [first, second] = order.laboratory.units;
await assert.rejects(() => services.laboratory.uploadCertificate(order.id, first.id, { file: { ...pdf('bad.txt'), type: 'text/plain' }, certificateNumber: 'CERT-1', issueDate: '2026-08-14', serialNumber: 'SN-1', confirmAssociation: true }), error => error.code === 'CERTIFICATE_FILE_INVALID');
await services.laboratory.uploadCertificate(order.id, first.id, { file: pdf('unit-1.pdf'), certificateNumber: 'CERT-LAUNCH-1', issueDate: '2026-08-14', serialNumber: 'SN-LAUNCH-1', certificationType: first.certificationType, confirmAssociation: true });
let active = (await services.laboratory.listOrders()).find(item => item.id === order.id);
assert.equal(active.laboratory.status, 'awaiting_certificate', 'task remains active until every physical unit has a certificate');
await services.laboratory.uploadCertificate(order.id, second.id, { file: pdf('unit-2.pdf'), certificateNumber: 'CERT-LAUNCH-2', issueDate: '2026-08-14', serialNumber: 'SN-LAUNCH-2', certificationType: second.certificationType, confirmAssociation: true });
active = (await services.laboratory.listOrders()).find(item => item.id === order.id);
assert.equal(active.laboratory.status, 'completed');
const oldId = active.laboratory.units[0].certificateId;
await services.laboratory.replaceCertificate(order.id, first.id, { file: pdf('unit-1-replacement.pdf'), certificateNumber: 'CERT-LAUNCH-1-R1', issueDate: '2026-08-14', serialNumber: 'SN-LAUNCH-1', certificationType: first.certificationType, confirmAssociation: true, reason: 'Corrected fabricated certificate document.' });
active = (await services.laboratory.listOrders()).find(item => item.id === order.id);
assert.notEqual(active.laboratory.units[0].certificateId, oldId);
assert.equal(active.laboratory.units[0].certificateVersions[0].status, 'superseded');

const pressure = products.find(product => product.category === 'pressure' && product.configurations.some(field => field.key === 'sanas'));
const temperature = products.find(product => product.category === 'temperature' && product.configurations.some(field => field.key === 'traceability'));
assert.deepEqual(pressure.configurations.find(field => field.key === 'sanas').options, ['Yes — SANAS', 'No SANAS']);
assert.deepEqual(temperature.configurations.find(field => field.key === 'traceability').options, ['Yes — Traceable', 'No Traceable Certificate']);
const clientSnapshot = certificateRecipientSnapshot({ configuration: { certificateRecipientType: 'My Client', certificateClientName: 'Fabricated Client', certificateAddressLine1: '1 Test Road', certificateCity: 'Cape Town', certificateProvince: 'Western Cape', certificatePostalCode: '8000', certificateCountry: 'South Africa' } }, DEMO_ACCOUNT, '2026-08-14T10:00:00.000Z');
assert.equal(clientSnapshot.recipientType, 'customer_client');
assert.equal(clientSnapshot.recipientName, 'Fabricated Client');

console.log('Launch Laboratory access, certificate upload, multi-unit completion, replacement and recipient tests passed.');
