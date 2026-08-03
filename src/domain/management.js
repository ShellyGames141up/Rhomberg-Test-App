import { buildPhase21Analytics } from './analytics.js';
import { buildSalesPerformanceAnalytics, formatDurationDaysHours } from './salesAnalytics.js';

const RFQ_TERMINAL = new Set(['cancelled', 'expired', 'converted_to_order']);
const ORDER_TERMINAL = new Set(['completed', 'cancelled', 'archived']);
const DISPATCH_STATUSES = new Set(['awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected']);
const EXPEDITING_STATUSES = new Set(['submitted_to_expediting', 'expediting_in_progress']);
const LAB_STATUSES = new Set([
  'awaiting_lab', 'lab_received', 'calibration_in_progress', 'calibration_on_hold',
  'calibration_completed', 'awaiting_lab_release', 'awaiting_lab_receipt_expediting',
  'awaiting_lab_receipt_dispatch',
]);
const QA_STATUSES = new Set([
  'awaiting_qa', 'qa_in_progress', 'qa_failed', 'returned_to_expediting',
  'qa_reinspection_required', 'qa_passed',
]);
const INTERNAL_ONLY_FIELDS = new Set([
  'price',
  'unitPrice',
  'totalPrice',
  'priceEngine',
  'pricing',
  'pricingResult',
  'privatePrice',
  'costPrice',
  'margin',
  'commercialTotal',
  'subtotal',
  'vatTotal',
  'extractionStatus',
  'extractionConfidence',
]);

const validDate = value => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const groupCounts = (records, valueFor) => Object.entries(records.reduce((result, record) => {
  const key = valueFor(record) || 'Unassigned';
  result[key] = (result[key] || 0) + 1;
  return result;
}, {}))
  .map(([label, count]) => ({ label, count }))
  .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

const safeClone = value => {
  if (Array.isArray(value)) return value.map(safeClone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !INTERNAL_ONLY_FIELDS.has(key))
    .map(([key, nested]) => [key, safeClone(nested)]));
};

export const managementRecordSearchText = record => [
  record.reference,
  record.sourceRfqReference,
  record.internalJobNumber,
  record.customerPoNumber,
  record.poNumber,
  record.company,
  record.contact,
  record.selectedRep?.name,
  record.selectedRep?.code,
  record.selectedRep?.branchName,
  record.trackingStatus,
].filter(Boolean).join(' ').toLowerCase();

export const sanitiseManagementRecord = record => safeClone(record);

export const recordIsDelayed = (record, now = new Date()) => {
  const estimate = validDate(record.expediting?.estimatedCompletionDate || record.planning?.estimatedCompletionDate);
  return Boolean(
    record.expediting?.currentDelayReason
    || record.dispatch?.currentProblemReason
    || (estimate && estimate < now && !ORDER_TERMINAL.has(record.trackingStatus)),
  );
};

export const averageStageHours = records => {
  const durations = [];
  for (const record of records) {
    const events = [...(record.trackingHistory || [])]
      .map(event => ({ ...event, date: validDate(event.createdAt) }))
      .filter(event => event.date)
      .sort((left, right) => left.date - right.date);
    for (let index = 1; index < events.length; index += 1) {
      const hours = (events[index].date - events[index - 1].date) / 3_600_000;
      if (hours >= 0 && hours <= 24 * 365) durations.push(hours);
    }
  }
  if (!durations.length) return 0;
  return Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
};

