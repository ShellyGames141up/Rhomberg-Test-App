import { useEffect, useMemo, useState } from 'react';
import { filterArchiveRecords } from '../domain/retention.js';
import { accountCan, PERMISSIONS } from '../services/contracts.js';

const formatDate = value => value
  ? new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Not recorded';

const downloadBase64Pdf = document => {
  const binary = atob(document.bytesBase64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType || 'application/pdf' }));
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = document.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function ArchivedOrders({ account, archiveActions, serviceMode, onRecordsChanged }) {
  const [records, setRecords] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [holdFilter, setHoldFilter] = useState('all');
  const [openId, setOpenId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canManagePolicy = accountCan(account, PERMISSIONS.MANAGE_RETENTION_POLICY);

  const load = async () => {
    const [nextRecords, nextPolicy] = await Promise.all([
      archiveActions.list(),
      archiveActions.getPolicy(),
    ]);
    setRecords(nextRecords);
    setPolicy(nextPolicy);
  };

  useEffect(() => {
    load().catch(loadError => setError(loadError.message || 'Archive records could not be loaded.'));
  }, []);

  const filtered = useMemo(() => filterArchiveRecords(records, {
    search,
    state: stateFilter,
    legalHold: holdFilter,
  }), [holdFilter, records, search, stateFilter]);

  const run = async (key, operation, successMessage) => {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await operation();
      await load();
      await onRecordsChanged?.();
      setReason('');
      setMessage(successMessage);
    } catch (operationError) {
      setError(operationError.message || 'The retention action could not be completed.');
    } finally {
      setBusy('');
    }
  };

  const savePolicy = event => {
    event.preventDefault();
    run('policy', () => archiveActions.savePolicy(policy), 'Retention settings saved and audited.');
  };

  const exportRecord = async order => {
    setBusy(`export-${order.id}`);
    setError('');
    try {
      const exported = await archiveActions.exportBeforeDeletion(order.id);
      downloadBase64Pdf(exported);
      setMessage(`Protected retention export generated for ${order.reference}.`);
    } catch (exportError) {
      setError(exportError.message || 'The retention export could not be generated.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="app-screen archive-screen" aria-labelledby="archive-title">
      <header className="archive-hero">
        <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}Retention management</span>
        <h1 id="archive-title">Archived orders.<br /><em>Preserved, searchable and controlled.</em></h1>
        <p>Completed orders are marked eligible after the configured threshold. Nothing is automatically deleted, and archived records retain their references, documents, timeline and audit history.</p>
        <div className="archive-kpis">
          <span><strong>{records.filter(item => item.retentionStatus === 'archive_eligible').length}</strong><small>Eligible</small></span>
          <span><strong>{records.filter(item => item.retentionStatus === 'archived').length}</strong><small>Archived</small></span>
          <span><strong>{records.filter(item => item.legalHold?.active).length}</strong><small>Legal hold</small></span>
        </div>
      </header>

      {policy && (
        <form className="retention-policy-card" onSubmit={savePolicy}>
          <div><span className="eyebrow">Current policy</span><h2>{policy.name}</h2><p>{policy.policyNotice}</p></div>
          <div className="retention-policy-grid">
            <label><span>Archive completed orders after days</span><input type="number" min="1" max="3650" disabled={!canManagePolicy} value={policy.archive_completed_orders_after_days} onChange={event => setPolicy(current => ({ ...current, archive_completed_orders_after_days: event.target.value }))} /></label>
            <label><span>Retain archived orders for days</span><input type="number" min="1" max="36500" disabled={!canManagePolicy} value={policy.retain_archived_orders_for_days} onChange={event => setPolicy(current => ({ ...current, retain_archived_orders_for_days: event.target.value }))} /></label>
            <label className="retention-toggle"><input type="checkbox" disabled={!canManagePolicy} checked={policy.allow_permanent_deletion} onChange={event => setPolicy(current => ({ ...current, allow_permanent_deletion: event.target.checked }))} /><span><b>Allow permanent deletion</b><small>Still backend-only; disabled is the safe default</small></span></label>
            <label className="retention-toggle"><input type="checkbox" disabled={!canManagePolicy} checked={policy.deletion_requires_manager_approval} onChange={event => setPolicy(current => ({ ...current, deletion_requires_manager_approval: event.target.checked }))} /><span><b>Require Manager approval</b><small>Independent approval before backend deletion</small></span></label>
            <label className="retention-toggle"><input type="checkbox" disabled={!canManagePolicy} checked={policy.deletion_requires_administrator_approval} onChange={event => setPolicy(current => ({ ...current, deletion_requires_administrator_approval: event.target.checked }))} /><span><b>Require Administrator approval</b><small>Independent approval before backend deletion</small></span></label>
          </div>
          {canManagePolicy && <button className="secondary-button" type="submit" disabled={busy === 'policy'}>{busy === 'policy' ? 'Saving…' : 'Save demonstration settings'}</button>}
        </form>
      )}

      <div className="archive-tools">
        <label><span>Search archive</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Order, RFQ, PO, job, customer or rep…" /></label>
        <label><span>Retention state</span><select value={stateFilter} onChange={event => setStateFilter(event.target.value)}><option value="all">Eligible and archived</option><option value="archive_eligible">Archive eligible</option><option value="archived">Archived</option></select></label>
        <label><span>Legal hold</span><select value={holdFilter} onChange={event => setHoldFilter(event.target.value)}><option value="all">All records</option><option value="held">On legal hold</option><option value="clear">No legal hold</option></select></label>
      </div>

      {(message || error) && <p className={`archive-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}

      <div className="archive-list">
        {filtered.map(order => {
          const expanded = openId === order.id;
          return (
            <article className="archive-card" key={order.id}>
              <button className="archive-card-summary" type="button" onClick={() => { setOpenId(expanded ? '' : order.id); setReason(''); }} aria-expanded={expanded}>
                <span><small>{order.reference}</small><strong>{order.company}</strong><em>{order.contact}</em></span>
                <span><small>RFQ / Job / PO</small><strong>{order.sourceRfqReference || '—'} · {order.internalJobNumber || '—'}</strong><em>{order.customerPoNumber || order.poNumber || 'No PO reference'}</em></span>
                <span className={`archive-state is-${order.retentionStatus}`}>{order.retentionStatus === 'archived' ? 'Archived' : 'Archive eligible'}</span>
                <b>{expanded ? '−' : '+'}</b>
              </button>
              {expanded && (
                <div className="archive-card-detail">
                  <dl>
                    <div><dt>Completed</dt><dd>{formatDate(order.completedAt)}</dd></div>
                    <div><dt>Eligible from</dt><dd>{formatDate(order.archiveEligibleAt)}</dd></div>
                    <div><dt>Archived</dt><dd>{formatDate(order.archivedAt)}</dd></div>
                    <div><dt>Representative</dt><dd>{order.selectedRep?.name || 'Not assigned'}</dd></div>
                  </dl>
                  {order.archiveReason && <p><strong>Archive reason</strong>{order.archiveReason}</p>}
                  {order.legalHold?.active && <p className="legal-hold-banner"><strong>Legal hold / investigation</strong>{order.legalHold.reason}<small>Permanent deletion is blocked.</small></p>}
                  <label className="archive-reason"><span>Reason or comment</span><textarea rows="2" value={reason} onChange={event => setReason(event.target.value)} placeholder="Recorded in the immutable audit history" /></label>
                  <div className="archive-actions">
                    {order.allowedArchiveActions.archive && <button className="primary-button" type="button" disabled={busy} onClick={() => run(`archive-${order.id}`, () => archiveActions.archiveOrder(order.id, { reason }), `${order.reference} moved to the archive.`)}>Archive order</button>}
                    {order.allowedArchiveActions.approve && <button className="secondary-button" type="button" disabled={busy} onClick={() => run(`approve-${order.id}`, () => archiveActions.approveArchival(order.id, { reason }), `${order.reference} archival action approved and audited.`)}>Approve archival</button>}
                    {order.allowedArchiveActions.restore && <button className="secondary-button" type="button" disabled={busy} onClick={() => run(`restore-${order.id}`, () => archiveActions.restoreOrder(order.id, { reason }), `${order.reference} restored to completed-order history.`)}>Restore</button>}
                    {order.allowedArchiveActions.export && <button className="secondary-button" type="button" disabled={busy} onClick={() => exportRecord(order)}>Export retention copy</button>}
                    {order.allowedArchiveActions.legalHold && <button className="secondary-button" type="button" disabled={busy} onClick={() => run(`hold-${order.id}`, () => archiveActions.setLegalHold(order.id, { active: !order.legalHold?.active, reason }), order.legalHold?.active ? 'Legal hold released and audited.' : 'Legal hold applied and audited.')}>{order.legalHold?.active ? 'Release legal hold' : 'Apply legal hold'}</button>}
                  </div>
                  {order.archiveApproval?.approved && <p className="archive-approval-note"><strong>Archival approved</strong>{order.archiveApproval.reason}<small>{formatDate(order.archiveApproval.approvedAt)} · {order.archiveApproval.approvedBy?.displayName}</small></p>}
                </div>
              )}
            </article>
          );
        })}
        {!filtered.length && <div className="archive-empty"><strong>No matching archive records</strong><p>Change the search or filters. Active orders remain in their normal operational queues.</p></div>}
      </div>

      <p className="archive-deletion-notice"><strong>Permanent deletion is disabled.</strong> Use archive, restore, export and legal-hold actions according to your permission.</p>
    </section>
  );
}
