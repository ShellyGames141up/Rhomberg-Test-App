import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createApiServices } from '../src/services/api/createApiServices.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { LEGACY_STORE_KEYS, STORE_KEYS } from '../src/services/mock/seedData.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';
import { optionsForField, shouldShowField } from '../src/domain/productConfiguration.js';
import { representativesByBranch } from '../src/data/representatives.js';

class TestStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const storage = new TestStorage();
let emailCalls = 0;
let lastEmailFile = null;
const emailSender = async (enquiry, poFile) => {
  emailCalls += 1;
  lastEmailFile = poFile;
  return { ok: true, recipient: 'test-routing@example.invalid', deliveryMode: 'test', pricedPdfAttached: false, enquiryId: enquiry.id };
};

const services = createMockServices({ storage, emailSender, now: () => new Date('2026-07-22T12:00:00.000Z') });
await services.initialize();

assert.deepEqual(Object.values(USER_ROLES), ['customer', 'sales_representative', 'planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator']);
assert.deepEqual(
  new Set((await services.auth.getDemoLogins()).map(login => login.id)),
  new Set(['customer', 'cape_customer', 'sales_representative', 'planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator']),
  'mock mode must provide fabricated logins for every active role and the prepared Buyer role',
);

const uiFiles = [
  path.resolve('src/App.jsx'),
  ...readdirSync(path.resolve('src/components'), { recursive: true })
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.resolve('src/components', file)),
];
for (const file of uiFiles) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.includes('localStorage'), false, `${path.basename(file)} must not access browser storage directly`);
  assert.equal(source.includes('lib/storage'), false, `${path.basename(file)} must not import the removed legacy storage module`);
  assert.equal(source.includes('/data/'), false, `${path.basename(file)} must receive persisted catalogue/account data through services rather than importing data modules`);
  assert.equal(source.includes('updateStatus('), false, `${path.basename(file)} must not use a raw status-changing API`);
}

const catalogue = await services.products.getCatalogue();
assert.ok(catalogue.categories.length >= 8, 'catalogue categories should load through the product service');
assert.ok(catalogue.products.length > 50, 'catalogue products should load through the product service');
assert.deepEqual(
  Object.fromEntries(Object.entries(representativesByBranch).map(([branch, reps]) => [branch, reps.map(rep => rep.name)])),
  {
    'cape-town': ['Alphonso Majiet', 'Andrew Japhtha', 'Quintin van Wyk', 'Arthur Daniels', 'Ericu Vercuiel'],
    durban: [],
    johannesburg: ['Danny', 'Siya', 'Reneil'],
    'port-elizabeth': ['Carmen Bellew'],
  },
  'only the approved branch representatives should be available',
);
assert.ok(catalogue.products.every(product => product.configurations.every(field => !field.options?.includes('No logo'))), 'logo removal must not be offered');

const customer = await services.auth.signIn({ email: 'demo@client.co.za', password: 'Demo123!' });
assert.equal(customer.role, 'customer');
assert.equal('password' in customer, false, 'passwords must not enter React-facing account state');

const customerEnquiries = await services.enquiries.list();
assert.ok(customerEnquiries.every(enquiry => enquiry.companyId === customer.companyId), 'customer list must be limited to the authorised company');
assert.ok(customerEnquiries.every(enquiry => enquiry.workflowType === 'rfq'), 'the RFQ service must not return order records');
assert.ok(customerEnquiries.every(enquiry => enquiry.trackingHistory.every(event => event.customerVisible !== false)), 'customer history must exclude internal-only events');
const customerOrders = await services.orders.list();
assert.ok(customerOrders.length >= 1, 'the customer should receive its demo orders from the separate order service');
assert.ok(customerOrders.every(order => order.companyId === customer.companyId && order.workflowType === 'order'), 'customer orders must be isolated to the authorised company');

await assert.rejects(
  () => services.enquiries.getById('enquiry-demo-cape-001'),
  error => error instanceof ServiceError && error.status === 404,
  'a customer must not retrieve another company RFQ by ID',
);
await assert.rejects(
  () => services.orders.getById('enquiry-demo-kzn-001'),
  error => error instanceof ServiceError && error.status === 404,
  'a customer must not retrieve another company order by ID',
);

const pbb = catalogue.products.find(product => product.id === 'pbb');
const completeConfiguration = {};
for (let pass = 0; pass < 3; pass += 1) {
  for (const field of pbb.configurations) {
    if (!field.required || !shouldShowField(field, completeConfiguration) || completeConfiguration[field.key] !== undefined) continue;
    const allowed = optionsForField(field, completeConfiguration);
    completeConfiguration[field.key] = allowed.length ? allowed[0] : 'Demo configuration requirement';
  }
}

const draftLine = {
  lineId: 'test-line-1',
  productId: 'pbb',
  code: 'PBB',
  name: 'Stainless steel process gauge',
  quantity: 2,
  configuration: completeConfiguration,
};
await services.enquiries.saveDraft([draftLine]);

const reopenedServices = createMockServices({ storage, emailSender, now: () => new Date('2026-07-22T12:00:00.000Z') });
await reopenedServices.initialize();
assert.equal((await reopenedServices.auth.getSession()).id, customer.id, 'session should survive a service reinitialisation');
assert.deepEqual(await reopenedServices.enquiries.getDraft(), [draftLine], 'draft should survive a browser-style reopen');

await assert.rejects(
  () => reopenedServices.enquiries.submit({ application: '', fulfilment: '' }, [draftLine]),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.application),
  'service boundary must reject an invalid RFQ',
);

const testPoFile = { name: 'demo-purchase-order.pdf', type: 'application/pdf', size: 2048 };
const submissionDetails = {
  application: 'Test pressure monitoring application',
  medium: 'Water',
  area: 'Western Cape',
  selectedRep: { id: 'C-27', code: 'spoofed', name: 'Spoofed client value', branchId: 'wrong-branch', branchName: 'Wrong branch' },
  emergency: 'no',
  fulfilment: 'collect',
  deliveryAddress: '',
  collectionBranch: 'Cape Town test branch',
  notes: 'Customer test note saved with the RFQ.',
  poMode: 'upload',
  poNumber: '',
  poFileName: testPoFile.name,
  poFile: testPoFile,
};

await assert.rejects(
  () => reopenedServices.enquiries.submit({
    ...submissionDetails,
    selectedRep: { id: 'J-21', name: 'Representative outside the selected area' },
  }, [draftLine]),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.selectedRep),
  'the service must reject a representative outside the approved directory for the selected area',
);

const submission = await reopenedServices.enquiries.submit(submissionDetails, [draftLine]);

