import assert from 'node:assert/strict';
import { formatSouthAfricanCurrency } from '../src/domain/formatting.js';
import { readFileSync } from 'node:fs';
import { extractQuotationDetailsFromPlacements } from '../src/domain/quotationPdf.js';
import { buildSalesPerformanceAnalytics, formatDurationDaysHours } from '../src/domain/salesAnalytics.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { ServiceError } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const quotation = extractQuotationDetailsFromPlacements([
  { x: 20, y: 700, text: 'QUOTE NUMBER:' }, { x: 150, y: 700, text: '32530' },
  { x: 20, y: 680, text: 'DATE:' }, { x: 150, y: 680, text: '1/30/2026' },
  { x: 20, y: 660, text: 'EXPIRY:' }, { x: 150, y: 660, text: '2/13/2026' },
  { x: 400, y: 300, text: 'SUBTOTAL' }, { x: 500, y: 300, text: '32250.00' },
  { x: 400, y: 280, text: 'TOTAL VAT' }, { x: 500, y: 280, text: '4,837.50' },
  { x: 400, y: 260, text: 'TOTAL ZAR' }, { x: 500, y: 260, text: '37087.50' },
]);
assert.deepEqual(quotation, {
  quoteNumber: '32530', quotationDate: '2026-01-30', expiryDate: '2026-02-13',
  subtotal: 32250, vatTotal: 4837.5, commercialTotal: 37087.5, currency: 'ZAR',
  extractionStatus: 'verified_fields_found', extractionConfidence: 'high',
});
assert.equal(formatDurationDaysHours(49.5), '2 days 1.5 hours');
assert.equal(formatSouthAfricanCurrency(160202.75).replace(/[\u00a0\u202f]/g, ' '), 'R 160 202,75');

const managementStyles = readFileSync('styles.css', 'utf8');
for (const readabilityRule of ['white-space:nowrap;font-variant-numeric:tabular-nums', '.management-performance-table th{white-space:nowrap', 'td[data-label="Order value"]{white-space:nowrap']) {
  assert.ok(managementStyles.includes(readabilityRule), `Executive dashboard styles must retain ${readabilityRule}`);
}

const records = [
  { id: 'converted', workflowType: 'order', reference: 'OR-1', rfqReference: 'RQ-1', trackingStatus: 'delayed', companyId: 'c1', company: 'First Client', createdAt: '2026-07-01T08:00:00Z', updatedAt: '2026-07-02T08:00:00Z', delayPromiseDate: '2026-07-20', selectedRep: { id: 'C-27', name: 'Ericu', branchId: 'cape-town', branchName: 'Cape Town' }, quotation: { commercialTotal: 37087.5, currency: 'ZAR', extractionStatus: 'verified_fields_found' } },
  { id: 'lost', workflowType: 'rfq', reference: 'RQ-2', trackingStatus: 'expired', companyId: 'c2', company: 'Second Client', createdAt: '2026-07-04T08:00:00Z', updatedAt: '2026-07-15T08:00:00Z', selectedRep: { id: 'C-27', name: 'Ericu', branchId: 'cape-town', branchName: 'Cape Town' }, quotation: { commercialTotal: 12000, currency: 'ZAR', extractionStatus: 'verified_fields_found' } },
];
const analytics = buildSalesPerformanceAnalytics(records, {
  now: new Date('2026-07-31T12:00:00.000Z'),
  options: { periodMode: 'date_range', startDate: '2026-07-01', endDate: '2026-07-31' },
});
assert.equal(analytics.overall.quotations, 2);
assert.equal(analytics.overall.convertedOrders, 1);
assert.equal(analytics.overall.quoteToOrderRatio, 50);
assert.equal(analytics.overall.quoteLossRatio, 50);
assert.equal(analytics.overall.totalOrderValue, 37087.5);
assert.equal(analytics.overduePromises.length, 1);

const now = () => new Date('2026-07-31T12:00:00.000Z');
const storage = new TestStorage();
const services = createMockServices({ storage, now });
await services.initialize();
await services.auth.signIn({ email: 'owner.workflow@example.invalid', password: 'Owner12345!' });
const ownerDashboard = await services.management.getDashboard();
assert.ok(ownerDashboard.salesPerformance?.authorised);
const report = await services.management.exportPerformancePdf({
  periodMode: 'rolling_months', rollingMonths: 12,
  representativeId: 'all', branchId: 'all',
  sections: ['executive_summary', 'quotation_values', 'conversion_performance'],
});
assert.equal(report.mimeType, 'application/pdf');
assert.equal(Buffer.from(report.bytesBase64, 'base64').subarray(0, 4).toString(), '%PDF');
assert.ok(report.fileName.endsWith('.pdf'));
const audit = await services.audit.list({ entityType: 'management_report' });
assert.ok(audit.some(event => event.action === 'management.performance_pdf_exported'));

await services.auth.signOut();
await services.auth.signIn({ email: 'sales.manager@example.invalid', password: 'SalesManager123!' });
assert.ok((await services.management.getPerformanceReportOptions()).representatives.length > 0);

await services.auth.signOut();
await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
await assert.rejects(
  () => services.management.exportPerformancePdf({ periodMode: 'rolling_months', rollingMonths: 12, sections: ['executive_summary'] }),
  error => error instanceof ServiceError && error.status === 403,
);
assert.equal((await services.management.getDashboard()).salesPerformance.authorised, false);

const managementSource = readFileSync('src/components/ManagementDashboard.jsx', 'utf8');
assert.ok(managementSource.includes('Download Operational PDF'), 'PDF must be the primary management export action');
assert.ok(managementSource.includes('Advanced: download CSV'), 'CSV may remain only as a secondary advanced option');
assert.ok(managementSource.includes('data-label={column.label}'), 'Executive tables must expose labels for responsive card rows');
const styles = readFileSync('styles.css', 'utf8');
assert.ok(styles.includes('Executive and owner metrics favour readable values over dense columns'));
assert.ok(styles.includes('.management-performance-table td:before{content:attr(data-label)'), 'Executive tables must become labelled cards on narrow screens');

console.log('Commercial quotation analytics, access control and management PDF tests passed.');
