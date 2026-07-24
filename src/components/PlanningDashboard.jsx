import { useMemo, useState } from 'react';
import {
  filterPlanningOrders,
  PLANNING_PRIORITIES,
  PLANNING_QUEUE_STATUSES,
  PLANNING_SORT_OPTIONS,
  planningOrderAgeLabel,
  planningOrderLastActivityAt,
  planningOrderPriority,
  planningQueueCounts,
} from '../domain/planningQueue.js';
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

const primaryActionFor = order => {
  const actionByStatus = {
    awaiting_planning: 'start_planning',
    planning_in_progress: 'complete_planning',
    planned: 'submit_to_expediting',
    on_hold: 'resume_order',
  };
  const actionId = actionByStatus[order.trackingStatus];
  return (order.allowedWorkflowActions || []).find(action => action.action === actionId);
};

export function PlanningDashboard({ account, orders, onAction, serviceMode, planningOptions }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('priority');
  const [openId, setOpenId] = useState(null);
  const options = {
    users: planningOptions?.users || [],
    locations: planningOptions?.locations || [],
    priorities: planningOptions?.priorities?.length ? planningOptions.priorities : PLANNING_PRIORITIES,
  };
  const counts = useMemo(() => planningQueueCounts(orders), [orders]);
  const filtered = useMemo(
    () => filterPlanningOrders(orders, { search, status, priority, sort }),
    [orders, priority, search, sort, status],
  );

  return (
    <section className="app-screen planning-screen" aria-labelledby="planning-title">
      <header className="planning-hero">
        <div className="planning-hero-copy">
          <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}Planning workspace</span>
          <h1 id="planning-title">Good day, {account.contact.split(/\s+/)[0]}.<br /><em>Build a clear production plan.</em></h1>
          <p>Start accepted orders, record controlled Planning detail and hand complete plans to Expediting. Internal references stay restricted to authorised staff.</p>
        </div>
        <div className="planning-kpi-grid" aria-label="Planning queue summary">
          <span className="is-total"><small>Planning queue</small><strong>{counts.all}</strong><em>active orders</em></span>
          <span><small>Awaiting</small><strong>{counts.awaiting_planning}</strong><em>not started</em></span>
          <span><small>In progress</small><strong>{counts.planning_in_progress}</strong><em>being planned</em></span>
          <span><small>Plan ready</small><strong>{counts.planned}</strong><em>for hand-off</em></span>
          <span className={counts.emergency ? 'is-alert' : ''}><small>Emergency</small><strong>{counts.emergency}</strong><em>priority review</em></span>
        </div>
      </header>

      <div className="planning-toolbar">
        <label className="planning-search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order, RFQ, company, contact, rep, PO or job number…" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear Planning search">×</button>}
        </label>
        <label><span>Stage</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All Planning stages</option>{PLANNING_QUEUE_STATUSES.map(stage => <option key={stage} value={stage}>{statusById(stage, 'order').label}</option>)}<option value="on_hold">On hold</option></select></label>
        <label><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option>{options.priorities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)}>{PLANNING_SORT_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>

      <div className="planning-result-heading">
        <div><span className="eyebrow">Controlled Planning queue</span><h2>{filtered.length} matching order{filtered.length === 1 ? '' : 's'}</h2></div>
        <p><span className="planning-live-dot" /> Current browser test data</p>
      </div>

      <div className="planning-table" role="table" aria-label="Planning orders">
        <div className="planning-table-head" role="row">
          <span role="columnheader">Order / RFQ</span>
          <span role="columnheader">Customer</span>
          <span role="columnheader">Representative</span>
          <span role="columnheader">Stage</span>
          <span role="columnheader">Priority</span>
          <span role="columnheader">PO / items</span>
          <span role="columnheader">Last update</span>
          <span role="columnheader">Action</span>
        </div>
        {filtered.map(order => (
          <PlanningOrder
            key={order.id}
            order={order}
            expanded={openId === order.id}
            onToggle={() => setOpenId(current => current === order.id ? null : order.id)}
            onAction={onAction}
            account={account}
            planningOptions={options}
          />
        ))}
        {!filtered.length && (
          <div className="planning-empty">
            <span>✓</span>
            <strong>No Planning orders match these filters</strong>
            <p>Clear the search or select a different stage or priority.</p>
            <button type="button" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); setSort('priority'); }}>Reset filters</button>
          </div>
        )}
      </div>

      <p className="tracking-storage-note planning-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Planning preview mode.' : 'Private-cloud Planning workspace.'}</strong> {serviceMode === 'mock' ? 'Actions persist in this browser through the same service layer used by the future private-cloud API. No real documents or customer data should be entered.' : 'Planning changes are protected by role, workflow, audit and server-side data controls.'}</span></p>
    </section>
  );
}

