import { createHash } from 'node:crypto';
import { requirePermission, PERMISSIONS } from '../authorization/permissions.js';
import { validationError } from '../errors.js';

const text = (value, max = 2000) => String(value || '').trim().slice(0, max + 1);
const forbiddenFields = ['companyId', 'requesterUserId', 'role', 'roles', 'permissions', 'emergency', 'urgent', 'priority', 'internalPriority', 'status', 'trackingStatus'];

function validate(details, items) {
  const errors = {};
  if (forbiddenFields.some(field => Object.hasOwn(details, field))) errors.authorization = 'Internal ownership, priority and workflow fields are managed by Rhomberg.';
  const application = text(details.application);
  const medium = text(details.medium, 500);
  const area = text(details.area, 120);
  const representativeId = text(details.selectedRep?.id || details.selectedRepresentativeId, 80);
  const fulfilment = text(details.fulfilment, 20);
  const deliveryAddress = text(details.deliveryAddress, 500);
  const collectionBranch = text(details.collectionBranch || details.collectionBranchId, 160);
  const notes = text(details.notes);
  if (application.length < 5 || application.length > 2000) errors.application = 'Describe the application in 5 to 2,000 characters.';
  if (area.length < 2) errors.area = 'Select the customer area.';
  if (representativeId && !/^[0-9a-f-]{36}$/i.test(representativeId)) errors.selectedRep = 'Select an eligible representative.';
  if (!['delivery', 'collect'].includes(fulfilment)) errors.fulfilment = 'Choose delivery or collection.';
  if (fulfilment === 'delivery' && deliveryAddress.length < 5) errors.deliveryAddress = 'Enter the delivery address.';
  if (fulfilment === 'collect' && collectionBranch.length < 2) errors.collectionBranch = 'Select a collection branch.';
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) errors.items = 'Add between 1 and 100 configured units.';
  const normalisedItems = Array.isArray(items) ? items.map((item, index) => {
    const quantity = Number(item.quantity);
    const productId = text(item.productId, 80);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999 || !item.configuration || typeof item.configuration !== 'object' || Array.isArray(item.configuration)) {
      errors[`items.${index}`] = 'Select a product, valid configuration and quantity between 1 and 9,999.';
    }
    if (['price', 'pricing', 'unitPrice', 'internalPricing', 'cost', 'margin'].some(field => Object.hasOwn(item, field))) {
      errors[`items.${index}.commercialData`] = 'Protected pricing fields are not accepted from the customer application.';
    }
    return { productId, quantity, configuration: item.configuration || {} };
  }) : [];
  if (Object.keys(errors).length) throw validationError(errors, 'Check the RFQ details.');
  return { application, medium, area, representativeId, fulfilment, deliveryAddress: fulfilment === 'delivery' ? deliveryAddress : null, collectionBranch: fulfilment === 'collect' ? collectionBranch : null, notes, items: normalisedItems };
}

export function createEnquiryService({ repository, storage }) {
  return {
    async list(actor) {
      if (![PERMISSIONS.VIEW_OWN_COMPANY_RFQS, PERMISSIONS.VIEW_ASSIGNED_RFQS, PERMISSIONS.VIEW_ALL_RFQS].some(permission => actor.permissions.includes(permission))) requirePermission(actor, PERMISSIONS.VIEW_OWN_COMPANY_RFQS);
      return repository.listEnquiries(actor);
    },
    async get(actor, id) { return repository.getEnquiry(actor, id); },
    async getDocument(actor, id, correlationId) {
      requirePermission(actor, PERMISSIONS.READ_DOCUMENT_METADATA);
      const document = await repository.getDocument(actor, id);
      await repository.appendAudit({ eventType: 'document.metadata_accessed', actorUserId: actor.id, actorRole: actor.role, companyId: actor.companyId, action: 'read_document_metadata', entityType: 'document', entityId: id, outcome: 'success', correlationId, details: {} });
      return document;
    },
    async create(actor, input, { idempotencyKey, correlationId, documentFile }) {
      requirePermission(actor, PERMISSIONS.CREATE_RFQ);
      if (!actor.companyId || !actor.companyIds.includes(actor.companyId)) throw validationError({ company: 'Your account is not linked to an active company.' });
      if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) throw validationError({ submission: 'A valid duplicate-protection key is required.' });
      const payload = input?.details ? input : { details: input || {}, items: input?.items || [] };
      const command = validate(payload.details || {}, payload.items || []);
      let document;
      try {
        if (documentFile) document = await storage.put(documentFile);
        const requestHash = createHash('sha256').update(JSON.stringify({ ...command, documentSha256: document?.sha256Hex || null })).digest('hex');
        const result = await repository.createEnquiry(actor, { ...command, document, idempotencyKey, requestHash, correlationId });
        if (result.idempotent && document) await storage.remove(document.storageKey).catch(() => undefined);
        return result;
      } catch (error) {
        if (document) await storage.remove(document.storageKey).catch(() => undefined);
        throw error;
      }
    },
  };
}