assert.match(submission.enquiry.reference, /^RQ-PREVIEW-/);
assert.equal(submission.enquiry.companyId, customer.companyId);
assert.equal(submission.enquiry.trackingStatus, 'submitted', 'internal assignment should remain hidden in the customer projection');
assert.equal(submission.enquiry.submittedAt, '2026-07-22T12:00:00.000Z');
assert.equal(submission.enquiry.selectedRep.id, 'C-27');
assert.equal(submission.enquiry.selectedRep.name, 'Ericu Vercuiel', 'the service must replace client-supplied representative text with the approved directory record');
assert.equal(submission.enquiry.selectedRep.branchName, 'Cape Town');
assert.deepEqual(submission.enquiry.companySnapshot, {
  id: customer.companyId,
  name: customer.company,
  area: customer.area,
  industry: customer.industry,
});
assert.equal(submission.enquiry.submittingCustomer.id, customer.id);
assert.equal(submission.enquiry.customerNotes, submissionDetails.notes);
assert.deepEqual(submission.enquiry.items, [draftLine]);
assert.equal(submission.enquiry.documents.length, 1);
assert.deepEqual(
  {
    documentType: submission.enquiry.documents[0].documentType,
    fileName: submission.enquiry.documents[0].fileName,
    mimeType: submission.enquiry.documents[0].mimeType,
    sizeBytes: submission.enquiry.documents[0].sizeBytes,
    storageStatus: submission.enquiry.documents[0].storageStatus,
  },
  {
    documentType: 'purchase_order',
    fileName: testPoFile.name,
    mimeType: testPoFile.type,
    sizeBytes: testPoFile.size,
    storageStatus: 'metadata_only',
  },
);
assert.equal('poFile' in submission.enquiry, false, 'raw uploaded file objects must not be stored in the browser mock');
assert.equal(submission.enquiry.trackingHistory[0].action, 'submit_rfq', 'the first RFQ history entry must record customer submission');
assert.equal(submission.delivery.ok, true);
assert.equal(emailCalls, 1, 'mock RFQ submission should use the injected delivery service once');
assert.equal(lastEmailFile, testPoFile, 'the existing delivery adapter must receive the PO file without persisting its contents');
assert.deepEqual(await reopenedServices.enquiries.getDraft(), [], 'successful submission should clear the draft');
await assert.rejects(
  () => reopenedServices.enquiries.listRepresentativeInbox(),
  error => error instanceof ServiceError && error.status === 403,
  'customer accounts must not access a representative inbox',
);
await assert.rejects(
  () => reopenedServices.workflow.performAction(submission.enquiry.id, {
    entityType: 'rfq',
    action: 'start_rep_review',
    comment: '',
    data: {},
    expectedVersion: submission.enquiry.version,
  }),
  error => error instanceof ServiceError && error.status === 403,
  'customers must not perform an internal representative action',
);

const submissionAudit = JSON.parse(storage.getItem(STORE_KEYS.audit)).filter(event => event.entityId === submission.enquiry.id);
assert.equal(submissionAudit[0].action, 'workflow.submit_rfq', 'customer submission must be the first append-only audit entry');
assert.equal(submissionAudit[1].action, 'workflow.assign_representative');
const submissionNotifications = JSON.parse(storage.getItem(STORE_KEYS.notifications)).filter(notification => notification.entityId === submission.enquiry.id);
assert.equal(submissionNotifications.length, 1, 'RFQ submission must create one representative assignment notification');
assert.equal(submissionNotifications[0].status, 'assigned_to_rep');
assert.deepEqual(submissionNotifications[0].recipients, ['assigned_representative']);

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const assignedRfqs = await reopenedServices.enquiries.listRepresentativeInbox();
assert.ok(assignedRfqs.every(enquiry => enquiry.selectedRep?.id === 'C-27'), 'sales representatives must receive only their assigned RFQs');
let newlyAssignedRfq = assignedRfqs.find(enquiry => enquiry.id === submission.enquiry.id);
assert.equal(newlyAssignedRfq.trackingStatus, 'assigned_to_rep', 'a submitted RFQ must enter the assigned representative inbox');
assert.ok(newlyAssignedRfq.allowedWorkflowActions.some(action => action.action === 'start_rep_review' && action.label === 'Start Review'));
const assignmentNotification = (await reopenedServices.notifications.list()).find(notification => notification.entityId === newlyAssignedRfq.id);
assert.ok(assignmentNotification, 'the assigned representative must receive an in-app RFQ notification');
newlyAssignedRfq = await reopenedServices.workflow.performAction(newlyAssignedRfq.id, {
  entityType: 'rfq',
  action: 'start_rep_review',
  comment: '',
  data: {},
  expectedVersion: newlyAssignedRfq.version,
});
assert.equal(newlyAssignedRfq.trackingStatus, 'under_rep_review');
assert.equal(newlyAssignedRfq.reference, submission.enquiry.reference, 'the permanent RFQ reference must not change when review starts');
assert.equal(newlyAssignedRfq.reviewStartedAt, '2026-07-22T12:00:00.000Z');
let salesRfq = assignedRfqs.find(enquiry => enquiry.id === 'enquiry-demo-cape-001');
assert.equal(salesRfq.trackingStatus, 'under_rep_review');
assert.ok(salesRfq.allowedWorkflowActions.some(action => action.action === 'mark_quoted'));
await assert.rejects(
  () => reopenedServices.workflow.performAction(salesRfq.id, {
    entityType: 'rfq',
    action: 'mark_quoted',
    comment: '',
    data: { quotationDate: '2026-07-22', quotationExpiryMode: 'not_applicable' },
    expectedVersion: salesRfq.version,
  }),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.quotationNumber),
  'the service layer must return field-level quotation validation errors',
);

