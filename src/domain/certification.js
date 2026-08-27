import { ServiceError } from '../services/contracts.js';
import { createLaboratoryWorkflow } from './laboratoryCalibration.js';

export const CERTIFICATION_TYPES = Object.freeze({
  SANAS: 'sanas',
  TRACEABLE: 'traceable',
});

export const LAB_UNIT_STATUSES = Object.freeze([
  'awaiting_lab',
  'received',
  'calibration_in_progress',
  'calibration_on_hold',
  'calibration_completed',
  'certificate_pending',
  'certificate_uploaded',
  'released',
]);

export const CERTIFICATE_STATUSES = Object.freeze([
  'not_required',
  'pending',
  'uploaded',
  'verified',
  'archived',
]);

export const MAX_CERTIFICATE_BYTES = 12 * 1024 * 1024;
export const CERTIFICATE_MIME_TYPES = Object.freeze(['application/pdf']);

const requiredOption = value => /required|yes|sanas calibration/i.test(String(value || ''))
  && !/^no\b/i.test(String(value || '').trim());

export const certificationTypeForItem = item => {
  const configuration = item?.configuration || {};
  if (requiredOption(configuration.sanas)) return CERTIFICATION_TYPES.SANAS;
  if (requiredOption(configuration.traceability)) return CERTIFICATION_TYPES.TRACEABLE;
  return '';
};

export const orderRequiresLaboratory = order => (order?.items || []).some(item => Boolean(certificationTypeForItem(item)));

export const orderCertificationTypes = order => [...new Set(
  (order?.items || []).map(certificationTypeForItem).filter(Boolean),
)];

export const createCalibrationUnits = order => {
  const existingByKey = new Map((order?.laboratory?.units || []).map(unit => [
    `${unit.lineItemId}:${unit.unitNumber}`,
    unit,
  ]));
  return (order?.items || []).flatMap((item, lineIndex) => {
    const certificationType = certificationTypeForItem(item);
    if (!certificationType) return [];
    const quantity = Math.max(1, Math.min(999, Number(item.quantity) || 1));
    return Array.from({ length: quantity }, (_, index) => {
      const unitNumber = index + 1;
      const lineItemId = item.lineId || item.id || `line-${lineIndex + 1}`;
      const existing = existingByKey.get(`${lineItemId}:${unitNumber}`);
      const config = item.configuration || {};
      const recipient = item.certificateRecipientSnapshot || item.unitState?.certificateRecipientSnapshot || {
        recipientType: config.certificateRecipientType === 'My Client' ? 'customer_client' : 'customer_company',
        recipientName: config.certificateRecipientType === 'My Client' ? config.certificateClientName : order.company,
        recipientAddress: config.certificateRecipientType === 'My Client' ? [config.certificateAddressLine1, config.certificateAddressLine2, config.certificateCity, config.certificateProvince, config.certificatePostalCode, config.certificateCountry].filter(Boolean).join(', ') : (order.companySnapshot?.certificateAddress || order.deliveryAddress || ''),
        source: config.certificateRecipientType === 'My Client' ? 'configured_unit' : 'legacy_authorised_company_account',
        createdAt: order.createdAt || '', createdBy: order.submittingCustomerId || order.accountId || '',
      };
      const created = {
        id: `lab-unit-${order.id}-${lineIndex + 1}-${unitNumber}`,
        orderId: order.id,
        orderReference: order.reference,
        lineItemId,
        productId: item.productId || '',
        productCode: item.code || '',
        productName: item.name || item.code || 'Instrument',
        unitNumber,
        quantityInLine: quantity,
        certificationType,
        certificateRecipientSnapshot: recipient,
        status: 'awaiting_lab',
        certificateStatus: 'pending',
        certificateId: '',
        certificateNumber: '',
        serialNumber: '',
        calibrationResult: '',
        customerVisibleMessage: '',
        internalNote: '',
        receivedAt: '',
        startedAt: '',
        completedAt: '',
        releasedAt: '',
        updatedAt: order.updatedAt || order.createdAt || '',
      };
      const unit = { ...created, ...(existing || {}) };
      return { ...unit, labWork: createLaboratoryWorkflow(unit.labWork || unit) };
    });
  });
};

export const ensureLaboratoryRecord = order => {
  if (!orderRequiresLaboratory(order)) return order;
  const certificationTypes = orderCertificationTypes(order);
  return {
    ...order,
    routing: {
      ...(order.routing || {}),
      requiresLaboratory: true,
      certificationTypes,
      qaRequired: false,
      route: 'planning_lab_dispatch',
    },
    laboratory: {
      status: order.laboratory?.status || 'awaiting_lab',
      branchId: order.laboratory?.branchId || order.planning?.laboratoryBranchId || '',
      receivedAt: order.laboratory?.receivedAt || '',
      receivedBy: order.laboratory?.receivedBy || null,
      releasedAt: order.laboratory?.releasedAt || '',
      releasedBy: order.laboratory?.releasedBy || null,
      releaseNote: order.laboratory?.releaseNote || '',
      currentMessage: order.laboratory?.currentMessage || '',
      units: createCalibrationUnits(order),
      receipts: [...(order.laboratory?.receipts || [])],
      updates: [...(order.laboratory?.updates || [])],
      lastUpdatedAt: order.laboratory?.lastUpdatedAt || order.updatedAt || order.createdAt || '',
    },
  };
};

