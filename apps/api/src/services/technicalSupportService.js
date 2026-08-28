import { randomUUID } from 'node:crypto';
import { requirePermission } from '../authorization/permissions.js';
import { validationError } from '../errors.js';
import { simplePdf } from './governanceService.js';
import path from 'node:path';
import { presentTechnicalRequest } from './technicalPresentation.js';

const categories=new Set(['product_selection','product_compatibility','product_configuration','application_suitability','material_suitability','pressure_range','temperature_range','connection_requirement','electrical_requirement','calibration_requirement','sanas_or_traceable_requirement','special_manufacturing_request','installation_question','missing_technical_information','other']);
const classifications=new Set(['internal_only','customer_safe']);
const clean=(value,max=4000)=>String(value || '').trim().slice(0,max+1);

function requestCommand(input={}) {
  const command={category:clean(input.category,80),question:clean(input.question),lineItemId:clean(input.lineItemId,80),priority:clean(input.priority,20)||'standard',classification:clean(input.classification,30),otherExplanation:clean(input.otherExplanation,1000),requestedTechnicalUserId:clean(input.requestedTechnicalUserId,80),confirmRequired:input.confirmRequired===true}; const errors={};
  if (!categories.has(command.category)) errors.category='Select a technical assistance category.';
  if (command.question.length<10) errors.question='Explain the technical question in at least 10 characters.';
  if (!command.lineItemId) errors.lineItemId='Select the RFQ line item concerned.';
  if (!['standard','high','urgent'].includes(command.priority)) errors.priority='Select a valid internal priority.';
  if (!classifications.has(command.classification)) errors.classification='Choose the message visibility.';
  if (command.category==='other' && command.otherExplanation.length<10) errors.otherExplanation='Explain the other category.';
  if (!command.confirmRequired) errors.confirmRequired='Confirm that technical assistance is required before quotation.';
  if (Object.keys(errors).length) throw validationError(errors,'Complete the Technical Support request.'); return command;
}

function messageCommand(input={},forcedClassification) { const command={message:clean(input.message),classification:forcedClassification || clean(input.classification,30),metadata:{...input}}; delete command.metadata.message; delete command.metadata.classification; delete command.metadata.attachment; const errors={}; if(command.message.length<2) errors.message='Enter a message.'; if(!classifications.has(command.classification)) errors.classification='Choose the message visibility.'; if(Object.keys(errors).length) throw validationError(errors,'Complete the technical message.'); return command; }