const testQuotationFile = { name: 'quotation-test-copy.pdf', type: 'application/pdf', size: 3072 };
salesRfq = await reopenedServices.workflow.performAction(salesRfq.id, {
  entityType: 'rfq',
  action: 'mark_quoted',
  comment: '',
  data: {
    quotationNumber: 'TEST-QUOTE-001',
    quotationDate: '2026-07-22',
    quotationExpiryMode: 'dated',
    quotationExpiryDate: '2026-08-22',
    quotationInternalNote: 'Fabricated internal quotation note.',
    quotationCustomerNote: 'Please review the quotation emailed through Outlook.',
    quotationEmailed: true,
    quotationDocumentReference: 'OUTLOOK-TEST-REFERENCE',
    quotationDocumentFile: testQuotationFile,
    quotationDocumentCustomerVisible: true,
  },
  expectedVersion: salesRfq.version,
});
assert.equal(salesRfq.trackingStatus, 'quoted');
assert.equal(salesRfq.quotation.number, 'TEST-QUOTE-001');
assert.equal(salesRfq.quotation.document.fileName, testQuotationFile.name);
assert.equal(salesRfq.quotation.document.storageStatus, 'metadata_only');
assert.equal(salesRfq.quotation.documentCustomerVisible, true);
assert.equal(salesRfq.quotedBy.id, 'staff-sales-preview');
const storedQuotedRfq = JSON.parse(storage.getItem(STORE_KEYS.workflowState)).enquiries.find(enquiry => enquiry.id === salesRfq.id);
assert.equal('quotationDocumentFile' in storedQuotedRfq, false, 'raw quotation files must never enter browser storage');
assert.equal(storedQuotedRfq.quotation.document.sizeBytes, testQuotationFile.size);
const representativeQuoteNotice = (await reopenedServices.notifications.list()).find(notification => notification.entityId === salesRfq.id && notification.status === 'quoted');
assert.ok(representativeQuoteNotice?.message.includes('customer was notified'), 'the representative must receive a quotation confirmation');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerOrdersBeforeAcknowledgement = (await reopenedServices.orders.list()).length;
let customerQuotedRfq = (await reopenedServices.enquiries.list()).find(enquiry => enquiry.id === salesRfq.id);
assert.equal(customerQuotedRfq.trackingStatus, 'quoted');
assert.equal(customerQuotedRfq.quotation.internalNote, undefined, 'internal quotation notes must never enter the customer projection');
assert.equal(customerQuotedRfq.quotation.document.fileName, testQuotationFile.name, 'an intentionally uploaded and authorised quotation copy may be described to the customer');
assert.equal(customerQuotedRfq.quotation.document.downloadUrl, undefined, 'mock mode must not imply that a quotation document can be downloaded');
assert.ok(customerQuotedRfq.allowedWorkflowActions.some(action => action.action === 'acknowledge_quotation'));
const customerQuoteNotice = (await reopenedServices.notifications.list()).find(notification => notification.entityId === salesRfq.id && notification.status === 'quoted');
assert.ok(customerQuoteNotice?.message.includes('emailed separately'), 'the customer notification must explain that the quotation was emailed separately');
customerQuotedRfq = await reopenedServices.workflow.performAction(customerQuotedRfq.id, {
  entityType: 'rfq',
  action: 'acknowledge_quotation',
  comment: '',
  data: {},
  expectedVersion: customerQuotedRfq.version,
});
assert.equal(customerQuotedRfq.trackingStatus, 'awaiting_customer_acceptance');
assert.equal(customerQuotedRfq.quotationAcknowledgedAt, '2026-07-22T12:00:00.000Z');
assert.equal((await reopenedServices.orders.list()).length, customerOrdersBeforeAcknowledgement, 'acknowledging receipt must not create an order');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
salesRfq = (await reopenedServices.enquiries.listRepresentativeInbox()).find(enquiry => enquiry.id === salesRfq.id);
assert.equal(salesRfq.trackingStatus, 'awaiting_customer_acceptance');
const customerAcknowledgementNotice = (await reopenedServices.notifications.list()).find(notification => notification.entityId === salesRfq.id && notification.status === 'awaiting_customer_acceptance');
assert.ok(customerAcknowledgementNotice?.message.includes('not order acceptance'), 'the representative notification must distinguish receipt from acceptance');

await assert.rejects(
  () => reopenedServices.workflow.performAction(salesRfq.id, {
    entityType: 'rfq',
    action: 'accept_order',
    comment: '',
    data: {
      acceptanceType: 'purchase_order_received',
      acceptanceDate: '2026-07-22',
      acceptanceInternalNote: 'Purchase Order was reviewed.',
      acceptanceVerified: true,
    },
    expectedVersion: salesRfq.version,
  }),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.acceptancePurchaseOrderNumber),
  'Purchase Order acceptance must return a field-level error when its number is missing',
);

await assert.rejects(
  () => reopenedServices.workflow.performAction(salesRfq.id, {
    entityType: 'rfq',
    action: 'accept_order',
    comment: '',
    data: {
      acceptanceType: 'payment_confirmed',
      acceptanceDate: '2026-07-22',
      acceptanceInternalNote: 'External payment confirmation was reviewed.',
      acceptanceVerified: true,
    },
    expectedVersion: salesRfq.version,
  }),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.acceptancePaymentReference),
  'payment-confirmation acceptance must require an external transaction reference',
);

await assert.rejects(
  () => reopenedServices.workflow.performAction(salesRfq.id, {
    entityType: 'rfq',
    action: 'accept_order',
    comment: '',
    data: {
      acceptanceType: 'written_acceptance_received',
      acceptanceDate: '2026-07-22',
      acceptanceInternalNote: 'Written acceptance was reviewed.',
      acceptanceVerified: true,
      cardNumber: 'not-permitted',
    },
    expectedVersion: salesRfq.version,
  }),
  error => error instanceof ServiceError && error.code === 'VALIDATION_ERROR' && Boolean(error.fieldErrors.acceptance),
  'payment-card and banking credentials must be rejected by shared validation',
);

const accountsWithOtherRepresentative = JSON.parse(storage.getItem(STORE_KEYS.accounts));
accountsWithOtherRepresentative.push({
  id: 'staff-sales-other-test',
  companyId: 'company-rhomberg',
  company: 'Rhomberg Instruments',
  contact: 'Other Sales Test',
  email: 'sales.other@example.invalid',
  phone: 'Internal test account',
  area: 'Johannesburg',
  industry: 'Internal sales',
  role: 'sales_representative',
  representativeId: 'J-OTHER',
  password: 'OtherSales123!',
  createdAt: '2026-07-22T08:00:00.000Z',
});
storage.setItem(STORE_KEYS.accounts, JSON.stringify(accountsWithOtherRepresentative));
await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'sales.other@example.invalid', password: 'OtherSales123!' });
await assert.rejects(
  () => reopenedServices.workflow.performAction(salesRfq.id, {
    entityType: 'rfq',
    action: 'accept_order',
    comment: '',
    data: {
      acceptanceType: 'purchase_order_received',
      acceptancePurchaseOrderNumber: 'PO-TEST-001',
      acceptanceDate: '2026-07-22',
      acceptanceInternalNote: 'Unauthorised conversion attempt.',
      acceptanceVerified: true,
    },
    expectedVersion: salesRfq.version,
  }),
  error => error instanceof ServiceError && error.code === 'WORKFLOW_RECORD_NOT_FOUND',
  'a representative who is not assigned to the RFQ must not accept or convert it',
);
await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
salesRfq = (await reopenedServices.enquiries.listRepresentativeInbox()).find(enquiry => enquiry.id === salesRfq.id);

