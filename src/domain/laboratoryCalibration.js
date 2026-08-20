import { ServiceError } from '../services/contracts.js';

export const LABORATORY_BRANCHES = Object.freeze([
  Object.freeze({ id: 'cape_town', label: 'Cape Town Laboratory', branchId: 'cape-town' }),
  Object.freeze({ id: 'johannesburg', label: 'Johannesburg Laboratory', branchId: 'johannesburg' }),
]);

export const LABORATORY_ROLES = Object.freeze({
  TECHNICIAN: 'laboratory_technician',
  TEMPERATURE_TECHNICIAN: 'laboratory_temperature_technician',
  MANAGER: 'laboratory_manager',
  TECHNICAL_SIGNATORY: 'technical_signatory',
  ADMINISTRATOR: 'laboratory_administrator',
});

export const LAB_METHOD_IDS = Object.freeze({
  PRESSURE_MASTER_GAUGE: 'pressure_master_gauge_comparison',
  PRESSURE_DWT_700_BAR: 'pressure_dwt_700_bar',
  PRESSURE_DWT_250_MPA: 'pressure_dwt_250_mpa',
  TEMPERATURE_COMPARISON: 'temperature_comparison',
});

const validationWarning = 'Software implementation requires formal Laboratory Management and Technical Signatory validation.';

export const PRESSURE_POINT_SEQUENCE = Object.freeze([
  ...Array.from({ length: 6 }, (_, index) => Object.freeze({ id: `increasing-${index + 1}`, direction: 'increasing', sequence: index + 1 })),
  ...Array.from({ length: 5 }, (_, index) => Object.freeze({ id: `repeatability-${index + 1}`, direction: 'repeatability', sequence: index + 1 })),
  ...Array.from({ length: 5 }, (_, index) => Object.freeze({ id: `decreasing-${index + 1}`, direction: 'decreasing', sequence: index + 1 })),
]);

export const TEMPERATURE_PROCEDURE_LIMITS = Object.freeze({
  ambientMinimumCelsius: 18,
  ambientMaximumCelsius: 28,
  maximumAmbientGradientCelsiusPerHour: 2,
  minimumPairedReadings: 6,
  targetReadingIntervalSeconds: 60,
  shortIntervalReviewSeconds: 45,
});

export const LAB_METHODS = Object.freeze([
  Object.freeze({
    id: LAB_METHOD_IDS.PRESSURE_MASTER_GAUGE,
    discipline: 'pressure',
    label: 'Pressure master-gauge comparison',
    sourceTemplate: 'Legacy pressure master-gauge certificate and data-entry template',
    procedureNumber: 'Pending approved procedure mapping',
    version: 'software-reference-v1',
    effectiveDate: '',
    increasingRuns: 6,
    decreasingRuns: 5,
    repeatabilityRuns: 5,
    approvalStatus: 'management_validation_required',
    warnings: Object.freeze([validationWarning, 'Legacy reliability calculations are externally linked and unresolved.']),
  }),
  Object.freeze({
    id: LAB_METHOD_IDS.PRESSURE_DWT_700_BAR,
    discipline: 'pressure',
    label: 'Pressure dead-weight tester — 700 bar',
    sourceTemplate: 'Legacy DWT high-pressure certificate and data-entry template',
    procedureNumber: 'Pending approved procedure mapping',
    version: 'software-reference-v1',
    effectiveDate: '',
    increasingRuns: 6,
    decreasingRuns: 5,
    repeatabilityRuns: 5,
    approvalStatus: 'management_validation_required',
    warnings: Object.freeze([validationWarning, 'Legacy reliability calculations are externally linked and unresolved.']),
  }),
  Object.freeze({
    id: LAB_METHOD_IDS.PRESSURE_DWT_250_MPA,
    discipline: 'pressure',
    label: 'Pressure primary dead-weight tester — 250 MPa',
    sourceTemplate: 'Legacy DWT 250 MPa certificate and data-entry template',
    procedureNumber: 'Pending approved procedure mapping',
    version: 'software-reference-v1',
    effectiveDate: '',
    increasingRuns: 6,
    decreasingRuns: 5,
    repeatabilityRuns: 5,
    approvalStatus: 'management_validation_required',
    warnings: Object.freeze([validationWarning, 'Legacy reliability calculations are externally linked and unresolved.']),
  }),
  Object.freeze({
    id: LAB_METHOD_IDS.TEMPERATURE_COMPARISON,
    discipline: 'temperature',
    label: 'Temperature comparison',
    sourceTemplate: 'QMS temperature worksheet, certificate, data-entry and uncertainty templates',
    procedureNumber: 'PROC/2002-DT — requires management confirmation',
    version: 'software-reference-v1',
    effectiveDate: '',
    readingsPerPoint: 6,
    approvalStatus: 'management_validation_required',
    warnings: Object.freeze([
      validationWarning,
      'The supplied data-entry workbook references an external uncertainty sheet.',
      'The displayed six-reading groups use a legacy standard-error divisor of square-root ten; the approved rule is unresolved.',
    ]),
  }),
]);

