import { useMemo, useState } from 'react';
import { roleProfileFor } from '../domain/accessControl.js';
import { statusById, trackingStatuses } from '../domain/tracking.js';
import { WorkflowActionPanel } from './WorkflowActionPanel.jsx';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired', 'converted_to_order', 'archived']);
const filterStatuses = [...new Map(trackingStatuses.map(status => [status.id, status])).values()];

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const searchableText = enquiry => [
  enquiry.reference, enquiry.company, enquiry.contact, enquiry.email, enquiry.poNumber,
  enquiry.selectedRep?.name, enquiry.selectedRep?.code, enquiry.selectedRep?.branchName,
].filter(Boolean).join(' ').toLowerCase();

export function OperationalDashboard({ account, enquiries, onAction, canUpdate, serviceMode, planningOptions, expeditingOptions }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(canUpdate ? 'actionable' : 'active');
  const [openId, setOpenId] = useState(null);
  const active = enquiries.filter(enquiry => !TERMINAL_STATUSES.has(enquiry.trackingStatus));
  const emergency = active.filter(enquiry => enquiry.emergency === 'yes').length;
  const awaitingPo = active.filter(enquiry => !enquiry.poNumber && !enquiry.poFileName).length;
  const copy = roleProfileFor(account.role).dashboard;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...enquiries]
      .filter(enquiry => filter === 'all'
        || (filter === 'active' && !TERMINAL_STATUSES.has(enquiry.trackingStatus))
        || (filter === 'actionable' && (enquiry.allowedWorkflowActions || []).some(action => action.action !== 'override_workflow'))
        || enquiry.trackingStatus === filter)
      .filter(enquiry => !term || searchableText(enquiry).includes(term))
      .sort((a, b) => {
        if (TERMINAL_STATUSES.has(a.trackingStatus) && !TERMINAL_STATUSES.has(b.trackingStatus)) return 1;
        if (TERMINAL_STATUSES.has(b.trackingStatus) && !TERMINAL_STATUSES.has(a.trackingStatus)) return -1;
        return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
      });
  }, [enquiries, filter, search]);

  return (
    <section className="app-screen expeditor-screen" aria-labelledby="expeditor-title">
      <header className="expeditor-hero">
        <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}{copy.eyebrow}</span>
        <h1 id="expeditor-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>{copy.headline}</em></h1>
        <p>{copy.description} Only actions allowed for this role and exact stage are shown.</p>
        <div className="expeditor-kpis"><span><strong>{active.length}</strong><small>Active</small></span><span><strong>{emergency}</strong><small>Emergency</small></span><span><strong>{awaitingPo}</strong><small>Awaiting PO</small></span></div>
      </header>

      <div className="expeditor-tools">
        <label className="expeditor-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or representative…" /><button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button></label>
        <label className="expeditor-filter"><span>Show</span><select value={filter} onChange={event => setFilter(event.target.value)}>{canUpdate && <option value="actionable">My actionable queue</option>}<option value="active">All active work</option><option value="all">Everything</option>{filterStatuses.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
      </div>

      <div className="expeditor-result-heading"><div><span className="eyebrow">{copy.queue}</span><h2>{filtered.length} matching record{filtered.length === 1 ? '' : 's'}</h2></div><small>Oldest updates first</small></div>

      <div className="expeditor-order-list">
        {filtered.map(enquiry => <ExpeditorOrderCard key={enquiry.id} enquiry={enquiry} expanded={openId === enquiry.id} onToggle={() => setOpenId(current => current === enquiry.id ? null : enquiry.id)} onAction={onAction} canUpdate={canUpdate} account={account} planningOptions={planningOptions} expeditingOptions={expeditingOptions} />)}
        {!filtered.length && <div className="expeditor-empty"><span>✓</span><strong>No matching requests</strong><p>Change the search or filter to view other work.</p></div>}
      </div>

      <p className="tracking-storage-note expeditor-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Same-device testing' : 'Private-cloud workspace'}</strong> {serviceMode === 'mock' ? 'Customer and staff actions share this browser’s local test data. The production API will provide secure multi-device access.' : 'Updates are saved by the company service and access is controlled by staff role.'}</span></p>
    </section>
  );
}

function ExpeditorOrderCard({ enquiry, expanded, onToggle, onAction, canUpdate, account, planningOptions, expeditingOptions }) {
  const status = statusById(enquiry.trackingStatus, enquiry.workflowType);
  const quantity = (enquiry.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const availableActions = (enquiry.allowedWorkflowActions || []).filter(action => action.action !== 'override_workflow');

  return (
    <article className={`expeditor-order-card ${enquiry.emergency === 'yes' ? 'is-emergency' : ''}`}>
      <button type="button" className="expeditor-order-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className="expeditor-order-id"><small>{enquiry.workflowType === 'order' ? 'ORDER' : 'RFQ'} · {enquiry.reference}{enquiry.isDemo ? ' · DEMO' : ''}</small><strong>{enquiry.company}</strong><em>{enquiry.contact}</em></span>
        <span className={`tracking-status status-${enquiry.trackingStatus}`}>{status.label}</span>
        <span className="expeditor-order-meta"><b>{enquiry.selectedRep?.name || 'Unassigned rep'}</b><small>{enquiry.selectedRep?.branchName || enquiry.area} · {quantity} unit{quantity === 1 ? '' : 's'}</small></span>
        <span className="expeditor-updated">Last update {formatDate(enquiry.updatedAt || enquiry.createdAt)} <b>{expanded ? '−' : '+'}</b></span>
      </button>

      {expanded && (
        <div className="expeditor-order-detail">
          <div className="expeditor-facts"><span><small>Application</small><strong>{enquiry.application}</strong></span><span><small>PO</small><strong>{enquiry.poNumber || enquiry.poFileName || 'Not supplied'}</strong></span><span><small>Supply</small><strong>{enquiry.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</strong></span><span><small>Contact</small><strong>{enquiry.phone}<br />{enquiry.email}</strong></span></div>
          <div className="expeditor-products">{(enquiry.items || []).map(item => <span key={item.lineId}><img src={item.image} alt="" /><strong>{item.code}</strong><small>{item.name}</small><b>× {item.quantity}</b></span>)}</div>
          {canUpdate && availableActions.length
            ? <WorkflowActionPanel record={enquiry} actions={availableActions} onAction={onAction} account={account} planningOptions={planningOptions} expeditingOptions={expeditingOptions} />
            : <p className="tracking-storage-note expeditor-readonly-note"><span>i</span><span><strong>{canUpdate ? 'No action at this stage' : 'Read-only role'}</strong> {canUpdate ? 'This record must first be completed by the role responsible for its current workflow stage.' : 'Your account may view this record but cannot perform workflow actions.'}</span></p>}
          <div className="expeditor-history"><h3>Recent updates</h3>{[...(enquiry.trackingHistory || [])].reverse().slice(0, 4).map(event => <span key={event.id}><i /><small>{formatDate(event.createdAt)}</small><strong>{statusById(event.toStatus || event.status, event.entityType).label}</strong><p>{event.note}</p></span>)}</div>
        </div>
      )}
    </article>
  );
}
