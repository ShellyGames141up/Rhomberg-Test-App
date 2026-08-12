import { useEffect, useMemo, useState } from 'react';
import { ORDER_STATUSES, RFQ_STATUSES, workflowStatusById } from '../domain/workflow.js';
import { MANAGEMENT_REPORT_SECTIONS } from '../domain/managementReports.js';
import { formatDurationDaysHours } from '../domain/salesAnalytics.js';
import { roleProfileFor } from '../domain/accessControl.js';
import { accountCan, friendlyServiceError, PERMISSIONS } from '../services/contracts.js';

const EMPTY_DASHBOARD = {
  metrics: {},
  records: [],
  ageing: [],
  recentActivity: [],
  ordersByRepresentative: [],
  ordersByBranch: [],
  ordersByStatus: [],
  phase21: {
    products: { totalUnits: 0, byProduct: [], byCategory: [], byMonth: [], byYear: [], byRepresentative: [], byCompany: [] },
    laboratory: {},
    quality: {},
    routing: {},
    operations: {},
  },
  salesPerformance: { authorised: false },
  filters: { statuses: [], branches: [] },
};

const DEFAULT_REPORT_CONFIG = Object.freeze({
  periodMode: 'rolling_months',
  rollingMonths: 12,
  startDate: '',
  endDate: new Date().toISOString().slice(0, 10),
  representativeId: 'all',
  branchId: 'all',
  sections: MANAGEMENT_REPORT_SECTIONS.map(section => section.id),
});

const formatDate = value => value
  ? new Date(value).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  : 'Not recorded';

