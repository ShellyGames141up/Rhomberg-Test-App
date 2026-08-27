import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDispatchAction, dispatchProjection } from '../src/domain/dispatchWorkflow.js';

const actor = { id: 'fabricated-dispatch', permissions: ['view_dispatch_queue','confirm_collection','confirm_delivery'] };
const now = '2026-01-02T08:00:00Z';
const record = { fulfilment: 'collect', details: { dispatch: { receivedAt: now } } };
const update = { method: 'collection', readyDate: '2026-01-01', numberOfPackages: 1, customerMessage: 'Your order is ready.' };

test('Dispatch server validates required receipt fields and restricts exceptions', () => {
  assert.throws(() => applyDispatchAction({ details:{} }, 'confirm_dispatch_receipt', {}, actor, now));
  assert.throws(() => applyDispatchAction({ details:{} }, 'confirm_dispatch_receipt', {dispatchReceipt:{sourceDepartment:'authorised_exception',numberOfPackages:1,exceptionReason:'Fabricated exception',customerMessage:'Received for collection.'}}, actor, now));
  assert.throws(() => applyDispatchAction(record, 'confirm_dispatch_receipt', {}, actor, now), {code:'INVALID_WORKFLOW_TRANSITION'});
});

test('Dispatch server validates method, packages, recipient and date order without trusting the browser', () => {
  for (const bad of [{method:'courier'},{numberOfPackages:1000},{readyDate:'2026-02-30'},{customerMessage:''}]) {
    assert.throws(() => applyDispatchAction(record,'mark_ready_for_collection',{dispatchUpdate:{...update,...bad}},actor,now));
  }
  assert.throws(() => applyDispatchAction(record,'confirm_collection',{dispatchUpdate:update},actor,now));
  assert.throws(() => applyDispatchAction(record,'confirm_collection',{dispatchUpdate:{...update,collectionDate:'2025-12-31',recipientName:'Fabricated Collector'}},actor,now));
  assert.throws(() => applyDispatchAction({details:{}},'mark_ready_for_collection',{dispatchUpdate:update,receivedAt:now},actor,now),{code:'INVALID_WORKFLOW_TRANSITION'});
});

test('Dispatch ignores injected document ownership and keeps private details out of customer projection', () => {
  const dispatch = applyDispatchAction(record,'mark_ready_for_collection',{dispatchUpdate:{...update,internalNotes:'PRIVATE-SENTINEL',proofOfDelivery:{type:'other',reference:'Fabricated reference',storageKey:'PRIVATE-KEY',customerVisible:true,documentId:'INJECTED'}}},actor,now);
  assert.deepEqual(dispatch.proofOfDelivery,{type:'other',reference:'Fabricated reference'});
  const safe = dispatchProjection({dispatch},{role:'customer'});
  assert.doesNotMatch(JSON.stringify(safe),/PRIVATE|INJECTED|proofOfDelivery|updatedBy/);
  assert.equal(safe.dispatch.customerMessage,update.customerMessage);
});