const acceptanceDocument = { name: 'fabricated-po-acceptance.pdf', type: 'application/pdf', size: 4096 };
const acceptanceRequest = {
  entityType: 'rfq',
  action: 'accept_order',
  comment: '',
  data: {
    acceptanceType: 'purchase_order_received',
    acceptancePurchaseOrderNumber: 'PO-TEST-001',
    acceptancePaymentReference: '',
    acceptanceDate: '2026-07-22',
    acceptanceInternalNote: 'Fabricated Purchase Order evidence was verified outside the app.',
    acceptanceDocumentReference: 'OUTLOOK-PO-TEST-001',
    acceptanceDocumentFile: acceptanceDocument,
    acceptanceVerified: true,
  },
  expectedVersion: salesRfq.version,
};
const workflowBeforeConversion = JSON.parse(storage.getItem(STORE_KEYS.workflowState));
const conversion = await reopenedServices.workflow.performAction(salesRfq.id, acceptanceRequest);
assert.equal(conversion.trackingStatus, 'converted_to_order');
assert.equal(conversion.createdOrder.workflowType, 'order');
assert.equal(conversion.createdOrder.trackingStatus, 'awaiting_planning');
assert.equal(conversion.orderId, conversion.createdOrder.id, 'converted RFQ must link to the generated order');
assert.equal(conversion.orderReference, conversion.createdOrder.reference, 'converted RFQ must retain the permanent order reference');
assert.equal(conversion.createdOrder.sourceEnquiryId, conversion.id);
assert.equal(conversion.createdOrder.items[0].sourceLineId, salesRfq.items[0].lineId);
assert.deepEqual(conversion.createdOrder.items[0].configurationSnapshot, salesRfq.items[0].configuration);
assert.equal(conversion.acceptance.type, 'purchase_order_received');
assert.equal(conversion.acceptance.document.fileName, acceptanceDocument.name);
assert.equal(conversion.acceptedBy.id, 'staff-sales-preview');

const workflowAfterConversion = JSON.parse(storage.getItem(STORE_KEYS.workflowState));
assert.equal(workflowAfterConversion.orders.length, workflowBeforeConversion.orders.length + 1, 'RFQ conversion must create exactly one separate order');
assert.ok(workflowAfterConversion.enquiries.some(enquiry => enquiry.id === conversion.id && enquiry.trackingStatus === 'converted_to_order'));
assert.ok(workflowAfterConversion.orders.some(order => order.id === conversion.createdOrder.id && order.sourceEnquiryId === conversion.id));
const storedConvertedRfq = workflowAfterConversion.enquiries.find(enquiry => enquiry.id === conversion.id);
assert.equal('acceptanceDocumentFile' in storedConvertedRfq, false, 'raw acceptance files must never enter browser storage');
assert.equal(storedConvertedRfq.acceptance.document.storageStatus, 'metadata_only');
const repeatedConversion = await reopenedServices.workflow.performAction(conversion.id, {
  ...acceptanceRequest,
  expectedVersion: salesRfq.version,
});
assert.equal(repeatedConversion.idempotent, true, 'repeated acceptance must return the existing conversion result');
assert.equal(repeatedConversion.createdOrder.id, conversion.createdOrder.id);
assert.equal(JSON.parse(storage.getItem(STORE_KEYS.workflowState)).orders.length, workflowAfterConversion.orders.length, 'an idempotent retry must not create a duplicate order');

