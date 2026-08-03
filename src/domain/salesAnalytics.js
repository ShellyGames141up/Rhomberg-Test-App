const TERMINAL_ORDERS = new Set(['completed', 'cancelled', 'archived']);
const LOST_RFQ_STATUSES = new Set(['cancelled', 'expired']);
const QUOTED_RFQ_STATUSES = new Set(['quoted', 'awaiting_customer_acceptance', 'converted_to_order']);

const validDate = value => {
  if (!value) return null;
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = value => validDate(value)?.toISOString().slice(0, 10) || '';
const monthKey = value => dateKey(value).slice(0, 7) || 'Unknown';
const percent = (part, whole) => whole ? Math.round(part / whole * 1000) / 10 : 0;
const money = value => Math.round((Number(value) || 0) * 100) / 100;

export const formatDurationDaysHours = value => {
  const totalHours = Math.max(0, Number(value) || 0);
  const roundedHours = Math.round(totalHours * 10) / 10;
  const days = Math.floor(roundedHours / 24);
  const hours = Math.round((roundedHours - days * 24) * 10) / 10;
  const dayLabel = days === 1 ? 'day' : 'days';
  const hourLabel = hours === 1 ? 'hour' : 'hours';
  if (!days) return `${hours} ${hourLabel}`;
  return `${days} ${dayLabel} ${hours} ${hourLabel}`;
};

export const resolveManagementPeriod = (options = {}, now = new Date()) => {
  const mode = options.periodMode === 'date_range' ? 'date_range' : 'rolling_months';
  const today = new Date(now);
  const end = mode === 'date_range' && dateKey(options.endDate) ? validDate(options.endDate) : today;
  let start;
  if (mode === 'date_range') {
    start = validDate(options.startDate);
    if (!start || !end || start > end) throw new Error('Choose a valid report start and end date.');
  } else {
    const rollingMonths = Math.min(60, Math.max(1, Number(options.rollingMonths) || 12));
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - rollingMonths + 1, 1));
  }
  return {
    mode,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: `${start.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })} to ${end.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`,
  };
};

const withinPeriod = (value, period) => {
  const key = dateKey(value);
  return Boolean(key && key >= period.startDate && key <= period.endDate);
};

const scopedRecords = (records, { representativeId = 'all', branchId = 'all' } = {}) => records
  .filter(record => representativeId === 'all' || record.selectedRep?.id === representativeId)
  .filter(record => branchId === 'all' || record.selectedRep?.branchId === branchId);

const quoteDateFor = record => (
  record.quotation?.date
  || record.quotedAt
  || record.acceptedAt
  || record.createdAt
);

const quoteValueFor = record => {
  const value = Number(record.quotation?.commercialTotal ?? record.sourceQuotation?.commercialTotal ?? 0);
  return Number.isFinite(value) && value > 0 ? money(value) : null;
};

const quoteCases = records => {
  const cases = new Map();
  for (const record of records) {
    const isOrder = record.workflowType === 'order';
    const hasQuotation = Boolean(record.quotation?.number || record.quotation?.commercialTotal || record.quotedAt);
    const isQuotedRfq = record.workflowType === 'rfq' && (hasQuotation || QUOTED_RFQ_STATUSES.has(record.trackingStatus));
    const isLostRfq = record.workflowType === 'rfq' && LOST_RFQ_STATUSES.has(record.trackingStatus) && hasQuotation;
    if (!isOrder && !isQuotedRfq && !isLostRfq) continue;
    const key = isOrder ? record.sourceRfqReference || record.reference : record.reference;
    const current = cases.get(key) || {};
    const converted = isOrder || record.trackingStatus === 'converted_to_order' || current.converted;
    cases.set(key, {
      ...current,
      key,
      reference: key,
      orderReference: isOrder ? record.reference : current.orderReference || '',
      quoteNumber: record.quotation?.number || current.quoteNumber || '',
      quoteDate: quoteDateFor(record) || current.quoteDate,
      commercialTotal: quoteValueFor(record) ?? current.commercialTotal ?? null,
      representativeId: record.selectedRep?.id || current.representativeId || '',
      representative: record.selectedRep?.name || current.representative || 'Unassigned',
      branchId: record.selectedRep?.branchId || current.branchId || '',
      branch: record.selectedRep?.branchName || current.branch || 'Unassigned',
      companyId: record.companyId || current.companyId || '',
      company: record.company || current.company || 'Unspecified company',
      converted,
      lost: !converted && (isLostRfq || current.lost),
      status: isOrder ? record.trackingStatus : current.status || record.trackingStatus,
    });
  }
  return [...cases.values()];
};

