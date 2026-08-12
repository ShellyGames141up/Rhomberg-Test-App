import { useMemo, useState } from 'react';

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const humanise = value => String(value || 'Not recorded').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

export function AuditTrail({ events, serviceMode }) {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter(event => (
      (entityType === 'all' || event.entityType === entityType)
      && (outcome === 'all' || event.outcome === outcome)
      && (!term || [
        event.eventType,
        event.action,
        event.reference,
        event.company?.name,
        event.actingUser?.displayName,
        event.requestId,
        event.correlationId,
      ].some(value => String(value || '').toLowerCase().includes(term)))
    ));
  }, [entityType, events, outcome, search]);
  const deniedCount = events.filter(event => event.outcome === 'denied').length;
  const overrideCount = events.filter(event => event.override?.used).length;

  return (
    <section className="app-screen audit-screen" aria-labelledby="audit-title">
      <header className="audit-hero">
        <div>
          <span className="eyebrow">Manager and administrator oversight</span>
          <h1 id="audit-title">Immutable audit<br /><em>history.</em></h1>
          <p>Workflow, notification and security events are recorded separately from the customer-visible order timeline. Corrections create new events; existing entries cannot be edited here.</p>
        </div>
        <div className="audit-kpis">
          <span><strong>{events.length}</strong><small>Total events</small></span>
          <span><strong>{deniedCount}</strong><small>Denied</small></span>
          <span><strong>{overrideCount}</strong><small>Overrides</small></span>
        </div>
      </header>

      <div className="audit-toolbar">
        <label className="audit-search"><span>Search audit history</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Reference, company, user, request ID…" /></label>
        <label><span>Record type</span><select value={entityType} onChange={event => setEntityType(event.target.value)}><option value="all">All records</option><option value="rfq">RFQs</option><option value="order">Orders</option></select></label>
        <label><span>Outcome</span><select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="all">All outcomes</option><option value="success">Success</option><option value="denied">Denied</option><option value="failed">Failed</option><option value="idempotent_replay">Idempotent replay</option></select></label>
      </div>

      <div className="audit-result-heading">
        <div><span className="eyebrow">Append-only event stream</span><h2>{filtered.length} matching event{filtered.length === 1 ? '' : 's'}</h2></div>
        <p><span aria-hidden="true">🔒</span> Read-only</p>
      </div>

      <div className="audit-list">
        {filtered.map(event => <AuditEvent key={event.id} event={event} />)}
        {!filtered.length && <div className="audit-empty"><strong>No audit events match these filters</strong><p>Clear the search or choose a broader record type and outcome.</p></div>}
      </div>

    </section>
  );
}

function AuditEvent({ event }) {
  const notifications = event.notificationResults || [];
  const documents = event.documentMetadata || [];
  return (
    <details className={`audit-event audit-${event.outcome || 'unknown'}`}>
      <summary>
        <span className="audit-event-type">{humanise(event.eventType)}</span>
        <span><small>{event.reference || event.entityId}</small><strong>{humanise(event.previousStatus)} → {humanise(event.newStatus)}</strong></span>
        <span><small>{event.company?.name || event.company?.id || 'System scope'}</small><strong>{event.actingUser?.displayName || 'Workflow service'} · {humanise(event.actingRole)}</strong></span>
        <span><small>{formatDate(event.timestamp || event.createdAt)}</small><b>{humanise(event.outcome)}</b></span>
      </summary>
      <div className="audit-event-detail">
        <dl>
          <div><dt>Request ID</dt><dd>{event.requestId}</dd></div>
          <div><dt>Correlation ID</dt><dd>{event.correlationId}</dd></div>
          <div><dt>Entity</dt><dd>{humanise(event.entityType)} · {event.entityId}</dd></div>
          <div><dt>Override</dt><dd>{event.override?.used ? `Yes — ${event.override.reason || 'No reason recorded'}` : 'No'}</dd></div>
        </dl>
        <section><h3>Fields changed</h3><div className="audit-tags">{event.fieldsChanged?.length ? event.fieldsChanged.map(field => <span key={field}>{field}</span>) : <em>No persisted fields changed</em>}</div></section>
        <section><h3>Reason or comment</h3><p>{event.reason || 'No comment recorded.'}</p></section>
        <section><h3>Notification results</h3>{notifications.length ? <div className="audit-tags">{notifications.map((result, index) => <span key={`${result.channel || result}-${index}`}>{typeof result === 'string' ? result : `${result.channel}: ${result.status}`}</span>)}</div> : <p>No notification delivery was associated with this event.</p>}</section>
        <section><h3>Document metadata</h3>{documents.length ? <ul>{documents.map((document, index) => <li key={document.id || `${document.fileName}-${index}`}><strong>{document.fileName || document.reference || document.kind}</strong><small>{document.kind} · {document.mimeType || 'type not recorded'} · {document.sizeBytes || 0} bytes</small></li>)}</ul> : <p>No document metadata was associated with this event.</p>}</section>
      </div>
    </details>
  );
}
