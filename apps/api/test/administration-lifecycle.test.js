import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, ids, login, FABRICATED_PASSWORD } from './fixtures.js';

const mutate=(app,auth,method,url,payload)=>app.inject({method,url,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload});

test('Administrator lifecycle changes are authoritative, audited and revoke disabled sessions', async t=>{
  const {app,repository}=await createFixture(); t.after(()=>app.close());
  const admin=await login(app,'fabricated.admin@example.invalid');
  const target=repository._state.users.find(user=>user.id===ids.representativeUser);
  const updated=await mutate(app,admin,'PATCH',`/api/v1/administration/users/${target.id}`,{values:{contact:'Fabricated Updated Representative',email:target.email,signInName:'fabricated.rep',branchId:'fabricated-branch'},reason:'Fabricated lifecycle validation'});
  assert.equal(updated.statusCode,200); assert.equal(target.displayName,'Fabricated Updated Representative');
  const roles=await mutate(app,admin,'POST',`/api/v1/admin/users/${target.id}/roles`,{roles:['sales_representative','manager'],reason:'Fabricated role validation',verification:FABRICATED_PASSWORD});
  assert.equal(roles.statusCode,200); assert.deepEqual(target.roles,['sales_representative','manager']);
  const status=await mutate(app,admin,'PUT',`/api/v1/administration/users/${target.id}/status`,{status:'disabled',reason:'Fabricated disable validation'});
  assert.equal(status.statusCode,200); assert.equal(target.status,'disabled');
  assert.ok(repository._state.audits.filter(event=>event.eventType==='administrator.user_changed').length>=3);
  const self=await mutate(app,admin,'PUT',`/api/v1/administration/users/${ids.administrator}/status`,{status:'disabled',reason:'Must fail'});
  assert.equal(self.statusCode,403);
});

test('customers cannot use Administrator lifecycle routes',async t=>{
  const {app}=await createFixture(); t.after(()=>app.close()); const customer=await login(app);
  const denied=await mutate(app,customer,'PUT',`/api/v1/administration/users/${ids.representativeUser}/status`,{status:'disabled',reason:'Forbidden fabricated attempt'});
  assert.equal(denied.statusCode,403);
});

test('catalogue administration reloads persisted overrides and management projections use authorised records',async t=>{
  const {app,repository}=await createFixture();t.after(()=>app.close());
  const adminUser=repository._state.users.find(user=>user.id===ids.administrator);
  adminUser.permissions.push('manage_products','view_all_orders','view_reports');
  const admin=await login(app,'fabricated.admin@example.invalid');
  const overview=await app.inject({url:'/api/v1/administration/overview',headers:{cookie:admin.cookie}});
  assert.equal(overview.statusCode,200);
  const product=overview.json().data.catalogue.products[0];
  const changed=await mutate(app,admin,'PATCH',`/api/v1/administration/catalogue/products/${product.id}`,{values:{name:'Fabricated reviewed product'},reason:'Fabricated catalogue validation'});
  assert.equal(changed.statusCode,200);
  const refreshed=await app.inject({url:'/api/v1/administration/overview',headers:{cookie:admin.cookie}});
  assert.equal(refreshed.json().data.catalogue.products.find(item=>item.id===product.id).name,'Fabricated reviewed product');
  const dashboard=await app.inject({url:'/api/v1/management/dashboard?status=all&search=fabricated',headers:{cookie:admin.cookie}});
  assert.equal(dashboard.statusCode,200);
  assert.equal(typeof dashboard.json().data.metrics.openRfqs,'number');
  assert.ok(Array.isArray(dashboard.json().data.filters.statuses));
});
