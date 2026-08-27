import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/security/crypto.js';
import { createApiServices } from '../../../src/services/api/createApiServices.js';
import { DISPATCH_METHODS, DISPATCH_PROOF_TYPES } from '../../../src/domain/dispatch.js';

test('Sales multipart quotation and Dispatch receipt-to-completion use the real adapter and runtime RLS', { timeout: 120000 }, async t => {
  const url = process.env.RHOMBERG_TEST_DISPATCH_DATABASE_URL;
  if (url) { const parsed = new URL(url); assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname)); assert.match(parsed.pathname, /^\/rhomberg_dispatch_test_[a-z0-9_]+$/); }
  const db = url ? new pg.Client({ connectionString: url }) : new PGlite();
  if (url) await db.connect();
  t.after(() => url ? db.end() : db.close());
  await runMigrations(db); await runMigrations(db);
  const q = (sql, values) => db.query(sql, values);
  const ids = Object.fromEntries(['customer','other','sales','unassigned','dispatch','planning','company','otherCompany','rep','otherRep','rfq','otherRfq','collect','deliver','lab'].map(key => [key,randomUUID()]));
  const password = 'Fabricated-Dispatch-Only!584';
  const hash = await hashPassword(password);
  for (const [key,role] of [['customer','customer'],['other','customer'],['sales','sales_representative'],['unassigned','sales_representative'],['dispatch','dispatch'],['planning','planning']]) {
    await q("INSERT INTO app.users(id,username,email,display_name,password_hash,identity_provider,status) VALUES($1,$2,$3,$2,$4,'local_password','active')",[ids[key],'fabricated-'+key,key+'@example.invalid',hash]);
    await q('INSERT INTO app.user_roles(user_id,role_code) VALUES($1,$2)',[ids[key],role]);
  }
  for (const key of ['company','otherCompany']) await q("INSERT INTO app.companies(id,name,area,industry) VALUES($1,$2,'Western Cape','Fabricated')",[ids[key],'FABRICATED '+key]);
  await q('INSERT INTO app.company_users(company_id,user_id,is_primary) VALUES($1,$2,true),($3,$4,true)',[ids.company,ids.customer,ids.otherCompany,ids.other]);
  for (const [key,user,company] of [['rep','sales','company'],['otherRep','unassigned','otherCompany']]) {
    await q("INSERT INTO app.representatives(id,user_id,display_name,branch_name) VALUES($1,$2,$3,'Fabricated branch')",[ids[key],ids[user],'FABRICATED '+key]);
    await q('INSERT INTO app.representative_company_assignments(representative_id,company_id) VALUES($1,$2)',[ids[key],ids[company]]);
  }
  for (const [key,rep,company,customer] of [['rfq','rep','company','customer'],['otherRfq','otherRep','otherCompany','other']]) {
    await q("INSERT INTO app.rfqs(id,reference,company_id,requester_user_id,representative_id,status,application,area,fulfilment,collection_branch) VALUES($1,$2,$3,$4,$5,'under_rep_review','FABRICATED requirement','Western Cape','collect','Fabricated branch')",[ids[key],'FAB-'+key,ids[company],ids[customer],ids[rep]]);
  }
  for (const key of ['collect','deliver','lab']) await q("INSERT INTO app.orders(id,reference,company_id,customer_user_id,representative_id,origin,status,application,fulfilment,created_by_user_id) VALUES($1,$2,$3,$4,$5,'representative_loaded_order',$6,'FABRICATED requirement',$7,$8)",[ids[key],'FAB-'+key,ids.company,ids.customer,ids.rep,key==='lab'?'awaiting_lab_receipt_dispatch':'awaiting_dispatch',key==='deliver'?'delivery':'collect',ids.sales]);
  await q("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dispatch_test_runtime') THEN CREATE ROLE dispatch_test_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $$");
  const grantsSource = await fs.readFile(new URL('../sql/phase1-runtime-grants.sql',import.meta.url),'utf8');
  const databaseName = (await q('SELECT current_database() AS name')).rows[0].name;
  const grants = grantsSource.slice(grantsSource.indexOf('REVOKE ALL ON SCHEMA'),grantsSource.indexOf('-- Resolve each exact approved signature')).replaceAll(':"runtime_role"','"dispatch_test_runtime"').replaceAll(':"DBNAME"','"'+databaseName+'"');
  for (const statement of grants.split(';').filter(s => s.trim())) { if (!url && /GRANT CONNECT ON DATABASE/.test(statement)) continue; await q(statement); }
  for (const match of grantsSource.slice(0,grantsSource.indexOf('missing_signatures text[]')).matchAll(/'(app\.[^']+\([^']*\))'/g)) await q('GRANT EXECUTE ON FUNCTION '+match[1]+' TO dispatch_test_runtime');
  await q('SET ROLE dispatch_test_runtime');
  let pending = Promise.resolve();
  const repository = createPostgresRepository({ query:q, connect:async () => { const before=pending; let release; pending=new Promise(resolve=>{release=resolve;}); await before; return {query:q,release}; } });
  const storage = createMemoryPrivateStorage(), logs = [];
  const app = await buildApp({ repository, storage, config:{ environment:'test',host:'127.0.0.1',port:0,logLevel:'info',trustProxy:false,cookieSecure:false,cookieName:'fabricated_dispatch_session',sessionTtlSeconds:3600,sessionPepper:'fabricated-local-dispatch-pepper-32-characters',maxUploadBytes:4194304,allowedOrigins:[],identityMode:'local_password' },logStream:new Writable({write(chunk,_encoding,callback){logs.push(chunk.toString());callback();}}) });
  t.after(() => app.close());
  const clients = {};
  let clientNumber = 1;
  for (const role of ['customer','other','sales','unassigned','dispatch','planning']) {
    const remoteAddress = `127.0.0.${clientNumber++}`;
    let cookie = '';
    const api = createApiServices({ apiBaseUrl:'http://adapter.invalid/api/v1', fetchImplementation:async (input,init) => {
      const req = new Request(input,init), headers = Object.fromEntries(req.headers);
      if (cookie) headers.cookie = cookie;
      const response = await app.inject({remoteAddress,method:req.method,url:new URL(req.url).pathname,headers,payload:req.method==='GET'?undefined:Buffer.from(await req.arrayBuffer())});
      if (response.headers['set-cookie']) cookie = response.headers['set-cookie'].split(';')[0];
      return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers});
    } });
    await api.auth.signIn({email:role+'@example.invalid',password});
    clients[role] = {api,headers:() => ({cookie})};
  }
  const options = await clients.dispatch.api.dispatch.getWorkspaceOptions();
  assert.deepEqual(options.methods,DISPATCH_METHODS);
  assert.deepEqual(options.proofTypes,DISPATCH_PROOF_TYPES);
  const pdf = new File(['%PDF-1.4\nFABRICATED TEST ONLY\n%%EOF'],'fabricated.pdf',{type:'application/pdf'});
  const quote = {action:'mark_quoted',entityType:'rfq',data:{quotationNumber:'FAB-Q-01',quotationDate:'2020-01-01',quotationExpiryMode:'not_applicable',quotationInternalNote:'INTERNAL-SALES-SENTINEL',quotationCustomerNote:'Quotation sent separately.',quotationDocumentFile:pdf,quotationDocumentCustomerVisible:true,quotationCommercialTotal:123.45}};
  quote.expectedVersion = 0;
  await assert.rejects(clients.unassigned.api.workflow.performAction(ids.rfq,quote));
  assert.equal(storage._objects.size,0,'Rejected uploads must be cleaned up');
  const quoted = await clients.sales.api.workflow.performAction(ids.rfq,quote);
  assert.equal(quoted.trackingStatus,'quoted');
  assert.equal(quoted.quotation.document.scanStatus,'pending');
  const customerRfq = await clients.customer.api.enquiries.getById(ids.rfq);
  assert.doesNotMatch(JSON.stringify(customerRfq),/INTERNAL-SALES-SENTINEL|commercialTotal|storageKey/);
  await assert.rejects(clients.other.api.enquiries.getById(ids.rfq));
  const act = (key,action,data={},who='dispatch') => clients[who].api.workflow.performAction(ids[key],{action,entityType:'order',expectedVersion:0,data});
  const receipt = {dispatchReceipt:{sourceDepartment:'quality_assurance',numberOfPackages:2,customerMessage:'Your order is received in Dispatch.',internalNote:'INTERNAL-DISPATCH-SENTINEL'}};
  await assert.rejects(act('collect','confirm_dispatch_receipt',receipt,'customer'));
  await assert.rejects(act('collect','confirm_dispatch_receipt',receipt,'planning'));
  const noCsrf = await app.inject({method:'POST',url:'/api/v1/orders/'+ids.collect+'/workflow-actions',headers:clients.dispatch.headers(),payload:{action:'confirm_dispatch_receipt',data:receipt}});
  assert.equal(noCsrf.statusCode,403);
  const base = {dispatchMethod:'collection',dispatchReadyDate:'2020-01-01',dispatchNumberOfPackages:2,dispatchCustomerMessage:'Your order is ready for handover.',dispatchInternalNotes:'INTERNAL-DISPATCH-SENTINEL'};
  await assert.rejects(act('collect','mark_ready_for_collection',base),error=>error.status===409);
  await act('collect','confirm_dispatch_receipt',receipt);
  await assert.rejects(act('collect','confirm_dispatch_receipt',receipt),error=>error.status===409);
  const refreshed = await clients.dispatch.api.orders.getById(ids.collect);
  assert.ok(refreshed.dispatch.receivedAt);
  assert.ok(refreshed.allowedWorkflowActions.some(action=>action.action==='mark_ready_for_collection'));
  await act('collect','mark_ready_for_collection',base);
  await assert.rejects(act('collect','complete_collection',base),error=>error.status===409);
  await act('collect','confirm_collection',{...base,dispatchCollectionDate:'2020-01-02',dispatchRecipientName:'Fabricated Collector',dispatchProofType:'collection_confirmation',dispatchProofFile:pdf});
  const completed = await act('collect','complete_collection',base);
  assert.equal(completed.trackingStatus,'completed');
  assert.ok(completed.completedAt);
  await act('deliver','confirm_dispatch_receipt',receipt);
  const delivery = {...base,dispatchMethod:'courier',dispatchCourierOrDriver:'Fabricated Courier'};
  await act('deliver','start_delivery',delivery);
  await act('deliver','report_delivery_problem',{...delivery,dispatchProblemReason:'Fabricated address clarification'});
  await act('deliver','confirm_delivery',{...delivery,dispatchDeliveryDate:'2020-01-02',dispatchRecipientName:'Fabricated Recipient'});
  assert.equal((await act('deliver','complete_delivery',delivery)).trackingStatus,'completed');
  assert.equal((await act('lab','confirm_lab_receipt_dispatch')).trackingStatus,'awaiting_dispatch');
  const customerOrder = await clients.customer.api.orders.getById(ids.collect);
  assert.doesNotMatch(JSON.stringify(customerOrder),/INTERNAL-DISPATCH-SENTINEL|storageKey|exceptionReason/);
  await assert.rejects(clients.other.api.orders.getById(ids.collect));
  assert.equal((await clients.dispatch.api.orders.getById(ids.collect)).dispatch.recipientName,'Fabricated Collector');
  const proofId = completed.dispatch.proofOfDelivery.id;
  assert.ok(proofId);
  const proofPath = '/api/v1/orders/'+ids.collect+'/source-documents/'+proofId+'/download';
  assert.equal((await app.inject({url:proofPath,headers:clients.dispatch.headers()})).statusCode,200);
  assert.equal((await app.inject({url:proofPath,headers:clients.customer.headers()})).statusCode,404);
  assert.equal((await app.inject({url:proofPath,headers:clients.other.headers()})).statusCode,404);
  const notices = await app.inject({url:'/api/v1/notifications',headers:clients.customer.headers()});
  assert.ok(notices.json().data.some(item=>item.eventType==='workflow_complete_collection'));
  await q('RESET ROLE');
  assert.ok(Number((await q("SELECT count(*) FROM app.audit_events WHERE action='complete_collection'")).rows[0].count)>0);
  const proof = (await q("SELECT * FROM app.document_metadata WHERE order_id=$1 AND kind='dispatch_proof'",[ids.collect])).rows[0];
  assert.equal(proof.customer_visible,false); assert.equal(proof.scan_status,'pending');
  assert.equal(storage._objects.size,2);
  assert.doesNotMatch(logs.join(''),new RegExp(password+'|INTERNAL-DISPATCH-SENTINEL|INTERNAL-SALES-SENTINEL'));
  for (const client of Object.values(clients)) assert.ok(!logs.join('').includes(client.headers().cookie.split('=')[1]), 'Session tokens must not enter logs');
  const session = (await q('SELECT token_hash FROM app.sessions WHERE user_id=$1 AND revoked_at IS NULL',[ids.dispatch])).rows[0];
  await q('SET ROLE dispatch_test_runtime');
  await q('BEGIN');
  await q('SELECT app.establish_request_context($1)',[session.token_hash]);
  await assert.rejects(q(`INSERT INTO app.document_metadata(company_id,order_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,scan_status,customer_visible)
    VALUES($1,$2,$3,'dispatch_proof','fabricated.pdf','fabricated-invalid-key','application/pdf',10,$4,'pending',false)`,[ids.otherCompany,ids.lab,ids.dispatch,'a'.repeat(64)]), error=>error.code==='42501');
  await q('ROLLBACK');
});
