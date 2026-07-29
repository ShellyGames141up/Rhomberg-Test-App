import assert from 'node:assert/strict';
import {
  DISPATCH_COMPLETION_STATUSES,
  DISPATCH_METHODS,
  DISPATCH_PRIMARY_QUEUE_STATUSES,
  dispatchOrderAgeLabel,
  dispatchQueueCounts,
  filterDispatchOrders,
} from '../src/domain/dispatch.js';
import { ServiceError } from '../src/services/contracts.js';
import { validateDispatchAction } from '../src/services/validation.js';

assert.deepEqual(
  DISPATCH_METHODS.map(method => method.id),
  ['collection', 'company_delivery', 'courier', 'third_party_delivery'],
  'Dispatch must use the four approved handover methods',
);
assert.deepEqual(
  DISPATCH_PRIMARY_QUEUE_STATUSES,
  ['awaiting_lab_receipt_dispatch', 'awaiting_dispatch', 'ready_for_collection', 'out_for_delivery'],
  'the primary Dispatch queue must use the approved statuses in order',
);
assert.deepEqual(
  DISPATCH_COMPLETION_STATUSES,
  ['delivered', 'collected'],
  'confirmed handovers must remain available until Dispatch marks them completed',
);

const order = (id, trackingStatus, overrides = {}) => ({
  id,
  reference: `OR-${id}`,
  sourceRfqReference: `RQ-${id}`,
  workflowType: 'order',
  trackingStatus,
  company: `Fabricated ${id} Company`,
  contact: `Fabricated ${id} Contact`,
  selectedRep: { id: `REP-${id}`, name: `Representative ${id}`, code: id, branchName: 'Test Branch' },
  fulfilment: 'delivery',
  emergency: 'no',
  planning: {
    internalJobNumber: `JOB-${id}`,
    customerPoNumber: `PO-${id}`,
    priority: 'standard',
  },
  dispatch: {
    receivedAt: '2026-07-20T08:00:00.000Z',
    lastUpdatedAt: '2026-07-20T09:00:00.000Z',
    method: 'company_delivery',
    readyDate: '2026-07-21',
    courierOrDriver: `Driver ${id}`,
    trackingReference: `TRACK-${id}`,
    numberOfPackages: 2,
    deliveryNoteNumber: `DN-${id}`,
  },
  createdAt: '2026-07-19T08:00:00.000Z',
  updatedAt: '2026-07-20T09:00:00.000Z',
  ...overrides,
});

const orders = [
  order('A', 'awaiting_dispatch', {
    company: 'Fabricated Alpha Company',
    dispatch: {
      receivedAt: '2026-07-20T08:00:00.000Z',
      lastUpdatedAt: '2026-07-20T08:00:00.000Z',
      method: '',
      readyDate: '',
      numberOfPackages: 0,
    },
  }),
  order('B', 'ready_for_collection', {
    company: 'Fabricated Beta Company',
    fulfilment: 'collect',
    emergency: 'yes',
    collectionBranch: 'Fabricated Johannesburg Branch',
    dispatch: {
      receivedAt: '2026-07-18T08:00:00.000Z',
      lastUpdatedAt: '2026-07-21T08:00:00.000Z',
      method: 'collection',
      readyDate: '2026-07-21',
      numberOfPackages: 3,
      deliveryNoteNumber: 'DN-COLLECT-B',
    },
  }),
  order('C', 'out_for_delivery', {
    company: 'Fabricated Gamma Company',
    emergency: 'yes',
    dispatch: {
      receivedAt: '2026-07-19T08:00:00.000Z',
      lastUpdatedAt: '2026-07-22T08:00:00.000Z',
      method: 'courier',
      readyDate: '2026-07-22',
      courierOrDriver: 'Preview Courier',
      trackingReference: 'SPECIAL-TRACK-C',
      numberOfPackages: 1,
    },
  }),
  order('D', 'delivered', { company: 'Fabricated Delta Company' }),
  order('E', 'collected', { fulfilment: 'collect', dispatch: { method: 'collection', receivedAt: '2026-07-17T08:00:00.000Z', lastUpdatedAt: '2026-07-23T08:00:00.000Z', readyDate: '2026-07-20', numberOfPackages: 1 } }),
  order('F', 'completed'),
  order('G', 'planning_in_progress'),
];

