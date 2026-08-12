import assert from 'node:assert/strict';
import {
  buildOrderSummaryModel,
  isValidRecipientEmail,
  ORDER_COPY_TYPES,
} from '../src/domain/orderDocuments.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';

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
const services = createMockServices({
  storage,
  now: () => new Date('2026-07-28T14:30:00.000Z'),
});
await services.initialize();

assert.equal(isValidRecipientEmail('valid@example.com'), true);
assert.equal(isValidRecipientEmail('not-an-email'), false);

await services.auth.signIn({ email: 'manager.workflow@example.invalid', password: 'Manager123!' });
const orders = await services.orders.list();
const order = orders.find(item => item.reference === 'OR-TEST-0011');
assert.ok(order, 'the order-document test requires the seeded collection order');

const sensitiveOrder = {
  ...order,
  salesOrderNumber: 'SO-INTERNAL-TEST-001',
  planning: { ...order.planning, salesOrderNumber: 'SO-INTERNAL-TEST-001' },
  notes: 'Staff-only order note',
  auditMetadata: { requestId: 'must-not-leak' },
  items: [{
    ...order.items[0],
    configuration: {
      ...order.items[0].configuration,
      privatePriceEngine: 'secret-engine-output',
      internalSupplierCost: 'R 100.00',
      approvedCustomerValue: 'Visible setting',
    },
  }],
  dispatch: {
    ...order.dispatch,
    internalNotes: 'Restricted package location',
  },
};
const customerModel = buildOrderSummaryModel({
  order: sensitiveOrder,
  copyType: ORDER_COPY_TYPES.CUSTOMER,
  generatedAt: '2026-07-28T14:30:00.000Z',
  generatedBy: 'Manager Test',
});
const customerJson = JSON.stringify(customerModel);
assert.equal(customerModel.internal, null);
assert.equal(customerModel.references.salesOrderNumber, undefined, 'customer-safe copies must exclude the Sales Order Number');
assert.equal(customerJson.includes('Restricted package location'), false);
assert.equal(customerJson.includes('Staff-only order note'), false);
assert.equal(customerJson.includes('secret-engine-output'), false);
assert.equal(customerJson.includes('internalSupplierCost'), false);
assert.equal(customerJson.includes('must-not-leak'), false);
assert.equal(customerJson.includes('Visible setting'), true);

const internalModel = buildOrderSummaryModel({
  order: sensitiveOrder,
  copyType: ORDER_COPY_TYPES.INTERNAL,
  generatedAt: '2026-07-28T14:30:00.000Z',
  generatedBy: 'Manager Test',
});
assert.equal(internalModel.internal.dispatchNotes, 'Restricted package location');
assert.equal(internalModel.references.salesOrderNumber, 'SO-INTERNAL-TEST-001');
assert.equal(JSON.stringify(internalModel).includes('secret-engine-output'), false, 'private price-engine information must never enter either PDF model');

const sharingOptions = await services.orderDocuments.getSharingOptions(order.id);
assert.equal(sharingOptions.canEmail, true);
assert.ok(sharingOptions.representative.email);
assert.ok(sharingOptions.internalRecipients.length > 0);

const customerPdf = await services.orderDocuments.generate(order.id, { copyType: ORDER_COPY_TYPES.CUSTOMER });
const internalPdf = await services.orderDocuments.generate(order.id, { copyType: ORDER_COPY_TYPES.INTERNAL });
assert.ok(customerPdf.bytesBase64.startsWith('JVBERi0'), 'customer copy must be a real PDF byte stream');
assert.ok(internalPdf.bytesBase64.startsWith('JVBERi0'), 'internal copy must be a real PDF byte stream');
assert.equal(customerPdf.classification, 'CUSTOMER COPY');
assert.equal(internalPdf.classification, 'INTERNAL - OPERATIONAL COPY');

await assert.rejects(
  () => services.orderDocuments.email(order.id, {
    documentId: customerPdf.id,
    recipientType: 'manual',
    recipientEmail: 'invalid',
    confirmedExternal: true,
  }),
  error => error.code === 'INVALID_EMAIL_RECIPIENT',
);
await assert.rejects(
  () => services.orderDocuments.email(order.id, {
    documentId: customerPdf.id,
    recipientType: 'manual',
    recipientEmail: 'external.customer@example.com',
    confirmedExternal: false,
  }),
  error => error.code === 'INVALID_EMAIL_RECIPIENT',
);
await assert.rejects(
  () => services.orderDocuments.email(order.id, {
    documentId: internalPdf.id,
    recipientType: 'manual',
    recipientEmail: 'external.customer@example.com',
    confirmedExternal: true,
  }),
  error => error.code === 'INTERNAL_COPY_EXTERNAL_RECIPIENT',
);

const externalDelivery = await services.orderDocuments.email(order.id, {
  documentId: customerPdf.id,
  recipientType: 'manual',
  recipientEmail: 'external.customer@example.com',
  confirmedExternal: true,
});
assert.equal(externalDelivery.status, 'email_sent');
assert.equal(externalDelivery.simulated, true);
assert.equal(externalDelivery.external, true);

const representativeDelivery = await services.orderDocuments.email(order.id, {
  documentId: customerPdf.id,
  recipientType: 'representative',
});
assert.equal(representativeDelivery.recipientEmail, sharingOptions.representative.email);
assert.equal(representativeDelivery.external, false);

const audit = await services.audit.list({ entityId: order.id });
assert.equal(audit.filter(event => event.eventType === 'order_summary_pdf_generated').length, 2);
assert.equal(audit.filter(event => event.eventType === 'order_summary_email_sent').length, 2);
assert.equal(audit.filter(event => event.eventType === 'order_summary_email_denied').length, 3, 'invalid or unsafe email attempts must also be audited');
assert.ok(audit.some(event => event.eventType === 'order_summary_email_sent' && event.notificationResults.some(result => result.status === 'email_sent')));
assert.ok(audit.every(event => event.immutable === true));

await services.auth.signOut();
await services.auth.signIn({ email: 'planning.workflow@example.invalid', password: 'Planning123!' });
const planningOrder = (await services.orders.list())[0];
const planningPdf = await services.orderDocuments.generate(planningOrder.id, { copyType: ORDER_COPY_TYPES.CUSTOMER });
assert.ok(planningPdf.bytesBase64.startsWith('JVBERi0'));
await assert.rejects(
  () => services.orderDocuments.email(planningOrder.id, {
    documentId: planningPdf.id,
    recipientType: 'representative',
  }),
  error => error.code === 'FORBIDDEN',
);

await services.auth.signOut();
await services.auth.signIn({ email: 'customer.demo@example.invalid', password: 'Demo123!' });
const customerOrder = (await services.orders.list())[0];
await assert.rejects(
  () => services.orderDocuments.generate(customerOrder.id, { copyType: ORDER_COPY_TYPES.CUSTOMER }),
  error => error.code === 'FORBIDDEN',
);

console.log('Order-summary PDF privacy, generation, sharing validation and audit tests passed.');
