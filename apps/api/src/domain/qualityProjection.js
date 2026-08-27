// Derive the UI/report contract from immutable, persisted workflow updates.
export function qualityProjection(details = {}) {
  const result = { inspections: [], reworkCycle: 0, attempt: 0, currentProblem: null };
  for (const [index, update] of (details.qualityUpdates || []).entries()) {
    if (['start_qa', 'start_qa_reinspection'].includes(update.action)) {
      result.attempt += 1;
      result.startedAt = update.createdAt;
    }
    if (['pass_qa', 'fail_qa'].includes(update.action)) {
      const failure = update.action === 'fail_qa';
      const values = failure ? update.qaFailure : update.qaPass;
      const inspection = { ...values, id: update.id || `qa-inspection-${index}`, result: failure ? 'failed' : 'passed', attempt: result.attempt || 1, createdAt: update.createdAt, inspectedBy: { id: update.createdBy } };
      result.inspections.push(inspection);
      result.currentProblem = failure ? inspection : null;
      if (!failure) result.passedAt = update.createdAt;
    }
    if (update.action === 'start_qa_rework') result.reworkCycle += 1;
    if (update.action === 'release_qa_order') result.releasedAt = update.createdAt;
  }
  return result;
}
