import { useState } from 'react';
import { statusById } from '../domain/tracking.js';
import {
  ExpeditingFields,
  expeditingActionDataFor,
  isExpeditingOwnedOrder,
} from './ExpeditingFields.jsx';
import { PlanningFields, planningActionDataFor } from './PlanningFields.jsx';

const EXPEDITING_ACTIONS = new Set([
  'start_expediting',
  'add_expediting_update',
  'place_on_hold',
  'resume_order',
  'complete_expediting',
]);

const usesExpeditingFields = (record, action) => (
  EXPEDITING_ACTIONS.has(action)
  && (!['place_on_hold', 'resume_order'].includes(action) || isExpeditingOwnedOrder(record))
);

export function WorkflowActionPanel({
  record,
  onAction,
  actions = record?.allowedWorkflowActions || [],
  title = 'Perform workflow action',
  description = 'Only actions permitted for your role and this exact stage are available',
  preferredAction = '',
  account,
  planningOptions,
  expeditingOptions,
}) {
  const [selectedAction, setSelectedAction] = useState(preferredAction);
  const [note, setNote] = useState('');
  const [actionData, setActionData] = useState({});
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const availableActions = actions.filter(action => action.action !== 'override_workflow');
  const actionId = availableActions.some(action => action.action === selectedAction)
    ? selectedAction
    : availableActions[0]?.action || '';
  const action = availableActions.find(item => item.action === actionId);

  if (!action) return null;

  const save = async () => {
    setError('');
    setFieldErrors({});
    setIsSaving(true);
    try {
      let submittedData = actionData;
      if (actionId === 'complete_planning') {
        submittedData = planningActionDataFor(record, account, planningOptions, actionData);
      } else if (usesExpeditingFields(record, actionId)) {
        submittedData = expeditingActionDataFor(record, expeditingOptions, actionId, actionData);
      }
      const saved = await onAction(
        record.id,
        actionId,
        note.trim(),
        submittedData,
        record.workflowType,
        record.version,
      );
      if (saved) {
        setSelectedAction('');
        setNote('');
        setActionData({});
        setFieldErrors({});
      }
    } catch (updateError) {
      setError(updateError?.message || 'The workflow action could not be saved. Please try again.');
      setFieldErrors(updateError?.fieldErrors || {});
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="expeditor-update-box">
      <div className="panel-index"><span>↻</span><div><strong>{title}</strong><small>{description}</small></div></div>
      {availableActions.length > 1 ? (
        <label className="form-field"><span>Available action</span><select value={actionId} onChange={event => { setSelectedAction(event.target.value); setActionData({}); setFieldErrors({}); setError(''); }}>{availableActions.map(option => <option key={option.action} value={option.action}>{option.label}{option.toStatus ? ` → ${statusById(option.toStatus, record.workflowType).label}` : ''}</option>)}</select></label>
      ) : (
        <p className="workflow-selected-action"><span>Next action</span><strong>{action.label}</strong><small>{action.toStatus ? statusById(action.toStatus, record.workflowType).label : ''}</small></p>
      )}
      <WorkflowActionFields action={action} data={actionData} onChange={setActionData} errors={fieldErrors} record={record} account={account} planningOptions={planningOptions} expeditingOptions={expeditingOptions} />
      {!['mark_quoted', 'accept_order', 'complete_planning'].includes(action.action) && !usesExpeditingFields(record, action.action) && <label className="form-field"><span>Workflow comment {action.requiresComment ? <b>Required</b> : <i>Optional</i>}</span><textarea rows="3" value={note} onChange={event => setNote(event.target.value)} placeholder="Add a clear update for the audit history and customer timeline." />{fieldErrors.comment && <small className="field-error">{fieldErrors.comment}</small>}</label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="expeditor-update-actions"><button className="primary-button" type="button" onClick={save} disabled={isSaving || !actionId}>{isSaving ? 'Saving…' : action.label} <span>{isSaving ? '•••' : '→'}</span></button></div>
    </div>
  );
}

function WorkflowActionFields({ action, data, onChange, errors = {}, record, account, planningOptions, expeditingOptions }) {
  if (!action) return null;
  const set = (key, value) => onChange(current => ({ ...current, [key]: value }));
  if (usesExpeditingFields(record, action.action)) {
    return <ExpeditingFields action={action.action} record={record} options={expeditingOptions} data={data} onChange={onChange} errors={errors} />;
  }
  if (action.action === 'complete_planning') {
    return <PlanningFields record={record} account={account} options={planningOptions} data={data} onChange={onChange} errors={errors} />;
  }
  if (action.action === 'mark_quoted') {
    const hasDocumentEvidence = Boolean(data.quotationDocumentFile || String(data.quotationDocumentReference || '').trim());
    return (
      <div className="quotation-confirmation-fields">
        <p className="workflow-helper quote-workflow-helper"><strong>Outlook remains the delivery channel.</strong> Record only the quotation confirmation here. Pricing is intentionally excluded from the app.</p>
        <div className="form-grid">
          <label className="form-field"><span>Quotation number</span><input value={data.quotationNumber || ''} onChange={event => set('quotationNumber', event.target.value)} placeholder="Example: Q-TEST-1001" />{errors.quotationNumber && <small className="field-error">{errors.quotationNumber}</small>}</label>
          <label className="form-field"><span>Quotation date</span><input type="date" value={data.quotationDate || ''} onInput={event => set('quotationDate', event.target.value)} onChange={event => set('quotationDate', event.target.value)} />{errors.quotationDate && <small className="field-error">{errors.quotationDate}</small>}</label>
          <label className="form-field"><span>Quotation expiry</span><select value={data.quotationExpiryMode || ''} onChange={event => set('quotationExpiryMode', event.target.value)}><option value="">Select expiry rule</option><option value="dated">Has an expiry date</option><option value="not_applicable">No stated expiry date</option></select>{errors.quotationExpiryMode && <small className="field-error">{errors.quotationExpiryMode}</small>}</label>
          {data.quotationExpiryMode === 'dated' && <label className="form-field"><span>Expiry date</span><input type="date" value={data.quotationExpiryDate || ''} onInput={event => set('quotationExpiryDate', event.target.value)} onChange={event => set('quotationExpiryDate', event.target.value)} />{errors.quotationExpiryDate && <small className="field-error">{errors.quotationExpiryDate}</small>}</label>}
        </div>
        <label className="choice-row quote-email-check"><input type="checkbox" checked={Boolean(data.quotationEmailed)} onChange={event => set('quotationEmailed', event.target.checked)} /><span><strong>Confirm the quotation was emailed</strong><small>Optional confirmation that the Outlook message was sent.</small></span></label>
        <div className="form-grid quote-notes-grid">
          <label className="form-field"><span>Internal note <i>Optional</i></span><textarea rows="3" value={data.quotationInternalNote || ''} onChange={event => set('quotationInternalNote', event.target.value)} placeholder="Visible only to authorised internal users." />{errors.quotationInternalNote && <small className="field-error">{errors.quotationInternalNote}</small>}</label>
          <label className="form-field"><span>Customer-facing note <i>Optional</i></span><textarea rows="3" value={data.quotationCustomerNote || ''} onChange={event => set('quotationCustomerNote', event.target.value)} placeholder="Shown in the customer RFQ timeline." />{errors.quotationCustomerNote && <small className="field-error">{errors.quotationCustomerNote}</small>}</label>
        </div>
        <div className="quotation-document-fields">
          <label className="form-field"><span>Quotation document reference <i>Optional</i></span><input value={data.quotationDocumentReference || ''} onChange={event => set('quotationDocumentReference', event.target.value)} placeholder="Outlook message ID, SharePoint reference or file reference" />{errors.quotationDocumentReference && <small className="field-error">{errors.quotationDocumentReference}</small>}</label>
          <label className="form-field quote-file-field"><span>Quotation copy <i>Optional</i></span><input type="file" accept=".pdf,.doc,.docx,image/*" onChange={event => set('quotationDocumentFile', event.target.files?.[0] || null)} />{data.quotationDocumentFile && <small>{data.quotationDocumentFile.name} · {Math.ceil(Number(data.quotationDocumentFile.size || 0) / 1024)} KB</small>}{errors.quotationDocumentFile && <small className="field-error">{errors.quotationDocumentFile}</small>}</label>
        </div>
        <label className={`choice-row quote-customer-document ${!hasDocumentEvidence ? 'is-disabled' : ''}`}><input type="checkbox" disabled={!hasDocumentEvidence} checked={Boolean(data.quotationDocumentCustomerVisible && hasDocumentEvidence)} onChange={event => set('quotationDocumentCustomerVisible', event.target.checked)} /><span><strong>Authorise this document/reference for the customer</strong><small>Without this explicit approval, no quotation document or reference is shown in the customer app.</small></span></label>
      </div>
    );
  }
  if (action.action === 'accept_order') {
    const poRequired = data.acceptanceType === 'purchase_order_received';
    const paymentReferenceRequired = data.acceptanceType === 'payment_confirmed';
    return (
      <div className="order-acceptance-fields">
        <p className="workflow-helper acceptance-workflow-helper"><strong>External acceptance only.</strong> Confirm evidence already received through the approved sales process. Do not enter card numbers, banking credentials or passwords. The app does not process payments.</p>
        <div className="form-grid">
          <label className="form-field"><span>Acceptance type</span><select value={data.acceptanceType || ''} onChange={event => set('acceptanceType', event.target.value)}><option value="">Select acceptance evidence</option><option value="purchase_order_received">Purchase Order received</option><option value="payment_confirmed">Payment confirmed externally</option><option value="written_acceptance_received">Written acceptance received</option><option value="account_customer_authorisation">Account-customer authorisation</option><option value="other">Other approved instruction</option></select>{errors.acceptanceType && <small className="field-error">{errors.acceptanceType}</small>}</label>
          <label className="form-field"><span>Acceptance date</span><input type="date" value={data.acceptanceDate || ''} onInput={event => set('acceptanceDate', event.target.value)} onChange={event => set('acceptanceDate', event.target.value)} />{errors.acceptanceDate && <small className="field-error">{errors.acceptanceDate}</small>}</label>
          <label className="form-field"><span>Purchase Order number {poRequired ? <b>Required</b> : <i>When available</i>}</span><input value={data.acceptancePurchaseOrderNumber || ''} onChange={event => set('acceptancePurchaseOrderNumber', event.target.value)} placeholder="Customer PO reference" />{errors.acceptancePurchaseOrderNumber && <small className="field-error">{errors.acceptancePurchaseOrderNumber}</small>}</label>
          <label className="form-field"><span>Payment / transaction reference {paymentReferenceRequired ? <b>Required</b> : <i>When applicable</i>}</span><input value={data.acceptancePaymentReference || ''} onChange={event => set('acceptancePaymentReference', event.target.value)} placeholder="Reference only - no banking details" />{errors.acceptancePaymentReference && <small className="field-error">{errors.acceptancePaymentReference}</small>}</label>
        </div>
        <label className="form-field"><span>Internal verification note <b>Required</b></span><textarea rows="4" value={data.acceptanceInternalNote || ''} onChange={event => set('acceptanceInternalNote', event.target.value)} placeholder="Describe what was received, where it was verified and any follow-up Planning should know." />{errors.acceptanceInternalNote && <small className="field-error">{errors.acceptanceInternalNote}</small>}</label>
        <div className="quotation-document-fields">
          <label className="form-field"><span>Supporting-document reference <i>Optional</i></span><input value={data.acceptanceDocumentReference || ''} onChange={event => set('acceptanceDocumentReference', event.target.value)} placeholder="Outlook, SharePoint or internal document reference" />{errors.acceptanceDocumentReference && <small className="field-error">{errors.acceptanceDocumentReference}</small>}</label>
          <label className="form-field quote-file-field"><span>Supporting document <i>Optional</i></span><input type="file" accept=".pdf,.doc,.docx,image/*" onChange={event => set('acceptanceDocumentFile', event.target.files?.[0] || null)} />{data.acceptanceDocumentFile && <small>{data.acceptanceDocumentFile.name} · {Math.ceil(Number(data.acceptanceDocumentFile.size || 0) / 1024)} KB</small>}{errors.acceptanceDocumentFile && <small className="field-error">{errors.acceptanceDocumentFile}</small>}</label>
        </div>
        <label className="choice-row acceptance-verification"><input type="checkbox" checked={Boolean(data.acceptanceVerified)} onChange={event => set('acceptanceVerified', event.target.checked)} /><span><strong>I have verified the customer acceptance</strong><small>Confirm the evidence is sufficient for Rhomberg to accept the order and route it to Planning.</small>{errors.acceptanceVerified && <small className="field-error">{errors.acceptanceVerified}</small>}</span></label>
        {errors.acceptance && <p className="form-error" role="alert">{errors.acceptance}</p>}
      </div>
    );
  }
  if (action.action === 'convert_to_order') return <p className="workflow-helper">A new order number and immutable item snapshot will be created automatically.</p>;
  if (action.action === 'archive_order') {
    return <label className="form-field"><span>Retention policy identifier</span><input value={data.retentionPolicyId || ''} onChange={event => set('retentionPolicyId', event.target.value)} /></label>;
  }
  return null;
}
