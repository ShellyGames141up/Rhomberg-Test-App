import assert from 'node:assert/strict';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { LAB_MANAGER_ACCOUNT } from '../src/services/mock/seedData.js';
import { PERMISSIONS } from '../src/services/contracts.js';
import { PRESSURE_POINT_SEQUENCE } from '../src/domain/laboratoryCalibration.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const services = createMockServices({ storage: new TestStorage(), now: () => new Date('2026-08-05T09:30:00.000Z') });
await services.initialize();
const session = await services.auth.signIn({ email: LAB_MANAGER_ACCOUNT.email, password: LAB_MANAGER_ACCOUNT.password });
assert.equal(session.contact, 'Fabricated Laboratory Manager', 'the fabricated Laboratory Manager login must support the complete authorised journey');
assert.ok(session.permissions.includes(PERMISSIONS.ENTER_RAW_CALIBRATION_DATA), 'secondary technician roles must grant raw-data permission');
assert.ok(session.permissions.includes(PERMISSIONS.APPROVE_CALCULATION_REVIEW), 'manager permissions must remain available');

const journeys = [
  { orderId: 'order-phase21-sanas-001', discipline: 'Pressure', methodId: 'pressure_dwt_700_bar', standardId: 'std-ct-dwt-700', unitName: 'bar', minimum: 0, maximum: 10, applied: 5, readings: [5, 5.01, 5, 5.01, 5] },
  { orderId: 'order-phase21-traceable-001', discipline: 'Temperature', methodId: 'temperature_comparison', standardId: 'std-ct-temperature', unitName: '°C', minimum: -20, maximum: 100, applied: 20, readings: [20.01, 20, 20.01, 20, 20.01, 20] },
];

for (const journey of journeys) {
  let order = (await services.laboratory.listOrders()).find(item => item.id === journey.orderId);
  assert.ok(order, `${journey.discipline} demonstration order must exist`);
  const unitId = order.laboratory.units[0].id;
  await services.laboratory.receive(order.id, unitId, { branchId: 'cape_town', conditionOnReceipt: 'Satisfactory fabricated condition', packageCondition: 'Satisfactory', numberOfUnits: 1, customerDocumentsReceived: true });
  await services.laboratory.startStabilisation(order.id, unitId, { ambientTemperature: 21 });
  await services.laboratory.completeStabilisation(order.id, unitId, { ambientTemperature: 21, equilibriumConfirmed: true });
  await services.laboratory.inspect(order.id, unitId, { outcome: 'no_visible_defect' });
  await services.laboratory.bookIn(order.id, unitId, { instrumentDescription: `Fabricated ${journey.discipline} instrument`, manufacturer: 'Fabricated manufacturer', serialNumber: `DEMO-${journey.discipline.toUpperCase()}-001`, rangeMinimum: journey.minimum, rangeMaximum: journey.maximum, unit: journey.unitName, resolution: 0.01, methodId: journey.methodId });
  await services.laboratory.saveWorksheet(order.id, unitId, {
    methodId: journey.methodId,
    standardIds: [journey.standardId],
    coverageFactor: 2,
    decimals: 5,
    testPoints: journey.discipline === 'Pressure'
      ? PRESSURE_POINT_SEQUENCE.map((point, index) => ({ ...point, applied: point.direction === 'repeatability' ? journey.applied : index, readings: [point.direction === 'repeatability' ? journey.applied + index / 100 : index] }))
      : [{ id: 'point-1', applied: journey.applied, direction: 'temperature', referenceReadings: [20, 20, 20, 20, 20, 20], readings: journey.readings, readingTimestamps: Array.from({ length: 6 }, (_, index) => `2026-08-05T09:${30 + index}:00.000Z`), ambientTemperature: 21, immersionDepth: '100 mm', stabilisationConfirmed: true, resultStatus: 'satisfactory' }],
    uncertaintyContributions: [{ source: 'Fabricated reference standard', uncertainty: 0.04, divisor: 2, sensitivity: 1, degreesOfFreedom: 200 }],
    environmental: { temperature: 21, humidity: 50 },
  });
  await services.laboratory.startCalibration(order.id, unitId, { note: `${journey.discipline} end-to-end verification` });
  await services.laboratory.calculate(order.id, unitId);
  await services.laboratory.approveFormulaValidation(order.id, unitId, { confirmed: true, reason: `Management reviewed the fabricated ${journey.discipline} calculation.` });
  await services.laboratory.completeCalibration(order.id, unitId, { technicianConfirmed: true, resultSummary: `${journey.discipline} calibration completed` });
  await services.laboratory.completeLabelling(order.id, unitId, { calibrationLabelApplied: true, identificationChecked: true, calibrationDate: '2026-08-05', checkedBy: 'End-to-end demo' });
  await services.laboratory.releaseUnitToDispatch(order.id, unitId, { bomSignedOff: true, destination: 'dispatch', numberOfPackages: 1, internalNote: 'Fabricated transfer' });
  await services.laboratory.generateDraftCertificate(order.id, unitId);
  await services.laboratory.submitCertificateForReview(order.id, unitId, { comment: `${journey.discipline} certificate review` });
  await services.laboratory.approveForSignature(order.id, unitId, { confirmed: true, signatoryName: 'Fabricated technical signatory', issue: 'Issue 1' });
  await services.laboratory.generateUnsignedCertificate(order.id, unitId);
  const signedPdf = { name: `${journey.discipline.toLowerCase()}-signed.pdf`, type: 'application/pdf', size: 128, arrayBuffer: async () => new TextEncoder().encode(`%PDF-1.4 fabricated signed ${journey.discipline} certificate`).buffer };
  const uploaded = await services.laboratory.uploadSignedCertificate(order.id, unitId, { file: signedPdf, issueDate: '2026-08-05' });
  assert.match(uploaded.sha256, /^[a-f0-9]{64}$/, `${journey.discipline} signed PDF must be hashed`);
  await services.laboratory.releaseCertificate(order.id, unitId, { recipientRule: 'customer_and_representative' });

  order = (await services.laboratory.listOrders()).find(item => item.id === journey.orderId);
  const completed = order.laboratory.units.find(item => item.id === unitId);
  assert.equal(completed.labWork.status, 'certificate_released', `${journey.discipline} journey must reach final certificate release`);
  assert.equal(completed.certificateStatus, 'verified', `${journey.discipline} signed certificate must be verified`);
  assert.equal(completed.labWork.certificateWorkflow.signedVersions.length, 1, `${journey.discipline} signed upload must remain versioned`);
}

console.log('Pressure and Temperature Laboratory journeys reach signed-certificate upload and final release.');