export const LAB_WORKFLOW_STATUSES = Object.freeze([
  'awaiting_lab_receipt', 'received_in_lab', 'thermal_stabilisation', 'inspection_pending',
  'inspection_failed', 'booked_in', 'worksheet_ready', 'calibration_in_progress',
  'calibration_on_hold', 'calibration_data_complete', 'calculation_review_required',
  'calibration_completed', 'labelling_pending', 'labelling_completed', 'bom_signoff_pending',
  'ready_for_dispatch', 'released_to_dispatch', 'certificate_data_pending',
  'draft_certificate_ready', 'management_review', 'management_changes_required',
  'approved_for_signature', 'awaiting_signed_certificate', 'signed_certificate_uploaded',
  'certificate_released', 'completed', 'archived', 'cancelled',
]);

export const LAB_TRANSITIONS = Object.freeze({
  receive: Object.freeze({ from: Object.freeze(['awaiting_lab_receipt']), to: 'received_in_lab' }),
  start_stabilisation: Object.freeze({ from: Object.freeze(['received_in_lab']), to: 'thermal_stabilisation' }),
  complete_stabilisation: Object.freeze({ from: Object.freeze(['thermal_stabilisation']), to: 'inspection_pending' }),
  record_inspection: Object.freeze({ from: Object.freeze(['inspection_pending', 'inspection_failed']), to: 'booked_in' }),
  fail_inspection: Object.freeze({ from: Object.freeze(['inspection_pending']), to: 'inspection_failed' }),
  book_in: Object.freeze({ from: Object.freeze(['booked_in']), to: 'worksheet_ready' }),
  start_calibration: Object.freeze({ from: Object.freeze(['worksheet_ready', 'calibration_on_hold']), to: 'calibration_in_progress' }),
  hold_calibration: Object.freeze({ from: Object.freeze(['calibration_in_progress']), to: 'calibration_on_hold' }),
  submit_raw_data: Object.freeze({ from: Object.freeze(['calibration_in_progress']), to: 'calculation_review_required' }),
  complete_calibration: Object.freeze({ from: Object.freeze(['calculation_review_required']), to: 'calibration_completed' }),
  complete_labelling: Object.freeze({ from: Object.freeze(['calibration_completed', 'labelling_pending']), to: 'labelling_completed' }),
  release_to_dispatch: Object.freeze({ from: Object.freeze(['labelling_completed', 'bom_signoff_pending']), to: 'released_to_dispatch' }),
  generate_draft: Object.freeze({ from: Object.freeze(['calculation_review_required', 'calibration_completed', 'released_to_dispatch', 'management_changes_required']), to: 'draft_certificate_ready' }),
  submit_review: Object.freeze({ from: Object.freeze(['draft_certificate_ready']), to: 'management_review' }),
  return_correction: Object.freeze({ from: Object.freeze(['management_review', 'approved_for_signature']), to: 'management_changes_required' }),
  approve_signature: Object.freeze({ from: Object.freeze(['management_review']), to: 'approved_for_signature' }),
  generate_unsigned: Object.freeze({ from: Object.freeze(['approved_for_signature']), to: 'awaiting_signed_certificate' }),
  upload_signed: Object.freeze({ from: Object.freeze(['awaiting_signed_certificate']), to: 'signed_certificate_uploaded' }),
  release_certificate: Object.freeze({ from: Object.freeze(['signed_certificate_uploaded']), to: 'certificate_released' }),
});

const finiteNumber = (value, field = 'value') => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new ServiceError(`Enter a valid numeric ${field}.`, { code: 'LAB_NUMERIC_VALUE_INVALID', status: 422, fieldErrors: { [field]: 'Enter a valid number.' } });
  return number;
};

