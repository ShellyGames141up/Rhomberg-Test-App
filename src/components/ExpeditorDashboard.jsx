import { useMemo, useState } from 'react';
import {
  completedExpeditorStepIds,
  EXPEDITOR_PROGRESS_STEPS,
  EXPEDITOR_QUEUE_FILTERS,
  EXPEDITOR_SORT_OPTIONS,
  expeditorEstimatedCompletionDate,
  expeditorOrderLastActivityAt,
  expeditorOrderPriority,
  expeditorProgressStepById,
  expeditorQueueCounts,
  filterExpeditorOrders,
  isApproachingEstimatedCompletion,
  missingRequiredExpeditorSteps,
} from '../domain/expediting.js';
import { statusById } from '../domain/tracking.js';
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
  if (!value) return 'Not set';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

const actionFor = (order, action) => (
  (order.allowedWorkflowActions || []).find(item => item.action === action)
);

const ageLabel = order => {
  const created = new Date(order.createdAt);
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86400000));
  if (days === 0) return 'Received today';
  return `${days} day${days === 1 ? '' : 's'} old`;
};

export function ExpeditorDashboard({ account, orders, onAction, serviceMode, expeditingOptions }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('oldest_update');
  const [openId, setOpenId] = useState(null);
  const options = {
    progressSteps: expeditingOptions?.progressSteps?.length ? expeditingOptions.progressSteps : EXPEDITOR_PROGRESS_STEPS,
    requiredStepIds: expeditingOptions?.requiredStepIds?.length
      ? expeditingOptions.requiredStepIds
      : EXPEDITOR_PROGRESS_STEPS.filter(item => item.requiredForDispatch).map(item => item.id),
    documentTypes: expeditingOptions?.documentTypes || [],
    approachingCompletionDays: expeditingOptions?.approachingCompletionDays || 3,
  };
  const now = new Date();
  const counts = useMemo(() => expeditorQueueCounts(orders, now), [orders]);
  const filtered = useMemo(
    () => filterExpeditorOrders(orders, { search, filter, sort }, now),
    [filter, orders, search, sort],
  );
  const filterCounts = {
    all: counts.all,
    newly_submitted: counts.newlySubmitted,
    in_progress: counts.inProgress,
    on_hold: counts.onHold,
    approaching_completion: counts.approachingCompletion,
    awaiting_dispatch: counts.awaitingDispatch,
    priority: counts.priority,
  };

  return (
    <section className="app-screen expediting-screen" aria-labelledby="expediting-title">
      <header className="expediting-hero">
        <div className="expediting-hero-copy">
          <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}Expediting workspace</span>
          <h1 id="expediting-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>Keep every order moving.</em></h1>
          <p>Record clear progress, protect internal notes and hand completed work to Dispatch through the controlled order workflow.</p>
        </div>
        <div className="expediting-kpi-grid" aria-label="Expediting queue summary">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><small>Active queue</small><strong>{counts.all}</strong><em>orders in scope</em></button>
          <button type="button" className={filter === 'newly_submitted' ? 'is-active' : ''} onClick={() => setFilter('newly_submitted')}><small>New</small><strong>{counts.newlySubmitted}</strong><em>need a start</em></button>
          <button type="button" className={filter === 'in_progress' ? 'is-active' : ''} onClick={() => setFilter('in_progress')}><small>In progress</small><strong>{counts.inProgress}</strong><em>need updates</em></button>
          <button type="button" className={`${filter === 'approaching_completion' ? 'is-active ' : ''}${counts.approachingCompletion ? 'is-alert' : ''}`} onClick={() => setFilter('approaching_completion')}><small>Due soon</small><strong>{counts.approachingCompletion}</strong><em>within {options.approachingCompletionDays} days</em></button>
          <button type="button" className={`${filter === 'on_hold' ? 'is-active ' : ''}${counts.onHold ? 'is-warning' : ''}`} onClick={() => setFilter('on_hold')}><small>On hold</small><strong>{counts.onHold}</strong><em>need attention</em></button>
          <button type="button" className={filter === 'awaiting_dispatch' ? 'is-active' : ''} onClick={() => setFilter('awaiting_dispatch')}><small>At Dispatch</small><strong>{counts.awaitingDispatch}</strong><em>handed over</em></button>
        </div>
      </header>

      <div className="expediting-toolbar">
        <label className="expediting-search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer, rep, RFQ, order, job or PO…" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear Expediting search">×</button>}
        </label>
        <label><span>Queue</span><select value={filter} onChange={event => setFilter(event.target.value)}>{EXPEDITOR_QUEUE_FILTERS.map(item => <option key={item.id} value={item.id}>{item.label} · {filterCounts[item.id]}</option>)}</select></label>
        <label><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)}>{EXPEDITOR_SORT_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>

      <div className="expediting-result-heading">
        <div><span className="eyebrow">Controlled Expediting queue</span><h2>{filtered.length} matching order{filtered.length === 1 ? '' : 's'}</h2></div>
        <p><span className="planning-live-dot" /> Oldest updates shown first</p>
      </div>

      <div className="expediting-order-list">
        {filtered.map(order => (
          <ExpeditingOrder
            key={order.id}
            order={order}
            expanded={openId === order.id}
            onToggle={() => setOpenId(current => current === order.id ? null : order.id)}
            onAction={onAction}
            account={account}
            options={options}
            now={now}
          />
        ))}
        {!filtered.length && (
          <div className="expeditor-empty expediting-empty">
            <span>✓</span>
            <strong>No orders match this queue</strong>
            <p>Clear the search or select another Expediting view.</p>
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); setSort('oldest_update'); }}>Reset queue</button>
          </div>
        )}
      </div>

      <p className="tracking-storage-note expediting-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Expediting preview mode.' : 'Private-cloud Expediting workspace.'}</strong> {serviceMode === 'mock' ? 'Updates persist in this browser. Document and image fields store metadata references only; do not enter real customer or production information.' : 'Updates are protected by role, workflow, audit and server-side access controls.'}</span></p>
    </section>
  );
}

