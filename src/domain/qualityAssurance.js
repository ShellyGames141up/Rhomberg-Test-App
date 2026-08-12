import { ServiceError } from '../services/contracts.js';
import { orderRequiresLaboratory } from './certification.js';

export const QA_PROBLEM_CATEGORIES = Object.freeze([
  { id: 'incorrect_assembly', label: 'Incorrect assembly' },
  { id: 'incorrect_configuration', label: 'Incorrect configuration' },
  { id: 'calibration_issue', label: 'Calibration issue' },
  { id: 'physical_damage', label: 'Physical damage' },
  { id: 'labelling_issue', label: 'Labelling issue' },
  { id: 'functional_test_failure', label: 'Functional test failure' },
  { id: 'leakage', label: 'Leakage' },
  { id: 'electrical_issue', label: 'Electrical issue' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'missing_component', label: 'Missing component' },
  { id: 'incorrect_product', label: 'Incorrect product' },
  { id: 'other', label: 'Other' },
]);

export const QA_SEVERITIES = Object.freeze([
  { id: 'minor', label: 'Minor' },
  { id: 'major', label: 'Major' },
  { id: 'critical', label: 'Critical' },
]);

export const QA_REWORK_DESTINATIONS = Object.freeze([
  { id: 'planning', label: 'Planning' },
  { id: 'materials', label: 'Materials' },
  { id: 'stores', label: 'Stores' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'production', label: 'Production' },
  { id: 'calibration_testing', label: 'Calibration or Testing' },
  { id: 'expediting', label: 'Expediting' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'other', label: 'Other' },
]);

export const orderRequiresQualityAssurance = order => !orderRequiresLaboratory(order);

export const qaSearchText = order => [
  order.reference,
  order.sourceRfqReference,
  order.internalJobNumber,
  order.salesOrderNumber,
  order.customerPoNumber,
  order.company,
  order.contact,
  order.selectedRep?.name,
  order.qualityAssurance?.currentProblem?.category,
].filter(Boolean).join(' ').toLowerCase();

export const qualityMetrics = orders => {
  const qaOrders = (orders || []).filter(orderRequiresQualityAssurance);
  const completedInspections = qaOrders.flatMap(order => order.qualityAssurance?.inspections || []);
  const failures = completedInspections.filter(inspection => inspection.result === 'failed');
  const passes = completedInspections.filter(inspection => inspection.result === 'passed');
  return {
    awaitingInspection: qaOrders.filter(order => ['awaiting_qa', 'qa_reinspection_required'].includes(order.trackingStatus)).length,
    inInspection: qaOrders.filter(order => order.trackingStatus === 'qa_in_progress').length,
    failed: qaOrders.filter(order => ['qa_failed', 'returned_to_expediting'].includes(order.trackingStatus)).length,
    passed: qaOrders.filter(order => order.trackingStatus === 'qa_passed').length,
    totalInspections: completedInspections.length,
    passRate: completedInspections.length ? Math.round((passes.length / completedInspections.length) * 100) : 0,
    failureCount: failures.length,
    reworkCycles: qaOrders.reduce((sum, order) => sum + Number(order.qualityAssurance?.reworkCycle || 0), 0),
  };
};

