import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allRequiredCertificatesPresent,
  createCalibrationUnits,
  orderRequiresLaboratory,
} from '../src/domain/certification.js';
import { buildPhase21Analytics } from '../src/domain/analytics.js';
import {
  orderRequiresQualityAssurance,
  validateQaFailure,
} from '../src/domain/qualityAssurance.js';
import {
  createWorkflowActor,
  performWorkflowTransition,
} from '../src/domain/workflow.js';
import { representativesByBranch } from '../src/data/representatives.js';
import {
  PREVIEW_BY_ID,
  PREVIEW_IDS,
  previewAllowsRole,
} from '../src/shared/platform/previewConfig.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import {
  DEMO_ACCOUNT,
  DISPATCH_ACCOUNT,
  EXPEDITOR_ACCOUNT,
  LAB_ACCOUNT,
  LAB_MANAGER_ACCOUNT,
  PHASE21_DEMO_ORDERS,
  QA_ACCOUNT,
  SALES_ACCOUNT,
  STORE_KEYS,
} from '../src/services/mock/seedData.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';

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

const signIn = (services, account, realm = 'internal') => services.auth.signIn({
  email: account.email,
  password: account.password,
  realm,
});

const workflow = (services, order, action, data = {}) => services.workflow.performAction(order.id, {
  entityType: 'order',
  action,
  comment: '',
  data,
  expectedVersion: order.version,
});

const sanasSeed = structuredClone(PHASE21_DEMO_ORDERS.find(order => order.id === 'order-phase21-sanas-001'));
const traceableSeed = structuredClone(PHASE21_DEMO_ORDERS.find(order => order.id === 'order-phase21-traceable-001'));
const standardSeed = structuredClone(PHASE21_DEMO_ORDERS.find(order => order.id === 'order-phase21-qa-001'));

assert.equal(orderRequiresLaboratory(sanasSeed), true);
assert.equal(orderRequiresLaboratory(traceableSeed), true);
assert.equal(orderRequiresLaboratory(standardSeed), false);
assert.equal(orderRequiresQualityAssurance(sanasSeed), false, 'Laboratory orders must bypass ordinary QA');
assert.equal(orderRequiresQualityAssurance(standardSeed), true, 'standard orders must use QA');

const sanasUnits = createCalibrationUnits(sanasSeed);
const traceableUnits = createCalibrationUnits(traceableSeed);
assert.equal(sanasUnits.length, 2, 'SANAS quantity two must create two physical-unit records');
assert.equal(traceableUnits.length, 2, 'Traceable quantity two must create two physical-unit records');
assert.equal(new Set(sanasUnits.map(unit => unit.id)).size, 2, 'each physical unit must have a unique Lab task');
assert.ok(sanasUnits.every(unit => unit.certificationType === 'sanas' && unit.certificateStatus === 'pending'));
assert.ok(traceableUnits.every(unit => unit.certificationType === 'traceable' && unit.certificateStatus === 'pending'));

const planningActor = createWorkflowActor({
  id: 'phase21-planner',
  role: USER_ROLES.PLANNING,
  contact: 'Fabricated Planner',
});
const plannedLabOrder = {
  ...sanasSeed,
  trackingStatus: 'planned',
  status: 'Planning completed',
  version: 0,
  planning: {
    ...(sanasSeed.planning || {}),
    salesOrderNumber: sanasSeed.salesOrderNumber || 'SO-PHASE21-LAB',
  },
};
const plannedStandardOrder = {
  ...standardSeed,
  trackingStatus: 'planned',
  status: 'Planning completed',
  version: 0,
  planning: {
    internalJobNumber: standardSeed.internalJobNumber,
    salesOrderNumber: standardSeed.salesOrderNumber || 'SO-PHASE21-STANDARD',
    customerPoNumber: standardSeed.customerPoNumber,
    assignedPlanningUserId: 'phase21-planner',
    submissionDate: '2026-07-29',
    priority: 'standard',
  },
};
const routedLab = performWorkflowTransition({
  entity: plannedLabOrder,
  action: 'submit_to_expediting',
  actor: planningActor,
  input: {},
  expectedVersion: 0,
  now: () => new Date('2026-07-29T08:00:00.000Z'),
});
const routedStandard = performWorkflowTransition({
  entity: plannedStandardOrder,
  action: 'submit_to_expediting',
  actor: planningActor,
  input: {},
  expectedVersion: 0,
  now: () => new Date('2026-07-29T08:00:00.000Z'),
});
assert.equal(routedLab.entity.trackingStatus, 'awaiting_lab');
assert.equal(routedStandard.entity.trackingStatus, 'submitted_to_expediting');

