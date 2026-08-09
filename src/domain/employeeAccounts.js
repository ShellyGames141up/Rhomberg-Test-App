import { USER_ROLES } from '../services/contracts.js';

export const ACCOUNT_STATUSES = Object.freeze([
  'pending_activation',
  'active',
  'temporarily_locked',
  'disabled',
  'suspended',
  'archived',
]);

export const INTERNAL_DEPARTMENTS = Object.freeze([
  'Sales',
  'Technical Support',
  'Planning',
  'Expediting',
  'Pressure Laboratory',
  'Temperature Laboratory',
  'Quality Assurance',
  'Dispatch',
  'Executive',
  'Administration',
]);

export const AUTHENTICATION_TYPES = Object.freeze([
  'password',
  'microsoft_entra_id',
  'active_directory',
  'approved_external_provider',
]);

export const ACTIVATION_METHODS = Object.freeze([
  'administrator_temporary_password',
  'verified_email_invitation',
  'identity_provider_provisioning',
]);

export const INTERNAL_ROLE_IDS = Object.freeze(
  Object.values(USER_ROLES).filter(role => role !== USER_ROLES.CUSTOMER),
);

export const EMPLOYEE_PROFILE_IMAGE_POLICY = Object.freeze({
  allowedTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  maxBytes: 2 * 1024 * 1024,
  minDimension: 96,
  maxDimension: 4096,
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,79}$/i;

export const normaliseEmployeeInput = input => {
  const firstName = String(input?.firstName || '').trim();
  const surname = String(input?.surname || '').trim();
  const displayName = String(input?.displayName || `${firstName} ${surname}`).trim();
  const email = String(input?.email || '').trim().toLowerCase();
  const username = String(input?.username || '').trim().toLowerCase();
  const roles = [...new Set([
    input?.primaryRole,
    ...(Array.isArray(input?.additionalRoles) ? input.additionalRoles : []),
    ...(Array.isArray(input?.roles) ? input.roles : []),
  ].filter(Boolean))];
  return {
    firstName,
    surname,
    displayName,
    email,
    username,
    branchId: String(input?.branchId || '').trim(),
    department: String(input?.department || '').trim(),
    roles,
    authenticationType: String(input?.authenticationType || 'password'),
    activationMethod: String(input?.activationMethod || (email ? 'verified_email_invitation' : 'administrator_temporary_password')),
    profileImage: input?.profileImage || null,
  };
};

export const validateEmployeeInput = (input, { branchIds = [] } = {}) => {
  const value = normaliseEmployeeInput(input);
  const fieldErrors = {};
  if (value.firstName.length < 2) fieldErrors.firstName = 'Enter the employee first name.';
  if (value.surname && value.surname.length < 2) fieldErrors.surname = 'Enter the full employee surname or leave it blank when IT has not supplied one.';
  if (value.displayName.length < 2) fieldErrors.displayName = 'Enter the display name.';
  if (!value.email && !value.username) fieldErrors.username = 'Enter a work email address or approved username.';
  if (value.email && !emailPattern.test(value.email)) fieldErrors.email = 'Enter a valid work email address.';
  if (value.username && !usernamePattern.test(value.username)) fieldErrors.username = 'Use 3-80 letters, numbers, dots, dashes or underscores.';
  if (!branchIds.includes(value.branchId)) fieldErrors.branchId = 'Choose an approved branch.';
  if (!INTERNAL_DEPARTMENTS.includes(value.department)) fieldErrors.department = 'Choose an approved department.';
  if (!value.roles.length || value.roles.some(role => !INTERNAL_ROLE_IDS.includes(role))) fieldErrors.roles = 'Choose at least one valid internal role.';
  if (!AUTHENTICATION_TYPES.includes(value.authenticationType)) fieldErrors.authenticationType = 'Choose a supported authentication type.';
  if (!ACTIVATION_METHODS.includes(value.activationMethod)) fieldErrors.activationMethod = 'Choose a supported activation method.';
  if (!value.email && value.activationMethod !== 'administrator_temporary_password') fieldErrors.activationMethod = 'Username-only accounts require a one-time temporary password.';
  return { value, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
};

export const validateEmployeeProfileImage = file => {
  if (!file) return { valid: true, error: '' };
  if (!EMPLOYEE_PROFILE_IMAGE_POLICY.allowedTypes.includes(file.type)) return { valid: false, error: 'Choose a JPG, PNG or WebP image.' };
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > EMPLOYEE_PROFILE_IMAGE_POLICY.maxBytes) return { valid: false, error: 'The profile image must be smaller than 2 MB.' };
  return { valid: true, error: '' };
};

export const generateTemporaryPassword = () => {
  const bytes = new Uint8Array(18);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return [...bytes].map(value => alphabet[value % alphabet.length]).join('');
};

export const hashMockCredential = async (accountId, password) => {
  const value = new TextEncoder().encode(`rhomberg-mock-v1|${accountId}|${password}`);
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', value));
    return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of value) hash = Math.imul(hash ^ byte, 16777619);
  return `mock-fnv-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