const roundTo = (value, decimals = 6) => {
  const places = Math.max(0, Math.min(12, Math.trunc(Number(decimals) || 0)));
  const multiplier = 10 ** places;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

export const calculateMeanReading = readings => {
  const values = (readings || []).map((value, index) => finiteNumber(value, `readings.${index}`));
  if (!values.length) throw new ServiceError('Enter at least one reading.', { code: 'LAB_READINGS_REQUIRED', status: 422 });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const calculateIndicationError = ({ measured, applied }) => finiteNumber(measured, 'measured') - finiteNumber(applied, 'applied');
export const calculateCorrection = ({ measured, applied }) => finiteNumber(applied, 'applied') - finiteNumber(measured, 'measured');

export const calculateRepeatabilityStandardDeviation = readings => {
  const values = (readings || []).map((value, index) => finiteNumber(value, `readings.${index}`));
  if (values.length < 2) throw new ServiceError('Enter at least two repeatability readings.', { code: 'LAB_REPEATABILITY_REQUIRED', status: 422 });
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1));
};

export const calculateStandardError = readings => calculateRepeatabilityStandardDeviation(readings) / Math.sqrt(readings.length);
export const calculatePercentFullScale = ({ value, fullScale }) => (finiteNumber(value, 'value') / finiteNumber(fullScale, 'fullScale')) * 100;

export const calculatePressurePoint = (point, decimals = 6) => {
  const applied = finiteNumber(point.applied, 'applied');
  const readings = (point.readings || []).map((value, index) => finiteNumber(value, `readings.${index}`));
  const mean = calculateMeanReading(readings);
  return {
    id: point.id || '',
    direction: point.direction || 'increasing',
    applied: roundTo(applied, decimals),
    readings: readings.map(value => roundTo(value, decimals)),
    mean: roundTo(mean, decimals),
    indicationError: roundTo(calculateIndicationError({ measured: mean, applied }), decimals),
    correction: roundTo(calculateCorrection({ measured: mean, applied }), decimals),
    standardDeviation: readings.length > 1 ? roundTo(calculateRepeatabilityStandardDeviation(readings), decimals) : null,
  };
};

export const calculateTemperaturePoint = (point, decimals = 6) => {
  const applied = finiteNumber(point.applied, 'applied');
  const standardCorrection = finiteNumber(point.standardCorrection || 0, 'standardCorrection');
  const referenceReadings = (point.referenceReadings || []).map((value, index) => finiteNumber(value, `referenceReadings.${index}`));
  const readings = (point.readings || []).map((value, index) => finiteNumber(value, `readings.${index}`));
  if (readings.length < TEMPERATURE_PROCEDURE_LIMITS.minimumPairedReadings || referenceReadings.length && referenceReadings.length !== readings.length) {
    throw new ServiceError('Each Temperature point requires at least 6 paired Reference Standard and UUT readings.', { code: 'LAB_TEMPERATURE_READING_COUNT_INVALID', status: 422 });
  }
  const referenceMean = referenceReadings.length ? calculateMeanReading(referenceReadings) : applied;
  const correctedStandard = referenceMean + standardCorrection;
  const mean = calculateMeanReading(readings);
  const timestamps = (point.readingTimestamps || []).map(value => String(value || ''));
  const intervalsSeconds = timestamps.slice(1).map((value, index) => (new Date(value).getTime() - new Date(timestamps[index]).getTime()) / 1000).filter(Number.isFinite);
  return {
    id: point.id || '',
    applied: roundTo(applied, decimals),
    standardCorrection: roundTo(standardCorrection, decimals),
    referenceReadings: referenceReadings.map(value => roundTo(value, decimals)),
    referenceMean: roundTo(referenceMean, decimals),
    correctedStandard: roundTo(correctedStandard, decimals),
    readings: readings.map(value => roundTo(value, decimals)),
    mean: roundTo(mean, decimals),
    indicationError: roundTo(calculateIndicationError({ measured: mean, applied: correctedStandard }), decimals),
    correction: roundTo(calculateCorrection({ measured: mean, applied: correctedStandard }), decimals),
    standardDeviation: readings.length > 1 ? roundTo(calculateRepeatabilityStandardDeviation(readings), decimals) : null,
    standardError: readings.length > 1 ? roundTo(calculateStandardError(readings), decimals) : null,
    readingTimestamps: timestamps,
    intervalReviewRequired: intervalsSeconds.some(seconds => seconds < TEMPERATURE_PROCEDURE_LIMITS.shortIntervalReviewSeconds),
    ambientTemperature: point.ambientTemperature === '' || point.ambientTemperature == null ? null : finiteNumber(point.ambientTemperature, 'ambientTemperature'),
    immersionDepth: String(point.immersionDepth || ''),
    stabilisationConfirmed: point.stabilisationConfirmed === true,
    resultStatus: point.resultStatus === 'review_required' ? 'review_required' : 'satisfactory',
    technicianNotes: String(point.technicianNotes || ''),
  };
};

