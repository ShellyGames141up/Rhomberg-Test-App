import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiServices } from '../../../src/services/api/createApiServices.js';
import { createFixture, createRfq, FABRICATED_PASSWORD, ids, login, validRfq } from './fixtures.js';

const STRONG_PASSWORD = 'Fabricated-Customer-2026!';

const bodyFromRequest = async body => body === undefined || body === null || typeof body === 'string' || body instanceof FormData ? body : body;
function createInjectFetch(app) {
  let cookie='';
  return async (url,options={})=>{
    const headers=Object.fromEntries(new Headers(options.headers || {}).entries());
    if(cookie) headers.cookie=cookie;
    const response=await app.inject({method:options.method || 'GET',url:`${url.pathname}${url.search}`,headers,payload:await bodyFromRequest(options.body)});
    if(response.headers['set-cookie']) cookie=String(response.headers['set-cookie']).split(';')[0];
    return new Response(response.statusCode===204?null:response.body,{status:response.statusCode,headers:response.headers});
  };
}

test('public customer registration creates only a server-authoritative customer and supports subsequent login', async t=>{
  const {app,repository}=await createFixture(); t.after(()=>app.close());
  const services=createApiServices({apiBaseUrl:'/api/v1',requestTimeoutMs:5000,fetchImplementation:createInjectFetch(app)});
  await services.initialize();
  const input={company:'Fabricated Registration Company',contact:'Fabricated Registration Contact',email:'new.customer@example.invalid',phone:'+27 00 000 1234',area:'Gauteng',industry:'Manufacturing',password:STRONG_PASSWORD,consent:'on'};
  const account=await services.auth.register(input);
  assert.equal(account.role,'customer'); assert.deepEqual(account.roles,['customer']);
  assert.equal(account.permissions.includes('administer_users'),false);
  assert.equal((await services.auth.getSession()).id,account.id);
  await services.auth.signOut();
  const signedIn=await services.auth.signIn({email:input.email,password:input.password});
  assert.equal(signedIn.id,account.id);
  const stored=repository._state.users.find(user=>user.id===account.id);
  assert.match(stored.passwordHash,/^scrypt\$/); assert.notEqual(stored.passwordHash,input.password);
  assert.equal(JSON.stringify(repository._state.audits).includes(input.password),false);
});

test('registration rejects duplicate identities, weak payloads and role injection', async t=>{
  const {app}=await createFixture(); t.after(()=>app.close());
  const payload={company:'Fabricated Registration Company',contact:'Fabricated Contact',email:'new.customer@example.invalid',phone:'+27 00 000 1234',area:'Gauteng',industry:'Manufacturing',password:STRONG_PASSWORD};
  const first=await app.inject({method:'POST',url:'/api/v1/auth/register',payload}); assert.equal(first.statusCode,201);
  const duplicate=await app.inject({method:'POST',url:'/api/v1/auth/register',payload:{...payload,email:'other@example.invalid'}}); assert.equal(duplicate.statusCode,409);
  const injected=await app.inject({method:'POST',url:'/api/v1/auth/register',payload:{...payload,company:'Third Fabricated Company',email:'role@example.invalid',role:'administrator'}}); assert.equal(injected.statusCode,400);
  const secondFixture=await createFixture(); t.after(()=>secondFixture.app.close());
  const weak=await secondFixture.app.inject({method:'POST',url:'/api/v1/auth/register',payload:{...payload,company:'Second Fabricated Company',email:'weak@example.invalid',password:'weak'}}); assert.equal(weak.statusCode,400);
});

