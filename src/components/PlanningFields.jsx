const localDateValue = date => {
  const value = date instanceof Date ? date : new Date(date || Date.now());
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const planningActionDataFor = (record, account, options = {}, changes = {}) => {
  const planning = record?.planning || {};
  const currentUserIsAvailable = (options.users || []).some(user => user.id === account?.id);
  const defaultUserId = currentUserIsAvailable ? account.id : options.users?.[0]?.id || '';
  const base = {
    planningInternalJobNumber: planning.internalJobNumber || record?.internalJobNumber || '',
    planningCustomerPoNumber: planning.customerPoNumber || record?.customerPoNumber || record?.poNumber || '',
    planningPoExceptionAuthorised: Boolean(planning.customerPoException?.authorised),
    planningPoExceptionReason: planning.customerPoException?.reason || '',
    planningNotes: planning.notes || '',
    planningStartDate: planning.plannedStartDate || '',
    planningEstimatedCompletionDate: planning.estimatedCompletionDate || '',
    planningAssignedUserId: planning.assignedPlanningUserId || defaultUserId,
    planningProductionLocationId: planning.productionLocationId || '',
    planningPriority: planning.priority || (record?.emergency === 'yes' ? 'urgent' : 'standard'),
    planningSubmissionDate: planning.submissionDate || localDateValue(),
    planningDocumentReferences: (planning.documentReferences || []).join('\n'),
  };
  return { ...base, ...changes };
};

const FieldError = ({ message }) => message ? <small className="field-error">{message}</small> : null;

export function PlanningFields({ record, account, options = {}, data, onChange, errors = {} }) {
  const values = planningActionDataFor(record, account, options, data);
  const set = (key, value) => onChange(current => ({ ...current, [key]: value }));
  const hasCustomerPo = Boolean(values.planningCustomerPoNumber.trim());

  return (
    <div className="planning-form-fields">
      <p className="workflow-helper planning-workflow-helper">
        <strong>Internal Planning record.</strong> Customers receive only the appropriate workflow update. Job numbers, notes, scheduling details and internal document references remain restricted.
      </p>

      <div className="planning-field-group is-identifiers">
        <div className="planning-field-group-heading"><span>01</span><div><strong>Required references</strong><small>Identify the internal job and the customer instruction.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Internal job number <b>Required</b></span>
            <input value={values.planningInternalJobNumber} onChange={event => set('planningInternalJobNumber', event.target.value)} placeholder="Example: JOB-TEST-1024" />
            <FieldError message={errors.planningInternalJobNumber} />
          </label>
          <label className="form-field">
            <span>Customer Purchase Order number</span>
            <input value={values.planningCustomerPoNumber} onChange={event => set('planningCustomerPoNumber', event.target.value)} placeholder="Enter PO number when available" />
            <FieldError message={errors.planningCustomerPoNumber} />
          </label>
        </div>
        {!hasCustomerPo && (
          <div className="planning-po-exception">
            <label className="choice-row">
              <input type="checkbox" checked={Boolean(values.planningPoExceptionAuthorised)} onChange={event => set('planningPoExceptionAuthorised', event.target.checked)} />
              <span><strong>Record an authorised PO exception</strong><small>Use only where Planning is formally authorised to proceed without a customer PO number.</small></span>
            </label>
            <FieldError message={errors.planningPoExceptionAuthorised} />
            {values.planningPoExceptionAuthorised && (
              <label className="form-field">
                <span>Authorised exception reason <b>Required</b></span>
                <textarea rows="3" value={values.planningPoExceptionReason} onChange={event => set('planningPoExceptionReason', event.target.value)} placeholder="Record why the order may proceed and where the authorisation is held." />
                <FieldError message={errors.planningPoExceptionReason} />
              </label>
            )}
          </div>
        )}
      </div>

      <div className="planning-field-group is-ownership">
        <div className="planning-field-group-heading"><span>02</span><div><strong>Ownership and routing</strong><small>Assign the planner, location and operational priority.</small></div></div>
        <div className="form-grid planning-form-grid-three">
          <label className="form-field">
            <span>Assigned Planning user <b>Required</b></span>
            <select value={values.planningAssignedUserId} onChange={event => set('planningAssignedUserId', event.target.value)}>
              <option value="">Select Planning user</option>
              {(options.users || []).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <FieldError message={errors.planningAssignedUserId} />
          </label>
          <label className="form-field">
            <span>Production location / branch <i>Optional</i></span>
            <select value={values.planningProductionLocationId} onChange={event => set('planningProductionLocationId', event.target.value)}>
              <option value="">To be confirmed</option>
              {(options.locations || []).map(location => <option key={location.id} value={location.id}>{location.name} · {location.role}</option>)}
            </select>
            <FieldError message={errors.planningProductionLocationId} />
          </label>
          <label className="form-field">
            <span>Priority</span>
            <select value={values.planningPriority} onChange={event => set('planningPriority', event.target.value)}>
              {(options.priorities || []).map(priority => <option key={priority.id} value={priority.id}>{priority.label}</option>)}
            </select>
            <FieldError message={errors.planningPriority} />
          </label>
        </div>
      </div>

      <div className="planning-field-group is-schedule">
        <div className="planning-field-group-heading"><span>03</span><div><strong>Schedule</strong><small>Record when Planning submitted the plan and any expected dates.</small></div></div>
        <div className="form-grid planning-form-grid-three">
          <label className="form-field">
            <span>Planning submission date <b>Required</b></span>
            <input type="date" value={values.planningSubmissionDate} onInput={event => set('planningSubmissionDate', event.target.value)} onChange={event => set('planningSubmissionDate', event.target.value)} />
            <FieldError message={errors.planningSubmissionDate} />
          </label>
          <label className="form-field">
            <span>Planned start date <i>Optional</i></span>
            <input type="date" value={values.planningStartDate} onInput={event => set('planningStartDate', event.target.value)} onChange={event => set('planningStartDate', event.target.value)} />
            <FieldError message={errors.planningStartDate} />
          </label>
          <label className="form-field">
            <span>Estimated completion <i>Optional</i></span>
            <input type="date" value={values.planningEstimatedCompletionDate} onInput={event => set('planningEstimatedCompletionDate', event.target.value)} onChange={event => set('planningEstimatedCompletionDate', event.target.value)} />
            <FieldError message={errors.planningEstimatedCompletionDate} />
          </label>
        </div>
      </div>

      <div className="planning-field-group is-notes">
        <div className="planning-field-group-heading"><span>04</span><div><strong>Planning detail</strong><small>Add operational notes and references without uploading sensitive files to the preview.</small></div></div>
        <div className="form-grid">
          <label className="form-field">
            <span>Planning notes <i>Optional</i></span>
            <textarea rows="4" value={values.planningNotes} onChange={event => set('planningNotes', event.target.value)} placeholder="Production, material, scheduling or hand-off notes for authorised staff." />
            <FieldError message={errors.planningNotes} />
          </label>
          <label className="form-field">
            <span>Document references <i>Optional · one per line</i></span>
            <textarea rows="4" value={values.planningDocumentReferences} onChange={event => set('planningDocumentReferences', event.target.value)} placeholder={'Internal reference only\nSharePoint or document-control reference'} />
            <FieldError message={errors.planningDocumentReferences} />
          </label>
        </div>
      </div>
    </div>
  );
}
