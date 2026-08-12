import { useEffect, useMemo, useState } from 'react';
import {
  DISPATCH_QUEUE_FILTERS,
  DISPATCH_SORT_OPTIONS,
  dispatchLastActivityAt,
  dispatchMethodById,
  dispatchOrderAgeLabel,
  dispatchOrderPriority,
  dispatchProofTypeById,
  dispatchQueueCounts,
  dispatchReceivedAt,
  filterDispatchOrders,
} from '../domain/dispatch.js';
import { statusById } from '../domain/tracking.js';
import { OrderSummaryPanel } from './OrderSummaryPanel.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { WorkflowActionPanel } from './WorkflowActionPanel.jsx';

const formatDateTime = value => {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = value => {
  if (!value) return 'Not recorded';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const titleCase = value => String(value || '')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, character => character.toUpperCase());

const actionFor = (order, actionId) => (
  (order.allowedWorkflowActions || []).find(action => action.action === actionId)
);

const primaryActionFor = order => {
  const actionByStatus = {
    awaiting_lab_receipt_dispatch: 'confirm_lab_receipt_dispatch',
    awaiting_dispatch: order.dispatch?.receivedAt
      ? (order.fulfilment === 'collect' ? 'mark_ready_for_collection' : 'start_delivery')
      : 'confirm_dispatch_receipt',
    ready_for_collection: 'confirm_collection',
    out_for_delivery: 'confirm_delivery',
    delivered: 'complete_delivery',
    collected: 'complete_collection',
    on_hold: 'resume_order',
  };
  return actionFor(order, actionByStatus[order.trackingStatus]);
};

export function DispatchDashboard({
  account,
  orders,
  onAction,
  serviceMode,
  dispatchOptions,
  focusRecordId = '',
  documentActions,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('received_oldest');
  const [openId, setOpenId] = useState(null);
  const counts = useMemo(() => dispatchQueueCounts(orders), [orders]);
  const filtered = useMemo(
    () => filterDispatchOrders(orders, { search, filter, sort }),
    [filter, orders, search, sort],
  );

  useEffect(() => {
    if (!focusRecordId || !orders.some(order => order.id === focusRecordId)) return;
    setFilter('all');
    setOpenId(focusRecordId);
    const timer = window.setTimeout(
      () => document.getElementById(`dispatch-order-${focusRecordId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50,
    );
    return () => window.clearTimeout(timer);
  }, [focusRecordId, orders]);

  return (
    <section className="app-screen dispatch-screen" aria-labelledby="dispatch-title">
      <header className="dispatch-hero">
        <div className="dispatch-hero-copy">
          <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}Dispatch workspace</span>
          <h1 id="dispatch-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>Complete every handover clearly.</em></h1>
          <p>Release prepared orders, record collection or delivery evidence, and keep customers and representatives informed without exposing internal Dispatch notes.</p>
        </div>
        <div className="dispatch-kpi-grid" aria-label="Dispatch queue summary">
          <span className="is-total"><small>Dispatch work</small><strong>{counts.all}</strong><em>open handovers</em></span>
          <span><small>Awaiting</small><strong>{counts.awaitingDispatch}</strong><em>needs release</em></span>
          <span><small>From Lab</small><strong>{counts.laboratoryReceipt}</strong><em>confirm receipt</em></span>
          <span><small>Collection</small><strong>{counts.collection}</strong><em>customer pickup</em></span>
          <span><small>Delivery</small><strong>{counts.delivery}</strong><em>outbound supply</em></span>
          <span className={counts.emergency ? 'is-alert' : ''}><small>Emergency</small><strong>{counts.emergency}</strong><em>priority handover</em></span>
        </div>
      </header>

      <div className="dispatch-toolbar">
        <label className="dispatch-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search order, job, PO, customer, rep or tracking reference…"
          />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear Dispatch search">×</button>}
        </label>
        <label><span>Queue</span><select value={filter} onChange={event => setFilter(event.target.value)}>{DISPATCH_QUEUE_FILTERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)}>{DISPATCH_SORT_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>

      <div className="dispatch-result-heading">
        <div><span className="eyebrow">Controlled Dispatch queue</span><h2>{filtered.length} matching order{filtered.length === 1 ? '' : 's'}</h2></div>
        <p><span className="dispatch-live-dot" /> {serviceMode === 'mock' ? 'Current browser test data' : 'Private-cloud operational data'}</p>
      </div>

      <div className="dispatch-table" role="table" aria-label="Dispatch orders">
        <div className="dispatch-table-head" role="row">
          <span role="columnheader">Order / job</span>
          <span role="columnheader">Customer</span>
          <span role="columnheader">Representative</span>
          <span role="columnheader">Handover</span>
          <span role="columnheader">Packages</span>
          <span role="columnheader">Stage</span>
          <span role="columnheader">Received</span>
          <span role="columnheader">Action</span>
        </div>
        {filtered.map(order => (
          <DispatchOrder
            key={order.id}
            order={order}
            expanded={openId === order.id}
            onToggle={() => setOpenId(current => current === order.id ? null : order.id)}
            onAction={onAction}
            account={account}
            dispatchOptions={dispatchOptions}
            documentActions={documentActions}
            serviceMode={serviceMode}
          />
        ))}
        {!filtered.length && (
          <div className="dispatch-empty">
            <span>✓</span>
            <strong>No Dispatch orders match these filters</strong>
            <p>Clear the search or choose a different queue.</p>
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); setSort('received_oldest'); }}>Reset filters</button>
          </div>
        )}
      </div>

      <p className="tracking-storage-note dispatch-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Dispatch preview mode.' : 'Private-cloud Dispatch workspace.'}</strong> {serviceMode === 'mock' ? 'Actions persist in this browser through the shared service layer. Proof files are represented by safe metadata only; do not enter real customer information.' : 'Dispatch actions are protected by role, workflow, audit and server-side data controls.'}</span></p>
    </section>
  );
}

function DispatchOrder({ order, expanded, onToggle, onAction, account, dispatchOptions, documentActions, serviceMode }) {
  const dispatch = order.dispatch || {};
  const stage = statusById(order.trackingStatus, 'order');
  const priority = dispatchOrderPriority(order);
  const primaryAction = primaryActionFor(order);
  const problemAction = actionFor(order, 'report_delivery_problem');
  const holdAction = actionFor(order, 'place_on_hold');
  const method = dispatchMethodById(dispatch.method);
  const lineItems = (order.items || []).length;
  const jobNumber = order.planning?.internalJobNumber || order.internalJobNumber || '';
  const customerPo = order.planning?.customerPoNumber || order.customerPoNumber || order.poNumber || '';
  const salesOrderNumber = order.planning?.salesOrderNumber || order.salesOrderNumber || '';
  const updates = [...(dispatch.updates || [])].reverse();
  const address = order.fulfilment === 'delivery'
    ? order.deliveryAddress
    : order.collectionBranch;

  return (
    <article
      className={`dispatch-order ${expanded ? 'is-open' : ''} ${priority === 'urgent' ? 'is-emergency' : ''}`}
      role="rowgroup"
      id={`dispatch-order-${order.id}`}
    >
      <div className="dispatch-order-row" role="row">
        <span className="dispatch-order-reference" role="cell" data-label="Order / job"><strong>{order.reference}</strong><small>{jobNumber || 'Job number pending'} · {dispatchOrderAgeLabel(order)}</small></span>
        <span role="cell" data-label="Customer"><strong>{order.company}</strong><small>{order.contact}</small></span>
        <span role="cell" data-label="Representative"><strong>{order.selectedRep?.name || 'Unassigned'}</strong><small>{order.selectedRep?.branchName || order.area || 'No branch'}</small></span>
        <span role="cell" data-label="Handover"><i className={`dispatch-method method-${dispatch.method || order.fulfilment}`}>{dispatch.method ? method.label : order.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</i><small>{dispatch.trackingReference || customerPo || 'No tracking reference'}</small></span>
        <span role="cell" data-label="Packages"><strong>{dispatch.numberOfPackages || '—'}</strong><small>{dispatch.numberOfPackages ? `${dispatch.numberOfPackages} package${dispatch.numberOfPackages === 1 ? '' : 's'}` : 'Not packed'}</small></span>
        <span role="cell" data-label="Stage"><StatusBadge as="i" status={order.trackingStatus} label={stage.label} className="tracking-status" />{priority === 'urgent' && <small className="dispatch-emergency">Urgent</small>}</span>
        <span role="cell" data-label="Received"><strong>{dispatch.receivedAt ? formatDateTime(dispatchReceivedAt(order)) : 'Awaiting confirmation'}</strong><small>Updated {formatDateTime(dispatchLastActivityAt(order))}</small></span>
        <span className="dispatch-open-cell" role="cell" data-label="Action"><button type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Close' : 'Open order'} <b>{expanded ? '−' : '→'}</b></button></span>
      </div>

      {expanded && (
        <div className="dispatch-order-detail">
          <header className="dispatch-detail-heading">
            <div><span className="eyebrow">Dispatch order</span><h3>{order.reference} · {order.company}</h3><p>{order.application || 'No application description recorded.'}</p></div>
            <div className="dispatch-detail-badges"><span>{titleCase(priority)} priority</span><span>{lineItems} line item{lineItems === 1 ? '' : 's'}</span>{priority === 'urgent' && <span className="is-emergency">Urgent</span>}</div>
          </header>

          <div className="dispatch-detail-grid">
            <section className="dispatch-detail-card is-customer"><span>01</span><div><small>Customer contact</small><strong>{order.contact}</strong><p>{order.company}<br />{order.phone}<br />{order.email}</p></div></section>
            <section className="dispatch-detail-card is-address"><span>02</span><div><small>{order.fulfilment === 'delivery' ? 'Authorised delivery address' : 'Collection branch'}</small><strong>{order.fulfilment === 'delivery' ? 'Delivery' : 'Collection'}</strong><p>{address || 'No authorised handover address is recorded.'}</p></div></section>
            <section className="dispatch-detail-card is-sales"><span>03</span><div><small>Assigned representative</small><strong>{order.selectedRep?.name || 'Not assigned'}</strong><p>{order.selectedRep?.code || 'No rep code'}<br />{order.selectedRep?.branchName || order.area}</p></div></section>
            <section className="dispatch-detail-card is-references"><span>04</span><div><small>Order references</small><strong>{jobNumber || 'No job number'}</strong><p>Sales Order: {salesOrderNumber || 'Not recorded'}<br />Customer PO: {customerPo || 'Not recorded'}<br />RFQ: {order.sourceRfqReference || 'Not linked'}</p></div></section>
          </div>

          <section className="dispatch-package-section">
            <div className="planning-section-heading"><div><span className="eyebrow">Package and handover detail</span><h3>{dispatch.numberOfPackages || 0} package{dispatch.numberOfPackages === 1 ? '' : 's'} recorded</h3></div><small>Authorised Dispatch staff</small></div>
            <div className="dispatch-saved-grid">
              <span><small>Dispatch method</small><strong>{dispatch.method ? method.label : 'Not selected'}</strong></span>
              <span><small>Ready date</small><strong>{formatDate(dispatch.readyDate)}</strong></span>
              <span><small>Courier / driver</small><strong>{dispatch.courierOrDriver || 'Not recorded'}</strong></span>
              <span><small>Tracking reference</small><strong>{dispatch.trackingReference || 'Not recorded'}</strong></span>
              <span><small>Delivery note</small><strong>{dispatch.deliveryNoteNumber || 'Not recorded'}</strong></span>
              <span><small>Recipient / collector</small><strong>{dispatch.recipientName || 'Not recorded'}</strong></span>
            </div>
            {dispatch.internalNotes && <p className="dispatch-internal-note"><strong>Internal Dispatch note</strong><span>{dispatch.internalNotes}</span><small>Restricted to authorised internal users. Never included in the customer projection.</small></p>}
          </section>

          <section className="dispatch-products-section">
            <div className="planning-section-heading"><div><span className="eyebrow">Configured units</span><h3>{lineItems} immutable line item{lineItems === 1 ? '' : 's'}</h3></div><small>Order snapshot</small></div>
            <div className="dispatch-product-grid">{(order.items || []).map(item => <span key={item.lineId || `${item.productId}-${item.code}`}><img src={item.image} alt="" /><i>{item.code}</i><strong>{item.name}</strong><small>Quantity {item.quantity || 1}</small></span>)}</div>
          </section>

          {documentActions && <OrderSummaryPanel order={order} serviceMode={serviceMode} {...documentActions} />}

          {primaryAction && (
            <WorkflowActionPanel
              record={order}
              actions={[primaryAction]}
              preferredAction={primaryAction.action}
              onAction={onAction}
              account={account}
              dispatchOptions={dispatchOptions}
              title={primaryAction.label}
              description="Complete the controlled handover detail and create the required notifications and audit record"
            />
          )}

          {(problemAction || holdAction) && (
            <div className="dispatch-secondary-actions">
              {problemAction && (
                <details>
                  <summary>Report a delivery problem <span>!</span></summary>
                  <WorkflowActionPanel
                    record={order}
                    actions={[problemAction]}
                    preferredAction="report_delivery_problem"
                    onAction={onAction}
                    account={account}
                    dispatchOptions={dispatchOptions}
                    title="Report delivery problem"
                    description="Keep the order out for delivery while recording the issue and notifying the customer and representative"
                  />
                </details>
              )}
              {holdAction && (
                <details>
                  <summary>Put this handover on hold <span>!</span></summary>
                  <WorkflowActionPanel
                    record={order}
                    actions={[holdAction]}
                    preferredAction="place_on_hold"
                    onAction={onAction}
                    account={account}
                    dispatchOptions={dispatchOptions}
                    title="Place order on hold"
                    description="Pause the controlled workflow and record a required audit comment"
                  />
                </details>
              )}
            </div>
          )}

          {!primaryAction && !problemAction && !holdAction && (
            <p className="tracking-storage-note dispatch-readonly-note"><span>i</span><span><strong>No Dispatch action is available.</strong> The order may already be complete or require another authorised workflow role.</span></p>
          )}

          <section className="dispatch-update-history">
            <div className="planning-section-heading"><div><span className="eyebrow">Dispatch history</span><h3>Handover updates</h3></div><small>Newest first</small></div>
            {updates.length ? (
              <div>
                {updates.map(update => (
                  <article key={update.id}>
                    <span className="dispatch-history-marker" />
                    <header><strong>{titleCase(update.action)}</strong><small>{formatDateTime(update.createdAt)} · {update.updatedBy?.displayName || 'Dispatch'}</small></header>
                    <p className="is-customer"><b>Customer update</b>{update.customerMessage}</p>
                    {update.internalNotes && <p className="is-internal"><b>Internal note</b>{update.internalNotes}</p>}
                    <footer>
                      {update.numberOfPackages > 0 && <span>{update.numberOfPackages} package{update.numberOfPackages === 1 ? '' : 's'}</span>}
                      {update.courierOrDriver && <span>{update.courierOrDriver}</span>}
                      {update.trackingReference && <span>Tracking: {update.trackingReference}</span>}
                      {update.recipientName && <span>Recipient: {update.recipientName}</span>}
                      {update.problemReason && <span className="is-problem">Problem: {update.problemReason}</span>}
                    </footer>
                    {update.proofOfDelivery && <p className="dispatch-proof-summary"><b>{dispatchProofTypeById(update.proofOfDelivery.type).label}</b>{update.proofOfDelivery.reference || update.proofOfDelivery.fileName || 'Metadata recorded'}</p>}
                  </article>
                ))}
              </div>
            ) : <p className="dispatch-no-updates">No structured Dispatch update has been recorded yet.</p>}
          </section>

          <section className="planning-history dispatch-audit-history">
            <div className="planning-section-heading"><div><span className="eyebrow">Audit trail</span><h3>Recent workflow activity</h3></div><small>Newest first</small></div>
            <div>{[...(order.trackingHistory || [])].reverse().slice(0, 8).map(event => <span key={event.id}><i /><small>{formatDateTime(event.createdAt)}</small><strong>{statusById(event.toStatus || event.status, event.entityType).label}</strong><p>{event.note}</p></span>)}</div>
          </section>
        </div>
      )}
    </article>
  );
}
