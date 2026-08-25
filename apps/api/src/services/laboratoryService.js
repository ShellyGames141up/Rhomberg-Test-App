import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { requirePermission } from '../authorization/permissions.js';
import { validationError } from '../errors.js';

const requiredOption = value => /required|yes|sanas calibration/i.test(String(value || '')) && !/^no\b/i.test(String(value || '').trim());
const certificationType = item => requiredOption(item?.configuration?.sanas) ? 'sanas' : requiredOption(item?.configuration?.traceability) ? 'traceable' : '';

const recipientFor = (order, item) => {
  const value = item.configuration || {};
  const own = value.certificateRecipientType !== 'My Client';
  return {
    recipientType: own ? 'customer_company' : 'customer_client',
    recipientName: own ? order.company : String(value.certificateClientName || '').trim(),
    recipientAddress: own
      ? String(order.deliveryAddress || `${order.company} — authorised company account`).trim()
      : [value.certificateAddressLine1, value.certificateAddressLine2, value.certificateCity, value.certificateProvince, value.certificatePostalCode, value.certificateCountry].filter(Boolean).join(', '),
  };
};

export const laboratoryUnitsForOrder = order => {
  const persisted = new Map((order.details?.laboratory?.units || []).map(unit => [unit.id, unit]));
  return (order.items || []).flatMap((item, lineIndex) => {
    const type = certificationType(item);
    if (!type) return [];
    const quantity = Math.max(1, Math.min(999, Number(item.quantity) || 1));
    return Array.from({ length: quantity }, (_, index) => {
      const id = `lab-unit-${item.id}-${index + 1}`;
      return {
        id, orderId: order.id, orderReference: order.reference, lineItemId: item.id,
        productId: item.productId, productCode: item.code, productName: item.name,
        unitNumber: index + 1, quantityInLine: quantity, certificationType: type,
        certificateRecipientSnapshot: recipientFor(order, item), certificateId: '',
        certificateNumber: '', serialNumber: '', certificateStatus: 'pending',
        certificateVersions: [], status: 'awaiting_lab', updatedAt: order.updatedAt,
        ...(persisted.get(id) || {}),
      };
    });
  });
};

const validateEntry = (entry, { replacement = false } = {}) => {
  const errors = {};
  const certificateNumber = String(entry?.certificateNumber || '').trim();
  const issueDate = String(entry?.issueDate || '').trim();
  const serialNumber = String(entry?.serialNumber || '').trim();
  const reason = String(entry?.reason || '').trim();
  if (!certificateNumber || certificateNumber.length > 120) errors.certificateNumber = 'Enter a valid certificate number.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(new Date(`${issueDate}T00:00:00Z`).getTime())) errors.issueDate = 'Enter a valid certificate date.';
  if (!serialNumber || serialNumber.length > 160) errors.serialNumber = 'Enter the physical unit or serial number.';
  if (entry?.confirmAssociation !== true) errors.confirmAssociation = 'Confirm that the certificate belongs to this order and unit.';
  if (replacement && reason.length < 5) errors.reason = 'Record a replacement reason of at least five characters.';
  if (Object.keys(errors).length) throw validationError(errors, 'Check the certificate details.');
  return { certificateNumber, issueDate, serialNumber, reason, notes: String(entry?.notes || '').trim().slice(0, 2000) };
};

export function createLaboratoryService({ repository, storage }) {
  const save = async (actor, orderId, unitId, entry, file, correlationId, replacement = false) => {
    requirePermission(actor, 'manage_certificates');
    const metadata = validateEntry(entry, { replacement });
    if (!file || file.mediaType !== 'application/pdf' || !/\.pdf$/i.test(file.originalName || '')) throw validationError({ certificate: 'Attach a non-empty PDF certificate.' });
    const order = await repository.getOrder(actor, orderId);
    const unit = laboratoryUnitsForOrder(order).find(candidate => candidate.id === unitId);
    if (!unit) throw validationError({ unitId: 'Select a Laboratory unit from this order.' });
    if (!replacement && unit.certificateId) throw validationError({ certificate: 'This unit already has a certificate. Use controlled replacement.' });
    if (replacement && !unit.certificateId) throw validationError({ certificate: 'There is no existing certificate to replace.' });
    const stored = await storage.put(file);
    try {
      return await repository.saveLaboratoryCertificate(actor, {
        orderId, unit: { ...unit, ...metadata }, document: stored, replacement,
        correlationId, certificateId: stored.id, versionId: randomUUID(),
      });
    } catch (error) {
      await storage.remove(stored.storageKey).catch(() => undefined);
      throw error;
    }
  };
  return Object.freeze({
    async listOrders(actor) {
      requirePermission(actor, 'view_lab_queue');
      const orders = await repository.listOrders(actor);
      return orders.map(order => ({ ...order, laboratory: { ...(order.details?.laboratory || {}), units: laboratoryUnitsForOrder(order) } })).filter(order => order.laboratory.units.length);
    },
    async dashboard(actor) {
      const orders = await this.listOrders(actor);
      const units = orders.flatMap(order => order.laboratory.units);
      return { orders, metrics: { activeOrders: orders.filter(order => order.laboratory.units.some(unit => !unit.certificateId)).length, certificatesPending: units.filter(unit => !unit.certificateId).length, completedOrders: orders.filter(order => order.laboratory.units.every(unit => unit.certificateId)).length } };
    },
    upload: (actor, orderId, unitId, entry, file, correlationId) => save(actor, orderId, unitId, entry, file, correlationId, false),
    replace: (actor, orderId, unitId, entry, file, correlationId) => save(actor, orderId, unitId, entry, file, correlationId, true),
    async batch(actor, orderId, entries, files, correlationId) {
      if (!Array.isArray(entries) || !entries.length || entries.length !== files.length) throw validationError({ certificates: 'Attach one PDF for every selected unit.' });
      const results = [];
      for (let index = 0; index < entries.length; index += 1) results.push(await save(actor, orderId, entries[index].unitId, entries[index], files[index], correlationId, false));
      return results;
    },
    async archive(actor, orderId, correlationId) {
      requirePermission(actor, 'manage_certificates');
      return repository.archiveLaboratoryCertificates(actor, orderId, correlationId);
    },
    async download(actor, documentId, correlationId) {
      const document = await repository.getDocument(actor, documentId);
      const ownCompanyCustomer = actor.role === 'customer' && actor.companyIds.includes(document.company_id) && document.customer_visible;
      const internal = actor.permissions.includes('download_certificates') || actor.permissions.includes('view_all_orders');
      if (!ownCompanyCustomer && !internal) {
        const error = new Error('The certificate was not found or is outside your authorised scope.'); error.code = 'NOT_FOUND'; error.statusCode = 404; throw error;
      }
      if (ownCompanyCustomer && document.scan_status !== 'clean') {
        const error = new Error('The certificate is awaiting its required security scan.'); error.code = 'DOCUMENT_SCAN_PENDING'; error.statusCode = 423; throw error;
      }
      const buffer = await storage.get(document.storage_key);
      await repository.appendAudit({ eventType: 'document.downloaded', actorUserId: actor.id, actorRole: actor.role, companyId: document.company_id, action: 'download_certificate', entityType: 'document', entityId: document.id, outcome: 'success', correlationId, details: { kind: document.kind } });
      return { buffer, fileName: path.basename(document.original_name || 'certificate.pdf'), mediaType: document.media_type || 'application/pdf' };
    },
  });
}
