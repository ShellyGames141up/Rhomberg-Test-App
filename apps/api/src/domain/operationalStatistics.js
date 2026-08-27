import { qualityProjection } from './qualityProjection.js';
import { products as catalogue } from '../data/catalogue.js';
const categoryByProduct = new Map(catalogue.map(product => [product.id, product.category]));

const iso = value => value && Number.isFinite(+new Date(value)) ? new Date(value).toISOString() : '';
const required = value => /required|yes|sanas calibration/i.test(String(value || '')) && !/^no\b/i.test(String(value || '').trim());
const certification = item => required(item.configuration?.sanas) ? 'sanas' : required(item.configuration?.traceability) ? 'traceable' : '';
const types = order => [...new Set((order.items || []).map(certification).filter(Boolean))];
export const averageHours = pairs => {
  const values = pairs.map(([start, end]) => [new Date(start || ''), new Date(end || '')])
    .filter(([start, end]) => Number.isFinite(+start) && Number.isFinite(+end) && end >= start)
    .map(([start, end]) => (end - start) / 3600000);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : 0;
};
const at = (record, actions, last = false) => {
  const matches = (record.trackingHistory || []).filter(event => actions.includes(event.action));
  return (last ? matches.at(-1) : matches[0])?.createdAt || '';
};

export function buildOperationalStatistics(rfqs, orders, now = new Date()) {
  const buckets = Object.fromEntries(['byProduct', 'byCategory', 'byMonth', 'byYear', 'byRepresentative', 'byCompany'].map(key => [key, new Map()]));
  let totalUnits = 0;
  for (const order of orders) for (const item of order.items || []) {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    totalUnits += quantity;
    const labels = { byProduct: item.code || item.name || 'Unspecified product', byCategory: item.category || item.categoryId || categoryByProduct.get(item.productId) || 'Unspecified category', byMonth: iso(order.createdAt).slice(0, 7) || 'Unknown', byYear: iso(order.createdAt).slice(0, 4) || 'Unknown', byRepresentative: order.selectedRep?.name || 'Unassigned', byCompany: order.company || 'Unspecified company' };
    for (const [key, label] of Object.entries(labels)) buckets[key].set(label, (buckets[key].get(label) || 0) + quantity);
  }
  const products = { totalUnits, ...Object.fromEntries(Object.entries(buckets).map(([key, bucket]) => [key, [...bucket].map(([label, quantity]) => ({ label, quantity })).sort((a, b) => ['byMonth', 'byYear'].includes(key) ? a.label.localeCompare(b.label) : b.quantity - a.quantity || a.label.localeCompare(b.label))])) };
  const certified = orders.filter(order => types(order).length);
  const units = certified.flatMap(order => (order.items || []).flatMap(item => {
    const type = certification(item);
    if (!type) return [];
    // Count required physical units even before the Laboratory first opens them.
    return Array.from({ length: Math.max(0, Number(item.quantity) || 0) }, (_, index) => ({ certificationType: type, ...(order.laboratory?.units || order.details?.laboratory?.units || []).find(unit => unit.lineItemId === (item.lineId || item.id) && unit.unitNumber === index + 1) }));
  }));
  const qaOrders = orders.filter(order => !types(order).length);
  const qualities = qaOrders.map(order => order.qualityAssurance || qualityProjection(order.details));
  const inspections = qualities.flatMap(quality => quality.inspections || []);
  const first = inspections.filter(item => Number(item.attempt) === 1);
  const passes = inspections.filter(item => item.result === 'passed');
  const reworkCycles = qualities.reduce((sum, quality) => sum + Number(quality.reworkCycle || 0), 0);
  const count = statuses => orders.filter(order => statuses.includes(order.trackingStatus)).length;
  const completedAt = order => order.completedAt || order.details?.dispatch?.completedAt || at(order, ['complete_delivery', 'complete_collection'], true);
  return {
    products,
    laboratory: {
      awaitingReceipt: count(['awaiting_lab']), activeOrders: count(['lab_received', 'calibration_in_progress', 'calibration_on_hold']),
      unitsInProgress: units.filter(unit => unit.status === 'calibration_in_progress').length,
      certificatesPending: units.filter(unit => !unit.certificateId).length,
      readyForRelease: count(['awaiting_lab_release']),
      releasedThisMonth: certified.filter(order => iso(order.laboratory?.releasedAt || order.details?.laboratory?.releasedAt).slice(0, 7) === iso(now).slice(0, 7)).length,
      sanasUnits: units.filter(unit => unit.certificationType === 'sanas').length,
      traceableUnits: units.filter(unit => unit.certificationType === 'traceable').length,
    },
    quality: {
      awaitingInspection: count(['awaiting_qa', 'qa_reinspection_required']), inInspection: count(['qa_in_progress']),
      failed: count(['qa_failed', 'returned_to_expediting']), passed: count(['qa_passed']),
      totalInspections: inspections.length, failureCount: inspections.filter(item => item.result === 'failed').length,
      passRate: inspections.length ? Math.round(passes.length / inspections.length * 100) : 0,
      firstTimePassRate: first.length ? Math.round(first.filter(item => item.result === 'passed').length / first.length * 100) : 0,
      reworkCycles, reworkRate: inspections.length ? Math.round(reworkCycles / inspections.length * 100) : 0,
    },
    routing: { laboratoryOrders: certified.length, standardQaOrders: orders.length - certified.length, sanasOrders: certified.filter(order => types(order).includes('sanas')).length, traceableOrders: certified.filter(order => types(order).includes('traceable')).length },
    operations: {
      totalRfqs: rfqs.length, totalOrders: orders.length, openOrders: orders.length - count(['completed', 'cancelled', 'archived']),
      completedOrders: count(['completed']), cancelledOrders: count(['cancelled']), urgentOrders: orders.filter(order => order.priority === 'urgent' || order.emergency === 'yes').length,
      dispatchCompletionRate: orders.length ? Math.round(count(['completed']) / orders.length * 100) : 0,
      sanasCertificates: units.filter(unit => unit.certificationType === 'sanas' && unit.certificateId).length,
      traceableCertificates: units.filter(unit => unit.certificationType === 'traceable' && unit.certificateId).length,
      averageQuotationHours: averageHours(rfqs.map(rfq => [rfq.submittedAt, at(rfq, ['mark_quoted'])])),
      averagePlanningHours: averageHours(orders.map(order => [at(order, ['start_planning']), at(order, ['submit_to_expediting'])])),
      averageExpeditingHours: averageHours(orders.map(order => [at(order, ['start_expediting']), at(order, ['complete_expediting'])])),
      averageLaboratoryHours: averageHours(orders.map(order => [order.laboratory?.receivedAt, order.laboratory?.releasedAt])),
      averageQaHours: averageHours(orders.map(order => [at(order, ['start_qa']), at(order, ['pass_qa'], true)])),
      averageDispatchHours: averageHours(orders.map(order => [at(order, ['release_qa_order', 'release_lab_order', 'submit_to_dispatch']), completedAt(order)])),
      averageTotalOrderHours: averageHours(orders.map(order => [order.createdAt, completedAt(order)])), revenue: null,
    },
  };
}

// Reports never need raw details, documents, passwords or commercial values.
// Use a positive projection instead of spreading stored JSON into report payloads.
export const reportRecord = record => Object.fromEntries([
  'id', 'reference', 'workflowType', 'trackingStatus', 'companyId', 'company', 'contact',
  'createdAt', 'updatedAt', 'priority', 'version', 'sourceRfqReference', 'internalJobNumber', 'salesOrderNumber', 'customerPoNumber',
].map(key => [key, record[key]]).concat([
  ['selectedRep', { id: record.selectedRep?.id, name: record.selectedRep?.name, branchId: record.selectedRep?.branchId, branchName: record.selectedRep?.branchName }],
  ['items', (record.items || []).map(item => ({ id: item.id, lineId: item.lineId, productId: item.productId, code: item.code || item.product?.code, name: item.name || item.product?.name, quantity: item.quantity, configuration: item.configuration || {} }))],
  ['trackingHistory', (record.trackingHistory || []).map(event => ({ id: event.id, action: event.action, fromStatus: event.fromStatus, toStatus: event.toStatus || event.status, entityType: record.workflowType, createdAt: event.createdAt, note: event.customerVisible ? event.note : '' }))],
]));
