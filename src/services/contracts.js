export const USER_ROLES = Object.freeze({
  CUSTOMER: 'customer',
  SALES_REPRESENTATIVE: 'sales_representative',
  PLANNING: 'planning',
  EXPEDITOR: 'expeditor',
  DISPATCH: 'dispatch',
  BUYER: 'buyer',
  MANAGER: 'manager',
  ADMINISTRATOR: 'administrator',
});

export const RFQ_ACCEPTANCE_TYPES = Object.freeze([
  'purchase_order_received',
  'payment_confirmed',
  'written_acceptance_received',
  'account_customer_authorisation',
  'other',
]);

export const PLANNING_PRIORITY_VALUES = Object.freeze([
  'standard',
  'high',
  'urgent',
]);

export const PERMISSIONS = Object.freeze({
  ACCESS_CUSTOMER_WORKSPACE: 'access_customer_workspace',
  ACCESS_INTERNAL_WORKSPACE: 'access_internal_workspace',
  READ_CATALOGUE: 'read_catalogue',
  VIEW_OWN_COMPANY_ACCOUNT: 'view_own_company_account',
  VIEW_ALL_COMPANIES: 'view_all_companies',
  CREATE_RFQ: 'create_rfq',
  VIEW_OWN_COMPANY_RFQS: 'view_own_company_rfqs',
  VIEW_ASSIGNED_RFQS: 'view_assigned_rfqs',
  VIEW_ALL_RFQS: 'view_all_rfqs',
  ASSIGN_RFQ: 'assign_rfq',
  MARK_RFQ_UNDER_REVIEW: 'mark_rfq_under_review',
  MARK_RFQ_QUOTED: 'mark_rfq_quoted',
  ACKNOWLEDGE_QUOTATION: 'acknowledge_quotation',
  ACCEPT_CUSTOMER_ORDER: 'accept_customer_order',
  CONVERT_RFQ_TO_ORDER: 'convert_rfq_to_order',
  CANCEL_RFQ: 'cancel_rfq',
  EXPIRE_RFQ: 'expire_rfq',
  VIEW_OWN_COMPANY_ORDERS: 'view_own_company_orders',
  VIEW_ASSIGNED_ORDERS: 'view_assigned_orders',
  VIEW_PLANNING_QUEUE: 'view_planning_queue',
  ADD_PLANNING_INFORMATION: 'add_planning_information',
  SUBMIT_TO_EXPEDITING: 'submit_to_expediting',
  VIEW_EXPEDITING_QUEUE: 'view_expediting_queue',
  UPDATE_ORDER_PROGRESS: 'update_order_progress',
  MOVE_TO_DISPATCH: 'move_to_dispatch',
  VIEW_DISPATCH_QUEUE: 'view_dispatch_queue',
  CONFIRM_DELIVERY: 'confirm_delivery',
  CONFIRM_COLLECTION: 'confirm_collection',
  MANAGE_ORDER_HOLD: 'manage_order_hold',
  CANCEL_ORDER: 'cancel_order',
  VIEW_ALL_ORDERS: 'view_all_orders',
  EXPORT_ORDER_PDF: 'export_order_pdf',
  EMAIL_ORDER_SUMMARY: 'email_order_summary',
  ARCHIVE_ORDERS: 'archive_orders',
  RESTORE_ARCHIVED_ORDERS: 'restore_archived_orders',
  ADMINISTER_USERS: 'administer_users',
  OVERRIDE_WORKFLOW: 'override_workflow',
  READ_AUDIT_HISTORY: 'read_audit_history',
  MANAGE_PRODUCTS: 'manage_products',
  VIEW_REPORTS: 'view_reports',
});

const permissionList = (...values) => Object.freeze(values);