export const validateLaboratoryPointStructure = (method, points = []) => {
  if (method?.discipline === 'pressure') {
    const expected = { increasing: 6, repeatability: 5, decreasing: 5 };
    const actual = points.reduce((counts, point) => ({ ...counts, [point.direction]: (counts[point.direction] || 0) + 1 }), {});
    if (points.length !== 16 || Object.entries(expected).some(([direction, count]) => actual[direction] !== count)) {
      throw new ServiceError('Pressure calibration requires 6 Increasing, 5 Repeatability and 5 Decreasing points.', { code: 'LAB_PRESSURE_POINT_STRUCTURE_INVALID', status: 422 });
    }
    return true;
  }
  for (const point of points) {
    if ((point.readings || []).length < TEMPERATURE_PROCEDURE_LIMITS.minimumPairedReadings || (point.referenceReadings || []).length < TEMPERATURE_PROCEDURE_LIMITS.minimumPairedReadings) {
      throw new ServiceError('Each Temperature point requires at least 6 paired readings.', { code: 'LAB_TEMPERATURE_READING_COUNT_INVALID', status: 422 });
    }
    if ((point.readingTimestamps || []).length !== point.readings.length) throw new ServiceError('Record a timestamp for every Temperature reading pair.', { code: 'LAB_TEMPERATURE_TIMESTAMPS_REQUIRED', status: 422 });
    if (!point.stabilisationConfirmed || !String(point.immersionDepth || '').trim()) throw new ServiceError('Confirm stabilisation and record immersion depth for every Temperature point.', { code: 'LAB_TEMPERATURE_PROCEDURE_EVIDENCE_REQUIRED', status: 422 });
  }
  return true;
};

const defaultDivisor = distribution => {
  if (distribution === 'rectangular') return Math.sqrt(3);
  if (distribution === 'triangular') return Math.sqrt(6);
  return 1;
};

export const calculateUncertaintyBudget = ({ contributions = [], coverageFactor = 2, decimals = 8 } = {}) => {
  if (!contributions.length) throw new ServiceError('Add at least one uncertainty contribution.', { code: 'LAB_UNCERTAINTY_REQUIRED', status: 422 });
  const calculated = contributions.map((item, index) => {
    const uncertainty = finiteNumber(item.uncertainty, `contributions.${index}.uncertainty`);
    const divisor = item.divisor === undefined || item.divisor === '' ? defaultDivisor(item.distribution) : finiteNumber(item.divisor, `contributions.${index}.divisor`);
    const sensitivity = item.sensitivity === undefined || item.sensitivity === '' ? 1 : finiteNumber(item.sensitivity, `contributions.${index}.sensitivity`);
    if (divisor === 0) throw new ServiceError('An uncertainty divisor cannot be zero.', { code: 'LAB_UNCERTAINTY_DIVISOR_ZERO', status: 422 });
    const standardUncertainty = uncertainty / divisor;
    const contribution = standardUncertainty * sensitivity;
    const degreesOfFreedom = item.degreesOfFreedom === undefined || item.degreesOfFreedom === '' ? null : finiteNumber(item.degreesOfFreedom, `contributions.${index}.degreesOfFreedom`);
    return {
      ...item,
      distribution: item.distribution || 'normal',
      divisor: roundTo(divisor, decimals),
      sensitivity: roundTo(sensitivity, decimals),
      standardUncertainty: roundTo(standardUncertainty, decimals),
      contribution: roundTo(contribution, decimals),
      degreesOfFreedom,
    };
  });
  const combined = Math.sqrt(calculated.reduce((sum, item) => sum + (item.contribution ** 2), 0));
  const effectiveDenominator = calculated.reduce((sum, item) => (
    item.degreesOfFreedom && item.degreesOfFreedom > 0
      ? sum + ((item.contribution ** 4) / item.degreesOfFreedom)
      : sum
  ), 0);
  const effectiveDegreesOfFreedom = effectiveDenominator > 0 ? (combined ** 4) / effectiveDenominator : null;
  const k = finiteNumber(coverageFactor, 'coverageFactor');
  return {
    contributions: calculated,
    combinedUncertainty: roundTo(combined, decimals),
    effectiveDegreesOfFreedom: effectiveDegreesOfFreedom === null ? null : roundTo(effectiveDegreesOfFreedom, 4),
    coverageFactor: k,
    expandedUncertainty: roundTo(combined * k, decimals),
  };
};