const labStorage = new TestStorage();
let labClock = new Date('2026-07-29T09:00:00.000Z');
const labServices = createMockServices({ storage: labStorage, now: () => new Date(labClock) });
await labServices.initialize();
await signIn(labServices, LAB_ACCOUNT);
let labOrder = (await labServices.laboratory.listOrders()).find(order => order.id === sanasSeed.id);
labOrder = await workflow(labServices, labOrder, 'receive_lab_order');
assert.equal(labOrder.trackingStatus, 'lab_received');
assert.ok(labOrder.laboratory.units.every(unit => unit.status === 'received'));
labOrder = await workflow(labServices, labOrder, 'start_lab_calibration');
for (const unit of labOrder.laboratory.units) {
  await labServices.laboratory.updateUnit(labOrder.id, unit.id, 'start', {
    serialNumber: `SERIAL-${unit.unitNumber}`,
    customerMessage: 'Calibration work has started.',
  });
  await labServices.laboratory.updateUnit(labOrder.id, unit.id, 'complete', {
    serialNumber: `SERIAL-${unit.unitNumber}`,
    calibrationResult: `Fabricated passing result ${unit.unitNumber}`,
    customerMessage: 'Calibration work for this unit is complete.',
  });
}
labOrder = (await labServices.laboratory.listOrders()).find(order => order.id === sanasSeed.id);
labOrder = await workflow(labServices, labOrder, 'complete_lab_calibration');
labOrder = await workflow(labServices, labOrder, 'mark_lab_ready_for_release');
await labServices.auth.signOut();
await signIn(labServices, LAB_MANAGER_ACCOUNT);
labOrder = (await labServices.laboratory.listOrders()).find(order => order.id === sanasSeed.id);
labOrder = await workflow(labServices, labOrder, 'release_from_lab', {
  labRelease: { destination: 'dispatch', note: 'Fabricated controlled release.' },
});
assert.equal(labOrder.trackingStatus, 'awaiting_lab_receipt_dispatch');
assert.ok(labOrder.laboratory.units.every(unit => unit.status === 'released'));
assert.equal(allRequiredCertificatesPresent(labOrder), false, 'physical release must be allowed while certificates remain pending');

await assert.rejects(
  () => labServices.laboratory.archiveCertificates(labOrder.id),
  error => error instanceof ServiceError && error.code === 'CERTIFICATE_ARCHIVE_PENDING',
  'Lab archival must be blocked while any unit certificate is pending',
);

await labServices.auth.signOut();
await signIn(labServices, DISPATCH_ACCOUNT);
let dispatchLabOrder = (await labServices.orders.list()).find(order => order.id === sanasSeed.id);
dispatchLabOrder = await workflow(labServices, dispatchLabOrder, 'confirm_lab_receipt_dispatch');
assert.equal(dispatchLabOrder.trackingStatus, 'awaiting_dispatch');
assert.equal(dispatchLabOrder.dispatch.sourceDepartment, 'laboratory');
assert.ok(dispatchLabOrder.dispatch.receivedAt);