const salesNotifications = await reopenedServices.notifications.list();
const salesConversionNotice = salesNotifications.find(notification => notification.status === 'converted_to_order');
assert.ok(salesConversionNotice, 'the assigned representative must receive the conversion notification');
assert.ok(salesConversionNotice.message.includes('routed to Planning'));
const readSalesNotice = await reopenedServices.notifications.markRead(salesConversionNotice.id);
assert.ok(readSalesNotice.readAt, 'notification read state must be recorded per signed-in user');
const conversionAudit = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(conversionAudit.some(event => event.entityId === conversion.id && event.action === 'workflow.accept_order' && event.toStatus === 'accepted'));
assert.ok(conversionAudit.some(event => event.entityId === conversion.id && event.action === 'workflow.convert_to_order' && event.toStatus === 'converted_to_order'));
assert.ok(conversionAudit.some(event => event.entityId === conversion.createdOrder.id && event.action === 'order.created_from_rfq' && event.toStatus === 'awaiting_planning'));

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerHistoricalRfq = (await reopenedServices.enquiries.list()).find(enquiry => enquiry.id === conversion.id);
assert.equal(customerHistoricalRfq.trackingStatus, 'converted_to_order', 'the original RFQ must remain in customer history');
assert.equal(customerHistoricalRfq.acceptance, undefined, 'internal acceptance evidence must not enter the customer projection');
const customerConvertedOrder = (await reopenedServices.orders.list()).find(order => order.id === conversion.createdOrder.id);
assert.ok(customerConvertedOrder, 'the converted order must appear on the authorised customer account');
assert.equal(customerConvertedOrder.acceptance, undefined, 'internal acceptance evidence must also be hidden on the customer order projection');
assert.equal(customerConvertedOrder.planning, undefined, 'internal Planning data must not enter the customer projection');
const customerConversionNotice = (await reopenedServices.notifications.list()).find(notification => notification.status === 'converted_to_order');
assert.ok(customerConversionNotice?.message.includes('converted into an order'));

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'planning.workflow@example.invalid', password: 'Planning123!' });
assert.deepEqual(await reopenedServices.enquiries.list(), [], 'Planning must not receive RFQ records through the RFQ service');
const planningQueue = await reopenedServices.orders.list();
assert.ok(planningQueue.every(order => ['awaiting_planning', 'planning_in_progress', 'planned'].includes(order.trackingStatus)
  || (order.trackingStatus === 'on_hold' && ['awaiting_planning', 'planning_in_progress', 'planned'].includes(order.workflowContext?.resumeStatus))),
'Planning must receive only its own controlled order stages');
const planningOptions = await reopenedServices.planning.getWorkspaceOptions();
assert.ok(planningOptions.users.some(user => user.id === 'staff-planning-preview'), 'Planning options must list authorised Planning users through the service layer');
assert.ok(planningOptions.locations.some(location => location.id === 'cape-town'), 'Planning options must list recognised production locations through the service layer');
assert.deepEqual(planningOptions.priorities.map(priority => priority.id), ['standard', 'high', 'urgent']);
const planningConversionNotice = (await reopenedServices.notifications.list()).find(notification => notification.status === 'converted_to_order');
assert.ok(planningConversionNotice?.message.includes('waiting for Planning'), 'Planning must receive a new-order notification');
let plannedOrder = planningQueue.find(order => order.id === conversion.createdOrder.id);
plannedOrder = await reopenedServices.workflow.performAction(plannedOrder.id, {
  entityType: 'order', action: 'start_planning', comment: '', data: {}, expectedVersion: plannedOrder.version,
});
plannedOrder = await reopenedServices.workflow.performAction(plannedOrder.id, {
  entityType: 'order',
  action: 'complete_planning',
  comment: '',
  data: {
    planningInternalJobNumber: 'JOB-TEST-001',
    planningCustomerPoNumber: 'PO-TEST-001',
    planningNotes: 'Fabricated Planning service test note.',
    planningStartDate: '2026-07-23',
    planningEstimatedCompletionDate: '2026-07-30',
    planningAssignedUserId: 'staff-planning-preview',
    planningProductionLocationId: 'cape-town',
    planningPriority: 'high',
    planningSubmissionDate: '2026-07-22',
    planningDocumentReferences: 'DOC-PLAN-TEST-001',
  },
  expectedVersion: plannedOrder.version,
});
assert.equal(plannedOrder.planning.internalJobNumber, 'JOB-TEST-001');
assert.equal(plannedOrder.planning.assignedPlanningUserName, 'Planning Workflow Test');
assert.equal(plannedOrder.planning.productionLocationName, 'Cape Town');
assert.equal(plannedOrder.plannedBy.id, 'staff-planning-preview');
plannedOrder = await reopenedServices.workflow.performAction(plannedOrder.id, {
  entityType: 'order', action: 'submit_to_expediting', comment: '', data: {}, expectedVersion: plannedOrder.version,
});
assert.equal(plannedOrder.trackingStatus, 'submitted_to_expediting');
assert.equal(plannedOrder.submittedToExpeditingBy.id, 'staff-planning-preview');
const planningAudit = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(planningAudit.some(event => event.entityId === plannedOrder.id && event.action === 'workflow.complete_planning' && event.comment === 'Fabricated Planning service test note.'));
assert.ok(planningAudit.some(event => event.entityId === plannedOrder.id && event.action === 'workflow.submit_to_expediting'));

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerPlannedOrder = (await reopenedServices.orders.list()).find(order => order.id === plannedOrder.id);
assert.equal(customerPlannedOrder.planning, undefined, 'Planning notes, schedule and ownership must be hidden from customers');
assert.equal(customerPlannedOrder.internalJobNumber, undefined, 'internal job numbers must be hidden from customers');
assert.equal(customerPlannedOrder.customerPoNumber, undefined, 'internal Planning PO fields must be hidden from customers');
assert.equal(customerPlannedOrder.plannedBy, undefined, 'internal Planning actor metadata must be hidden from customers');
assert.equal(customerPlannedOrder.trackingStatus, 'submitted_to_expediting', 'customers must receive the approved Planning hand-off update');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'expeditor.test@rhom.co.za', password: 'Expedite123!' });
const expeditorPlanningNotice = (await reopenedServices.notifications.list()).find(notification => notification.reference === plannedOrder.reference && notification.status === 'submitted_to_expediting');
assert.ok(expeditorPlanningNotice?.message.includes('Expediting queue'), 'the Expeditor queue must be notified of the Planning hand-off');
const expeditingOptions = await reopenedServices.expediting.getWorkspaceOptions();
assert.ok(expeditingOptions.progressSteps.some(step => step.id === 'ready_for_dispatch'), 'Expediting steps must load through the service layer');
assert.ok(expeditingOptions.requiredStepIds.includes('quality_check'), 'the service must expose controlled hand-off requirements');
assert.ok(expeditingOptions.documentTypes.some(type => type.id === 'image'), 'document and image metadata types must be configurable');
const operationalOrders = await reopenedServices.orders.list();
assert.ok(operationalOrders.every(order => ['submitted_to_expediting', 'expediting_in_progress', 'awaiting_dispatch'].includes(order.trackingStatus)
  || (order.trackingStatus === 'on_hold' && ['submitted_to_expediting', 'expediting_in_progress'].includes(order.workflowContext?.resumeStatus))),
'Expediting must receive only orders handed over by Planning, including the awaiting-Dispatch awareness state');
const migratedProductionOrder = operationalOrders.find(order => order.id === 'enquiry-demo-jhb-001');
assert.equal(migratedProductionOrder.trackingStatus, 'expediting_in_progress', 'legacy combined records should migrate into the separate order collection');
let expeditedOrder = operationalOrders.find(order => order.id === conversion.createdOrder.id);
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order',
  action: 'start_expediting',
  comment: '',
  data: {
    expeditingCustomerMessage: 'Your planned order has been received and Expediting has started work.',
    expeditingInternalNote: 'Fabricated Expeditor intake note.',
    expeditingEstimatedCompletionDate: '2026-07-30',
  },
  expectedVersion: expeditedOrder.version,
});
assert.equal(expeditedOrder.expediting.currentStep, 'planning_received');
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order',
  action: 'add_expediting_update',
  comment: '',
  data: {
    expeditingProgressStep: 'materials_checked',
    expeditingCustomerMessage: 'The material requirements for your order have been checked.',
    expeditingInternalNote: 'Fabricated stock check complete.',
    expeditingEstimatedCompletionDate: '2026-07-30',
    expeditingDocumentType: 'quality_record',
    expeditingDocumentReference: 'QA-TEST-001',
  },
  expectedVersion: expeditedOrder.version,
});
assert.equal(expeditedOrder.trackingStatus, 'expediting_in_progress', 'progress updates must remain inside the Expediting state');
assert.equal(expeditedOrder.expediting.updates.at(-1).document.storageStatus, 'metadata_only');
await assert.rejects(
  () => reopenedServices.workflow.performAction(expeditedOrder.id, {
    entityType: 'order',
    action: 'complete_expediting',
    comment: '',
    data: {
      expeditingCustomerMessage: 'Your order is moving to Dispatch.',
      expeditingCompletionCheckConfirmed: true,
    },
    expectedVersion: expeditedOrder.version,
  }),
  error => error instanceof ServiceError
    && error.code === 'EXPEDITING_HANDOFF_INVALID'
    && Boolean(error.fieldErrors.expeditingReadyExceptionAuthorised),
  'the service must reject a Dispatch hand-off before required steps are complete',
);
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order',
  action: 'place_on_hold',
  comment: '',
  data: {
    expeditingCustomerMessage: 'Your order is temporarily on hold while a test component is received.',
    expeditingInternalNote: 'Fabricated supplier detail restricted to internal staff.',
    expeditingDelayReason: 'Waiting for a fabricated test component.',
    expeditingEstimatedCompletionDate: '2026-08-01',
  },
  expectedVersion: expeditedOrder.version,
});
assert.equal(expeditedOrder.trackingStatus, 'on_hold');
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order',
  action: 'resume_order',
  comment: '',
  data: {
    expeditingProgressStep: 'materials_checked',
    expeditingCustomerMessage: 'The required test component was received and work has resumed.',
    expeditingInternalNote: 'Fabricated component receipt verified.',
    expeditingEstimatedCompletionDate: '2026-08-01',
  },
  expectedVersion: expeditedOrder.version,
});
assert.equal(expeditedOrder.trackingStatus, 'expediting_in_progress');
for (const [progressStep, customerMessage] of [
  ['production_started', 'Production has started on your order.'],
  ['calibration_or_testing', 'Your units are undergoing calibration or functional testing.'],
  ['quality_check', 'Your order is undergoing its quality review.'],
  ['paperwork_preparation', 'The required dispatch paperwork is being prepared.'],
]) {
  expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
    entityType: 'order',
    action: 'add_expediting_update',
    comment: '',
    data: {
      expeditingProgressStep: progressStep,
      expeditingCustomerMessage: customerMessage,
      expeditingEstimatedCompletionDate: '2026-08-01',
    },
    expectedVersion: expeditedOrder.version,
  });
}
expeditedOrder = await reopenedServices.workflow.performAction(expeditedOrder.id, {
  entityType: 'order',
  action: 'complete_expediting',
  comment: '',
  data: {
    expeditingCustomerMessage: 'Your order has completed Expediting and is moving to Dispatch.',
    expeditingInternalNote: 'All fabricated Expeditor hand-off checks complete.',
    expeditingEstimatedCompletionDate: '2026-08-01',
    expeditingCompletionCheckConfirmed: true,
  },
  expectedVersion: expeditedOrder.version,
});
assert.equal(expeditedOrder.trackingStatus, 'awaiting_dispatch');
assert.equal(expeditedOrder.expediting.currentStep, 'ready_for_dispatch');
assert.ok(expeditedOrder.expediting.completedStepIds.includes('quality_check'));

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const customerExpeditedOrder = (await reopenedServices.orders.list()).find(order => order.id === conversion.createdOrder.id);
assert.ok(customerExpeditedOrder.expediting.updates.some(update => update.customerMessage.includes('material requirements')));
assert.ok(customerExpeditedOrder.trackingHistory.some(event => event.progressStep === 'quality_check'), 'customer-visible updates must appear in the customer timeline');
assert.equal(customerExpeditedOrder.expediting.updates.some(update => 'internalNote' in update), false, 'Expeditor internal notes must never enter the customer projection');
assert.equal('handoffException' in customerExpeditedOrder.expediting, false, 'internal Expeditor hand-off exception data must not enter the customer projection');
assert.ok((await reopenedServices.notifications.list()).some(notification => notification.entityId === conversion.createdOrder.id && notification.message.includes('quality review')), 'the customer must receive every customer-visible progress notification');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'sales.workflow@example.invalid', password: 'Sales123!' });
const representativeExpeditedOrder = (await reopenedServices.orders.list()).find(order => order.id === conversion.createdOrder.id);
assert.ok(representativeExpeditedOrder.trackingHistory.some(event => event.progressStep === 'quality_check'), 'the assigned representative must receive the same customer-visible progress timeline');
assert.ok((await reopenedServices.notifications.list()).some(notification => notification.entityId === conversion.createdOrder.id && notification.message.includes('quality review')), 'the assigned representative must receive progress notifications');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'dispatch.workflow@example.invalid', password: 'Dispatch123!' });
const dispatchQueue = await reopenedServices.orders.list();
assert.ok(dispatchQueue.every(order => ['awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected'].includes(order.trackingStatus)
  || (order.trackingStatus === 'on_hold' && ['awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected'].includes(order.workflowContext?.resumeStatus))),
'Dispatch must receive only orders handed over by Expediting');
let dispatchedOrder = dispatchQueue.find(order => order.id === conversion.createdOrder.id);
dispatchedOrder = await reopenedServices.workflow.performAction(dispatchedOrder.id, {
  entityType: 'order', action: 'mark_ready_for_collection', comment: '', data: {}, expectedVersion: dispatchedOrder.version,
});
dispatchedOrder = await reopenedServices.workflow.performAction(dispatchedOrder.id, {
  entityType: 'order', action: 'confirm_collection', comment: 'Collected by the authorised test contact.', data: {}, expectedVersion: dispatchedOrder.version,
});
dispatchedOrder = await reopenedServices.workflow.performAction(dispatchedOrder.id, {
  entityType: 'order', action: 'complete_collection', comment: '', data: {}, expectedVersion: dispatchedOrder.version,
});
assert.equal(dispatchedOrder.trackingStatus, 'completed');