export const qualityMonthlyMetrics = (orders = [], period = '') => {
  const month = String(period || '').slice(0, 7);
  const qaOrders = orders.filter(orderRequiresQualityAssurance);
  const inspections = qaOrders.flatMap(order => (
    (order.qualityAssurance?.inspections || []).map(inspection => ({ ...inspection, order }))
  ));
  const matching = inspections.filter(inspection => !month || String(inspection.createdAt || '').slice(0, 7) === month);
  const firstAttempts = matching.filter(inspection => Number(inspection.attempt) === 1);
  const finalPasses = matching.filter(inspection => inspection.result === 'passed');
  const failures = matching.filter(inspection => inspection.result === 'failed');
  return {
    period: month,
    ordersInspected: new Set(matching.map(inspection => inspection.order.id)).size,
    unitsInspected: matching.reduce((sum, inspection) => sum + (inspection.order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0), 0),
    firstTimePasses: firstAttempts.filter(inspection => inspection.result === 'passed').length,
    firstInspectionFailures: firstAttempts.filter(inspection => inspection.result === 'failed').length,
    reinspectionCount: matching.filter(inspection => Number(inspection.attempt) > 1).length,
    finalPassCount: finalPasses.length,
    failureCount: failures.length,
    awaitingQa: qaOrders.filter(order => ['awaiting_qa', 'qa_reinspection_required'].includes(order.trackingStatus)).length,
    inRework: qaOrders.filter(order => ['qa_failed', 'returned_to_expediting'].includes(order.trackingStatus)).length,
    failuresByCategory: Object.entries(failures.reduce((result, inspection) => {
      const key = inspection.category || 'other';
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
};

const text = (value, max, field, label) => {
  const result = String(value || '').trim();
  if (result.length > max) {
    throw new ServiceError(`Keep ${label} below ${max.toLocaleString()} characters.`, {
      code: 'QA_INPUT_INVALID',
      status: 422,
      fieldErrors: { [field]: `Keep ${label} below ${max.toLocaleString()} characters.` },
    });
  }
  return result;
};

export const validateQaStart = input => ({
  checklistReference: text(input?.checklistReference, 160, 'checklistReference', 'the checklist reference'),
  internalNote: text(input?.internalNote, 2000, 'internalNote', 'the internal note'),
});

export const validateQaPass = input => {
  const customerMessage = text(input?.customerMessage, 1000, 'customerMessage', 'the customer message');
  const inspectionDate = String(input?.inspectionDate || '').trim();
  if (inspectionDate && (!/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate) || Number.isNaN(new Date(`${inspectionDate}T00:00:00Z`).getTime()))) {
    throw new ServiceError('Enter a valid QA inspection date.', {
      code: 'QA_INSPECTION_DATE_INVALID',
      status: 422,
      fieldErrors: { inspectionDate: 'Choose a valid inspection date.' },
    });
  }
  if (customerMessage.length < 5) {
    throw new ServiceError('Add a clear customer-facing QA completion message.', {
      code: 'QA_CUSTOMER_MESSAGE_REQUIRED',
      status: 422,
      fieldErrors: { customerMessage: 'Explain that quality checks are complete.' },
    });
  }
  return {
    customerMessage,
    inspectionDate,
    checklistConfirmed: input?.checklistConfirmed === true,
    meetsRequirements: input?.meetsRequirements === true,
    internalNote: text(input?.internalNote, 2000, 'internalNote', 'the internal note'),
    checklistReference: text(input?.checklistReference, 160, 'checklistReference', 'the checklist reference'),
  };
};

export const validateQaFailure = input => {
  const category = String(input?.category || '').trim();
  const severity = String(input?.severity || '').trim();
  const reworkDestination = String(input?.reworkDestination || '').trim();
  const problemDescription = text(input?.problemDescription, 2000, 'problemDescription', 'the problem description');
  const customerMessage = text(input?.customerMessage, 1000, 'customerMessage', 'the customer message');
  const correctiveAction = text(input?.correctiveAction, 2000, 'correctiveAction', 'the corrective action');
  const affectedItemId = text(input?.affectedItemId, 160, 'affectedItemId', 'the affected unit or line item');
  const dateFound = String(input?.dateFound || '').trim();
  const otherExplanation = text(input?.otherExplanation, 1000, 'otherExplanation', 'the Other explanation');
  const errors = {};
  if (!QA_PROBLEM_CATEGORIES.some(item => item.id === category)) errors.category = 'Select a recognised problem category.';
  if (!QA_SEVERITIES.some(item => item.id === severity)) errors.severity = 'Select a problem severity.';
  if (!QA_REWORK_DESTINATIONS.some(item => item.id === reworkDestination)) errors.reworkDestination = 'Select where the order must be corrected.';
  if (!affectedItemId) errors.affectedItemId = 'Select the affected unit or line item.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFound) || Number.isNaN(new Date(`${dateFound}T00:00:00Z`).getTime())) {
    errors.dateFound = 'Enter the date the quality issue was found.';
  }
  if (problemDescription.length < 5) errors.problemDescription = 'Describe the quality problem clearly.';
  if (customerMessage.length < 5) errors.customerMessage = 'Add a customer-safe progress message.';
  if ((category === 'other' || reworkDestination === 'other') && otherExplanation.length < 5) {
    errors.otherExplanation = 'Explain the selected Other category or destination.';
  }
  if (Object.keys(errors).length) {
    throw new ServiceError(Object.values(errors)[0], {
      code: 'QA_FAILURE_INVALID',
      status: 422,
      fieldErrors: errors,
    });
  }
  return {
    category,
    severity,
    reworkDestination,
    problemDescription,
    customerMessage,
    correctiveAction,
    affectedItemId,
    dateFound,
    otherExplanation,
    internalNote: text(input?.internalNote, 2000, 'internalNote', 'the internal note'),
  };
};

export const validateQaRework = input => {
  const customerMessage = text(input?.customerMessage, 1000, 'customerMessage', 'the customer message');
  const correctiveAction = text(input?.correctiveAction, 2000, 'correctiveAction', 'the corrective action');
  if (correctiveAction.length < 5) {
    throw new ServiceError('Record the corrective work before resubmitting to QA.', {
      code: 'QA_REWORK_INVALID',
      status: 422,
      fieldErrors: { correctiveAction: 'Describe the corrective action.' },
    });
  }
  return {
    customerMessage,
    correctiveAction,
    internalNote: text(input?.internalNote, 2000, 'internalNote', 'the internal note'),
  };
};
