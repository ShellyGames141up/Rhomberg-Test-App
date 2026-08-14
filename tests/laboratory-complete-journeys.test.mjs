import assert from 'node:assert/strict';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { LAB_MANAGER_ACCOUNT } from '../src/services/mock/seedData.js';

class TestStorage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }
const services = createMockServices({ storage: new TestStorage() });
await services.initialize();
await services.auth.signIn({ email: LAB_MANAGER_ACCOUNT.email, password: LAB_MANAGER_ACCOUNT.password });
const orders = await services.laboratory.listOrders();
assert.ok(orders.some(order => order.laboratory.units.some(unit => unit.certificationType === 'sanas')), 'combined manager sees pressure SANAS work');
assert.ok(orders.some(order => order.laboratory.units.some(unit => unit.certificationType === 'traceable')), 'combined manager sees temperature Traceable work');
const source = await import('node:fs').then(fs => fs.readFileSync('src/components/LaboratoryDashboard.jsx', 'utf8'));
for (const control of ['thermal stabilisation', 'raw data worksheet', 'uncertainty calculations', 'calibration method']) assert.ok(!source.toLowerCase().includes(control));
assert.ok(source.includes('Completed Certificates'));
assert.ok(source.includes('Replace Certificate'));
console.log('Pressure and Temperature launch certificate queues and simplified manager UI tests passed.');
