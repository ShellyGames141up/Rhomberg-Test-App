export const DEFAULT_RETENTION_POLICY = Object.freeze({
  id: 'demo-retention-v1',
  name: 'Demonstration retention policy',
  archive_completed_orders_after_days: 90,
  retain_archived_orders_for_days: 2555,
  allow_permanent_deletion: false,
  deletion_requires_manager_approval: true,
  deletion_requires_administrator_approval: true,
  approvedForProduction: false,
  policyNotice: 'Demonstration defaults only. Rhomberg and IT must approve the production retention policy.',
});

const DAY_MS = 24 * 60 * 60 * 1000;
const clampDays = (value, fallback, maximum) => {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, maximum) : fallback;
};

export const normaliseRetentionPolicy = candidate => ({
  ...DEFAULT_RETENTION_POLICY,
  ...(candidate || {}),
  archive_completed_orders_after_days: clampDays(
    candidate?.archive_completed_orders_after_days,
    DEFAULT_RETENTION_POLICY.archive_completed_orders_after_days,
    3650,
  ),
  retain_archived_orders_for_days: clampDays(
    candidate?.retain_archived_orders_for_days,
    DEFAULT_RETENTION_POLICY.retain_archived_orders_for_days,
    36500,
  ),
  allow_permanent_deletion: candidate?.allow_permanent_deletion === true,
  deletion_requires_manager_approval: candidate?.deletion_requires_manager_approval !== false,
  deletion_requires_administrator_approval: candidate?.deletion_requires_administrator_approval !== false,
  approvedForProduction: false,
  policyNotice: DEFAULT_RETENTION_POLICY.policyNotice,
});

const validDate = value => {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const completedDateForOrder = order => (
  validDate(order?.completedAt)
  || validDate(order?.dispatch?.completedAt)
  || validDate(order?.updatedAt)
  || validDate(order?.createdAt)
);

export const archiveEligibleAtForOrder = (order, policy = DEFAULT_RETENTION_POLICY) => {
  const completedAt = completedDateForOrder(order);
  if (!completedAt || order?.trackingStatus !== 'completed') return '';
  return new Date(
    completedAt.getTime() + normaliseRetentionPolicy(policy).archive_completed_orders_after_days * DAY_MS,
  ).toISOString();
};

export const retentionStateForOrder = (order, policy = DEFAULT_RETENTION_POLICY, now = new Date()) => {
  if (order?.archivedAt || order?.retentionStatus === 'archived') return 'archived';
  const eligibleAt = validDate(archiveEligibleAtForOrder(order, policy));
  const current = validDate(now);
  if (eligibleAt && current && eligibleAt <= current) return 'archive_eligible';
  return 'active';
};

export const applyRetentionState = (order, policy = DEFAULT_RETENTION_POLICY, now = new Date()) => {
  const retentionStatus = retentionStateForOrder(order, policy, now);
  return {
    ...order,
    retentionStatus,
    archiveEligibleAt: order.archiveEligibleAt || archiveEligibleAtForOrder(order, policy),
  };
};

export const searchableArchiveText = order => [
  order?.reference,
  order?.sourceRfqReference,
  order?.internalJobNumber,
  order?.customerPoNumber,
  order?.poNumber,
  order?.company,
  order?.contact,
  order?.selectedRep?.name,
  order?.selectedRep?.branchName,
  order?.archiveReason,
  order?.legalHoldReason,
].filter(Boolean).join(' ').toLowerCase();

export const filterArchiveRecords = (orders, {
  search = '',
  state = 'all',
  legalHold = 'all',
} = {}) => {
  const term = String(search || '').trim().toLowerCase();
  return [...(orders || [])]
    .filter(order => state === 'all' || order.retentionStatus === state)
    .filter(order => legalHold === 'all' || Boolean(order.legalHold?.active) === (legalHold === 'held'))
    .filter(order => !term || searchableArchiveText(order).includes(term))
    .sort((left, right) => new Date(right.archivedAt || right.archiveEligibleAt || right.updatedAt) - new Date(left.archivedAt || left.archiveEligibleAt || left.updatedAt));
};

export const assertArchiveAllowed = order => {
  if (order?.retentionStatus !== 'archive_eligible') throw new Error('Only archive-eligible completed orders may be archived.');
};

export const assertDeletionCanProceed = (order, policy, { exportRecord, managerApproval, administratorApproval } = {}) => {
  const currentPolicy = normaliseRetentionPolicy(policy);
  if (!currentPolicy.allow_permanent_deletion) throw new Error('Permanent deletion is disabled by the retention policy.');
  if (order?.legalHold?.active) throw new Error('Permanent deletion is blocked while a legal hold is active.');
  if (!exportRecord) throw new Error('A protected retention export must be created before deletion.');
  if (currentPolicy.deletion_requires_manager_approval && !managerApproval) throw new Error('Manager approval is required.');
  if (currentPolicy.deletion_requires_administrator_approval && !administratorApproval) throw new Error('Administrator approval is required.');
  return true;
};