assert.deepEqual(
  filterDispatchOrders(orders).map(item => item.id),
  ['E', 'B', 'C', 'A', 'D'],
  'Dispatch defaults to received-oldest-first and excludes unrelated or completed orders',
);
assert.deepEqual(filterDispatchOrders(orders, { filter: 'collection' }).map(item => item.id), ['E', 'B']);
assert.deepEqual(filterDispatchOrders(orders, { filter: 'delivery' }).map(item => item.id), ['C', 'A', 'D']);
assert.deepEqual(filterDispatchOrders(orders, { filter: 'handover_confirmed' }).map(item => item.id), ['E', 'D']);
assert.deepEqual(filterDispatchOrders(orders, { filter: 'emergency' }).map(item => item.id), ['B', 'C']);
assert.deepEqual(filterDispatchOrders(orders, { search: 'special-track-c' }).map(item => item.id), ['C']);
assert.deepEqual(filterDispatchOrders(orders, { search: 'job-b' }).map(item => item.id), ['B']);
assert.deepEqual(filterDispatchOrders(orders, { search: 'representative d' }).map(item => item.id), ['D']);
assert.deepEqual(
  filterDispatchOrders(orders, { sort: 'customer' }).map(item => item.id),
  ['A', 'B', 'D', 'E', 'C'],
);
assert.deepEqual(
  filterDispatchOrders(orders, { sort: 'ready_date' }).map(item => item.id),
  ['E', 'B', 'D', 'C', 'A'],
);

assert.deepEqual(dispatchQueueCounts(orders), {
  all: 5,
  laboratoryReceipt: 0,
  awaitingDispatch: 1,
  collection: 2,
  delivery: 3,
  handoverConfirmed: 2,
  emergency: 2,
});
assert.equal(dispatchOrderAgeLabel(orders[0], new Date('2026-07-20T18:00:00.000Z')), 'Received today');
assert.equal(dispatchOrderAgeLabel(orders[1], new Date('2026-07-20T18:00:00.000Z')), '2 days in Dispatch');

const validRelease = validateDispatchAction('start_delivery', {
  dispatchMethod: 'courier',
  dispatchReadyDate: '2026-07-22',
  dispatchCourierOrDriver: 'Fabricated Courier',
  dispatchTrackingReference: 'TRACK-VALID-001',
  dispatchNumberOfPackages: 2,
  dispatchDeliveryNoteNumber: 'DN-VALID-001',
  dispatchCustomerMessage: 'Your order has left Rhomberg and is out for delivery.',
  dispatchInternalNotes: 'Fabricated internal note.',
});
assert.equal(validRelease.dispatchUpdate.method, 'courier');
assert.equal(validRelease.dispatchUpdate.numberOfPackages, 2);
assert.equal(validRelease.dispatchUpdate.customerVisible, true);

await assert.rejects(
  async () => validateDispatchAction('start_delivery', {
    dispatchMethod: 'collection',
    dispatchReadyDate: '',
    dispatchCourierOrDriver: '',
    dispatchNumberOfPackages: 0,
    dispatchCustomerMessage: '',
  }),
  error => error instanceof ServiceError
    && Boolean(error.fieldErrors.dispatchMethod)
    && Boolean(error.fieldErrors.dispatchReadyDate)
    && Boolean(error.fieldErrors.dispatchNumberOfPackages)
    && Boolean(error.fieldErrors.dispatchCustomerMessage),
  'invalid release data must return user-friendly field errors',
);

const validConfirmation = validateDispatchAction('confirm_delivery', {
  dispatchMethod: 'courier',
  dispatchReadyDate: '2026-07-22',
  dispatchDeliveryDate: '2026-07-23',
  dispatchCourierOrDriver: 'Fabricated Courier',
  dispatchNumberOfPackages: 1,
  dispatchRecipientName: 'Fabricated Recipient',
  dispatchProofType: 'signed_delivery_note',
  dispatchProofReference: 'POD-VALID-001',
  dispatchCustomerMessage: 'Your order was delivered successfully.',
});
assert.equal(validConfirmation.dispatchUpdate.proofOfDelivery.storageStatus, 'metadata_only');

await assert.rejects(
  async () => validateDispatchAction('report_delivery_problem', {
    dispatchMethod: 'courier',
    dispatchCustomerMessage: 'Dispatch is following up.',
    dispatchProblemReason: 'bad',
  }),
  error => error instanceof ServiceError && Boolean(error.fieldErrors.dispatchProblemReason),
  'delivery-problem updates must require a clear reason',
);

console.log('Dispatch queue, filtering, structured fields and validation tests passed.');
