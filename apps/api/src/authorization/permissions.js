export const PERMISSIONS = Object.freeze({
  CREATE_RFQ: 'create_rfq',
  VIEW_OWN_COMPANY_RFQS: 'view_own_company_rfqs',
  VIEW_ASSIGNED_RFQS: 'view_assigned_rfqs',
  VIEW_ALL_RFQS: 'view_all_rfqs',
  READ_DOCUMENT_METADATA: 'read_document_metadata',
  ADMINISTER_USERS: 'administer_users',
  VIEW_ALL_ORDERS: 'view_all_orders',
  VIEW_OWN_COMPANY_ORDERS: 'view_own_company_orders',
  VIEW_ASSIGNED_ORDERS: 'view_assigned_orders',
  LOAD_CUSTOMER_ORDER: 'load_customer_order',
  VIEW_TECHNICAL_QUEUE: 'view_technical_queue',
  MANAGE_LOCATION_SETTINGS: 'manage_location_settings',
  MANAGE_RETENTION_POLICY: 'manage_retention_policy',
  READ_AUDIT_HISTORY: 'read_audit_history',
  RETRY_NOTIFICATION_DELIVERY: 'retry_notification_delivery',
});

export function hasPermission(actor, permission) {
  return Array.isArray(actor?.permissions) && actor.permissions.includes(permission);
}

export function requirePermission(actor, permission) {
  if (!hasPermission(actor, permission)) {
    const error = new Error('You are not authorised to perform this action.');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
}

export function scopeForActor(actor) {
  return {
    userId: actor.id,
    companyIds: [...(actor.companyIds || [])],
    representativeId: actor.representativeId || null,
    permissions: [...(actor.permissions || [])],
  };
}
