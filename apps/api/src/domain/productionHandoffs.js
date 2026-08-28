import { ApiError } from '../errors.js';
import { EXPEDITOR_PROGRESS_STEPS } from './expeditingOptions.js';

// Production sequence is independent of the retained public-demo history.
export const PRODUCTION_STEPS = Object.freeze([
  ['planning_received', 'Received from Planning'],
  ['parts_on_floor', 'Parts On Floor'],
  ['assembly_started', 'Assembly Started'],
  ['first_standard_calibration', 'First Standard Calibration'],
  ['final_assembly', 'Final Assembly'],
  ['final_standard_calibration', 'Final Standard Calibration'],
  ['quality_check', 'QC — Send to Quality Control'],
].map(([id, label], index) => Object.freeze({ id, label, customerLabel: label,
  description: index === 6 ? 'Hand the completed production work to QC for inspection.' : label,
  sequence: (index + 1) * 10, requiredForDispatch: index < 6,
  selectableForUpdate: index > 0 && index < 6, operational: false, terminal: false,
})).concat(EXPEDITOR_PROGRESS_STEPS.filter(step => step.operational)));
export const PRODUCTION_REQUIRED_STEPS = Object.freeze(PRODUCTION_STEPS.filter(step => step.requiredForDispatch).map(step => step.id));
export const HANDOFF_MESSAGES = Object.freeze({
  complete_expediting: 'Production is complete. Your order has been sent to Quality Control.',
  receive_lab_order: 'The Laboratory has confirmed receipt of your units for certification.',
  release_from_lab: 'Laboratory certification is complete. Your units have been sent to Dispatch.',
});
export function assertProductionProgress(details, action, data) {
  const done = new Set((details.expeditingUpdates || []).map(update => update.progressStep));
  const next = PRODUCTION_REQUIRED_STEPS.find(id => !done.has(id));
  if (action === 'start_expediting' && done.has('planning_received')) throw new ApiError('INVALID_WORKFLOW_TRANSITION', 'Expediting receipt was already confirmed.', 409);
  if (action === 'add_expediting_update') {
    const requested = (data.expeditingUpdate || data).progressStep;
    // Repeating the current step permits a further truthful progress note, not skipping ahead.
    const current = (details.expeditingUpdates || []).at(-1)?.progressStep;
    if (requested !== next && requested !== current) throw new ApiError('INVALID_WORKFLOW_TRANSITION', `Complete ${PRODUCTION_STEPS.find(step => step.id === next)?.label || 'the QC handover'} next.`, 409);
  }
  if (action === 'complete_expediting' && next) throw new ApiError('INVALID_WORKFLOW_TRANSITION', `Record ${PRODUCTION_STEPS.find(step => step.id === next).label} before sending to QC.`, 409);
}