const auditEvents = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(auditEvents.some(event => event.action === 'order.created_from_rfq' && event.entityId === conversion.createdOrder.id), 'atomic conversion must create a separate order-creation audit entry');
assert.ok(auditEvents.some(event => event.action === 'workflow.mark_quoted' && event.entityId === conversion.id && event.comment === 'Fabricated internal quotation note.'), 'quotation confirmation must add an internal audit event');
assert.ok(auditEvents.some(event => event.action === 'workflow.acknowledge_quotation' && event.entityId === conversion.id && event.actorRole === USER_ROLES.CUSTOMER), 'customer receipt acknowledgement must add an audit event');
assert.ok(auditEvents.some(event => event.action === 'workflow.complete_expediting' && event.outcome === 'success'), 'successful workflow actions must create audit entries');
assert.ok(auditEvents.some(event => event.action === 'workflow.complete_expediting' && event.outcome === 'denied' && event.errorCode === 'EXPEDITING_HANDOFF_INVALID'), 'denied Expediting hand-offs must create audit entries');
const storedNotifications = JSON.parse(storage.getItem(STORE_KEYS.notifications));
assert.ok(storedNotifications.some(item => item.entityId === conversion.createdOrder.id && item.status === 'awaiting_dispatch'), 'notifiable transitions must queue a mock notification');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const capeRfqs = await reopenedServices.enquiries.list();
const capeOrders = await reopenedServices.orders.list();
assert.ok(capeRfqs.every(record => record.companyId === 'company-demo-cape'));
assert.ok(capeOrders.every(record => record.companyId === 'company-demo-cape'));
assert.equal(capeOrders.find(order => order.id === conversion.createdOrder.id).trackingStatus, 'completed', 'customer tracking must show the completed order from its own company');
const customerNotifications = await reopenedServices.notifications.list();
assert.ok(customerNotifications.length > 0 && customerNotifications.every(notification => notification.companyId === 'company-demo-cape'), 'customer notifications must remain company-isolated');

await reopenedServices.auth.signOut();
await reopenedServices.auth.signIn({ email: 'demo@client.co.za', password: 'Demo123!' });
const auditsAfterDenial = JSON.parse(storage.getItem(STORE_KEYS.audit));
assert.ok(auditsAfterDenial.some(event => event.action === 'workflow.start_rep_review' && event.outcome === 'denied'), 'denied workflow attempts must create audit entries');

await assert.rejects(
  () => reopenedServices.auth.register({ company: '', contact: '', email: 'bad', phone: '', area: '', industry: '', password: 'short' }),
  error => error instanceof ServiceError && Object.keys(error.fieldErrors).length >= 6,
  'registration validation should return field-level errors',
);