export const certificateQueueForOrders = orders => (orders || [])
  .filter(orderRequiresLaboratory)
  .flatMap(order => createCalibrationUnits(order).map(unit => ({
    ...unit,
    companyId: order.companyId,
    company: order.company,
    customerContact: order.contact,
    representativeId: order.representativeId || order.selectedRep?.id || '',
    representativeName: order.selectedRep?.name || '',
    internalJobNumber: order.internalJobNumber || order.planning?.internalJobNumber || '',
    orderStatus: order.trackingStatus,
  })))
  .sort((left, right) => String(left.updatedAt).localeCompare(String(right.updatedAt)));

export const laboratoryMetrics = orders => {
  const laboratoryOrders = (orders || []).filter(orderRequiresLaboratory);
  const units = certificateQueueForOrders(laboratoryOrders);
  return {
    awaitingReceipt: laboratoryOrders.filter(order => order.trackingStatus === 'awaiting_lab').length,
    activeOrders: laboratoryOrders.filter(order => ['lab_received', 'calibration_in_progress', 'calibration_on_hold'].includes(order.trackingStatus)).length,
    unitsInProgress: units.filter(unit => unit.status === 'calibration_in_progress').length,
    certificatesPending: units.filter(unit => !['uploaded', 'verified', 'archived'].includes(unit.certificateStatus)).length,
    readyForRelease: laboratoryOrders.filter(order => order.trackingStatus === 'awaiting_lab_release').length,
    releasedThisMonth: laboratoryOrders.filter(order => {
      const released = String(order.laboratory?.releasedAt || '');
      return released && released.slice(0, 7) === new Date().toISOString().slice(0, 7);
    }).length,
    sanasUnits: units.filter(unit => unit.certificationType === CERTIFICATION_TYPES.SANAS).length,
    traceableUnits: units.filter(unit => unit.certificationType === CERTIFICATION_TYPES.TRACEABLE).length,
  };
};

const averageHours = pairs => {
  const hours = pairs.map(([start, end]) => {
    const from = new Date(start || '');
    const to = new Date(end || '');
    return Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from
      ? null
      : (to - from) / 3_600_000;
  }).filter(value => value !== null);
  return hours.length
    ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10
    : 0;
};

export const laboratoryMonthlyTracker = (orders = [], period = '') => {
  const month = String(period || '').slice(0, 7);
  const laboratoryOrders = orders.filter(orderRequiresLaboratory);
  const units = certificateQueueForOrders(laboratoryOrders);
  const matches = value => !month || String(value || '').slice(0, 7) === month;
  const completedUnits = units.filter(unit => matches(unit.completedAt));
  const uploadedUnits = units.filter(unit => unit.certificateId && matches(unit.certificateUploadedAt || unit.certificate?.uploadedAt));
  const releasedOrders = laboratoryOrders.filter(order => matches(order.laboratory?.releasedAt));
  return {
    period: month,
    sanasOrdersProcessed: releasedOrders.filter(order => orderCertificationTypes(order).includes(CERTIFICATION_TYPES.SANAS)).length,
    traceableOrdersProcessed: releasedOrders.filter(order => orderCertificationTypes(order).includes(CERTIFICATION_TYPES.TRACEABLE)).length,
    sanasUnitsProcessed: completedUnits.filter(unit => unit.certificationType === CERTIFICATION_TYPES.SANAS).length,
    traceableUnitsProcessed: completedUnits.filter(unit => unit.certificationType === CERTIFICATION_TYPES.TRACEABLE).length,
    sanasCertificatesUploaded: uploadedUnits.filter(unit => unit.certificationType === CERTIFICATION_TYPES.SANAS).length,
    traceableCertificatesUploaded: uploadedUnits.filter(unit => unit.certificationType === CERTIFICATION_TYPES.TRACEABLE).length,
    certificatesPending: units.filter(unit => !['uploaded', 'verified', 'archived'].includes(unit.certificateStatus)).length,
    averageTurnaroundHours: averageHours(releasedOrders.map(order => [order.laboratory?.receivedAt, order.laboratory?.releasedAt])),
    averageCertificateUploadHours: averageHours(uploadedUnits.map(unit => [unit.completedAt, unit.certificateUploadedAt || unit.certificate?.uploadedAt])),
    urgentOrdersCompleted: releasedOrders.filter(order => order.emergency === 'yes' || order.priority === 'urgent').length,
    outstandingOrders: laboratoryOrders.filter(order => !order.laboratory?.releasedAt).length,
  };
};

