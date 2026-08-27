import { validationError } from '../errors.js';

export const DISPATCH_METHODS = Object.freeze([
  { id: 'collection', label: 'Customer collection', fulfilment: 'collect' },
  { id: 'company_delivery', label: 'Rhomberg company delivery', fulfilment: 'delivery' },
  { id: 'courier', label: 'Courier', fulfilment: 'delivery' },
  { id: 'third_party_delivery', label: 'Third-party delivery', fulfilment: 'delivery' },
]);
export const DISPATCH_PROOF_TYPES = Object.freeze([
  { id: 'signed_delivery_note', label: 'Signed delivery note' },
  { id: 'collection_confirmation', label: 'Collection confirmation' },
  { id: 'courier_confirmation', label: 'Courier confirmation' },
  { id: 'photograph', label: 'Photograph reference' },
  { id: 'other', label: 'Other controlled proof' },
]);
export const DISPATCH_ACTIONS = Object.freeze([
  'confirm_dispatch_receipt', 'confirm_lab_receipt_dispatch', 'mark_ready_for_collection',
  'start_delivery', 'confirm_collection', 'confirm_delivery', 'complete_collection',
  'complete_delivery', 'report_delivery_problem',
]);
const text = value => typeof value === 'string' ? value.trim() : '';
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const fail = message => { const error = new Error(message); error.statusCode = 409; error.code = 'INVALID_WORKFLOW_TRANSITION'; throw error; };