export const buildManagementDashboard = ({
  records = [],
  auditEvents = [],
  search = '',
  status = 'all',
  branch = 'all',
  now = new Date(),
  includeSalesPerformance = false,
  salesOptions = {},
  salesRecords = records,
} = {}) => {
  const term = String(search || '').trim().toLowerCase();
  const authorised = records.map(sanitiseManagementRecord);
  const filteredRecords = authorised
    .filter(record => status === 'all' || record.trackingStatus === status)
    .filter(record => branch === 'all' || record.selectedRep?.branchId === branch)
    .filter(record => !term || managementRecordSearchText(record).includes(term));
  const rfqs = authorised.filter(record => record.workflowType === 'rfq');
  const orders = authorised.filter(record => record.workflowType === 'order');
  const activeOrders = orders.filter(order => !ORDER_TERMINAL.has(order.trackingStatus));
  const ageing = [...filteredRecords]
    .filter(record => record.workflowType === 'rfq' ? !RFQ_TERMINAL.has(record.trackingStatus) : !ORDER_TERMINAL.has(record.trackingStatus))
    .map(record => {
      const updated = validDate(record.updatedAt || record.createdAt) || now;
      return { ...record, ageDays: Math.max(0, Math.floor((now - updated) / 86_400_000)) };
    })
    .sort((left, right) => right.ageDays - left.ageDays);
  const recentActivity = auditEvents
    .filter(event => !term || [
      event.reference,
      event.company?.name,
      event.eventType,
      event.action,
      event.actingUser?.displayName,
    ].some(value => String(value || '').toLowerCase().includes(term)))
    .slice()
    .sort((left, right) => new Date(right.timestamp || right.createdAt) - new Date(left.timestamp || left.createdAt))
    .slice(0, 12)
    .map(event => ({
      id: event.id,
      eventType: event.eventType,
      action: event.action,
      reference: event.reference,
      company: event.company?.name || '',
      actingUser: event.actingUser?.displayName || 'Workflow service',
      actingRole: event.actingRole || '',
      outcome: event.outcome,
      timestamp: event.timestamp || event.createdAt,
    }));
  const phase21 = buildPhase21Analytics(authorised);
  const averageHours = averageStageHours([...rfqs, ...orders]);
  const salesPerformance = includeSalesPerformance
    ? buildSalesPerformanceAnalytics(salesRecords, { ...salesOptions, now })
    : { authorised: false };

  return {
    generatedAt: now.toISOString(),
    metrics: {
      openRfqs: rfqs.filter(rfq => !RFQ_TERMINAL.has(rfq.trackingStatus)).length,
      awaitingRepresentativeAction: rfqs.filter(rfq => ['assigned_to_rep', 'under_rep_review'].includes(rfq.trackingStatus)).length,
      quotedRfqs: rfqs.filter(rfq => ['quoted', 'awaiting_customer_acceptance'].includes(rfq.trackingStatus)).length,
      awaitingPlanning: orders.filter(order => order.trackingStatus === 'awaiting_planning').length,
      inExpediting: orders.filter(order => EXPEDITING_STATUSES.has(order.trackingStatus)).length,
      inLaboratory: orders.filter(order => LAB_STATUSES.has(order.trackingStatus)).length,
      inQualityAssurance: orders.filter(order => QA_STATUSES.has(order.trackingStatus)).length,
      onHold: orders.filter(order => order.trackingStatus === 'on_hold').length,
      delayed: activeOrders.filter(order => recordIsDelayed(order, now)).length,
      inDispatch: orders.filter(order => DISPATCH_STATUSES.has(order.trackingStatus)).length,
      completed: orders.filter(order => order.trackingStatus === 'completed').length,
      archived: orders.filter(order => order.trackingStatus === 'archived' || order.retentionStatus === 'archived').length,
      emergency: activeOrders.filter(order => order.emergency === 'yes' || order.priority === 'urgent').length,
      averageStageHours: averageHours,
      averageStageDuration: formatDurationDaysHours(averageHours),
    },
    records: filteredRecords,
    ageing,
    recentActivity,
    ordersByRepresentative: groupCounts(orders, order => order.selectedRep?.name),
    ordersByBranch: groupCounts(orders, order => order.selectedRep?.branchName),
    ordersByStatus: groupCounts(orders, order => order.trackingStatus),
    phase21,
    salesPerformance,
    filters: {
      statuses: [...new Set(authorised.map(record => record.trackingStatus).filter(Boolean))].sort(),
      branches: [...new Map(authorised
        .filter(record => record.selectedRep?.branchId)
        .map(record => [record.selectedRep.branchId, {
          id: record.selectedRep.branchId,
          name: record.selectedRep.branchName || record.selectedRep.branchId,
        }])).values()].sort((left, right) => left.name.localeCompare(right.name)),
    },
  };
};

export const createOperationalReportCsv = dashboard => {
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const headings = ['Record type', 'Reference', 'RFQ reference', 'Company', 'Contact', 'Representative', 'Branch', 'Status', 'Emergency', 'Last updated'];
  const rows = dashboard.records.map(record => [
    record.workflowType,
    record.reference,
    record.sourceRfqReference || '',
    record.company,
    record.contact,
    record.selectedRep?.name || '',
    record.selectedRep?.branchName || '',
    record.trackingStatus,
    record.emergency === 'yes' ? 'Yes' : 'No',
    record.updatedAt || record.createdAt,
  ]);
  return [headings, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
};
