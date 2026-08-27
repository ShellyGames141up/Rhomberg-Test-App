import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhase1WorkspaceService } from '../src/services/phase1WorkspaceService.js';
import { buildOperationalStatistics } from '../src/domain/operationalStatistics.js';
import { qualityProjection } from '../src/domain/qualityProjection.js';
import { QA_PROBLEM_CATEGORIES, QA_SEVERITIES, QA_REWORK_DESTINATIONS, validateQaFailure } from '../../../src/domain/qualityAssurance.js';

test('QA and QA Manager receive labelled, canonical selectable options', () => {
  const service = createPhase1WorkspaceService({ repository: {} });
  const options = service.getQualityOptions();
  assert.deepEqual(options, { problemCategories: QA_PROBLEM_CATEGORIES, severities: QA_SEVERITIES, reworkDestinations: QA_REWORK_DESTINATIONS });
  for (const entries of Object.values(options)) {
    assert.ok(entries.length >= 3);
    assert.equal(new Set(entries.map(item => item.id)).size, entries.length);
    assert.ok(entries.every(item => typeof item.id === 'string' && item.id && typeof item.label === 'string' && item.label.trim()));
  }
  for (const category of options.problemCategories) for (const severity of options.severities) for (const destination of options.reworkDestinations) {
    assert.doesNotThrow(() => validateQaFailure({ category: category.id, severity: severity.id, reworkDestination: destination.id, affectedItemId: 'fabricated-item', problemDescription: 'Fabricated finding', customerMessage: 'Quality review in progress.', dateFound: '2026-08-27', otherExplanation: 'Fabricated other explanation' }));
  }
  options.problemCategories[0].label = 'Changed by caller';
  assert.notEqual(service.getQualityOptions().problemCategories[0].label, 'Changed by caller');
});

test('Owner statistics calculate persisted volumes, QA, Laboratory, timings and safe activity', async () => {
  const qualityUpdates = [
    { action: 'start_qa', createdAt: '2026-08-20T08:00:00Z' },
    { action: 'fail_qa', qaFailure: { category: 'physical_damage', internalNote: 'INTERNAL-SENTINEL' }, createdAt: '2026-08-20T09:00:00Z' },
    { action: 'start_qa_rework' }, { action: 'start_qa_reinspection' },
    { action: 'pass_qa', createdAt: '2026-08-20T10:00:00Z' },
  ];
  const history = [{ action: 'start_qa', createdAt: '2026-08-20T08:00:00Z' }, { action: 'pass_qa', createdAt: '2026-08-20T10:00:00Z' }, { action: 'release_qa_order', createdAt: '2026-08-20T11:00:00Z' }, { action: 'complete_collection', createdAt: '2026-08-20T15:00:00Z' }];
  const orders = [{ id: 'one', workflowType: 'order', reference: 'FABRICATED-1', company: 'Fabricated A', trackingStatus: 'completed', createdAt: '2026-08-20T00:00:00Z', trackingHistory: history, details: { qualityUpdates, password: 'DO-NOT-RETURN' }, price: 'PROTECTED', items: [{ id: 'line1', code: 'PBB', quantity: 3, configuration: {} }], selectedRep: { id: 'rep1', name: 'Fabricated Rep', branchId: 'cape-town', branchName: 'Cape Town' } },
    { id: 'two', workflowType: 'order', company: 'Fabricated B', trackingStatus: 'awaiting_lab_release', createdAt: '2026-08-21', items: [{ id: 'line2', code: 'TG', quantity: 2, configuration: { sanas: 'Required' } }], laboratory: { units: [{ lineItemId: 'line2', unitNumber: 1, certificateId: 'cert1' }], receivedAt: '2026-08-21T08:00:00Z', releasedAt: '2026-08-21T12:00:00Z' } }];
  const statistics = buildOperationalStatistics([], orders, new Date('2026-08-27'));
  assert.equal(statistics.products.totalUnits, 5);
  assert.equal(statistics.products.byMonth[0].quantity, 5);
  assert.equal(statistics.products.byCompany.length, 2);
  assert.equal(statistics.quality.totalInspections, 2);
  assert.equal(statistics.quality.passRate, 50);
  assert.equal(statistics.quality.failureCount, 1);
  assert.equal(statistics.quality.reworkCycles, 1);
  assert.equal(statistics.quality.firstTimePassRate, 0);
  assert.equal(statistics.laboratory.certificatesPending, 1);
  assert.equal(statistics.operations.sanasCertificates, 1);
  assert.equal(statistics.operations.averageQaHours, 2);
  assert.equal(statistics.operations.averageDispatchHours, 4);
  assert.equal(statistics.operations.averageLaboratoryHours, 4);
  assert.equal(statistics.operations.dispatchCompletionRate, 50);
  const repository = { listOrders: async (_actor, options) => { assert.equal(options.forReporting, true); return orders; }, listEnquiries: async () => [], listAuditEvents: async () => [{ id: 'audit1', eventType: 'workflow.pass_qa', timestamp: '2026-08-20', actingUser: { displayName: 'Fabricated QA' }, details: { secret: 'AUDIT-PRIVATE' } }] };
  const service = createPhase1WorkspaceService({ repository, clock: () => new Date('2026-08-27') });
  const dashboard = await service.getManagementDashboard({ permissions: ['view_reports', 'read_audit_history'] });
  assert.equal(dashboard.recentActivity[0].actingUser, 'Fabricated QA');
  assert.equal(dashboard.metrics.averageStageHours, 2.3);
  assert.equal(dashboard.records[0].items[0].quantity, 3, 'Expanded report retains unit details');
  assert.equal(dashboard.records[0].trackingHistory.length, 4, 'Expanded report retains its timeline');
  assert.doesNotMatch(JSON.stringify(dashboard), /INTERNAL-SENTINEL|DO-NOT-RETURN|PROTECTED|AUDIT-PRIVATE/);
  await assert.rejects(service.getManagementDashboard({ permissions: ['view_own_company_rfqs'] }), error => error.statusCode === 403);
  assert.equal(qualityProjection({ qualityUpdates }).inspections[1].attempt, 2);
  assert.equal(qualityProjection({ qualityUpdates }).currentProblem, null);
});
