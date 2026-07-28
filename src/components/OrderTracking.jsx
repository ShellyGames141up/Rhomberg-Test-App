import { useEffect, useMemo, useState } from 'react';
import { progressForStatus, statusById } from '../domain/tracking.js';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired', 'converted_to_order', 'archived']);

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function OrderTracking({ account, enquiries, onStartEnquiry, onAction, serviceMode, focusRecordId = '' }) {
  const ordered = useMemo(() => [...enquiries].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)), [enquiries]);
  const [openId, setOpenId] = useState(null);
  const activeCount = ordered.filter(enquiry => !TERMINAL_STATUSES.has(enquiry.trackingStatus)).length;

  useEffect(() => {
    if (!focusRecordId || !enquiries.some(enquiry => enquiry.id === focusRecordId)) return;
    setOpenId(focusRecordId);
    const timer = window.setTimeout(() => document.getElementById(`tracking-${focusRecordId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    return () => window.clearTimeout(timer);
  }, [focusRecordId]);

  return (
    <section className="app-screen tracking-screen" aria-labelledby="tracking-title">
      <header className="tracking-hero">
        <span className="eyebrow">Customer order tracking</span>
        <h1 id="tracking-title">Your requests.<br /><em>One clear timeline.</em></h1>
        <p>{serviceMode === 'mock' ? `RFQs and orders saved to ${account.company} remain available when you close and reopen this app on this device.` : `RFQs and orders for ${account.company} are loaded from the secure company service.`}</p>
        <div className="tracking-stats"><span><strong>{activeCount}</strong><small>Active</small></span><span><strong>{ordered.length}</strong><small>Total requests</small></span></div>
      </header>

      {ordered.length ? (
        <div className="tracking-list">
          {ordered.map(enquiry => (
            <TrackingCard key={enquiry.id} enquiry={enquiry} expanded={openId === enquiry.id} onToggle={() => setOpenId(current => current === enquiry.id ? null : enquiry.id)} onAction={onAction} serviceMode={serviceMode} />
          ))}
        </div>
      ) : (
        <div className="tracking-empty"><span>◎</span><h2>No RFQs yet</h2><p>Once you submit an RFQ, its details and future progress updates will appear here.</p><button className="primary-button" type="button" onClick={onStartEnquiry}>Start an enquiry <span>→</span></button></div>
      )}

      <p className="tracking-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Public test storage' : 'Authorised company records'}</strong> {serviceMode === 'mock' ? 'Updates are retained in this browser. The production API will provide secure shared records across approved devices.' : 'The server restricts this view to records associated with your authorised company account.'}</span></p>
    </section>
  );
}

function TrackingCard({ enquiry, expanded, onToggle, onAction, serviceMode }) {
  const status = statusById(enquiry.trackingStatus, enquiry.workflowType);
  const progress = progressForStatus(enquiry.trackingStatus, enquiry.workflowType);
  const totalQuantity = (enquiry.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const history = [...(enquiry.trackingHistory || [])].reverse();
  const isOrder = enquiry.workflowType === 'order';

  return (
    <article className={`tracking-card ${expanded ? 'expanded' : ''}`} id={`tracking-${enquiry.id}`}>
      <button className="tracking-card-summary" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span className="tracking-reference"><small>{isOrder ? 'Order progress' : 'Request for quotation'}</small><strong>{enquiry.reference}</strong></span>
        <span className={`tracking-status status-${enquiry.trackingStatus}`}>{status.label}</span>
        <span className="tracking-client-line">{totalQuantity} unit{totalQuantity === 1 ? '' : 's'} · Updated {formatDate(enquiry.updatedAt || enquiry.createdAt)}</span>
        <span className="tracking-progress"><i style={{ width: `${progress}%` }} /></span>
        <span className="tracking-expand">{expanded ? 'Hide details' : 'View details'} <b>{expanded ? '−' : '+'}</b></span>
      </button>

      {expanded && (
        <div className="tracking-details">
          <div className="tracking-detail-grid">
            <span><small>Representative</small><strong>{enquiry.selectedRep?.name || 'To be assigned'}</strong><em>{enquiry.selectedRep?.branchName || enquiry.area}</em></span>
            <span><small>Purchase Order</small><strong>{enquiry.poNumber || enquiry.poFileName || 'Not supplied'}</strong><em>{enquiry.emergency === 'yes' ? 'Emergency request' : 'Standard request'}</em></span>
          </div>
          {!isOrder && enquiry.quotationVersions?.length > 0 && <CustomerQuotationWorkflowPanel enquiry={enquiry} onAction={onAction} serviceMode={serviceMode} />}
          {!isOrder && !enquiry.quotationVersions?.length && enquiry.quotation && <CustomerQuotationPanel enquiry={enquiry} onAction={onAction} serviceMode={serviceMode} />}
          <div className="tracking-products">
            <h3>Requested instruments</h3>
            {(enquiry.items || []).map(item => <span key={item.lineId}><img src={item.image} alt="" /><b>{item.code}</b><small>{item.name}</small><strong>× {item.quantity}</strong></span>)}
          </div>
          <div className="tracking-timeline">
            <h3>Update history</h3>
            {history.map((event, index) => {
              const eventStatus = statusById(event.toStatus || event.status, event.entityType);
              return <div className="timeline-event" key={event.id || `${event.createdAt}-${index}`}><i className={index === 0 ? 'latest' : ''} /><span><small>{formatDate(event.createdAt)} · {event.actor || 'Rhomberg'}</small><strong>{eventStatus.label}</strong><p>{event.note || eventStatus.customerDescription}</p></span></div>;
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function CustomerQuotationWorkflowPanel({ enquiry, onAction, serviceMode }) {
  const versions = [...(enquiry.quotationVersions || [])].sort((a, b) => b.versionNumber - a.versionNumber);
  const current = versions.find(version => version.isCurrent) || versions[0];
  const acceptAction = (enquiry.allowedWorkflowActions || []).find(action => action.action === 'accept_quotation');
  const rejectAction = (enquiry.allowedWorkflowActions || []).find(action => action.action === 'reject_quotation');
  const [mode, setMode] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poFile, setPoFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [customerMessage, setCustomerMessage] = useState('');
  const [category, setCategory] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async action => {
    setError('');
    setIsSaving(true);
    try {
      const data = action === 'accept_quotation'
        ? { purchaseOrderNumber: poNumber, documentFile: poFile, confirmed, customerMessage }
        : { category, explanation };
      await onAction(enquiry.id, action, '', data, enquiry.workflowType, enquiry.version);
      setMode('');
    } catch (actionError) {
      setError(actionError?.message || 'Your quotation response could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="customer-quotation-panel" aria-label="Quotation">
      <div className="customer-quotation-heading"><span>Q</span><div><small>Current quotation · Version {current.versionNumber}</small><strong>{current.quotationNumber}</strong></div></div>
      <dl>
        <div><dt>Quotation date</dt><dd>{current.quotationDate}</dd></div>
        <div><dt>Expiry date</dt><dd>{current.expiryDate}</dd></div>
        <div><dt>Status</dt><dd>{current.status.replaceAll('_', ' ')}</dd></div>
        <div><dt>Representative</dt><dd>{enquiry.selectedRep?.name}</dd></div>
      </dl>
      <p className="customer-quotation-note"><strong>Message from your representative</strong>{current.customerMessage}</p>
      {current.document && <div className="customer-quotation-document"><span>PDF</span><div><strong>{current.document.originalFilename}</strong><small>{current.document.mimeType} · {Math.ceil(current.document.fileSize / 1024)} KB · demonstration metadata</small></div><a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`DEMONSTRATION QUOTATION ${current.quotationNumber}`)}`} download={current.document.originalFilename}>Download quotation</a></div>}
      <details>
        <summary>Quotation version history ({versions.length})</summary>
        <div className="tracking-products">{versions.map(version => <span key={version.id}><b>Version {version.versionNumber}</b><small>{version.quotationNumber} · {version.status.replaceAll('_', ' ')}</small><strong>{version.isCurrent ? 'Current' : 'Preserved'}</strong></span>)}</div>
      </details>
      {(acceptAction || rejectAction) && !mode && <div className="expeditor-update-actions"><button className="primary-button" type="button" onClick={() => setMode('accept')}>Accept Quotation</button><button className="secondary-button" type="button" onClick={() => setMode('reject')}>Reject Quotation</button></div>}
      {mode === 'accept' && <div className="order-acceptance-fields">
        <label className="form-field"><span>Purchase Order number <b>Required</b></span><input value={poNumber} onChange={event => setPoNumber(event.target.value)} /></label>
        <label className="form-field"><span>Purchase Order attachment <b>Required</b></span><input type="file" accept=".pdf,.docx,.xlsx" onChange={event => setPoFile(event.target.files?.[0] || null)} /></label>
        <label className="form-field"><span>Message <i>Optional</i></span><textarea value={customerMessage} onChange={event => setCustomerMessage(event.target.value)} /></label>
        <label className="choice-row"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I accept current Version {current.versionNumber}; this PO relates to it and the information is correct.</span></label>
        <div className="expeditor-update-actions"><button className="primary-button" disabled={isSaving || !poNumber.trim() || !poFile || !confirmed} onClick={() => submit('accept_quotation')}>Submit acceptance and PO</button><button onClick={() => setMode('')}>Cancel</button></div>
      </div>}
      {mode === 'reject' && <div className="order-acceptance-fields">
        <label className="form-field"><span>Rejection category <b>Required</b></span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Choose reason</option><option value="price_too_high">Price too high</option><option value="incorrect_product">Incorrect product</option><option value="incorrect_quantity">Incorrect quantity</option><option value="incorrect_configuration">Incorrect configuration</option><option value="delivery_time_unacceptable">Delivery time unacceptable</option><option value="terms_unacceptable">Terms unacceptable</option><option value="missing_information">Missing information</option><option value="customer_no_longer_requires_item">No longer required</option><option value="alternative_supplier_selected">Alternative supplier selected</option><option value="other">Other</option></select></label>
        <label className="form-field"><span>Detailed explanation <b>Required</b></span><textarea rows="4" value={explanation} onChange={event => setExplanation(event.target.value)} /></label>
        <div className="expeditor-update-actions"><button className="primary-button" disabled={isSaving || !category || explanation.trim().length < 10} onClick={() => submit('reject_quotation')}>Submit rejection</button><button onClick={() => setMode('')}>Cancel</button></div>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="tracking-storage-note"><span>i</span><span>{serviceMode === 'mock' ? 'Demonstration documents are simulated and contain no real customer or pricing data.' : 'Downloads require authenticated, time-limited server authorisation.'}</span></p>
    </section>
  );
}

function CustomerQuotationPanel({ enquiry, onAction, serviceMode }) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const quotation = enquiry.quotation;
  const acknowledgeAction = (enquiry.allowedWorkflowActions || []).find(action => action.action === 'acknowledge_quotation');
  const expiry = quotation.expiryMode === 'dated' && quotation.expiryDate
    ? new Date(`${quotation.expiryDate}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'No stated expiry date';
  const quotationDate = new Date(`${quotation.date}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

  const acknowledge = async () => {
    if (!acknowledgeAction || isSaving) return;
    setError('');
    setIsSaving(true);
    try {
      await onAction(
        enquiry.id,
        acknowledgeAction.action,
        '',
        {},
        enquiry.workflowType,
        enquiry.version,
      );
    } catch (actionError) {
      setError(actionError?.message || 'The quotation receipt could not be acknowledged. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="customer-quotation-panel" aria-label="Quotation confirmation">
      <div className="customer-quotation-heading"><span>Q</span><div><small>Quotation emailed separately</small><strong>{quotation.number}</strong></div></div>
      <dl>
        <div><dt>Quotation date</dt><dd>{quotationDate}</dd></div>
        <div><dt>Expiry</dt><dd>{expiry}</dd></div>
        <div><dt>Email confirmation</dt><dd>{quotation.emailed ? 'Confirmed by representative' : 'Sent separately; email confirmation not recorded'}</dd></div>
      </dl>
      {quotation.customerNote && <p className="customer-quotation-note"><strong>Message from your representative</strong>{quotation.customerNote}</p>}
      {(quotation.documentReference || quotation.document) && (
        <div className="customer-quotation-document">
          <span>DOC</span>
          <div>
            <strong>{quotation.document?.fileName || quotation.documentReference}</strong>
            {quotation.document?.downloadUrl
              ? <a href={quotation.document.downloadUrl}>Download authorised quotation copy</a>
              : <small>{serviceMode === 'mock' ? 'Authorised reference recorded for testing; no document download is available in the browser preview.' : 'The authorised reference is recorded. A download appears only when the secure document service provides one.'}</small>}
          </div>
        </div>
      )}
      <p className="customer-quotation-separate"><span>i</span><span>The quotation and any pricing were sent outside this app. This screen records workflow confirmation only.</span></p>
      {acknowledgeAction && (
        <div className="customer-quotation-acknowledge">
          <p><strong>Please confirm receipt</strong>This confirms only that you received the quotation. It does not accept pricing, confirm payment, submit a Purchase Order or create an order.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="button" onClick={acknowledge} disabled={isSaving}>{isSaving ? 'Saving…' : 'I received the quotation'} <span>{isSaving ? '•••' : '→'}</span></button>
        </div>
      )}
    </section>
  );
}
