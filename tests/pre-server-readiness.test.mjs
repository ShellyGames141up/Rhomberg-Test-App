import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { canAccessNotification } from '../src/domain/accessControl.js';
import { filterExpeditorOrders } from '../src/domain/expediting.js';
import { filterPlanningOrders } from '../src/domain/planningQueue.js';
import { filterRepresentativeRfqs } from '../src/domain/rfqInbox.js';
import { USER_ROLES } from '../src/services/contracts.js';

for (const removedExperimentPath of [
  'infra/azure/staging',
  'docs/AZURE_STAGING_PHASE_1.md',
  'docs/AZURE_STAGING_DEPLOYMENT_CHECKLIST.md',
]) assert.equal(existsSync(removedExperimentPath), false, `${removedExperimentPath} must not remain after the temporary Azure experiment`);

for (const requiredPhaseOneApiPath of [
  'apps/api/package.json',
  'apps/api/migrations/001_phase1_vertical_slice.sql',
  'apps/api/src/app.js',
  'apps/api/test/authentication.test.js',
  'docs/PHASE1_BACKEND_FOUNDATION.md',
]) assert.equal(existsSync(requiredPhaseOneApiPath), true, `${requiredPhaseOneApiPath} must exist for the authorised local backend phase`);

const productionBuildScript = readFileSync('scripts/build-production.mjs', 'utf8');
assert.equal(productionBuildScript.includes('apps/api'), false, 'the server implementation must not be bundled into the static frontend');

for (const requiredReadinessDocument of [
  'docs/INNOVATE_IT_SERVER_CONNECTION_CHECKLIST.md',
  'docs/MOBILE_PACKAGING_READINESS.md',
  'docs/GOOGLE_PLAY_RELEASE_CHECKLIST.md',
  'docs/APPLE_APP_STORE_RELEASE_CHECKLIST.md',
  'docs/WINDOWS_APP_RELEASE_READINESS.md',
  'docs/RELEASE_AND_UPDATE_STRATEGY.md',
  'docs/PRE_SERVER_AUDIT_MATRIX.md',
  'docs/PRE_SERVER_FINAL_READINESS_REPORT.md',
]) assert.ok(existsSync(requiredReadinessDocument), `${requiredReadinessDocument} must exist`);

const customerSource = [
  readFileSync('src/components/Enquiry.jsx', 'utf8'),
  readFileSync('src/components/Configurator.jsx', 'utf8'),
].join('\n');
assert.equal(/name=["'](?:emergency|urgent|priority|internalPriority)["']/.test(customerSource), false, 'customer forms must not expose urgency inputs');

const css = readFileSync('styles.css', 'utf8');
assert.ok(css.includes('.activity-card button,.expeditor-search button{min-width:44px;min-height:44px}'), 'compact actions must preserve 44px touch targets');
assert.ok(css.includes('.platform-preview-banner a{min-height:44px'), 'preview navigation must preserve a 44px target');

const now = new Date('2026-08-15T10:00:00.000Z');
const statuses = ['submitted', 'assigned_to_rep', 'under_rep_review', 'quoted', 'awaiting_customer_acceptance'];
const rfqs = Array.from({ length: 10_000 }, (_, index) => ({
  id: `rfq-${index}`,
  reference: `RQ-STRESS-${String(index).padStart(5, '0')}`,
  workflowType: 'rfq',
  trackingStatus: statuses[index % statuses.length],
  company: `Fabricated Company ${index % 1_000}`,
  contact: `Fabricated Contact ${index}`,
  priority: index % 17 === 0 ? 'urgent' : 'standard',
  submittedAt: new Date(now.getTime() - index * 60_000).toISOString(),
}));

const orderStatuses = ['awaiting_planning', 'planning_in_progress', 'planned'];
const planningOrders = Array.from({ length: 10_000 }, (_, index) => ({
  id: `order-${index}`,
  reference: `OR-STRESS-${String(index).padStart(5, '0')}`,
  workflowType: 'order',
  trackingStatus: orderStatuses[index % orderStatuses.length],
  company: `Fabricated Company ${index % 1_000}`,
  contact: `Fabricated Contact ${index}`,
  priority: index % 23 === 0 ? 'urgent' : 'standard',
  createdAt: new Date(now.getTime() - index * 60_000).toISOString(),
  updatedAt: new Date(now.getTime() - index * 30_000).toISOString(),
  trackingHistory: [],
  planning: {},
}));

const expeditingOrders = planningOrders.map((order, index) => ({
  ...order,
  trackingStatus: index % 2 ? 'submitted_to_expediting' : 'expediting_in_progress',
  planning: { estimatedCompletionDate: '2026-08-18' },
  expediting: { updates: [] },
}));

const notifications = Array.from({ length: 50_000 }, (_, index) => ({
  id: `notification-${index}`,
  companyId: index % 2 ? 'fabricated-company-a' : 'fabricated-company-b',
  customerVisible: true,
  recipients: ['customer'],
}));
const fabricatedCustomer = { role: USER_ROLES.CUSTOMER, companyId: 'fabricated-company-a' };

const measured = (label, operation, ceilingMs = 2_000) => {
  const startedAt = performance.now();
  const value = operation();
  const durationMs = performance.now() - startedAt;
  assert.ok(durationMs < ceilingMs, `${label} exceeded the fabricated-data readiness ceiling: ${durationMs.toFixed(1)} ms`);
  return { value, durationMs };
};

const rfqResult = measured('10,000 RFQ search/filter/sort', () => filterRepresentativeRfqs(rfqs, { search: 'Fabricated Company 999', group: 'all' }));
assert.ok(rfqResult.value.length > 0);
const planningResult = measured('10,000 Planning search/filter/sort', () => filterPlanningOrders(planningOrders, { search: 'Fabricated Company 999', sort: 'priority' }));
assert.ok(planningResult.value.length > 0);
const expeditingResult = measured('10,000 Expediting search/filter/sort', () => filterExpeditorOrders(expeditingOrders, { search: 'OR-STRESS', filter: 'all' }, now));
assert.equal(expeditingResult.value.length, 10_000);
const notificationResult = measured('50,000 notification company-scope checks', () => notifications.filter(notification => canAccessNotification(fabricatedCustomer, notification)));
assert.equal(notificationResult.value.length, 25_000);

console.log(`Pre-server cleanup, touch-target and fabricated-volume checks passed (RFQ ${rfqResult.durationMs.toFixed(1)} ms; Planning ${planningResult.durationMs.toFixed(1)} ms; Expediting ${expeditingResult.durationMs.toFixed(1)} ms; notifications ${notificationResult.durationMs.toFixed(1)} ms).`);
