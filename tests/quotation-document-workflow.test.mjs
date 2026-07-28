import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  acceptQuotation,
  canDownloadDocument,
  closeRejectedRfq,
  DOCUMENT_CATEGORIES,
  QUOTATION_STATUSES,
  rejectQuotation,
  REJECTION_CATEGORIES,
  RFQ_QUOTATION_STATUSES,
  sendQuotation,
  validateWorkflowDocument,
  verifyAndCreateOrder,
} from '../src/domain/quotationWorkflow.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';

const at = value => new Date(value);
const quotationFile = (name = 'Q-DEMO-001.pdf') => ({ name, type: 'application/pdf', size: 4096 });
const poFile = (name = 'PO-DEMO-001.pdf') => ({ name, type: 'application/pdf', size: 3072 });
const customer = { id: 'customer-1', role: USER_ROLES.CUSTOMER, companyId: 'company-a', displayName: 'Demo Customer' };
const otherCustomer = { ...customer, id: 'customer-2', companyId: 'company-b' };
const rep = { id: 'rep-account', role: USER_ROLES.SALES_REPRESENTATIVE, companyId: 'company-rhomberg', representativeId: 'rep-1', displayName: 'Demo Rep' };
const planning = { id: 'planning-1', role: USER_ROLES.PLANNING, companyId: 'company-rhomberg', displayName: 'Demo Planning' };
const expeditor = { id: 'expeditor-1', role: USER_ROLES.EXPEDITOR, companyId: 'company-rhomberg', displayName: 'Demo Expeditor' };
const rfq = {
  id: 'rfq-1', reference: 'RQ-DEMO-001', version: 2, workflowType: 'rfq', trackingStatus: 'under_rep_review',
  companyId: 'company-a', company: 'Fabricated Process Demo', accountId: customer.id,
  contact: 'Demo Customer', email: 'demo@example.invalid', selectedRep: { id: 'rep-1', name: 'Demo Rep' },
  representativeId: 'rep-1', items: [{ lineId: 'line-1', productId: 'pbb', quantity: 2 }],
  documents: [], quotationVersions: [], purchaseOrders: [], quotationRejections: [],
};

const enquirySource = readFileSync(new URL('../src/components/Enquiry.jsx', import.meta.url), 'utf8');
assert.equal(/poMode|poNumber|poFile|Purchase Order method|Upload PO/.test(enquirySource), false, 'the RFQ form must not contain PO inputs');