await reopenedServices.auth.signOut();
const buyerAccount = await reopenedServices.auth.signIn({ email: 'buyer.workflow@example.invalid', password: 'Buyer123!' });
assert.equal(buyerAccount.role, USER_ROLES.BUYER);
assert.deepEqual(await reopenedServices.enquiries.list(), [], 'the prepared Buyer role must not receive RFQs before its workflow is implemented');
assert.deepEqual(await reopenedServices.orders.list(), [], 'the prepared Buyer role must not receive order queues before its workflow is implemented');
await assert.rejects(
  () => reopenedServices.workflow.performAction(conversion.createdOrder.id, {
    entityType: 'order',
    action: 'override_workflow',
    comment: 'Buyer should not be allowed.',
    data: { targetStatus: 'archived', overrideReason: 'Permission boundary test.' },
    expectedVersion: dispatchedOrder.version,
  }),
  error => error instanceof ServiceError && error.status === 404,
  'Buyer must not discover or mutate an order outside its inactive scope',
);

await reopenedServices.auth.signOut();
const managerAccount = await reopenedServices.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
assert.equal(managerAccount.role, USER_ROLES.MANAGER);
assert.ok((await reopenedServices.enquiries.list()).length >= 2, 'Manager must receive the wider RFQ oversight scope');
const managerOrders = await reopenedServices.orders.list();
assert.ok(managerOrders.length >= 3, 'Manager must receive the wider order oversight scope');
assert.ok(managerOrders.find(order => order.id === conversion.createdOrder.id)?.allowedWorkflowActions.some(action => action.action === 'override_workflow'));
assert.ok((await reopenedServices.expediting.getWorkspaceOptions()).requiredStepIds.includes('ready_for_dispatch'), 'authorised management actions must use the same service-owned Expediting configuration');
assert.ok((await reopenedServices.audit.list()).some(event => event.actorRole === USER_ROLES.BUYER && event.outcome === 'denied'), 'Buyer workflow denial must be visible in authorised audit history');

await reopenedServices.auth.signOut();
const administratorAccount = await reopenedServices.auth.signIn({ email: 'administrator.workflow@example.invalid', password: 'Admin123!' });
assert.equal(administratorAccount.role, USER_ROLES.ADMINISTRATOR);
assert.ok(administratorAccount.permissions.includes('administer_users'));
assert.ok((await reopenedServices.accounts.listCompanies()).length >= 3, 'Administrator must receive authorised company administration scope');
assert.ok((await reopenedServices.orders.list()).some(order => order.id === conversion.createdOrder.id), 'Administrator must receive all-order oversight');

const legacySessionStorage = new TestStorage();
legacySessionStorage.setItem(LEGACY_STORE_KEYS.session, JSON.stringify({
  accountId: 'staff-sales-preview',
  signedInAt: '2026-07-21T08:00:00.000Z',
}));
const legacySessionServices = createMockServices({ storage: legacySessionStorage });
await legacySessionServices.initialize();
assert.equal((await legacySessionServices.auth.getSession())?.role, USER_ROLES.SALES_REPRESENTATIVE, 'a legacy session should migrate once');
assert.equal(legacySessionStorage.getItem(LEGACY_STORE_KEYS.session), null, 'the migrated legacy session key should be retired');
await legacySessionServices.auth.signOut();
await legacySessionServices.initialize();
assert.equal(await legacySessionServices.auth.getSession(), null, 'sign-out must not restore a retired legacy session');

const apiRequests = [];
const apiUser = { id: '00000000-0000-4000-8000-000000000001', companyId: '00000000-0000-4000-8000-000000000002', company: 'API Demo Company', contact: 'API Demo User', email: 'api@example.invalid', role: 'customer', permissions: [] };
const jsonResponse = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify({ data }), {
  status,
  headers: status === 204 ? {} : { 'Content-Type': 'application/json' },
});
const apiFetch = async (url, options) => {
  const request = { url: String(url), path: url.pathname, options };
  apiRequests.push(request);
  if (url.pathname.endsWith('/auth/csrf-token')) return jsonResponse({ token: 'test-csrf-token' });
  if (url.pathname.endsWith('/auth/me')) return jsonResponse(apiUser);
  if (url.pathname.endsWith('/auth/login')) return jsonResponse({ user: apiUser, csrfToken: 'rotated-test-token' });
  if (url.pathname.endsWith('/planning/workspace-options')) return jsonResponse({ users: [], locations: [], priorities: [{ id: 'standard', label: 'Standard' }] });
  if (url.pathname.endsWith('/expediting/workspace-options')) return jsonResponse({
    progressSteps: [{ id: 'planning_received', label: 'Planning received' }, { id: 'ready_for_dispatch', label: 'Ready for dispatch' }],
    requiredStepIds: ['planning_received', 'ready_for_dispatch'],
    documentTypes: [{ id: 'document', label: 'Document reference' }],
    approachingCompletionDays: 3,
  });
  if (url.pathname.endsWith('/enquiries') && options.method === 'POST') return jsonResponse({ enquiry: { id: '00000000-0000-4000-8000-000000000003', reference: 'RQ-API-TEST', companyId: apiUser.companyId }, delivery: { ok: true, deliveryMode: 'queued' } }, 201);
  if (url.pathname.endsWith('/workflow-actions') && options.method === 'POST') return jsonResponse({ id: '00000000-0000-4000-8000-000000000003', reference: 'RQ-API-TEST', workflowType: 'order', trackingStatus: 'awaiting_dispatch', version: 6 }, 201);
  return jsonResponse([]);
};

