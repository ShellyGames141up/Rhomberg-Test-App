import { validationError } from '../errors.js';

export function validateQuotation(input = {}) {
  const errors = {};
  const text = (key, max) => {
    if (input[key] !== undefined && typeof input[key] !== 'string') errors[key] = 'Enter text.';
    const value = String(input[key] || '').trim();
    if (value.length > max) errors[key] = 'The value is too long.';
    return value;
  };
  const number = text('number', 80);
  const date = text('date', 10);
  const expiryDate = text('expiryDate', 10);
  const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!number) errors.quotationNumber = 'Enter the quotation number.';
  if (!dateOnly(date) || date > new Date().toISOString().slice(0, 10)) errors.quotationDate = 'Enter a valid quotation date, not in the future.';
  if (input.expiryMode !== undefined && !['dated', 'not_applicable'].includes(input.expiryMode)) errors.quotationExpiryMode = 'Choose an expiry mode.';
  if (input.expiryMode === 'dated' && (!dateOnly(expiryDate) || expiryDate < date)) errors.quotationExpiryDate = 'Enter a valid expiry date after the quotation date.';
  const total = input.commercialTotal == null ? null : Number(input.commercialTotal);
  if (total !== null && (!Number.isFinite(total) || total <= 0 || total > 999999999.99)) errors.quotationCommercialTotal = 'Enter a valid positive quotation total below ZAR 1 billion.';
  const result = {
    number, date, expiryMode: input.expiryMode || 'not_applicable', expiryDate: input.expiryMode === 'dated' ? expiryDate : '',
    internalNote: text('internalNote', 2000), customerNote: text('customerNote', 1000),
    emailed: input.emailed === true, documentReference: text('documentReference', 240),
    documentCustomerVisible: input.documentCustomerVisible === true,
    commercialTotal: total === null ? null : Math.round(total * 100) / 100,
    currency: total === null ? '' : 'ZAR',
    // Saving this confirmation is an explicit representative verification, not trust in PDF extraction.
    extractionStatus: total === null ? 'not_recorded' : 'manually_verified',
  };
  if (Object.keys(errors).length) throw validationError(errors);
  return result;
}

export function quotationProjection(quotation, actor) {
  if (!quotation) return undefined;
  const customer = actor?.role === 'customer';
  const documentVisible = !customer || quotation.documentCustomerVisible === true;
  return {
    number: quotation.number, date: quotation.date, expiryMode: quotation.expiryMode,
    expiryDate: quotation.expiryDate, emailed: quotation.emailed, customerNote: quotation.customerNote || '',
    recordedAt: quotation.recordedAt, documentCustomerVisible: quotation.documentCustomerVisible === true,
    ...(documentVisible ? { documentReference: quotation.documentReference || '', document: quotation.document } : {}),
    ...(!customer ? { internalNote: quotation.internalNote || '', recordedBy: quotation.recordedBy } : {}),
  };
}
