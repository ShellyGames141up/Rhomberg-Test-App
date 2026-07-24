import {
  EXPEDITOR_DOCUMENT_TYPES,
  EXPEDITOR_PROGRESS_STEPS,
  expeditorProgressStepById,
  expeditorUpdateSteps,
  missingRequiredExpeditorSteps,
} from '../domain/expediting.js';

const ACTION_COPY = Object.freeze({
  start_expediting: {
    step: 'planning_received',
    message: 'Your planned order has been received and Expediting has started work.',
  },
  add_expediting_update: {
    message: 'Progress on your order has been updated.',
  },
  place_on_hold: {
    step: 'on_hold',
    message: 'Your order has been placed on hold while we resolve an outstanding requirement.',
  },
  resume_order: {
    message: 'Work on your order has resumed.',
  },
  complete_expediting: {
    step: 'ready_for_dispatch',
    message: 'Your order has completed Expediting and is moving to Dispatch.',
  },
});

export const isExpeditingOwnedOrder = record => (
  ['submitted_to_expediting', 'expediting_in_progress'].includes(record?.trackingStatus)
  || (
    record?.trackingStatus === 'on_hold'
    && ['submitted_to_expediting', 'expediting_in_progress'].includes(record?.workflowContext?.resumeStatus)
  )
);

export const expeditingActionDataFor = (record, options = {}, action, changes = {}) => {
  const expediting = record?.expediting || {};
  const steps = options.progressSteps?.length ? options.progressSteps : EXPEDITOR_PROGRESS_STEPS;
  const normalSteps = expeditorUpdateSteps(steps);
  const preferredResumeStep = record?.workflowContext?.expeditingResumeStep || expediting.currentStep;
  const currentStepDefinition = steps.find(item => item.id === expediting.currentStep)
    || expeditorProgressStepById(expediting.currentStep);
  const resumeStepDefinition = steps.find(item => item.id === preferredResumeStep)
    || expeditorProgressStepById(preferredResumeStep);
  const preferredUpdateStep = currentStepDefinition.selectableForUpdate
    ? expediting.currentStep
    : normalSteps[0]?.id || 'materials_checked';
  const configuredStep = ACTION_COPY[action]?.step
    || (action === 'resume_order' && preferredResumeStep && !resumeStepDefinition.operational
      ? preferredResumeStep
      : preferredUpdateStep);
  const base = {
    expeditingProgressStep: configuredStep,
    expeditingCustomerMessage: ACTION_COPY[action]?.message || 'Progress on your order has been updated.',
    expeditingInternalNote: '',
    expeditingEstimatedCompletionDate: expediting.estimatedCompletionDate || record?.planning?.estimatedCompletionDate || '',
    expeditingDelayReason: '',
    expeditingDocumentType: '',
    expeditingDocumentReference: '',
    expeditingCompletionCheckConfirmed: false,
    expeditingReadyExceptionAuthorised: false,
    expeditingReadyExceptionReason: '',
    expeditingReadyExceptionReference: '',
  };
  return { ...base, ...changes };
};

const FieldError = ({ message }) => message ? <small className="field-error">{message}</small> : null;

