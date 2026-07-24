import assert from 'node:assert/strict';
import {
  filterRepresentativeRfqs,
  REPRESENTATIVE_RFQ_GROUPS,
  representativeInboxCounts,
  representativeRfqGroupFor,
  representativeRfqPriority,
  rfqAgeInDays,
  rfqAgeLabel,
} from '../src/domain/rfqInbox.js';

assert.deepEqual(
  REPRESENTATIVE_RFQ_GROUPS.map(group => group.id),
  ['all', 'new', 'under_review', 'quoted', 'awaiting_acceptance', 'accepted', 'closed'],
  'the representative inbox must expose every required RFQ group',
);

const now = new Date('2026-07-23T12:00:00.000Z');
const rfqs = [
  {
    id: 'new-standard',
    workflowType: 'rfq',
    trackingStatus: 'assigned_to_rep',
    reference: 'RQ-PREVIEW-0001',
    company: 'Demo Minerals',
    contact: 'Customer One',
    application: 'Pressure monitoring',
    emergency: 'no',
    submittedAt: '2026-07-22T12:00:00.000Z',
  },
  {
    id: 'review-urgent',
    workflowType: 'rfq',
    trackingStatus: 'under_rep_review',
    reference: 'RQ-PREVIEW-0002',
    company: 'Demo Water',
    contact: 'Customer Two',
    application: 'Temperature monitoring',
    emergency: 'yes',
    submittedAt: '2026-07-20T12:00:00.000Z',
  },
  {
    id: 'converted',
    workflowType: 'rfq',
    trackingStatus: 'converted_to_order',
    reference: 'RQ-PREVIEW-0003',
    company: 'Demo Process',
    contact: 'Customer Three',
    application: 'Level monitoring',
    priority: 'standard',
    submittedAt: '2026-07-18T12:00:00.000Z',
  },
];

const counts = representativeInboxCounts(rfqs);
assert.equal(counts.all, 3);
assert.equal(counts.new, 1);
assert.equal(counts.under_review, 1);
assert.equal(counts.accepted, 1);
assert.equal(representativeRfqGroupFor('converted_to_order'), 'accepted');
assert.equal(representativeRfqPriority(rfqs[1]), 'urgent');
assert.equal(rfqAgeInDays(rfqs[1], now), 3);
assert.equal(rfqAgeLabel(rfqs[0], now), '1 day old');
assert.deepEqual(
  filterRepresentativeRfqs(rfqs, { priority: 'urgent' }).map(rfq => rfq.id),
  ['review-urgent'],
  'priority filtering must isolate emergency RFQs',
);
assert.deepEqual(
  filterRepresentativeRfqs(rfqs, { group: 'accepted' }).map(rfq => rfq.id),
  ['converted'],
  'stage filtering must keep accepted and converted RFQs together',
);
assert.deepEqual(
  filterRepresentativeRfqs(rfqs, { search: 'customer one' }).map(rfq => rfq.id),
  ['new-standard'],
  'representative search must include customer information',
);
assert.deepEqual(
  filterRepresentativeRfqs(rfqs).map(rfq => rfq.id),
  ['review-urgent', 'converted', 'new-standard'],
  'the inbox must show emergency work first and then oldest submissions',
);

console.log('Representative RFQ inbox grouping, priority, search and age tests passed.');
