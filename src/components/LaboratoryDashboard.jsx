import { useMemo, useState } from 'react';
import { certificateQueueForOrders, laboratoryMonthlyTracker } from '../domain/certification.js';
import { accountCan, friendlyServiceError, PERMISSIONS } from '../services/contracts.js';
import { StatusBadge } from './StatusBadge.jsx';

const humanise = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const dateTime = value => value ? new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
const isTemperature = (unit, item) => /temperature|thermo/i.test(`${unit.productName} ${item?.name || ''} ${item?.category || ''}`);

const defaultForm = (order, unit, item, options) => {
  const temperature = isTemperature(unit, item);
  const methodId = temperature ? 'temperature_comparison' : 'pressure_master_gauge_comparison';
  const standard = options.referenceStandards?.find(candidate => candidate.branchId === (unit.labWork?.branchId || 'cape_town') && candidate.approvedMethods.includes(methodId));
  return {
    branchId: unit.labWork?.branchId || order.laboratory?.branchId || 'cape_town',
    conditionOnReceipt: 'Satisfactory for fabricated demonstration', packageCondition: 'Satisfactory', numberOfUnits: 1, customerDocumentsReceived: true,
    ambientTemperature: '21', equilibriumConfirmed: false, stabilisationNotes: '',
    inspectionOutcome: 'no_visible_defect', inspectionReason: '',
    instrumentDescription: unit.productName || item?.name || 'Fabricated calibration instrument', manufacturer: 'Fabricated manufacturer', model: 'DEMO-MODEL', serialNumber: unit.serialNumber || `DEMO-SERIAL-${unit.unitNumber}`,
    assetNumber: '', rangeMinimum: temperature ? '-20' : '0', rangeMaximum: temperature ? '100' : '10', unit: temperature ? '°C' : 'bar', resolution: temperature ? '0.1' : '0.01', methodId,
    calibrationType: 'full', sanasOrTraceable: unit.certificationType, urgent: order.emergency === 'yes' || order.priority === 'urgent',
    standardIds: standard ? [standard.id] : [], coverageFactor: '2', decimals: '6', environmentalTemperature: '21', environmentalHumidity: '50', holdReason: '',
    testPoints: temperature ? [
      { id: 'point-1', applied: '-20', standardCorrection: '0.02', direction: 'temperature', readings: '-20.01, -20.02, -20.00, -20.01, -20.02, -20.01' },
      { id: 'point-2', applied: '100', standardCorrection: '-0.03', direction: 'temperature', readings: '99.98, 99.99, 99.97, 99.98, 99.99, 99.98' },
    ] : [
      { id: 'point-1', applied: '0', standardCorrection: '0', direction: 'increasing', readings: '0, 0' },
      { id: 'point-2', applied: '5', standardCorrection: '0', direction: 'increasing', readings: '5.01, 5.00, 5.01, 5.00, 5.01' },
      { id: 'point-3', applied: '10', standardCorrection: '0', direction: 'decreasing', readings: '10.01, 10.00' },
    ],
    uncertaintyContributions: [
      { source: 'Reference standard', type: 'B', uncertainty: temperature ? '0.10' : '0.04', distribution: 'normal', divisor: '2', sensitivity: '1', degreesOfFreedom: '200' },
      { source: 'Resolution of unit under test', type: 'B', uncertainty: temperature ? '0.10' : '0.01', distribution: 'rectangular', divisor: '1.7320508', sensitivity: '1', degreesOfFreedom: '12.5' },
      { source: 'Repeatability', type: 'A', uncertainty: '0.01', distribution: 'normal', divisor: '1', sensitivity: '1', degreesOfFreedom: '5' },
    ],
    formulaReason: '', technicianConfirmed: false, calibrationResult: 'Fabricated structured calibration completed',
    calibrationLabelApplied: false, identificationChecked: false, sealApplied: false, calibrationDate: new Date().toISOString().slice(0, 10), recalibrationDate: '', checkedBy: '',
    bomSignedOff: false, numberOfPackages: '1', destination: 'dispatch', releaseNote: '',
    technicianId: '', assignmentReason: '', reviewComment: '', correctionReason: '', managementConfirmed: false, signatoryName: '', issue: 'Issue 1',
    signedFile: null, signedIssueDate: new Date().toISOString().slice(0, 10), signedReason: '', recipientRule: 'customer_and_representative',
  };
};

const readingList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean).map(Number);
const worksheetPayload = form => ({
  methodId: form.methodId,
  standardIds: form.standardIds,
  coverageFactor: Number(form.coverageFactor), decimals: Number(form.decimals),
  environmental: { temperature: form.environmentalTemperature, humidity: form.environmentalHumidity },
  testPoints: form.testPoints.map(point => ({ ...point, applied: Number(point.applied), standardCorrection: Number(point.standardCorrection || 0), readings: readingList(point.readings) })),
  uncertaintyContributions: form.uncertaintyContributions.map(item => ({ ...item, uncertainty: Number(item.uncertainty), divisor: Number(item.divisor), sensitivity: Number(item.sensitivity), degreesOfFreedom: Number(item.degreesOfFreedom) })),
});