const cleanText = (value, max, field, label) => {
  const text = String(value || '').trim();
  if (text.length > max) {
    throw new ServiceError(`Keep ${label} below ${max.toLocaleString()} characters.`, {
      code: 'LAB_INPUT_INVALID',
      status: 422,
      fieldErrors: { [field]: `Keep ${label} below ${max.toLocaleString()} characters.` },
    });
  }
  return text;
};

export const validateLaboratoryUnitUpdate = (input = {}, { requireResult = false } = {}) => {
  const calibrationResult = cleanText(input.calibrationResult, 1000, 'calibrationResult', 'the calibration result');
  const customerMessage = cleanText(input.customerMessage, 1000, 'customerMessage', 'the customer message');
  const internalNote = cleanText(input.internalNote, 2000, 'internalNote', 'the internal note');
  const serialNumber = cleanText(input.serialNumber, 120, 'serialNumber', 'the serial number');
  if (requireResult && calibrationResult.length < 3) {
    throw new ServiceError('Record the calibration result before completing this unit.', {
      code: 'LAB_RESULT_REQUIRED',
      status: 422,
      fieldErrors: { calibrationResult: 'Record the result for this physical unit.' },
    });
  }
  return { calibrationResult, customerMessage, internalNote, serialNumber };
};

export const validateCertificateUpload = (input = {}, existingCertificates = []) => {
  const file = input.file || null;
  const certificateNumber = cleanText(input.certificateNumber, 120, 'certificateNumber', 'the certificate number');
  if (certificateNumber.length < 2) {
    throw new ServiceError('Enter the certificate number.', {
      code: 'CERTIFICATE_NUMBER_REQUIRED',
      status: 422,
      fieldErrors: { certificateNumber: 'Enter the certificate number shown on the PDF.' },
    });
  }
  if (!file || !CERTIFICATE_MIME_TYPES.includes(String(file.type || input.mimeType || '').toLowerCase())) {
    throw new ServiceError('Choose a PDF certificate.', {
      code: 'CERTIFICATE_FILE_INVALID',
      status: 422,
      fieldErrors: { certificateFile: 'Only PDF certificate files are accepted.' },
    });
  }
  const sizeBytes = Number(file.size || input.sizeBytes || 0);
  if (!sizeBytes || sizeBytes > MAX_CERTIFICATE_BYTES) {
    throw new ServiceError('The certificate PDF must be smaller than 12 MB.', {
      code: 'CERTIFICATE_FILE_TOO_LARGE',
      status: 422,
      fieldErrors: { certificateFile: 'Choose a PDF smaller than 12 MB.' },
    });
  }
  const issueDate = String(input.issueDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(new Date(`${issueDate}T00:00:00Z`).getTime())) {
    throw new ServiceError('Enter the certificate issue date.', {
      code: 'CERTIFICATE_DATE_REQUIRED',
      status: 422,
      fieldErrors: { issueDate: 'Choose the date printed on the certificate.' },
    });
  }
  if ((existingCertificates || []).some(certificate => (
    certificate.certificateNumber?.toLowerCase() === certificateNumber.toLowerCase()
    && certificate.id !== input.id
  ))) {
    throw new ServiceError('That certificate number is already assigned to another unit.', {
      code: 'DUPLICATE_CERTIFICATE_NUMBER',
      status: 409,
      fieldErrors: { certificateNumber: 'Use the unique number printed on this unit certificate.' },
    });
  }
  return {
    certificateNumber,
    fileName: String(file.name || input.fileName || 'certificate.pdf').slice(0, 240),
    mimeType: 'application/pdf',
    sizeBytes,
    issueDate,
    notes: cleanText(input.notes, 1000, 'certificateNotes', 'the certificate note'),
  };
};

export const allRequiredCertificatesPresent = order => {
  const units = createCalibrationUnits(order);
  return units.length > 0 && units.every(unit => ['uploaded', 'verified', 'archived'].includes(unit.certificateStatus));
};

export const allLaboratoryUnitsCalibrated = order => {
  const units = createCalibrationUnits(order);
  return units.length > 0 && units.every(unit => (
    ['calibration_completed', 'certificate_uploaded', 'released'].includes(unit.status)
    || Boolean(unit.completedAt)
  ));
};

export const laboratorySearchText = order => [
  order.reference,
  order.sourceRfqReference,
  order.internalJobNumber,
  order.customerPoNumber,
  order.company,
  order.contact,
  order.selectedRep?.name,
  ...(order.items || []).flatMap(item => [item.code, item.name]),
].filter(Boolean).join(' ').toLowerCase();
