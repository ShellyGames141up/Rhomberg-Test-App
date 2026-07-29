import { laboratoryMetrics, orderCertificationTypes } from './certification.js';
import { qualityMetrics } from './qualityAssurance.js';

const monthKey = value => String(value || '').slice(0, 7) || 'Unknown';
const yearKey = value => String(value || '').slice(0, 4) || 'Unknown';
const increment = (map, key, amount = 1) => map.set(key, (map.get(key) || 0) + amount);
const rows = map => [...map.entries()]
  .map(([label, quantity]) => ({ label, quantity }))
  .sort((left, right) => right.quantity - left.quantity || left.label.localeCompare(right.label));

export const buildProductQuantityStatistics = (records = []) => {
  const byProduct = new Map();
  const byCategory = new Map();
  const byMonth = new Map();
  const byYear = new Map();
  const byRepresentative = new Map();
  const byCompany = new Map();
  let totalUnits = 0;
  for (const record of records.filter(item => item.workflowType === 'order')) {
    for (const item of record.items || []) {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      totalUnits += quantity;
      increment(byProduct, item.code || item.name || 'Unspecified product', quantity);
      increment(byCategory, item.category || item.categoryId || 'Unspecified category', quantity);
      increment(byMonth, monthKey(record.createdAt), quantity);
      increment(byYear, yearKey(record.createdAt), quantity);
      increment(byRepresentative, record.selectedRep?.name || 'Unassigned', quantity);
      increment(byCompany, record.company || 'Unspecified company', quantity);
    }
  }
  return {
    totalUnits,
    byProduct: rows(byProduct),
    byCategory: rows(byCategory),
    byMonth: rows(byMonth).sort((left, right) => left.label.localeCompare(right.label)),
    byYear: rows(byYear).sort((left, right) => left.label.localeCompare(right.label)),
    byRepresentative: rows(byRepresentative),
    byCompany: rows(byCompany),
  };
};

const validDate = value => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const averageHours = pairs => {
  const values = pairs
    .map(([start, end]) => {
      const from = validDate(start);
      const to = validDate(end);
      return from && to && to >= from ? (to - from) / 3_600_000 : null;
    })
    .filter(value => value !== null);
  return values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : 0;
};

const orderCompletedAt = order => (
  order.completedAt
  || order.dispatch?.completedAt
  || order.trackingHistory?.findLast?.(event => ['complete_delivery', 'complete_collection'].includes(event.action))?.createdAt
  || ''
);

export const buildPhase21Analytics = (records = []) => {
  const rfqs = records.filter(record => record.workflowType === 'rfq');
  const orders = records.filter(record => record.workflowType === 'order');
  const certifiedOrders = orders.filter(order => orderCertificationTypes(order).length);
  const qa = qualityMetrics(orders);
  const inspections = orders.flatMap(order => order.qualityAssurance?.inspections || []);
  const firstAttempts = inspections.filter(inspection => Number(inspection.attempt) === 1);
  const firstPasses = firstAttempts.filter(inspection => inspection.result === 'passed');
  const certificates = certifiedOrders.flatMap(order => order.laboratory?.units || []);
  const completedOrders = orders.filter(order => order.trackingStatus === 'completed');
  return {
    products: buildProductQuantityStatistics(records),
    laboratory: laboratoryMetrics(orders),
    quality: {
      ...qa,
      firstTimePassRate: firstAttempts.length ? Math.round(firstPasses.length / firstAttempts.length * 100) : 0,
      reworkRate: inspections.length ? Math.round(qa.reworkCycles / inspections.length * 100) : 0,
    },
    routing: {
      laboratoryOrders: certifiedOrders.length,
      standardQaOrders: orders.length - certifiedOrders.length,
      sanasOrders: certifiedOrders.filter(order => orderCertificationTypes(order).includes('sanas')).length,
      traceableOrders: certifiedOrders.filter(order => orderCertificationTypes(order).includes('traceable')).length,
    },
    operations: {
      totalRfqs: rfqs.length,
      totalOrders: orders.length,
      openOrders: orders.filter(order => !['completed', 'cancelled', 'archived'].includes(order.trackingStatus)).length,
      completedOrders: completedOrders.length,
      cancelledOrders: orders.filter(order => order.trackingStatus === 'cancelled').length,
      urgentOrders: orders.filter(order => order.emergency === 'yes' || order.priority === 'urgent').length,
      dispatchCompletionRate: orders.length ? Math.round(completedOrders.length / orders.length * 100) : 0,
      sanasCertificates: certificates.filter(unit => unit.certificationType === 'sanas' && unit.certificateId).length,
      traceableCertificates: certificates.filter(unit => unit.certificationType === 'traceable' && unit.certificateId).length,
      averageQuotationHours: averageHours(rfqs.map(rfq => [rfq.submittedAt, rfq.quotedAt || rfq.quotation?.recordedAt])),
      averagePlanningHours: averageHours(orders.map(order => [order.planningStartedAt, order.planningSubmittedAt])),
      averageExpeditingHours: averageHours(orders.map(order => [order.expeditingStartedAt, order.submittedToDispatchAt])),
      averageLaboratoryHours: averageHours(orders.map(order => [order.laboratory?.receivedAt, order.laboratory?.releasedAt])),
      averageQaHours: averageHours(orders.map(order => [order.qaStartedAt || order.qualityAssurance?.startedAt, order.qaPassedAt])),
      averageDispatchHours: averageHours(orders.map(order => [order.dispatch?.receivedAt, orderCompletedAt(order)])),
      averageTotalOrderHours: averageHours(orders.map(order => [order.createdAt, orderCompletedAt(order)])),
      revenue: null,
    },
  };
};