export function createTechnicalSupportService({repository,storage}) {
  const store=async file=>file ? storage.put(file) : null;
  return Object.freeze({
    async getByRfq(actor,rfqId) { return presentTechnicalRequest(await repository.getTechnicalSupportByRfq(actor,rfqId),actor); },
    async listQueue(actor, filters = {}) {
      requirePermission(actor,'view_technical_queue');
      const requests = await repository.listTechnicalRequests(actor);
      const result = [];
      for (const request of requests) {
        if (filters.status && request.status !== filters.status) continue;
        if (filters.priority && request.priority !== filters.priority) continue;
        const rfq = await repository.getEnquiry(actor,request.rfqId);
        const query = String(filters.query || '').trim().toLowerCase();
        if (query && ![rfq.reference,rfq.company,rfq.contact,rfq.selectedRep?.name,request.question].join(' ').toLowerCase().includes(query)) continue;
        result.push({...rfq,technicalSupport:presentTechnicalRequest(request,actor)});
      }
      return result;
    },
    async request(actor,rfqId,input,{attachment,correlationId}) { requirePermission(actor,'request_technical_support'); const document=await store(attachment); try { return await repository.createTechnicalSupportRequest(actor,rfqId,{...requestCommand(input),document,correlationId,id:randomUUID()}); } catch(error) { if(document) await storage.remove(document.storageKey).catch(()=>undefined); throw error; } },
    assign(actor,id,input,correlationId) { requirePermission(actor,'assign_technical_support'); const assignedUserId=clean(input.assignedUserId,80); if(!assignedUserId) throw validationError({assignedUserId:'Select a Technical Advisor.'}); return repository.transitionTechnicalSupport(actor,id,{action:'assign',toStatus:'technical_support_assigned',assignedUserId,correlationId}); },
    startReview(actor,id,correlationId) { requirePermission(actor,'respond_technical_support'); return repository.transitionTechnicalSupport(actor,id,{action:'start_review',toStatus:'technical_review_in_progress',correlationId}); },
    async postMessage(actor,id,input,{attachment,correlationId,action='post_message',toStatus}) { requirePermission(actor,actor.role==='customer'?'respond_customer_technical_request':'post_technical_message'); const document=await store(attachment); try { return await repository.addTechnicalSupportMessage(actor,id,{...messageCommand(input,actor.role==='customer'?'customer_safe':undefined),document,action,toStatus,correlationId}); } catch(error) { if(document) await storage.remove(document.storageKey).catch(()=>undefined); throw error; } },
    requestInformation(actor,id,input,options) { requirePermission(actor,'respond_technical_support'); return this.postMessage(actor,id,{...input,classification:'internal_only'},{...options,action:'request_information',toStatus:'awaiting_representative_information'}); },
    forwardCustomerRequest(actor,id,input,options) { requirePermission(actor,'request_technical_support'); return this.postMessage(actor,id,{...input,classification:'customer_safe'},{...options,action:'request_customer_information',toStatus:'awaiting_customer_information'}); },
    respond(actor,id,input,options) {
      requirePermission(actor,'respond_technical_support');
      const response=clean(input.response), recommendation=clean(input.recommendation);
      if(response.length<10 || recommendation.length<5) throw validationError({response:'Enter a clear response and recommendation.'});
      // A separate customer-safe note must never publish the internal answer.
      return this.postMessage(actor,id,{...input,response,recommendation,message:`${response}\n\nRecommendation: ${recommendation}`,classification:'internal_only'},{...options,action:'technical_response',toStatus:'technical_response_submitted'});
    },
    complete(actor,id,input,correlationId) { requirePermission(actor,'complete_technical_support'); return repository.transitionTechnicalSupport(actor,id,{action:'complete',toStatus:'technical_support_completed',comment:clean(input.comment,2000),correlationId}); },
    override(actor,id,input,correlationId) { requirePermission(actor,'override_technical_quotation_block'); const reason=clean(input.reason,2000); if(reason.length<10) throw validationError({reason:'Record a detailed override reason.'}); return repository.transitionTechnicalSupport(actor,id,{action:'override',toStatus:null,reason,correlationId}); },
    async downloadRfq(actor,id,correlationId){requirePermission(actor,'download_technical_documents');const request=(await repository.listTechnicalRequests(actor)).find(item=>item.id===id);if(!request){const error=new Error('The Technical Support request was not found.');error.code='NOT_FOUND';error.statusCode=404;throw error;}const rfq=await repository.getEnquiry(actor,request.rfqId);const pdf=simplePdf(['Rhomberg Connect RFQ',rfq.reference,`Customer: ${rfq.company}`,`Application: ${rfq.application}`,`Process medium: ${rfq.medium || 'Not recorded'}`,...rfq.items.map(item=>`${item.quantity} x ${item.product?.code || item.code} ${item.product?.name || item.name}`)]);await repository.appendAudit({eventType:'technical_support.rfq_downloaded',actorUserId:actor.id,actorRole:actor.role,companyId:rfq.companyId,action:'download_technical_rfq',entityType:'rfq',entityId:rfq.id,outcome:'success',correlationId,details:{requestId:id}});return{dataUrl:`data:application/pdf;base64,${pdf.toString('base64')}`,fileName:`${rfq.reference}-RFQ.pdf`};},
    async downloadAttachment(actor,id,documentId,correlationId){requirePermission(actor,'download_technical_documents');const document=await repository.getDocument(actor,documentId);if(document.technical_request_id!==id){const error=new Error('The technical document was not found.');error.code='NOT_FOUND';error.statusCode=404;throw error;}const buffer=await storage.get(document.storage_key);await repository.appendAudit({eventType:'technical_support.document_downloaded',actorUserId:actor.id,actorRole:actor.role,companyId:document.company_id,action:'download_technical_document',entityType:'document',entityId:document.id,outcome:'success',correlationId,details:{requestId:id}});return{buffer,fileName:path.basename(document.original_name),mediaType:document.media_type};},
  });
}
