import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { resolveManagementPeriod, buildSalesPerformanceAnalytics } from '../src/domain/salesAnalytics.js';
import { createPhase1WorkspaceService } from '../src/services/phase1WorkspaceService.js';

test('management defaults to 31 inclusive UTC dates across month/year/leap boundaries', () => {
  for (const [now, start, end] of [
    ['2026-08-27T23:59:59Z', '2026-07-28', '2026-08-27'],
    ['2027-01-01T00:00:00Z', '2026-12-02', '2027-01-01'],
    ['2024-03-01T12:00:00Z', '2024-01-31', '2024-03-01'],
  ]) {
    const period = resolveManagementPeriod({}, new Date(now));
    assert.equal(period.mode, 'last_31_days');
    assert.equal(period.startDate, start);
    assert.equal(period.endDate, end);
    assert.equal((Date.parse(end) - Date.parse(start)) / 86400000 + 1, 31);
  }
});

test('quote cohort uses original RFQ quotation date after order conversion', () => {
  const records = [
    { workflowType: 'rfq', reference: 'FABRICATED-RQ', trackingStatus: 'converted_to_order', quotation: { number: 'FAB-Q', date: '2026-07-27', commercialTotal: 123 }, createdAt: '2026-07-20' },
    { workflowType: 'order', reference: 'FABRICATED-OR', sourceRfqReference: 'FABRICATED-RQ', trackingStatus: 'completed', createdAt: '2026-08-01' },
  ];
  assert.equal(buildSalesPerformanceAnalytics(records, { now: new Date('2026-08-27') }).overall.quotations, 0);
  const historical = buildSalesPerformanceAnalytics(records, { periodMode: 'date_range', startDate: '2026-07-01', endDate: '2026-08-27', now: new Date('2026-08-27') });
  assert.equal(historical.overall.quotations, 1);
  assert.equal(historical.overall.convertedOrders, 1);
  assert.equal(historical.overall.totalOrderValue, 123);
});

test('Owner and Sales Manager can export the 31-day statistics without deleting older records', async () => {
  const orders = ['2026-07-27', '2026-07-28', '2026-08-27', '2026-08-28'].map((createdAt, index) => ({
    id: 'fabricated-' + index, reference: 'FAB-OR-' + index, createdAt, workflowType: 'order', trackingStatus: 'completed',
    companyId: 'fabricated-company', company: 'FABRICATED TEST COMPANY', items: [{ quantity: 2, code: 'FAB', name: 'Test product' }],
  }));
  const before = structuredClone(orders), audits = [];
  const service = createPhase1WorkspaceService({
    repository: {
      listEnquiries: async () => [], listOrders: async () => structuredClone(orders),
      listCommercialQuotations: async () => [], appendAudit: async event => audits.push(event),
    }, clock: () => new Date('2026-08-27T12:00:00Z'),
  });
  for (const role of ['company_owner', 'sales_manager']) {
    const actor = { id: 'fabricated-' + role, role, roles: [role], permissions: ['view_reports','view_commercial_analytics','export_management_pdf'] };
    const dashboard = await service.getManagementDashboard(actor);
    assert.equal(dashboard.records.length, 2);
    assert.equal(dashboard.metrics.completed, 2);
    assert.equal(dashboard.phase21.products.totalUnits, 4);
    const report = await service.createPerformanceReport(actor, {}, 'fabricated-request-id');
    assert.equal(report.mimeType, 'application/pdf');
    const pdf = await PDFDocument.load(Buffer.from(report.bytesBase64, 'base64'));
    assert.match(pdf.getTitle(), /28 Jul 2026 to 27 Aug 2026/);
    assert.ok(pdf.getPageCount() >= 1);
    assert.equal(audits.at(-1).details.recordCount, 2);
    assert.equal(audits.at(-1).actorRole, role);
    assert.equal((await service.getManagementDashboard(actor, { periodMode: 'date_range', startDate: '2026-07-01', endDate: '2026-08-27' })).records.length, 3);
    await assert.rejects(service.getManagementDashboard(actor, { periodMode: 'date_range', startDate: '2026-02-30', endDate: '2026-08-27' }));
  }
  assert.deepEqual(orders, before, 'reporting must never prune historical records');
  const outsider = { id: 'fabricated-customer', role: 'customer', roles: ['customer'], permissions: ['view_reports', 'view_commercial_analytics','export_management_pdf'] };
  await assert.rejects(service.createPerformanceReport(outsider, {}, 'fabricated-denied'), error => error.statusCode === 403);
});