export function ExpeditingFields({ action, record, options = {}, data, onChange, errors = {} }) {
  const values = expeditingActionDataFor(record, options, action, data);
  const steps = options.progressSteps?.length ? options.progressSteps : EXPEDITOR_PROGRESS_STEPS;
  const documentTypes = options.documentTypes?.length ? options.documentTypes : EXPEDITOR_DOCUMENT_TYPES;
  const updateSteps = action === 'resume_order'
    ? steps.filter(item => !item.operational)
    : expeditorUpdateSteps(steps);
  const selectedStep = steps.find(item => item.id === values.expeditingProgressStep)
    || expeditorProgressStepById(values.expeditingProgressStep);
  const requiredStepIds = options.requiredStepIds?.length
    ? options.requiredStepIds
    : EXPEDITOR_PROGRESS_STEPS.filter(item => item.requiredForDispatch).map(item => item.id);
  const missingBeforeHandoff = missingRequiredExpeditorSteps(record, requiredStepIds).filter(id => id !== 'ready_for_dispatch');
  const set = (key, value) => onChange(current => ({ ...current, [key]: value }));
  const fixedStep = ['start_expediting', 'place_on_hold', 'complete_expediting'].includes(action);
  const showDelay = ['add_expediting_update', 'place_on_hold', 'resume_order'].includes(action);
  const showHandoff = action === 'complete_expediting';

  return (
    <div className="expediting-form-fields">
      <p className="workflow-helper expediting-workflow-helper">
        <strong>Controlled Expediting update.</strong> The customer-facing message is shared with the customer and assigned representative. Internal notes remain restricted to authorised staff.
      </p>

      <div className="expediting-field-group is-progress">
        <div className="expediting-field-heading"><span>01</span><div><strong>Progress step</strong><small>Use the configured production and fulfilment sequence.</small></div></div>
        {fixedStep ? (
          <div className="expediting-fixed-step">
            <span>{String(selectedStep.sequence).padStart(2, '0')}</span>
            <div><strong>{selectedStep.label}</strong><small>{selectedStep.description}</small></div>
          </div>
        ) : (
          <label className="form-field">
            <span>Progress step <b>Required</b></span>
            <select value={values.expeditingProgressStep} onChange={event => set('expeditingProgressStep', event.target.value)}>
              {updateSteps.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <FieldError message={errors.expeditingProgressStep} />
          </label>
        )}
      </div>

      <div className="expediting-field-group is-communication">
        <div className="expediting-field-heading"><span>02</span><div><strong>Communication</strong><small>Keep customer and internal information clearly separated.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Customer-facing message <b>Required</b></span>
            <textarea rows="4" value={values.expeditingCustomerMessage} onChange={event => set('expeditingCustomerMessage', event.target.value)} placeholder="Explain the current progress in clear customer-friendly language." />
            <FieldError message={errors.expeditingCustomerMessage} />
          </label>
          <label className="form-field">
            <span>Internal note <i>Optional · never shown to customers</i></span>
            <textarea rows="4" value={values.expeditingInternalNote} onChange={event => set('expeditingInternalNote', event.target.value)} placeholder="Internal production, supplier, risk or hand-off context." />
            <FieldError message={errors.expeditingInternalNote} />
          </label>
        </div>
      </div>

      <div className="expediting-field-group is-schedule">
        <div className="expediting-field-heading"><span>03</span><div><strong>Completion and delay</strong><small>Update the current estimate and record any delay context.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Estimated completion date <i>Optional</i></span>
            <input type="date" value={values.expeditingEstimatedCompletionDate} onInput={event => set('expeditingEstimatedCompletionDate', event.target.value)} onChange={event => set('expeditingEstimatedCompletionDate', event.target.value)} />
            <FieldError message={errors.expeditingEstimatedCompletionDate} />
          </label>
          {showDelay && (
            <label className="form-field">
              <span>Reason for delay {action === 'place_on_hold' ? <b>Required</b> : <i>Optional</i>}</span>
              <textarea rows="3" value={values.expeditingDelayReason} onChange={event => set('expeditingDelayReason', event.target.value)} placeholder="Record the reason for delay or the condition causing the hold." />
              <FieldError message={errors.expeditingDelayReason} />
            </label>
          )}
        </div>
      </div>

      <div className="expediting-field-group is-reference">
        <div className="expediting-field-heading"><span>04</span><div><strong>Controlled reference</strong><small>Metadata only in the public preview; no file content is uploaded.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Reference type <i>Optional</i></span>
            <select value={values.expeditingDocumentType} onChange={event => set('expeditingDocumentType', event.target.value)}>
              <option value="">No document or image reference</option>
              {documentTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <FieldError message={errors.expeditingDocumentType} />
          </label>
          <label className="form-field">
            <span>Document or image reference <i>Optional</i></span>
            <input value={values.expeditingDocumentReference} onChange={event => set('expeditingDocumentReference', event.target.value)} placeholder="Example: QA-TEST-001 or controlled storage reference" />
            <FieldError message={errors.expeditingDocumentReference} />
          </label>
        </div>
      </div>

      {showHandoff && (
        <div className="expediting-field-group is-handoff">
          <div className="expediting-field-heading"><span>05</span><div><strong>Dispatch hand-off</strong><small>Required progress must be complete unless a controlled exception is recorded.</small></div></div>
          <div className="expediting-required-steps">
            {missingBeforeHandoff.length ? (
              <>
                <strong>{missingBeforeHandoff.length} required step{missingBeforeHandoff.length === 1 ? '' : 's'} still need evidence</strong>
                <div>{missingBeforeHandoff.map(id => <span key={id}>{steps.find(item => item.id === id)?.label || expeditorProgressStepById(id).label}</span>)}</div>
              </>
            ) : (
              <strong className="is-complete">All required production steps are recorded. This hand-off will add “Ready for dispatch”.</strong>
            )}
          </div>
          <label className="choice-row">
            <input type="checkbox" checked={Boolean(values.expeditingCompletionCheckConfirmed)} onChange={event => set('expeditingCompletionCheckConfirmed', event.target.checked)} />
            <span><strong>Confirm the Expeditor hand-off checks</strong><small>Confirm the order and available controlled records are ready for Dispatch.</small></span>
          </label>
          <FieldError message={errors.expeditingCompletionCheckConfirmed} />
          {missingBeforeHandoff.length > 0 && (
            <div className="expediting-exception">
              <label className="choice-row">
                <input type="checkbox" checked={Boolean(values.expeditingReadyExceptionAuthorised)} onChange={event => set('expeditingReadyExceptionAuthorised', event.target.checked)} />
                <span><strong>Record an authorised exception</strong><small>Use only where the missing steps were formally reviewed and approved.</small></span>
              </label>
              <FieldError message={errors.expeditingReadyExceptionAuthorised} />
              {values.expeditingReadyExceptionAuthorised && (
                <div className="form-grid">
                  <label className="form-field">
                    <span>Exception reason <b>Required</b></span>
                    <textarea rows="3" value={values.expeditingReadyExceptionReason} onChange={event => set('expeditingReadyExceptionReason', event.target.value)} />
                    <FieldError message={errors.expeditingReadyExceptionReason} />
                  </label>
                  <label className="form-field">
                    <span>Authorisation reference <b>Required</b></span>
                    <input value={values.expeditingReadyExceptionReference} onChange={event => set('expeditingReadyExceptionReference', event.target.value)} placeholder="Manager name, approval or controlled reference" />
                    <FieldError message={errors.expeditingReadyExceptionReference} />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
