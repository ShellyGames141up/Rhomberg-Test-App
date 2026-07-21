export const USER_ROLES = Object.freeze({
  CUSTOMER: 'customer',
  SALES_REPRESENTATIVE: 'sales_representative',
  EXPEDITOR: 'expeditor',
  BUYER: 'buyer',
  MANAGER: 'manager',
  ADMINISTRATOR: 'administrator',
});

export const PERMISSIONS = Object.freeze({
  READ_CATALOGUE: 'catalogue:read',
  READ_OWN_COMPANY: 'company:read:own',
  READ_ALL_COMPANIES: 'company:read:all',
  MANAGE_ACCOUNTS: 'accounts:manage',
  CREATE_ENQUIRY: 'enquiry:create',
  READ_OWN_ENQUIRIES: 'enquiry:read:own-company',
  READ_ASSIGNED_ENQUIRIES: 'enquiry:read:assigned',
  READ_ALL_ENQUIRIES: 'enquiry:read:all',
  UPDATE_TRACKING: 'tracking:update',
  READ_OWN_ORDERS: 'orders:read:own-company',
  READ_ASSIGNED_ORDERS: 'orders:read:assigned',
  READ_ALL_ORDERS: 'orders:read:all',
  MANAGE_PRODUCTS: 'products:manage',
  VIEW_REPORTS: 'reports:read',
});

export const ROLE_PERMISSIONS = Object.freeze({
  [USER_ROLES.CUSTOMER]: [
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.READ_OWN_COMPANY,
    PERMISSIONS.CREATE_ENQUIRY,
    PERMISSIONS.READ_OWN_ENQUIRIES,
    PERMISSIONS.READ_OWN_ORDERS,
  ],
  [USER_ROLES.SALES_REPRESENTATIVE]: [
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.READ_ASSIGNED_ENQUIRIES,
    PERMISSIONS.READ_ASSIGNED_ORDERS,
  ],
  [USER_ROLES.EXPEDITOR]: [
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.READ_ALL_ENQUIRIES,
    PERMISSIONS.READ_ALL_ORDERS,
    PERMISSIONS.UPDATE_TRACKING,
  ],
  [USER_ROLES.BUYER]: [
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.READ_ALL_ENQUIRIES,
    PERMISSIONS.READ_ALL_ORDERS,
  ],
  [USER_ROLES.MANAGER]: [
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.READ_ALL_COMPANIES,
    PERMISSIONS.READ_ALL_ENQUIRIES,
    PERMISSIONS.READ_ALL_ORDERS,
    PERMISSIONS.UPDATE_TRACKING,
    PERMISSIONS.VIEW_REPORTS,
  ],
  [USER_ROLES.ADMINISTRATOR]: Object.values(PERMISSIONS),
});

export const roleCan = (role, permission) => (ROLE_PERMISSIONS[role] || []).includes(permission);

export class ServiceError extends Error {
  constructor(message, { code = 'SERVICE_ERROR', status = 400, fieldErrors = {}, cause } = {}) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    if (cause) this.cause = cause;
  }
}

export const toPublicAccount = account => {
  if (!account) return null;
  const { password: _password, passwordHash: _passwordHash, ...safeAccount } = account;
  return safeAccount;
};

export const friendlyServiceError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error instanceof ServiceError) return error.message;
  if (error?.name === 'AbortError') return 'The request took too long. Please check your connection and try again.';
  return fallback;
};