await labServices.auth.signOut();
await signIn(labServices, LAB_MANAGER_ACCOUNT);
labOrder = (await labServices.laboratory.listOrders()).find(order => order.id === sanasSeed.id);
const pdfFile = unitNumber => ({
  name: `fabricated-certificate-${unitNumber}.pdf`,
  type: 'application/pdf',
  size: 128,
  arrayBuffer: async () => new TextEncoder().encode(`%PDF-1.4 fabricated ${unitNumber}`).buffer,
});
const firstUnit = labOrder.laboratory.units[0];
await labServices.laboratory.uploadCertificate(labOrder.id, firstUnit.id, {
  certificateNumber: 'SANAS-TEST-0001',
  issueDate: '2026-07-29',
  file: pdfFile(1),
});
await assert.rejects(
  () => labServices.laboratory.uploadCertificate(labOrder.id, firstUnit.id, {
    certificateNumber: 'SANAS-TEST-REPLACEMENT',
    issueDate: '2026-07-29',
    file: pdfFile(1),
  }),
  error => error instanceof ServiceError && error.code === 'DUPLICATE_UNIT_CERTIFICATE',
  'one certificate must not be able to satisfy or replace the same physical unit',
);
await assert.rejects(
  () => labServices.laboratory.archiveCertificates(labOrder.id),
  error => error instanceof ServiceError && error.code === 'CERTIFICATE_ARCHIVE_PENDING',
);
const refreshedAfterFirst = (await labServices.laboratory.listOrders()).find(order => order.id === sanasSeed.id);
const secondUnit = refreshedAfterFirst.laboratory.units[1];
await labServices.laboratory.uploadCertificate(labOrder.id, secondUnit.id, {
  certificateNumber: 'SANAS-TEST-0002',
  issueDate: '2026-07-29',
  file: pdfFile(2),
});
const archivedCertificates = await labServices.laboratory.archiveCertificates(labOrder.id);
assert.ok(archivedCertificates.every(unit => unit.certificateStatus === 'archived'));

await labServices.auth.signOut();
await signIn(labServices, DEMO_ACCOUNT, 'customer');
const customerLabOrder = (await labServices.orders.list()).find(order => order.id === sanasSeed.id);
assert.ok(customerLabOrder.laboratory.units.every(unit => unit.certificateId));
const certificateDownload = await labServices.laboratory.downloadCertificate(customerLabOrder.laboratory.units[0].certificateId);
assert.match(certificateDownload.dataUrl, /^data:application\/pdf;base64,/);
const customerNotifications = await labServices.notifications.list();
assert.ok(customerNotifications.some(notification => notification.eventType === 'certificate_uploaded'));

await labServices.auth.signOut();
await labServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!', realm: 'customer' });
await assert.rejects(
  () => labServices.laboratory.downloadCertificate(customerLabOrder.laboratory.units[0].certificateId),
  error => error instanceof ServiceError && error.code === 'CERTIFICATE_NOT_FOUND',
  'customers must not download another company certificate',
);
await labServices.auth.signOut();
await signIn(labServices, SALES_ACCOUNT);
await assert.rejects(
  () => labServices.laboratory.downloadCertificate(customerLabOrder.laboratory.units[0].certificateId),
  error => error instanceof ServiceError && error.code === 'FORBIDDEN',
  'representatives may see status but must not permanently download certificates',
);
const labAudit = JSON.parse(labStorage.getItem(STORE_KEYS.audit));
assert.ok(labAudit.some(event => event.action === 'laboratory.certificate_downloaded'));

const qaStorage = new TestStorage();
const qaServices = createMockServices({ storage: qaStorage, now: () => new Date('2026-07-29T11:00:00.000Z') });
await qaServices.initialize();
await signIn(qaServices, EXPEDITOR_ACCOUNT);
let qaOrder = (await qaServices.orders.list()).find(order => order.id === standardSeed.id);
qaOrder = await workflow(qaServices, qaOrder, 'start_qa_rework');
assert.equal(qaOrder.trackingStatus, 'returned_to_expediting');
assert.equal(qaOrder.qualityAssurance.reworkCycle, 1);
qaOrder = await workflow(qaServices, qaOrder, 'resubmit_to_qa', {
  qaRework: {
    correctiveAction: 'Fabricated assembly correction completed and independently checked.',
    customerMessage: 'Corrective work is complete and reinspection is queued.',
    internalNote: 'Fabricated internal rework note.',
  },
});
assert.equal(qaOrder.trackingStatus, 'qa_reinspection_required');
assert.equal(qaOrder.qualityAssurance.reworkHistory.at(-1).status, 'completed');