export const ROLE_PERMISSIONS = Object.freeze({
  [USER_ROLES.CUSTOMER]: permissionList(
    PERMISSIONS.ACCESS_CUSTOMER_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.VIEW_OWN_COMPANY_ACCOUNT,
    PERMISSIONS.CREATE_RFQ,
    PERMISSIONS.VIEW_OWN_COMPANY_RFQS,
    PERMISSIONS.VIEW_OWN_COMPANY_ORDERS,
    PERMISSIONS.ACKNOWLEDGE_QUOTATION,
    PERMISSIONS.CANCEL_RFQ,
  ),
  [USER_ROLES.SALES_REPRESENTATIVE]: permissionList(
    PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.VIEW_ASSIGNED_RFQS,
    PERMISSIONS.VIEW_ASSIGNED_ORDERS,
    PERMISSIONS.MARK_RFQ_UNDER_REVIEW,
    PERMISSIONS.MARK_RFQ_QUOTED,
    PERMISSIONS.ACCEPT_CUSTOMER_ORDER,
    PERMISSIONS.CONVERT_RFQ_TO_ORDER,
    PERMISSIONS.EXPORT_ORDER_PDF,
    PERMISSIONS.EMAIL_ORDER_SUMMARY,
  ),
  [USER_ROLES.PLANNING]: permissionList(
    PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.VIEW_PLANNING_QUEUE,
    PERMISSIONS.ADD_PLANNING_INFORMATION,
    PERMISSIONS.SUBMIT_TO_EXPEDITING,
    PERMISSIONS.MANAGE_ORDER_HOLD,
    PERMISSIONS.EXPORT_ORDER_PDF,
  ),
  [USER_ROLES.EXPEDITOR]: permissionList(
    PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.VIEW_EXPEDITING_QUEUE,
    PERMISSIONS.UPDATE_ORDER_PROGRESS,
    PERMISSIONS.MOVE_TO_DISPATCH,
    PERMISSIONS.MANAGE_ORDER_HOLD,
    PERMISSIONS.EXPORT_ORDER_PDF,
  ),
  [USER_ROLES.DISPATCH]: permissionList(
    PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.VIEW_DISPATCH_QUEUE,
    PERMISSIONS.CONFIRM_DELIVERY,
    PERMISSIONS.CONFIRM_COLLECTION,
    PERMISSIONS.MANAGE_ORDER_HOLD,
    PERMISSIONS.EXPORT_ORDER_PDF,
  ),
  [USER_ROLES.BUYER]: permissionList(
    PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
  ),
  [USER_ROLES.MANAGER]: permissionList(
    PERMISSIONS.ACCESS_INTERNAL_WORKSPACE,
    PERMISSIONS.READ_CATALOGUE,
    PERMISSIONS.VIEW_ALL_COMPANIES,
    PERMISSIONS.VIEW_ALL_RFQS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.ASSIGN_RFQ,
    PERMISSIONS.MARK_RFQ_UNDER_REVIEW,
    PERMISSIONS.MARK_RFQ_QUOTED,
    PERMISSIONS.ACCEPT_CUSTOMER_ORDER,
    PERMISSIONS.CONVERT_RFQ_TO_ORDER,
    PERMISSIONS.CANCEL_RFQ,
    PERMISSIONS.EXPIRE_RFQ,
    PERMISSIONS.ADD_PLANNING_INFORMATION,
    PERMISSIONS.SUBMIT_TO_EXPEDITING,
    PERMISSIONS.UPDATE_ORDER_PROGRESS,
    PERMISSIONS.MOVE_TO_DISPATCH,
    PERMISSIONS.CONFIRM_DELIVERY,
    PERMISSIONS.CONFIRM_COLLECTION,
    PERMISSIONS.MANAGE_ORDER_HOLD,
    PERMISSIONS.CANCEL_ORDER,
    PERMISSIONS.EXPORT_ORDER_PDF,
    PERMISSIONS.EMAIL_ORDER_SUMMARY,
    PERMISSIONS.OVERRIDE_WORKFLOW,
    PERMISSIONS.READ_AUDIT_HISTORY,
    PERMISSIONS.VIEW_REPORTS,
  ),
  [USER_ROLES.ADMINISTRATOR]: permissionList(...Object.values(PERMISSIONS)),
});

export const roleCan = (role, permission) => (ROLE_PERMISSIONS[role] || []).includes(permission);
export const roleCanAny = (role, permissions) => permissions.some(permission => roleCan(role, permission));
export const permissionsForRole = role => [...(ROLE_PERMISSIONS[role] || [])];
export const rolesForPermission = permission => Object.values(USER_ROLES).filter(role => roleCan(role, permission));

export const accountCan = (account, permission) => {
  if (!account) return false;
  const effectivePermissions = Array.isArray(account.permissions) ? account.permissions : ROLE_PERMISSIONS[account.role] || [];
  return effectivePermissions.includes(permission);
};

export const WORKFLOW_ACTION_PERMISSIONS = Object.freeze({
  submit_rfq: PERMISSIONS.CREATE_RFQ,
  assign_representative: PERMISSIONS.ASSIGN_RFQ,
  start_rep_review: PERMISSIONS.MARK_RFQ_UNDER_REVIEW,
  mark_quoted: PERMISSIONS.MARK_RFQ_QUOTED,
  acknowledge_quotation: PERMISSIONS.ACKNOWLEDGE_QUOTATION,
  accept_order: PERMISSIONS.ACCEPT_CUSTOMER_ORDER,
  convert_to_order: PERMISSIONS.CONVERT_RFQ_TO_ORDER,
  cancel_rfq: PERMISSIONS.CANCEL_RFQ,
  expire_rfq: PERMISSIONS.EXPIRE_RFQ,
  start_planning: PERMISSIONS.ADD_PLANNING_INFORMATION,
  complete_planning: PERMISSIONS.ADD_PLANNING_INFORMATION,
  submit_to_expediting: PERMISSIONS.SUBMIT_TO_EXPEDITING,
  start_expediting: PERMISSIONS.UPDATE_ORDER_PROGRESS,
  add_expediting_update: PERMISSIONS.UPDATE_ORDER_PROGRESS,
  complete_expediting: PERMISSIONS.MOVE_TO_DISPATCH,
  mark_ready_for_collection: PERMISSIONS.CONFIRM_COLLECTION,
  start_delivery: PERMISSIONS.CONFIRM_DELIVERY,
  confirm_delivery: PERMISSIONS.CONFIRM_DELIVERY,
  confirm_collection: PERMISSIONS.CONFIRM_COLLECTION,
  complete_delivery: PERMISSIONS.CONFIRM_DELIVERY,
  complete_collection: PERMISSIONS.CONFIRM_COLLECTION,
  place_on_hold: PERMISSIONS.MANAGE_ORDER_HOLD,
  resume_order: PERMISSIONS.MANAGE_ORDER_HOLD,
  cancel_order: PERMISSIONS.CANCEL_ORDER,
  archive_order: PERMISSIONS.ARCHIVE_ORDERS,
  override_workflow: PERMISSIONS.OVERRIDE_WORKFLOW,
});

export const WORKFLOW_PERMISSIONS = Object.freeze([...new Set(Object.values(WORKFLOW_ACTION_PERMISSIONS))]);
export const roleCanPerformWorkflow = role => roleCanAny(role, WORKFLOW_PERMISSIONS);
export const accountCanPerformWorkflow = account => WORKFLOW_PERMISSIONS.some(permission => accountCan(account, permission));

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
  return { ...safeAccount, permissions: permissionsForRole(safeAccount.role) };
};

export const friendlyServiceError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error instanceof ServiceError) return error.message;
  if (error?.name === 'AbortError') return 'The request took too long. Please check your connection and try again.';
  return fallback;
};
