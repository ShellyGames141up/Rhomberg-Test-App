import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, ids, login } from './fixtures.js';

const action=(app,auth,method,url,payload)=>app.inject({method,url,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload});

test('archive, legal hold and restore enforce controlled persisted governance',async t=>{
  const {app,repository}=await createFixture();t.after(()=>app.close());const adminUser=repository._state.users.find(user=>user.id===ids.administrator);adminUser.permissions.push('view_all_orders','archive_orders','approve_archival','restore_archived_orders','manage_legal_hold','export_archived_orders','export_order_pdf');
  const order={id:'40000000-0000-4000-8000-000000000080',reference:'OR-2099-000080',companyId:ids.companyA,company:'Fabricated Company A',contact:'Fabricated Customer A',trackingStatus:'completed',status:'completed',details:{},items:[],documents:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};repository._state.orders.push(order);
  const auth=await login(app,'fabricated.admin@example.invalid');
  const hold=await action(app,auth,'PUT',`/api/v1/orders/${order.id}/legal-hold`,{active:true,reason:'Fabricated litigation hold'});assert.equal(hold.statusCode,200);
  const blocked=await action(app,auth,'POST',`/api/v1/orders/${order.id}/archive`,{reason:'Must remain protected'});assert.equal(blocked.statusCode,409);assert.equal(blocked.json().error.code,'LEGAL_HOLD_ACTIVE');
  await action(app,auth,'PUT',`/api/v1/orders/${order.id}/legal-hold`,{active:false,reason:'Fabricated hold released'});
  const archived=await action(app,auth,'POST',`/api/v1/orders/${order.id}/archive`,{reason:'Fabricated retention archive'});assert.equal(archived.statusCode,200);assert.equal(order.trackingStatus,'archived');
  const restored=await action(app,auth,'POST',`/api/v1/orders/${order.id}/restore`,{reason:'Fabricated authorised restoration'});assert.equal(restored.statusCode,200);assert.equal(order.trackingStatus,'completed');
  assert.ok(repository._state.audits.filter(event=>event.eventType.startsWith('order.')).length>=4);
});

test('customer cannot invoke internal archive controls',async t=>{const{app,repository}=await createFixture();t.after(()=>app.close());repository._state.orders.push({id:'40000000-0000-4000-8000-000000000081',reference:'OR-2099-000081',companyId:ids.companyA,company:'Fabricated Company A',trackingStatus:'completed',status:'completed',details:{},items:[],documents:[]});const auth=await login(app);const denied=await action(app,auth,'POST','/api/v1/orders/40000000-0000-4000-8000-000000000081/archive',{reason:'Forbidden'});assert.equal(denied.statusCode,403);});
