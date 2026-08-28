import { validationError } from '../errors.js';
import { validateQuotation } from '../domain/quotation.js';
import { QA_PROBLEM_CATEGORIES, QA_SEVERITIES, QA_REWORK_DESTINATIONS } from '../domain/qualityOptions.js';
import { PRODUCTION_STEPS as EXPEDITOR_PROGRESS_STEPS } from '../domain/productionHandoffs.js';
import { DISPATCH_ACTIONS } from '../domain/dispatchWorkflow.js';
import { laboratoryUnitsForOrder } from './laboratoryService.js';

const definitions=Object.freeze({
  rfq:Object.freeze({
    start_rep_review:{from:['assigned_to_rep'],to:'under_rep_review',permission:'mark_rfq_under_review',label:'Start Review'},
    mark_quoted:{from:['under_rep_review'],to:'quoted',permission:'mark_rfq_quoted',label:'Mark as Quoted'},
    acknowledge_quotation:{from:['quoted'],to:'awaiting_customer_acceptance',permission:'acknowledge_quotation',label:'I received the quotation'},
    accept_order:{from:['awaiting_customer_acceptance'],to:'converted_to_order',permission:'accept_customer_order',label:'Accept Order'},
    cancel_rfq:{from:['submitted','assigned_to_rep','under_rep_review','quoted','awaiting_customer_acceptance'],to:'cancelled',permission:'cancel_rfq',label:'Cancel RFQ'},
    expire_rfq:{from:['submitted','assigned_to_rep','under_rep_review','quoted','awaiting_customer_acceptance'],to:'expired',permission:'expire_rfq',label:'Expire RFQ'},
  }),
  order:Object.freeze({
    start_planning:{from:['awaiting_planning'],to:'planning_in_progress',permission:'add_planning_information',label:'Start Planning'},
    complete_planning:{from:['planning_in_progress'],to:'planned',permission:'add_planning_information',label:'Save Planning Details'},
    submit_to_expediting:{from:['planned'],to:'submitted_to_expediting',permission:'submit_to_expediting',label:'Submit to Expediting'},
    start_expediting:{from:['submitted_to_expediting','expediting_in_progress'],to:'expediting_in_progress',permission:'update_order_progress',label:'Confirm Received from Planning'},
    add_expediting_update:{from:['expediting_in_progress'],to:'expediting_in_progress',permission:'update_order_progress',label:'Add Progress Update'},
    place_on_hold:{from:['planning_in_progress','submitted_to_expediting','expediting_in_progress','awaiting_qa','qa_in_progress','awaiting_dispatch'],to:'on_hold',permission:'manage_order_hold',label:'Place on Hold'},
    resume_order:{from:['on_hold'],to:'__resume__',permission:'manage_order_hold',label:'Resume Order'},
    complete_expediting:{from:['expediting_in_progress'],to:'awaiting_qa',permission:'update_order_progress',label:'QC — Send to Quality Control'},
    start_qa:{from:['awaiting_qa'],to:'qa_in_progress',permission:'inspect_order',label:'Start Quality Inspection'},
    start_qa_reinspection:{from:['qa_reinspection_required'],to:'qa_in_progress',permission:'inspect_order',label:'Start Reinspection'},
    pass_qa:{from:['qa_in_progress'],to:'qa_passed',permission:'release_qa_order',label:'Pass Quality Inspection'},
    fail_qa:{from:['qa_in_progress'],to:'qa_failed',permission:'record_qa_failure',label:'Record Quality Problem'},
    start_qa_rework:{from:['qa_failed'],to:'returned_to_expediting',permission:'manage_qa_rework',label:'Start Corrective Work'},
    resubmit_to_qa:{from:['returned_to_expediting'],to:'qa_reinspection_required',permission:'manage_qa_rework',label:'Resubmit to QA'},
    release_qa_order:{from:['qa_passed'],to:'__after_qc__',permission:'release_qa_order',label:'Release QC'},
    receive_lab_order:{from:['awaiting_lab'],to:'lab_received',permission:'update_lab_work',label:'Confirm Units Received in Laboratory'},
    release_from_lab:{from:['lab_received','calibration_completed','awaiting_lab_release'],to:'awaiting_lab_receipt_dispatch',permission:'manage_certificates',label:'Send Certified Units to Dispatch'},
    confirm_dispatch_receipt:{from:['awaiting_dispatch'],to:'__same__',permission:'view_dispatch_queue',label:'Confirm Received in Dispatch'},
    confirm_lab_receipt_dispatch:{from:['awaiting_lab_receipt_dispatch'],to:'awaiting_dispatch',permission:'view_dispatch_queue',label:'Confirm receipt from laboratory'},
    report_delivery_problem:{from:['out_for_delivery'],to:'__same__',permission:'confirm_delivery',label:'Report Delivery Problem'},
    mark_ready_for_collection:{from:['awaiting_dispatch'],to:'ready_for_collection',permission:'confirm_collection',label:'Mark Ready for Collection'},
    start_delivery:{from:['awaiting_dispatch'],to:'out_for_delivery',permission:'confirm_delivery',label:'Mark Out for Delivery'},
    confirm_collection:{from:['ready_for_collection'],to:'collected',permission:'confirm_collection',label:'Confirm Collected'},
    confirm_delivery:{from:['out_for_delivery'],to:'delivered',permission:'confirm_delivery',label:'Confirm Delivered'},
    complete_collection:{from:['collected'],to:'completed',permission:'confirm_collection',label:'Mark Completed'},
    complete_delivery:{from:['delivered'],to:'completed',permission:'confirm_delivery',label:'Mark Completed'},
    cancel_order:{from:['awaiting_planning','planning_in_progress','planned','submitted_to_expediting','expediting_in_progress','awaiting_qa','qa_in_progress','awaiting_dispatch','on_hold'],to:'cancelled',permission:'cancel_order',label:'Cancel Order'},
  }),
});

