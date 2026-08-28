import { ServiceError } from '../services/contracts.js';

export const LABORATORY_LAUNCH = Object.freeze({
  technicianWorkflowEnabled: false,
  certificateUploadOnly: true,
});

export const LAB_MANAGER_DISCIPLINES = Object.freeze({
  laboratory_manager_pressure: ['sanas'],
  // Temperature now supports SANAS; retain historical Traceable certificates.
  laboratory_manager_temperature: ['sanas', 'traceable'],
});

export const certificateRecipientSnapshot = (line, account, createdAt = new Date().toISOString()) => {
  const configuration = line?.configuration || {};
  if (!configuration.certificateRecipientType) return null;
  const ownCompany = configuration.certificateRecipientType === 'My Company';
  const address = ownCompany
    ? String(account?.certificateAddress || account?.address || (account?.area ? `${account.area} — approved account address` : '')).trim()
    : [configuration.certificateAddressLine1, configuration.certificateAddressLine2, configuration.certificateCity, configuration.certificateProvince, configuration.certificatePostalCode, configuration.certificateCountry].filter(Boolean).join(', ');
  const name = ownCompany ? String(account?.company || '').trim() : String(configuration.certificateClientName || '').trim();
  if (!name || !address) {
    throw new ServiceError(ownCompany
      ? 'Your company needs an approved certificate address before this RFQ can be submitted.'
      : 'Complete the certificate customer name and address.', {
      code: 'CERTIFICATE_RECIPIENT_REQUIRED', status: 422,
      fieldErrors: { certificateRecipientType: 'Complete and review the certificate recipient.' },
    });
  }
  return Object.freeze({
    recipientType: ownCompany ? 'customer_company' : 'customer_client',
    recipientName: name,
    recipientAddress: address,
    contactPerson: ownCompany ? account?.contact || '' : configuration.certificateContact || '',
    customerReference: configuration.certificateCustomerReference || '',
    source: ownCompany ? 'authorised_company_account' : 'configured_unit',
    createdAt,
    createdBy: account?.id || '',
  });
};

export const snapshotCertificateRecipients = (lines, account, createdAt) => (lines || []).map(line => ({
  ...line,
  certificateRecipientSnapshot: certificateRecipientSnapshot(line, account, createdAt),
}));

export const laboratoryManagerCanHandle = (account, certificationType) => {
  const roles = new Set([account?.role, ...(account?.labRoles || [])]);
  if (roles.has('laboratory_manager') && !roles.has('laboratory_manager_pressure') && !roles.has('laboratory_manager_temperature')) return true;
  return [...roles].some(role => (LAB_MANAGER_DISCIPLINES[role] || []).includes(certificationType));
};