export function LaboratoryDashboard({ account, orders, laboratoryActions, laboratoryOptions = {}, serviceMode, onRecordsChanged, focusRecordId }) {
  const [tab, setTab] = useState('queue');
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [discipline, setDiscipline] = useState('all');
  const [status, setStatus] = useState('active');
  const [technician, setTechnician] = useState('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [openUnitId, setOpenUnitId] = useState(focusRecordId || '');
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const certificateQueue = useMemo(() => certificateQueueForOrders(orders), [orders]);
  const monthly = useMemo(() => laboratoryMonthlyTracker(orders, period), [orders, period]);
  const units = useMemo(() => orders.flatMap(order => (order.laboratory?.units || []).map(unit => ({ order, unit, item: (order.items || []).find(item => (item.lineId || item.id) === unit.lineItemId) }))), [orders]);
  const filteredUnits = useMemo(() => {
    const term = query.trim().toLowerCase();
    const managementStatuses = ['calculation_review_required', 'draft_certificate_ready', 'management_review', 'management_changes_required', 'approved_for_signature', 'awaiting_signed_certificate', 'signed_certificate_uploaded'];
    return units.filter(({ order, unit, item }) => {
      const workflowStatus = unit.labWork?.status || 'awaiting_lab_receipt';
      const method = laboratoryOptions.methods?.find(candidate => candidate.id === (unit.labWork?.worksheet?.methodId || unit.labWork?.booking?.methodId));
      const statusMatches = status === 'all' || status === 'active' && !['certificate_released', 'completed', 'archived'].includes(workflowStatus) || status === 'management' && managementStatuses.includes(workflowStatus) || status === workflowStatus;
      return (branch === 'all' || unit.labWork?.branchId === branch)
        && (discipline === 'all' || method?.discipline === discipline || !method && (discipline === 'temperature') === isTemperature(unit, item))
        && (technician === 'all' || unit.labWork?.assignedTechnicianId === technician)
        && (!urgentOnly || order.emergency === 'yes' || order.priority === 'urgent')
        && statusMatches
        && (!term || [order.reference, order.company, order.contact, order.internalJobNumber, order.customerPoNumber, unit.jobNumber, unit.certificateNumber, unit.serialNumber, unit.productName].some(value => String(value || '').toLowerCase().includes(term)));
    });
  }, [branch, discipline, laboratoryOptions.methods, query, status, technician, units, urgentOnly]);
  const counts = useMemo(() => ({
    awaiting: units.filter(({ unit }) => unit.labWork?.status === 'awaiting_lab_receipt').length,
    stabilising: units.filter(({ unit }) => unit.labWork?.status === 'thermal_stabilisation').length,
    active: units.filter(({ unit }) => ['worksheet_ready', 'calibration_in_progress', 'calculation_review_required'].includes(unit.labWork?.status)).length,
    management: units.filter(({ unit }) => ['management_review', 'draft_certificate_ready', 'approved_for_signature', 'awaiting_signed_certificate', 'signed_certificate_uploaded'].includes(unit.labWork?.status)).length,
    warnings: units.filter(({ unit }) => unit.labWork?.calculation?.warnings?.length).length,
    backlog: units.filter(({ unit }) => unit.certificateStatus !== 'verified').length,
  }), [units]);

  const formFor = (order, unit, item) => forms[unit.id] || defaultForm(order, unit, item, laboratoryOptions);
  const setForm = (order, unit, item, key, value) => setForms(current => ({ ...current, [unit.id]: { ...formFor(order, unit, item), [key]: value } }));
  const setPoint = (order, unit, item, pointIndex, key, value) => {
    const form = formFor(order, unit, item);
    const testPoints = form.testPoints.map((point, index) => index === pointIndex ? { ...point, [key]: value } : point);
    setForms(current => ({ ...current, [unit.id]: { ...form, testPoints } }));
  };
  const run = async (key, operation, success, download = false) => {
    setBusy(key); setError(''); setMessage('');
    try {
      const result = await operation();
      if (download && result?.dataUrl) { const anchor = document.createElement('a'); anchor.href = result.dataUrl; anchor.download = result.fileName || 'laboratory-document.pdf'; anchor.click(); }
      await onRecordsChanged?.(); setMessage(success);
    } catch (runError) { setError(friendlyServiceError(runError, 'The Laboratory action could not be completed.')); }
    finally { setBusy(''); }
  };

  const actions = { account, laboratoryActions, run, busy, formFor, setForm, setPoint };

  return (
    <section className="app-screen operations-desktop laboratory-screen lab-control-centre" aria-labelledby="laboratory-title">
      <header className="operations-hero laboratory-hero">
        <div><span className="eyebrow">{serviceMode === 'mock' ? 'Fabricated data · ' : ''}Rhomberg Laboratory Operations</span><h1 id="laboratory-title">Calibrate with evidence.<br /><em>Release with control.</em></h1><p>Unit-level receipt, inspection, structured worksheets, calculation review, certificate signing and release for Cape Town and Johannesburg.</p></div>
        <div className="operations-owner"><span>{account.contact}</span><small>{humanise(account.role)} · {account.labBranchId ? humanise(account.labBranchId) : 'Authorised scope'}</small></div>
      </header>

      <div className="operations-metrics lab-kpis"><Metric label="Awaiting receipt" value={counts.awaiting} /><Metric label="Stabilising" value={counts.stabilising} /><Metric label="Calibration work" value={counts.active} /><Metric label="Management review" value={counts.management} /><Metric label="Formula warnings" value={counts.warnings} alert /><Metric label="Certificate backlog" value={counts.backlog} /></div>

      <div className="lab-validation-banner"><strong>Technical validation required</strong><span>Legacy external links and formula inconsistencies are preserved as review warnings. This software does not claim SANAS approval.</span></div>

      <nav className="lab-section-tabs" aria-label="Laboratory workspace sections">
        {[['queue', 'Laboratory queue'], ['management', 'Management review'], ['certificates', 'Certificates'], ['standards', 'Reference standards'], ['monthly', 'Monthly tracker']].map(([id, label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => { setTab(id); if (id === 'management') setStatus('management'); }}>{label}</button>)}
      </nav>

      {['queue', 'management'].includes(tab) && <>
        <div className="lab-toolbar">
          <label className="wide"><span>Search jobs and units</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Order, job, certificate, customer, serial number…" /></label>
          <label><span>Laboratory</span><select value={branch} onChange={event => setBranch(event.target.value)}><option value="all">All authorised</option>{laboratoryOptions.branches?.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Discipline</span><select value={discipline} onChange={event => setDiscipline(event.target.value)}><option value="all">Pressure and temperature</option><option value="pressure">Pressure</option><option value="temperature">Temperature</option></select></label>
          <label><span>Stage</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="active">Active work</option><option value="management">Management attention</option><option value="awaiting_lab_receipt">Awaiting receipt</option><option value="thermal_stabilisation">Thermal stabilisation</option><option value="calibration_in_progress">Calibration in progress</option><option value="all">All stages</option></select></label>
          <label><span>Technician</span><select value={technician} onChange={event => setTechnician(event.target.value)}><option value="all">All technicians</option>{laboratoryOptions.staff?.filter(item => item.roles.some(role => role.includes('technician'))).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="lab-check"><input type="checkbox" checked={urgentOnly} onChange={event => setUrgentOnly(event.target.checked)} /><span>Urgent only</span></label>
        </div>
        {(error || message) && <p className={`operations-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</p>}
        <div className="lab-job-list">
          {filteredUnits.map(({ order, unit, item }) => <UnitWorkspace key={unit.id} order={order} unit={unit} item={item} open={openUnitId === unit.id} onOpen={() => setOpenUnitId(current => current === unit.id ? '' : unit.id)} options={laboratoryOptions} actions={actions} />)}
          {!filteredUnits.length && <div className="operations-empty"><strong>No Laboratory units match these filters</strong><p>Clear the filters or confirm the unit’s branch and method assignment.</p></div>}
        </div>
      </>}

      {tab === 'certificates' && <CertificateRegister units={certificateQueue} onOpen={unit => { setOpenUnitId(unit.id); setTab('queue'); setStatus('all'); }} />}
      {tab === 'standards' && <ReferenceStandards standards={laboratoryOptions.referenceStandards || []} />}
      {tab === 'monthly' && <MonthlyTracker monthly={monthly} period={period} onPeriod={setPeriod} units={units} />}
    </section>
  );
}

function UnitWorkspace({ order, unit, item, open, onOpen, options, actions }) {
  const workflow = unit.labWork || {};
  const form = actions.formFor(order, unit, item);
  const set = (key, value) => actions.setForm(order, unit, item, key, value);
  const call = (key, operation, success, download = false) => actions.run(`${unit.id}-${key}`, operation, success, download);
  const allowedStandards = (options.referenceStandards || []).filter(standard => standard.branchId === (workflow.branchId || form.branchId) && standard.approvedMethods.includes(form.methodId));
  const disabled = Boolean(actions.busy);
  return <article className={`lab-job-card ${open ? 'is-open' : ''}`}>
    <button type="button" className="lab-job-summary" onClick={onOpen}>
      <span><small>{order.reference} · Unit {unit.unitNumber}</small><strong>{unit.productName}</strong><em>{order.company}</em></span>
      <span><small>Job / certificate</small><strong>{unit.jobNumber || 'Pending'} / {unit.certificateNumber || 'Pending'}</strong><em>{unit.serialNumber || 'Serial pending'}</em></span>
      <span><small>Laboratory</small><strong>{humanise(workflow.branchId || 'unassigned')}</strong><em>{humanise(workflow.status || 'awaiting_lab_receipt')}</em></span>
      <StatusBadge as="b" status={workflow.status} label={humanise(workflow.status)} className="status-pill" />
    </button>
    {open && <div className="lab-unit-workspace">
      <dl className="operations-facts"><div><dt>Customer contact</dt><dd>{order.contact}</dd></div><div><dt>Representative</dt><dd>{order.selectedRep?.name || 'Unassigned'}</dd></div><div><dt>PO number</dt><dd>{order.customerPoNumber || order.planning?.customerPoNumber || 'Not recorded'}</dd></div><div><dt>Priority</dt><dd>{form.urgent ? 'Urgent' : 'Standard'}</dd></div></dl>
      <StagePanel order={order} unit={unit} item={item} form={form} set={set} setPoint={(index, key, value) => actions.setPoint(order, unit, item, index, key, value)} options={options} allowedStandards={allowedStandards} actions={actions.laboratoryActions} call={call} account={actions.account} disabled={disabled} />
      <DocumentCentre documents={workflow.documents || []} onDownload={document => call(`download-${document.id}`, () => actions.laboratoryActions.downloadLabDocument(document.id), 'Laboratory document download prepared and audited.', true)} disabled={disabled} />
      {(workflow.events || []).length > 0 && <details className="lab-unit-history"><summary>Unit audit timeline ({workflow.events.length})</summary>{workflow.events.slice().reverse().map(event => <div key={event.id}><strong>{humanise(event.eventType)}</strong><span>{event.previousStatus} → {event.newStatus}</span><small>{dateTime(event.createdAt)} · {event.actorName}</small></div>)}</details>}
    </div>}
  </article>;
}

function StagePanel({ order, unit, form, set, setPoint, options, allowedStandards, actions, call, account, disabled }) {
  const status = unit.labWork?.status || 'awaiting_lab_receipt';
  const can = permission => accountCan(account, permission);
  const download = result => result;
  if (status === 'awaiting_lab_receipt') return <ActionCard title="Confirm receipt in Laboratory" description="Record the physical handover before thermal stabilisation."><FormGrid><Select label="Laboratory branch" value={form.branchId} onChange={value => set('branchId', value)} options={options.branches || []} /><Input label="Condition on receipt" value={form.conditionOnReceipt} onChange={value => set('conditionOnReceipt', value)} /><Input label="Package condition" value={form.packageCondition} onChange={value => set('packageCondition', value)} /><Input label="Number of units" type="number" value={form.numberOfUnits} onChange={value => set('numberOfUnits', value)} /></FormGrid><Primary disabled={disabled || !can(PERMISSIONS.RECEIVE_LAB_ORDER)} onClick={() => call('receive', () => actions.receive(order.id, unit.id, form), 'Unit received and audited.')}>Confirm Received in Laboratory</Primary></ActionCard>;
  if (status === 'received_in_lab') return <ActionCard title="Thermal stabilisation" description="Calibration cannot start until equilibrium is confirmed."><Input label="Ambient temperature (°C)" type="number" value={form.ambientTemperature} onChange={value => set('ambientTemperature', value)} /><Primary disabled={disabled} onClick={() => call('stabilise', () => actions.startStabilisation(order.id, unit.id, { ambientTemperature: form.ambientTemperature, notes: form.stabilisationNotes }), 'Thermal stabilisation started.')}>Start Thermal Stabilisation</Primary></ActionCard>;
  if (status === 'thermal_stabilisation') return <ActionCard title="Confirm thermal equilibrium" description={`Started ${dateTime(unit.labWork.stabilisation?.startedAt)}`}><label className="lab-check"><input type="checkbox" checked={form.equilibriumConfirmed} onChange={event => set('equilibriumConfirmed', event.target.checked)} /><span>Thermal equilibrium reached</span></label><Primary disabled={disabled || !form.equilibriumConfirmed} onClick={() => call('equilibrium', () => actions.completeStabilisation(order.id, unit.id, { ambientTemperature: form.ambientTemperature, equilibriumConfirmed: form.equilibriumConfirmed, notes: form.stabilisationNotes }), 'Thermal equilibrium recorded.')}>Complete Stabilisation</Primary></ActionCard>;
  if (status === 'inspection_pending' || status === 'inspection_failed') return <ActionCard title="Pre-calibration inspection" description="Problems require a reason and produce a customer-safe escalation."><Select label="Inspection outcome" value={form.inspectionOutcome} onChange={value => set('inspectionOutcome', value)} options={(options.inspectionOutcomes || []).map(id => ({ id, label: humanise(id) }))} /><Textarea label="Finding or reason" value={form.inspectionReason} onChange={value => set('inspectionReason', value)} /><Primary disabled={disabled || !can(PERMISSIONS.INSPECT_LAB_UNIT)} onClick={() => call('inspect', () => actions.inspect(order.id, unit.id, { outcome: form.inspectionOutcome, reason: form.inspectionReason }), 'Inspection recorded and audited.')}>Record Inspection</Primary></ActionCard>;
  if (status === 'booked_in') return <ActionCard title="Structured booking-in" description="Order data is reused; complete only the physical instrument and method details."><FormGrid><Input label="Instrument description" value={form.instrumentDescription} onChange={value => set('instrumentDescription', value)} /><Input label="Manufacturer" value={form.manufacturer} onChange={value => set('manufacturer', value)} /><Input label="Model" value={form.model} onChange={value => set('model', value)} /><Input label="Serial number" value={form.serialNumber} onChange={value => set('serialNumber', value)} /><Input label="Range minimum" type="number" value={form.rangeMinimum} onChange={value => set('rangeMinimum', value)} /><Input label="Range maximum" type="number" value={form.rangeMaximum} onChange={value => set('rangeMaximum', value)} /><Input label="Unit" value={form.unit} onChange={value => set('unit', value)} /><Input label="Resolution" type="number" value={form.resolution} onChange={value => set('resolution', value)} /><Select label="Method" value={form.methodId} onChange={value => set('methodId', value)} options={options.methods || []} /></FormGrid><Primary disabled={disabled || !can(PERMISSIONS.BOOK_IN_LAB_UNIT)} onClick={() => call('book', () => actions.bookIn(order.id, unit.id, form), 'Job and certificate numbers assigned.')}>Book In Physical Unit</Primary></ActionCard>;
  if (['worksheet_ready', 'calibration_in_progress', 'calibration_on_hold', 'management_changes_required'].includes(status)) return <WorksheetCard form={form} set={set} setPoint={setPoint} standards={allowedStandards} unit={unit} order={order} actions={actions} call={call} account={account} disabled={disabled} />;
  if (status === 'calculation_review_required') return <ActionCard title="Calculation review required" description="The structured calculation is locked. Legacy-template warnings require management review before completion."><CalculationSummary calculation={unit.labWork.calculation} />{can(PERMISSIONS.REVIEW_RAW_LAB_DATA) && <Secondary disabled={disabled} onClick={() => call('review-pdf', () => actions.generateReviewPdf(order.id, unit.id), 'Internal review PDF generated.', true)}>Generate Internal Review PDF</Secondary>}{can(PERMISSIONS.APPROVE_CALCULATION_REVIEW) && <><Textarea label="Management formula-review reason" value={form.formulaReason} onChange={value => set('formulaReason', value)} /><Secondary disabled={disabled || form.formulaReason.length < 12} onClick={() => call('formula-review', () => actions.approveFormulaValidation(order.id, unit.id, { confirmed: true, reason: form.formulaReason }), 'Mock technical review recorded; formal approval remains required.')}>Record Management Review</Secondary></>}{can(PERMISSIONS.COMPLETE_LAB_CALIBRATION) && <><label className="lab-check"><input type="checkbox" checked={form.technicianConfirmed} onChange={event => set('technicianConfirmed', event.target.checked)} /><span>Technician confirms readings and repeatability are complete</span></label><Primary disabled={disabled || !form.technicianConfirmed} onClick={() => call('complete-calibration', () => actions.completeCalibration(order.id, unit.id, { technicianConfirmed: true, resultSummary: form.calibrationResult }), 'Calibration completed.')}>Complete Calibration</Primary></>}</ActionCard>;
  if (status === 'calibration_completed' || status === 'labelling_pending') return <ActionCard title="Labelling and identification" description="Record certificate labelling before physical transfer."><FormGrid><Input label="Calibration date" type="date" value={form.calibrationDate} onChange={value => set('calibrationDate', value)} /><Input label="Recalibration date" type="date" value={form.recalibrationDate} onChange={value => set('recalibrationDate', value)} /><Input label="Checked by" value={form.checkedBy} onChange={value => set('checkedBy', value)} /></FormGrid><label className="lab-check"><input type="checkbox" checked={form.calibrationLabelApplied} onChange={event => set('calibrationLabelApplied', event.target.checked)} /><span>Calibration label applied</span></label><label className="lab-check"><input type="checkbox" checked={form.identificationChecked} onChange={event => set('identificationChecked', event.target.checked)} /><span>Identification checked</span></label><Primary disabled={disabled || !form.calibrationLabelApplied || !form.identificationChecked} onClick={() => call('labelling', () => actions.completeLabelling(order.id, unit.id, form), 'Labelling completed.')}>Complete Labelling</Primary></ActionCard>;
  if (status === 'labelling_completed' || status === 'bom_signoff_pending') return <ActionCard title="Sign off and transfer to Dispatch" description="Certificate preparation remains active after the physical unit moves."><FormGrid><Select label="Receiving destination" value={form.destination} onChange={value => set('destination', value)} options={[{ id: 'dispatch', label: 'Dispatch' }, { id: 'expediting', label: 'Expediting' }]} /><Input label="Number of packages" type="number" value={form.numberOfPackages} onChange={value => set('numberOfPackages', value)} /></FormGrid><label className="lab-check"><input type="checkbox" checked={form.bomSignedOff} onChange={event => set('bomSignedOff', event.target.checked)} /><span>BOM or production record signed off</span></label><Textarea label="Internal transfer note" value={form.releaseNote} onChange={value => set('releaseNote', value)} /><Primary disabled={disabled || !form.bomSignedOff} onClick={() => call('dispatch', () => actions.releaseUnitToDispatch(order.id, unit.id, { bomSignedOff: true, destination: form.destination, numberOfPackages: form.numberOfPackages, internalNote: form.releaseNote }), 'Physical unit released to Dispatch.')}>Sign Off and Transfer to Dispatch</Primary></ActionCard>;
  return <CertificateWorkflow status={status} form={form} set={set} unit={unit} order={order} actions={actions} call={call} account={account} disabled={disabled} />;
}

function WorksheetCard({ form, set, setPoint, standards, unit, order, actions, call, account, disabled }) {
  const saved = Boolean(unit.labWork.worksheet);
  return <ActionCard title={`${humanise(form.methodId)} worksheet`} description="Raw inputs remain distinct from calculated and management-only fields. Readings accept comma-separated numeric values.">
    <FormGrid><Select label="Method template" value={form.methodId} onChange={value => set('methodId', value)} options={['pressure_master_gauge_comparison', 'pressure_dwt_700_bar', 'pressure_dwt_250_mpa', 'temperature_comparison'].map(id => ({ id, label: humanise(id) }))} /><Select label="Reference standard" value={form.standardIds[0] || ''} onChange={value => set('standardIds', value ? [value] : [])} options={standards} /><Input label="Ambient temperature" type="number" value={form.environmentalTemperature} onChange={value => set('environmentalTemperature', value)} /><Input label="Relative humidity" type="number" value={form.environmentalHumidity} onChange={value => set('environmentalHumidity', value)} /></FormGrid>
    <div className="lab-reading-table"><div className="lab-reading-head"><span>Direction</span><span>Applied value</span><span>Standard correction</span><span>Raw readings</span></div>{form.testPoints.map((point, index) => <div key={point.id} className="lab-reading-row"><select value={point.direction} onChange={event => setPoint(index, 'direction', event.target.value)}><option value="increasing">Increasing</option><option value="decreasing">Decreasing</option><option value="temperature">Temperature</option></select><input type="number" step="any" value={point.applied} onChange={event => setPoint(index, 'applied', event.target.value)} /><input type="number" step="any" value={point.standardCorrection} onChange={event => setPoint(index, 'standardCorrection', event.target.value)} /><input value={point.readings} onChange={event => setPoint(index, 'readings', event.target.value)} aria-label={`Readings for point ${index + 1}`} /></div>)}</div>
    <div className="lab-uncertainty-summary"><strong>Versioned uncertainty budget</strong>{form.uncertaintyContributions.map(item => <span key={item.source}>{item.type} · {item.source}: {item.uncertainty} ({item.distribution})</span>)}</div>
    {accountCan(account, PERMISSIONS.ENTER_RAW_CALIBRATION_DATA) && <Secondary disabled={disabled} onClick={() => call('worksheet', () => actions.saveWorksheet(order.id, unit.id, worksheetPayload(form)), 'Structured worksheet saved and audited.')}>Save Worksheet Draft</Secondary>}
    {saved && unit.labWork.status === 'worksheet_ready' && <Primary disabled={disabled || !accountCan(account, PERMISSIONS.START_LAB_CALIBRATION)} onClick={() => call('start', () => actions.startCalibration(order.id, unit.id, {}), 'Calibration started.')}>Start Calibration</Primary>}
    {saved && unit.labWork.status === 'calibration_on_hold' && <Primary disabled={disabled || !accountCan(account, PERMISSIONS.START_LAB_CALIBRATION)} onClick={() => call('resume', () => actions.startCalibration(order.id, unit.id, { note: 'Resumed after controlled hold' }), 'Calibration resumed.')}>Resume Calibration</Primary>}
    {unit.labWork.status === 'calibration_in_progress' && <><Textarea label="Reason to put calibration on hold" value={form.holdReason} onChange={value => set('holdReason', value)} /><Secondary disabled={disabled || form.holdReason.trim().length < 8 || !accountCan(account, PERMISSIONS.START_LAB_CALIBRATION)} onClick={() => call('hold', () => actions.holdCalibration(order.id, unit.id, { reason: form.holdReason }), 'Calibration placed on controlled hold.')}>Put Calibration on Hold</Secondary></>}
    {saved && unit.labWork.status === 'calibration_in_progress' && <Primary disabled={disabled || !accountCan(account, PERMISSIONS.ENTER_RAW_CALIBRATION_DATA)} onClick={() => call('calculate', () => actions.calculate(order.id, unit.id), 'Calculations completed; review is required.')}>Calculate and Lock Raw Data</Primary>}
  </ActionCard>;
}

function CertificateWorkflow({ status, form, set, unit, order, actions, call, account, disabled }) {
  const can = permission => accountCan(account, permission);
  if (status === 'released_to_dispatch') return <ActionCard title="Certificate compilation" description="The physical unit is with Dispatch; certificate work remains active.">{can(PERMISSIONS.REVIEW_RAW_LAB_DATA) && <Secondary disabled={disabled} onClick={() => call('review-pdf', () => actions.generateReviewPdf(order.id, unit.id), 'Internal review PDF generated.', true)}>Generate Review PDF</Secondary>}{can(PERMISSIONS.GENERATE_DRAFT_CERTIFICATE) && <Primary disabled={disabled} onClick={() => call('draft', () => actions.generateDraftCertificate(order.id, unit.id), 'Draft certificate generated.', true)}>Generate Draft Certificate</Primary>}</ActionCard>;
  if (status === 'draft_certificate_ready') return <ActionCard title="Draft certificate ready" description="The immutable draft is linked to the raw-data and calculation versions."><Textarea label="Review submission comment" value={form.reviewComment} onChange={value => set('reviewComment', value)} /><Primary disabled={disabled} onClick={() => call('submit-review', () => actions.submitCertificateForReview(order.id, unit.id, { comment: form.reviewComment }), 'Certificate submitted for management review.')}>Submit for Management Review</Primary></ActionCard>;
  if (status === 'management_review') return <ActionCard title="Management comparison and approval" description="Verify method, unit, range, serial number, standards, results, uncertainty and certificate number."><FormGrid><Input label="Technical signatory" value={form.signatoryName} onChange={value => set('signatoryName', value)} /><Input label="Certificate issue" value={form.issue} onChange={value => set('issue', value)} /></FormGrid><label className="lab-check"><input type="checkbox" checked={form.managementConfirmed} onChange={event => set('managementConfirmed', event.target.checked)} /><span>Management confirms the comparison checklist</span></label><Primary disabled={disabled || !form.managementConfirmed || !can(PERMISSIONS.APPROVE_CALCULATION_REVIEW)} onClick={() => call('approve-signature', () => actions.approveForSignature(order.id, unit.id, { confirmed: true, signatoryName: form.signatoryName, issue: form.issue }), 'Certificate approved for external signature.')}>Approve for Signature</Primary><Textarea label="Return reason" value={form.correctionReason} onChange={value => set('correctionReason', value)} /><Secondary disabled={disabled || form.correctionReason.length < 8} onClick={() => call('return', () => actions.returnCertificateForCorrection(order.id, unit.id, { reason: form.correctionReason }), 'Certificate returned for correction.')}>Return for Correction</Secondary></ActionCard>;
  if (status === 'management_changes_required') return <ActionCard title="Returned for technician correction" description="Previous raw and draft versions remain immutable. Save corrected raw data to create a new revision." />;
  if (status === 'approved_for_signature') return <ActionCard title="Generate final unsigned certificate" description="Download and sign only with Rhomberg’s approved external PDF signing process."><Primary disabled={disabled || !can(PERMISSIONS.GENERATE_DRAFT_CERTIFICATE)} onClick={() => call('unsigned', () => actions.generateUnsignedCertificate(order.id, unit.id), 'Unsigned certificate generated and audited.', true)}>Generate Final Unsigned PDF</Primary></ActionCard>;
  if (status === 'awaiting_signed_certificate') return <ActionCard title="Re-upload externally signed certificate" description="The uploaded PDF is hashed and stored unchanged. A visible signature image alone is not treated as cryptographic validation."><FormGrid><Input label="Certificate number" value={unit.certificateNumber || ''} readOnly /><Input label="Issue date" type="date" value={form.signedIssueDate} onChange={value => set('signedIssueDate', value)} /><label><span>Signed PDF</span><input type="file" accept="application/pdf,.pdf" onChange={event => set('signedFile', event.target.files?.[0] || null)} /></label></FormGrid><Primary disabled={disabled || !form.signedFile || !can(PERMISSIONS.UPLOAD_SIGNED_CERTIFICATE)} onClick={() => call('signed-upload', () => actions.uploadSignedCertificate(order.id, unit.id, { file: form.signedFile, certificateNumber: unit.certificateNumber, issueDate: form.signedIssueDate, reason: form.signedReason }), 'Signed PDF uploaded and hashed.')}>Upload Signed PDF</Primary></ActionCard>;
  if (status === 'signed_certificate_uploaded') return <ActionCard title="Final certificate release" description="Select the management-approved recipient rule."><Select label="Recipients" value={form.recipientRule} onChange={value => set('recipientRule', value)} options={[{ id: 'representative_only', label: 'Assigned representative only' }, { id: 'customer_and_representative', label: 'Customer and assigned representative' }]} /><Primary disabled={disabled || !can(PERMISSIONS.RELEASE_CERTIFICATE)} onClick={() => call('release-certificate', () => actions.releaseCertificate(order.id, unit.id, { recipientRule: form.recipientRule }), 'Certificate released and recipients notified.')}>Release Certificate</Primary></ActionCard>;
  return <ActionCard title={humanise(status)} description={status === 'certificate_released' ? `Released ${dateTime(unit.labWork.certificateWorkflow?.releasedAt)}` : 'Controlled Laboratory workflow stage.'} />;
}

function CalculationSummary({ calculation }) { return <div className="lab-calculation-summary"><div><small>Method version</small><strong>{calculation?.methodVersion}</strong></div><div><small>Test points</small><strong>{calculation?.points?.length || 0}</strong></div><div><small>Combined uncertainty</small><strong>{calculation?.uncertainty?.combinedUncertainty ?? '—'}</strong></div><div><small>Expanded uncertainty</small><strong>{calculation?.uncertainty?.expandedUncertainty ?? '—'}</strong></div>{calculation?.warnings?.map(warning => <p key={warning}>⚠ {warning}</p>)}</div>; }
function DocumentCentre({ documents, onDownload, disabled }) { return <details className="lab-document-centre"><summary>Laboratory document centre ({documents.length})</summary>{documents.length ? documents.map(document => <div key={document.id}><span><strong>{humanise(document.type)}</strong><small>{document.fileName} · Version {document.version} · {document.visibility}</small></span><button type="button" className="text-button" disabled={disabled} onClick={() => onDownload(document)}>Download</button></div>) : <p>No unit documents generated yet.</p>}</details>; }
function CertificateRegister({ units, onOpen }) { return <section className="lab-register-screen"><div className="operations-section-title"><div><span className="eyebrow">One certificate per physical unit</span><h2>Certificate register</h2></div><small>{units.length} records</small></div><div className="lab-register-table"><div className="lab-register-head"><span>Order / unit</span><span>Customer</span><span>Job number</span><span>Certificate</span><span>Status</span></div>{units.map(unit => <button key={unit.id} type="button" onClick={() => onOpen(unit)}><span>{unit.orderReference} · Unit {unit.unitNumber}</span><span>{unit.company}</span><span>{unit.jobNumber || 'Pending'}</span><span>{unit.certificateNumber || 'Pending'}</span><StatusBadge as="b" status={unit.certificateStatus} label={humanise(unit.certificateStatus)} className="status-pill" /></button>)}</div></section>; }
function ReferenceStandards({ standards }) { return <section className="lab-register-screen"><div className="operations-section-title"><div><span className="eyebrow">Fabricated mock register</span><h2>Reference standards</h2></div><small>Production documents remain private</small></div><div className="lab-standard-grid">{standards.map(standard => <article key={standard.id}><span className="eyebrow">{humanise(standard.branchId)}</span><h3>{standard.label}</h3><dl><div><dt>Range</dt><dd>{standard.rangeMinimum}–{standard.rangeMaximum} {standard.unit}</dd></div><div><dt>Resolution</dt><dd>{standard.resolution}</dd></div><div><dt>Expiry</dt><dd>{standard.expiryDate}</dd></div><div><dt>Status</dt><dd>{humanise(standard.status)}</dd></div></dl><p>{standard.approvedMethods.map(humanise).join(', ')}</p></article>)}</div></section>; }
function MonthlyTracker({ monthly, period, onPeriod, units }) { return <section className="lab-register-screen"><div className="operations-section-title"><div><span className="eyebrow">Unit-based measures</span><h2>Monthly Laboratory tracker</h2></div><input type="month" value={period} onChange={event => onPeriod(event.target.value)} /></div><div className="lab-monthly-grid"><Metric label="Orders represented" value={new Set(units.map(({ order }) => order.id)).size} /><Metric label="Physical units" value={units.length} /><Metric label="SANAS units completed" value={monthly.sanasUnitsProcessed} /><Metric label="Traceable units completed" value={monthly.traceableUnitsProcessed} /><Metric label="Certificates released/uploaded" value={monthly.sanasCertificatesUploaded + monthly.traceableCertificatesUploaded} /><Metric label="Outstanding certificates" value={monthly.certificatesPending} /><Metric label="Average calibration turnaround" value={`${monthly.averageTurnaroundHours}h`} /><Metric label="Urgent orders completed" value={monthly.urgentOrdersCompleted} /></div><p className="lab-method-note">Production metrics must be generated from immutable backend events. One certificate is counted per calibrated physical unit.</p></section>; }

function Metric({ label, value, alert }) { return <article className={alert && Number(value) > 0 ? 'is-alert' : ''}><strong>{value ?? 0}</strong><span>{label}</span></article>; }
function ActionCard({ title, description, children }) { return <section className="lab-action-card"><div><span className="eyebrow">Current action</span><h3>{title}</h3><p>{description}</p></div>{children && <div className="lab-action-body">{children}</div>}</section>; }
function FormGrid({ children }) { return <div className="lab-form-grid">{children}</div>; }
function Input({ label, value, onChange, type = 'text', readOnly = false }) { return <label><span>{label}</span><input type={type} step={type === 'number' ? 'any' : undefined} value={value ?? ''} readOnly={readOnly} onChange={event => onChange?.(event.target.value)} /></label>; }
function Textarea({ label, value, onChange }) { return <label className="wide"><span>{label}</span><textarea rows="3" value={value || ''} onChange={event => onChange(event.target.value)} /></label>; }
function Select({ label, value, onChange, options }) { return <label><span>{label}</span><select value={value || ''} onChange={event => onChange(event.target.value)}><option value="">Select…</option>{options.map(option => <option key={option.id} value={option.id}>{option.label || option.name}</option>)}</select></label>; }
function Primary({ children, ...props }) { return <button type="button" className="primary-button" {...props}>{children}</button>; }
function Secondary({ children, ...props }) { return <button type="button" className="secondary-button" {...props}>{children}</button>; }
