import { useEffect, useMemo, useState } from 'react';
import { ORDER_STATUSES, RFQ_STATUSES, workflowStatusById } from '../domain/workflow.js';
import { friendlyServiceError } from '../services/contracts.js';

const EMPTY_DASHBOARD = {
  metrics: {},
  records: [],
  ageing: [],
  recentActivity: [],
  ordersByRepresentative: [],
  ordersByBranch: [],
  ordersByStatus: [],
  filters: { statuses: [], branches: [] },
};

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

  const filters = useMemo(() => ({ search, status, branch }), [branch, search, status]);
  const load = async currentFilters => {
    setState('loading');
    setError('');
    try {
      const [nextDashboard, nextRepresentatives] = await Promise.all([
        managementActions.getDashboard(currentFilters),
        managementActions.getRepresentativeOptions(),
      ]);
      setDashboard(nextDashboard);
      setRepresentatives(nextRepresentatives);
      setState('ready');
    } catch (loadError) {
      setError(friendlyServiceError(loadError, 'Management oversight could not be loaded. Please try again.'));
      setState('failure');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(filters), search ? 200 : 0);
    return () => window.clearTimeout(timer);
  }, [branch, search, status]);

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

  if (state === 'loading' && !dashboard.generatedAt) {
    return <section className="app-screen management-state" aria-busy="true"><span className="state-spinner" /><h1>Preparing management oversight</h1><p>Calculating authorised workflow totals and recent activity…</p></section>;
  }
  if (state === 'failure' && !dashboard.generatedAt) {
    return <section className="app-screen management-state is-error"><h1>Management oversight is unavailable</h1><p role="alert">{error}</p><button className="primary-button" type="button" onClick={() => load(filters)}>Try again</button></section>;
  }

  const metrics = dashboard.metrics || {};
  return (
    <section className="app-screen management-screen" aria-labelledby="management-title">
      <header className="management-hero">
        <div>
          <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}Management oversight</span>
          <h1 id="management-title">Workflow health.<br /><em>Decisions with evidence.</em></h1>
          <p>Operational totals use only records authorised for {account.contact}. Protected price-engine values are excluded from this workspace and its exports.</p>
        </div>
        <button className="secondary-button" type="button" disabled={busy === 'export'} onClick={exportReport}>{busy === 'export' ? 'Generating…' : 'Export operational report'}</button>
      </header>

      <div className="management-metrics" aria-label="Workflow totals">
        <Metric label="Open RFQs" value={metrics.openRfqs} />
        <Metric label="Awaiting rep action" value={metrics.awaitingRepresentativeAction} />
        <Metric label="RFQs quoted" value={metrics.quotedRfqs} />
        <Metric label="Awaiting Planning" value={metrics.awaitingPlanning} />
        <Metric label="In Expediting" value={metrics.inExpediting} />
        <Metric label="On hold" value={metrics.onHold} />
        <Metric label="Delayed" value={metrics.delayed} />
        <Metric label="In Dispatch" value={metrics.inDispatch} />
        <Metric label="Completed" value={metrics.completed} />
        <Metric label="Emergency" value={metrics.emergency} />
        <Metric label="Archived" value={metrics.archived} />
        <Metric label="Average stage time" value={`${metrics.averageStageHours || 0}h`} detail="Across recorded transitions" />
      </div>

      <div className="management-breakdowns">
        <Breakdown title="Orders by representative" items={dashboard.ordersByRepresentative || []} />
        <Breakdown title="Orders by branch" items={dashboard.ordersByBranch || []} />
        <Breakdown title="Orders by status" items={dashboard.ordersByStatus || []} />
      </div>

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
}) {
  const statuses = record.workflowType === 'order' ? ORDER_STATUSES : RFQ_STATUSES;
  const timeline = [...(record.trackingHistory || [])].reverse().slice(0, 6);
  const set = (key, value) => onValues({ ...values, [key]: value });
  return (
    <article className={`management-record ${record.emergency === 'yes' ? 'is-emergency' : ''}`}>
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
            <div><dt>Priority</dt><dd>{record.emergency === 'yes' ? 'Emergency' : humanise(record.priority || 'standard')}</dd></div>
          </dl>
          <div className="management-actions">
            <section>
              <h3>Reassign representative</h3>
              <label><span>Representative</span><select value={values.representativeId || record.selectedRep?.id || ''} onChange={event => set('representativeId', event.target.value)}><option value="">Select representative</option>{representatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name} · {rep.branchName}</option>)}</select></label>
              <label><span>Reason</span><textarea rows="2" value={values.reason || ''} onChange={event => set('reason', event.target.value)} placeholder="Required for the immutable audit history" /></label>
              <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={onReassign}>Save reassignment</button>
            </section>
            <section>
              <h3>Approve workflow override</h3>
              <label><span>Target status</span><select value={values.targetStatus || ''} onChange={event => set('targetStatus', event.target.value)}><option value="">Select controlled target</option>{statuses.filter(item => item !== record.trackingStatus && item !== 'draft' && item !== 'archived').map(item => <option key={item} value={item}>{humanise(item)}</option>)}</select></label>
              <label><span>Approval reason</span><textarea rows="2" value={values.overrideReason || ''} onChange={event => set('overrideReason', event.target.value)} placeholder="Explain why the normal sequence must be overridden" /></label>
              <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={onOverride}>Approve and apply override</button>
            </section>
          </div>
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