const apiServices = createApiServices({ apiBaseUrl: '/api/v1', requestTimeoutMs: 1000, fetchImplementation: apiFetch, storage: new TestStorage() });
await apiServices.initialize();
assert.equal((await apiServices.auth.getSession()).companyId, apiUser.companyId);
await apiServices.auth.signIn({ email: 'api@example.invalid', password: 'Example123!' });
await apiServices.enquiries.list();
await apiServices.enquiries.listRepresentativeInbox();
await apiServices.orders.list();
const apiPlanningOptions = await apiServices.planning.getWorkspaceOptions();
assert.equal(apiPlanningOptions.priorities[0].id, 'standard');
const apiExpeditingOptions = await apiServices.expediting.getWorkspaceOptions();
assert.equal(apiExpeditingOptions.progressSteps.at(-1).id, 'ready_for_dispatch');
assert.ok(apiRequests.some(request => request.path.endsWith('/enquiries') && request.options.method === 'GET'), 'API RFQ reads must use the RFQ collection endpoint');
assert.ok(apiRequests.some(request => request.path.endsWith('/enquiries/inbox') && request.options.method === 'GET'), 'API representative inbox reads must use the dedicated inbox endpoint');
assert.ok(apiRequests.some(request => request.path.endsWith('/orders') && request.options.method === 'GET'), 'API order reads must use the separate order collection endpoint');
const apiSubmission = await apiServices.enquiries.submit({
  application: 'API contract test application',
  area: 'Gauteng',
  selectedRep: { id: '00000000-0000-4000-8000-000000000004' },
  emergency: 'no',
  fulfilment: 'collect',
  collectionBranch: 'Test branch',
  poMode: 'none',
}, [draftLine]);
assert.equal(apiSubmission.enquiry.reference, 'RQ-API-TEST');
const apiQuotationFile = new File(['fabricated quotation copy'], 'quotation-api-test.pdf', { type: 'application/pdf' });
await apiServices.workflow.performAction(apiSubmission.enquiry.id, {
  entityType: 'rfq',
  action: 'mark_quoted',
  comment: '',
  data: {
    quotationNumber: 'Q-API-TEST',
    quotationDate: '2026-07-22',
    quotationExpiryMode: 'not_applicable',
    quotationEmailed: true,
    quotationDocumentFile: apiQuotationFile,
    quotationDocumentCustomerVisible: false,
  },
  expectedVersion: 4,
});
const apiAcceptanceFile = new File(['fabricated acceptance evidence'], 'acceptance-api-test.pdf', { type: 'application/pdf' });
await apiServices.workflow.performAction(apiSubmission.enquiry.id, {
  entityType: 'rfq',
  action: 'accept_order',
  comment: '',
  data: {
    acceptanceType: 'purchase_order_received',
    acceptancePurchaseOrderNumber: 'PO-API-TEST',
    acceptanceDate: '2026-07-22',
    acceptanceInternalNote: 'Fabricated API acceptance evidence was verified.',
    acceptanceDocumentReference: 'API-DOC-TEST',
    acceptanceDocumentFile: apiAcceptanceFile,
    acceptanceVerified: true,
  },
  expectedVersion: 5,
});
await apiServices.workflow.performAction(apiSubmission.enquiry.id, {
  entityType: 'order',
  action: 'complete_planning',
  comment: '',
  data: {
    planningInternalJobNumber: 'JOB-API-TEST',
    planningCustomerPoNumber: 'PO-API-TEST',
    planningAssignedUserId: 'planner-api-test',
    planningPriority: 'standard',
    planningSubmissionDate: '2026-07-22',
  },
  expectedVersion: 4,
});
await apiServices.workflow.performAction(apiSubmission.enquiry.id, {
  entityType: 'order',
  action: 'complete_expediting',
  comment: '',
  data: {
    expeditingCustomerMessage: 'Your order has completed Expediting and is moving to Dispatch.',
    expeditingInternalNote: 'Fabricated API hand-off note.',
    expeditingEstimatedCompletionDate: '2026-08-01',
    expeditingCompletionCheckConfirmed: true,
    expeditingReadyExceptionAuthorised: true,
    expeditingReadyExceptionReason: 'Fabricated authorised exception for the API contract test.',
    expeditingReadyExceptionReference: 'MGR-TEST-001',
  },
  expectedVersion: 5,
});
assert.ok(apiRequests.every(request => request.options.credentials === 'include'), 'API calls must use secure cookie credentials');
const apiStateChanges = apiRequests.filter(request => !['GET', 'HEAD'].includes(request.options.method));
assert.ok(apiStateChanges.every(request => request.options.headers['X-CSRF-Token']), 'state-changing API calls must include a CSRF token');
assert.ok(apiRequests.find(request => request.path.endsWith('/enquiries') && request.options.method === 'POST').options.body instanceof FormData, 'RFQ API request must use multipart form data');
const enquiryWorkflowRequests = apiRequests.filter(request => request.path.endsWith('/enquiries/00000000-0000-4000-8000-000000000003/workflow-actions'));
const quotationWorkflowRequest = enquiryWorkflowRequests.find(request => request.options.body instanceof FormData && JSON.parse(request.options.body.get('payload')).action === 'mark_quoted');
assert.ok(quotationWorkflowRequest?.options.body instanceof FormData, 'quotation confirmation with a file must use multipart form data');
const quotationPayload = JSON.parse(quotationWorkflowRequest.options.body.get('payload'));
assert.equal(quotationPayload.action, 'mark_quoted');
assert.equal(quotationPayload.data.quotation.number, 'Q-API-TEST');
assert.equal(quotationPayload.data.quotation.documentCustomerVisible, false);
assert.equal(quotationWorkflowRequest.options.body.get('quotationDocument').name, apiQuotationFile.name);
const acceptanceWorkflowRequest = enquiryWorkflowRequests.find(request => request.options.body instanceof FormData && JSON.parse(request.options.body.get('payload')).action === 'accept_order');
assert.ok(acceptanceWorkflowRequest?.options.body instanceof FormData, 'order acceptance with a file must use multipart form data');
const acceptancePayload = JSON.parse(acceptanceWorkflowRequest.options.body.get('payload'));
assert.equal(acceptancePayload.data.acceptance.type, 'purchase_order_received');
assert.equal(acceptancePayload.data.acceptance.purchaseOrderNumber, 'PO-API-TEST');
assert.equal(acceptanceWorkflowRequest.options.body.get('acceptanceDocument').name, apiAcceptanceFile.name);
const orderWorkflowRequests = apiRequests.filter(request => request.path.endsWith('/orders/00000000-0000-4000-8000-000000000003/workflow-actions'));
const planningWorkflowRequest = orderWorkflowRequests.find(request => JSON.parse(request.options.body).action === 'complete_planning');
assert.equal(JSON.parse(planningWorkflowRequest.options.body).data.planning.internalJobNumber, 'JOB-API-TEST', 'the API adapter must send validated structured Planning data');
assert.equal(JSON.parse(planningWorkflowRequest.options.body).data.planning.assignedPlanningUserId, 'planner-api-test');
const workflowRequest = orderWorkflowRequests.find(request => JSON.parse(request.options.body).action === 'complete_expediting');
assert.ok(workflowRequest, 'API adapter must route order actions to the controlled workflow endpoint');
assert.ok(workflowRequest.options.headers['Idempotency-Key'], 'workflow actions must carry an idempotency key');
assert.equal(JSON.parse(workflowRequest.options.body).action, 'complete_expediting', 'API workflow request must send an action rather than a target status');
assert.equal(JSON.parse(workflowRequest.options.body).data.expeditingUpdate.progressStep, 'ready_for_dispatch', 'the API adapter must send a validated structured Expediting update');
assert.equal(JSON.parse(workflowRequest.options.body).data.expeditingHandoff.authorisedException, true, 'the API adapter must preserve controlled hand-off exception evidence');

console.log('Mock persistence, workflow audit, company isolation, validation and API adapter tests passed.');
