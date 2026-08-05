import { useEffect, useMemo, useState } from 'react';
import { technicalStatusLabel, TECHNICAL_SUPPORT_STATUSES } from '../domain/technicalSupport.js';
import { accountCan, PERMISSIONS } from '../services/contracts.js';

const formatDate = value => value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
const customerTechnicalLabel = status => TECHNICAL_SUPPORT_STATUSES[status]?.customerLabel || 'Technical review';
const errorText = error => error?.message || 'The Technical Support action could not be completed.';

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

export function RepresentativeTechnicalSupport({ rfq, account, actions, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '', question: '', lineItemId: rfq.items?.[0]?.lineId || '', priority: 'standard', requestedDepartment: 'Technical Support', classification: 'internal_only', otherExplanation: '', confirmRequired: false, attachment: null });
  const [options, setOptions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = rfq.technicalSupport;
  useEffect(() => { actions.getOptions().then(setOptions).catch(reason => setError(errorText(reason))); }, [actions]);
  const run = async callback => { setBusy(true); setError(''); try { const updated = await callback(); await onChanged?.(updated); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  if (request) return <section className="technical-support-card is-active">
    <div className="technical-support-title"><div><span className="eyebrow">Technical Review Pending</span><h3>{request.reference} · {technicalStatusLabel(request.status)}</h3><p>Final quotation is blocked until this review is completed or formally overridden.</p></div><span className={`technical-priority priority-${request.priority}`}>{label(request.priority)}</span></div>
    <dl className="technical-due-grid"><div><dt>Original target</dt><dd>{formatDate(request.originalQuotationTargetAt)}</dd></div><div><dt>Revised target</dt><dd>{formatDate(request.revisedQuotationTargetAt)}</dd></div><div><dt>Allowance</dt><dd>+{request.additionalAllowanceHours} hours</dd></div><div><dt>Assigned technical person</dt><dd>{request.assignedTechnicalUser?.displayName || 'Awaiting assignment'}</dd></div></dl>
    <p className="technical-question"><strong>{label(request.category)}</strong>{request.question}</p>
    {request.status === 'awaiting_representative_information' && <form className="technical-inline-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => request.pendingInformationTarget === 'customer' ? actions.forwardCustomerRequest(request.id, { message: data.get('message') }) : actions.postMessage(request.id, { message: data.get('message'), classification: 'internal_only' })); }}><label><span>{request.pendingInformationTarget === 'customer' ? 'Review and send customer-safe request' : 'Reply to Technical Support'}</span><textarea name="message" required minLength="2" /></label><button className="secondary-button" disabled={busy}>Send response</button></form>}
    <MessageThread request={request} account={account} onPost={input => run(() => actions.postMessage(request.id, input))} />
    {accountCan(account, PERMISSIONS.OVERRIDE_TECHNICAL_QUOTATION_BLOCK) && request.status !== 'technical_support_completed' && <form className="technical-override" onSubmit={event => { event.preventDefault(); run(() => actions.override(request.id, { reason: new FormData(event.currentTarget).get('reason') })); }}><label><span>Authorised quotation override reason</span><input name="reason" required minLength="10" /></label><button className="danger-button" disabled={busy}>Override quotation block</button></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
  if (!['assigned_to_rep', 'under_rep_review'].includes(rfq.trackingStatus)) return null;
  return <section className="technical-support-card"><button className="secondary-button" type="button" onClick={() => setOpen(value => !value)}>Technical Support Required</button>
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
  const request = rfq.technicalSupport; const line = rfq.items?.find(item => item.lineId === request.lineItemId);
  return <article className={`technical-queue-card ${expanded ? 'is-open' : ''}`}><button type="button" className="technical-queue-summary" onClick={onToggle}><span><small>{rfq.reference} · {request.reference}</small><strong>{rfq.company}</strong><em>{rfq.contact}</em></span><span><small>Technical category</small><strong>{label(request.category)}</strong><em>{line ? `${line.code} · ${line.name}` : 'RFQ line item'}</em></span><span><small>Status</small><strong>{technicalStatusLabel(request.status)}</strong><em>{label(request.priority)} priority</em></span><span><small>Revised quotation target</small><strong>{formatDate(request.revisedQuotationTargetAt)}</strong><em>Requested {formatDate(request.requestedAt)}</em></span><b>{expanded ? '−' : '+'}</b></button>{expanded && <div className="technical-queue-detail"><p className="technical-question"><strong>Representative question</strong>{request.question}</p><dl className="technical-due-grid"><div><dt>Representative</dt><dd>{rfq.selectedRep?.name}</dd></div><div><dt>Assigned technical person</dt><dd>{request.assignedTechnicalUser?.displayName || 'Unassigned'}</dd></div><div><dt>Original target</dt><dd>{formatDate(request.originalQuotationTargetAt)}</dd></div><div><dt>Time outstanding</dt><dd>{Math.max(0, Math.floor((Date.now() - new Date(request.requestedAt)) / 36e5))} hours</dd></div></dl>
      {!request.assignedTechnicalUser && accountCan(account, PERMISSIONS.ASSIGN_TECHNICAL_SUPPORT) && <form className="technical-inline-form" onSubmit={event => { event.preventDefault(); run(() => actions.assign(request.id, { technicalUserId: new FormData(event.currentTarget).get('technicalUserId') })); }}><label><span>Assign technical person</span><select name="technicalUserId" required><option value="">Select person</option>{options.technicalUsers.map(user => <option value={user.id} key={user.id}>{user.name} · {label(user.role)}</option>)}</select></label><button className="primary-button">Assign</button></form>}
      {request.status === 'technical_support_assigned' && accountCan(account, PERMISSIONS.RESPOND_TECHNICAL_SUPPORT) && <button className="primary-button" onClick={() => run(() => actions.startReview(request.id))}>Start Technical Review</button>}
      {['technical_support_assigned', 'technical_review_in_progress', 'technical_response_submitted'].includes(request.status) && accountCan(account, PERMISSIONS.RESPOND_TECHNICAL_SUPPORT) && <TechnicalResponseForms request={request} actions={actions} run={run} />}
      {request.status === 'technical_response_submitted' && accountCan(account, PERMISSIONS.COMPLETE_TECHNICAL_SUPPORT) && <button className="primary-button" onClick={() => run(() => actions.complete(request.id, {}))}>Close Technical Request</button>}
      <MessageThread request={request} account={account} onPost={input => run(() => actions.postMessage(request.id, input))} />
    </div>}</article>;
}

function TechnicalResponseForms({ request, actions, run }) {
  return <div className="technical-action-forms"><details><summary>Request Information or Correction</summary><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => actions.requestInformation(request.id, { target: data.get('target'), message: data.get('message'), returnForCorrection: data.get('requestKind') === 'rfq_correction' })); }}><label><span>Action</span><select name="requestKind"><option value="more_information">Request More Information</option><option value="rfq_correction">Return RFQ for Correction</option></select></label><label><span>Route through</span><select name="target"><option value="representative">Representative</option><option value="customer">Customer, via Representative approval</option></select></label><label><span>Information required</span><textarea name="message" required minLength="2" /></label><button className="secondary-button">Send request</button></form></details><details><summary>Submit Technical Response</summary><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => actions.respond(request.id, { ...Object.fromEntries(data), approveConfiguration: data.get('approveConfiguration') === 'yes', attachment: event.currentTarget.elements.attachment?.files?.[0] || null, attachmentCustomerVisible: data.get('attachmentCustomerVisible') === 'yes' })); }}><label><span>Technical response</span><textarea name="response" required minLength="10" /></label><label><span>Recommendation</span><textarea name="recommendation" required minLength="5" /></label><label><span>Approved product or configuration</span><input name="approvedProductOrConfiguration" /></label><label className="technical-confirm"><input type="checkbox" name="approveConfiguration" value="yes" /><span>Approve Technical Configuration</span></label><label><span>Conditions or limitations</span><textarea name="conditions" /></label><label><span>Customer-safe note</span><textarea name="customerSafeNote" /></label><label><span>Internal technical note</span><textarea name="internalNote" /></label><label><span>Recommended quotation wording</span><textarea name="recommendedQuotationWording" /></label><label><span>Calibration or certification requirement</span><input name="certificationRequirement" /></label><label><span>Technical risk or warning</span><textarea name="riskWarning" /></label><label><span>Supporting document</span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" /></label><label className="technical-confirm"><input type="checkbox" name="attachmentCustomerVisible" value="yes" /><span>Explicitly authorise this attachment for customer download.</span></label><button className="primary-button">Send Response to Representative</button></form></details></div>;
}
