import { randomUUID } from 'node:crypto';
import { notFound } from '../errors.js';

const clone = value => structuredClone(value);

export function createMemoryRepository(seed = {}) {
  const state = {
    companies: clone(seed.companies || []),
    users: clone(seed.users || []),
    representatives: clone(seed.representatives || []),
    products: clone(seed.products || []),
    sessions: [], enquiries: [], documents: [], audits: [], notifications: [], idempotency: new Map(),
  };

  const actorForUser = user => ({
    id: user.id, username: user.username || null, email: user.email, contact: user.displayName, displayName: user.displayName,
    status: user.status, identityProvider: user.identityProvider || 'local_password',
    role: user.roles[0], roles: [...user.roles], permissions: [...user.permissions],
    companyIds: [...user.companyIds], companyId: user.companyIds[0] || null,
    company: state.companies.find(company => company.id === user.companyIds[0])?.name || '',
    representativeId: user.representativeId || null,
  });
  const canRead = (actor, record) => actor.permissions.includes('view_all_rfqs')
    || (actor.permissions.includes('view_assigned_rfqs') && record.representativeId === actor.representativeId)
    || (actor.permissions.includes('view_own_company_rfqs') && actor.companyIds.includes(record.companyId));

  return {
    _state: state,
    async health() { return true; },
    async close() {},
    async findUserByIdentifier(identifier) {
      const normalised = String(identifier || '').toLowerCase();
      return clone(state.users.find(user => String(user.username || '').toLowerCase() === normalised || String(user.email || '').toLowerCase() === normalised) || null);
    },
    async createSession(session) { state.sessions.push(clone({ ...session, revokedAt: null })); },
    async getSessionActor(tokenHash) {
      const session = state.sessions.find(item => item.tokenHash === tokenHash && !item.revokedAt && new Date(item.expiresAt) > new Date());
      if (!session) return null;
      const user = state.users.find(item => item.id === session.userId);
      if (!user || user.status !== 'active') return null;
      return { actor: actorForUser(user), session: { id: session.id, csrfTokenHash: session.csrfTokenHash, expiresAt: session.expiresAt } };
    },
    async revokeSession(tokenHash) {
      const session = state.sessions.find(item => item.tokenHash === tokenHash && !item.revokedAt);
      if (session) session.revokedAt = new Date().toISOString();
    },
    async rotateSessionCsrf(sessionId, csrfTokenHash) {
      const session = state.sessions.find(item => item.id === sessionId && !item.revokedAt);
      if (session) session.csrfTokenHash = csrfTokenHash;
    },
    async updateLastLogin(userId) {
      const user = state.users.find(item => item.id === userId);
      if (user) user.lastLoginAt = new Date().toISOString();
    },
    async appendAudit(event) { state.audits.push(clone({ id: state.audits.length + 1, ...event, createdAt: new Date().toISOString() })); },
    async getAdministrationOverview(actor) {
      if (!actor.permissions.includes('administer_users')) {
        const error = new Error('You are not authorised to perform this action.'); error.code = 'FORBIDDEN'; error.statusCode = 403; throw error;
      }
      const users = state.users.filter(user => user.roles.some(role => role !== 'customer')).map(user => ({
        id: user.id, contact: user.displayName, displayName: user.displayName, email: user.email,
        signInName: user.username, username: user.username, role: user.roles[0], roles: [...user.roles],
        permissions: [...user.permissions], company: 'Internal', category: 'internal', department: '', branchId: '',
        status: user.status, lastLoginAt: user.lastLoginAt || null, createdAt: user.createdAt || null,
        loginHistoryCount: 0, notificationPreferences: {},
      }));
      return clone({
        summary: { users: users.length, customerCompanies: 0, internalAccounts: users.length, auditEvents: state.audits.length },
        users, companies: [], representatives: [], branches: [], departments: [], accountStatuses: ['active', 'disabled', 'archived'],
        authenticationTypes: ['password'], activationMethods: ['administrator_temporary_password'], correctionRecords: [], archivedRecords: [],
        roles: [{ id: 'sales_representative', label: 'Sales representative', permissions: ['view_assigned_rfqs'] }, { id: 'manager', label: 'Manager', permissions: ['view_all_rfqs'] }],
        permissions: [], catalogue: { categories: [], products: [] }, configurations: {},
      });
    },
    async createInternalUser(actor, command) {
      if (!actor.permissions.includes('administer_users')) {
        const error = new Error('You are not authorised to perform this action.'); error.code = 'FORBIDDEN'; error.statusCode = 403; throw error;
      }
      if (command.role === 'administrator' || command.role === 'customer') {
        const error = new Error('Select an approved internal employee role.'); error.code = 'VALIDATION_ERROR'; error.statusCode = 422; throw error;
      }
      if (state.users.some(user => String(user.username || '').toLowerCase() === command.username.toLowerCase() || (command.email && user.email === command.email))) {
        const error = new Error('That sign-in name or email is already in use.'); error.code = 'CONFLICT'; error.statusCode = 409; throw error;
      }
      const createdAt = new Date().toISOString();
      state.users.push({ id: command.id, username: command.username, email: command.email, displayName: command.displayName, passwordHash: command.passwordHash, status: 'active', identityProvider: 'local_password', roles: [command.role], permissions: [], companyIds: [] });
      state.audits.push({ id: state.audits.length + 1, eventType: 'administrator.internal_user_created', actorUserId: actor.id, actorRole: actor.role, companyId: null, action: 'create_internal_user', entityType: 'user', entityId: command.id, outcome: 'success', correlationId: command.correlationId, details: { role: command.role }, createdAt });
      return clone({ id: command.id, username: command.username, email: command.email, displayName: command.displayName, role: command.role, status: 'active', createdAt });
    },
    async listEnquiries(actor) { return clone(state.enquiries.filter(item => canRead(actor, item))); },
    async getEnquiry(actor, id) {
      const enquiry = state.enquiries.find(item => item.id === id);
      if (!enquiry || !canRead(actor, enquiry)) throw notFound('The RFQ was not found or is outside your authorised company account.');
      return clone(enquiry);
    },
    async getDocument(actor, id) {
      const document = state.documents.find(item => item.id === id && actor.companyIds.includes(item.companyId));
      if (!document) throw notFound('The document was not found or is outside your authorised company account.');
      return clone(document);
    },
    async createEnquiry(actor, command) {
      const key = `${actor.id}:create_enquiry:${command.idempotencyKey}`;
      const replay = state.idempotency.get(key);
      if (replay) {
        if (replay.requestHash !== command.requestHash) {
          const error = new Error('This idempotency key was already used for different RFQ details.'); error.code = 'IDEMPOTENCY_CONFLICT'; error.statusCode = 409; throw error;
        }
        return clone({ ...replay.result, idempotent: true });
      }
      const representative = state.representatives.find(item => item.id === command.representativeId && item.companyIds.includes(actor.companyId));
      if (!representative) throw notFound('The selected representative is not assigned to this company.');
      const productMap = new Map(state.products.filter(product => product.active !== false).map(product => [product.id, product]));
      if (command.items.some(item => !productMap.has(item.productId))) {
        const error = new Error('One or more selected products are unavailable.'); error.code = 'INVALID_PRODUCT'; error.statusCode = 422; throw error;
      }
      const now = new Date().toISOString();
      const id = randomUUID();
      const reference = `RQ-2099-${String(state.enquiries.length + 1).padStart(6, '0')}`;
      const enquiry = {
        id, reference, companyId: actor.companyId, company: actor.company, contact: actor.contact,
        selectedRep: { id: representative.id, name: representative.displayName, branchName: representative.branchName },
        representativeId: representative.id, application: command.application, medium: command.medium, area: command.area,
        fulfilment: command.fulfilment, deliveryAddress: command.deliveryAddress || '', collectionBranch: command.collectionBranch || '',
        notes: command.notes || '', workflowType: 'rfq', trackingStatus: 'assigned_to_rep', status: 'Assigned to representative',
        priority: 'standard', version: 1,
        items: command.items.map(item => {
          const product = productMap.get(item.productId);
          return { id: randomUUID(), productId: product.id, product: { id: product.id, code: product.code, name: product.name }, quantity: item.quantity, configuration: clone(item.configuration) };
        }),
        documents: command.document ? [{ id: command.document.id, documentType: 'purchase_order', fileName: command.document.originalName, mimeType: command.document.mediaType, sizeBytes: command.document.sizeBytes, scanStatus: 'pending', customerVisible: false, uploadedAt: now }] : [],
        allowedWorkflowActions: [], trackingHistory: [], submittedAt: now, createdAt: now, updatedAt: now,
      };
      state.enquiries.push(enquiry);
      if (command.document) state.documents.push({ ...clone(command.document), companyId: actor.companyId, rfqId: id, kind: 'purchase_order', scanStatus: 'pending', customerVisible: false, createdAt: now });
      if (command.document) state.audits.push({ id: state.audits.length + 1, eventType: 'document.metadata_created', actorUserId: actor.id, actorRole: actor.role, companyId: actor.companyId, action: 'create_document_metadata', entityType: 'document', entityId: command.document.id, outcome: 'success', correlationId: command.correlationId, details: { kind: 'purchase_order', sizeBytes: command.document.sizeBytes }, createdAt: now });
      state.audits.push({ id: state.audits.length + 1, eventType: 'rfq.created', actorUserId: actor.id, actorRole: actor.role, companyId: actor.companyId, action: 'create_rfq', entityType: 'rfq', entityId: id, outcome: 'success', correlationId: command.correlationId, details: { itemCount: command.items.length, documentCount: command.document ? 1 : 0 }, createdAt: now });
      if (representative.userId) state.notifications.push({ id: randomUUID(), companyId: actor.companyId, recipientUserId: representative.userId, rfqId: id, eventType: 'rfq_assigned', title: 'New RFQ assigned', message: `${reference} is ready for review.`, customerVisible: false, createdAt: now });
      const result = { enquiry, delivery: { ok: true, deliveryMode: 'in_app', message: 'Your RFQ was submitted and assigned.' } };
      state.idempotency.set(key, { requestHash: command.requestHash, result: clone(result) });
      return clone(result);
    },
  };
}
