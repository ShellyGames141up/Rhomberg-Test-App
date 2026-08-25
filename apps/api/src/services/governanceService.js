import path from 'node:path';
import { requirePermission } from '../authorization/permissions.js';
import { validationError } from '../errors.js';

const escapePdf=value=>String(value || '').replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
export function simplePdf(lines) {
  const stream=`BT /F1 11 Tf 50 790 Td ${lines.slice(0,45).map((line,index)=>`${index?'0 -16 Td ':''}(${escapePdf(line)}) Tj`).join(' ')} ET`;
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let text='%PDF-1.4\n'; const offsets=[0]; for(let index=1;index<objects.length;index+=1){offsets[index]=Buffer.byteLength(text);text+=`${index} 0 obj\n${objects[index]}\nendobj\n`;}
  const xref=Buffer.byteLength(text); text+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return Buffer.from(text);
}

export function createGovernanceService({repository,storage}) {
  const download=async(actor,orderId,documentId,correlationId)=>{
    const order=await repository.getOrder(actor,orderId); const document=await repository.getDocument(actor,documentId);
    if(document.order_id!==order.id || (actor.role==='customer' && (!document.customer_visible || document.scan_status!=='clean'))) { const error=new Error('The document was not found or is unavailable to your account.'); error.code='NOT_FOUND'; error.statusCode=404; throw error; }
    const buffer=await storage.get(document.storage_key); await repository.appendAudit({eventType:'document.downloaded',actorUserId:actor.id,actorRole:actor.role,companyId:order.companyId,action:'download_order_document',entityType:'document',entityId:document.id,outcome:'success',correlationId,details:{orderId}}); return {buffer,fileName:path.basename(document.original_name),mediaType:document.media_type};
  };
  return Object.freeze({
    listDocuments:async(actor,orderId)=>{const order=await repository.getOrder(actor,orderId);return repository.listOrderDocuments(actor,order.id);},
    download,
    async replaceDocument(actor,orderId,documentId,input,file,correlationId){ requirePermission(actor,'replace_order_source_document'); const reason=String(input?.reason || '').trim(); if(reason.length<5) throw validationError({reason:'Record why this document is being replaced.'}); if(!file) throw validationError({document:'Attach the replacement document.'}); const stored=await storage.put(file); try{return await repository.replaceOrderDocument(actor,{orderId,documentId,reason,document:stored,correlationId});}catch(error){await storage.remove(stored.storageKey).catch(()=>undefined);throw error;}},
    sharingOptions:async(actor,orderId)=>{await repository.getOrder(actor,orderId);return {audiences:[{id:'customer_safe',label:'Customer-safe summary'},{id:'internal',label:'Internal operational summary'}],emailEnabled:false,emailState:'simulated_pending',pricingIncluded:false};},
    async generateSummary(actor,orderId,input,correlationId){requirePermission(actor,'export_order_pdf');const order=await repository.getOrder(actor,orderId);const internal=input?.audience==='internal';if(internal&&!actor.permissions.includes('view_all_orders'))requirePermission(actor,'view_all_orders');const lines=['Rhomberg Connect Order Summary',order.reference,`Customer: ${order.company}`,`Status: ${order.trackingStatus}`,`Representative: ${order.selectedRep?.name || 'Unassigned'}`,...(order.items || []).map(item=>`${item.code} - ${item.name} - Quantity ${item.quantity}`)];const stored=await storage.put({buffer:simplePdf(lines),originalName:`${order.reference}-${internal?'internal':'customer'}-summary.pdf`,mediaType:'application/pdf'});return repository.saveGeneratedOrderDocument(actor,{orderId,kind:'order_summary',document:stored,customerVisible:!internal,correlationId});},
    async queueEmail(actor,orderId,input,correlationId){requirePermission(actor,'email_order_summary');const order=await repository.getOrder(actor,orderId);return repository.recordOrderEmail(actor,order.id,{recipient:String(input?.recipient || '').trim(),correlationId});},
    archive:(actor,orderId,input,correlationId)=>{requirePermission(actor,'archive_orders');return repository.mutateOrderGovernance(actor,orderId,'archive',input || {},correlationId);},
    approve:(actor,orderId,input,correlationId)=>{requirePermission(actor,'approve_archival');return repository.mutateOrderGovernance(actor,orderId,'approve_archive',input || {},correlationId);},
    restore:(actor,orderId,input,correlationId)=>{requirePermission(actor,'restore_archived_orders');return repository.mutateOrderGovernance(actor,orderId,'restore',input || {},correlationId);},
    legalHold:(actor,orderId,input,correlationId)=>{requirePermission(actor,'manage_legal_hold');return repository.mutateOrderGovernance(actor,orderId,'legal_hold',input || {},correlationId);},
    deletionRequest:(actor,orderId,input,correlationId)=>{requirePermission(actor,'archive_orders');return repository.mutateOrderGovernance(actor,orderId,'deletion_request',input || {},correlationId);},
    async retentionExport(actor,orderId,input,correlationId){requirePermission(actor,'export_archived_orders');return this.generateSummary(actor,orderId,{...input,audience:'internal'},correlationId);},
  });
}
