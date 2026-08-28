import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import test from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { hashPassword, hashSessionToken } from '../src/security/crypto.js';

const { Pool } = pg;
const migrationUrl = process.env.RHOMBERG_TEST_POSTGRES_MIGRATION_URL;
const runtimeUrl = process.env.RHOMBERG_TEST_POSTGRES_RUNTIME_URL;
const enabled = Boolean(migrationUrl && runtimeUrl);
const PASSWORD = 'Fabricated-PostgreSQL-Test-Password!7';
const PEPPER = 'fabricated-real-postgresql-test-pepper-32-plus';
const ids = Object.freeze({
  companyA: '71000000-0000-4000-8000-000000000001', companyB: '71000000-0000-4000-8000-000000000002',
  customerA: '72000000-0000-4000-8000-000000000001', customerB: '72000000-0000-4000-8000-000000000002',
  disabled: '72000000-0000-4000-8000-000000000003', repUserA: '72000000-0000-4000-8000-000000000004',
  repUserB: '72000000-0000-4000-8000-000000000005', repA: '73000000-0000-4000-8000-000000000001',
  repB: '73000000-0000-4000-8000-000000000002',
  repC: '73000000-0000-4000-8000-000000000003',
  planning: '72000000-0000-4000-8000-000000000006', expeditor: '72000000-0000-4000-8000-000000000007',
  quality: '72000000-0000-4000-8000-000000000008', dispatch: '72000000-0000-4000-8000-000000000009',
  manager: '72000000-0000-4000-8000-000000000010', administrator: '72000000-0000-4000-8000-000000000011',
});

const config = Object.freeze({
  environment: 'test', host: '127.0.0.1', port: 0, logLevel: 'silent', trustProxy: false,
  cookieSecure: false, cookieName: 'rhomberg_pg_test_session', sessionTtlSeconds: 3600,
  sessionPepper: PEPPER, maxUploadBytes: 4 * 1024 * 1024, allowedOrigin: '', identityMode: 'local_password',
  shutdownTimeoutMs: 1000,
});

async function seed(client) {
  const passwordHash = await hashPassword(PASSWORD);
  await client.query(`TRUNCATE app.request_security_contexts, app.idempotency_records, app.notifications,
    app.document_metadata, app.audit_events, app.rfq_items, app.rfqs, app.sessions,
    app.representative_company_assignments, app.representatives, app.company_users,
    app.user_roles, app.users, app.companies, app.products RESTART IDENTITY CASCADE`);
  await client.query(`INSERT INTO app.companies (id,name,area,industry,branch_id) VALUES
    ($1,'Fabricated PostgreSQL Company A','Gauteng','Fabricated','johannesburg'),
    ($2,'Fabricated PostgreSQL Company B','Western Cape','Fabricated','cape-town')`, [ids.companyA, ids.companyB]);
  await client.query(`INSERT INTO app.users (id,email,display_name,password_hash,status,disabled_at) VALUES
    ($1,'pg.customer.a@example.invalid','Fabricated PostgreSQL Customer A',$12,'active',NULL),
    ($2,'pg.customer.b@example.invalid','Fabricated PostgreSQL Customer B',$12,'active',NULL),
    ($3,'pg.disabled@example.invalid','Fabricated Disabled Customer',$12,'disabled',now()),
    ($4,'pg.rep.a@example.invalid','Fabricated Representative A',$12,'active',NULL),
    ($5,'pg.rep.b@example.invalid','Fabricated Representative B',$12,'active',NULL),
    ($6,'pg.planning@example.invalid','Fabricated Planning User',$12,'active',NULL),
    ($7,'pg.expeditor@example.invalid','Fabricated Expeditor User',$12,'active',NULL),
    ($8,'pg.quality@example.invalid','Fabricated Quality User',$12,'active',NULL),
    ($9,'pg.dispatch@example.invalid','Fabricated Dispatch User',$12,'active',NULL),
    ($10,'pg.manager@example.invalid','Fabricated Manager User',$12,'active',NULL),
    ($11,'pg.administrator@example.invalid','Fabricated Administrator',$12,'active',NULL)`,
  [ids.customerA, ids.customerB, ids.disabled, ids.repUserA, ids.repUserB, ids.planning, ids.expeditor, ids.quality, ids.dispatch, ids.manager, ids.administrator, passwordHash]);
  await client.query(`INSERT INTO app.user_roles (user_id,role_code) VALUES
    ($1,'customer'),($2,'customer'),($3,'customer'),($4,'sales_representative'),($5,'sales_representative'),
    ($6,'planning'),($7,'expeditor'),($8,'quality_assurance'),($9,'dispatch'),($10,'manager'),($11,'administrator')`,
  [ids.customerA, ids.customerB, ids.disabled, ids.repUserA, ids.repUserB, ids.planning, ids.expeditor, ids.quality, ids.dispatch, ids.manager, ids.administrator]);
  await client.query(`INSERT INTO app.company_users (company_id,user_id,is_primary) VALUES
    ($1,$3,true),($2,$4,true),($1,$5,true)`, [ids.companyA, ids.companyB, ids.customerA, ids.customerB, ids.disabled]);
  await client.query(`INSERT INTO app.representatives (id,user_id,display_name,branch_name,branch_id) VALUES
    ($1,$3,'Fabricated Representative A','Johannesburg','johannesburg'),
    ($2,$4,'Fabricated Representative B','Cape Town','cape-town'),
    ($5,NULL,'Fabricated Representative C','Johannesburg','johannesburg')`, [ids.repA, ids.repB, ids.repUserA, ids.repUserB, ids.repC]);
  await client.query(`INSERT INTO app.representative_company_assignments (representative_id,company_id) VALUES
    ($1,$3),($2,$4)`, [ids.repA, ids.repB, ids.companyA, ids.companyB]);
  await client.query(`INSERT INTO app.products (id,code,name,configuration_schema) VALUES
    ('pg-pressure-gauge','PG-DEMO','Fabricated PostgreSQL pressure gauge','[{"key":"dialSize","type":"choice","required":true,"options":["63 mm","100 mm"]},{"key":"range","type":"select","required":true,"options":["0 to 10 bar","Custom range - sales review"]},{"key":"customRange","type":"text","required":true,"showWhen":{"key":"range","value":"Custom range - sales review"}}]'::jsonb),
    ('pg-temperature-gauge','TG-DEMO','Fabricated PostgreSQL temperature gauge','[{"key":"stemLength","required":true}]'::jsonb)`);
}

