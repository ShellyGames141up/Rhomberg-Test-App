import assert from 'node:assert/strict';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { DEMO_ACCOUNT, LAB_ACCOUNT, LAB_MANAGER_ACCOUNT } from '../src/services/mock/seedData.js';
import { ServiceError } from '../src/services/contracts.js';
import { PRESSURE_POINT_SEQUENCE } from '../src/domain/laboratoryCalibration.js';

class TestStorage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }
const services = createMockServices({ storage: new TestStorage(), now: () => new Date('2026-08-03T10:00:00.000Z') });
await services.initialize();
const signIn = async account => { await services.auth.signOut(); return services.auth.signIn({ email: account.email, password: account.password }); };

await signIn(LAB_ACCOUNT);
let order = (await services.laboratory.listOrders()).find(item => item.laboratory?.units?.length);
assert.ok(order, 'fabricated seed must include a Laboratory order');
let unit = order.laboratory.units[0];
unit = await services.laboratory.receive(order.id, unit.id, { branchId: 'cape_town', conditionOnReceipt: 'Satisfactory fabricated condition', packageCondition: 'Satisfactory', numberOfUnits: 1, customerDocumentsReceived: true });
assert.equal(unit.labWork.status, 'received_in_lab');
unit = (await services.laboratory.listOrders()).find(item => item.id === order.id).laboratory.units.find(item => item.id === unit.id);
assert.equal(unit.labWork.status, 'received_in_lab');
await services.laboratory.startStabilisation(order.id, unit.id, { ambientTemperature: 21 });
await services.laboratory.completeStabilisation(order.id, unit.id, { ambientTemperature: 21, equilibriumConfirmed: true });
await services.laboratory.inspect(order.id, unit.id, { outcome: 'no_visible_defect' });
await services.laboratory.bookIn(order.id, unit.id, { instrumentDescription: 'Fabricated pressure indicator', manufacturer: 'Fabricated manufacturer', serialNumber: 'DEMO-LAB-001', rangeMinimum: 0, rangeMaximum: 700, unit: 'bar', resolution: 0.01, methodId: 'pressure_dwt_700_bar', sanasOrTraceable: 'sanas' });
await services.laboratory.saveWorksheet(order.id, unit.id, {
  methodId: 'pressure_dwt_700_bar', standardIds: ['std-ct-dwt-700'], coverageFactor: 2, decimals: 5,
  testPoints: PRESSURE_POINT_SEQUENCE.map((point, index) => ({ ...point, applied: point.direction === 'repeatability' ? 350 : index * 40, readings: [point.direction === 'repeatability' ? 350 + index / 100 : index * 40] })),
  uncertaintyContributions: [{ source: 'Fabricated standard', uncertainty: 0.04, divisor: 2, sensitivity: 1, degreesOfFreedom: 200 }],
  environmental: { temperature: 21, humidity: 50 },
});
await services.laboratory.startCalibration(order.id, unit.id, { note: 'Fabricated integration run' });
await services.laboratory.holdCalibration(order.id, unit.id, { reason: 'Fabricated controlled equipment check.' });
await services.laboratory.startCalibration(order.id, unit.id, { note: 'Fabricated controlled resume' });
unit = await services.laboratory.calculate(order.id, unit.id);
assert.equal(unit.labWork.status, 'calculation_review_required');
assert.equal(unit.labWork.worksheet.locked, true);

await signIn(LAB_MANAGER_ACCOUNT);
await assert.rejects(() => services.laboratory.saveWorksheet(order.id, unit.id, {}), error => error instanceof ServiceError && error.status === 403);
await services.laboratory.approveFormulaValidation(order.id, unit.id, { confirmed: true, reason: 'Fabricated management review evidence.' });
await signIn(LAB_ACCOUNT);
await services.laboratory.completeCalibration(order.id, unit.id, { technicianConfirmed: true, resultSummary: 'Fabricated completed result' });
await services.laboratory.completeLabelling(order.id, unit.id, { calibrationLabelApplied: true, identificationChecked: true, calibrationDate: '2026-08-03', checkedBy: 'Fabricated checker' });
await services.laboratory.releaseUnitToDispatch(order.id, unit.id, { bomSignedOff: true, destination: 'dispatch', numberOfPackages: 1, internalNote: 'Internal fabricated transfer note' });

await signIn(LAB_MANAGER_ACCOUNT);
const review = await services.laboratory.generateReviewPdf(order.id, unit.id);
assert.match(review.dataUrl, /^data:application\/pdf;base64,/);
await services.laboratory.generateDraftCertificate(order.id, unit.id);
await services.laboratory.submitCertificateForReview(order.id, unit.id, { comment: 'Fabricated review submission' });
await services.laboratory.approveForSignature(order.id, unit.id, { confirmed: true, signatoryName: 'Fabricated signatory', issue: 'Issue 1' });
await services.laboratory.generateUnsignedCertificate(order.id, unit.id);
const pdfFile = { name: 'fabricated-signed.pdf', type: 'application/pdf', size: 128, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 fabricated signed certificate').buffer };
const signed = await services.laboratory.uploadSignedCertificate(order.id, unit.id, { file: pdfFile, issueDate: '2026-08-03' });
assert.match(signed.sha256, /^[a-f0-9]{64}$/);

await signIn(DEMO_ACCOUNT);
await assert.rejects(() => services.laboratory.downloadCertificate(signed.id), error => error instanceof ServiceError && error.code === 'CERTIFICATE_NOT_FOUND');
await signIn(LAB_MANAGER_ACCOUNT);
await services.laboratory.releaseCertificate(order.id, unit.id, { recipientRule: 'customer_and_representative' });
await signIn(DEMO_ACCOUNT);
const customerOrder = (await services.orders.list()).find(item => item.id === order.id);
const customerUnit = customerOrder.laboratory.units.find(item => item.id === unit.id);
assert.equal(customerUnit.labWork, undefined);
assert.equal(customerUnit.certificate, undefined);
assert.equal(customerUnit.certificateStatus, 'verified');
assert.match((await services.laboratory.downloadCertificate(signed.id)).dataUrl, /^data:application\/pdf;base64,/);

console.log('Controlled Laboratory service workflow, role separation, PDF release and customer privacy tests passed.');
