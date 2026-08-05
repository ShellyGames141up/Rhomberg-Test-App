import { useEffect, useMemo, useState } from 'react';
import { progressForStatus, statusById } from '../domain/tracking.js';
import { StatusBadge } from './StatusBadge.jsx';
import { CustomerTechnicalSupport } from './TechnicalSupport.jsx';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired', 'converted_to_order', 'archived']);

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function OrderTracking({
  account,
  enquiries,
  onStartEnquiry,
  onAction,
  serviceMode,
  certificateActions,
  sourceDocumentActions,
  technicalSupportActions,
  onRecordsChanged,
  focusRecordId = '',
}) {
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
            <TrackingCard
              key={enquiry.id}
              enquiry={enquiry}
              expanded={openId === enquiry.id}
              onToggle={() => setOpenId(current => current === enquiry.id ? null : enquiry.id)}
              onAction={onAction}
              serviceMode={serviceMode}
              certificateActions={certificateActions}
              sourceDocumentActions={sourceDocumentActions}
              technicalSupportActions={technicalSupportActions}
              onRecordsChanged={onRecordsChanged}
            />
          ))}
        </div>
      ) : (
        <div className="tracking-empty"><span>◎</span><h2>No RFQs yet</h2><p>Once you submit an RFQ, its details and future progress updates will appear here.</p><button className="primary-button" type="button" onClick={onStartEnquiry}>Start an enquiry <span>→</span></button></div>
      )}

      <p className="tracking-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Public test storage' : 'Authorised company records'}</strong> {serviceMode === 'mock' ? 'Updates are retained in this browser. The production API will provide secure shared records across approved devices.' : 'The server restricts this view to records associated with your authorised company account.'}</span></p>
    </section>
  );
}