function PlanningOrder({ order, expanded, onToggle, onAction, account, planningOptions }) {
  const stage = statusById(order.trackingStatus, 'order');
  const priority = planningOrderPriority(order);
  const primaryAction = primaryActionFor(order);
  const holdAction = (order.allowedWorkflowActions || []).find(action => action.action === 'place_on_hold');
  const planning = order.planning || {};
  const customerPo = planning.customerPoNumber || order.customerPoNumber || order.poNumber || '';
  const lineItems = (order.items || []).length;

  return (
    <article className={`planning-order ${expanded ? 'is-open' : ''} ${order.emergency === 'yes' ? 'is-emergency' : ''}`} role="rowgroup">
      <div className="planning-order-row" role="row">
        <span className="planning-order-reference" role="cell" data-label="Order / RFQ"><strong>{order.reference}</strong><small>{order.sourceRfqReference || 'No linked RFQ'} · {planningOrderAgeLabel(order)}</small></span>
        <span role="cell" data-label="Customer"><strong>{order.company}</strong><small>{order.contact}</small></span>
        <span role="cell" data-label="Representative"><strong>{order.selectedRep?.name || 'Unassigned'}</strong><small>{order.selectedRep?.branchName || order.area || 'No branch'}</small></span>
        <span role="cell" data-label="Stage"><i className={`tracking-status status-${order.trackingStatus}`}>{stage.label}</i></span>
        <span role="cell" data-label="Priority"><i className={`planning-priority priority-${priority}`}>{titleCase(priority)}</i>{order.emergency === 'yes' && <small className="planning-emergency">Emergency</small>}</span>
        <span role="cell" data-label="PO / items"><strong>{customerPo || (planning.customerPoException?.authorised ? 'PO exception' : 'PO pending')}</strong><small>{lineItems} line item{lineItems === 1 ? '' : 's'}</small></span>
        <span role="cell" data-label="Last update"><strong>{formatDateTime(planningOrderLastActivityAt(order))}</strong><small>{order.updatedAt !== order.createdAt ? 'Workflow activity' : 'Order received'}</small></span>
        <span className="planning-open-cell" role="cell" data-label="Action"><button type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Close' : 'Open order'} <b>{expanded ? '−' : '→'}</b></button></span>
      </div>

      {expanded && (
        <div className="planning-order-detail">
          <header className="planning-detail-heading">
            <div><span className="eyebrow">Order detail</span><h3>{order.reference} · {order.company}</h3><p>{order.application || 'No application description recorded.'}</p></div>
            <div className="planning-detail-badges"><span>{order.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</span><span>{lineItems} line item{lineItems === 1 ? '' : 's'}</span>{order.emergency === 'yes' && <span className="is-emergency">Emergency fees apply</span>}</div>
          </header>

          <div className="planning-detail-grid">
            <section className="planning-detail-card is-customer"><span className="planning-detail-index">01</span><div><small>Customer</small><strong>{order.company}</strong><p>{order.contact}<br />{order.phone}<br />{order.email}</p></div></section>
            <section className="planning-detail-card is-sales"><span className="planning-detail-index">02</span><div><small>Sales representative</small><strong>{order.selectedRep?.name || 'Not assigned'}</strong><p>{order.selectedRep?.code || 'No rep code'}<br />{order.selectedRep?.branchName || order.area}</p></div></section>
            <section className="planning-detail-card is-references"><span className="planning-detail-index">03</span><div><small>References</small><strong>{order.sourceRfqReference || 'No RFQ reference'}</strong><p>Customer PO: {customerPo || (planning.customerPoException?.authorised ? 'Authorised exception' : 'Not supplied')}<br />Internal job: {planning.internalJobNumber || order.internalJobNumber || 'Not assigned'}</p></div></section>
            <section className="planning-detail-card is-activity"><span className="planning-detail-index">04</span><div><small>Activity</small><strong>{planningOrderAgeLabel(order)}</strong><p>Received {formatDateTime(order.createdAt)}<br />Updated {formatDateTime(planningOrderLastActivityAt(order))}</p></div></section>
          </div>

          <section className="planning-line-items">
            <div className="planning-section-heading"><div><span className="eyebrow">Configured units</span><h3>{lineItems} line item{lineItems === 1 ? '' : 's'} to plan</h3></div><small>Immutable RFQ snapshot</small></div>
            <div className="planning-item-grid">{(order.items || []).map(item => <span key={item.lineId || `${item.productId}-${item.code}`}><img src={item.image} alt="" /><i>{item.code}</i><strong>{item.name}</strong><small>Quantity {item.quantity || 1}</small></span>)}</div>
          </section>

          {Object.keys(planning).length > 0 && (
            <section className="planning-saved-plan">
              <div className="planning-section-heading"><div><span className="eyebrow">Saved plan</span><h3>Internal Planning summary</h3></div><small>Authorised staff only</small></div>
              <div className="planning-saved-grid">
                <span><small>Planning owner</small><strong>{planning.assignedPlanningUserName || 'Not assigned'}</strong></span>
                <span><small>Production location</small><strong>{planning.productionLocationName || 'To be confirmed'}</strong></span>
                <span><small>Planned start</small><strong>{formatDate(planning.plannedStartDate)}</strong></span>
                <span><small>Estimated completion</small><strong>{formatDate(planning.estimatedCompletionDate)}</strong></span>
                <span><small>Submission date</small><strong>{formatDate(planning.submissionDate)}</strong></span>
                <span><small>Priority</small><strong>{titleCase(planning.priority || priority)}</strong></span>
              </div>
              {planning.notes && <p className="planning-saved-notes"><strong>Planning notes</strong>{planning.notes}</p>}
              {planning.documentReferences?.length > 0 && <p className="planning-saved-notes"><strong>Document references</strong>{planning.documentReferences.join(' · ')}</p>}
            </section>
          )}

          {primaryAction ? (
            <WorkflowActionPanel
              key={`${order.id}-${primaryAction.action}-${order.version}`}
              record={order}
              actions={[primaryAction]}
              preferredAction={primaryAction.action}
              onAction={onAction}
              account={account}
              planningOptions={planningOptions}
              title={primaryAction.action === 'complete_planning' ? 'Complete the Planning record' : 'Move this order forward'}
              description={primaryAction.action === 'complete_planning' ? 'Required fields are checked before the plan can be saved' : 'This controlled action records the user, date, time and audit history'}
            />
          ) : (
            <p className="tracking-storage-note expeditor-readonly-note"><span>i</span><span><strong>No Planning action is available.</strong> This order may require a different authorised role or a refreshed record.</span></p>
          )}

          {holdAction && (
            <details className="planning-secondary-action">
              <summary>Need to pause this order?</summary>
              <WorkflowActionPanel
                key={`${order.id}-hold-${order.version}`}
                record={order}
                actions={[holdAction]}
                preferredAction="place_on_hold"
                onAction={onAction}
                account={account}
                planningOptions={planningOptions}
                title="Place order on hold"
                description="A clear reason is required and will be added to the audit history and customer timeline"
              />
            </details>
          )}

          <section className="planning-history">
            <div className="planning-section-heading"><div><span className="eyebrow">Audit trail</span><h3>Recent workflow activity</h3></div><small>Newest first</small></div>
            <div>{[...(order.trackingHistory || [])].reverse().slice(0, 6).map(event => <span key={event.id}><i /><small>{formatDateTime(event.createdAt)}</small><strong>{statusById(event.toStatus || event.status, event.entityType).label}</strong><p>{event.note}</p></span>)}</div>
          </section>
        </div>
      )}
    </article>
  );
}