const has=(actor,permission)=>actor.permissions.includes(permission) || actor.permissions.includes('override_workflow') || actor.permissions.includes('administer_users');
const requiredText=(value,field,label,errors)=>{ if (String(value || '').trim().length<2) errors[field]=`Enter ${label}.`; };

function validate(action,input) {
  const data=input?.data || {}; const errors={};
  if (action === 'complete_expediting' && data.completionCheckConfirmed !== true && data.expeditingHandoff?.completionCheckConfirmed !== true) errors.completionCheckConfirmed = 'Confirm the production checks before sending to QC.';
  if (action === 'pass_qa') {
    if (data.qaPass?.checklistConfirmed !== true) errors.checklistConfirmed = 'Confirm the inspection checklist.';
    if (data.qaPass?.meetsRequirements !== true) errors.meetsRequirements = 'Confirm that the units meet requirements.';
  }
  if (action==='mark_quoted') { const quotation=data.quotation || {}; requiredText(quotation.number,'quotationNumber','the quotation number',errors); requiredText(quotation.date,'quotationDate','the quotation date',errors); }
  if (action==='accept_order') { const acceptance=data.acceptance || {}; requiredText(acceptance.type,'acceptanceType','the acceptance type',errors); requiredText(acceptance.date,'acceptanceDate','the acceptance date',errors); if (acceptance.verified!==true) errors.acceptanceVerified='Confirm that the acceptance evidence was checked.'; }
  if (action==='complete_planning') { const planning=data.planning || data; requiredText(planning.internalJobNumber,'internalJobNumber','the internal job number',errors); requiredText(planning.salesOrderNumber,'salesOrderNumber','the Sales Order Number',errors); requiredText(planning.assignedPlanningUserId,'assignedPlanningUserId','the assigned Planning user',errors); }
  if (['add_expediting_update','start_expediting'].includes(action)) {
    const update=data.expeditingUpdate || data;
    requiredText(update.progressStep,'progressStep','the progress step',errors);
    requiredText(update.customerMessage,'customerMessage','the customer-facing update',errors);
    const step = EXPEDITOR_PROGRESS_STEPS.find(item => item.id === update.progressStep);
    if (!step || (action === 'add_expediting_update' && !step.selectableForUpdate) || (action === 'start_expediting' && step.id !== 'planning_received')) errors.progressStep='Choose a valid progress step for this workflow action.';
  }
  if (['place_on_hold','cancel_order','cancel_rfq','expire_rfq'].includes(action)) requiredText(data.comment || data.reason || input.comment,'comment','a reason',errors);
  if (action === 'fail_qa') {
    const failure = data.qaFailure || {};
    for (const [key, choices] of [['category', QA_PROBLEM_CATEGORIES], ['severity', QA_SEVERITIES], ['reworkDestination', QA_REWORK_DESTINATIONS]]) {
      if (!choices.some(choice => choice.id === failure[key])) errors[key] = 'Select an approved QA option.';
    }
    for (const key of ['problemDescription', 'customerMessage']) if (typeof failure[key] !== 'string' || failure[key].trim().length < 5 || failure[key].length > 2000) errors[key] = 'Enter a clear description (5–2,000 characters).';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(failure.affectedItemId || '')) errors.affectedItemId = 'Select the affected order item.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(failure.dateFound || '') || !Number.isFinite(Date.parse(failure.dateFound))) errors.dateFound = 'Enter a valid inspection date.';
    if ([failure.category, failure.reworkDestination].includes('other') && String(failure.otherExplanation || '').trim().length < 5) errors.otherExplanation = 'Explain the selected Other option.';
  }
  if (Object.keys(errors).length) throw validationError(errors,'Complete the required workflow information.');
  return data;
}

