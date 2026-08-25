import { createHash } from 'node:crypto';
import { PERMISSIONS, requirePermission } from '../authorization/permissions.js';
import { validationError } from '../errors.js';

const sources = new Set(['email','telephone','in_person','existing_quotation','other_approved_source']);
const priorities = new Set(['standard','high','urgent']);
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const clean = (value, max = 2000) => String(value || '').trim().slice(0, max + 1);

function validate(input, today = new Date().toISOString().slice(0,10)) {
  const errors = {};
  const command = {
    companyId:clean(input.companyId,80),customerContactId:clean(input.customerContactId,80),branchId:clean(input.branchId,80),
    representativeId:clean(input.representativeId,80),source:clean(input.orderSource,40),sourceOther:clean(input.orderSourceOther,500),
    application:clean(input.application),fulfilment:clean(input.fulfilment,20),deliveryAddress:clean(input.deliveryAddress,500),
    customerNotes:clean(input.customerNotes),internalNotes:clean(input.internalRepresentativeNotes),requiredDate:clean(input.requiredDate,10),
    priority:clean(input.priority,20) || 'standard',quotationNumber:clean(input.quotationNumber,100),quotationDate:clean(input.quotationDate,10),
    quotationRevision:clean(input.quotationRevision,60),purchaseOrderNumber:clean(input.purchaseOrderNumber,100),purchaseOrderDate:clean(input.purchaseOrderDate,10),
    confirmationNote:clean(input.confirmationNote),sourceConfirmed:input.sourceConfirmed === true,duplicateConfirmed:input.duplicateConfirmed === true,
    items:Array.isArray(input.items) ? input.items : [],submissionKey:clean(input.submissionKey,160),
  };
  if (!/^[0-9a-f-]{36}$/i.test(command.companyId)) errors.companyId='Select an existing customer company.';
  if (!/^[0-9a-f-]{36}$/i.test(command.customerContactId)) errors.customerContactId='Select an authorised customer contact.';
  if (!command.branchId) errors.branchId='Select the assigned branch.';
  if (!/^[0-9a-f-]{36}$/i.test(command.representativeId)) errors.representativeId='Select the dedicated representative.';
  if (!sources.has(command.source)) errors.orderSource='Select an approved order source.';
  if (command.source === 'other_approved_source' && command.sourceOther.length < 5) errors.orderSourceOther='Explain the approved source.';
  if (command.application.length < 5) errors.application='Describe the customer application or requirement.';
  if (!['delivery','collect'].includes(command.fulfilment)) errors.fulfilment='Choose delivery or collection.';
  if (command.fulfilment === 'delivery' && command.deliveryAddress.length < 5) errors.deliveryAddress='Enter the authorised delivery address.';
  if (!priorities.has(command.priority)) errors.priority='Select a valid internal priority.';
  if (command.requiredDate && (!dateOnly(command.requiredDate) || command.requiredDate < today)) errors.requiredDate='Enter a valid future required date.';
  if (!command.quotationNumber) errors.quotationNumber='Enter the quotation number.';
  if (!dateOnly(command.quotationDate) || command.quotationDate > today) errors.quotationDate='Enter a valid quotation date.';
  if (!command.purchaseOrderNumber) errors.purchaseOrderNumber='Enter the Purchase Order number.';
  if (!dateOnly(command.purchaseOrderDate) || command.purchaseOrderDate > today) errors.purchaseOrderDate='Enter a valid Purchase Order date.';
  if (!command.sourceConfirmed) errors.sourceConfirmed='Confirm all representative order checks.';
  if (command.submissionKey.length < 8) errors.submission='A valid duplicate-protection key is required.';
  if (!command.items.length || command.items.length > 100) errors.items='Add between 1 and 100 configured products.';
  command.items = command.items.map((item,index) => {
    const productId=clean(item.productId,80); const quantity=Number(item.quantity); const configuration=item.configuration;
    if (!productId || !Number.isInteger(quantity) || quantity<1 || quantity>9999 || !configuration || typeof configuration !== 'object' || Array.isArray(configuration)) errors[`items.${index}`]='Select a configured product and quantity between 1 and 9,999.';
    return { productId,quantity,configuration:configuration || {} };
  });
  if (Object.keys(errors).length) throw validationError(errors,'Check the customer order details.');
  return command;
}

export function createRepresentativeOrderService({ repository, storage, publicReferenceService, branches }) {
  return Object.freeze({
    async getOptions(actor) {
      requirePermission(actor,PERMISSIONS.LOAD_CUSTOMER_ORDER);
      const options=await repository.getRepresentativeOrderOptions(actor);
      return { ...options,branches,products:publicReferenceService.listProducts(),orderSources:[['email','Email'],['telephone','Telephone'],['in_person','In-person'],['existing_quotation','Existing quotation'],['other_approved_source','Other approved source']].map(([id,label])=>({id,label})),priorities:[['standard','Standard'],['high','High'],['urgent','Urgent']].map(([id,label])=>({id,label})) };
    },
    checkDuplicate(actor,input) { requirePermission(actor,PERMISSIONS.LOAD_CUSTOMER_ORDER); return repository.checkRepresentativeOrderDuplicate(actor,input); },
    async create(actor,input,{files,idempotencyKey,correlationId}) {
      requirePermission(actor,PERMISSIONS.LOAD_CUSTOMER_ORDER);
      const command=validate({ ...input,submissionKey:idempotencyKey || input.submissionKey });
      const quotation=files.quotation?.[0]; const purchaseOrder=files.purchaseOrder?.[0];
      const errors={};
      if (!quotation) errors.quotationFile='Attach the customer quotation.';
      if (!purchaseOrder) errors.purchaseOrderFile='Attach the customer Purchase Order.';
      if (quotation && purchaseOrder && quotation.originalName.toLowerCase()===purchaseOrder.originalName.toLowerCase() && quotation.buffer.equals(purchaseOrder.buffer)) errors.purchaseOrderFile='The quotation and Purchase Order must be different files.';
      if (Object.keys(errors).length) throw validationError(errors,'Both source documents are required.');
      const stored=[];
      try {
        for (const [kind,fileList] of Object.entries(files)) for (const file of fileList) stored.push({ kind, ...(await storage.put(file)) });
        const requestHash=createHash('sha256').update(JSON.stringify({ ...command,documents:stored.map(item => [item.kind,item.sha256Hex]) })).digest('hex');
        const result=await repository.createRepresentativeOrder(actor,{ ...command,documents:stored,requestHash,correlationId });
        if (result.idempotent) for (const document of stored) await storage.remove(document.storageKey).catch(() => undefined);
        return result;
      } catch (error) {
        for (const document of stored) await storage.remove(document.storageKey).catch(() => undefined);
        throw error;
      }
    },
  });
}