await qaServices.auth.signOut();
await signIn(qaServices, QA_ACCOUNT);
qaOrder = (await qaServices.qualityAssurance.listOrders()).find(order => order.id === standardSeed.id);
qaOrder = await workflow(qaServices, qaOrder, 'start_qa_reinspection', {
  qaStart: { checklistReference: 'QA-REINSPECT-TEST-001' },
});
assert.equal(qaOrder.trackingStatus, 'qa_in_progress');
assert.equal(qaOrder.qualityAssurance.attempt, 2);
await assert.rejects(
  () => workflow(qaServices, qaOrder, 'fail_qa', {
    qaFailure: {
      category: 'incorrect_assembly',
      severity: 'major',
      reworkDestination: 'assembly',
      customerMessage: 'A quality concern is being corrected.',
    },
  }),
  error => error instanceof ServiceError && error.code === 'QA_FAILURE_INVALID'
    && Boolean(error.fieldErrors.problemDescription)
    && Boolean(error.fieldErrors.affectedItemId),
  'QA failure must require a problem, affected line and return destination',
);
qaOrder = await workflow(qaServices, qaOrder, 'pass_qa', {
  qaPass: {
    inspectionDate: '2026-07-29',
    checklistConfirmed: true,
    meetsRequirements: true,
    checklistReference: 'QA-REINSPECT-TEST-001',
    customerMessage: 'Your instruments passed final quality inspection.',
  },
});
assert.equal(qaOrder.trackingStatus, 'qa_passed');
assert.equal(qaOrder.qualityAssurance.inspections.length, 2, 'previous failed inspection history must remain immutable');
qaOrder = await workflow(qaServices, qaOrder, 'release_qa_order');
assert.equal(qaOrder.trackingStatus, 'awaiting_dispatch');
assert.equal(qaOrder.dispatch.receivedAt || '', '', 'QA handoff must not falsely confirm Dispatch receipt');

await qaServices.auth.signOut();
await signIn(qaServices, DISPATCH_ACCOUNT);
qaOrder = (await qaServices.orders.list()).find(order => order.id === standardSeed.id);
await assert.rejects(
  () => workflow(qaServices, qaOrder, 'start_delivery', {
    dispatchMethod: 'company_delivery',
    dispatchReadyDate: '2026-07-29',
    dispatchNumberOfPackages: 1,
    dispatchCourierOrDriver: 'Fabricated Driver',
    dispatchCustomerMessage: 'Your order is out for delivery.',
  }),
  error => error instanceof ServiceError && error.code === 'DISPATCH_RECEIPT_REQUIRED',
);
qaOrder = await workflow(qaServices, qaOrder, 'confirm_dispatch_receipt', {
  dispatchReceipt: {
    sourceDepartment: 'quality_assurance',
    numberOfPackages: 1,
    customerMessage: 'Your order has been received by Dispatch.',
  },
});
assert.ok(qaOrder.dispatch.receivedAt);

const qaNotifications = JSON.parse(qaStorage.getItem(STORE_KEYS.notifications));
assert.ok(qaNotifications.some(notification => notification.eventType === 'qa_rework' && notification.recipients.includes('assigned_representative')));
assert.ok(qaNotifications.some(notification => notification.eventType === 'qa_passed' && notification.recipients.includes('expeditor')));

