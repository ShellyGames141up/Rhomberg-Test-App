import { useMemo, useState } from 'react';
import { statusById, trackingStatuses } from '../domain/tracking.js';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired', 'converted_to_order', 'archived']);
const filterStatuses = [...new Map(trackingStatuses.map(status => [status.id, status])).values()];

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const searchableText = enquiry => [
  enquiry.reference, enquiry.company, enquiry.contact, enquiry.email, enquiry.poNumber,
  enquiry.selectedRep?.name, enquiry.selectedRep?.code, enquiry.selectedRep?.branchName,
].filter(Boolean).join(' ').toLowerCase();

export function ExpeditorDashboard({ account, enquiries, onAction, canUpdate, serviceMode }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const [openId, setOpenId] = useState(null);
  const active = enquiries.filter(enquiry => !TERMINAL_STATUSES.has(enquiry.trackingStatus));
  const emergency = active.filter(enquiry => enquiry.emergency === 'yes').length;
  const awaitingPo = active.filter(enquiry => !enquiry.poNumber && !enquiry.poFileName).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...enquiries]
      .filter(enquiry => filter === 'all' || (filter === 'active' ? !TERMINAL_STATUSES.has(enquiry.trackingStatus) : enquiry.trackingStatus === filter))
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
        <span className="eyebrow">Internal {serviceMode === 'mock' ? 'test ' : ''}workspace</span>
        <h1 id="expeditor-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>{canUpdate ? 'Orders need an update.' : 'Orders in one clear view.'}</em></h1>
        <p>Search by client, representative, RFQ or PO number. {canUpdate ? 'Only actions allowed for your role and the current stage are shown.' : 'Your role receives a read-only view of its authorised operational scope.'}</p>
        <div className="expeditor-kpis"><span><strong>{active.length}</strong><small>Active</small></span><span><strong>{emergency}</strong><small>Emergency</small></span><span><strong>{awaitingPo}</strong><small>Awaiting PO</small></span></div>
      </header>

      <div className="expeditor-tools">
        <label className="expeditor-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or representative…" /><button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button></label>
        <label className="expeditor-filter"><span>Show</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="active">All active work</option><option value="all">Everything</option>{filterStatuses.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
      </div>

      <div className="expeditor-result-heading"><div><span className="eyebrow">Daily update queue</span><h2>{filtered.length} matching request{filtered.length === 1 ? '' : 's'}</h2></div><small>Oldest updates first</small></div>

      <div className="expeditor-order-list">
        {filtered.map(enquiry => <ExpeditorOrderCard key={enquiry.id} enquiry={enquiry} expanded={openId === enquiry.id} onToggle={() => setOpenId(current => current === enquiry.id ? null : enquiry.id)} onAction={onAction} canUpdate={canUpdate} />)}
        {!filtered.length && <div className="expeditor-empty"><span>✓</span><strong>No matching requests</strong><p>Change the search or filter to view other work.</p></div>}
      </div>

      <p className="tracking-storage-note expeditor-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Same-device testing' : 'Private-cloud workspace'}</strong> {serviceMode === 'mock' ? 'Customer and staff actions share this browser’s local test data. The production API will provide secure multi-device access.' : 'Updates are saved by the company service and access is controlled by staff role.'}</span></p>
    </section>
  );
}