const aggregateCases = cases => {
  const quotations = cases.length;
  const convertedOrders = cases.filter(item => item.converted);
  const losses = cases.filter(item => item.lost);
  const valuedOrders = convertedOrders.filter(item => item.commercialTotal !== null);
  return {
    quotations,
    convertedOrders: convertedOrders.length,
    lostQuotes: losses.length,
    openQuotes: Math.max(0, quotations - convertedOrders.length - losses.length),
    quoteToOrderRatio: percent(convertedOrders.length, quotations),
    quoteLossRatio: percent(losses.length, quotations),
    totalOrderValue: money(valuedOrders.reduce((sum, item) => sum + item.commercialTotal, 0)),
    valueCoverage: percent(valuedOrders.length, convertedOrders.length),
    valuedOrders: valuedOrders.length,
  };
};

const groupedCaseRows = (cases, keyFor, labelFor) => {
  const groups = new Map();
  for (const item of cases) {
    const key = keyFor(item) || 'unassigned';
    const group = groups.get(key) || { key, label: labelFor(item) || 'Unassigned', cases: [] };
    group.cases.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({
    ...aggregateCases(group.cases),
    id: group.key,
    label: group.label,
  })).sort((left, right) => right.totalOrderValue - left.totalOrderValue || right.convertedOrders - left.convertedOrders || left.label.localeCompare(right.label));
};

const buildNewClientGrowth = (records, period) => {
  const firstByCompany = new Map();
  for (const record of records) {
    const created = validDate(record.createdAt || record.submittedAt || record.acceptedAt);
    if (!created || !record.companyId) continue;
    const current = firstByCompany.get(record.companyId);
    if (!current || created < current.created) firstByCompany.set(record.companyId, {
      companyId: record.companyId,
      company: record.company,
      created,
      representativeId: record.selectedRep?.id || '',
      representative: record.selectedRep?.name || 'Unassigned',
    });
  }
  const newClients = [...firstByCompany.values()].filter(item => withinPeriod(item.created, period));
  const monthly = new Map();
  const byRepresentative = new Map();
  for (const client of newClients) {
    const month = monthKey(client.created);
    monthly.set(month, (monthly.get(month) || 0) + 1);
    const rep = byRepresentative.get(client.representativeId) || { id: client.representativeId, label: client.representative, count: 0 };
    rep.count += 1;
    byRepresentative.set(client.representativeId, rep);
  }
  return {
    total: newClients.length,
    monthly: [...monthly.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => left.label.localeCompare(right.label)),
    byRepresentative: [...byRepresentative.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
  };
};

const delayedPromiseDate = order => (
  order.expediting?.delayPromiseDate
  || order.delayPromiseDate
  || order.expediting?.promisedDeliveryDate
  || order.expediting?.estimatedCompletionDate
  || order.planning?.estimatedCompletionDate
  || ''
);

const buildOverduePromises = (records, now) => records
  .filter(record => record.workflowType === 'order' && !TERMINAL_ORDERS.has(record.trackingStatus))
  .map(record => ({ record, promiseDate: delayedPromiseDate(record) }))
  .filter(item => item.promiseDate && dateKey(item.promiseDate) < now.toISOString().slice(0, 10))
  .filter(item => item.record.expediting?.currentDelayReason || ['delayed', 'on_hold'].includes(item.record.trackingStatus) || item.record.dispatch?.currentProblemReason)
  .map(item => ({
    reference: item.record.reference,
    company: item.record.company,
    representative: item.record.selectedRep?.name || 'Unassigned',
    branch: item.record.selectedRep?.branchName || 'Unassigned',
    promiseDate: dateKey(item.promiseDate),
    daysOverdue: Math.max(1, Math.floor((now - validDate(item.promiseDate)) / 86_400_000)),
    reason: item.record.expediting?.currentDelayReason || item.record.dispatch?.currentProblemReason || 'Order remains on hold after its promised date.',
    status: item.record.trackingStatus,
  }))
  .sort((left, right) => right.daysOverdue - left.daysOverdue || left.reference.localeCompare(right.reference));

export const buildSalesPerformanceAnalytics = (records = [], options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const period = resolveManagementPeriod(options, now);
  const scoped = scopedRecords(records, options);
  const cases = quoteCases(scoped).filter(item => withinPeriod(item.quoteDate, period));
  const monthly = groupedCaseRows(cases, item => monthKey(item.quoteDate), item => monthKey(item.quoteDate))
    .sort((left, right) => left.label.localeCompare(right.label));
  const newClients = buildNewClientGrowth(scoped, period);
  const byRepresentative = groupedCaseRows(cases, item => item.representativeId, item => item.representative)
    .map(row => ({ ...row, newClients: newClients.byRepresentative.find(item => item.id === row.id)?.count || 0 }));
  return {
    authorised: true,
    period,
    scope: {
      representativeId: options.representativeId || 'all',
      branchId: options.branchId || 'all',
    },
    overall: aggregateCases(cases),
    byRepresentative,
    byBranch: groupedCaseRows(cases, item => item.branchId, item => item.branch),
    monthly,
    newClients,
    overduePromises: buildOverduePromises(scoped, now),
  };
};
