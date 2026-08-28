import assert from 'node:assert/strict';
import test from 'node:test';
import { presentTechnicalRequest } from '../src/services/technicalPresentation.js';
import { createTechnicalSupportService } from '../src/services/technicalSupportService.js';

const record = { id:'technical-one', rfqId:'rfq-one', category:'product_selection',
  question:'Internal private question', lineItemId:'line-one', status:'technical_review_in_progress',
  createdAt:'2026-08-28T08:00:00Z', originalQuotationTarget:'2026-08-29T08:00:00Z',
  revisedQuotationTarget:'2026-08-30T08:00:00Z', assignedTechnicalUserId:'advisor-one',
  messages:[{id:'message-one',message:'Private technical answer',classification:'internal_only',metadata:{response:'Private answer',recommendation:'Private recommendation'}},
    {id:'message-two',message:'Please confirm the measurement range.',classification:'customer_safe',metadata:{internalNote:'must not leave the API'}}] };

test('technical read contract supplies dates, assignment and internal answer; customer projection is safe',()=>{
  const internal=presentTechnicalRequest(record,{role:'technical_support'});
  assert.equal(internal.assignedTechnicalUser.id,'advisor-one');
  assert.equal(internal.additionalAllowanceHours,24);
  assert.equal(internal.response.response,'Private answer');
  assert.equal(internal.revisedQuotationTargetAt,record.revisedQuotationTarget);
  const customer=presentTechnicalRequest(record,{role:'customer'});
  assert.equal(customer.messages.length,1);
  assert.doesNotMatch(JSON.stringify(customer),/Private|Internal private|internalNote|must not leave/);
});

test('technical queue uses the RFQ wrapper and persisted line IDs required by the real screen',async()=>{
  const actor={role:'technical_support',permissions:['view_technical_queue']};
  const service=createTechnicalSupportService({repository:{
    listTechnicalRequests:async()=>[record],
    getEnquiry:async(a,id)=>{assert.equal(a,actor);assert.equal(id,'rfq-one');return {id,reference:'RQ-FABRICATED',company:'Fabricated',items:[{lineId:'line-one',code:'PBB',quantity:2}]};},
  }});
  const [rfq]=await service.listQueue(actor,{query:'RQ-FABRICATED'});
  assert.equal(rfq.items[0].lineId,rfq.technicalSupport.lineItemId);
  assert.deepEqual(await service.listQueue(actor,{status:'technical_support_completed'}),[]);
  await assert.rejects(service.listQueue({role:'customer',permissions:[]}),/authoris|permission/i);
});

test('customer-safe note cannot publish an internal technical response or metadata',async()=>{
  let saved;
  const service=createTechnicalSupportService({repository:{addTechnicalSupportMessage:async(a,id,command)=>{saved=command;return command;}},storage:{}});
  await service.respond({role:'technical_support',permissions:['respond_technical_support','post_technical_message']},record.id,
    {response:'Internal calculations must remain private.',recommendation:'Use the approved fabricated product.',customerSafeNote:'Review finished.',classification:'customer_safe'}, {correlationId:'fabricated'});
  assert.equal(saved.classification,'internal_only');
});