function ExpeditingOrder({ order, expanded, onToggle, onAction, account, options, now }) {
  const stepById = id => options.progressSteps.find(item => item.id === id) || expeditorProgressStepById(id);
  const stage = statusById(order.trackingStatus, 'order');
  const priority = expeditorOrderPriority(order);
  const estimate = expeditorEstimatedCompletionDate(order);
  const currentStep = stepById(order.expediting?.currentStep || (order.trackingStatus === 'submitted_to_expediting' ? 'planning_received' : ''));
  const completedSteps = completedExpeditorStepIds(order);
  const missingSteps = missingRequiredExpeditorSteps(order, options.requiredStepIds);
  const lineItems = (order.items || []).length;
  const unitQuantity = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const startAction = actionFor(order, 'start_expediting');
  const updateAction = actionFor(order, 'add_expediting_update');
  const holdAction = actionFor(order, 'place_on_hold');
  const resumeAction = actionFor(order, 'resume_order');
  const dispatchAction = actionFor(order, 'complete_expediting');
  const approaching = isApproachingEstimatedCompletion(order, now, options.approachingCompletionDays);
  const customerPo = order.planning?.customerPoNumber || order.customerPoNumber || order.poNumber || '';
  const internalJob = order.planning?.internalJobNumber || order.internalJobNumber || '';
  const updates = [...(order.expediting?.updates || [])].reverse();

  return (
    <article className={`expediting-order-card ${expanded ? 'is-open' : ''} ${order.emergency === 'yes' ? 'is-emergency' : ''} ${approaching ? 'is-approaching' : ''}`}>
      <button type="button" className="expediting-order-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className="expediting-order-reference"><small>Order / RFQ</small><strong>{order.reference}</strong><em>{order.sourceRfqReference || 'No linked RFQ'} · {ageLabel(order)}</em></span>
        <span><small>Customer</small><strong>{order.company}</strong><em>{order.contact}</em></span>
        <span><small>Representative</small><strong>{order.selectedRep?.name || 'Unassigned'}</strong><em>{order.selectedRep?.branchName || order.area}</em></span>
        <span><small>Current progress</small><strong>{currentStep.label}</strong><em className={`tracking-status status-${order.trackingStatus}`}>{stage.label}</em></span>
        <span><small>Estimate</small><strong>{formatDate(estimate)}</strong><em>{approaching ? 'Due soon or overdue' : 'Current completion estimate'}</em></span>
        <span><small>Priority</small><strong className={`expediting-priority priority-${priority}`}>{titleCase(priority)}</strong><em>{order.emergency === 'yes' ? 'Emergency fees apply' : `${lineItems} line item${lineItems === 1 ? '' : 's'}`}</em></span>
        <span><small>Last update</small><strong>{formatDateTime(expeditorOrderLastActivityAt(order))}</strong><em>Oldest updates are prioritised</em></span>
        <b className="expediting-open-label">{expanded ? 'Close' : 'Open order'} <i>{expanded ? '−' : '→'}</i></b>
      </button>

      {expanded && (
        <div className="expediting-order-detail">
          <header className="expediting-detail-heading">
            <div><span className="eyebrow">Expediting order detail</span><h3>{order.reference} · {order.company}</h3><p>{order.application || 'No application description recorded.'}</p></div>
            <div><span>{order.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</span><span>{unitQuantity} unit{unitQuantity === 1 ? '' : 's'}</span>{order.emergency === 'yes' && <span className="is-emergency">Emergency</span>}</div>
          </header>

          <div className="expediting-fact-grid">
            <span><small>Internal job</small><strong>{internalJob || 'Not recorded'}</strong></span>
            <span><small>Customer PO</small><strong>{customerPo || 'Authorised exception / pending'}</strong></span>
            <span><small>Customer contact</small><strong>{order.contact}</strong><em>{order.phone}<br />{order.email}</em></span>
            <span><small>Assigned representative</small><strong>{order.selectedRep?.name || 'Not assigned'}</strong><em>{order.selectedRep?.code || 'No code'} · {order.selectedRep?.branchName || order.area}</em></span>
            <span><small>Estimated completion</small><strong>{formatDate(estimate)}</strong><em>{order.expediting?.currentDelayReason || 'No current delay recorded'}</em></span>
            <span><small>Required hand-off steps</small><strong>{missingSteps.length ? `${missingSteps.length} outstanding` : 'Complete'}</strong><em>{missingSteps.length ? missingSteps.map(id => stepById(id).label).join(', ') : 'Ready for final hand-off check'}</em></span>
          </div>

          <section className="expediting-products-section">
            <div className="planning-section-heading"><div><span className="eyebrow">Configured units</span><h3>{lineItems} line item{lineItems === 1 ? '' : 's'}</h3></div><small>Immutable RFQ snapshot</small></div>
            <div className="expediting-product-grid">{(order.items || []).map(item => <span key={item.lineId || `${item.productId}-${item.code}`}><img src={item.image} alt="" /><i>{item.code}</i><strong>{item.name}</strong><small>Quantity {item.quantity || 1}</small></span>)}</div>
          </section>

          <section className="expediting-progress-section">
            <div className="planning-section-heading"><div><span className="eyebrow">Configurable progress</span><h3>Production and fulfilment steps</h3></div><small>{completedSteps.size} recorded</small></div>
            <div className="expediting-step-track">
              {options.progressSteps.filter(item => !item.operational).map(item => (
                <span key={item.id} className={`${completedSteps.has(item.id) ? 'is-complete' : ''} ${order.expediting?.currentStep === item.id ? 'is-current' : ''}`}>
                  <i>{completedSteps.has(item.id) ? '✓' : String(item.sequence).padStart(2, '0')}</i>
                  <strong>{item.label}</strong>
                </span>
              ))}
            </div>
          </section>

          {startAction && (
            <WorkflowActionPanel record={order} actions={[startAction]} preferredAction="start_expediting" onAction={onAction} account={account} expeditingOptions={options} title="Start Expediting work" description="Accept the planned order and create its first customer-visible progress update" />
          )}
          {resumeAction && (
            <WorkflowActionPanel record={order} actions={[resumeAction]} preferredAction="resume_order" onAction={onAction} account={account} expeditingOptions={options} title="Resume this order" description="Return the order to its controlled Expediting stage and notify the customer and representative" />
          )}
          {updateAction && (
            <WorkflowActionPanel record={order} actions={[updateAction]} preferredAction="add_expediting_update" onAction={onAction} account={account} expeditingOptions={options} title="Add progress update" description="Change the progress step, estimate or delay information without exposing internal notes" />
          )}

          {(dispatchAction || holdAction) && (
            <div className="expediting-secondary-actions">
              {dispatchAction && (
                <details>
                  <summary>Submit this order to Dispatch <span>→</span></summary>
                  <WorkflowActionPanel record={order} actions={[dispatchAction]} preferredAction="complete_expediting" onAction={onAction} account={account} expeditingOptions={options} title="Dispatch hand-off" description="Validate required progress or record a controlled exception before hand-off" />
                </details>
              )}
              {holdAction && (
                <details>
                  <summary>Put this order on hold <span>!</span></summary>
                  <WorkflowActionPanel record={order} actions={[holdAction]} preferredAction="place_on_hold" onAction={onAction} account={account} expeditingOptions={options} title="Place order on hold" description="Record the delay reason and send a clear update without sharing the internal note" />
                </details>
              )}
            </div>
          )}

          {!startAction && !resumeAction && !updateAction && !dispatchAction && !holdAction && (
            <p className="tracking-storage-note expeditor-readonly-note"><span>i</span><span><strong>{order.trackingStatus === 'awaiting_dispatch' ? 'Handed to Dispatch.' : 'No Expediting action is available.'}</strong> {order.trackingStatus === 'awaiting_dispatch' ? 'The order remains visible here for shared operational awareness while Dispatch completes the handover.' : 'Refresh the record or ask an authorised manager to review its workflow stage.'}</span></p>
          )}

          <section className="expediting-update-history">
            <div className="planning-section-heading"><div><span className="eyebrow">Expeditor update history</span><h3>Customer and internal record</h3></div><small>Newest first</small></div>
            {updates.length ? (
              <div>
                {updates.map(update => (
                  <article key={update.id}>
                    <span className="expediting-history-marker" />
                    <header><strong>{stepById(update.progressStep).label}</strong><small>{formatDateTime(update.createdAt)} · {update.updatedBy?.displayName || 'Expeditor'}</small></header>
                    <p className="is-customer"><b>Customer update</b>{update.customerMessage}</p>
                    {update.internalNote && <p className="is-internal"><b>Internal note</b>{update.internalNote}</p>}
                    <footer>
                      {update.estimatedCompletionDate && <span>Estimate: {formatDate(update.estimatedCompletionDate)}</span>}
                      {update.delayReason && <span>Delay: {update.delayReason}</span>}
                      {update.document?.reference && <span>{titleCase(update.document.type)}: {update.document.reference}</span>}
                    </footer>
                  </article>
                ))}
              </div>
            ) : <p className="expediting-no-updates">No detailed Expeditor progress updates have been recorded yet.</p>}
          </section>

          <section className="planning-history expediting-audit-history">
            <div className="planning-section-heading"><div><span className="eyebrow">Audit trail</span><h3>Recent workflow activity</h3></div><small>Newest first</small></div>
            <div>{[...(order.trackingHistory || [])].reverse().slice(0, 8).map(event => <span key={event.id}><i /><small>{formatDateTime(event.createdAt)}</small><strong>{event.progressStep ? stepById(event.progressStep).label : statusById(event.toStatus || event.status, event.entityType).label}</strong><p>{event.note}</p></span>)}</div>
          </section>
        </div>
      )}
    </article>
  );
}
