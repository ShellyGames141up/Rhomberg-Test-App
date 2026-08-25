import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, createRfq, ids, login } from './fixtures.js';

const mutate = (app, auth, url, payload) => app.inject({
  method: 'POST', url,
  headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf },
  payload,
});

test('RFQ review, quotation acknowledgement and accepted-order conversion use controlled persisted transitions', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  repository._state.users.find(user => user.id === ids.representativeUser).permissions.push('mark_rfq_under_review','mark_rfq_quoted');
  repository._state.users.find(user => user.id === ids.customerA).permissions.push('acknowledge_quotation','accept_customer_order','view_own_company_orders');
  const customer=await login(app); const created=await createRfq(app,customer); assert.equal(created.statusCode,201);
  const rfqId=created.json().data.enquiry.id;
  const representative=await login(app,'representative@example.invalid');
  const started=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'start_rep_review',entityType:'rfq',data:{}});
  assert.equal(started.statusCode,200); assert.equal(started.json().data.enquiry.trackingStatus,'under_rep_review');
  const quoted=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'mark_quoted',entityType:'rfq',data:{quotation:{number:'Q-FAB-001',date:'2099-01-01'}}});
  assert.equal(quoted.statusCode,200); assert.equal(quoted.json().data.enquiry.trackingStatus,'quoted');
  const acknowledged=await mutate(app,customer,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'acknowledge_quotation',entityType:'rfq',data:{}});
  assert.equal(acknowledged.statusCode,200); assert.equal(acknowledged.json().data.enquiry.trackingStatus,'awaiting_customer_acceptance');
  const accepted=await mutate(app,customer,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'accept_order',entityType:'rfq',data:{acceptance:{type:'purchase_order',date:'2099-01-02',verified:true}}});
  assert.equal(accepted.statusCode,200); assert.equal(accepted.json().data.enquiry.trackingStatus,'converted_to_order');
  assert.equal(accepted.json().data.order.trackingStatus,'awaiting_planning');
  const reloaded=await app.inject({method:'GET',url:`/api/v1/orders/${accepted.json().data.order.id}`,headers:{cookie:customer.cookie}});
  assert.equal(reloaded.statusCode,200); assert.equal(reloaded.json().data.origin,'customer_submitted_rfq_order');
  assert.ok(repository._state.audits.filter(event=>event.eventType==='workflow.transition').length>=4);
});

test('workflow service rejects skipped transitions and unassigned representatives', async t => {
  const { app, repository }=await createFixture(); t.after(()=>app.close());
  repository._state.users.find(user=>user.id===ids.representativeUser).permissions.push('mark_rfq_under_review','mark_rfq_quoted');
  const customer=await login(app); const created=await createRfq(app,customer); const rfqId=created.json().data.enquiry.id;
  const representative=await login(app,'representative@example.invalid');
  const skipped=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'mark_quoted',entityType:'rfq',data:{quotation:{number:'Q-FAB-002',date:'2099-01-01'}}});
  assert.equal(skipped.statusCode,409); assert.equal(skipped.json().error.code,'INVALID_WORKFLOW_TRANSITION');
  const started=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'start_rep_review',entityType:'rfq',data:{}});
  assert.equal(started.statusCode,200);
  repository._state.enquiries[0].representativeId=ids.representativeB;
  const denied=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'mark_quoted',entityType:'rfq',data:{quotation:{number:'Q-FAB-003',date:'2099-01-01'}}});
  assert.equal(denied.statusCode,403);
});

test('Technical Support request persists one 24-hour extension and blocks quotation completion', async t => {
  const {app,repository}=await createFixture(); t.after(()=>app.close());
  repository._state.users.find(user=>user.id===ids.representativeUser).permissions.push('mark_rfq_under_review','mark_rfq_quoted','request_technical_support','post_technical_message');
  const customer=await login(app); const created=await createRfq(app,customer); const enquiry=created.json().data.enquiry;
  const representative=await login(app,'representative@example.invalid');
  await mutate(app,representative,`/api/v1/enquiries/${enquiry.id}/workflow-actions`,{action:'start_rep_review',entityType:'rfq',data:{}});
  const requested=await mutate(app,representative,`/api/v1/rfqs/${enquiry.id}/technical-support`,{category:'product_selection',question:'Please verify this fabricated product selection.',lineItemId:enquiry.items[0].id,priority:'standard',classification:'internal_only',confirmRequired:true});
  assert.equal(requested.statusCode,201);
  const support=requested.json().data; assert.equal(new Date(support.revisedQuotationTarget)-new Date(support.originalQuotationTarget),24*36e5);
  const duplicate=await mutate(app,representative,`/api/v1/rfqs/${enquiry.id}/technical-support`,{category:'product_selection',question:'A second request must not add another allowance.',lineItemId:enquiry.items[0].id,priority:'standard',classification:'internal_only',confirmRequired:true});
  assert.equal(duplicate.statusCode,409);
  const quoted=await mutate(app,representative,`/api/v1/enquiries/${enquiry.id}/workflow-actions`,{action:'mark_quoted',entityType:'rfq',data:{quotation:{number:'Q-BLOCKED',date:'2099-01-01'}}});
  assert.equal(quoted.statusCode,409); assert.equal(quoted.json().error.code,'TECHNICAL_REVIEW_PENDING');
});