test('first RFQ atomically establishes the area-eligible dedicated Representative and later RFQs cannot replace it', async t=>{
  const {app,repository}=await createFixture(); t.after(()=>app.close());
  repository._state.representatives.forEach(rep=>{rep.companyIds=rep.companyIds.filter(companyId=>companyId!==ids.companyA);});
  const sameAreaRepresentative={id:'30000000-0000-4000-8000-000000000003',userId:ids.representativeUser,displayName:'Fabricated Representative C',branchName:'Johannesburg',branchId:'johannesburg',companyIds:[],active:true};
  repository._state.representatives.push(sameAreaRepresentative);
  const customer=await login(app);
  const options=await app.inject({method:'GET',url:'/api/v1/enquiries/options',headers:{cookie:customer.cookie}});
  assert.equal(options.statusCode,200); assert.equal(options.json().data.requiresRepresentativeSelection,true);
  assert.deepEqual(options.json().data.eligibleRepresentatives.map(rep=>rep.id).sort(),[ids.representativeA,sameAreaRepresentative.id].sort());
  assert.doesNotMatch(options.body,new RegExp(ids.representativeB));

  const first=await createRfq(app,customer,validRfq(ids.representativeA),'first-rfq-assignment');
  assert.equal(first.statusCode,201); const firstRfq=first.json().data.enquiry;
  assert.equal(firstRfq.representativeId,ids.representativeA);
  assert.ok(repository._state.representatives.find(rep=>rep.id===ids.representativeA).companyIds.includes(ids.companyA));
  assert.ok(repository._state.audits.some(event=>event.eventType==='company.dedicated_representative_assigned'));

  const substitution=await createRfq(app,customer,validRfq(sameAreaRepresentative.id),'forged-representative');
  assert.equal(substitution.statusCode,409); assert.equal(substitution.json().error.code,'REPRESENTATIVE_ASSIGNMENT_CONFLICT');

  const administrator=await login(app,'fabricated-admin',FABRICATED_PASSWORD);
  const changed=await app.inject({method:'PUT',url:`/api/v1/administration/companies/${ids.companyA}/representative`,headers:{cookie:administrator.cookie,'x-csrf-token':administrator.csrf},payload:{representativeId:sameAreaRepresentative.id,reason:'Fabricated UAT relationship reassignment'}});
  assert.equal(changed.statusCode,200);
  assert.equal(repository._state.enquiries.find(rfq=>rfq.id===firstRfq.id).representativeId,ids.representativeA,'historical RFQ ownership must not change');

  const future=await createRfq(app,customer,validRfq(sameAreaRepresentative.id),'future-rfq-assignment');
  assert.equal(future.statusCode,201); assert.equal(future.json().data.enquiry.representativeId,sameAreaRepresentative.id);
});

test('Administrator-created customer receives and uses the assigned Representative without manual RFQ selection', async t=>{
  const {app}=await createFixture(); t.after(()=>app.close());
  const administrator=await login(app,'fabricated-admin',FABRICATED_PASSWORD);
  const temporaryPassword='Fabricated-Customer-Temporary!7';
  const replacementPassword='Fabricated-Customer-Replacement!8';
  const created=await app.inject({
    method:'POST',url:'/api/v1/admin/customer-accounts',
    headers:{cookie:administrator.cookie,'x-csrf-token':administrator.csrf},
    payload:{companyName:'Fabricated Assigned Customer Company',contactName:'Fabricated Assigned Contact',email:'assigned.customer@example.invalid',phone:'0000000000',area:'Gauteng',industry:'Fabricated testing',branchId:'johannesburg',representativeId:ids.representativeA,password:temporaryPassword},
  });
  assert.equal(created.statusCode,201,created.body);

  const firstLogin=await login(app,'assigned.customer@example.invalid',temporaryPassword);
  assert.equal(firstLogin.response.statusCode,200,firstLogin.response.body);
  assert.equal(firstLogin.body.data.user.forcePasswordChange,true);
  const changed=await app.inject({method:'POST',url:'/api/v1/auth/change-password',headers:{cookie:firstLogin.cookie,'x-csrf-token':firstLogin.csrf},payload:{currentPassword:temporaryPassword,newPassword:replacementPassword}});
  assert.equal(changed.statusCode,204,changed.body);

  const customer=await login(app,'assigned.customer@example.invalid',replacementPassword);
  const options=await app.inject({method:'GET',url:'/api/v1/enquiries/options',headers:{cookie:customer.cookie}});
  assert.equal(options.statusCode,200,options.body);
  assert.equal(options.json().data.representativeAssignmentStatus,'assigned');
  assert.equal(options.json().data.requiresRepresentativeSelection,false);
  assert.equal(options.json().data.preferredRepresentative.id,ids.representativeA);
  assert.deepEqual(options.json().data.areaDirectory.Gauteng.representatives.map(rep=>rep.id),[ids.representativeA]);

  const submitted=await createRfq(app,customer,validRfq(ids.representativeA),'administrator-assigned-representative-rfq');
  assert.equal(submitted.statusCode,201,submitted.body);
  assert.equal(submitted.json().data.enquiry.representativeId,ids.representativeA);
});

test('missing area, zero eligible Representatives and inactive assignments fail without creating an RFQ', async t=>{
  const {app,repository}=await createFixture(); t.after(()=>app.close());
  const customer=await login(app);
  repository._state.representatives.find(rep=>rep.id===ids.representativeA).companyIds=[];
  repository._state.companies.find(company=>company.id===ids.companyA).branchId='unserved-branch';
  const none=await createRfq(app,customer,validRfq(ids.representativeA),'no-eligible-rep');
  assert.equal(none.statusCode,422); assert.equal(repository._state.enquiries.length,0);

  repository._state.companies.find(company=>company.id===ids.companyA).branchId='johannesburg';
  const representative=repository._state.representatives.find(rep=>rep.id===ids.representativeA); representative.companyIds=[ids.companyA]; representative.active=false;
  const inactive=await createRfq(app,customer,validRfq(ids.representativeA),'inactive-assignment');
  assert.equal(inactive.statusCode,409); assert.equal(repository._state.enquiries.length,0);
});
