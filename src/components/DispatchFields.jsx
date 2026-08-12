import {
  DISPATCH_METHODS,
  DISPATCH_PROOF_TYPES,
  dispatchMethodById,
} from '../domain/dispatch.js';

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const ACTION_COPY = Object.freeze({
  mark_ready_for_collection: 'Your order is ready for collection. Please arrange collection with the confirmed Rhomberg branch.',
  start_delivery: 'Your order has left Rhomberg and is out for delivery.',
  confirm_collection: 'Your order was collected successfully. Thank you.',
  confirm_delivery: 'Your order was delivered successfully. Thank you.',
  complete_collection: 'Your collected order is complete. Thank you for choosing Rhomberg Instruments.',
  complete_delivery: 'Your delivered order is complete. Thank you for choosing Rhomberg Instruments.',
  report_delivery_problem: 'A delivery problem was recorded. Our Dispatch team is following up and will keep you informed.',
});

export const DISPATCH_ACTIONS = new Set(Object.keys(ACTION_COPY));

export const isDispatchOwnedOrder = record => (
  ['awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected'].includes(record?.trackingStatus)
  || (
    record?.trackingStatus === 'on_hold'
    && ['awaiting_dispatch', 'ready_for_collection', 'out_for_delivery'].includes(record?.workflowContext?.resumeStatus)
  )
);

export const dispatchActionDataFor = (record, options = {}, action, changes = {}) => {
  const dispatch = record?.dispatch || {};
  const methods = options.methods?.length ? options.methods : DISPATCH_METHODS;
  const compatibleMethods = methods.filter(method => method.fulfilment === record?.fulfilment);
  const existingMethod = compatibleMethods.some(method => method.id === dispatch.method)
    ? dispatch.method
    : compatibleMethods[0]?.id || '';
  const currentDate = today();
  const base = {
    dispatchMethod: existingMethod,
    dispatchReadyDate: dispatch.readyDate || (
      ['mark_ready_for_collection', 'start_delivery'].includes(action) ? currentDate : ''
    ),
    dispatchCollectionDate: dispatch.collectionDate || (
      action === 'confirm_collection' ? currentDate : ''
    ),
    dispatchDeliveryDate: dispatch.deliveryDate || (
      action === 'confirm_delivery' ? currentDate : ''
    ),
    dispatchCourierOrDriver: dispatch.courierOrDriver || '',
    dispatchTrackingReference: dispatch.trackingReference || '',
    dispatchNumberOfPackages: dispatch.numberOfPackages || 1,
    dispatchDeliveryNoteNumber: dispatch.deliveryNoteNumber || '',
    dispatchRecipientName: dispatch.recipientName || '',
    dispatchProofType: dispatch.proofOfDelivery?.type || '',
    dispatchProofReference: dispatch.proofOfDelivery?.reference || '',
    dispatchProofFile: null,
    dispatchProblemReason: '',
    dispatchInternalNotes: '',
    dispatchCustomerMessage: ACTION_COPY[action] || 'Your order handover has been updated.',
  };
  return { ...base, ...changes };
};

const FieldError = ({ message }) => message ? <small className="field-error">{message}</small> : null;

