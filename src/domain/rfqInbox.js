const inboxGroup = (id, label, statuses) => Object.freeze({ id, label, statuses: Object.freeze(statuses) });

export const REPRESENTATIVE_RFQ_GROUPS = Object.freeze([
  inboxGroup('all', 'All RFQs', []),
  inboxGroup('new', 'New RFQs', ['submitted', 'assigned_to_rep']),
  inboxGroup('under_review', 'RFQs under review', ['under_rep_review']),
  inboxGroup('quoted', 'Quoted RFQs', ['quoted']),
  inboxGroup('awaiting_acceptance', 'Awaiting customer acceptance', ['awaiting_customer_acceptance']),
  inboxGroup('accepted', 'Accepted or converted', ['accepted', 'converted_to_order']),
  inboxGroup('closed', 'Cancelled or expired', ['cancelled', 'expired']),
]);

const searchableText = rfq => [
  rfq.reference,
  rfq.company,
  rfq.contact,
  rfq.email,
  rfq.phone,
  rfq.application,
  rfq.poNumber,
  rfq.selectedRep?.name,
].filter(Boolean).join(' ').toLowerCase();

const asTime = value => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const representativeRfqPriority = rfq => (
  rfq?.priority === 'urgent' || rfq?.emergency === 'yes' ? 'urgent' : 'standard'
);

export const rfqAgeInDays = (rfq, now = new Date()) => {
  const submittedAt = asTime(rfq?.submittedAt || rfq?.createdAt);
  const currentTime = asTime(now);
  if (!submittedAt || !currentTime || currentTime <= submittedAt) return 0;
  return Math.floor((currentTime - submittedAt) / 86_400_000);
};

export const rfqAgeLabel = (rfq, now = new Date()) => {
  const days = rfqAgeInDays(rfq, now);
  if (days === 0) return 'Submitted today';
  if (days === 1) return '1 day old';
  return `${days} days old`;
};

export const lastRfqActivityAt = rfq => rfq?.updatedAt || rfq?.assignedAt || rfq?.submittedAt || rfq?.createdAt || '';

export const representativeRfqGroupFor = status => (
  REPRESENTATIVE_RFQ_GROUPS.find(group => group.id !== 'all' && group.statuses.includes(status))?.id || 'all'
);

export function filterRepresentativeRfqs(rfqs, { search = '', group = 'all', priority = 'all' } = {}) {
  const selectedGroup = REPRESENTATIVE_RFQ_GROUPS.find(item => item.id === group) || REPRESENTATIVE_RFQ_GROUPS[0];
  const term = String(search || '').trim().toLowerCase();
  return [...(rfqs || [])]
    .filter(rfq => rfq?.workflowType === 'rfq')
    .filter(rfq => selectedGroup.id === 'all' || selectedGroup.statuses.includes(rfq.trackingStatus))
    .filter(rfq => priority === 'all' || representativeRfqPriority(rfq) === priority)
    .filter(rfq => !term || searchableText(rfq).includes(term))
    .sort((left, right) => {
      const priorityDifference = Number(representativeRfqPriority(right) === 'urgent')
        - Number(representativeRfqPriority(left) === 'urgent');
      if (priorityDifference) return priorityDifference;
      return asTime(left.submittedAt || left.createdAt) - asTime(right.submittedAt || right.createdAt);
    });
}

export const representativeInboxCounts = rfqs => Object.fromEntries(
  REPRESENTATIVE_RFQ_GROUPS.map(group => [
    group.id,
    group.id === 'all'
      ? (rfqs || []).filter(rfq => rfq?.workflowType === 'rfq').length
      : (rfqs || []).filter(rfq => rfq?.workflowType === 'rfq' && group.statuses.includes(rfq.trackingStatus)).length,
  ]),
);
