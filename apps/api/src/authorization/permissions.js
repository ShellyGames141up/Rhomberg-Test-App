export const PERMISSIONS = Object.freeze({
  CREATE_RFQ: 'create_rfq',
  VIEW_OWN_COMPANY_RFQS: 'view_own_company_rfqs',
  VIEW_ASSIGNED_RFQS: 'view_assigned_rfqs',
  VIEW_ALL_RFQS: 'view_all_rfqs',
  READ_DOCUMENT_METADATA: 'read_document_metadata',
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