const payload = representativeId => ({
  details: { application: 'Fabricated PostgreSQL clean-water monitoring', medium: 'Fabricated water', area: 'Fabricated Region', selectedRep: { id: representativeId }, fulfilment: 'delivery', deliveryAddress: '1 Fabricated PostgreSQL Road', notes: 'Fabricated test only.' },
  items: [{ lineId: randomUUID(), productId: 'pg-pressure-gauge', quantity: 2, configuration: { dialSize: '63 mm', range: '0 to 10 bar' } }],
});

async function login(app, email, password = PASSWORD) {
  const lastOctet = ({
    'pg.customer.a@example.invalid': 11, 'pg.customer.b@example.invalid': 12,
    'pg.disabled@example.invalid': 13, 'pg.rep.a@example.invalid': 14, 'pg.planning@example.invalid': 16,
    'pg.expeditor@example.invalid': 17, 'pg.quality@example.invalid': 18, 'pg.dispatch@example.invalid': 19,
    'pg.manager@example.invalid': 20, 'pg.administrator@example.invalid': 21,
  })[email] || 15;
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: `127.0.0.${lastOctet}`, payload: { email, password } });
  const body = response.json();
  return { response, body, cookie: response.headers['set-cookie']?.split(';')[0] || '', token: response.headers['set-cookie']?.split(';')[0]?.split('=')[1] || '', csrf: body.data?.csrfToken };
}

