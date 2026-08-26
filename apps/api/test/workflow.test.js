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
  const representativeInbox = await app.inject({ method: 'GET', url: '/api/v1/enquiries/inbox', headers: { cookie: representative.cookie } });
  assert.equal(representativeInbox.statusCode, 200, representativeInbox.body);
  assert.ok(representativeInbox.json().data.find(rfq => rfq.id === rfqId).allowedWorkflowActions.some(action => action.action === 'start_rep_review'));
  const started=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'start_rep_review',entityType:'rfq',data:{}});
  assert.equal(started.statusCode,200); assert.equal(started.json().data.enquiry.trackingStatus,'under_rep_review');
  const quoted=await mutate(app,representative,`/api/v1/enquiries/${rfqId}/workflow-actions`,{action:'mark_quoted',entityType:'rfq',data:{quotation:{number:'Q-FAB-001',date:'2099-01-01'}}});
  assert.equal(quoted.statusCode,200); assert.equal(quoted.json().data.enquiry.trackingStatus,'quoted');
  const customerList = await app.inject({ method: 'GET', url: '/api/v1/enquiries', headers: { cookie: customer.cookie } });
  assert.equal(customerList.statusCode, 200, customerList.body);
  assert.ok(customerList.json().data.find(rfq => rfq.id === rfqId).allowedWorkflowActions.some(action => action.action === 'acknowledge_quotation'));
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

test('representative-loaded orders are actionable from the Planning queue and remain actionable after mutation', async t => {
  const { app, repository } = await createFixture(); t.after(() => app.close());
  const planningId = '20000000-0000-4000-8000-000000000099';
  repository._state.users.push({
    id: planningId,
    email: 'planning.queue@example.invalid',
    displayName: 'Fabricated Planning User',
    passwordHash: repository._state.users[0].passwordHash,
    status: 'active',
    roles: ['planning'],
    permissions: ['view_planning_queue', 'add_planning_information', 'submit_to_expediting'],
    companyIds: [],
  });
  const orderId = '40000000-0000-4000-8000-000000000099';
  repository._state.orders.push({
    id: orderId,
    reference: 'OR-2099-000099',
    companyId: ids.companyA,
    company: 'Fabricated Company A',
    contact: 'Fabricated Customer A',
    representativeId: ids.representativeA,
    selectedRep: { id: ids.representativeA, name: 'Fabricated Representative A', branchName: 'Johannesburg' },
    workflowType: 'order',
    trackingStatus: 'awaiting_planning',
    status: 'awaiting_planning',
    origin: 'representative_loaded_order',
    application: 'Fabricated representative-loaded Planning regression',
    fulfilment: 'collect',
    collectionBranch: 'johannesburg',
    priority: 'standard',
    items: [{ id: '50000000-0000-4000-8000-000000000099', productId: 'fabricated-pressure-gauge', code: 'DEMO-PG', name: 'Fabricated pressure gauge', quantity: 1, configuration: { range: '0 to 10 bar' } }],
    trackingHistory: [],
    createdAt: '2099-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
  });

  const planning = await login(app, 'planning.queue@example.invalid');
  assert.equal(planning.response.statusCode, 200, planning.response.body);
  const queue = await app.inject({ method: 'GET', url: '/api/v1/orders', headers: { cookie: planning.cookie } });
  assert.equal(queue.statusCode, 200, queue.body);
  const queuedOrder = queue.json().data.find(order => order.id === orderId);
  assert.equal(queuedOrder.origin, 'representative_loaded_order');
  assert.ok(queuedOrder.allowedWorkflowActions.some(action => action.action === 'start_planning'));

  const detail = await app.inject({ method: 'GET', url: `/api/v1/orders/${orderId}`, headers: { cookie: planning.cookie } });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.ok(detail.json().data.allowedWorkflowActions.some(action => action.action === 'start_planning'));

  const started = await mutate(app, planning, `/api/v1/orders/${orderId}/workflow-actions`, { action: 'start_planning', entityType: 'order', data: {} });
  assert.equal(started.statusCode, 200, started.body);
  assert.equal(started.json().data.order.trackingStatus, 'planning_in_progress');
  assert.ok(started.json().data.order.allowedWorkflowActions.some(action => action.action === 'complete_planning'));
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
