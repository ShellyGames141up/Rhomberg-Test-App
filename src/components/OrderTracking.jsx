import { useMemo, useState } from 'react';
import { progressForStatus, statusById } from '../domain/tracking.js';

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired', 'converted_to_order', 'archived']);

const formatDate = value => new Date(value).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function OrderTracking({ account, enquiries, onStartEnquiry, serviceMode }) {
  const ordered = useMemo(() => [...enquiries].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)), [enquiries]);
  const [openId, setOpenId] = useState(null);
  const activeCount = ordered.filter(enquiry => !TERMINAL_STATUSES.has(enquiry.trackingStatus)).length;

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
            <TrackingCard key={enquiry.id} enquiry={enquiry} expanded={openId === enquiry.id} onToggle={() => setOpenId(current => current === enquiry.id ? null : enquiry.id)} />
          ))}
        </div>
      ) : (
        <div className="tracking-empty"><span>◎</span><h2>No RFQs yet</h2><p>Once you submit an RFQ, its details and future progress updates will appear here.</p><button className="primary-button" type="button" onClick={onStartEnquiry}>Start an enquiry <span>→</span></button></div>
      )}

      <p className="tracking-storage-note"><span>i</span><span><strong>{serviceMode === 'mock' ? 'Public test storage' : 'Authorised company records'}</strong> {serviceMode === 'mock' ? 'Updates are retained in this browser. The production API will provide secure shared records across approved devices.' : 'The server restricts this view to records associated with your authorised company account.'}</span></p>
    </section>
  );
}

function TrackingCard({ enquiry, expanded, onToggle }) {
  const status = statusById(enquiry.trackingStatus, enquiry.workflowType);
  const progress = progressForStatus(enquiry.trackingStatus, enquiry.workflowType);
  const totalQuantity = (enquiry.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const history = [...(enquiry.trackingHistory || [])].reverse();
  const isOrder = enquiry.workflowType === 'order';

  return (
    <article className={`tracking-card ${expanded ? 'expanded' : ''}`}>
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
