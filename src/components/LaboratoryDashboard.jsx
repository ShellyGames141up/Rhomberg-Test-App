import { useMemo, useState } from 'react';
import { certificateQueueForOrders, laboratoryMetrics, laboratoryMonthlyTracker } from '../domain/certification.js';
import { friendlyServiceError } from '../services/contracts.js';
import { StatusBadge } from './StatusBadge.jsx';

const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const dateTime = value => value
  ? new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Not recorded';

export function LaboratoryDashboard({
  account,
  orders,
  onAction,
  laboratoryActions,
  serviceMode,
  onRecordsChanged,
  focusRecordId,
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [queueStatus, setQueueStatus] = useState('active');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [sortBy, setSortBy] = useState('oldest');
  const [certificateView, setCertificateView] = useState('pending');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [openId, setOpenId] = useState(focusRecordId || '');
  const [unitForms, setUnitForms] = useState({});
  const [releaseDestination, setReleaseDestination] = useState('expediting');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const metrics = useMemo(() => laboratoryMetrics(orders), [orders]);
  const certificateQueue = useMemo(() => certificateQueueForOrders(orders), [orders]);
  const monthly = useMemo(() => laboratoryMonthlyTracker(orders, period), [orders, period]);
  const visibleOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter(order => {
      const units = order.laboratory?.units || [];
      const certificatesComplete = units.length > 0 && units.every(unit => unit.certificateId);
      const isReleased = Boolean(order.laboratory?.releasedAt);
      const statusMatches = queueStatus === 'all'
        || (queueStatus === 'active' && !isReleased)
        || (queueStatus === 'certificate_pending' && isReleased && !certificatesComplete)
        || (queueStatus === 'completed' && isReleased && certificatesComplete);
      return (
      (type === 'all' || order.routing?.certificationTypes?.includes(type))
      && statusMatches
      && (!urgentOnly || order.emergency === 'yes' || order.priority === 'urgent')
      && (!term || [
        order.reference,
        order.sourceRfqReference,
        order.internalJobNumber,
        order.customerPoNumber,
        order.company,
        order.contact,
        order.selectedRep?.name,
        ...(order.items || []).flatMap(item => [item.code, item.name]),
      ].some(value => String(value || '').toLowerCase().includes(term)))
      );
    }).sort((left, right) => {
      if (sortBy === 'newest') return new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt);
      if (sortBy === 'customer') return String(left.company || '').localeCompare(String(right.company || ''));
      return new Date(left.updatedAt || left.createdAt) - new Date(right.updatedAt || right.createdAt);
    });
  }, [orders, query, queueStatus, sortBy, type, urgentOnly]);
  const visibleCertificates = useMemo(() => certificateQueue.filter(unit => {
    if (certificateView === 'all') return true;
    if (certificateView === 'completed') return ['uploaded', 'verified'].includes(unit.certificateStatus);
    if (certificateView === 'archived') return unit.certificateStatus === 'archived';
    return !['uploaded', 'verified', 'archived'].includes(unit.certificateStatus);
  }), [certificateQueue, certificateView]);

  const run = async (key, operation, success) => {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await operation();
      await onRecordsChanged?.();
      setMessage(success);
    } catch (runError) {
      setError(friendlyServiceError(runError, 'The Laboratory action could not be completed.'));
    } finally {
      setBusy('');
    }
  };

  const workflow = (order, action, data = {}, comment = '') => run(
    `${order.id}-${action}`,
    () => onAction(order.id, action, comment, data, 'order', order.version),
    `${order.reference} was updated.`,
  );

  const setUnitForm = (unitId, key, value) => setUnitForms(current => ({
    ...current,
    [unitId]: { ...(current[unitId] || {}), [key]: value },
  }));

  const unitAction = (order, unit, action) => {
    const form = unitForms[unit.id] || {};
    return run(
      `${unit.id}-${action}`,
      () => laboratoryActions.updateUnit(order.id, unit.id, action, form),
      `${unit.productCode} unit ${unit.unitNumber} was updated.`,
    );
  };

  const uploadCertificate = (order, unit) => {
    const form = unitForms[unit.id] || {};
    return run(
      `${unit.id}-certificate`,
      () => laboratoryActions.uploadCertificate(order.id, unit.id, {
        certificateNumber: form.certificateNumber,
        issueDate: form.issueDate,
        notes: form.certificateNotes,
        file: form.certificateFile,
      }),
      `Certificate recorded for ${unit.productCode} unit ${unit.unitNumber}.`,
    );
  };

  const downloadCertificate = certificateId => run(
    `${certificateId}-download`,
    async () => {
      const certificate = await laboratoryActions.downloadCertificate(certificateId);
      const anchor = document.createElement('a');
      anchor.href = certificate.dataUrl;
      anchor.download = certificate.fileName;
      anchor.click();
    },
    'Certificate download prepared and audited.',
  );

  return (
    <section className="app-screen operations-desktop laboratory-screen" aria-labelledby="laboratory-title">
      <header className="operations-hero laboratory-hero">
        <div>
          <span className="eyebrow">{serviceMode === 'mock' ? 'Test · ' : ''}SANAS & Traceable Laboratory</span>
          <h1 id="laboratory-title">Every instrument.<br /><em>Every certificate.</em></h1>
          <p>One controlled calibration task and certificate per physical unit. Laboratory orders bypass QA and remain isolated from standard-order queues.</p>
        </div>
        <div className="operations-owner"><span>{account.contact}</span><small>Laboratory access · Desktop only</small></div>
      </header>

      <div className="operations-metrics">
        <Metric label="Awaiting receipt" value={metrics.awaitingReceipt} />
        <Metric label="Active orders" value={metrics.activeOrders} />
        <Metric label="Units in progress" value={metrics.unitsInProgress} />
        <Metric label="Certificates pending" value={metrics.certificatesPending} alert={metrics.certificatesPending > 0} />
        <Metric label="Ready for release" value={metrics.readyForRelease} />
        <Metric label="Released this month" value={metrics.releasedThisMonth} />
      </div>

      <div className="operations-toolbar">
        <label><span>Search Laboratory queue</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Order, RFQ, job, PO, customer, rep or unit…" /></label>
        <label><span>Certificate route</span><select value={type} onChange={event => setType(event.target.value)}><option value="all">SANAS and Traceable</option><option value="sanas">SANAS only</option><option value="traceable">Traceable only</option></select></label>
        <label><span>Queue view</span><select value={queueStatus} onChange={event => setQueueStatus(event.target.value)}><option value="active">Active work</option><option value="certificate_pending">Certificates pending</option><option value="completed">Completed</option><option value="all">All Laboratory records</option></select></label>
        <label><span>Sort orders</span><select value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="oldest">Oldest update first</option><option value="newest">Newest update first</option><option value="customer">Customer A–Z</option></select></label>
        <label><span>Monthly tracker</span><input type="month" value={period} onChange={event => setPeriod(event.target.value)} /></label>
        <label className="laboratory-urgent-filter"><input type="checkbox" checked={urgentOnly} onChange={event => setUrgentOnly(event.target.checked)} /><span>Urgent only</span></label>
        <div className="operations-toolbar-note"><strong>{visibleOrders.length}</strong><span>matching orders</span></div>
      </div>

      {(error || message) && <p className={`operations-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}

      <div className="operations-workspace-grid">
        <section className="operations-queue">
          <div className="operations-section-title"><div><span className="eyebrow">Calibration queue</span><h2>Laboratory orders</h2></div><small>Oldest activity first</small></div>
          {visibleOrders.map(order => (
            <article key={order.id} className={`operations-order ${openId === order.id ? 'is-open' : ''}`}>
              <button type="button" className="operations-order-summary" onClick={() => setOpenId(current => current === order.id ? '' : order.id)}>
                <span><small>{order.reference}</small><strong>{order.company}</strong><em>{order.internalJobNumber || 'Job pending'}</em></span>
                <span><small>Certification</small><strong>{(order.routing?.certificationTypes || []).map(humanise).join(' + ')}</strong><em>{(order.laboratory?.units || []).length} physical units</em></span>
                <span><small>Status</small><strong>{order.status || humanise(order.trackingStatus)}</strong><em>{dateTime(order.updatedAt)}</em></span>
                <b>{openId === order.id ? '−' : '+'}</b>
              </button>
              {openId === order.id && (
                <div className="operations-order-detail">
                  <dl className="operations-facts">
                    <div><dt>RFQ</dt><dd>{order.sourceRfqReference}</dd></div>
                    <div><dt>Customer PO</dt><dd>{order.customerPoNumber || 'Not recorded'}</dd></div>
                    <div><dt>Representative</dt><dd>{order.selectedRep?.name || 'Unassigned'}</dd></div>
                    <div><dt>Priority</dt><dd>{order.emergency === 'yes' ? 'Emergency' : humanise(order.priority || 'standard')}</dd></div>
                  </dl>
                  <OrderWorkflowActions
                    order={order}
                    busy={busy}
                    destination={releaseDestination}
                    onDestination={setReleaseDestination}
                    onWorkflow={workflow}
                  />
                  {order.laboratory?.releasedAt && !(order.laboratory?.units || []).every(unit => unit.certificateId) && (
                    <p className="tracking-storage-note laboratory-certificate-pending"><span>i</span><span><strong>Physical units released; certificates still controlled.</strong> This order remains in the permanent Laboratory queue until one PDF is uploaded for every certified unit.</span></p>
                  )}
                  <section className="laboratory-unit-list">
                    <div className="operations-section-title"><div><span className="eyebrow">Physical-unit control</span><h3>Calibration tasks</h3></div></div>
                    {(order.laboratory?.units || []).map(unit => (
                      <LaboratoryUnit
                        key={unit.id}
                        unit={unit}
                        item={(order.items || []).find(item => (item.lineId || item.id) === unit.lineItemId)}
                        order={order}
                        values={unitForms[unit.id] || {}}
                        onValue={(key, value) => setUnitForm(unit.id, key, value)}
                        onAction={action => unitAction(order, unit, action)}
                        onUpload={() => uploadCertificate(order, unit)}
                        onDownload={() => downloadCertificate(unit.certificateId)}
                        busy={busy}
                      />
                    ))}
                  </section>
                </div>
              )}
            </article>
          ))}
          {!visibleOrders.length && <div className="operations-empty"><strong>No Laboratory orders match</strong><p>Clear the filters or confirm that Planning has routed a SANAS or Traceable order.</p></div>}
        </section>

        <aside className="operations-side-panel">
          <span className="eyebrow">Permanent queue</span>
          <h2>Certificate register</h2>
          <p>{certificateQueue.length} physical-unit record{certificateQueue.length === 1 ? '' : 's'} remain available until controlled archival.</p>
          <div className="certificate-view-tabs">
            {['pending', 'completed', 'archived', 'all'].map(view => <button key={view} type="button" className={certificateView === view ? 'active' : ''} onClick={() => setCertificateView(view)}>{humanise(view)}</button>)}
          </div>
          <div className="certificate-queue">
            {visibleCertificates.slice(0, 12).map(unit => (
              <button key={unit.id} type="button" onClick={() => setOpenId(unit.orderId)}>
                <span><strong>{unit.productCode} · Unit {unit.unitNumber}</strong><small>{unit.orderReference} · {unit.company}</small></span>
                <StatusBadge as="b" status={unit.certificateStatus} label={humanise(unit.certificateStatus)} className="status-pill" />
              </button>
            ))}
            {!visibleCertificates.length && <p className="laboratory-register-empty">No certificate records in this view.</p>}
          </div>
          <section className="laboratory-monthly-tracker">
            <span className="eyebrow">Monthly unit tracker</span>
            <h3>{period || 'All periods'}</h3>
            <dl>
              <div><dt>SANAS orders / units</dt><dd>{monthly.sanasOrdersProcessed} / {monthly.sanasUnitsProcessed}</dd></div>
              <div><dt>Traceable orders / units</dt><dd>{monthly.traceableOrdersProcessed} / {monthly.traceableUnitsProcessed}</dd></div>
              <div><dt>SANAS certificates</dt><dd>{monthly.sanasCertificatesUploaded}</dd></div>
              <div><dt>Traceable certificates</dt><dd>{monthly.traceableCertificatesUploaded}</dd></div>
              <div><dt>Certificate backlog</dt><dd>{monthly.certificatesPending}</dd></div>
              <div><dt>Average Lab turnaround</dt><dd>{monthly.averageTurnaroundHours}h</dd></div>
              <div><dt>Average certificate upload</dt><dd>{monthly.averageCertificateUploadHours}h</dd></div>
              <div><dt>Urgent orders completed</dt><dd>{monthly.urgentOrdersCompleted}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value, alert }) {
  return <article className={alert ? 'is-alert' : ''}><strong>{value ?? 0}</strong><span>{label}</span></article>;
}

function OrderWorkflowActions({ order, busy, destination, onDestination, onWorkflow }) {
  const actions = new Set((order.allowedWorkflowActions || []).map(item => item.action));
  return (
    <div className="operations-action-bar">
      {actions.has('receive_lab_order') && <button className="primary-button" type="button" disabled={Boolean(busy)} onClick={() => onWorkflow(order, 'receive_lab_order')}>Confirm receipt</button>}
      {actions.has('start_lab_calibration') && <button className="primary-button" type="button" disabled={Boolean(busy)} onClick={() => onWorkflow(order, 'start_lab_calibration')}>Start calibration</button>}
      {actions.has('complete_lab_calibration') && <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => onWorkflow(order, 'complete_lab_calibration')}>Complete unit work</button>}
      {actions.has('mark_lab_ready_for_release') && <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => onWorkflow(order, 'mark_lab_ready_for_release')}>Submit for release</button>}
      {actions.has('release_from_lab') && (
        <>
          <label><span>Release to</span><select value={destination} onChange={event => onDestination(event.target.value)}><option value="expediting">Expediting</option><option value="dispatch">Dispatch</option></select></label>
          <button className="primary-button" type="button" disabled={Boolean(busy)} onClick={() => onWorkflow(order, 'release_from_lab', { labRelease: { destination } })}>Release order</button>
        </>
      )}
    </div>
  );
}

function LaboratoryUnit({ unit, item, order, values, onValue, onAction, onUpload, onDownload, busy }) {
  const configuration = Object.entries(item?.configuration || {}).filter(([, value]) => String(value || '').trim());
  return (
    <article className="laboratory-unit">
      <header><span><strong>{unit.productCode} · Unit {unit.unitNumber} of {unit.quantityInLine}</strong><small>{humanise(unit.certificationType)} · {humanise(unit.status)}</small></span><StatusBadge as="b" status={unit.certificateStatus} label={humanise(unit.certificateStatus)} className="status-pill" /></header>
      <dl className="laboratory-unit-overview">
        <div><dt>Product</dt><dd>{unit.productName || item?.name || unit.productCode}</dd></div>
        <div><dt>Job / PO</dt><dd>{order.planning?.internalJobNumber || order.internalJobNumber || 'Pending'} · {order.planning?.customerPoNumber || order.customerPoNumber || 'PO pending'}</dd></div>
        <div><dt>Range</dt><dd>{item?.measuringRange || item?.configuration?.range || item?.configuration?.pressureRange || 'As configured'}</dd></div>
        <div><dt>Connection</dt><dd>{item?.configuration?.connection || item?.configuration?.threadSize || item?.configuration?.processConnection || 'As configured'}</dd></div>
      </dl>
      {configuration.length > 0 && <div className="laboratory-configuration">{configuration.map(([key, value]) => <span key={key}><small>{humanise(key)}</small><strong>{String(value)}</strong></span>)}</div>}
      <div className="laboratory-unit-fields">
        <label><span>Serial number</span><input value={values.serialNumber || unit.serialNumber || ''} onChange={event => onValue('serialNumber', event.target.value)} placeholder="Physical unit serial" /></label>
        <label><span>Calibration result</span><input value={values.calibrationResult || unit.calibrationResult || ''} onChange={event => onValue('calibrationResult', event.target.value)} placeholder="Pass / result reference" /></label>
        <label className="wide"><span>Customer-visible message</span><input value={values.customerMessage || ''} onChange={event => onValue('customerMessage', event.target.value)} placeholder="Optional safe progress update" /></label>
        <label className="wide"><span>Internal note</span><textarea rows="2" value={values.internalNote || ''} onChange={event => onValue('internalNote', event.target.value)} placeholder="Never shown to the customer" /></label>
      </div>
      <div className="laboratory-unit-actions">
        {['awaiting_lab', 'received'].includes(unit.status) && <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => onAction('start')}>Start unit</button>}
        {unit.status === 'calibration_in_progress' && <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => onAction('complete')}>Complete unit</button>}
        {unit.status === 'calibration_in_progress' && <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => onAction('hold')}>Hold</button>}
        {unit.status === 'calibration_on_hold' && <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => onAction('resume')}>Resume</button>}
      </div>
      {(unit.completedAt || ['calibration_completed', 'certificate_uploaded', 'released'].includes(unit.status)) && (
        <div className="certificate-upload">
          {!unit.certificateId ? <>
            <label><span>Certificate number</span><input value={values.certificateNumber || ''} onChange={event => onValue('certificateNumber', event.target.value)} /></label>
            <label><span>Issue date</span><input type="date" value={values.issueDate || ''} onChange={event => onValue('issueDate', event.target.value)} /></label>
            <label><span>PDF certificate</span><input type="file" accept="application/pdf,.pdf" onChange={event => onValue('certificateFile', event.target.files?.[0] || null)} /></label>
            <button className="secondary-button" type="button" disabled={Boolean(busy) || !values.certificateFile} onClick={onUpload}>Upload certificate</button>
          </> : <>
            <span className="certificate-recorded"><small>Certificate recorded</small><strong>{unit.certificateNumber}</strong><em>{dateTime(unit.certificateUploadedAt || unit.certificate?.uploadedAt)}</em></span>
            <button className="text-button" type="button" disabled={Boolean(busy)} onClick={onDownload}>Download PDF</button>
          </>}
        </div>
      )}
    </article>
  );
}
