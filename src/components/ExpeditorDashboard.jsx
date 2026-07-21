import { useMemo, useState } from 'react';
import { nextTrackingStatus, statusById, trackingStatuses } from '../domain/tracking.js';

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const searchableText = enquiry => [
  enquiry.reference, enquiry.company, enquiry.contact, enquiry.email, enquiry.poNumber,
  enquiry.selectedRep?.name, enquiry.selectedRep?.code, enquiry.selectedRep?.branchName,
].filter(Boolean).join(' ').toLowerCase();

export function ExpeditorDashboard({ account, enquiries, onUpdate, canUpdate, serviceMode }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const [openId, setOpenId] = useState(null);
  const active = enquiries.filter(enquiry => enquiry.trackingStatus !== 'completed');
  const emergency = active.filter(enquiry => enquiry.emergency === 'yes').length;
  const awaitingPo = active.filter(enquiry => !enquiry.poNumber && !enquiry.poFileName).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...enquiries]
      .filter(enquiry => filter === 'all' || (filter === 'active' ? enquiry.trackingStatus !== 'completed' : enquiry.trackingStatus === filter))
      .filter(enquiry => !term || searchableText(enquiry).includes(term))
      .sort((a, b) => {
        if (a.trackingStatus === 'completed' && b.trackingStatus !== 'completed') return 1;
        if (b.trackingStatus === 'completed' && a.trackingStatus !== 'completed') return -1;
        return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
      });
  }, [enquiries, filter, search]);

  return (
    <section className="app-screen expeditor-screen" aria-labelledby="expeditor-title">
      <header className="expeditor-hero">
        <span className="eyebrow">Internal {serviceMode === 'mock' ? 'test ' : ''}workspace</span>
        <h1 id="expeditor-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>{canUpdate ? 'Orders need an update.' : 'Orders in one clear view.'}</em></h1>
        <p>Search by client, representative, RFQ or PO number. {canUpdate ? 'Active work is arranged with the oldest update first.' : 'Your role receives a read-only view of its authorised operational scope.'}</p>
        <div className="expeditor-kpis"><span><strong>{active.length}</strong><small>Active</small></span><span><strong>{emergency}</strong><small>Emergency</small></span><span><strong>{awaitingPo}</strong><small>Awaiting PO</small></span></div>
      </header>

      <div className="expeditor-tools">
        <label className="expeditor-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or representative…" /><button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button></label>
        <label className="expeditor-filter"><span>Show</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="active">All active work</option><option value="all">Everything</option>{trackingStatuses.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>
      </div>

      <div className="expeditor-result-heading"><div><span className="eyebrow">Daily update queue</span><h2>{filtered.length} matching request{filtered.length === 1 ? '' : 's'}</h2></div><small>Oldest updates first</small></div>

      <div className="expeditor-order-list">
        {filtered.map(enquiry => <ExpeditorOrderCard key={enquiry.id} enquiry={enquiry} account={account} expanded={openId === enquiry.id} onToggle={() => setOpenId(current => current === enquiry.id ? null : enquiry.id)} onUpdate={onUpdate} canUpdate={canUpdate} />)}
        {!filtered.length && <div className="expeditor-empty"><span>✓</span><strong>No matching requests</strong><p>Change the search or filter to view other work.</p></div>}
      </div>

      <p className="tracking-storage-note expeditor-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Same-device testing' : 'Private-cloud workspace'}</strong> {serviceMode === 'mock' ? 'Customer and expeditor updates share this browser’s local test data. The production API will provide secure multi-device access.' : 'Updates are saved by the company service and access is controlled by staff role.'}</span></p>
    </section>
  );
}

function ExpeditorOrderCard({ enquiry, account, expanded, onToggle, onUpdate, canUpdate }) {
  const [selectedStatus, setSelectedStatus] = useState(enquiry.trackingStatus || 'rfq-submitted');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const status = statusById(enquiry.trackingStatus);
  const quantity = (enquiry.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const next = nextTrackingStatus(enquiry.trackingStatus);

  const save = async statusId => {
    setError('');
    setIsSaving(true);
    try {
      const saved = await onUpdate(enquiry.id, statusId, note.trim() || statusById(statusId).description, account.contact);
      if (saved) {
        setSelectedStatus(statusId);
        setNote('');
      }
    } catch (updateError) {
      setError(updateError?.message || 'The order update could not be saved. Please try again.');
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
          {canUpdate ? <div className="expeditor-update-box">
            <div className="panel-index"><span>↻</span><div><strong>Add today’s update</strong><small>The customer will see this status and note in Order Tracking</small></div></div>
            <label className="form-field"><span>New status</span><select value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)}>{trackingStatuses.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label className="form-field"><span>Customer update note <i>Optional</i></span><textarea rows="3" value={note} onChange={event => setNote(event.target.value)} placeholder="Example: Instruments are assembled and moving to calibration." /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="expeditor-update-actions"><button className="secondary-button" type="button" onClick={() => save(next.id)} disabled={isSaving || next.id === enquiry.trackingStatus}>Advance to {next.label}</button><button className="primary-button" type="button" onClick={() => save(selectedStatus)} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save update'} <span>{isSaving ? '•••' : '→'}</span></button></div>
          </div> : <p className="tracking-storage-note expeditor-readonly-note"><span>i</span><span><strong>Read-only role</strong> Your account may view this record but cannot publish customer tracking updates.</span></p>}
          <div className="expeditor-history"><h3>Recent updates</h3>{[...(enquiry.trackingHistory || [])].reverse().slice(0, 4).map(event => <span key={event.id}><i /><small>{formatDate(event.createdAt)}</small><strong>{statusById(event.status).label}</strong><p>{event.note}</p></span>)}</div>
        </div>
      )}
    </article>
  );
}
