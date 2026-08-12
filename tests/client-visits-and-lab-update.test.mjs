import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { ADMINISTRATOR_ACCOUNT, SALES_ACCOUNT, SALES_MANAGER_ACCOUNT, STORE_KEYS } from '../src/services/mock/seedData.js';
import { LAB_METHOD_IDS, PRESSURE_POINT_SEQUENCE, calculateLaboratoryWorksheet, calculateTemperaturePoint } from '../src/domain/laboratoryCalibration.js';
import { isWithinWorkingHours, verificationStatus } from '../src/domain/clientVisits.js';
import { ServiceError } from '../src/services/contracts.js';

class TestStorage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }
const storage = new TestStorage();
const services = createMockServices({ storage });
await services.initialize();
const signIn = async account => { await services.auth.signOut(); return services.auth.signIn({ email: account.email, password: account.password }); };

assert.equal(PRESSURE_POINT_SEQUENCE.filter(item => item.direction === 'increasing').length, 6);
assert.equal(PRESSURE_POINT_SEQUENCE.filter(item => item.direction === 'repeatability').length, 5);
assert.equal(PRESSURE_POINT_SEQUENCE.filter(item => item.direction === 'decreasing').length, 5);
const pressure = calculateLaboratoryWorksheet({ methodId: LAB_METHOD_IDS.PRESSURE_DWT_700_BAR, testPoints: PRESSURE_POINT_SEQUENCE.map((item, index) => ({ ...item, applied: index, readings: [index] })), uncertaintyContributions: [{ source: 'Fabricated reference', uncertainty: 0.04, divisor: 2, sensitivity: 1, degreesOfFreedom: 200 }] });
assert.equal(pressure.points.length, 16);
const timestamps = Array.from({ length: 7 }, (_, index) => `2026-08-09T10:0${index}:00.000Z`);
const temperature = calculateTemperaturePoint({ applied: 20, standardCorrection: 0.02, referenceReadings: [20, 20.01, 20, 20.01, 20, 20.01, 20], readings: [20.1, 20.11, 20.1, 20.11, 20.1, 20.11, 20.1], readingTimestamps: timestamps, ambientTemperature: 23, immersionDepth: '100 mm', stabilisationConfirmed: true });
assert.equal(temperature.readings.length, 7, 'Temperature must allow readings beyond the minimum six');
assert.equal(temperature.readingTimestamps.length, 7);
assert.equal(temperature.ambientTemperature, 23);
assert.throws(() => calculateTemperaturePoint({ applied: 20, referenceReadings: [20, 20], readings: [20, 20] }), /at least 6 paired/i);

await signIn(SALES_ACCOUNT);
const clients = await services.clientVisits.listClients();
assert.equal(clients.length, 5, 'Representative A must see only five assigned fabricated customers');
assert.ok(clients.every(client => client.representativeId === SALES_ACCOUNT.representativeId));
const overview = await services.clientVisits.getOverview();
assert.equal(overview.assignedCustomers, 5);
assert.ok((await services.notifications.list()).some(item => ['client_visit_due_soon', 'client_visit_overdue'].includes(item.eventType)), 'due and overdue visits must create in-app reminders');
const scheduledAt = new Date(Date.now() + 86400000).toISOString();
let appointment = await services.clientVisits.schedule(clients[0].id, { scheduledAt, expectedDurationMinutes: 60, purpose: 'Fabricated monthly visit', contact: clients[0].primaryContact, address: clients[0].address });
assert.equal(appointment.status, 'scheduled');
appointment = await services.clientVisits.start(appointment.id);
await assert.rejects(() => services.clientVisits.locationCheck(appointment.id, { permissionStatus: 'denied' }), error => error instanceof ServiceError && error.code === 'LOCATION_PERMISSION_DENIED');
const geofence = await services.clientVisits.locationCheck(appointment.id, { permissionStatus: 'enabled', latitude: clients[0].latitude, longitude: clients[0].longitude });
assert.equal(geofence.matched, true);
await services.clientVisits.customerConfirm(appointment.id);
const qr = await services.clientVisits.createQr(appointment.id);
await services.clientVisits.verifyQr(appointment.id, qr.token);
await assert.rejects(() => services.clientVisits.verifyQr(appointment.id, qr.token), error => error instanceof ServiceError && error.code === 'VISIT_QR_REUSED');
appointment = await services.clientVisits.complete(appointment.id, { notes: 'Fabricated completed visit' });
assert.equal(appointment.verificationStatus, 'verified');
assert.equal(verificationStatus(appointment.signals).status, 'verified');

const secondQr = await services.clientVisits.createQr(appointment.id);
const qrRecords = JSON.parse(storage.getItem(STORE_KEYS.visitQrTokens));
qrRecords.find(item => item.id === secondQr.id).expiresAt = new Date(Date.now() - 60000).toISOString();
storage.setItem(STORE_KEYS.visitQrTokens, JSON.stringify(qrRecords));
await assert.rejects(() => services.clientVisits.verifyQr(appointment.id, secondQr.token), error => error instanceof ServiceError && error.code === 'VISIT_QR_EXPIRED');

assert.equal(isWithinWorkingHours('2026-08-10T10:00:00+02:00', { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }), true);
assert.equal(isWithinWorkingHours('2026-08-09T10:00:00+02:00', { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' }), false);

await signIn(SALES_MANAGER_ACCOUNT);
const compliance = await services.clientVisits.getCompliance();
assert.equal(compliance.length, 2);
assert.ok(compliance.every(item => item.fabricated));

await signIn(ADMINISTRATOR_ACCOUNT);
const locations = await services.clientVisits.getLocations();
assert.equal(locations.length, 4);
const updated = await services.clientVisits.saveLocation({ ...locations[0], radiusMetres: 275 });
assert.equal(updated.radiusMetres, 275);
const safePolicy = await services.clientVisits.savePolicy({ defaultVisitCycleDays: 35, advanceReminderDays: 7, routineLocationAnalyticsEnabled: true });
assert.equal(safePolicy.routineLocationAnalyticsEnabled, false, 'public mock mode must never activate routine employee tracking');
assert.match(readFileSync('.gitignore', 'utf8'), /private\//);

console.log('Dynamic Temperature, Pressure 6/5/5, assigned Clients, visits, reminders, geofence, QR, compliance, privacy and location controls passed.');
const visitStyles = readFileSync('styles.css', 'utf8');
assert.ok(visitStyles.includes('/* Client visit information and KPIs remain readable */'));
assert.ok(visitStyles.includes('.visit-kpis{grid-template-columns:repeat(3'));
const visitComponent = readFileSync('src/components/ClientVisitsDashboard.jsx', 'utf8');
for (const step of ['Client information', 'Visit date and time', 'Purpose', 'Agenda and notes', 'Reminder and follow-up', 'Review and schedule']) assert.ok(visitComponent.includes(step));
assert.ok(visitComponent.includes('Monthly activity'));
assert.ok(visitComponent.includes('Open RFQs/orders'));
assert.equal(visitComponent.includes('<p>{client.notes}</p>'), false);