assert.throws(
  () => validateQaFailure({
    category: 'other',
    severity: 'minor',
    reworkDestination: 'other',
    problemDescription: 'Fabricated problem.',
    affectedItemId: 'line-1',
    dateFound: '2026-07-29',
    customerMessage: 'A quality concern is being corrected.',
  }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.otherExplanation),
);

const analytics = buildPhase21Analytics([
  {
    workflowType: 'order',
    id: 'analytics-order-a',
    trackingStatus: 'completed',
    createdAt: '2026-07-01T08:00:00.000Z',
    completedAt: '2026-07-03T08:00:00.000Z',
    items: [{ code: 'PBB', category: 'pressure', quantity: 10, configuration: {} }],
  },
  {
    workflowType: 'order',
    id: 'analytics-order-b',
    trackingStatus: 'awaiting_lab',
    createdAt: '2026-07-02T08:00:00.000Z',
    items: [{ code: 'TPS', category: 'temperature', quantity: 3, configuration: { traceability: 'Traceability certificate required' } }],
  },
]);
assert.equal(analytics.products.totalUnits, 13, 'product statistics must count physical quantities, not order lines');
assert.equal(analytics.products.byProduct.find(row => row.label === 'PBB').quantity, 10);
assert.equal(analytics.routing.traceableOrders, 1);
assert.equal(analytics.operations.completedOrders, 1);

const authStorage = new TestStorage();
let authClock = new Date('2026-07-29T12:00:00.000Z');
const authServices = createMockServices({ storage: authStorage, now: () => new Date(authClock) });
await authServices.initialize();
await assert.rejects(
  () => authServices.auth.signIn({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password, realm: 'internal' }),
  error => error instanceof ServiceError && error.code === 'INVALID_CREDENTIALS',
  'customer credentials must not authenticate in the internal realm',
);
await signIn(authServices, DEMO_ACCOUNT, 'customer');
const usernameChallenge = await authServices.credentials.requestVerification({ changeType: 'username' });
const usernameResult = await authServices.credentials.confirmChange({
  challengeId: usernameChallenge.challengeId,
  code: usernameChallenge.demoVerificationCode,
  newUsername: 'phase21.customer',
});
assert.equal(usernameResult.account.signInName, 'phase21.customer');
await assert.rejects(
  () => authServices.credentials.confirmChange({
    challengeId: usernameChallenge.challengeId,
    code: usernameChallenge.demoVerificationCode,
    newUsername: 'phase21.customer.again',
  }),
  error => error instanceof ServiceError && error.code === 'CREDENTIAL_CODE_ALREADY_USED',
);
const passwordChallenge = await authServices.credentials.requestVerification({ changeType: 'password' });
const passwordResult = await authServices.credentials.confirmChange({
  challengeId: passwordChallenge.challengeId,
  code: passwordChallenge.demoVerificationCode,
  newPassword: 'NewPreview123!',
});
assert.equal(passwordResult.sessionEnded, true);
assert.equal(await authServices.auth.getSession(), null);
await assert.rejects(
  () => authServices.auth.signIn({ email: 'phase21.customer', password: DEMO_ACCOUNT.password, realm: 'customer' }),
  error => error instanceof ServiceError && error.code === 'INVALID_CREDENTIALS',
);
await authServices.auth.signIn({ email: 'phase21.customer', password: 'NewPreview123!', realm: 'customer' });
const expiryChallenge = await authServices.credentials.requestVerification({ changeType: 'username' });
authClock = new Date(authClock.getTime() + 11 * 60 * 1000);
await assert.rejects(
  () => authServices.credentials.confirmChange({
    challengeId: expiryChallenge.challengeId,
    code: expiryChallenge.demoVerificationCode,
    newUsername: 'expired.change',
  }),
  error => error instanceof ServiceError && error.code === 'CREDENTIAL_CODE_EXPIRED',
);

