import { useMemo, useState } from 'react';
import { friendlyServiceError, USER_ROLES } from '../services/contracts.js';

const PLANNING_STATUSES = new Set(['awaiting_planning', 'planning_in_progress', 'planned']);
const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export function RecordsControlDock({ account, enquiries, orders, actions, onRecordsChanged }) {
  const isAdministrator = [account.role, ...(account.roles || [])].includes(USER_ROLES.ADMINISTRATOR);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const records = useMemo(() => {
    const available = isAdministrator
      ? [...enquiries.map(record => ({ ...record, entityType: 'rfq' })), ...orders.map(record => ({ ...record, entityType: 'order' }))]
      : orders.filter(record => PLANNING_STATUSES.has(record.trackingStatus)).map(record => ({ ...record, entityType: 'order' }));
    const term = query.trim().toLowerCase();
    return available.filter(record => (type === 'all' || record.entityType === type)
      && (!term || [record.reference, record.company, record.contact, record.trackingStatus].some(value => String(value || '').toLowerCase().includes(term))))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }, [enquiries, orders, isAdministrator, query, type]);

  const remove = async () => {
    if (!target || reason.trim().length < 8) {
      setError('Enter a clear deletion reason of at least 8 characters.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      await actions.deleteRecord(target.entityType, target.id, { reason: reason.trim() });
      setMessage(`${target.reference} was removed from active workspaces. Audit history and linked evidence were preserved.`);
      setTarget(null); setReason('');
      await onRecordsChanged?.();
    } catch (caught) {
      setError(friendlyServiceError(caught, 'The record could not be removed.'));
    } finally { setBusy(false); }
  };

  return <section className="app-screen operations-desktop records-control-screen" aria-labelledby="records-control-title">
    <header className="operations-hero"><div><span className="eyebrow">Controlled record administration</span><h1 id="records-control-title">Records.<br /><em>Safe, audited removal.</em></h1><p>{isAdministrator ? 'Review active RFQs and orders before removing them from operational workspaces.' : 'Planning may remove only orders that are still in the Planning queue.'}</p></div><div className="operations-owner"><span>{account.contact}</span><small>{isAdministrator ? 'Administrator' : 'Planning'} · Internal desktop</small></div></header>
    {(error || message) && <p className={`operations-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
    <div className="records-control-toolbar">
      <label><span>Search records</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Reference, company, contact or status…" /></label>
      <label><span>Record type</span><select value={type} onChange={event => setType(event.target.value)}><option value="all">All available records</option>{isAdministrator && <option value="rfq">RFQs</option>}<option value="order">Orders</option></select></label>
    </div>
    <div className="records-control-list">
      {records.map(record => <article key={`${record.entityType}-${record.id}`} className="records-control-card"><div><span className="eyebrow">{humanise(record.entityType)} · {humanise(record.trackingStatus)}</span><h2>{record.reference}</h2><p>{record.company || 'Company unavailable'}{record.contact ? ` · ${record.contact}` : ''}</p></div><button type="button" className="secondary-button danger-text" onClick={() => { setTarget(record); setReason(''); setError(''); }}>Remove from active records</button></article>)}
      {!records.length && <div className="operations-empty"><strong>No matching records</strong><p>Change the search or record-type filter.</p></div>}
    </div>
    {target && <div className="records-control-confirmation" role="dialog" aria-modal="true" aria-labelledby="record-delete-title"><div><span className="eyebrow">Confirmation required</span><h2 id="record-delete-title">Remove {target.reference}?</h2><p>This is a soft deletion. The record leaves active queues, while documents and immutable audit history remain preserved.</p><label><span>Reason for removal</span><textarea value={reason} onChange={event => setReason(event.target.value)} rows="4" autoFocus /></label><div className="administrator-action-row"><button type="button" className="primary-button" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Confirm audited removal'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setTarget(null); setReason(''); }}>Cancel</button></div></div></div>}
  </section>;
}
