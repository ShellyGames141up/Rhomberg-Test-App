import { useMemo, useState } from 'react';
import { qaSearchText, qualityMetrics, qualityMonthlyMetrics } from '../domain/qualityAssurance.js';
import { friendlyServiceError } from '../services/contracts.js';
import { ConfiguredUnitDetails } from './ConfiguredUnitDetails.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const formatDate = value => value ? new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';

export function QualityDashboard({
  account,
  orders,
  onAction,
  serviceMode,
  options,
  focusRecordId,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [openId, setOpenId] = useState(focusRecordId || '');
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const metrics = useMemo(() => qualityMetrics(orders), [orders]);
  const monthly = useMemo(() => qualityMonthlyMetrics(orders, period), [orders, period]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders
      .filter(order => status === 'all' || order.trackingStatus === status)
      .filter(order => !term || qaSearchText(order).includes(term));
  }, [orders, query, status]);

  const setForm = (orderId, key, value) => setForms(current => ({
    ...current,
    [orderId]: { ...(current[orderId] || {}), [key]: value },
  }));

  const run = async (order, action) => {
    const values = forms[order.id] || {};
    const dataByAction = {
      start_qa: { qaStart: values },
      start_qa_reinspection: { qaStart: values },
      pass_qa: { qaPass: values },
      fail_qa: { qaFailure: values },
      resubmit_to_qa: { qaRework: values },
      start_qa_rework: {},
      release_qa_order: {},
    };
    setBusy(`${order.id}-${action}`);
    setError('');
    setMessage('');
    try {
      await onAction(order.id, action, '', dataByAction[action] || {}, 'order', order.version);
      setMessage(`${order.reference} was updated.`);
    } catch (runError) {
      setError(friendlyServiceError(runError, 'The Quality Assurance action could not be completed.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="app-screen operations-desktop quality-screen" aria-labelledby="quality-title">
      <header className="operations-hero quality-hero">
        <div><span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}Quality Assurance</span><h1 id="quality-title">Inspect carefully.<br /><em>Release confidently.</em></h1><p>QA receives standard orders only. SANAS and Traceable orders remain under Laboratory control and bypass this queue.</p></div>
        <div className="operations-owner"><span>{account.contact}</span><small>Quality workspace · Desktop optimised</small></div>
      </header>
      <div className="operations-metrics">
        <Metric label="Awaiting inspection" value={metrics.awaitingInspection} />
        <Metric label="In inspection" value={metrics.inInspection} />
        <Metric label="Failed / rework" value={metrics.failed} alert={metrics.failed > 0} />
        <Metric label="Passed" value={metrics.passed} />
        <Metric label="Pass rate" value={`${metrics.passRate}%`} />
        <Metric label="Rework cycles" value={metrics.reworkCycles} />
      </div>
      <div className="operations-toolbar">
        <label><span>Search QA queue</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Customer, rep, RFQ, order, job or PO…" /></label>
        <label><span>Stage</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All QA stages</option>{['awaiting_qa', 'qa_in_progress', 'qa_failed', 'returned_to_expediting', 'qa_reinspection_required', 'qa_passed'].map(item => <option key={item} value={item}>{humanise(item)}</option>)}</select></label>
        <label><span>Monthly report</span><input type="month" value={period} onChange={event => setPeriod(event.target.value)} /></label>
        <div className="operations-toolbar-note"><strong>{visible.length}</strong><span>matching orders</span></div>
      </div>
      {(error || message) && <p className={`operations-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
      <div className="operations-metrics compact quality-monthly-metrics" aria-label="Quality monthly tracker">
        <Metric label="Orders inspected" value={monthly.ordersInspected} />
        <Metric label="Units inspected" value={monthly.unitsInspected} />
        <Metric label="First-time passes" value={monthly.firstTimePasses} />
        <Metric label="First inspection failures" value={monthly.firstInspectionFailures} alert={monthly.firstInspectionFailures > 0} />
        <Metric label="Reinspections" value={monthly.reinspectionCount} />
        <Metric label="Currently in rework" value={monthly.inRework} />
      </div>
      <section className="operations-queue">
        <div className="operations-section-title"><div><span className="eyebrow">Controlled inspection queue</span><h2>Standard orders</h2></div><small>Inspection attempts and rework are never overwritten</small></div>
        {visible.map(order => (
          <QualityOrder
            key={order.id}
            order={order}
            expanded={openId === order.id}
            values={forms[order.id] || {}}
            options={options}
            onToggle={() => setOpenId(current => current === order.id ? '' : order.id)}
            onValue={(key, value) => setForm(order.id, key, value)}
            onAction={action => run(order, action)}
            busy={busy}
          />
        ))}
        {!visible.length && <div className="operations-empty"><strong>No QA orders match</strong><p>Clear the filters or complete a standard order in Expediting.</p></div>}
      </section>
    </section>
  );
}

function Metric({ label, value, alert }) {
  return <article className={alert ? 'is-alert' : ''}><strong>{value ?? 0}</strong><span>{label}</span></article>;
}

function QualityOrder({ order, expanded, values, options, onToggle, onValue, onAction, busy }) {
  const actions = new Set((order.allowedWorkflowActions || []).map(item => item.action));
  const history = [...(order.qualityAssurance?.inspections || [])].reverse();
  return (
    <article className={`operations-order quality-order ${expanded ? 'is-open' : ''} ${order.trackingStatus === 'qa_failed' ? 'is-alert' : ''}`}>
      <button className="operations-order-summary" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span><small>{order.reference}</small><strong>{order.company}</strong><em>{order.internalJobNumber || 'Job pending'}</em></span>
        <span><small>Representative</small><strong>{order.selectedRep?.name || 'Unassigned'}</strong><em>{(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} units</em></span>
        <span><small>Status</small><strong>{order.status || humanise(order.trackingStatus)}</strong><em>{formatDate(order.updatedAt)}</em></span>
        <b>{expanded ? '−' : '+'}</b>
      </button>
      {expanded && (
        <div className="operations-order-detail">
          <dl className="operations-facts">
            <div><dt>Original RFQ</dt><dd>{order.sourceRfqReference}</dd></div>
            <div><dt>Customer PO</dt><dd>{order.customerPoNumber || 'Not recorded'}</dd></div>
            <div><dt>Sales Order Number</dt><dd>{order.salesOrderNumber || order.planning?.salesOrderNumber || 'Not recorded'}</dd></div>
            <div><dt>Inspection attempt</dt><dd>{order.qualityAssurance?.attempt || 0}</dd></div>
            <div><dt>Rework cycle</dt><dd>{order.qualityAssurance?.reworkCycle || 0}</dd></div>
          </dl>
          <div className="configured-unit-list"><h3>Ordered unit details</h3>{(order.items || []).map(item => <ConfiguredUnitDetails key={item.lineId || item.id || `${item.productId}-${item.code}`} unit={item} context="Quality Assurance" extra={{ inspectionAttempt: order.qualityAssurance?.attempt || 0, reworkCycle: order.qualityAssurance?.reworkCycle || 0 }} />)}</div>
          <div className="quality-action-form">
            {(actions.has('start_qa') || actions.has('start_qa_reinspection')) && <label><span>Checklist reference</span><input value={values.checklistReference || ''} onChange={event => onValue('checklistReference', event.target.value)} placeholder="Optional controlled checklist" /></label>}
            {actions.has('fail_qa') && <>
              <label><span>Problem category</span><select value={values.category || ''} onChange={event => onValue('category', event.target.value)}><option value="">Select category</option>{(options.problemCategories || []).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label><span>Severity</span><select value={values.severity || ''} onChange={event => onValue('severity', event.target.value)}><option value="">Select severity</option>{(options.severities || []).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label><span>Rework destination</span><select value={values.reworkDestination || ''} onChange={event => onValue('reworkDestination', event.target.value)}><option value="">Select team</option>{(options.reworkDestinations || []).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label><span>Affected unit or line item</span><select value={values.affectedItemId || ''} onChange={event => onValue('affectedItemId', event.target.value)}><option value="">Select affected item</option>{(order.items || []).map((item, index) => <option key={item.lineId || item.id || index} value={item.lineId || item.id || `line-${index + 1}`}>{item.code || item.name} · line {index + 1}</option>)}</select></label>
              <label><span>Date found</span><input type="date" value={values.dateFound || ''} onChange={event => onValue('dateFound', event.target.value)} /></label>
              <label className="wide"><span>Problem description</span><textarea rows="2" value={values.problemDescription || ''} onChange={event => onValue('problemDescription', event.target.value)} /></label>
              {(values.category === 'other' || values.reworkDestination === 'other') && <label className="wide"><span>Other explanation</span><textarea rows="2" value={values.otherExplanation || ''} onChange={event => onValue('otherExplanation', event.target.value)} /></label>}
            </>}
            {actions.has('resubmit_to_qa') && <label className="wide"><span>Corrective action completed</span><textarea rows="2" value={values.correctiveAction || ''} onChange={event => onValue('correctiveAction', event.target.value)} /></label>}
            {actions.has('pass_qa') && <>
              <label><span>Inspection date</span><input type="date" value={values.inspectionDate || ''} onChange={event => onValue('inspectionDate', event.target.value)} /></label>
              <label className="quality-check"><input type="checkbox" checked={Boolean(values.checklistConfirmed)} onChange={event => onValue('checklistConfirmed', event.target.checked)} /><span>Inspection checklist confirmed</span></label>
              <label className="quality-check"><input type="checkbox" checked={Boolean(values.meetsRequirements)} onChange={event => onValue('meetsRequirements', event.target.checked)} /><span>Unit meets requirements</span></label>
            </>}
            {(actions.has('pass_qa') || actions.has('fail_qa') || actions.has('resubmit_to_qa')) && <label className="wide"><span>Customer-facing message</span><textarea rows="2" value={values.customerMessage || ''} onChange={event => onValue('customerMessage', event.target.value)} placeholder="Safe progress update for customer and representative" /></label>}
            <label className="wide"><span>Internal QA note</span><textarea rows="2" value={values.internalNote || ''} onChange={event => onValue('internalNote', event.target.value)} placeholder="Never shown to customers" /></label>
          </div>
          <div className="operations-action-bar">
            {actions.has('start_qa') && <button className="primary-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('start_qa')}>Start inspection</button>}
            {actions.has('start_qa_reinspection') && <button className="primary-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('start_qa_reinspection')}>Start reinspection</button>}
            {actions.has('pass_qa') && <button className="primary-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('pass_qa')}>Pass QA</button>}
            {actions.has('fail_qa') && <button className="danger-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('fail_qa')}>Record problem</button>}
            {actions.has('start_qa_rework') && <button className="primary-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('start_qa_rework')}>Start corrective work</button>}
            {actions.has('resubmit_to_qa') && <button className="primary-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('resubmit_to_qa')}>Resubmit to QA</button>}
            {actions.has('release_qa_order') && <button className="primary-button" disabled={Boolean(busy)} type="button" onClick={() => onAction('release_qa_order')}>Send to Dispatch</button>}
          </div>
          <section className="quality-history"><h3>Inspection history</h3>{history.map(inspection => <article key={inspection.id}><StatusBadge as="b" status={inspection.result} label={humanise(inspection.result)} className="status-pill" /><span><strong>Attempt {inspection.attempt}</strong><small>{inspection.customerMessage || 'Internal inspection record'} · {formatDate(inspection.createdAt)}</small></span></article>)}{!history.length && <p>No completed inspection attempt is recorded yet.</p>}</section>
        </div>
      )}
    </article>
  );
}