assert.throws(
  () => sendQuotation({ rfq, actor: rep, input: { quotationNumber: 'Q-1', quotationDate: '2026-07-28', quotationExpiryDate: '2026-08-28', customerMessage: 'Review this quotation.' }, now: at('2026-07-28T09:00:00Z') }),
  error => error instanceof ServiceError && error.code === 'INVALID_DOCUMENT',
  'sending without an attachment must be blocked',
);
for (const invalid of [
  { name: 'quote.exe', type: 'application/octet-stream', size: 20 },
  { name: 'quote.pdf.exe', type: 'application/pdf', size: 20 },
  { name: 'quote.pdf', type: 'application/pdf', size: 0 },
  { name: 'quote.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 },
]) assert.throws(() => validateWorkflowDocument(invalid, 'representative_quotation'), ServiceError);

let state = sendQuotation({
  rfq, actor: rep, now: at('2026-07-28T09:00:00Z'),
  input: { quotationNumber: 'Q-DEMO-001', quotationDate: '2026-07-28', quotationExpiryDate: '2026-08-28', customerMessage: 'Please review Version 1.', internalNote: 'Rep-only margin note.', documentFile: quotationFile() },
});
assert.equal(state.quotationVersions.length, 1);
assert.equal(state.quotationVersions[0].versionNumber, 1);
assert.equal(state.quotationVersions[0].isCurrent, true);
assert.equal(state.documents[0].category, 'representative_quotation');
assert.equal(canDownloadDocument({ actor: customer, record: state, document: state.documents[0] }), true);
assert.equal(canDownloadDocument({ actor: otherCustomer, record: state, document: state.documents[0] }), false, 'company isolation must apply to direct downloads');
assert.equal(canDownloadDocument({ actor: expeditor, record: state, document: state.documents[0] }), false, 'Expediting must not receive quotation pricing documents by default');

assert.throws(() => rejectQuotation({ rfq: state, actor: customer, input: { category: '', explanation: '' } }), ServiceError);
state = rejectQuotation({
  rfq: state, actor: customer, now: at('2026-07-28T10:00:00Z'),
  input: { category: 'incorrect_configuration', explanation: 'The required process connection should be one-half inch BSP.' },
});
assert.equal(state.trackingStatus, 'quotation_rejected');
assert.equal(state.quotationRejections[0].explanation.includes('BSP'), true);

state = sendQuotation({
  rfq: state, actor: rep, now: at('2026-07-28T11:00:00Z'),
  input: { quotationNumber: 'Q-DEMO-001-R1', quotationDate: '2026-07-28', quotationExpiryDate: '2026-08-28', customerMessage: 'The amended quotation is available.', documentFile: quotationFile('Q-DEMO-001-R1.pdf') },
});
assert.equal(state.quotationVersions.length, 2);
assert.equal(state.quotationVersions[0].status, 'superseded');
assert.equal(state.quotationVersions[0].isCurrent, false);
assert.equal(state.quotationVersions[1].versionNumber, 2);
assert.equal(state.quotationVersions[1].isCurrent, true);
assert.equal(state.quotationRejections.length, 1, 'amendment must preserve the previous rejection');
assert.equal(state.documents.length, 2, 'the previous quotation document must be preserved');

assert.throws(() => acceptQuotation({ rfq: state, actor: customer, input: { purchaseOrderNumber: 'PO-1', confirmed: true } }), ServiceError, 'PO attachment is mandatory');
state = acceptQuotation({
  rfq: state, actor: customer, now: at('2026-07-28T12:00:00Z'),
  input: { purchaseOrderNumber: 'PO-DEMO-001', documentFile: poFile(), confirmed: true, customerMessage: 'Please proceed.' },
});
assert.equal(state.trackingStatus, 'customer_accepted_pending_rep_verification');
assert.equal(state.acceptedQuotationVersionId, state.quotationVersions[1].id);
assert.equal(state.purchaseOrders.length, 1);
assert.throws(() => acceptQuotation({ rfq: state, actor: customer, input: { purchaseOrderNumber: 'PO-DUP', documentFile: poFile('PO-DUP.pdf'), confirmed: true } }), ServiceError);
assert.equal(canDownloadDocument({ actor: planning, record: state, document: state.purchaseOrders[0].document }), true);
assert.equal(canDownloadDocument({ actor: customer, record: state, document: state.purchaseOrders[0].document }), true);

assert.throws(() => verifyAndCreateOrder({ rfq: state, actor: rep, input: {}, orderId: 'order-1', orderReference: 'OR-1' }), ServiceError);
const conversion = verifyAndCreateOrder({
  rfq: state, actor: rep, input: { verified: true }, now: at('2026-07-28T13:00:00Z'),
  orderId: 'order-1', orderReference: 'OR-DEMO-001',
});
assert.equal(conversion.rfq.trackingStatus, 'converted_to_order');
assert.equal(conversion.order.trackingStatus, 'awaiting_planning');
assert.equal(conversion.order.acceptedQuotationVersionId, state.quotationVersions[1].id);
assert.equal(conversion.order.customerPoNumber, 'PO-DEMO-001');
const replay = verifyAndCreateOrder({ rfq: conversion.rfq, actor: rep, input: { verified: true }, orderId: 'order-2', orderReference: 'OR-DEMO-002' });
assert.equal(replay.idempotent, true);
assert.equal(replay.order, null, 'idempotent replay must not create a second order');

let rejected = sendQuotation({ rfq, actor: rep, input: { quotationNumber: 'Q-CLOSE', quotationDate: '2026-07-28', quotationExpiryDate: '2026-08-28', customerMessage: 'Review quotation for closure test.', documentFile: quotationFile('Q-CLOSE.pdf') } });
rejected = rejectQuotation({ rfq: rejected, actor: customer, input: { category: 'customer_no_longer_requires_item', explanation: 'The fabricated project has been cancelled.' } });
assert.throws(() => closeRejectedRfq({ rfq: rejected, actor: rep, input: { closureReason: '', confirmed: true } }), ServiceError);
rejected = closeRejectedRfq({ rfq: rejected, actor: rep, input: { closureReason: 'Customer cancelled the fabricated project.', confirmed: true } });
assert.equal(rejected.trackingStatus, 'closed_rejected');
assert.equal(rejected.quotationVersions[0].status, 'rejection_acknowledged');

assert.ok(RFQ_QUOTATION_STATUSES.includes('po_correction_required'));
assert.ok(QUOTATION_STATUSES.includes('converted_to_order'));
assert.equal(DOCUMENT_CATEGORIES.length, 12);
assert.equal(REJECTION_CATEGORIES.length, 10);

console.log('Quotation, PO, rejection, versioning and document-access workflow tests passed.');