const create = (app, auth, body, key) => app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf, 'idempotency-key': key }, payload: body });
async function within(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds} ms`)), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('real PostgreSQL Phase 1 vertical slice and database security controls', { skip: !enabled, timeout: 120000 }, async t => {
  const migrationPool = new Pool({ connectionString: migrationUrl, max: 3 });
  const runtimePool = new Pool({ connectionString: runtimeUrl, max: 8 });
  const migrationClient = await migrationPool.connect();
  await seed(migrationClient);
  migrationClient.release();
  const repository = createPostgresRepository(runtimePool);
  const storage = createMemoryPrivateStorage();
  const app = await buildApp({ config, repository, storage, logger: false });
  t.after(async () => { await app.close(); await migrationPool.end(); });
  let registeredCompanyId;
  let administratorCreatedCompanyId;

  await t.test('self-registration and concurrent first RFQs persist exactly one area-eligible Dedicated Representative', async () => {
    const registration=await app.inject({method:'POST',url:'/api/v1/auth/register',remoteAddress:'127.0.0.31',payload:{company:'Fabricated PostgreSQL Registration Company',contact:'Fabricated PostgreSQL Registration Contact',email:'pg.registration@example.invalid',phone:'+27 00 000 3131',area:'Gauteng',industry:'Manufacturing',password:PASSWORD}});
    assert.equal(registration.statusCode,201,registration.body);
    const registered=registration.json().data; assert.equal(registered.user.role,'customer');
    const cookie=registration.headers['set-cookie'].split(';')[0]; const csrf=registered.csrfToken;
    const options=await app.inject({url:'/api/v1/enquiries/options',headers:{cookie}});
    assert.equal(options.statusCode,200); assert.equal(options.json().data.requiresRepresentativeSelection,true);
    assert.deepEqual(options.json().data.eligibleRepresentatives.map(rep=>rep.id).sort(),[ids.repA,ids.repC].sort());
    const firstPayload=payload(ids.repA); const competingPayload=payload(ids.repC);
    const [first,competing]=await Promise.all([
      app.inject({method:'POST',url:'/api/v1/enquiries',headers:{cookie,'x-csrf-token':csrf,'idempotency-key':'pg-first-assignment-a'},payload:firstPayload}),
      app.inject({method:'POST',url:'/api/v1/enquiries',headers:{cookie,'x-csrf-token':csrf,'idempotency-key':'pg-first-assignment-c'},payload:competingPayload}),
    ]);
    assert.deepEqual([first.statusCode,competing.statusCode].sort(),[201,409]);
    const companyId=registered.user.companyId; registeredCompanyId=companyId;
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.representative_company_assignments WHERE company_id=$1 AND ended_at IS NULL',[companyId])).rows[0].n,1);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.rfqs WHERE company_id=$1',[companyId])).rows[0].n,1);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE company_id=$1 AND event_type='company.dedicated_representative_assigned'",[companyId])).rows[0].n,1);
  });

  await t.test('authentication, CSRF, expiry, revocation and disabled users', async () => {
    const auth = await login(app, 'pg.customer.a@example.invalid');
    assert.equal(auth.response.statusCode, 200, auth.response.body);
    assert.ok(auth.cookie); assert.ok(auth.csrf);
    const stored = await migrationPool.query('SELECT token_hash, csrf_token_hash FROM app.sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [ids.customerA]);
    assert.equal(stored.rows[0].token_hash, hashSessionToken(auth.token, PEPPER));
    assert.notEqual(stored.rows[0].token_hash, auth.token);
    assert.notEqual(stored.rows[0].csrf_token_hash, auth.csrf);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: auth.cookie, 'idempotency-key': 'missing-csrf-key' }, payload: payload(ids.repA) })).statusCode, 403);

    await migrationPool.query("UPDATE app.sessions SET created_at=now()-interval '2 hours', expires_at=now()-interval '1 second' WHERE token_hash=$1", [hashSessionToken(auth.token, PEPPER)]);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: auth.cookie } })).statusCode, 401);
    const fresh = await login(app, 'pg.customer.a@example.invalid');
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: fresh.cookie, 'x-csrf-token': fresh.csrf } })).statusCode, 204);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: fresh.cookie } })).statusCode, 401);
    assert.equal((await login(app, 'pg.disabled@example.invalid')).response.statusCode, 401);
  });

  await t.test('Administrator overview and account creation remain responsive and persistent', async () => {
    const administrator = await login(app, 'pg.administrator@example.invalid');
    assert.equal(administrator.response.statusCode, 200, administrator.response.body);
    const employeeTemporaryPassword = 'Fabricated-Planning-Password!7';
    const employeeReplacementPassword = 'Fabricated-Planning-Replacement!8';
    const customerTemporaryPassword = 'Fabricated-Customer-Password!7';
    const customerReplacementPassword = 'Fabricated-Customer-Replacement!8';

    const overview = await within(app.inject({ url: '/api/v1/administration/overview', headers: { cookie: administrator.cookie } }), 5000, 'Administration Overview');
    assert.equal(overview.statusCode, 200, overview.body);
    assert.ok(Array.isArray(overview.json().data.users));
    assert.ok(Array.isArray(overview.json().data.companies));
    assert.ok(Array.isArray(overview.json().data.catalogue.products));

    const internalUser = await app.inject({
      method: 'POST', url: '/api/v1/admin/users',
      headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf },
      payload: {
        displayName: 'Fabricated PostgreSQL Planning Contact', username: 'pg.planning.created',
        email: 'pg.planning.created@example.invalid', password: employeeTemporaryPassword,
        role: 'planning', branchId: 'fabricated-branch', department: 'Planning',
      },
    });
    assert.equal(internalUser.statusCode, 201, internalUser.body);

    const customerAccount = await app.inject({
      method: 'POST', url: '/api/v1/admin/customer-accounts',
      headers: { cookie: administrator.cookie, 'x-csrf-token': administrator.csrf },
      payload: {
        companyName: 'Fabricated PostgreSQL Administration Company',
        contactName: 'Fabricated PostgreSQL Administration Contact',
        email: 'pg.admin.customer@example.invalid', phone: '0000000000', area: 'Gauteng',
        industry: 'Fabricated Industry', branchId: 'johannesburg', representativeId: ids.repA, password: customerTemporaryPassword,
      },
    });
    assert.equal(customerAccount.statusCode, 201, customerAccount.body);
    administratorCreatedCompanyId=customerAccount.json().data.company.id;

    for (const createdAccount of [
      { identifier:'pg.planning.created', temporaryPassword:employeeTemporaryPassword, replacementPassword:employeeReplacementPassword, remoteAddress:'127.0.0.41' },
      { identifier:'pg.admin.customer@example.invalid', temporaryPassword:customerTemporaryPassword, replacementPassword:customerReplacementPassword, remoteAddress:'127.0.0.42' },
    ]) {
      const firstLoginResponse = await app.inject({ method:'POST', url:'/api/v1/auth/login', remoteAddress:createdAccount.remoteAddress, payload:{ email:createdAccount.identifier, password:createdAccount.temporaryPassword } });
      assert.equal(firstLoginResponse.statusCode,200,firstLoginResponse.body);
      const firstLoginBody=firstLoginResponse.json(); const firstLoginCookie=firstLoginResponse.headers['set-cookie'].split(';')[0];
      assert.equal(firstLoginBody.data.user.forcePasswordChange,true);
      const changed=await app.inject({method:'POST',url:'/api/v1/auth/change-password',headers:{cookie:firstLoginCookie,'x-csrf-token':firstLoginBody.data.csrfToken},payload:{currentPassword:createdAccount.temporaryPassword,newPassword:createdAccount.replacementPassword}});
      assert.equal(changed.statusCode,204,changed.body);
      const replacementLogin=await app.inject({method:'POST',url:'/api/v1/auth/login',remoteAddress:createdAccount.remoteAddress,payload:{email:createdAccount.identifier,password:createdAccount.replacementPassword}});
      assert.equal(replacementLogin.statusCode,200,replacementLogin.body);
      assert.equal(replacementLogin.json().data.user.forcePasswordChange,false);
    }

    const repeated = await within(Promise.all(Array.from({ length: 12 }, () => app.inject({
      url: '/api/v1/administration/overview', headers: { cookie: administrator.cookie },
    }))), 10000, 'Concurrent Administration Overview requests');
    assert.ok(repeated.every(response => response.statusCode === 200), repeated.map(response => response.body).join('\n'));

    const reloaded = await within(app.inject({ url: '/api/v1/administration/overview', headers: { cookie: administrator.cookie } }), 5000, 'Reloaded Administration Overview');
    assert.equal(reloaded.statusCode, 200, reloaded.body);
    assert.ok(reloaded.json().data.users.some(user => user.email === 'pg.planning.created@example.invalid'));
    assert.ok(reloaded.json().data.users.some(user => user.email === 'pg.admin.customer@example.invalid'));
    assert.ok(reloaded.json().data.companies.some(company => company.name === 'Fabricated PostgreSQL Administration Company'));

    const assignedCustomer = await login(app, 'pg.admin.customer@example.invalid', customerReplacementPassword);
    assert.equal(assignedCustomer.response.statusCode, 200, assignedCustomer.response.body);
    const enquiryOptions = await app.inject({ url:'/api/v1/enquiries/options', headers:{ cookie:assignedCustomer.cookie } });
    assert.equal(enquiryOptions.statusCode,200,enquiryOptions.body);
    assert.equal(enquiryOptions.json().data.representativeAssignmentStatus,'assigned');
    assert.equal(enquiryOptions.json().data.requiresRepresentativeSelection,false);
    assert.equal(enquiryOptions.json().data.preferredRepresentative.id,ids.repA);
    assert.deepEqual(enquiryOptions.json().data.areaDirectory.Gauteng.representatives.map(rep=>rep.id),[ids.repA]);
    const assignedRfq=await create(app,assignedCustomer,payload(ids.repA),'pg-administrator-assigned-customer-rfq');
    assert.equal(assignedRfq.statusCode,201,assignedRfq.body);
    assert.equal(assignedRfq.json().data.enquiry.representativeId,ids.repA);

    const userAudit = await app.inject({
      url: `/api/v1/admin/users/${internalUser.json().data.account.id}/audit`,
      headers: { cookie: administrator.cookie },
    });
    assert.equal(userAudit.statusCode, 200, userAudit.body);
    assert.ok(userAudit.json().data.some(event => event.event_type === 'administrator.internal_user_created'));

    const audit = await migrationPool.query("SELECT count(*)::integer AS count FROM app.audit_events WHERE event_type IN ('administrator.internal_user_created','administrator.customer_account_created')");
    assert.ok(audit.rows[0].count >= 2);

    const customer = await login(app, 'pg.customer.a@example.invalid');
    const denied = await app.inject({ url: '/api/v1/administration/overview', headers: { cookie: customer.cookie } });
    assert.equal(denied.statusCode, 403);

    const relogged = await login(app, 'pg.administrator@example.invalid');
    const afterRelogin = await within(app.inject({ url: '/api/v1/administration/overview', headers: { cookie: relogged.cookie } }), 5000, 'Administration Overview after re-login');
    assert.equal(afterRelogin.statusCode, 200, afterRelogin.body);
    assert.ok(afterRelogin.json().data.companies.some(company => company.name === 'Fabricated PostgreSQL Administration Company'));

    const deleted = await app.inject({ method:'DELETE', url:`/api/v1/admin/users/${internalUser.json().data.account.id}`, headers:{cookie:administrator.cookie,'x-csrf-token':administrator.csrf}, payload:{reason:'Fabricated employee lifecycle validation completed.'} });
    assert.equal(deleted.statusCode,200,deleted.body);
    const deletedRow=await migrationPool.query('SELECT status,deleted_at IS NOT NULL AS deleted FROM app.users WHERE id=$1',[internalUser.json().data.account.id]);
    assert.deepEqual(deletedRow.rows[0],{status:'archived',deleted:true});
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/login',remoteAddress:'127.0.0.43',payload:{email:'pg.planning.created',password:employeeReplacementPassword}})).statusCode,401);
    assert.equal((await migrationPool.query("SELECT count(*)::integer AS count FROM app.audit_events WHERE event_type='administrator.user_soft_deleted' AND entity_id=$1",[internalUser.json().data.account.id])).rows[0].count,1);
  });

  const authA = await login(app, 'pg.customer.a@example.invalid');
  const authB = await login(app, 'pg.customer.b@example.invalid');
  assert.equal(authA.response.statusCode, 200, authA.response.body); assert.equal(authB.response.statusCode, 200, authB.response.body);
  assert.ok(authA.body.data.user.permissions.includes('create_rfq'), JSON.stringify(authA.body.data.user));

  await t.test('real PostgreSQL customer personalisation and representative visit persistence', async()=>{
    const personalisation={schemaVersion:1,setupCompleted:true,themePreset:'rhomberg-default',fontSize:'large',density:'comfortable',appearanceMode:'dark',notificationPreferences:{rfqUpdates:true,quotationNotifications:true,orderProgress:true,delayNotifications:true,fulfilmentNotifications:true,accountSecurity:true,maintenanceNotices:true,companyAnnouncements:false},profileImage:null};
    const saved=await app.inject({method:'PUT',url:'/api/v1/users/me/personalisation',headers:{cookie:authA.cookie,'x-csrf-token':authA.csrf},payload:personalisation});assert.equal(saved.statusCode,200,saved.body);
    assert.equal((await migrationPool.query('SELECT settings->\'personalisation\'->>\'appearanceMode\' AS mode FROM app.user_settings WHERE user_id=$1',[ids.customerA])).rows[0].mode,'dark');
    const rep=await login(app,'pg.rep.a@example.invalid');const clients=await app.inject({url:'/api/v1/representatives/clients',headers:{cookie:rep.cookie}});assert.equal(clients.statusCode,200,clients.body);assert.deepEqual(clients.json().data.map(item=>item.id).sort(),[ids.companyA,registeredCompanyId,administratorCreatedCompanyId].sort());
    const scheduled=await app.inject({method:'POST',url:`/api/v1/clients/${ids.companyA}/appointments`,headers:{cookie:rep.cookie,'x-csrf-token':rep.csrf},payload:{scheduledAt:'2099-01-01T10:00:00.000Z',expectedDurationMinutes:60,purpose:'Fabricated PostgreSQL visit',contact:'Fabricated PostgreSQL Customer A',address:'1 Fabricated PostgreSQL Road'}});assert.equal(scheduled.statusCode,201,scheduled.body);const appointmentId=scheduled.json().data.id;
    assert.equal((await app.inject({method:'POST',url:`/api/v1/appointments/${appointmentId}/start`,headers:{cookie:rep.cookie,'x-csrf-token':rep.csrf},payload:{}})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:`/api/v1/appointments/${appointmentId}/customer-confirmation`,headers:{cookie:rep.cookie,'x-csrf-token':rep.csrf},payload:{}})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:`/api/v1/appointments/${appointmentId}/complete`,headers:{cookie:rep.cookie,'x-csrf-token':rep.csrf},payload:{notes:'Fabricated completed visit'}})).statusCode,200);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE entity_id=$1 AND event_type='appointment.complete'",[appointmentId])).rows[0].n,1);
    assert.equal((await app.inject({url:'/api/v1/representatives/clients',headers:{cookie:authA.cookie}})).statusCode,403);
  });

  let enquiryA; let documentA;
  await t.test('RFQ, line item, document metadata, audit and notification commit atomically', async () => {
    const boundary = '----fabricated-postgresql-boundary';
    const multipart = Buffer.from([
      `--${boundary}\r\nContent-Disposition: form-data; name="payload"\r\n\r\n${JSON.stringify(payload(ids.repA))}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="purchaseOrder"; filename="fabricated-pg-document.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 fabricated PostgreSQL test only\r\n`,
      `--${boundary}--\r\n`,
    ].join(''));
    const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers: { cookie: authA.cookie, 'x-csrf-token': authA.csrf, 'idempotency-key': 'pg-document-transaction-key', 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: multipart });
    assert.equal(response.statusCode, 201, response.body);
    enquiryA = response.json().data.enquiry; documentA = enquiryA.documents[0];
    assert.match(enquiryA.reference, /^RQ-\d{4}-\d{6}$/);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.rfq_items WHERE rfq_id=$1', [enquiryA.id])).rows[0].n, 1);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE entity_id=$1 AND event_type='rfq.created'", [enquiryA.id])).rows[0].n, 1);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.notifications WHERE rfq_id=$1', [enquiryA.id])).rows[0].n, 1);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.document_metadata WHERE rfq_id=$1', [enquiryA.id])).rows[0].n, 1);
    assert.equal('storageKey' in documentA, false); assert.equal('downloadUrl' in documentA, false);
  });

  await t.test('persisted RFQ-to-completion workflow survives every authorised department transition', async () => {
    const rep=await login(app,'pg.rep.a@example.invalid');
    const planning=await login(app,'pg.planning@example.invalid');
    const expeditor=await login(app,'pg.expeditor@example.invalid');
    const quality=await login(app,'pg.quality@example.invalid');
    const dispatch=await login(app,'pg.dispatch@example.invalid');
    const manager=await login(app,'pg.manager@example.invalid');
    for(const internal of [rep,planning,expeditor,quality,dispatch,manager]) assert.equal(internal.response.statusCode,200,internal.response.body);
    assert.ok(planning.body.data.user.permissions.includes('view_planning_queue'),JSON.stringify(planning.body.data.user));
    const action=(auth,entity,id,name,data={})=>app.inject({method:'POST',url:`/api/v1/${entity}/${id}/workflow-actions`,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:{action:name,entityType:entity==='enquiries'?'rfq':'order',data}});
    const review=await action(rep,'enquiries',enquiryA.id,'start_rep_review');assert.equal(review.statusCode,200,review.body);
    const quoted=await action(rep,'enquiries',enquiryA.id,'mark_quoted',{quotation:{number:'Q-PG-FAB-001',date:'2020-01-01'}});
    assert.equal(quoted.statusCode,200,quoted.body);
    assert.equal((await action(authA,'enquiries',enquiryA.id,'acknowledge_quotation')).statusCode,200);
    const accepted=await action(rep,'enquiries',enquiryA.id,'accept_order',{acceptance:{type:'purchase_order',date:'2099-01-02',verified:true}});
    assert.equal(accepted.statusCode,200,accepted.body);const orderId=accepted.json().data.order.id;
    const planningRead=await app.inject({url:`/api/v1/orders/${orderId}`,headers:{cookie:planning.cookie}});assert.equal(planningRead.statusCode,200,planningRead.body);
    const planningStart=await action(planning,'orders',orderId,'start_planning');assert.equal(planningStart.statusCode,200,planningStart.body);
    assert.equal((await action(planning,'orders',orderId,'complete_planning',{planning:{internalJobNumber:'JOB-PG-FAB-001',salesOrderNumber:'SO-PG-FAB-001',assignedPlanningUserId:ids.planning}})).statusCode,200);
    assert.equal((await action(planning,'orders',orderId,'submit_to_expediting')).statusCode,200);
    assert.equal((await action(expeditor,'orders',orderId,'start_expediting',{progressStep:'planning_received',customerMessage:'Fabricated work has started.'})).statusCode,200);
    assert.equal((await action(expeditor,'orders',orderId,'add_expediting_update',{progressStep:'quality_check',customerMessage:'Fabricated work is ready for inspection.'})).statusCode,200);
    assert.equal((await action(expeditor,'orders',orderId,'complete_expediting')).statusCode,200);
    assert.equal((await action(quality,'orders',orderId,'start_qa')).statusCode,200);
    assert.equal((await action(quality,'orders',orderId,'pass_qa')).statusCode,200);
    assert.equal((await action(quality,'orders',orderId,'release_qa_order')).statusCode,200);
    // This RFQ requests delivery. Exercise the required receipt and handover
    // evidence rather than bypassing Dispatch's current controlled workflow.
    const receipt=await action(dispatch,'orders',orderId,'confirm_dispatch_receipt',{dispatchReceipt:{sourceDepartment:'quality_assurance',numberOfPackages:1,customerMessage:'Fabricated order received by Dispatch.'}});
    assert.equal(receipt.statusCode,200,receipt.body);
    const dispatchUpdate={method:'company_delivery',readyDate:'2020-01-02',numberOfPackages:1,courierOrDriver:'Fabricated Driver',customerMessage:'Fabricated delivery update.'};
    for(const name of ['start_delivery','confirm_delivery','complete_delivery']) {
      const result=await action(dispatch,'orders',orderId,name,{dispatchUpdate:{...dispatchUpdate,deliveryDate:'2020-01-03',recipientName:'Fabricated Recipient'}});
      assert.equal(result.statusCode,200,result.body);
    }
    const reloaded=await app.inject({url:`/api/v1/orders/${orderId}`,headers:{cookie:authA.cookie}});
    assert.equal(reloaded.statusCode,200);assert.equal(reloaded.json().data.trackingStatus,'completed');
    const archive=await app.inject({method:'POST',url:`/api/v1/orders/${orderId}/archive`,headers:{cookie:manager.cookie,'x-csrf-token':manager.csrf},payload:{reason:'Fabricated completed-record retention validation'}});
    assert.equal(archive.statusCode,200,archive.body);assert.equal(archive.json().data.status,'archived');
    const restored=await app.inject({method:'POST',url:`/api/v1/orders/${orderId}/restore`,headers:{cookie:manager.cookie,'x-csrf-token':manager.csrf},payload:{reason:'Fabricated authorised restoration validation'}});
    assert.equal(restored.statusCode,200,restored.body);assert.equal(restored.json().data.status,'completed');
    assert.ok((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE entity_id=$1 AND event_type='workflow.transition'",[orderId])).rows[0].n>=10);
  });

  let enquiryB;
  await t.test('API and RLS enforce company and representative assignment boundaries', async () => {
    const createdB = await create(app, authB, payload(ids.repB), 'pg-company-b-key');
    assert.equal(createdB.statusCode, 201, createdB.body); enquiryB = createdB.json().data.enquiry;
    assert.equal((await app.inject({ url: `/api/v1/enquiries/${enquiryB.id}`, headers: { cookie: authA.cookie } })).statusCode, 404);
    assert.equal((await app.inject({ url: `/api/v1/documents/${documentA.id}`, headers: { cookie: authB.cookie } })).statusCode, 404);
    const repA = await login(app, 'pg.rep.a@example.invalid');
    const repList = await app.inject({ url: '/api/v1/enquiries', headers: { cookie: repA.cookie } });
    assert.equal(repList.statusCode, 200); assert.deepEqual([...new Set(repList.json().data.map(row => row.companyId))].sort(), [ids.companyA,registeredCompanyId,administratorCreatedCompanyId].sort());

    const direct = await runtimePool.connect();
    try {
      await direct.query('BEGIN');
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n, 0);
      await direct.query("SELECT set_config('app.company_ids',$1,true), set_config('app.can_view_all_rfqs','enabled',true)", [ids.companyB]);
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n, 0, 'forged settings must not establish RLS scope');
      await direct.query('SELECT app.establish_request_context($1)', [hashSessionToken(authA.token, PEPPER)]);
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.rfqs WHERE company_id=$1', [ids.companyB])).rows[0].n, 0);
      assert.equal((await direct.query('SELECT count(*)::int n FROM app.document_metadata WHERE company_id=$1', [ids.companyB])).rows[0].n, 0);
      await direct.query('ROLLBACK');
    } finally { direct.release(); }
  });

  await t.test('transaction rollback and PostgreSQL advisory-lock idempotency', async () => {
    const before = (await migrationPool.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n;
    const invalid = payload(ids.repA); invalid.items[0].configuration = {};
    const rolledBack = await create(app, authA, invalid, 'pg-rollback-key');
    assert.equal(rolledBack.statusCode, 422);
    assert.equal((await migrationPool.query('SELECT count(*)::int n FROM app.rfqs')).rows[0].n, before);

    const key = 'pg-concurrent-idempotency-key';
    const body = payload(ids.repA);
    const [first, second] = await Promise.all([create(app, authA, body, key), create(app, authA, body, key)]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.json().data.enquiry.id, second.json().data.enquiry.id);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.idempotency_records WHERE user_id=$1 AND idempotency_key=$2", [ids.customerA, key])).rows[0].n, 1);
  });

  await t.test('SQL input handling, mass assignment, UUID and foreign-reference validation', async () => {
    const injectionLogin = await login(app, "' OR 1=1 --", 'irrelevant');
    assert.equal(injectionLogin.response.statusCode, 401, injectionLogin.response.body);
    const injection = payload(ids.repA); injection.details.application = "Fabricated'); DROP TABLE app.rfqs; --";
    assert.equal((await create(app, authA, injection, 'pg-sql-injection-key')).statusCode, 201);
    assert.equal((await migrationPool.query("SELECT to_regclass('app.rfqs') IS NOT NULL AS present")).rows[0].present, true);
    const massAssigned = payload(ids.repA); massAssigned.details.companyId = ids.companyB; massAssigned.details.priority = 'urgent';
    assert.equal((await create(app, authA, massAssigned, 'pg-mass-assignment-key')).statusCode, 422);
    assert.equal((await app.inject({ url: '/api/v1/enquiries/not-a-uuid', headers: { cookie: authA.cookie } })).statusCode, 400);
    const representativeForgery = await create(app, authA, payload('79999999-9999-4999-8999-999999999999'), 'pg-invalid-fk-key');
    assert.equal(representativeForgery.statusCode, 409);
    assert.equal(representativeForgery.json().error.code, 'REPRESENTATIVE_ASSIGNMENT_CONFLICT');
  });

  await t.test('Expeditor options/progress, recipient acknowledgement and scoped live revisions work on real PostgreSQL', async () => {
    const expeditor = await login(app, 'pg.expeditor@example.invalid');
    const orderId = randomUUID();
    await migrationPool.query(`INSERT INTO app.orders(id,reference,company_id,customer_user_id,representative_id,origin,status,application,fulfilment,created_by_user_id)
      VALUES($1,$2,$3,$4,$5,'representative_loaded_order','expediting_in_progress','Fabricated live update validation','collect',$6)`,
      [orderId, 'OR-FABRICATED-LIVE-' + orderId, ids.companyA, ids.customerA, ids.repA, ids.repUserA]);
    const headers = auth => ({ cookie: auth.cookie, 'x-csrf-token': auth.csrf });
    const revision = async auth => {
      const response = await app.inject({ url: '/api/v1/workspace/updates', headers: headers(auth) });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.match(response.json().data.revision, /^[a-f0-9]{64}$/);
      return response.json().data.revision;
    };
    const initialA = await revision(authA), initialB = await revision(authB);
    assert.equal(await revision(authA), initialA, 'unchanged database has a stable token');
    const options = await app.inject({ url: '/api/v1/expediting/workspace-options', headers: headers(expeditor) });
    assert.ok(options.json().data.progressSteps.find(step => step.id === 'materials_checked').selectableForUpdate);
    const update = await app.inject({ method: 'POST', url: '/api/v1/orders/' + orderId + '/workflow-actions', headers: headers(expeditor),
      payload: { action: 'add_expediting_update', data: { expeditingUpdate: { progressStep: 'materials_checked', customerMessage: 'Fabricated materials checked.', internalNote: 'FABRICATED-PRIVATE-EXPEDITING-SENTINEL' } } } });
    assert.equal(update.statusCode, 200, update.body);
    assert.notEqual(await revision(authA), initialA);
    assert.equal(await revision(authB), initialB, 'another company does not observe this update');
    const customerOrders = await app.inject({ url: '/api/v1/orders', headers: headers(authA) });
    assert.ok(!customerOrders.body.includes('FABRICATED-PRIVATE-EXPEDITING-SENTINEL'));
    const visible = customerOrders.json().data.find(item => item.id === orderId);
    assert.equal(visible.expediting.updates.at(-1).progressStep, 'materials_checked');
    const staffOrders = await app.inject({ url: '/api/v1/orders', headers: headers(expeditor) });
    assert.ok(staffOrders.body.includes('FABRICATED-PRIVATE-EXPEDITING-SENTINEL'));
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/orders/' + orderId + '/workflow-actions', headers: headers(expeditor),
      payload: { action: 'add_expediting_update', data: { progressStep: 'cancelled', customerMessage: 'Must not cancel through progress.' } } });
    assert.equal(invalid.statusCode, 422);
    const notifications = (await app.inject({ url: '/api/v1/notifications', headers: headers(authA) })).json().data;
    const notification = notifications.find(item => item.orderId === orderId);
    assert.equal(notification.entityType, 'order'); assert.equal(notification.entityId, orderId);
    const acknowledge = auth => app.inject({ method: 'POST', url: '/api/v1/notifications/' + notification.id + '/read', headers: headers(auth) });
    assert.equal((await acknowledge(authB)).statusCode, 404);
    const first = await acknowledge(authA); assert.equal(first.statusCode, 200, first.body);
    assert.equal((await acknowledge(authA)).json().data.readAt, first.json().data.readAt);
    assert.equal((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE event_type='notification.read' AND entity_id=$1", [notification.id])).rows[0].n, 1);
    for (const auth of [authA, expeditor]) {
      const batch = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all', headers: headers(auth) });
      assert.equal(batch.statusCode, 200, batch.body);
      assert.equal(typeof batch.json().data.updatedCount, 'number');
      const remaining = (await app.inject({ url: '/api/v1/notifications', headers: headers(auth) })).json().data;
      assert.ok(remaining.every(item => item.readAt));
    }
  });

  await t.test('runtime grants prevent DDL and audit mutation while application audit inserts work', async () => {
    const runtimeRole = decodeURIComponent(new URL(runtimeUrl).username);
    const role = (await migrationPool.query(`SELECT rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls
      FROM pg_roles WHERE rolname=$1`, [runtimeRole])).rows[0];
    assert.deepEqual(role, {
      rolsuper: false, rolinherit: true, rolcreaterole: false, rolcreatedb: false,
      rolcanlogin: true, rolreplication: false, rolbypassrls: false,
    });
    assert.equal((await migrationPool.query(`SELECT count(*)::integer AS count FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      JOIN pg_roles owner ON owner.oid=relation.relowner
      WHERE namespace.nspname='app' AND owner.rolname=$1`, [runtimeRole])).rows[0].count, 0);
    assert.equal((await migrationPool.query("SELECT has_schema_privilege($1,'app','CREATE') AS allowed", [runtimeRole])).rows[0].allowed, false);
    assert.equal((await migrationPool.query("SELECT has_table_privilege($1,'app.audit_events','TRUNCATE') AS allowed", [runtimeRole])).rows[0].allowed, false);
    const client = await runtimePool.connect();
    try {
      for (const statement of ['CREATE TABLE public.runtime_forbidden(id int)', 'ALTER TABLE app.rfqs ADD COLUMN runtime_forbidden text', 'DROP TABLE app.products', 'UPDATE app.audit_events SET action=\'tampered\'', 'DELETE FROM app.audit_events']) {
        await client.query('BEGIN');
        await assert.rejects(client.query(statement));
        await client.query('ROLLBACK');
      }
    } finally { client.release(); }
    assert.ok((await migrationPool.query("SELECT count(*)::int n FROM app.audit_events WHERE event_type='rfq.created'")).rows[0].n >= 1);
  });

  await t.test('login throttling is enforced', async () => {
    const attempts = [];
    for (let index = 0; index < 7; index += 1) attempts.push(await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '127.0.0.77', payload: { email: 'pg.customer.a@example.invalid', password: 'fabricated-wrong-password' } }));
    assert.ok(attempts.some(response => response.statusCode === 429));
  });

  await t.test('structured logs redact security-sensitive request values', async () => {
    let logs = '';
    const stream = new Writable({ write(chunk, _encoding, callback) { logs += chunk.toString(); callback(); } });
    const loggingApp = await buildApp({ config: { ...config, logLevel: 'info' }, repository, storage, logger: true, logStream: stream });
    const sentinels = ['fabricated-password-log-sentinel', 'fabricated-session-log-sentinel', 'fabricated-csrf-log-sentinel'];
    await loggingApp.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '127.0.0.88', headers: { cookie: `rhomberg_pg_test_session=${sentinels[1]}`, 'x-csrf-token': sentinels[2] }, payload: { email: 'pg.customer.a@example.invalid', password: sentinels[0] } });
    await loggingApp.close();
    for (const sentinel of sentinels) assert.equal(logs.includes(sentinel), false);
    assert.equal(logs.includes('RHOMBERG_API_DATABASE_URL'), false);
  });
});
