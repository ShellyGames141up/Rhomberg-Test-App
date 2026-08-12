import { useEffect, useMemo, useState } from 'react';
import { technicalStatusLabel, TECHNICAL_SUPPORT_STATUSES } from '../domain/technicalSupport.js';
import { accountCan, PERMISSIONS } from '../services/contracts.js';

const formatDate = value => value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
const customerTechnicalLabel = status => TECHNICAL_SUPPORT_STATUSES[status]?.customerLabel || 'Technical review';
const errorText = error => error?.message || 'The Technical Support action could not be completed.';
const configurationText = configuration => Object.entries(configuration || {}).map(([key, value]) => `${label(key)}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Yes' : 'No' : value}`).join(' · ');

function MessageThread({ request, onPost, customer = false, allowPost = true }) {
  const [message, setMessage] = useState('');
  const [classification, setClassification] = useState(customer ? 'customer_safe' : 'internal_only');
  const [attachment, setAttachment] = useState(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messages = useMemo(() => (request?.messages || []).filter(item => !search || `${item.message} ${item.senderName || item.sender}`.toLowerCase().includes(search.toLowerCase())), [request, search]);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onPost({ message, classification, attachment }); setMessage(''); setAttachment(null); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };
  return <section className="technical-thread" aria-label="Technical correspondence">
    <div className="technical-section-heading"><div><span className="eyebrow">Linked correspondence</span><h3>Technical conversation</h3></div><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search conversation" aria-label="Search technical conversation" /></div>
    <div className="technical-messages">{messages.map(item => <article key={item.id} className={`technical-message ${item.classification === 'customer_safe' ? 'is-customer-safe' : 'is-internal'}`}><div><strong>{item.senderName || item.sender || 'Rhomberg Instruments'}</strong><span>{label(item.senderRole)} · {formatDate(item.createdAt)}</span></div><p>{item.message}</p><small>{item.classification === 'customer_safe' ? 'Customer-safe' : 'Internal only'}{item.attachments?.length ? ` · ${item.attachments.map(document => document.fileName).join(', ')}` : ''}</small></article>)}</div>
    {!messages.length && <p className="technical-empty">No matching messages yet. The complete history remains linked to this RFQ.</p>}
    {allowPost && <form className="technical-message-form" onSubmit={submit}>
      <label><span>{customer ? 'Your reply' : 'New message'}</span><textarea value={message} onChange={event => setMessage(event.target.value)} required minLength="2" /></label>
      {!customer && <label><span>Visibility</span><select value={classification} onChange={event => setClassification(event.target.value)}><option value="internal_only">Internal only</option><option value="customer_safe">Customer-safe</option></select></label>}
      <label><span>Attachment <small>Optional</small></span><input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={event => setAttachment(event.target.files?.[0] || null)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="secondary-button" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post message'}</button>
    </form>}
  </section>;
}

export function RepresentativeTechnicalSupport({ rfq, account, actions, onChanged, canQuote = false, onQuote }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '', question: '', lineItemId: rfq.items?.[0]?.lineId || '', priority: 'standard', requestedDepartment: 'Technical Support', classification: 'internal_only', otherExplanation: '', confirmRequired: false, attachment: null });
  const [options, setOptions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = rfq.technicalSupport;
  useEffect(() => { actions.getOptions().then(setOptions).catch(reason => setError(errorText(reason))); }, [actions]);
  const run = async callback => { setBusy(true); setError(''); try { const updated = await callback(); await onChanged?.(updated); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  if (request) {
    const completed = request.status === 'technical_support_completed';
    return <section className={`technical-support-card is-active ${completed ? 'is-completed' : ''}`}>
    <div className="technical-support-title"><div><span className="eyebrow">{completed ? 'Returned to Sales' : 'Technical Review Pending'}</span><h3>{request.reference} · {technicalStatusLabel(request.status)}</h3><p>{completed ? 'Technical has answered. You may now prepare and send the quotation to the client.' : 'Final quotation is blocked until this review is completed or formally overridden.'}</p></div><span className={`technical-priority priority-${request.priority}`}>{label(request.priority)}</span></div>
    <dl className="technical-due-grid"><div><dt>Original target</dt><dd>{formatDate(request.originalQuotationTargetAt)}</dd></div><div><dt>Revised target</dt><dd>{formatDate(request.revisedQuotationTargetAt)}</dd></div><div><dt>Allowance</dt><dd>+{request.additionalAllowanceHours} hours</dd></div><div><dt>Assigned technical person</dt><dd>{request.assignedTechnicalUser?.displayName || 'Awaiting assignment'}</dd></div></dl>
    <p className="technical-question"><strong>{label(request.category)}</strong>{request.question}</p>
    {request.response?.response && <section className="technical-returned-answer"><span>Technical answer</span><p>{request.response.response}</p>{request.response.recommendation && <small><strong>Recommendation:</strong> {request.response.recommendation}</small>}</section>}
    {completed && <div className="technical-ready-to-quote"><span>✓</span><div><strong>Technical assistance complete</strong><small>The customer has been notified that the RFQ is back with the representative.</small></div><button className="primary-button" type="button" disabled={!canQuote} onClick={onQuote}>{canQuote ? 'Continue to Quote Client' : 'Complete the current RFQ action first'}</button></div>}
    {request.status === 'awaiting_representative_information' && <form className="technical-inline-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => request.pendingInformationTarget === 'customer' ? actions.forwardCustomerRequest(request.id, { message: data.get('message') }) : actions.postMessage(request.id, { message: data.get('message'), classification: 'internal_only' })); }}><label><span>{request.pendingInformationTarget === 'customer' ? 'Review and send customer-safe request' : 'Reply to Technical Support'}</span><textarea name="message" required minLength="2" /></label><button className="secondary-button" disabled={busy}>Send response</button></form>}
    <MessageThread request={request} account={account} onPost={input => run(() => actions.postMessage(request.id, input))} />
    {accountCan(account, PERMISSIONS.OVERRIDE_TECHNICAL_QUOTATION_BLOCK) && request.status !== 'technical_support_completed' && <form className="technical-override" onSubmit={event => { event.preventDefault(); run(() => actions.override(request.id, { reason: new FormData(event.currentTarget).get('reason') })); }}><label><span>Authorised quotation override reason</span><input name="reason" required minLength="10" /></label><button className="danger-button" disabled={busy}>Override quotation block</button></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
  }
  if (!['assigned_to_rep', 'under_rep_review'].includes(rfq.trackingStatus)) return null;
  return <section className="technical-support-card"><div className="technical-sales-choice"><div><h3>What would you like to do?</h3><p>Prepare the quotation or ask Technical for assistance.</p></div><div><button className="primary-button" type="button" disabled={!canQuote} onClick={onQuote}>{canQuote ? 'Quote Client' : 'Start RFQ Review First'}</button><button className="secondary-button" type="button" onClick={() => setOpen(value => !value)}>{open ? 'Close Technical Request' : 'Send to Technical for Assistance'}</button></div></div>
    {open && <form className="technical-request-form" onSubmit={event => { event.preventDefault(); run(() => actions.request(rfq.id, form)); }}>
      <div className="technical-section-heading"><div><span className="eyebrow">Before quotation</span><h3>Request Technical Support</h3></div><p>One controlled review adds a single 24-hour allowance.</p></div>
      <div className="technical-form-grid">
        <label><span>Category</span><select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} required><option value="">Select category</option>{options?.categories.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label><span>RFQ line item</span><select value={form.lineItemId} onChange={event => setForm(current => ({ ...current, lineItemId: event.target.value }))} required>{rfq.items.map(item => <option value={item.lineId} key={item.lineId}>{item.code} · {item.name}</option>)}</select></label>
        <label><span>Priority</span><select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))}>{(options?.priorities || ['standard', 'high', 'urgent']).map(item => <option value={item} key={item}>{label(item)}</option>)}</select></label>
        <label><span>Visibility</span><select value={form.classification} onChange={event => setForm(current => ({ ...current, classification: event.target.value }))}><option value="internal_only">Internal only</option><option value="customer_safe">Customer-safe summary</option></select></label>
        <label><span>Requested technical person <small>Optional</small></span><select value={form.requestedTechnicalUserId || ''} onChange={event => setForm(current => ({ ...current, requestedTechnicalUserId: event.target.value }))}><option value="">Technical Department to assign</option>{(options?.technicalUsers || []).map(user => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
      </div>
      {form.category === 'other' && <label><span>Other category explanation</span><input value={form.otherExplanation} onChange={event => setForm(current => ({ ...current, otherExplanation: event.target.value }))} required minLength="10" /></label>}
      <label><span>Detailed technical question</span><textarea value={form.question} onChange={event => setForm(current => ({ ...current, question: event.target.value }))} required minLength="10" /></label>
      <label><span>Requested department or person <small>Optional</small></span><input value={form.requestedDepartment} onChange={event => setForm(current => ({ ...current, requestedDepartment: event.target.value }))} /></label>
      <label><span>Supporting attachment <small>Optional</small></span><input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={event => setForm(current => ({ ...current, attachment: event.target.files?.[0] || null }))} /></label>
      <label className="technical-confirm"><input type="checkbox" checked={form.confirmRequired} onChange={event => setForm(current => ({ ...current, confirmRequired: event.target.checked }))} /><span>I confirm Technical Support is required before the final quotation.</span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit Technical Support request'}</button>
    </form>}
  </section>;
}

export function CustomerTechnicalSupport({ rfq, actions, onChanged }) {
  const request = rfq.technicalSupport;
  if (!request) return null;
  return <section className="customer-technical-card"><span className="eyebrow">Technical review</span><h3>{customerTechnicalLabel(request.status)}</h3><p>{request.customerMessage}</p><dl className="technical-due-grid"><div><dt>Revised quotation target</dt><dd>{formatDate(request.revisedQuotationTargetAt)}</dd></div><div><dt>Additional allowance</dt><dd>Up to {request.additionalAllowanceHours} hours</dd></div></dl>{request.customerInformationRequest?.message && <p className="customer-information-request"><strong>Additional information required</strong>{request.customerInformationRequest.message}</p>}<MessageThread request={request} customer allowPost={request.status === 'awaiting_customer_information'} onPost={async input => { const updated = await actions.postMessage(request.id, input); await onChanged?.(updated); }} /></section>;
}

export function TechnicalSupportWorkspace({ account, actions, onChanged, focusRecordId = '' }) {
  const [options, setOptions] = useState(null); const [records, setRecords] = useState([]); const [metrics, setMetrics] = useState(null);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [priority, setPriority] = useState(''); const [openId, setOpenId] = useState(focusRecordId); const [error, setError] = useState('');
  const load = async () => { try { const [nextOptions, nextRecords, nextMetrics] = await Promise.all([actions.getOptions(), actions.listQueue({ query: search, status, priority }), accountCan(account, PERMISSIONS.VIEW_TECHNICAL_METRICS) ? actions.getMetrics() : Promise.resolve(null)]); setOptions(nextOptions); setRecords(nextRecords); setMetrics(nextMetrics); } catch (reason) { setError(errorText(reason)); } };
  useEffect(() => { load(); }, [search, status, priority]);
  const run = async callback => { setError(''); try { await callback(); await load(); await onChanged?.(); } catch (reason) { setError(errorText(reason)); } };
  return <section className="app-screen technical-workspace" aria-labelledby="technical-workspace-title"><header className="expeditor-hero technical-hero"><span className="eyebrow">Technical Department workspace</span><h1 id="technical-workspace-title">RFQ questions.<br /><em>Controlled answers.</em></h1><p>Application correspondence, recommendations, documents and due-date controls remain linked to the original RFQ.</p>{metrics && <div className="expeditor-kpis"><span><strong>{metrics.total}</strong><small>Total requests</small></span><span><strong>{metrics.averageResponseHours}h</strong><small>Average response</small></span><span><strong>{metrics.overdue}</strong><small>Overdue</small></span></div>}</header>
    <div className="expeditor-tools"><label className="expeditor-search"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search RFQ, customer, representative or question" /></label><label className="expeditor-filter"><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{Object.keys(TECHNICAL_SUPPORT_STATUSES).map(item => <option value={item} key={item}>{technicalStatusLabel(item)}</option>)}</select></label><label className="expeditor-filter"><span>Priority</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="">All priorities</option>{(options?.priorities || []).map(item => <option value={item} key={item}>{label(item)}</option>)}</select></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="technical-queue">{records.map(rfq => <TechnicalQueueCard key={rfq.id} rfq={rfq} account={account} actions={actions} options={options} expanded={openId === rfq.id} onToggle={() => setOpenId(current => current === rfq.id ? '' : rfq.id)} run={run} />)}{!records.length && <div className="expeditor-empty"><span>✓</span><strong>No Technical Support requests match this view</strong></div>}</div>
  </section>;
}

function TechnicalQueueCard({ rfq, account, actions, options, expanded, onToggle, run }) {
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const request = rfq.technicalSupport; const line = rfq.items?.find(item => item.lineId === request.lineItemId);
  const downloadRfq = async () => {
    setDownloadBusy(true); setDownloadError('');
    try {
      const result = await actions.downloadRfq(request.id);
      const blob = await (await fetch(result.dataUrl)).blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = result.fileName || `${rfq.reference}-RFQ.pdf`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (reason) { setDownloadError(errorText(reason)); }
    finally { setDownloadBusy(false); }
  };
  return <article className={`technical-queue-card ${expanded ? 'is-open' : ''}`}><button type="button" className="technical-queue-summary" onClick={onToggle}><span><small>{rfq.reference} · {request.reference}</small><strong>{rfq.company}</strong><em>{rfq.contact}</em></span><span><small>Technical category</small><strong>{label(request.category)}</strong><em>{line ? `${line.code} · ${line.name}` : 'RFQ line item'}</em></span><span><small>Status</small><strong>{technicalStatusLabel(request.status)}</strong><em>{label(request.priority)} priority</em></span><span><small>Revised quotation target</small><strong>{formatDate(request.revisedQuotationTargetAt)}</strong><em>Requested {formatDate(request.requestedAt)}</em></span><b>{expanded ? '−' : '+'}</b></button>{expanded && <div className="technical-queue-detail"><p className="technical-question"><strong>Representative question</strong>{request.question}</p><dl className="technical-due-grid"><div><dt>Representative</dt><dd>{rfq.selectedRep?.name}</dd></div><div><dt>Assigned technical person</dt><dd>{request.assignedTechnicalUser?.displayName || 'Unassigned'}</dd></div><div><dt>Original target</dt><dd>{formatDate(request.originalQuotationTargetAt)}</dd></div><div><dt>Time outstanding</dt><dd>{Math.max(0, Math.floor((Date.now() - new Date(request.requestedAt)) / 36e5))} hours</dd></div></dl>
      <section className="technical-rfq-details"><header className="technical-rfq-details__header"><div><span className="eyebrow">Complete RFQ details</span><h3>{rfq.reference} · {rfq.company}</h3><p>Review the original application and every configured line before answering Sales.</p></div><button className="secondary-button" type="button" disabled={downloadBusy} onClick={downloadRfq}>{downloadBusy ? 'Preparing PDF…' : 'Download Complete RFQ PDF'}</button></header><dl><div><dt>Customer</dt><dd>{rfq.contact}<br />{rfq.email}<br />{rfq.phone}</dd></div><div><dt>Application</dt><dd>{rfq.application || 'Not recorded'}</dd></div><div><dt>Process medium</dt><dd>{rfq.medium || 'Not recorded'}</dd></div><div><dt>Delivery or collection</dt><dd>{rfq.fulfilment === 'collect' ? `Collection · ${rfq.collectionBranch || rfq.area}` : `Delivery · ${rfq.deliveryAddress || rfq.area}`}</dd></div></dl>{(rfq.customerNotes || rfq.notes) && <p className="technical-rfq-note"><strong>Customer note</strong>{rfq.customerNotes || rfq.notes}</p>}<div className="technical-rfq-lines">{(rfq.items || []).map(item => <article className="technical-rfq-line" key={item.lineId}><span>{item.quantity} ×</span><div><strong>{item.code} · {item.name}</strong><p>{configurationText(item.configuration) || 'No additional configuration recorded'}</p></div></article>)}</div>{downloadError && <p className="form-error" role="alert">{downloadError}</p>}</section>
      {!request.assignedTechnicalUser && accountCan(account, PERMISSIONS.ASSIGN_TECHNICAL_SUPPORT) && <form className="technical-inline-form" onSubmit={event => { event.preventDefault(); run(() => actions.assign(request.id, { technicalUserId: new FormData(event.currentTarget).get('technicalUserId') })); }}><label><span>Assign technical person</span><select name="technicalUserId" required><option value="">Select person</option>{options.technicalUsers.map(user => <option value={user.id} key={user.id}>{user.name} · {label(user.role)}</option>)}</select></label><button className="primary-button">Assign</button></form>}
      {request.status === 'technical_support_assigned' && accountCan(account, PERMISSIONS.RESPOND_TECHNICAL_SUPPORT) && <button className="primary-button" onClick={() => run(() => actions.startReview(request.id))}>Start Technical Review</button>}
      {['technical_support_assigned', 'technical_review_in_progress'].includes(request.status) && accountCan(account, PERMISSIONS.RESPOND_TECHNICAL_SUPPORT) && accountCan(account, PERMISSIONS.COMPLETE_TECHNICAL_SUPPORT) && <TechnicalAnswerForm request={request} actions={actions} run={run} />}
      {request.status === 'technical_response_submitted' && accountCan(account, PERMISSIONS.COMPLETE_TECHNICAL_SUPPORT) && <button className="primary-button" onClick={() => run(() => actions.complete(request.id, { note: 'Technical answer returned to the assigned representative.' }))}>Send Completed Review Back to Sales</button>}
      <MessageThread request={request} account={account} onPost={input => run(() => actions.postMessage(request.id, input))} />
    </div>}</article>;
}

function TechnicalAnswerForm({ request, actions, run }) {
  return <section className="technical-answer-panel"><div><span className="eyebrow">Answer and return</span><h3>Send Technical answer back to Sales</h3><p>Sales receives the internal answer immediately. The customer receives a general update that technical review is complete.</p></div><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const answer = String(data.get('answer') || '').trim(); run(async () => { await actions.respond(request.id, { response: answer, recommendation: answer, customerSafeNote: String(data.get('customerSafeNote') || '').trim() }); return actions.complete(request.id, { note: 'Technical answer returned to the assigned representative.' }); }); }}><label><span>Technical answer or note</span><textarea name="answer" required minLength="10" placeholder="Give the representative the product, configuration or application guidance needed to quote." /></label><label><span>Optional customer-safe progress note</span><textarea name="customerSafeNote" placeholder="Do not include internal calculations, pricing or staff-only comments." /></label><button className="primary-button">Send Answer Back to Sales</button></form><details><summary>Need more information instead?</summary><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => actions.requestInformation(request.id, { target: data.get('target'), message: data.get('message'), returnForCorrection: false })); }}><label><span>Request from</span><select name="target"><option value="representative">Representative</option><option value="customer">Customer, via Representative approval</option></select></label><label><span>Information required</span><textarea name="message" required minLength="2" /></label><button className="secondary-button">Request More Information</button></form></details></section>;
}