export const validateClaimedUncertainty = ({ calculated, claimed }) => {
  const calculatedValue = Math.abs(finiteNumber(calculated, 'calculated'));
  const claimedValue = Math.abs(finiteNumber(claimed, 'claimed'));
  return { valid: claimedValue >= calculatedValue, calculated: calculatedValue, claimed: claimedValue, difference: claimedValue - calculatedValue };
};

export const methodById = methodId => LAB_METHODS.find(method => method.id === methodId) || null;

export const calculateLaboratoryWorksheet = worksheet => {
  const method = methodById(worksheet?.methodId);
  if (!method) throw new ServiceError('Select an approved Laboratory method template.', { code: 'LAB_METHOD_REQUIRED', status: 422, fieldErrors: { methodId: 'Select a method.' } });
  const decimals = worksheet.decimals ?? 6;
  const points = (worksheet.testPoints || []).map(point => (
    method.discipline === 'temperature'
      ? calculateTemperaturePoint(point, decimals)
      : calculatePressurePoint(point, decimals)
  ));
  if (!points.length) throw new ServiceError('Add at least one calibration test point.', { code: 'LAB_TEST_POINTS_REQUIRED', status: 422 });
  validateLaboratoryPointStructure(method, worksheet.testPoints || []);
  const uncertainty = calculateUncertaintyBudget({ contributions: worksheet.uncertaintyContributions || [], coverageFactor: worksheet.coverageFactor || 2 });
  return {
    methodId: method.id,
    methodVersion: method.version,
    discipline: method.discipline,
    calculatedAt: new Date().toISOString(),
    points,
    uncertainty,
    approvalStatus: method.approvalStatus,
    warnings: [...method.warnings],
    certificateApprovalBlocked: method.approvalStatus !== 'approved',
  };
};

export const validStandardsForWorksheet = ({ standards = [], branchId, methodId, minimum, maximum, asOf = new Date().toISOString().slice(0, 10) }) => standards.filter(standard => (
  standard.branchId === branchId
  && standard.status === 'active'
  && standard.expiryDate >= asOf
  && standard.approvedMethods.includes(methodId)
  && (minimum === undefined || Number(minimum) >= standard.rangeMinimum)
  && (maximum === undefined || Number(maximum) <= standard.rangeMaximum)
));

export const assertLaboratoryBranch = branchId => {
  if (!LABORATORY_BRANCHES.some(branch => branch.id === branchId)) {
    throw new ServiceError('Select either the Cape Town or Johannesburg Laboratory.', { code: 'LAB_BRANCH_INVALID', status: 422, fieldErrors: { laboratoryBranchId: 'Only Cape Town and Johannesburg operate Laboratories.' } });
  }
  return branchId;
};

export const assertLabTransition = (status, action) => {
  const transition = LAB_TRANSITIONS[action];
  if (!transition || !transition.from.includes(status)) {
    throw new ServiceError('That Laboratory action is not available at the current stage.', { code: 'LAB_WORKFLOW_TRANSITION_INVALID', status: 409 });
  }
  return transition.to;
};

export const createLaboratoryWorkflow = (unit = {}) => ({
  ...unit,
  status: LAB_WORKFLOW_STATUSES.includes(unit.status) ? unit.status : (unit.workflowStatus || 'awaiting_lab_receipt'),
  branchId: unit.branchId || unit.laboratoryBranchId || '',
  assignedTechnicianId: unit.assignedTechnicianId || '',
  assignedManagerId: unit.assignedManagerId || '',
  receipt: unit.receipt || null,
  stabilisation: unit.stabilisation || null,
  inspection: unit.inspection || null,
  booking: unit.booking || null,
  worksheet: unit.worksheet || null,
  calculation: unit.calculation || null,
  labelling: unit.labelling || null,
  release: unit.release || null,
  certificateWorkflow: unit.certificateWorkflow || {
    draftVersions: [],
    reviewEvents: [],
    unsignedVersions: [],
    signedVersions: [],
    releasedAt: '',
    recipientRule: '',
  },
  documents: unit.documents || [],
  events: unit.labEvents || [],
});