export function DispatchFields({ action, record, options = {}, data, onChange, errors = {} }) {
  const values = dispatchActionDataFor(record, options, action, data);
  const methods = (options.methods?.length ? options.methods : DISPATCH_METHODS)
    .filter(method => method.fulfilment === record?.fulfilment);
  const proofTypes = options.proofTypes?.length ? options.proofTypes : DISPATCH_PROOF_TYPES;
  const selectedMethod = dispatchMethodById(values.dispatchMethod);
  const isRelease = ['mark_ready_for_collection', 'start_delivery'].includes(action);
  const isConfirmation = ['confirm_collection', 'confirm_delivery'].includes(action);
  const isCompletion = ['complete_collection', 'complete_delivery'].includes(action);
  const isProblem = action === 'report_delivery_problem';
  const isDelivery = record?.fulfilment === 'delivery';
  const showProof = isConfirmation;
  const maxProofBytes = Number(options.maxProofBytes || 4 * 1024 * 1024);
  const set = (key, value) => onChange(current => ({ ...current, [key]: value }));

  return (
    <div className="dispatch-form-fields">
      <p className="workflow-helper dispatch-workflow-helper">
        <strong>Controlled Dispatch update.</strong> The customer-facing message is shared with the customer and assigned representative. Internal notes remain restricted to authorised staff.
      </p>

      <div className="dispatch-field-group is-method">
        <div className="dispatch-field-heading"><span>01</span><div><strong>Handover method</strong><small>Use the method that matches the customer’s confirmed fulfilment choice.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Dispatch method <b>Required</b></span>
            <select value={values.dispatchMethod} onChange={event => set('dispatchMethod', event.target.value)}>
              <option value="">Select a Dispatch method</option>
              {methods.map(method => <option key={method.id} value={method.id}>{method.label}</option>)}
            </select>
            <FieldError message={errors.dispatchMethod} />
          </label>
          <div className="dispatch-method-summary">
            <small>Customer preference</small>
            <strong>{record?.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</strong>
            <span>{selectedMethod.label}</span>
          </div>
        </div>
      </div>

      {!isCompletion && (
        <div className="dispatch-field-group is-handover">
          <div className="dispatch-field-heading"><span>02</span><div><strong>Handover detail</strong><small>Record the operational references needed to complete this stage.</small></div></div>
          <div className="form-grid dispatch-detail-grid">
            {(isRelease || values.dispatchReadyDate) && (
              <label className="form-field">
                <span>Ready date {isRelease ? <b>Required</b> : <i>Recorded</i>}</span>
                <input type="date" value={values.dispatchReadyDate} onInput={event => set('dispatchReadyDate', event.target.value)} onChange={event => set('dispatchReadyDate', event.target.value)} />
                <FieldError message={errors.dispatchReadyDate} />
              </label>
            )}
            {action === 'confirm_collection' && (
              <label className="form-field">
                <span>Collection date <b>Required</b></span>
                <input type="date" value={values.dispatchCollectionDate} onInput={event => set('dispatchCollectionDate', event.target.value)} onChange={event => set('dispatchCollectionDate', event.target.value)} />
                <FieldError message={errors.dispatchCollectionDate} />
              </label>
            )}
            {action === 'confirm_delivery' && (
              <label className="form-field">
                <span>Delivery date <b>Required</b></span>
                <input type="date" value={values.dispatchDeliveryDate} onInput={event => set('dispatchDeliveryDate', event.target.value)} onChange={event => set('dispatchDeliveryDate', event.target.value)} />
                <FieldError message={errors.dispatchDeliveryDate} />
              </label>
            )}
            {(isRelease || values.dispatchNumberOfPackages) && (
              <label className="form-field">
                <span>Number of packages {isRelease ? <b>Required</b> : <i>Recorded</i>}</span>
                <input type="number" min="1" max="999" value={values.dispatchNumberOfPackages} onChange={event => set('dispatchNumberOfPackages', event.target.value)} />
                <FieldError message={errors.dispatchNumberOfPackages} />
              </label>
            )}
            {(isDelivery || values.dispatchCourierOrDriver) && !isProblem && (
              <label className="form-field">
                <span>Courier or driver {['start_delivery', 'confirm_delivery'].includes(action) ? <b>Required</b> : <i>Optional</i>}</span>
                <input value={values.dispatchCourierOrDriver} onChange={event => set('dispatchCourierOrDriver', event.target.value)} placeholder="Courier, driver or delivery provider" />
                <FieldError message={errors.dispatchCourierOrDriver} />
              </label>
            )}
            {isDelivery && !isProblem && (
              <label className="form-field">
                <span>Tracking reference <i>Optional</i></span>
                <input value={values.dispatchTrackingReference} onChange={event => set('dispatchTrackingReference', event.target.value)} placeholder="Courier or internal tracking reference" />
                <FieldError message={errors.dispatchTrackingReference} />
              </label>
            )}
            {!isProblem && (
              <label className="form-field">
                <span>Delivery note number <i>Optional</i></span>
                <input value={values.dispatchDeliveryNoteNumber} onChange={event => set('dispatchDeliveryNoteNumber', event.target.value)} placeholder="Controlled delivery note reference" />
                <FieldError message={errors.dispatchDeliveryNoteNumber} />
              </label>
            )}
            {isConfirmation && (
              <label className="form-field">
                <span>{record?.fulfilment === 'collect' ? 'Collected by' : 'Recipient name'} <b>Required</b></span>
                <input value={values.dispatchRecipientName} onChange={event => set('dispatchRecipientName', event.target.value)} placeholder={record?.fulfilment === 'collect' ? 'Person who collected the order' : 'Person who received the delivery'} />
                <FieldError message={errors.dispatchRecipientName} />
              </label>
            )}
          </div>
          {isProblem && (
            <label className="form-field">
              <span>Delivery problem <b>Required</b></span>
              <textarea rows="4" value={values.dispatchProblemReason} onChange={event => set('dispatchProblemReason', event.target.value)} placeholder="Describe the delivery problem and the follow-up required." />
              <FieldError message={errors.dispatchProblemReason} />
            </label>
          )}
        </div>
      )}

      {showProof && (
        <div className="dispatch-field-group is-proof">
          <div className="dispatch-field-heading"><span>03</span><div><strong>Proof of handover</strong><small>Optional controlled metadata. The browser preview does not retain file contents.</small></div></div>
          <div className="form-grid dispatch-proof-grid">
            <label className="form-field">
              <span>Proof type <i>Optional</i></span>
              <select value={values.dispatchProofType} onChange={event => set('dispatchProofType', event.target.value)}>
                <option value="">No proof recorded</option>
                {proofTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
              <FieldError message={errors.dispatchProofType} />
            </label>
            <label className="form-field">
              <span>Proof reference <i>Optional</i></span>
              <input value={values.dispatchProofReference} onChange={event => set('dispatchProofReference', event.target.value)} placeholder="Controlled document or image reference" />
              <FieldError message={errors.dispatchProofReference} />
            </label>
            <label className="form-field dispatch-proof-file">
              <span>Proof file <i>Optional</i></span>
              <input type="file" accept=".pdf,image/*" onChange={event => set('dispatchProofFile', event.target.files?.[0] || null)} />
              {values.dispatchProofFile && <small>{values.dispatchProofFile.name} · {Math.ceil(Number(values.dispatchProofFile.size || 0) / 1024)} KB</small>}
              <small>PDF or image, maximum {Math.floor(maxProofBytes / 1024 / 1024)} MB.</small>
              <FieldError message={errors.dispatchProofFile} />
            </label>
          </div>
        </div>
      )}

      <div className="dispatch-field-group is-communication">
        <div className="dispatch-field-heading"><span>{showProof ? '04' : '03'}</span><div><strong>Communication</strong><small>The customer message is shared externally; internal notes remain staff-only.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Customer-facing message <b>Required</b></span>
            <textarea rows="4" value={values.dispatchCustomerMessage} onChange={event => set('dispatchCustomerMessage', event.target.value)} placeholder="Explain this Dispatch update clearly." />
            <FieldError message={errors.dispatchCustomerMessage} />
          </label>
          <label className="form-field">
            <span>Internal notes <i>Optional · never shown to customers</i></span>
            <textarea rows="4" value={values.dispatchInternalNotes} onChange={event => set('dispatchInternalNotes', event.target.value)} placeholder="Internal driver, packaging, exception or follow-up detail." />
            <FieldError message={errors.dispatchInternalNotes} />
          </label>
        </div>
      </div>
    </div>
  );
}