export function createWorkflowService({ repository, storage }) {
  const actionsForRecord = (actor, entityType, record) => Object.entries(definitions[entityType])
    .filter(([action, definition]) => definition.from.includes(record.trackingStatus) && has(actor, definition.permission)
      && (!DISPATCH_ACTIONS.includes(action) || actor.permissions.includes('view_dispatch_queue'))
      && (!['receive_lab_order','release_from_lab'].includes(action) || actor.permissions.includes('view_lab_queue'))
      && (action !== 'start_expediting' || !(record.expediting?.updates || []).some(update => update.progressStep === 'planning_received'))
      && (action !== 'confirm_dispatch_receipt' || !record.dispatch?.receivedAt)
      && (!['mark_ready_for_collection','start_delivery'].includes(action) || Boolean(record.dispatch?.receivedAt))
      && (!['mark_ready_for_collection','confirm_collection','complete_collection'].includes(action) || record.fulfilment === 'collect')
      && (!['start_delivery','confirm_delivery','complete_delivery','report_delivery_problem'].includes(action) || record.fulfilment === 'delivery'))
    .map(([action, definition]) => {
      const needsLab = action === 'release_qa_order' && laboratoryUnitsForOrder(record).length > 0;
      return { action, label: action === 'release_qa_order' ? (needsLab ? 'Send to Laboratory' : 'Send to Dispatch') : definition.label,
        toStatus: action === 'release_qa_order' ? (needsLab ? 'awaiting_lab' : 'awaiting_dispatch') : definition.to, permission: definition.permission };
    });

  const enrich = (actor, entityType, record) => ({
    ...record,
    allowedWorkflowActions: actionsForRecord(actor, entityType, record),
  });

  return Object.freeze({
    enrich,
    async allowed(actor,entityType,id) {
      const record=entityType==='rfq' ? await repository.getEnquiry(actor,id) : await repository.getOrder(actor,id);
      return actionsForRecord(actor, entityType, record);
    },
    async perform(actor,entityType,id,input,correlationId,attachment = null) {
      const definition=definitions[entityType]?.[String(input?.action || '')];
      if (!definition || !has(actor,definition.permission)) { const error=new Error('You are not authorised to perform this workflow action.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      if (DISPATCH_ACTIONS.includes(input.action) && !actor.permissions.includes('view_dispatch_queue')) { const error=new Error('Dispatch access is required.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      if (['receive_lab_order','release_from_lab'].includes(input.action) && !actor.permissions.includes('view_lab_queue')) { const error=new Error('Laboratory access is required.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      const data = validate(input.action,input);
      if (input.action === 'mark_quoted') data.quotation = validateQuotation(data.quotation);
      const acceptsDocument = entityType === 'rfq' ? ['mark_quoted','accept_order'].includes(input.action) : DISPATCH_ACTIONS.includes(input.action) && !input.action.includes('receipt');
      if (attachment && !acceptsDocument) throw validationError({ document: 'This action does not accept a document.' });
      if (attachment && entityType === 'order') {
        if (!data.dispatchUpdate?.proofOfDelivery) throw validationError({ dispatchProofType: 'Select the type of Dispatch proof being uploaded.' });
        data.dispatchUpdate.proofOfDelivery.reference ||= attachment.originalName;
      }
      let document; let result;
      try {
        document = attachment ? await storage.put(attachment) : null;
        result = await repository.performWorkflowAction(actor,{entityType,id,action:input.action,definition,data,document,comment:String(input.comment || input.data?.comment || input.data?.reason || '').trim(),correlationId});
      } catch (error) {
        if (document) await storage.remove(document.storageKey).catch(() => undefined);
        throw error;
      }
      return {
        ...result,
        ...(result.enquiry ? { enquiry: enrich(actor, 'rfq', result.enquiry) } : {}),
        ...(result.order ? { order: enrich(actor, 'order', result.order) } : {}),
      };
    },
  });
}