function TrackingCard({ enquiry, expanded, onToggle, onAction, serviceMode, certificateActions, sourceDocumentActions, technicalSupportActions, onRecordsChanged }) {
  const status = statusById(enquiry.trackingStatus, enquiry.workflowType);
  const progress = progressForStatus(enquiry.trackingStatus, enquiry.workflowType);
  const totalQuantity = (enquiry.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const history = [...(enquiry.customerTimeline || enquiry.trackingHistory || [])].reverse();
  const isOrder = enquiry.workflowType === 'order';

  return (
    <article className={`tracking-card ${expanded ? 'expanded' : ''}`} id={`tracking-${enquiry.id}`}>
      <button className="tracking-card-summary" type="button" onClick={onToggle} aria-expanded={expanded}>
        <span className="tracking-reference"><small>{isOrder ? 'Order progress' : 'Request for quotation'}</small><strong>{enquiry.reference}</strong></span>
        <StatusBadge status={enquiry.trackingStatus} label={status.label} className="tracking-status" />
        <span className="tracking-client-line">{totalQuantity} unit{totalQuantity === 1 ? '' : 's'} · Updated {formatDate(enquiry.updatedAt || enquiry.createdAt)}</span>
        <span className="tracking-progress"><i style={{ width: `${progress}%` }} /></span>
        <span className="tracking-expand">{expanded ? 'Hide details' : 'View details'} <b>{expanded ? '−' : '+'}</b></span>
      </button>

      {expanded && (
        <div className="tracking-details">
          <div className="tracking-detail-grid">
            <span><small>Representative</small><strong>{enquiry.selectedRep?.name || 'To be assigned'}</strong><em>{enquiry.selectedRep?.branchName || enquiry.area}</em></span>
            <span><small>Purchase Order</small><strong>{enquiry.purchaseOrderNumber || enquiry.poNumber || enquiry.poFileName || 'Not supplied'}</strong><em>{enquiry.fulfilment === 'collect' ? 'Collection requested' : 'Delivery requested'}</em></span>
          </div>
          {!isOrder && enquiry.quotation && <CustomerQuotationPanel enquiry={enquiry} onAction={onAction} serviceMode={serviceMode} />}
          {!isOrder && enquiry.technicalSupport && technicalSupportActions && <CustomerTechnicalSupport rfq={enquiry} actions={technicalSupportActions} onChanged={onRecordsChanged} />}
          {isOrder && (enquiry.documents || []).some(document => document.isCurrentVersion !== false) && <CustomerSourceDocuments order={enquiry} actions={sourceDocumentActions} serviceMode={serviceMode} />}
          <div className="tracking-products">
            <h3>Requested instruments</h3>
            {(enquiry.items || []).map(item => <span key={item.lineId}><img src={item.image} alt="" /><b>{item.code}</b><small>{item.name}</small><strong>× {item.quantity}</strong></span>)}
          </div>
          {isOrder && enquiry.laboratory?.units?.length > 0 && (
            <CustomerCertificatePanel
              units={enquiry.laboratory.units}
              certificateActions={certificateActions}
              serviceMode={serviceMode}
            />
          )}
          <div className="tracking-timeline" aria-label="Customer-visible order timeline">
            <h3>Order timeline</h3>
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

function CustomerSourceDocuments({ order, actions, serviceMode }) {
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const documents = (order.documents || []).filter(document => document.isCurrentVersion !== false);
  const labels = { customer_quotation: 'Customer quotation', purchase_order: 'Your Purchase Order', supporting_document: 'Supporting document' };

  const download = async document => {
    if (!actions?.downloadDocument || busyId) return;
    setBusyId(document.id);
    setMessage('');
    setError('');
    try {
      const result = await actions.downloadDocument(order.id, document.id);
      if (result.downloadUrl) {
        const link = globalThis.document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileName;
        globalThis.document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setMessage(result.message || `${result.fileName} is ready.`);
    } catch (downloadError) {
      setError(downloadError?.message || 'The document could not be downloaded.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="customer-source-documents" aria-label="Order documents">
      <header><span>DOC</span><div><small>Authorised source documents</small><h3>Quotation and Purchase Order</h3></div></header>
      <div>{documents.map(document => <article key={document.id}><div><small>{labels[document.documentType] || 'Order document'} · Version {document.version || 1}</small><strong>{document.fileName}</strong></div><button type="button" disabled={Boolean(busyId)} onClick={() => download(document)}>{busyId === document.id ? 'Checking…' : serviceMode === 'mock' ? 'Verify access' : 'Download'}</button></article>)}</div>
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {serviceMode === 'mock' && <p>Mock mode stores document metadata only; access checks and download audit entries are fully simulated.</p>}
    </section>
  );
}

function CustomerCertificatePanel({ units, certificateActions, serviceMode }) {
  const [downloadingId, setDownloadingId] = useState('');
  const [error, setError] = useState('');
  const available = units.filter(unit => unit.certificateId);

  const download = async unit => {
    if (!certificateActions?.downloadCertificate || !unit.certificateId || downloadingId) return;
    setError('');
    setDownloadingId(unit.certificateId);
    try {
      const certificate = await certificateActions.downloadCertificate(unit.certificateId);
      const downloadUrl = certificate.downloadUrl || certificate.dataUrl;
      if (!downloadUrl) throw new Error('The certificate file is not available in this preview.');
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = certificate.fileName || `${unit.certificateNumber || 'calibration-certificate'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (downloadError) {
      setError(downloadError?.message || 'The certificate could not be downloaded. Please try again.');
    } finally {
      setDownloadingId('');
    }
  };

  return (
    <section className="customer-certificate-panel" aria-label="Calibration certificates">
      <header>
        <span>CERT</span>
        <div>
          <small>Unit-level controlled documents</small>
          <h3>Calibration certificates</h3>
        </div>
        <strong>{available.length}/{units.length} available</strong>
      </header>
      <div>
        {units.map(unit => (
          <article key={unit.id}>
            <span><small>{unit.certificationType === 'sanas' ? 'SANAS' : 'Traceable'}</small><strong>{unit.productCode} · Unit {unit.unitNumber}</strong></span>
            <span><small>Certificate</small><strong>{unit.certificateNumber || 'Pending Laboratory release'}</strong></span>
            {unit.certificateId
              ? <button type="button" onClick={() => download(unit)} disabled={Boolean(downloadingId)}>{downloadingId === unit.certificateId ? 'Preparing…' : 'Download PDF'}</button>
              : <em>Not yet available</em>}
          </article>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p>{serviceMode === 'mock' ? 'Demo certificates are stored only in this browser. Every download still creates an audit-history entry.' : 'Downloads are authorised against your company account and recorded in the audit history.'}</p>
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
