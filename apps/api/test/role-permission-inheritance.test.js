import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { buildApp } from '../src/app.js';
import { hashPassword, hashSessionToken } from '../src/security/crypto.js';

const password = 'Fabricated-Role-Validation!739';
const pepper = 'fabricated-role-validation-pepper-32-characters';
const adminId = '82100000-0000-4000-8000-000000000001';
const targetId = '82100000-0000-4000-8000-000000000002';
const customerId = '82100000-0000-4000-8000-000000000003';
const testUrl = process.env.RHOMBERG_TEST_ROLE_DATABASE_URL;

// Optional REAL local database must be a fresh disposable database owned by a
// test bootstrap identity, never staging. The normal suite uses an empty PGlite.
test('database role inheritance, explicit exceptions and API/RLS authority agree', { timeout: 120000 }, async t => {
  if (testUrl) {
    const url = new URL(testUrl);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    assert.match(url.pathname, /^\/rhomberg_role_test_[a-z0-9_]+$/);
  }
  const db = testUrl ? new pg.Client({ connectionString: testUrl }) : new PGlite();
  if (testUrl) await db.connect();
  const query = async (sql, values) => {
    try { return await db.query(sql, values); }
    catch (error) { error.message = sql.split(/\s+/).slice(0, 5).join(' ') + ': ' + error.message; throw error; }
  };
  t.after(async () => { if (testUrl) await db.end(); else await db.close(); });
  await runMigrations(db);
  await runMigrations(db);
  assert.equal(Number((await query('SELECT count(*) FROM app.users')).rows[0].count), 0, 'no operational seed accounts');
  const hash = await hashPassword(password);
  for (const [id, username, role] of [[adminId, 'fabricated-role-admin', 'administrator'], [targetId, 'fabricated-role-employee', 'planning'], [customerId, 'fabricated-role-customer', 'customer']]) {
    await query("INSERT INTO app.users(id,username,email,display_name,password_hash,identity_provider,status) VALUES($1,$2,$3,$2,$4,'local_password','active')", [id, username, username + '@example.invalid', hash]);
    await query('INSERT INTO app.user_roles(user_id,role_code) VALUES($1,$2)', [id, role]);
  }
  await query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='role_permission_runtime') THEN CREATE ROLE role_permission_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $$");
  const runtimeAttributes = await query("SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname='role_permission_runtime'");
  assert.deepEqual(runtimeAttributes.rows[0], { rolsuper: false, rolbypassrls: false, rolcreaterole: false });
  const grantSource = await fs.readFile(new URL('../sql/phase1-runtime-grants.sql', import.meta.url), 'utf8');
  const databaseName = (await query('SELECT current_database() AS name')).rows[0].name;
  const grants = grantSource.slice(grantSource.indexOf('REVOKE ALL ON SCHEMA'), grantSource.indexOf('-- Resolve each exact approved signature'))
    .replaceAll(':"runtime_role"', '"role_permission_runtime"').replaceAll(':"DBNAME"', '"' + databaseName.replaceAll('"', '""') + '"');
  // Match the same explicit function allowlist used by the deployment script.
  const signatures = [...grantSource.slice(0, grantSource.indexOf('missing_signatures text[]')).matchAll(/'(app\.[^']+\([^']*\))'/g)].map(match => match[1]);
  for (const statement of grants.split(';').filter(value => value.trim())) {
    // PGlite has no database connections and cannot change the database ACL.
    if (!testUrl && /GRANT CONNECT ON DATABASE/.test(statement)) continue;
    await query(statement);
  }
  for (const signature of signatures) await query('GRANT EXECUTE ON FUNCTION ' + signature + ' TO role_permission_runtime');
  await query('SET ROLE role_permission_runtime');
  const repository = createPostgresRepository({ query, connect: async () => ({ query, release() {} }), end: async () => {} });
  const logs = [];
  const app = await buildApp({
    config: { environment: 'test', host: '127.0.0.1', port: 0, logLevel: 'info', trustProxy: false, cookieSecure: false, cookieName: 'role_test_session', sessionTtlSeconds: 3600, sessionPepper: pepper, maxUploadBytes: 4194304, allowedOrigins: [], identityMode: 'local_password' },
    repository, storage: createMemoryPrivateStorage(), logStream: new Writable({ write(chunk, encoding, callback) { logs.push(chunk.toString()); callback(); } }),
  });
  t.after(() => app.close());
  const signIn = async username => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { identifier: username, password } });
    assert.equal(response.statusCode, 200, response.body);
    return { cookie: response.headers['set-cookie'].split(';')[0], csrf: response.json().data.csrfToken };
  };
  const admin = await signIn('fabricated-role-admin');
  const employee = await signIn('fabricated-role-employee');
  const customer = await signIn('fabricated-role-customer');
  const created = await app.inject({ method: 'POST', url: '/api/v1/admin/users',
    headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
    payload: { username: 'fabricated-role-created', displayName: 'Fabricated New Multi Role Employee', password, role: 'planning', additionalRoles: ['dispatch'] },
  });
  assert.equal(created.statusCode, 201, created.body);
  const createdAuth = await signIn('fabricated-role-created');
  const createdMe = await app.inject({ url: '/api/v1/auth/me', headers: { cookie: createdAuth.cookie } });
  assert.equal(createdMe.statusCode, 200);
  assert.ok(createdMe.json().data.permissions.includes('view_planning_queue'));
  assert.ok(createdMe.json().data.permissions.includes('view_dispatch_queue'));
  assert.equal(createdMe.json().data.forcePasswordChange, true, 'onboarding security remains enforced');
  const me = async () => {
    const result = await app.inject({ url: '/api/v1/auth/me', headers: { cookie: employee.cookie } });
    assert.equal(result.statusCode, 200, result.body);
    return result.json().data;
  };
  const change = (operation, values, auth = admin, id = targetId) => app.inject({
    method: operation === 'roles' ? 'POST' : 'PUT',
    url: operation === 'roles' ? '/api/v1/admin/users/' + id + '/roles' : '/api/v1/administration/users/' + id + '/permissions',
    headers: { cookie: auth.cookie, 'x-csrf-token': auth.csrf },
    payload: { [operation]: values, reason: 'Fabricated role permission regression', verification: password },
  });
  const roleChange = async roles => { const response = await change('roles', roles); assert.equal(response.statusCode, 200, response.body); return me(); };
  const permissionsChange = async permissions => { const response = await change('permissions', permissions); assert.equal(response.statusCode, 200, response.body); return me(); };
  let actor = await me();
  assert.ok(actor.permissions.includes('view_planning_queue'));
  assert.ok(!actor.permissions.includes('view_dispatch_queue'));
  actor = await roleChange(['planning', 'dispatch']);
  assert.ok(actor.permissions.includes('view_planning_queue'));
  assert.ok(actor.permissions.includes('view_dispatch_queue'));
  actor = await roleChange(['dispatch']);
  assert.ok(!actor.permissions.includes('view_planning_queue'));
  assert.ok(actor.permissions.includes('read_catalogue'), 'shared permission survives');
  actor = await roleChange(['planning', 'dispatch']);
  actor = await roleChange(['planning', 'dispatch']); // repeat cannot duplicate active assignments
  const defaults = [...actor.permissions];
  actor = await permissionsChange([...defaults.filter(code => code !== 'confirm_delivery'), 'view_technical_queue']);
  assert.ok(actor.permissions.includes('view_technical_queue'), 'extra grant visible to ordinary runtime actor');
  assert.ok(!actor.permissions.includes('confirm_delivery'), 'explicit deny overrides inherited default');
  const token = decodeURIComponent(employee.cookie.slice(employee.cookie.indexOf('=') + 1));
  await query('BEGIN');
  await query('SELECT app.establish_request_context($1)', [hashSessionToken(token, pepper)]);
  const scope = await query("SELECT app.current_context_has_permission('view_technical_queue') AS additional, app.current_context_has_permission('confirm_delivery') AS denied");
  assert.deepEqual(scope.rows[0], { additional: true, denied: false }, 'RLS uses same effective permissions as API');
  const privateOverrides = await query('SELECT DISTINCT user_id FROM app.user_permission_denials');
  assert.ok(privateOverrides.rows.every(row => row.user_id === targetId));
  await assert.rejects(query("UPDATE app.user_permission_denials SET revoked_at=now()"), error => error.code === '42501');
  await query('ROLLBACK');
  actor = await roleChange(['dispatch']);
  assert.ok(!actor.permissions.includes('view_planning_queue'), 'permission edit did not freeze inherited defaults into direct grants');
  assert.ok(actor.permissions.includes('view_technical_queue'), 'intentional additional grant remains');
  assert.ok(!actor.permissions.includes('confirm_delivery'), 'intentional restriction remains');
  actor = await permissionsChange(actor.permissions.filter(code => code !== 'view_technical_queue').concat('confirm_delivery'));
  assert.ok(!actor.permissions.includes('view_technical_queue'));
  assert.ok(actor.permissions.includes('confirm_delivery'));
  actor = await roleChange(['quality_manager']);
  assert.ok(actor.permissions.includes('view_qa_queue'));
  assert.ok(actor.permissions.includes('manage_qa_rework'));
  assert.ok(!actor.permissions.includes('view_dispatch_queue'));
  actor = await roleChange(['buyer']);
  assert.deepEqual([...actor.permissions].sort(), ['access_internal_workspace','change_own_password','change_own_username','read_catalogue']);
  actor = await roleChange(['dispatch']);
  const overview = await app.inject({ url: '/api/v1/administration/overview', headers: { cookie: admin.cookie } });
  assert.equal(overview.statusCode, 200, overview.body);
  const listed = overview.json().data.users.find(user => user.id === targetId);
  assert.deepEqual([...listed.permissions].sort(), [...actor.permissions].sort());
  assert.ok(listed.rolePermissions.includes('confirm_delivery'));
  assert.ok(!overview.json().data.permissions.includes('administer_users'));
  actor = await roleChange(['dispatch', 'sales_representative']);
  const representativeId = (await repository.getSessionActor(hashSessionToken(token, pepper))).actor.representativeId;
  assert.ok(representativeId, 'adding Sales creates a server-authoritative representative identity');
  const moveBranch = await app.inject({ method: 'POST', url: '/api/v1/admin/users/' + targetId + '/branch',
    headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
    payload: { branchId: 'cape-town', reason: 'Fabricated representative branch correction' },
  });
  assert.equal(moveBranch.statusCode, 200, moveBranch.body);
  const refreshedDirectory = await app.inject({ url: '/api/v1/administration/overview', headers: { cookie: admin.cookie } });
  const movedRepresentative = refreshedDirectory.json().data.representatives.find(rep => rep.id === representativeId);
  assert.equal(movedRepresentative.branchId, 'cape-town', 'employee branch changes must reach the customer-assignment directory');
  assert.equal(movedRepresentative.active, true);
  actor = await roleChange(['dispatch']);
  assert.equal((await repository.getSessionActor(hashSessionToken(token, pepper))).actor.representativeId, null, 'removing Sales removes representative access');
  actor = await roleChange(['dispatch', 'sales_representative']);
  assert.equal((await repository.getSessionActor(hashSessionToken(token, pepper))).actor.representativeId, representativeId, 'restoring Sales keeps the historical identity');
  actor = await roleChange(['dispatch']);
  for (const [operation, values, auth, id, status] of [
    ['roles', ['administrator'], admin, targetId, 422],
    ['roles', ['customer'], admin, targetId, 422],
    ['roles', ['not_a_role'], admin, targetId, 422],
    ['roles', [], admin, targetId, 422],
    ['roles', ['planning'], customer, targetId, 403],
    ['roles', ['planning'], admin, customerId, 403],
    ['roles', ['planning'], admin, adminId, 403],
    ['permissions', ['administer_users'], admin, targetId, 403],
    ['permissions', ['not_a_permission'], admin, targetId, 422],
  ]) assert.equal((await change(operation, values, auth, id)).statusCode, status);
  for (const reason of [123456789, { invalid: 'object' }, 'x'.repeat(1001)]) {
    const invalid = await app.inject({ method: 'POST', remoteAddress: '127.0.0.98', url: '/api/v1/admin/users/' + targetId + '/roles', headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf }, payload: { roles: ['planning'], reason, verification: password } });
    assert.equal(invalid.statusCode, 422, 'malformed reasons must produce validation, not a server error');
  }
  const denied = await app.inject({ method: 'POST', url: '/api/v1/admin/users/' + targetId + '/roles', headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf }, payload: { roles: ['planning'], reason: 'Fabricated denied password', verification: 'Wrong-Fabricated-Password!9' } });
  assert.equal(denied.statusCode, 403);
  const noCsrf = await app.inject({ method: 'POST', remoteAddress: '127.0.0.99', url: '/api/v1/admin/users/' + targetId + '/roles', headers: { cookie: admin.cookie }, payload: { roles: ['planning'], reason: 'Fabricated denied CSRF', verification: password } });
  assert.equal(noCsrf.statusCode, 403);
  await assert.rejects(query("INSERT INTO app.user_roles(user_id,role_code) VALUES($1,'administrator')", [targetId]), error => error.code === '42501');
  await assert.rejects(query("UPDATE app.user_permission_grants SET revoked_at=now()"), error => error.code === '42501');
  await assert.rejects(query("DELETE FROM app.audit_events"), error => error.code === '42501');
  await query('RESET ROLE');
  const roles = await query('SELECT role_code FROM app.user_roles WHERE user_id=$1 AND revoked_at IS NULL', [targetId]);
  assert.deepEqual(roles.rows.map(row => row.role_code), ['dispatch']);
  const history = await query('SELECT count(*) FROM app.user_roles WHERE user_id=$1 AND revoked_at IS NOT NULL', [targetId]);
  assert.ok(Number(history.rows[0].count) >= 2);
  const audit = await query("SELECT details FROM app.audit_events WHERE event_type='administrator.user_changed'");
  assert.equal(audit.rows.length, 15);
  assert.ok(audit.rows.filter(row => ['roles','permissions'].includes(row.details.operation)).every(row => row.details.previousValue && row.details.newValue));
  const output = JSON.stringify({ logs, audit: audit.rows, directory: overview.json() });
  for (const secret of [password, hash, token, admin.csrf, employee.csrf]) assert.ok(!output.includes(secret), 'secret must not appear in logs, audit or directory');
  await t.test('three new representatives are immediately selectable for customers without logging in first', async () => {
    await query('SET ROLE role_permission_runtime');
    const headers = { cookie: admin.cookie, 'x-csrf-token': admin.csrf };
    const reps = [];
    for (let index = 1; index <= 3; index++) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/admin/users', headers,
        payload: { username: 'fabricated-new-rep-' + index, displayName: 'FABRICATED Sales ' + index,
          password, role: index === 3 ? 'dispatch' : 'sales_representative',
          additionalRoles: index === 3 ? ['sales_representative'] : [], branchId: 'cape-town', department: 'Sales' },
      });
      assert.equal(response.statusCode, 201, response.body);
      const directory = (await app.inject({ url: '/api/v1/administration/overview', headers })).json().data;
      const rep = directory.representatives.find(row => row.userId === response.json().data.account.id);
      assert.ok(rep?.active);
      assert.equal(rep.branchId, 'cape-town');
      reps.push(rep);
    }
    const newCustomer = await app.inject({ method: 'POST', url: '/api/v1/admin/customer-accounts', headers,
      payload: { companyName: 'FABRICATED DIRECTORY UAT', contactName: 'Fabricated Contact',
        email: 'fabricated-directory-customer@example.invalid', phone: '0000000000', area: 'Western Cape',
        industry: 'Fabricated testing', branchId: 'cape-town', password },
    });
    assert.equal(newCustomer.statusCode, 201, newCustomer.body);
    const companyId = newCustomer.json().data.company.id;
    for (const rep of reps) {
      const assignment = await app.inject({ method: 'PUT', url: '/api/v1/administration/companies/' + companyId + '/representative', headers,
        payload: { representativeId: rep.id, reason: 'Fabricated assignment persistence test' },
      });
      assert.equal(assignment.statusCode, 200, assignment.body);
      const refreshed = (await app.inject({ url: '/api/v1/administration/overview', headers })).json().data;
      assert.equal(refreshed.companies.find(row => row.id === companyId).representativeId, rep.id);
    }
    const rename = await app.inject({ method: 'PATCH', url: '/api/v1/administration/users/' + reps[0].userId, headers,
      payload: { values: { displayName: 'FABRICATED Renamed Sales', branchId: 'johannesburg' } },
    });
    assert.equal(rename.statusCode, 200, rename.body);
    const directory = (await app.inject({ url: '/api/v1/administration/overview', headers })).json().data;
    const renamed = directory.representatives.find(row => row.id === reps[0].id);
    assert.equal(renamed.name, 'FABRICATED Renamed Sales');
    assert.equal(renamed.branchId, 'johannesburg');
    const mismatch = await app.inject({ method: 'PUT', url: '/api/v1/administration/companies/' + companyId + '/representative', headers,
      payload: { representativeId: renamed.id, reason: 'Fabricated wrong branch denial' },
    });
    assert.ok([403, 422].includes(mismatch.statusCode), mismatch.body);
    const grants = await query("SELECT has_function_privilege(current_user,'app.sync_representative_profile()','EXECUTE') AS allowed");
    assert.equal(grants.rows[0].allowed, false, 'no new privileged runtime function grant');
    await query('RESET ROLE');
    const assignments = await query('SELECT representative_id FROM app.representative_company_assignments WHERE company_id=$1 AND ended_at IS NOT NULL', [companyId]);
    assert.equal(assignments.rows.length, 2, 'prior customer assignments remain historical');
    // Replay the repair SQL on populated data to cover upgrades, not just empty databases.
    await query("UPDATE app.representatives SET branch_id='stale-branch' WHERE id=$1", [renamed.id]);
    await query('DROP TRIGGER sync_representative_profile ON app.users');
    await query('DROP FUNCTION app.sync_representative_profile()');
    const repair = await fs.readFile(new URL('../migrations/024_representative_directory_sync.sql', import.meta.url), 'utf8');
    if (typeof db.exec === 'function') await db.exec(repair); else await query(repair);
    const repaired = (await query('SELECT id,branch_id FROM app.representatives WHERE user_id=$1', [renamed.userId])).rows[0];
    assert.deepEqual(repaired, { id: renamed.id, branch_id: 'johannesburg' });
    assert.equal(Number((await query('SELECT count(*) FROM app.representative_company_assignments WHERE company_id=$1', [companyId])).rows[0].count), 3);
  });
  await t.test('Administrator deletion revokes user access and safely removes orders without erasing evidence', async () => {
    await query('RESET ROLE');
    const companyId = '82100000-0000-4000-8000-000000000901', orderId = '82100000-0000-4000-8000-000000000902';
    await query("INSERT INTO app.companies(id,name,area,industry) VALUES($1,'FABRICATED deletion company','Western Cape','Fabricated')",[companyId]);
    await query('INSERT INTO app.company_users(company_id,user_id,is_primary) VALUES($1,$2,true)',[companyId,customerId]);
    await query("INSERT INTO app.orders(id,reference,company_id,customer_user_id,origin,status,application,fulfilment,created_by_user_id) VALUES($1,'FAB-DELETE-ORDER',$2,$3,'representative_loaded_order','awaiting_planning','Fabricated deletion test','collect',$4)",[orderId,companyId,customerId,adminId]);
    await query('SET ROLE role_permission_runtime');
    const headers = auth => ({cookie:auth.cookie,'x-csrf-token':auth.csrf});
    const remove = (auth,path,body={reason:'FABRICATED duplicate created for deletion testing'}) => app.inject({method:'DELETE',url:'/api/v1/admin/'+path,headers:headers(auth),payload:body});
    assert.equal((await remove(customer,'orders/'+orderId)).statusCode,403);
    assert.equal((await remove(admin,'orders/'+orderId,{reason:'bad'})).statusCode,400);
    assert.equal((await remove(admin,'orders/not-a-uuid')).statusCode,400);
    assert.equal((await remove(admin,'orders/'+orderId,{reason:'Fabricated reason',roles:['administrator']})).statusCode,400);
    assert.equal((await app.inject({method:'DELETE',url:'/api/v1/admin/orders/'+orderId,headers:{cookie:admin.cookie},payload:{reason:'Fabricated reason'}})).statusCode,403);
    await assert.rejects(query('UPDATE app.orders SET deleted_at=now() WHERE id=$1',[orderId]),/permission denied/);
    await assert.rejects(query("SELECT app.soft_delete_order($1,'Fabricated SQL attack','test')",[orderId]),/Administrator required/);
    await query('RESET ROLE');
    await query('UPDATE app.orders SET details=$2::jsonb WHERE id=$1',[orderId,JSON.stringify({legalHold:{active:true}})]);
    await query('SET ROLE role_permission_runtime');
    assert.equal((await remove(admin,'orders/'+orderId)).statusCode,409);
    await query('RESET ROLE');
    await query('UPDATE app.orders SET details=$2::jsonb WHERE id=$1',[orderId,'{}']);
    await query('SET ROLE role_permission_runtime');
    const deleted = await remove(admin,'orders/'+orderId);
    assert.equal(deleted.statusCode,200,deleted.body);
    assert.equal((await remove(admin,'orders/'+orderId)).statusCode,200,'idempotent deletion');
    for (const auth of [admin,customer]) assert.equal((await app.inject({url:'/api/v1/orders/'+orderId,headers:headers(auth)})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/orders/'+orderId+'/workflow-actions',headers:headers(admin),payload:{action:'start_planning',data:{}}})).statusCode,404);
    const overview = await app.inject({url:'/api/v1/administration/overview',headers:headers(admin)});
    assert.equal(overview.statusCode,200,overview.body);
    assert.ok(!overview.json().data.correctionRecords.some(row=>row.id===orderId));
    // Test both customer and newly created employee sessions, not just a fixture flag.
    for (const [id,username,auth] of [[customerId,'fabricated-role-customer',customer],[created.json().data.account.id,'fabricated-role-created',createdAuth]]) {
      const result = await remove(admin,'users/'+id);
      assert.equal(result.statusCode,200,result.body);
      assert.equal((await app.inject({url:'/api/v1/auth/me',headers:headers(auth)})).statusCode,401);
      assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/login',remoteAddress:'127.0.0.88',payload:{identifier:username,password}})).statusCode,401);
    }
    assert.equal((await remove(admin,'users/'+adminId)).statusCode,403,'Administrator/self protection');
    await query('RESET ROLE');
    assert.equal(Number((await query('SELECT count(*) FROM app.orders WHERE id=$1 AND deleted_at IS NOT NULL',[orderId])).rows[0].count),1);
    assert.equal(Number((await query("SELECT count(*) FROM app.audit_events WHERE entity_id=$1 AND event_type='administrator.order_soft_deleted'",[orderId])).rows[0].count),1);
    assert.equal(Number((await query('SELECT count(*) FROM app.sessions WHERE user_id=$1 AND revoked_at IS NULL',[customerId])).rows[0].count),0);
  });

});