const requiredText = (value, field, label, max = 1000) => {
  const text = String(value || '').trim();
  if (!text) throw new ServiceError(`${label} is required.`, { code: 'LAB_REQUIRED_FIELD', status: 422, fieldErrors: { [field]: `${label} is required.` } });
  if (text.length > max) throw new ServiceError(`${label} is too long.`, { code: 'LAB_FIELD_TOO_LONG', status: 422, fieldErrors: { [field]: `Keep ${label.toLowerCase()} below ${max} characters.` } });
  return text;
};

export const validateReceipt = input => ({
  branchId: assertLaboratoryBranch(input.branchId),
  conditionOnReceipt: requiredText(input.conditionOnReceipt, 'conditionOnReceipt', 'Condition on receipt'),
  packageCondition: requiredText(input.packageCondition, 'packageCondition', 'Package condition'),
  numberOfUnits: Math.max(1, Math.trunc(finiteNumber(input.numberOfUnits || 1, 'numberOfUnits'))),
  visibleDamage: String(input.visibleDamage || '').trim(),
  customerDocumentsReceived: input.customerDocumentsReceived === true,
  internalNotes: String(input.internalNotes || '').trim().slice(0, 2000),
});

export const validateStabilisation = (input, { completing = false } = {}) => {
  const ambientTemperature = input.ambientTemperature === '' || input.ambientTemperature === undefined ? null : finiteNumber(input.ambientTemperature, 'ambientTemperature');
  if (completing && input.equilibriumConfirmed !== true) throw new ServiceError('Confirm thermal equilibrium before continuing.', { code: 'LAB_EQUILIBRIUM_REQUIRED', status: 422, fieldErrors: { equilibriumConfirmed: 'Confirm thermal equilibrium.' } });
  return { ambientTemperature, notes: String(input.notes || '').trim().slice(0, 1000), equilibriumConfirmed: input.equilibriumConfirmed === true };
};

export const validateInspection = input => {
  const outcome = requiredText(input.outcome, 'outcome', 'Inspection outcome');
  const problem = !['no_visible_defect', 'calibration_may_continue'].includes(outcome);
  const reason = String(input.reason || '').trim();
  if (problem && reason.length < 8) throw new ServiceError('Describe the inspection concern.', { code: 'LAB_INSPECTION_REASON_REQUIRED', status: 422, fieldErrors: { reason: 'Provide a clear reason.' } });
  return { ...input, outcome, reason, problem, photos: (input.photos || []).map(photo => ({ name: String(photo.name || '').slice(0, 240), type: String(photo.type || ''), size: Number(photo.size || 0) })) };
};

export const validateBooking = input => {
  const method = methodById(input.methodId);
  if (!method) throw new ServiceError('Select the calibration method.', { code: 'LAB_METHOD_REQUIRED', status: 422, fieldErrors: { methodId: 'Select the calibration method.' } });
  return {
    instrumentDescription: requiredText(input.instrumentDescription, 'instrumentDescription', 'Instrument description'),
    manufacturer: requiredText(input.manufacturer, 'manufacturer', 'Manufacturer'),
    model: String(input.model || '').trim().slice(0, 160),
    serialNumber: requiredText(input.serialNumber, 'serialNumber', 'Serial number', 160),
    assetNumber: String(input.assetNumber || '').trim().slice(0, 160),
    rangeMinimum: finiteNumber(input.rangeMinimum, 'rangeMinimum'),
    rangeMaximum: finiteNumber(input.rangeMaximum, 'rangeMaximum'),
    unit: requiredText(input.unit, 'unit', 'Unit of measure', 40),
    resolution: finiteNumber(input.resolution, 'resolution'),
    methodId: method.id,
    calibrationType: input.calibrationType === 'partial' ? 'partial' : 'full',
    sanasOrTraceable: input.sanasOrTraceable === 'sanas' ? 'sanas' : 'traceable',
    urgent: input.urgent === true,
    customerNotes: String(input.customerNotes || '').trim().slice(0, 2000),
    internalNotes: String(input.internalNotes || '').trim().slice(0, 2000),
  };
};

export const labTurnaround = (start, end) => {
  const from = new Date(start || '');
  const to = new Date(end || '');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return { hours: 0, days: 0 };
  const hours = (to - from) / 3_600_000;
  return { hours: roundTo(hours, 1), days: roundTo(hours / 24, 1) };
};
