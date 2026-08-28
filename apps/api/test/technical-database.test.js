import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';
import { createMemoryPrivateStorage } from '../src/storage/localPrivateStorage.js';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/security/crypto.js';
import { createApiServices } from '../../../src/services/api/createApiServices.js';

test('Technical referral uses saved lines, assignment, correspondence and runtime company isolation', {timeout:120000}, async t => {
  const url=process.env.RHOMBERG_TEST_TECHNICAL_DATABASE_URL;
  if(url) {const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));assert.match(parsed.pathname,/^\/rhomberg_technical_test_[a-z0-9_]+$/);}
  const db=url?new pg.Client({connectionString:url}):new PGlite();
  if(url) await db.connect();
  t.after(()=>url?db.end():db.close());
  await runMigrations(db);await runMigrations(db);
  const q=(sql,values)=>db.query(sql,values);
  const keys=['customer','other','sales','unassigned','technical','admin','owner','company','otherCompany','rep','otherRep','rfq','otherRfq','line'];
  const ids=Object.fromEntries(keys.map(key=>[key,randomUUID()]));
  const password='Fabricated-Technical-Only!681',hash=await hashPassword(password);
  for(const [key,role] of [['customer','customer'],['other','customer'],['sales','sales_representative'],['unassigned','sales_representative'],['technical','technical_support'],['admin','administrator'],['owner','company_owner']]) {
    await q("INSERT INTO app.users(id,username,email,display_name,password_hash,identity_provider,status) VALUES($1,$2,$3,$2,$4,'local_password','active')",[ids[key],'fabricated-'+key,key+'@example.invalid',hash]);
    await q('INSERT INTO app.user_roles(user_id,role_code) VALUES($1,$2)',[ids[key],role]);
  }
  for(const key of ['company','otherCompany']) await q("INSERT INTO app.companies(id,name,area,industry) VALUES($1,$2,'Western Cape','Fabricated')",[ids[key],'FABRICATED '+key]);
  await q('INSERT INTO app.company_users(company_id,user_id,is_primary) VALUES($1,$2,true),($3,$4,true)',[ids.company,ids.customer,ids.otherCompany,ids.other]);
  for(const [key,user,company] of [['rep','sales','company'],['otherRep','unassigned','otherCompany']]) {
    await q("INSERT INTO app.representatives(id,user_id,display_name,branch_name) VALUES($1,$2,$3,'Fabricated branch')",[ids[key],ids[user],'FABRICATED '+key]);
    await q('INSERT INTO app.representative_company_assignments(representative_id,company_id) VALUES($1,$2)',[ids[key],ids[company]]);
  }
  for(const [key,rep,company,customer] of [['rfq','rep','company','customer'],['otherRfq','otherRep','otherCompany','other']]) await q("INSERT INTO app.rfqs(id,reference,company_id,requester_user_id,representative_id,status,application,area,fulfilment,collection_branch) VALUES($1,$2,$3,$4,$5,'under_rep_review','FABRICATED requirement','Western Cape','collect','Fabricated branch')",[ids[key],'FAB-'+key,ids[company],ids[customer],ids[rep]]);
  await q("INSERT INTO app.rfq_items(id,rfq_id,line_number,product_id,product_code_snapshot,product_name_snapshot,quantity,configuration) VALUES($1,$2,1,(SELECT id FROM app.products WHERE code='PBB' LIMIT 1),'PBB','FABRICATED gauge',2,'{}')",[ids.line,ids.rfq]);
  await q("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='technical_test_runtime') THEN CREATE ROLE technical_test_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $$");
  const source=await fs.readFile(new URL('../sql/phase1-runtime-grants.sql',import.meta.url),'utf8');
  const databaseName=(await q('SELECT current_database() AS name')).rows[0].name;
  const grants=source.slice(source.indexOf('REVOKE ALL ON SCHEMA'),source.indexOf('-- Resolve each exact approved signature')).replaceAll(':"runtime_role"','"technical_test_runtime"').replaceAll(':"DBNAME"','"'+databaseName+'"');
  for(const statement of grants.split(';').filter(s=>s.trim())) {if(!url && /GRANT CONNECT ON DATABASE/.test(statement))continue;await q(statement);}
  for(const match of source.slice(0,source.indexOf('missing_signatures text[]')).matchAll(/'(app\.[^']+\([^']*\))'/g))await q('GRANT EXECUTE ON FUNCTION '+match[1]+' TO technical_test_runtime');
  await q('SET ROLE technical_test_runtime');
  let pending=Promise.resolve();
  const repository=createPostgresRepository({query:q,connect:async()=>{const before=pending;let release;pending=new Promise(resolve=>{release=resolve;});await before;return{query:q,release};}});
  const app=await buildApp({repository,storage:createMemoryPrivateStorage(),config:{environment:'test',host:'127.0.0.1',port:0,logLevel:'silent',trustProxy:false,cookieSecure:false,cookieName:'fabricated_technical_session',sessionTtlSeconds:3600,sessionPepper:'fabricated-local-technical-pepper-32-characters',maxUploadBytes:4194304,allowedOrigins:[],identityMode:'local_password'}});
  t.after(()=>app.close());
  const clients={};let clientNumber=1;
  for(const role of ['customer','other','sales','unassigned','technical','admin','owner']) {
    const remoteAddress='127.0.0.'+clientNumber++;let cookie='';
    const api=createApiServices({apiBaseUrl:'http://adapter.invalid/api/v1',fetchImplementation:async(input,init)=>{
      const req=new Request(input,init),headers=Object.fromEntries(req.headers);if(cookie)headers.cookie=cookie;
      const response=await app.inject({remoteAddress,method:req.method,url:new URL(req.url).pathname+new URL(req.url).search,headers,payload:req.method==='GET'?undefined:Buffer.from(await req.arrayBuffer())});
      if(response.headers['set-cookie'])cookie=response.headers['set-cookie'].split(';')[0];
      return new Response(response.statusCode===204?null:response.rawPayload,{status:response.statusCode,headers:response.headers});
    }});
    await api.auth.signIn({email:role+'@example.invalid',password});clients[role]={api,headers:()=>({cookie})};
  }
  const sales=clients.sales.api.technicalSupport,technical=clients.technical.api.technicalSupport;
  const rfqs=await clients.sales.api.enquiries.list();
  assert.equal(rfqs.length,1);assert.equal(rfqs[0].items[0].lineId,ids.line);
  assert.ok((await sales.getOptions()).technicalUsers.some(user=>user.id===ids.technical));
  await assert.rejects(clients.technical.api.enquiries.getById(ids.rfq),'Unreferred RFQ is private');
  const input={category:'product_compatibility',question:'INTERNAL-SENTINEL Is this gauge suitable?',lineItemId:ids.line,priority:'standard',classification:'internal_only',confirmRequired:true};
  await assert.rejects(clients.unassigned.api.technicalSupport.request(ids.rfq,input));
  await sales.request(ids.rfq,input);
  await assert.rejects(sales.request(ids.rfq,input));
  let request=await sales.getByRfq(ids.rfq);
  assert.equal(new Date(request.revisedQuotationTargetAt)-new Date(request.originalQuotationTargetAt),86400000);
  let queue=await technical.listQueue();
  assert.equal(queue.length,1);assert.equal(queue[0].items[0].lineId,ids.line);
  assert.equal(queue[0].technicalSupport.id,request.id);
  await assert.rejects(clients.customer.api.technicalSupport.listQueue());
  assert.equal(await clients.other.api.technicalSupport.getByRfq(ids.rfq),null);
  assert.equal(await clients.unassigned.api.technicalSupport.getByRfq(ids.rfq),null);
  await technical.assign(request.id,{technicalUserId:ids.technical});
  await technical.startReview(request.id);
  await technical.requestInformation(request.id,{target:'customer',message:'INTERNAL-SENTINEL Ask for medium.'});
  request=await sales.getByRfq(ids.rfq);assert.equal(request.pendingInformationTarget,'customer');
  await sales.forwardCustomerRequest(request.id,{message:'Please confirm the process medium.'});
  const safe=await clients.customer.api.technicalSupport.getByRfq(ids.rfq);
  assert.doesNotMatch(JSON.stringify(safe),/INTERNAL-SENTINEL/);
  await clients.customer.api.technicalSupport.postMessage(request.id,{message:'FABRICATED medium: water',classification:'customer_safe'});
  assert.equal((await technical.getByRfq(ids.rfq)).status,'technical_review_in_progress');
  await technical.respond(request.id,{response:'INTERNAL-SENTINEL This configuration is suitable.',recommendation:'Use the approved gauge.',customerSafeNote:'Your configuration has been checked.'});
  await technical.complete(request.id,{comment:'Review complete.'});
  request=await sales.getByRfq(ids.rfq);assert.equal(request.status,'technical_support_completed');
  assert.ok(request.response.response.includes('INTERNAL-SENTINEL'));
  const completedSafe=JSON.stringify(await clients.customer.api.technicalSupport.getByRfq(ids.rfq));
  assert.doesNotMatch(completedSafe,/INTERNAL-SENTINEL/);
  assert.match(completedSafe,/Your configuration has been checked/);
  const notifications=await app.inject({url:'/api/v1/notifications',headers:clients.customer.headers()});
  assert.equal(notifications.statusCode,200);
  assert.match(notifications.body,/Technical review is complete/);
  assert.doesNotMatch(notifications.body,/INTERNAL-SENTINEL/);
  await assert.rejects(technical.startReview(request.id));
  await sales.request(ids.rfq,{...input,requestedTechnicalUserId:ids.technical});
  const assigned=await technical.getByRfq(ids.rfq);
  assert.equal(assigned.status,'technical_support_assigned');
  await technical.startReview(assigned.id);
  const before=await app.inject({url:'/api/v1/workspace/updates',headers:clients.admin.headers()});
  assert.equal(before.statusCode,200,before.body);assert.equal(before.json().data.intervalSeconds,900);
  const registered=await app.inject({method:'POST',url:'/api/v1/auth/register',payload:{company:'FABRICATED newly registered company',contact:'FABRICATED new contact',email:'new-register@example.invalid',phone:'0000000000',area:'Gauteng',industry:'Manufacturing',password}});
  assert.equal(registered.statusCode,201,registered.body);
  const after=await app.inject({url:'/api/v1/workspace/updates',headers:clients.admin.headers()});
  assert.notEqual(after.json().data.revision,before.json().data.revision);
  const overview=await app.inject({url:'/api/v1/administration/overview',headers:clients.admin.headers()});
  assert.equal(overview.statusCode,200,overview.body);assert.ok(overview.body.includes('new-register@example.invalid'));
  const dashboard=await clients.owner.api.management.getDashboard();
  assert.equal(dashboard.records.filter(row=>row.workflowType==='rfq').length,2);
});
