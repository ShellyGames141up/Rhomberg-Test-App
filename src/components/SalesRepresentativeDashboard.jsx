import { useMemo, useState } from 'react';
import { roleProfileFor } from '../domain/accessControl.js';
import {
  filterRepresentativeRfqs,
  lastRfqActivityAt,
  REPRESENTATIVE_RFQ_GROUPS,
  representativeInboxCounts,
  representativeRfqPriority,
  rfqAgeLabel,
} from '../domain/rfqInbox.js';
import { statusById } from '../domain/tracking.js';
import { WorkflowActionPanel } from './WorkflowActionPanel.jsx';

const formatDate = value => value ? new Date(value).toLocaleString('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}) : 'Not recorded';

export function SalesRepresentativeDashboard({ account, rfqs, onAction, serviceMode }) {
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [priority, setPriority] = useState('all');
  const [openId, setOpenId] = useState(null);
  const counts = useMemo(() => representativeInboxCounts(rfqs), [rfqs]);
  const filtered = useMemo(
    () => filterRepresentativeRfqs(rfqs, { search, group, priority }),
    [group, priority, rfqs, search],
  );
  const urgentCount = rfqs.filter(rfq => representativeRfqPriority(rfq) === 'urgent').length;
  const copy = roleProfileFor(account.role).dashboard;

  return (
    <section className="app-screen sales-inbox-screen" aria-labelledby="sales-inbox-title">
      <header className="expeditor-hero sales-inbox-hero">
        <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}{copy.eyebrow}</span>
        <h1 id="sales-inbox-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>{copy.headline}</em></h1>
        <p>{copy.description}</p>
        <div className="expeditor-kpis">
          <span><strong>{counts.new || 0}</strong><small>New RFQs</small></span>
          <span><strong>{counts.under_review || 0}</strong><small>Under review</small></span>
          <span><strong>{urgentCount}</strong><small>Emergency</small></span>
        </div>
      </header>

      <nav className="sales-inbox-groups" aria-label="RFQ inbox groups">
        {REPRESENTATIVE_RFQ_GROUPS.map(item => (
          <button type="button" key={item.id} aria-pressed={group === item.id} className={group === item.id ? 'is-active' : ''} onClick={() => setGroup(item.id)}>
            <strong>{counts[item.id] || 0}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="expeditor-tools sales-inbox-tools">
        <label className="expeditor-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reference, company or customer…" /><button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button></label>
        <label className="expeditor-filter"><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option><option value="urgent">Emergency</option><option value="standard">Standard</option></select></label>
      </div>

      <div className="expeditor-result-heading"><div><span className="eyebrow">Representative inbox</span><h2>{filtered.length} matching RFQ{filtered.length === 1 ? '' : 's'}</h2></div><small>Emergency first · oldest next</small></div>

      <div className="sales-rfq-list">
        {filtered.map(rfq => (
          <SalesRfqCard
            key={rfq.id}
            rfq={rfq}
            expanded={openId === rfq.id}
            onToggle={() => setOpenId(current => current === rfq.id ? null : rfq.id)}
            onAction={onAction}
          />
        ))}
        {!filtered.length && <div className="expeditor-empty"><span>✓</span><strong>No RFQs match this view</strong><p>Try another inbox group, priority or search term.</p></div>}
      </div>

      <p className="tracking-storage-note expeditor-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Same-device representative inbox' : 'Private-cloud representative inbox'}</strong> {serviceMode === 'mock' ? 'Customer submissions and representative actions share this browser’s demo service data.' : 'RFQs are supplied by the secured company API and limited to your representative assignment.'}</span></p>
    </section>
  );
}

function SalesRfqCard({ rfq, expanded, onToggle, onAction }) {
  const status = statusById(rfq.trackingStatus, 'rfq');
  const priority = representativeRfqPriority(rfq);
  const quantity = (rfq.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const actions = (rfq.allowedWorkflowActions || []).filter(action => action.action !== 'override_workflow');
  const documents = rfq.documents || [];

  return (
    <article className={`sales-rfq-card ${priority === 'urgent' ? 'is-emergency' : ''}`}>
      <div className="sales-rfq-summary">
        <div className="sales-rfq-reference"><small>{rfq.reference}{rfq.isDemo ? ' · DEMO' : ''}</small><strong>{rfq.company}</strong><span>{rfq.contact}</span></div>
        <span className={`tracking-status status-${rfq.trackingStatus}`}>{status.label}</span>
        <div className="sales-rfq-flags">
          <span className={`sales-priority priority-${priority}`}>{priority === 'urgent' ? 'Emergency' : 'Standard'}</span>
          <span>{rfqAgeLabel(rfq)}</span>
          <span>{quantity} unit{quantity === 1 ? '' : 's'}</span>
        </div>
        <div className="sales-rfq-activity"><span>Last activity</span><strong>{formatDate(lastRfqActivityAt(rfq))}</strong></div>
        <button type="button" className="sales-rfq-open" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Close RFQ' : 'Open RFQ'} <span>{expanded ? '−' : '→'}</span></button>
      </div>

      {expanded && (
        <div className="expeditor-order-detail sales-rfq-detail">
          <div className="expeditor-facts">
            <span><small>Application</small><strong>{rfq.application}</strong></span>
            <span><small>Customer contact</small><strong>{rfq.contact}<br />{rfq.email}<br />{rfq.phone}</strong></span>
            <span><small>Submitted</small><strong>{formatDate(rfq.submittedAt || rfq.createdAt)}</strong></span>
            <span><small>Supply</small><strong>{rfq.fulfilment === 'collect' ? `Collection · ${rfq.collectionBranch || rfq.area}` : `Delivery · ${rfq.deliveryAddress || rfq.area}`}</strong></span>
            <span><small>Purchase Order</small><strong>{rfq.poNumber || rfq.poFileName || 'Not supplied'}</strong></span>
            <span><small>Assigned representative</small><strong>{rfq.selectedRep?.name || 'Unassigned'}<br />{rfq.selectedRep?.branchName || rfq.area}</strong></span>
          </div>
          {(rfq.customerNotes || rfq.notes) && <p className="sales-customer-notes"><span>Customer notes</span>{rfq.customerNotes || rfq.notes}</p>}
          {documents.length > 0 && <div className="sales-document-list"><strong>Uploaded document metadata</strong>{documents.map(document => <span key={document.id}><b>{document.fileName || document.originalName}</b><small>{document.mimeType || document.mediaType || 'File'} · {Math.ceil(Number(document.sizeBytes || 0) / 1024)} KB</small></span>)}</div>}
          {rfq.quotation && <RepresentativeQuotationSummary rfq={rfq} />}
          {rfq.acceptance && <RepresentativeAcceptanceSummary rfq={rfq} />}
          <div className="expeditor-products">{(rfq.items || []).map(item => <span key={item.lineId}><img src={item.image} alt="" /><strong>{item.code}</strong><small>{item.name}</small><b>× {item.quantity}</b></span>)}</div>
          {actions.length
            ? <WorkflowActionPanel record={rfq} actions={actions} onAction={onAction} title="RFQ actions" description="Actions are controlled by assignment, role and current RFQ stage" preferredAction="start_rep_review" />
            : <p className="tracking-storage-note expeditor-readonly-note"><span>i</span><span><strong>No action at this stage</strong> This RFQ is retained in your inbox for reference and follow-up.</span></p>}
          <div className="expeditor-history"><h3>Recent activity</h3>{[...(rfq.trackingHistory || [])].reverse().slice(0, 5).map(event => <span key={event.id}><i /><small>{formatDate(event.createdAt)}</small><strong>{statusById(event.toStatus || event.status, event.entityType).label}</strong><p>{event.note}</p></span>)}</div>
        </div>
      )}
    </article>
  );
}

function RepresentativeQuotationSummary({ rfq }) {
  const quotation = rfq.quotation;
  const formatDateOnly = value => value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not applicable';
  return (
    <section className="representative-quotation-summary" aria-label="Recorded quotation">
      <div className="panel-index"><span>Q</span><div><strong>Recorded quotation</strong><small>External Outlook quotation metadata · no pricing stored</small></div></div>
      <dl>
        <div><dt>Quotation number</dt><dd>{quotation.number}</dd></div>
        <div><dt>Quotation date</dt><dd>{formatDateOnly(quotation.date)}</dd></div>
        <div><dt>Expiry</dt><dd>{quotation.expiryMode === 'dated' ? formatDateOnly(quotation.expiryDate) : 'No stated expiry'}</dd></div>
        <div><dt>Email confirmation</dt><dd>{quotation.emailed ? 'Confirmed' : 'Not recorded'}</dd></div>
        <div><dt>Marked by</dt><dd>{rfq.quotedBy?.displayName || rfq.selectedRep?.name || 'Authorised representative'}</dd></div>
        <div><dt>Marked at</dt><dd>{formatDate(rfq.quotedAt)}</dd></div>
      </dl>
      {quotation.internalNote && <p><strong>Internal note</strong>{quotation.internalNote}</p>}
      {quotation.customerNote && <p><strong>Customer-facing note</strong>{quotation.customerNote}</p>}
      {(quotation.documentReference || quotation.document) && <p><strong>Document evidence</strong>{quotation.document?.fileName || quotation.documentReference}<small>{quotation.documentCustomerVisible ? 'Authorised for customer visibility' : 'Internal only'}</small></p>}
    </section>
  );
}

function RepresentativeAcceptanceSummary({ rfq }) {
  const acceptance = rfq.acceptance;
  const labels = {
    purchase_order_received: 'Purchase Order received',
    payment_confirmed: 'Payment confirmed externally',
    written_acceptance_received: 'Written acceptance received',
    account_customer_authorisation: 'Account-customer authorisation',
    other: 'Other approved instruction',
  };
  const date = acceptance.date
    ? new Date(`${acceptance.date}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not recorded';
  return (
    <section className="representative-quotation-summary representative-acceptance-summary" aria-label="Verified order acceptance">
      <div className="panel-index"><span>✓</span><div><strong>Verified order acceptance</strong><small>External evidence metadata · no payment processing or pricing</small></div></div>
      <dl>
        <div><dt>Acceptance type</dt><dd>{labels[acceptance.type] || acceptance.type}</dd></div>
        <div><dt>Acceptance date</dt><dd>{date}</dd></div>
        <div><dt>Purchase Order</dt><dd>{acceptance.purchaseOrderNumber || 'Not supplied'}</dd></div>
        <div><dt>Payment reference</dt><dd>{acceptance.paymentReference || 'Not applicable'}</dd></div>
        <div><dt>Accepted by</dt><dd>{rfq.acceptedBy?.displayName || rfq.selectedRep?.name || 'Assigned representative'}</dd></div>
        <div><dt>Created order</dt><dd>{rfq.orderReference || 'Order reference pending'}</dd></div>
      </dl>
      <p><strong>Internal verification note</strong>{acceptance.internalNote}</p>
      {(acceptance.documentReference || acceptance.document) && <p><strong>Supporting evidence</strong>{acceptance.document?.fileName || acceptance.documentReference}<small>Internal metadata only</small></p>}
    </section>
  );
}