assert.deepEqual(representativesByBranch.durban.map(rep => rep.name), ['Dawie', 'Nadia']);
assert.deepEqual(representativesByBranch['port-elizabeth'].map(rep => rep.name), ['Carmen']);
assert.equal(previewAllowsRole(PREVIEW_BY_ID[PREVIEW_IDS.INTERNAL_MOBILE], USER_ROLES.LABORATORY_USER), false);
assert.equal(previewAllowsRole(PREVIEW_BY_ID[PREVIEW_IDS.INTERNAL_DESKTOP], USER_ROLES.LABORATORY_USER), true);
assert.equal(previewAllowsRole(PREVIEW_BY_ID[PREVIEW_IDS.INTERNAL_MOBILE], USER_ROLES.QUALITY_ASSURANCE), false);
assert.equal(previewAllowsRole(PREVIEW_BY_ID[PREVIEW_IDS.INTERNAL_DESKTOP], USER_ROLES.QUALITY_ASSURANCE), true);

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(styles, /operations-desktop/);
assert.match(styles, /@media\s*\(\s*min-width:\s*(?:900|1200|1500)px\s*\)/);
assert.match(styles, /max-width:\s*1[456]\d{2}px|width:\s*min\(/, 'desktop CSS must include bounded wide-screen layout rules');

const phase21Sql = readFileSync(new URL('../docs/database/postgresql-schema.sql', import.meta.url), 'utf8');
for (const entity of [
  'order_routing',
  'lab_tasks',
  'calibration_units',
  'certificate_requirements',
  'certificates',
  'certificate_versions',
  'lab_events',
  'lab_monthly_metrics',
  'qa_tasks',
  'qa_inspections',
  'qa_failures',
  'qa_rework_cycles',
  'qa_events',
  'qa_monthly_metrics',
  'department_receipts',
  'verification_codes',
  'credential_change_requests',
  'product_statistics',
  'representative_statistics',
  'operational_metrics',
]) {
  assert.match(phase21Sql, new RegExp(`CREATE TABLE app\\.${entity}\\b`), `Phase 21 database proposal must define ${entity}`);
}
assert.match(phase21Sql, /UNIQUE \(order_item_id, unit_sequence\)/, 'physical units must be unique per order line and sequence');
assert.match(phase21Sql, /calibration_unit_id uuid NOT NULL UNIQUE/, 'one certificate requirement and certificate must be enforced per unit');
assert.match(phase21Sql, /ENABLE ROW LEVEL SECURITY/, 'Phase 21 operational tables must retain row-level-security guidance');

const phase21OpenApi = readFileSync(new URL('../docs/api/openapi.yaml', import.meta.url), 'utf8');
for (const endpoint of [
  '/laboratory/orders:',
  '/laboratory/certificates:',
  '/quality/orders:',
  '/dispatch/orders/{orderId}/receive:',
  '/auth/credential-changes/challenge:',
  '/auth/credential-changes/confirm:',
  '/analytics/operations:',
  '/companies/{companyId}/representative-assignment:',
]) {
  assert.ok(phase21OpenApi.includes(endpoint), `Phase 21 OpenAPI proposal must include ${endpoint}`);
}

for (const documentName of [
  'ORDER_WORKFLOW.md',
  'LAB_WORKFLOW.md',
  'CERTIFICATE_WORKFLOW.md',
  'QA_WORKFLOW.md',
  'DISPATCH_WORKFLOW.md',
  'NOTIFICATION_ARCHITECTURE.md',
  'AUTHENTICATION.md',
  'DATABASE_SCHEMA.md',
  'API_CONTRACT.md',
  'MANAGEMENT_ANALYTICS.md',
  'PRODUCT_ANALYTICS.md',
  'DESKTOP_UI_GUIDELINES.md',
  'END_TO_END_DEMO_SCRIPT.md',
]) {
  const document = readFileSync(new URL(`../docs/${documentName}`, import.meta.url), 'utf8');
  assert.ok(document.length > 250, `${documentName} must contain usable Phase 21 guidance`);
}

console.log('Phase 21 Laboratory, QA, Dispatch, analytics, credential and desktop tests passed.');