const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const downloadReport = report => {
  const url = URL.createObjectURL(new Blob([report.csv], { type: report.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = report.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const downloadPdfReport = report => {
  const binary = globalThis.atob(report.bytesBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: report.mimeType || 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = report.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const formatMoney = value => `ZAR ${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = value => `${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 1 })}%`;
const formatStageTime = value => formatDurationDaysHours(value || 0);

function Metric({ label, value, detail = '' }) {
  return <article className="management-metric"><strong>{value ?? 0}</strong><span>{label}</span>{detail && <small>{detail}</small>}</article>;
}

function Breakdown({ title, items }) {
  const maximum = Math.max(1, ...items.map(item => item.count));
  return (
    <section className="management-breakdown">
      <h2>{title}</h2>
      {items.slice(0, 8).map(item => (
        <div key={item.label}>
          <span>{humanise(item.label)}</span>
          <i><b style={{ width: `${Math.max(4, item.count / maximum * 100)}%` }} /></i>
          <strong>{item.count}</strong>
        </div>
      ))}
      {!items.length && <p>No authorised order data is available.</p>}
    </section>
  );
}

function QuantityBreakdown({ title, items, empty = 'No unit-volume data is available.' }) {
  const maximum = Math.max(1, ...items.map(item => item.quantity));
  return (
    <section className="management-breakdown quantity-breakdown">
      <h2>{title}</h2>
      {items.slice(0, 10).map(item => (
        <div key={item.label}>
          <span>{humanise(item.label)}</span>
          <i><b style={{ width: `${Math.max(4, item.quantity / maximum * 100)}%` }} /></i>
          <strong>{item.quantity}</strong>
        </div>
      ))}
      {!items.length && <p>{empty}</p>}
    </section>
  );
}

function PerformanceTable({ title, columns, rows, empty = 'No data is available for this period.' }) {
  return (
    <section className="management-performance-table">
      <h3>{title}</h3>
      {rows.length ? <div className="management-table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || row.label || index}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>)}</tbody></table></div> : <p>{empty}</p>}
    </section>
  );
}

function CommercialPerformance({ performance }) {
  const overall = performance.overall || {};
  return (
    <section className="management-commercial-block" aria-labelledby="commercial-performance-title">
      <div className="management-section-heading">
        <div><span className="eyebrow">Restricted commercial performance</span><h2 id="commercial-performance-title">Quotation conversion and order value</h2></div>
        <small>{performance.period?.label} · TOTAL ZAR from verified quotation metadata</small>
      </div>
      <div className="management-metrics compact" aria-label="Commercial performance totals">
        <Metric label="Total quotations" value={overall.quotations || 0} />
        <Metric label="Converted order value" value={formatMoney(overall.totalOrderValue)} detail={`${formatPercent(overall.valueCoverage)} value coverage`} />
        <Metric label="Quote-to-order ratio" value={formatPercent(overall.quoteToOrderRatio)} detail={`${overall.convertedOrders || 0} converted orders`} />
        <Metric label="Quote-loss ratio" value={formatPercent(overall.quoteLossRatio)} detail={`${overall.lostQuotes || 0} recorded losses`} />
        <Metric label="New clients" value={performance.newClients?.total || 0} detail="First recorded activity in period" />
        <Metric label="Promise dates exceeded" value={performance.overduePromises?.length || 0} detail="Delayed or held orders only" />
      </div>
      <div className="management-performance-grid">
        <PerformanceTable
          title="Performance by representative"
          rows={performance.byRepresentative || []}
          columns={[
            { key: 'label', label: 'Representative' },
            { key: 'quotations', label: 'Quotes' },
            { key: 'convertedOrders', label: 'Orders' },
            { key: 'totalOrderValue', label: 'Order value', render: formatMoney },
            { key: 'quoteToOrderRatio', label: 'Order ratio', render: formatPercent },
            { key: 'quoteLossRatio', label: 'Loss ratio', render: formatPercent },
            { key: 'newClients', label: 'New clients' },
          ]}
        />
        <PerformanceTable
          title="Monthly financial tracking"
          rows={performance.monthly || []}
          columns={[
            { key: 'label', label: 'Month' },
            { key: 'quotations', label: 'Quotes' },
            { key: 'convertedOrders', label: 'Orders' },
            { key: 'totalOrderValue', label: 'Order value', render: formatMoney },
            { key: 'quoteToOrderRatio', label: 'Order ratio', render: formatPercent },
          ]}
        />
      </div>
      <PerformanceTable
        title="Orders beyond a recorded delay promise date"
        rows={performance.overduePromises || []}
        columns={[
          { key: 'reference', label: 'Order' },
          { key: 'company', label: 'Customer' },
          { key: 'representative', label: 'Representative' },
          { key: 'promiseDate', label: 'Promise date' },
          { key: 'daysOverdue', label: 'Overdue', render: value => `${value}d` },
          { key: 'reason', label: 'Delay reason' },
        ]}
        empty="No delayed orders are beyond their recorded promise date."
      />
      <p className="commercial-data-note"><strong>Coverage note:</strong> Converted-order value includes only quotations with a verified TOTAL ZAR. Missing quotation PDFs reduce value coverage rather than being estimated.</p>
    </section>
  );
}

function PerformanceReportBuilder({ config, onConfig, options, reportingProfile, busy, onExport }) {
  const set = (key, value) => onConfig(current => ({ ...current, [key]: value }));
  const toggleSection = sectionId => onConfig(current => ({
    ...current,
    sections: current.sections.includes(sectionId)
      ? current.sections.filter(item => item !== sectionId)
      : [...current.sections, sectionId],
  }));
  return (
    <section className="management-report-builder" aria-labelledby="management-report-title">
      <div className="management-section-heading">
        <div><span className="eyebrow">Owner and Sales Manager only</span><h2 id="management-report-title">Operational management PDF</h2></div>
        <small>Every generation is added to the immutable audit history</small>
      </div>
      <div className="management-report-scope">
        <label><span>Period selection</span><select value={config.periodMode} onChange={event => set('periodMode', event.target.value)}><option value="rolling_months">Set number of months</option><option value="date_range">Date to date</option></select></label>
        {config.periodMode === 'rolling_months' ? <label><span>Months</span><select value={config.rollingMonths} onChange={event => set('rollingMonths', Number(event.target.value))}>{options.rollingMonthOptions.map(months => <option key={months} value={months}>{months} month{months === 1 ? '' : 's'}</option>)}</select></label> : <>
          <label><span>Start date</span><input type="date" value={config.startDate} onChange={event => set('startDate', event.target.value)} /></label>
          <label><span>End date</span><input type="date" value={config.endDate} onChange={event => set('endDate', event.target.value)} /></label>
        </>}
        <label><span>{reportingProfile.representativeFilterLabel}</span><select value={config.representativeId} onChange={event => set('representativeId', event.target.value)}><option value="all">All authorised representatives</option>{options.representatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name} · {rep.branchName}</option>)}</select></label>
        <label><span>Branch scope</span><select value={config.branchId} onChange={event => set('branchId', event.target.value)}><option value="all">All authorised branches</option>{options.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      </div>
      <fieldset className="management-report-sections"><legend>Choose PDF sections</legend>{MANAGEMENT_REPORT_SECTIONS.map(section => <label key={section.id}><input type="checkbox" checked={config.sections.includes(section.id)} onChange={() => toggleSection(section.id)} /><span>{section.label}</span></label>)}</fieldset>
      <div className="management-report-actions"><p>{config.sections.length} of {MANAGEMENT_REPORT_SECTIONS.length} sections selected</p><button className="primary-button" type="button" disabled={busy || !config.sections.length || (config.periodMode === 'date_range' && (!config.startDate || !config.endDate))} onClick={onExport}>{busy ? 'Generating PDF…' : 'Download Operational PDF'}</button></div>
    </section>
  );
}

export function ManagementDashboard({
  account,
  managementActions,
  serviceMode,
  onRecordsChanged,
  onOpenAudit,
}) {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [representatives, setRepresentatives] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [branch, setBranch] = useState('all');
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState('');
  const [actionState, setActionState] = useState({});
  const [busy, setBusy] = useState('');
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [performanceReportOptions, setPerformanceReportOptions] = useState({ representatives: [], branches: [], rollingMonthOptions: [1, 3, 6, 12, 24, 36] });
  const [reportConfig, setReportConfig] = useState(DEFAULT_REPORT_CONFIG);
  const canReassign = accountCan(account, PERMISSIONS.REASSIGN_REPRESENTATIVE);
  const canOverride = accountCan(account, PERMISSIONS.OVERRIDE_WORKFLOW);
  const canManageRecords = canReassign || canOverride;
  const reportingProfile = roleProfileFor(account.role).commercialReporting;
  const canUsePerformanceReports = Boolean(reportingProfile)
    && accountCan(account, PERMISSIONS.VIEW_COMMERCIAL_ANALYTICS)
    && accountCan(account, PERMISSIONS.EXPORT_MANAGEMENT_PDF);

  const filters = useMemo(() => ({ search, status, branch }), [branch, search, status]);
  const load = async currentFilters => {
    setState('loading');
    setError('');
    try {
      const [nextDashboard, nextRepresentatives, nextPerformanceOptions] = await Promise.all([
        managementActions.getDashboard(currentFilters),
        canManageRecords ? managementActions.getRepresentativeOptions() : Promise.resolve([]),
        canUsePerformanceReports ? managementActions.getPerformanceReportOptions() : Promise.resolve(performanceReportOptions),
      ]);
      setDashboard(nextDashboard);
      setRepresentatives(nextRepresentatives);
      setPerformanceReportOptions(nextPerformanceOptions);
      setState('ready');
    } catch (loadError) {
      setError(friendlyServiceError(loadError, 'Management oversight could not be loaded. Please try again.'));
      setState('failure');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(filters), search ? 200 : 0);
    return () => window.clearTimeout(timer);
  }, [account.id, account.role, branch, search, status]);

  const run = async (key, operation, successMessage) => {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await operation();
      await onRecordsChanged?.();
      await load(filters);
      setMessage(successMessage);
    } catch (actionError) {
      setError(friendlyServiceError(actionError, 'The management action could not be completed. Please review the details and try again.'));
    } finally {
      setBusy('');
    }
  };

  const exportReport = () => run(
    'export',
    async () => downloadReport(await managementActions.exportOperationalReport(filters)),
    'The authorised operational report was generated and audited.',
  );

  const exportPerformanceReport = () => run(
    'performance-export',
    async () => downloadPdfReport(await managementActions.exportPerformancePdf(reportConfig)),
    'The restricted management PDF was generated, downloaded and audited.',
  );

  if (state === 'loading' && !dashboard.generatedAt) {
    return <section className="app-screen management-state" aria-busy="true"><span className="state-spinner" /><h1>Preparing management oversight</h1><p>Calculating authorised workflow totals and recent activity…</p></section>;
  }
  if (state === 'failure' && !dashboard.generatedAt) {
    return <section className="app-screen management-state is-error"><h1>Management oversight is unavailable</h1><p role="alert">{error}</p><button className="primary-button" type="button" onClick={() => load(filters)}>Try again</button></section>;
  }

  const metrics = dashboard.metrics || {};
  const phase21 = dashboard.phase21 || EMPTY_DASHBOARD.phase21;
  const dashboardLabel = roleProfileFor(account.role).dashboard?.eyebrow || 'Management oversight';
  return (
    <section className="app-screen management-screen" aria-labelledby="management-title">
      <header className="management-hero">
        <div>
          <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}{dashboardLabel}</span>
          <h1 id="management-title">Workflow health.<br /><em>Decisions with evidence.</em></h1>
          <p>Operational totals use only records authorised for {account.contact}. Protected price-engine values are excluded from this workspace and its exports.</p>
        </div>
        <div className="management-hero-actions">
          {canUsePerformanceReports && <button className="primary-button" type="button" aria-expanded={showReportBuilder} onClick={() => setShowReportBuilder(value => !value)}>{showReportBuilder ? 'Close PDF options' : 'Download Operational PDF'}</button>}
          {accountCan(account, PERMISSIONS.EXPORT_OPERATIONAL_REPORTS) && <button className="text-button" type="button" disabled={busy === 'export'} onClick={exportReport}>{busy === 'export' ? 'Generating CSV…' : 'Advanced: download CSV'}</button>}
        </div>
      </header>

      {canUsePerformanceReports && showReportBuilder && <PerformanceReportBuilder config={reportConfig} onConfig={setReportConfig} options={performanceReportOptions} reportingProfile={reportingProfile} busy={busy === 'performance-export'} onExport={exportPerformanceReport} />}

      <div className="management-metrics" aria-label="Workflow totals">
        <Metric label="Open RFQs" value={metrics.openRfqs} />
        <Metric label="Awaiting rep action" value={metrics.awaitingRepresentativeAction} />
        <Metric label="RFQs quoted" value={metrics.quotedRfqs} />
        <Metric label="Awaiting Planning" value={metrics.awaitingPlanning} />
        <Metric label="In Expediting" value={metrics.inExpediting} />
        <Metric label="In Laboratory" value={metrics.inLaboratory} />
        <Metric label="In Quality Assurance" value={metrics.inQualityAssurance} />
        <Metric label="On hold" value={metrics.onHold} />
        <Metric label="Delayed" value={metrics.delayed} />
        <Metric label="In Dispatch" value={metrics.inDispatch} />
        <Metric label="Completed" value={metrics.completed} />
        <Metric label="Emergency" value={metrics.emergency} />
        <Metric label="Archived" value={metrics.archived} />
        <Metric label="Average stage time" value={metrics.averageStageDuration || '0 hours'} detail={`${metrics.averageStageHours || 0} total hours across recorded transitions`} />
      </div>

      {dashboard.salesPerformance?.authorised && <CommercialPerformance performance={dashboard.salesPerformance} />}

      <div className="management-breakdowns">
        <Breakdown title="Orders by representative" items={dashboard.ordersByRepresentative || []} />
        <Breakdown title="Orders by branch" items={dashboard.ordersByBranch || []} />
        <Breakdown title="Orders by status" items={dashboard.ordersByStatus || []} />
      </div>

      <section className="management-analytics-block">
        <div className="management-section-heading">
          <div><span className="eyebrow">Quantity-based demand</span><h2>{phase21.products.totalUnits || 0} ordered units across authorised records</h2></div>
          <small>Counts physical units, not order lines · no pricing</small>
        </div>
        <div className="management-breakdowns">
          <QuantityBreakdown title="Units by product" items={phase21.products.byProduct || []} />
          <QuantityBreakdown title="Units by representative" items={phase21.products.byRepresentative || []} />
          <QuantityBreakdown title="Monthly unit volume" items={phase21.products.byMonth || []} />
        </div>
        <div className="management-metrics compact" aria-label="Laboratory and quality metrics">
          <Metric label="SANAS orders" value={phase21.routing.sanasOrders} />
          <Metric label="Traceable orders" value={phase21.routing.traceableOrders} />
          <Metric label="Lab certificates pending" value={phase21.laboratory.certificatesPending} />
          <Metric label="QA pass rate" value={`${phase21.quality.passRate || 0}%`} />
          <Metric label="QA first-time pass" value={`${phase21.quality.firstTimePassRate || 0}%`} />
          <Metric label="QA rework rate" value={`${phase21.quality.reworkRate || 0}%`} />
          <Metric label="QA failures" value={phase21.quality.failureCount} />
          <Metric label="QA rework cycles" value={phase21.quality.reworkCycles} />
          <Metric label="SANAS certificates" value={phase21.operations.sanasCertificates} />
          <Metric label="Traceable certificates" value={phase21.operations.traceableCertificates} />
          <Metric label="Dispatch completion" value={`${phase21.operations.dispatchCompletionRate || 0}%`} />
          <Metric label="Average Lab time" value={formatStageTime(phase21.operations.averageLaboratoryHours)} />
          <Metric label="Average QA time" value={formatStageTime(phase21.operations.averageQaHours)} />
          <Metric label="Average Dispatch time" value={formatStageTime(phase21.operations.averageDispatchHours)} />
        </div>
      </section>

      <div className="management-toolbar">
        <label><span>Search authorised records</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Reference, company, contact, job, PO or representative…" /></label>
        <label><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{dashboard.filters.statuses.map(item => <option key={item} value={item}>{humanise(item)}</option>)}</select></label>
        <label><span>Branch</span><select value={branch} onChange={event => setBranch(event.target.value)}><option value="all">All authorised branches</option>{dashboard.filters.branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="button" className="secondary-button" onClick={() => load(filters)} disabled={state === 'loading'}>{state === 'loading' ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      {(error || message) && <p className={`management-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}

      <div className="management-content-grid">
        <section className="management-records">
          <div className="management-section-heading"><div><span className="eyebrow">Authorised records</span><h2>{dashboard.records.length} matching record{dashboard.records.length === 1 ? '' : 's'}</h2></div><small>Search and filters are server-ready</small></div>
          {dashboard.records.map(record => (
            <ManagementRecord
              key={record.id}
              record={record}
              expanded={openId === record.id}
              onToggle={() => setOpenId(current => current === record.id ? '' : record.id)}
              representatives={representatives}
              values={actionState[record.id] || {}}
              onValues={values => setActionState(current => ({ ...current, [record.id]: values }))}
              onReassign={() => run(
                `reassign-${record.id}`,
                () => managementActions.reassignRepresentative(record.id, {
                  representativeId: actionState[record.id]?.representativeId,
                  reason: actionState[record.id]?.reason,
                  expectedVersion: record.version,
                }),
                `${record.reference} was reassigned and audited.`,
              )}
              onOverride={() => run(
                `override-${record.id}`,
                () => managementActions.approveWorkflowOverride(record.id, {
                  targetStatus: actionState[record.id]?.targetStatus,
                  reason: actionState[record.id]?.overrideReason,
                  entityType: record.workflowType,
                  expectedVersion: record.version,
                }),
                `${record.reference} override was approved and audited.`,
              )}
              onOpenAudit={() => onOpenAudit?.(record)}
              busy={busy}
              canReassign={canReassign}
              canOverride={canOverride}
            />
          ))}
          {!dashboard.records.length && <div className="management-empty"><strong>No authorised records match</strong><p>Clear the search or broaden the status and branch filters.</p></div>}
        </section>

        <aside className="management-side">
          <section>
            <span className="eyebrow">Ageing list</span>
            <h2>Oldest attention first</h2>
            {(dashboard.ageing || []).slice(0, 8).map(record => <button type="button" key={record.id} onClick={() => setOpenId(record.id)}><span><strong>{record.reference}</strong><small>{record.company}</small></span><b>{record.ageDays}d</b></button>)}
            {!dashboard.ageing?.length && <p>No active records match the filters.</p>}
          </section>
          <section>
            <span className="eyebrow">Recent activity</span>
            <h2>Latest audited events</h2>
            {(dashboard.recentActivity || []).map(event => <div key={event.id}><i /><span><strong>{event.reference || humanise(event.eventType)}</strong><small>{humanise(event.eventType)} · {event.actingUser}</small><em>{formatDate(event.timestamp)}</em></span></div>)}
            {!dashboard.recentActivity?.length && <p>No matching audit activity is available.</p>}
          </section>
        </aside>
      </div>
    </section>
  );
}

function ManagementRecord({
  record,
  expanded,
  onToggle,
  representatives,
  values,
  onValues,
  onReassign,
  onOverride,
  onOpenAudit,
  busy,
  canReassign,
  canOverride,
}) {
  const statuses = record.workflowType === 'order' ? ORDER_STATUSES : RFQ_STATUSES;
  const timeline = [...(record.trackingHistory || [])].reverse().slice(0, 6);
  const set = (key, value) => onValues({ ...values, [key]: value });
  return (
    <article className={`management-record ${record.priority === 'urgent' ? 'is-emergency' : ''}`}>
      <button className="management-record-summary" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span><small>{record.workflowType.toUpperCase()} · {record.reference}</small><strong>{record.company}</strong><em>{record.contact}</em></span>
        <span><small>Representative</small><strong>{record.selectedRep?.name || 'Unassigned'}</strong><em>{record.selectedRep?.branchName || 'No branch'}</em></span>
        <span><small>Status</small><strong>{workflowStatusById(record.trackingStatus, record.workflowType)?.label || humanise(record.trackingStatus)}</strong><em>{formatDate(record.updatedAt)}</em></span>
        <b>{expanded ? '−' : '+'}</b>
      </button>
      {expanded && (
        <div className="management-record-detail">
          <dl>
            <div><dt>Job number</dt><dd>{record.internalJobNumber || 'Not assigned'}</dd></div>
            <div><dt>Purchase Order</dt><dd>{record.customerPoNumber || record.poNumber || 'Not supplied'}</dd></div>
            <div><dt>Original RFQ</dt><dd>{record.sourceRfqReference || (record.workflowType === 'rfq' ? record.reference : 'Not recorded')}</dd></div>
            <div><dt>Priority</dt><dd>{record.priority === 'urgent' ? 'Urgent' : humanise(record.priority || 'standard')}</dd></div>
          </dl>
          {(canReassign || canOverride) && <div className="management-actions">
            {canReassign && <section>
              <h3>Reassign representative</h3>
              <label><span>Representative</span><select value={values.representativeId || record.selectedRep?.id || ''} onChange={event => set('representativeId', event.target.value)}><option value="">Select representative</option>{representatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name} · {rep.branchName}</option>)}</select></label>
              <label><span>Reason</span><textarea rows="2" value={values.reason || ''} onChange={event => set('reason', event.target.value)} placeholder="Required for the immutable audit history" /></label>
              <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={onReassign}>Save reassignment</button>
            </section>}
            {canOverride && <section>
              <h3>Approve workflow override</h3>
              <label><span>Target status</span><select value={values.targetStatus || ''} onChange={event => set('targetStatus', event.target.value)}><option value="">Select controlled target</option>{statuses.filter(item => item !== record.trackingStatus && item !== 'draft' && item !== 'archived').map(item => <option key={item} value={item}>{humanise(item)}</option>)}</select></label>
              <label><span>Approval reason</span><textarea rows="2" value={values.overrideReason || ''} onChange={event => set('overrideReason', event.target.value)} placeholder="Explain why the normal sequence must be overridden" /></label>
              <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={onOverride}>Approve and apply override</button>
            </section>}
          </div>}
          <section className="management-timeline">
            <div><h3>Recent timeline</h3><button type="button" onClick={onOpenAudit}>Review full audit history</button></div>
            {timeline.map(event => <p key={event.id}><i /><span><strong>{workflowStatusById(event.toStatus || event.status, event.entityType)?.label || humanise(event.toStatus || event.status)}</strong><small>{event.note || event.customerDescription}</small></span><time>{formatDate(event.createdAt)}</time></p>)}
            {!timeline.length && <p>No timeline events are recorded.</p>}
          </section>
        </div>
      )}
    </article>
  );
}