// Called under the order row lock. Request fields cannot supply persisted receipt state.
export function applyDispatchAction(record, action, data, actor, now) {
  const existing = record.details?.dispatch || {};
  const errors = {};
  const checkText = (value, key, min, max) => {
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) errors[key] = 'Enter a valid value (' + min + '–' + max + ' characters).';
    return text(value);
  };
  if (['confirm_dispatch_receipt', 'confirm_lab_receipt_dispatch'].includes(action)) {
    if (existing.receivedAt) fail('Receipt has already been confirmed. Refresh the order.');
    const input = data.dispatchReceipt || {};
    const fromLab = action === 'confirm_lab_receipt_dispatch';
    const sourceDepartment = fromLab ? 'laboratory' : input.sourceDepartment;
    if (!['laboratory','quality_assurance','expediting','planning','authorised_exception'].includes(sourceDepartment)) errors.dispatchReceiptSourceDepartment = 'Select a recognised source department.';
    const numberOfPackages = Number(input.numberOfPackages ?? (fromLab ? 1 : 0));
    if (!Number.isInteger(numberOfPackages) || numberOfPackages < 1 || numberOfPackages > 999) errors.dispatchReceiptNumberOfPackages = 'Enter 1–999 packages.';
    const customerMessage = checkText(input.customerMessage || (fromLab ? 'Your calibrated order has been received by Dispatch.' : ''), 'dispatchReceiptCustomerMessage', 5, 1000);
    const internalNote = checkText(input.internalNote || '', 'dispatchReceiptInternalNote', 0, 2000);
    const exceptionReason = checkText(input.exceptionReason || '', 'dispatchReceiptExceptionReason', sourceDepartment === 'authorised_exception' ? 10 : 0, 1000);
    if (sourceDepartment === 'authorised_exception' && !actor.permissions.some(p => ['override_workflow','administer_users'].includes(p))) errors.dispatchReceiptExceptionReason = 'An authorised manager must record a receipt exception.';
    if (Object.keys(errors).length) throw validationError(errors);
    const receipt = { sourceDepartment, numberOfPackages, customerMessage, internalNote, exceptionReason, receivedAt: now, receivedBy: actor.id };
    return { ...existing, ...receipt, receipts: [...(existing.receipts || []), receipt], lastUpdatedAt: now };
  }
  if (!existing.receivedAt) fail('Confirm receipt in Dispatch before releasing this order.');
  const input = data.dispatchUpdate || {};
  const details = {};
  for (const key of ['method','readyDate','collectionDate','deliveryDate','courierOrDriver','trackingReference','deliveryNoteNumber','recipientName']) details[key] = text(input[key]) || existing[key] || '';
  const method = DISPATCH_METHODS.find(item => item.id === details.method);
  if (!method || method.fulfilment !== record.fulfilment) errors.dispatchMethod = 'Choose the dispatch method matching this order’s delivery/collection preference.';
  if (['mark_ready_for_collection','confirm_collection','complete_collection'].includes(action) && record.fulfilment !== 'collect') errors.dispatchMethod = 'This action requires a collection order.';
  if (['start_delivery','confirm_delivery','complete_delivery','report_delivery_problem'].includes(action) && record.fulfilment !== 'delivery') errors.dispatchMethod = 'This action requires a delivery order.';
  details.numberOfPackages = Number(input.numberOfPackages || existing.numberOfPackages);
  if (!Number.isInteger(details.numberOfPackages) || details.numberOfPackages < 1 || details.numberOfPackages > 999) errors.dispatchNumberOfPackages = 'Enter 1–999 packages.';
  for (const key of ['readyDate','collectionDate','deliveryDate']) {
    if (details[key] && !date(details[key])) errors[key] = 'Enter a valid calendar date.';
  }
  if (!date(details.readyDate)) errors.dispatchReadyDate = 'Enter the ready date.';
  const handoverDate = action === 'confirm_collection' ? 'collectionDate' : action === 'confirm_delivery' ? 'deliveryDate' : null;
  if (handoverDate && !date(details[handoverDate])) errors[handoverDate] = 'Enter the confirmed handover date.';
  for (const key of ['collectionDate','deliveryDate']) if (details[key] && details[key] < details.readyDate) errors[key] = 'Handover cannot precede the ready date.';
  for (const key of ['courierOrDriver','trackingReference','deliveryNoteNumber','recipientName']) if (details[key].length > 160) errors[key] = 'Use at most 160 characters.';
  if (['start_delivery','confirm_delivery'].includes(action) && details.courierOrDriver.length < 2) errors.dispatchCourierOrDriver = 'Enter the courier or driver.';
  if (handoverDate && details.recipientName.length < 2) errors.dispatchRecipientName = 'Enter the collector or recipient.';
  details.customerMessage = checkText(input.customerMessage, 'dispatchCustomerMessage', 5, 1000);
  details.internalNotes = checkText(input.internalNotes || '', 'dispatchInternalNotes', 0, 2000);
  details.problemReason = checkText(input.problemReason || '', 'dispatchProblemReason', action === 'report_delivery_problem' ? 5 : 0, 1000);
  if (input.proofOfDelivery) {
    const proof = input.proofOfDelivery;
    if (!DISPATCH_PROOF_TYPES.some(item => item.id === proof.type)) errors.dispatchProofType = 'Choose an approved proof type.';
    const reference = checkText(proof.reference || proof.fileName || '', 'dispatchProofReference', 1, 240);
    // No client-supplied storage keys, document IDs or customer visibility.
    details.proofOfDelivery = { type: proof.type, reference };
  }
  if (Object.keys(errors).length) throw validationError(errors);
  const update = { ...details, action, createdAt: now, updatedBy: { id: actor.id } };
  return { ...existing, ...details, updates: [...(existing.updates || []), update], currentProblemReason: action === 'report_delivery_problem' ? details.problemReason : '', lastUpdatedAt: now };
}

export function dispatchProjection(details, actor) {
  const dispatch = details?.dispatch;
  if (!dispatch) return {};
  if (actor?.role !== 'customer') return { dispatch };
  const safe = value => Object.fromEntries(['method','readyDate','collectionDate','deliveryDate','numberOfPackages','trackingReference','customerMessage','action','createdAt','receivedAt','lastUpdatedAt'].filter(key => value[key] !== undefined).map(key => [key,value[key]]));
  return { dispatch: { ...safe(dispatch), updates: (dispatch.updates || []).map(safe) } };
}