function ExpeditorOrderCard({ enquiry, expanded, onToggle, onAction, canUpdate }) {
  const [selectedAction, setSelectedAction] = useState('');
  const [note, setNote] = useState('');
  const [actionData, setActionData] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const status = statusById(enquiry.trackingStatus, enquiry.workflowType);
  const quantity = (enquiry.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const availableActions = (enquiry.allowedWorkflowActions || []).filter(action => action.action !== 'override_workflow');
  const actionId = availableActions.some(action => action.action === selectedAction) ? selectedAction : availableActions[0]?.action || '';
  const action = availableActions.find(item => item.action === actionId);

  const save = async () => {
    setError('');
    setIsSaving(true);
    try {
      const saved = await onAction(enquiry.id, actionId, note.trim(), actionData, enquiry.workflowType, enquiry.version);
      if (saved) {
        setSelectedAction('');
        setNote('');
        setActionData({});
      }
    } catch (updateError) {
      setError(updateError?.message || 'The workflow action could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className={`expeditor-order-card ${enquiry.emergency === 'yes' ? 'is-emergency' : ''}`}>
      <button type="button" className="expeditor-order-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className="expeditor-order-id"><small>{enquiry.reference}{enquiry.isDemo ? ' · DEMO' : ''}</small><strong>{enquiry.company}</strong><em>{enquiry.contact}</em></span>
        <span className={`tracking-status status-${enquiry.trackingStatus}`}>{status.label}</span>
        <span className="expeditor-order-meta"><b>{enquiry.selectedRep?.name || 'Unassigned rep'}</b><small>{enquiry.selectedRep?.branchName || enquiry.area} · {quantity} unit{quantity === 1 ? '' : 's'}</small></span>
        <span className="expeditor-updated">Last update {formatDate(enquiry.updatedAt || enquiry.createdAt)} <b>{expanded ? '−' : '+'}</b></span>
      </button>

      {expanded && (
        <div className="expeditor-order-detail">
          <div className="expeditor-facts"><span><small>Application</small><strong>{enquiry.application}</strong></span><span><small>PO</small><strong>{enquiry.poNumber || enquiry.poFileName || 'Not supplied'}</strong></span><span><small>Supply</small><strong>{enquiry.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</strong></span><span><small>Contact</small><strong>{enquiry.phone}<br />{enquiry.email}</strong></span></div>
          <div className="expeditor-products">{(enquiry.items || []).map(item => <span key={item.lineId}><img src={item.image} alt="" /><strong>{item.code}</strong><small>{item.name}</small><b>× {item.quantity}</b></span>)}</div>
          {canUpdate && availableActions.length ? <div className="expeditor-update-box">
            <div className="panel-index"><span>↻</span><div><strong>Perform workflow action</strong><small>Only actions permitted for your role and this exact stage are available</small></div></div>
            <label className="form-field"><span>Available action</span><select value={actionId} onChange={event => { setSelectedAction(event.target.value); setActionData({}); }}>{availableActions.map(option => <option key={option.action} value={option.action}>{option.label}{option.toStatus ? ` → ${statusById(option.toStatus, enquiry.workflowType).label}` : ''}</option>)}</select></label>
            <WorkflowActionFields action={action} data={actionData} onChange={setActionData} />
            <label className="form-field"><span>Workflow comment {action?.requiresComment ? <b>Required</b> : <i>Optional</i>}</span><textarea rows="3" value={note} onChange={event => setNote(event.target.value)} placeholder="Add a clear update for the audit history and customer timeline." /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="expeditor-update-actions"><button className="primary-button" type="button" onClick={save} disabled={isSaving || !actionId}>{isSaving ? 'Saving…' : action?.label || 'Save workflow action'} <span>{isSaving ? '•••' : '→'}</span></button></div>
          </div> : <p className="tracking-storage-note expeditor-readonly-note"><span>i</span><span><strong>{canUpdate ? 'No action at this stage' : 'Read-only role'}</strong> {canUpdate ? 'This record must first be completed by the role responsible for its current workflow stage.' : 'Your account may view this record but cannot perform workflow actions.'}</span></p>}
          <div className="expeditor-history"><h3>Recent updates</h3>{[...(enquiry.trackingHistory || [])].reverse().slice(0, 4).map(event => <span key={event.id}><i /><small>{formatDate(event.createdAt)}</small><strong>{statusById(event.toStatus || event.status, event.entityType).label}</strong><p>{event.note}</p></span>)}</div>
        </div>
      )}
    </article>
  );
}

function WorkflowActionFields({ action, data, onChange }) {
  if (!action) return null;
  const set = (key, value) => onChange(current => ({ ...current, [key]: value }));
  if (action.action === 'complete_expediting') {
    return <label className="choice-row"><input type="checkbox" checked={Boolean(data.completionCheckConfirmed)} onChange={event => set('completionCheckConfirmed', event.target.checked)} /><span><strong>Completion checks confirmed</strong><small>Confirm the order is ready to be handed to Dispatch.</small></span></label>;
  }
  if (action.action === 'complete_planning') {
    return <div className="form-grid"><label className="form-field"><span>Internal job number</span><input value={data.internalJobNumber || ''} onChange={event => set('internalJobNumber', event.target.value)} /></label><label className="form-field"><span>Customer PO number</span><input value={data.customerPoNumber || ''} onChange={event => set('customerPoNumber', event.target.value)} /></label></div>;
  }
  if (action.action === 'mark_quoted') {
    return <div className="form-grid"><label className="form-field"><span>Quotation sent at</span><input type="datetime-local" value={data.quotationSentAt || ''} onChange={event => set('quotationSentAt', event.target.value)} /></label><label className="form-field"><span>Quotation reference <i>Optional</i></span><input value={data.quotationReference || ''} onChange={event => set('quotationReference', event.target.value)} /></label></div>;
  }
  if (action.action === 'accept_rfq') {
    return <label className="form-field"><span>Acceptance basis</span><select value={data.acceptanceBasis || ''} onChange={event => set('acceptanceBasis', event.target.value)}><option value="">Select evidence</option><option value="purchase_order">Purchase Order received externally</option><option value="payment">Payment confirmed externally</option><option value="authorised_confirmation">Authorised customer confirmation</option></select></label>;
  }
  if (action.action === 'convert_to_order') {
    return <label className="form-field"><span>Created order identifier</span><input value={data.orderId || ''} onChange={event => set('orderId', event.target.value)} /></label>;
  }
  if (action.action === 'archive_order') {
    return <label className="form-field"><span>Retention policy identifier</span><input value={data.retentionPolicyId || ''} onChange={event => set('retentionPolicyId', event.target.value)} /></label>;
  }
  return null;
}
