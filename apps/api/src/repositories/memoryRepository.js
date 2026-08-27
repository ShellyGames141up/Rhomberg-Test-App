import { randomUUID, createHash } from 'node:crypto';
import { applyDispatchAction, dispatchProjection, DISPATCH_ACTIONS } from '../domain/dispatchWorkflow.js';
import { notFound } from '../errors.js';

const clone = value => structuredClone(value);

export function createMemoryRepository(seed = {}) {
  const state = {
    companies: clone(seed.companies || []),
    users: clone(seed.users || []),
    representatives: clone(seed.representatives || []),
    products: clone(seed.products || []),
    sessions: [], enquiries: [], orders: clone(seed.orders || []), documents: [], audits: [], notifications: [],
    settings: new Map(), notificationPreferences: new Map(), drafts: new Map(), policies: new Map(),
    locations: clone(seed.locations || []), technicalRequests: clone(seed.technicalRequests || []), appointments: clone(seed.appointments || []), catalogueOverrides: new Map(), profileImages: new Map(), idempotency: new Map(),
  };

  // Explicit test-fixture role definitions; never used by the production API.
  const roleDefaults = roles => [...new Set(roles.flatMap(role => seed.rolePermissions?.[role] || []))];
  const refreshPermissions = user => {
    user.rolePermissions = roleDefaults(user.roles);
    user.permissions = [...new Set([...user.rolePermissions, ...(user.additionalPermissions || [])])].filter(code => !(user.deniedPermissions || []).includes(code));
  };
  const actorForUser = user => ({
    id: user.id, username: user.username || null, email: user.email, contact: user.displayName, displayName: user.displayName,
    status: user.status, identityProvider: user.identityProvider || 'local_password',
    forcePasswordChange: Boolean(user.mustChangePassword),
    role: user.roles[0], roles: [...user.roles], permissions: [...user.permissions],
    companyIds: [...user.companyIds], companyId: user.companyIds[0] || null,
    company: state.companies.find(company => company.id === user.companyIds[0])?.name || '',
    representativeId: user.representativeId || null,
  });
  const canRead = (actor, record) => actor.permissions.includes('view_all_rfqs')
    || (actor.permissions.includes('view_assigned_rfqs') && record.representativeId === actor.representativeId)
    || (actor.permissions.includes('view_own_company_rfqs') && actor.companyIds.includes(record.companyId));
  const canReadOrder = (actor, record) => actor.permissions.includes('view_all_orders')
    || ['view_planning_queue','view_expediting_queue','view_lab_queue','view_qa_queue','view_dispatch_queue'].some(permission => actor.permissions.includes(permission))
    || actor.companyIds.includes(record.companyId)
    || record.representativeId === actor.representativeId;

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
      const actor=actorForUser(user); if(session.selectedRole&&actor.roles.includes(session.selectedRole))actor.role=session.selectedRole;
      return { actor, session: { id: session.id, csrfTokenHash: session.csrfTokenHash, expiresAt: session.expiresAt } };
    },
    async revokeSession(tokenHash) {
      const session = state.sessions.find(item => item.tokenHash === tokenHash && !item.revokedAt);
      if (session) session.revokedAt = new Date().toISOString();
    },
    async rotateSessionCsrf(sessionId, csrfTokenHash) {
      const session = state.sessions.find(item => item.id === sessionId && !item.revokedAt);
      if (session) session.csrfTokenHash = csrfTokenHash;
    },
    async setSessionRole(actor,sessionId,role){if(!actor.roles.includes(role)){const error=new Error('That workspace is not assigned to this account.');error.code='FORBIDDEN';error.statusCode=403;throw error;}const session=state.sessions.find(item=>item.id===sessionId&&!item.revokedAt);if(session)session.selectedRole=role;return clone({...actor,role});},
    async updateLastLogin(userId) {
      const user = state.users.find(item => item.id === userId);
      if (user) user.lastLoginAt = new Date().toISOString();
    },
    async changeOwnPassword(actor, passwordHash, correlationId) {
      const user = state.users.find(item => item.id === actor.id);
      if (!user) throw notFound('The account was not found.');
      user.passwordHash = passwordHash;
      user.mustChangePassword = false;
      state.sessions.filter(session => session.userId === actor.id && !session.revokedAt).forEach(session => { session.revokedAt = new Date().toISOString(); });
      state.audits.push(clone({
        id: state.audits.length + 1,
        eventType: 'authentication.password_changed', actorUserId: actor.id, actorRole: actor.role,
        companyId: actor.companyId || null, action: 'change_password', entityType: 'user', entityId: actor.id,
        outcome: 'success', correlationId, details: { sessionsRevoked: true, firstLoginCompleted: true }, createdAt: new Date().toISOString(),
      }));
    },
    async appendAudit(event) { state.audits.push(clone({ id: state.audits.length + 1, ...event, createdAt: new Date().toISOString() })); },
    async getAdministrationOverview(actor) {
      if (!actor.permissions.includes('administer_users')) {
        const error = new Error('You are not authorised to perform this action.'); error.code = 'FORBIDDEN'; error.statusCode = 403; throw error;
      }
      const users = state.users.filter(user => !user.deletedAt && user.roles.some(role => role !== 'customer')).map(user => ({
        id: user.id, contact: user.displayName, displayName: user.displayName, email: user.email,
        signInName: user.username, username: user.username, role: user.roles[0], roles: [...user.roles],
        permissions: [...user.permissions], rolePermissions: roleDefaults(user.roles), additionalPermissions: user.additionalPermissions || [], deniedPermissions: user.deniedPermissions || [], company: 'Internal', category: 'internal', department: '', branchId: '',
        status: user.status, lastLoginAt: user.lastLoginAt || null, createdAt: user.createdAt || null,
        loginHistoryCount: 0, notificationPreferences: {},
      }));
      return clone({
        summary: { users: users.length, customerCompanies: 0, internalAccounts: users.length, auditEvents: state.audits.length },
        users, companies: [], representatives: [], branches: [], departments: [], accountStatuses: ['active', 'disabled', 'archived'],
        authenticationTypes: ['password'], activationMethods: ['administrator_temporary_password'], correctionRecords: [], archivedRecords: [],
        roles: Object.entries(seed.rolePermissions || {}).map(([id, permissions]) => ({ id, label: id, permissions })),
        permissions: [...new Set(Object.values(seed.rolePermissions || {}).flat())], catalogue: { categories: [], products: [] }, configurations: {},
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
      state.users.push({ id: command.id, username: command.username, email: command.email, displayName: command.displayName, passwordHash: command.passwordHash, mustChangePassword: true, status: 'active', identityProvider: 'local_password', roles: [...new Set([command.role, ...(command.additionalRoles || [])])], permissions: roleDefaults([command.role, ...(command.additionalRoles || [])]), companyIds: [] });
      state.audits.push({ id: state.audits.length + 1, eventType: 'administrator.internal_user_created', actorUserId: actor.id, actorRole: actor.role, companyId: null, action: 'create_internal_user', entityType: 'user', entityId: command.id, outcome: 'success', correlationId: command.correlationId, details: { role: command.role }, createdAt });
      return clone({ id: command.id, username: command.username, email: command.email, displayName: command.displayName, role: command.role, status: 'active', createdAt });
    },
    async createCustomerAccount(actor, command) {
      if (!actor.permissions.includes('administer_users')) { const error=new Error('You are not authorised to perform this action.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      if (state.users.some(user => user.email === command.email)) { const error=new Error('That company account or email already exists.'); error.code='CONFLICT'; error.statusCode=409; throw error; }
      state.companies.push({ id: command.companyId, name: command.companyName, area: command.area, industry: command.industry, branchId: command.branchId, status: 'active' });
      state.users.push({ id: command.userId, email: command.email, displayName: command.contactName, passwordHash: command.passwordHash, mustChangePassword: true, phone: command.phone, status: 'active', identityProvider: 'local_password', roles: ['customer'], permissions: ['access_customer_workspace','read_catalogue','view_own_company_account','create_rfq','view_own_company_rfqs','view_own_company_orders'], companyIds: [command.companyId] });
      if (command.representativeId) state.representatives.find(rep => rep.id === command.representativeId)?.companyIds.push(command.companyId);
      state.audits.push({ id: state.audits.length+1,eventType:'administrator.customer_account_created',actorUserId:actor.id,actorRole:actor.role,companyId:command.companyId,action:'create_customer_account',entityType:'company',entityId:command.companyId,outcome:'success',correlationId:command.correlationId,details:{ customerUserId:command.userId },createdAt:new Date().toISOString() });
      return clone({ company: { id:command.companyId,name:command.companyName,area:command.area,industry:command.industry,branchId:command.branchId,representativeId:command.representativeId||'',status:'active' }, account:{ id:command.userId,contact:command.contactName,email:command.email,role:'customer',roles:['customer'],companyId:command.companyId,company:command.companyName,status:'active' } });
    },
    async registerCustomerAccount(command) {
      const duplicate = state.users.some(user => String(user.email || '').toLowerCase() === command.email)
        || state.companies.some(company => String(company.name || '').trim().toLowerCase() === command.companyName.toLowerCase());
      if (duplicate) { const error=new Error('That company account or email already exists.'); error.code='CONFLICT'; error.statusCode=409; throw error; }
      const createdAt = new Date().toISOString();
      state.companies.push({ id:command.companyId,name:command.companyName,area:command.area,industry:command.industry,branchId:command.branchId,status:'active',createdAt,updatedAt:createdAt });
      state.users.push({ id:command.userId,email:command.email,displayName:command.contactName,passwordHash:command.passwordHash,mustChangePassword:false,phone:command.phone,status:'active',identityProvider:'local_password',roles:['customer'],permissions:['access_customer_workspace','read_catalogue','view_own_company_account','create_rfq','view_own_company_rfqs','view_own_company_orders'],companyIds:[command.companyId],createdAt });
      state.audits.push({ id:state.audits.length+1,eventType:'customer.self_registered',actorUserId:null,actorRole:'customer_registration',companyId:command.companyId,action:'register_customer_account',entityType:'company',entityId:command.companyId,outcome:'success',correlationId:command.correlationId,details:{customerUserId:command.userId,representativeAssigned:false},createdAt });
      return clone({ company:{id:command.companyId,name:command.companyName,area:command.area,industry:command.industry,branchId:command.branchId,status:'active'},account:{id:command.userId,email:command.email,displayName:command.contactName,role:'customer',companyId:command.companyId,status:'active'},onboardingStatus:'active' });
    },
    async administerUser(actor,userId,operation,payload,correlationId) {
      if(!actor.permissions.includes('administer_users')) { const error=new Error('You are not authorised to perform this action.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      const user=state.users.find(item=>item.id===userId); if(!user) throw notFound('The account was not found.');
      if(userId===actor.id && ['status','archive','roles','permissions','temporary_password'].includes(operation)) { const error=new Error('Self security changes are prohibited.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      if (['roles','permissions'].includes(operation) && user.roles.some(role => ['customer','administrator'].includes(role))) {
        const error = new Error('Protected account roles and permissions cannot be changed here.'); error.code='FORBIDDEN'; error.statusCode=403; throw error;
      }
      if(operation==='update') Object.assign(user,{displayName:payload.displayName || user.displayName,username:payload.username || user.username,email:payload.email || user.email,phone:payload.phone ?? user.phone,department:payload.department ?? user.department,branchId:payload.branchId ?? user.branchId});
      if(operation==='status') { if(!['active','disabled'].includes(payload.status)) { const error=new Error('Invalid account status.'); error.code='VALIDATION_ERROR'; error.statusCode=422; throw error; } user.status=payload.status; }
      if(operation==='archive') user.status='archived';
      if(operation==='branch') user.branchId=payload.branchId || '';
      if(operation==='roles') { if(!Array.isArray(payload.roles) || !payload.roles.length || payload.roles.some(role=>['administrator','customer'].includes(role))) { const error=new Error('Invalid role assignment.'); error.code='VALIDATION_ERROR'; error.statusCode=422; throw error; } user.roles=[...new Set(payload.roles)]; refreshPermissions(user); }
      if(operation==='permissions') {
        const defaults = roleDefaults(user.roles);
        const requested = [...new Set(payload.permissions || [])];
        if (requested.some(code => !Object.values(seed.rolePermissions || {}).flat().includes(code))) {
          const error=new Error('Protected or unknown permission.'); error.code='FORBIDDEN'; error.statusCode=403; throw error;
        }
        user.additionalPermissions = requested.filter(code => !defaults.includes(code));
        user.deniedPermissions = defaults.filter(code => !requested.includes(code));
        refreshPermissions(user);
      }
      if(operation==='notification_preferences') state.notificationPreferences.set(userId,{preferences:clone(payload.preferences || {}),updated_at:new Date().toISOString()});
      if(operation==='temporary_password') { user.passwordHash=payload.passwordHash; user.mustChangePassword=true; user.status='active'; state.sessions.filter(session=>session.userId===userId).forEach(session=>{session.revokedAt=new Date().toISOString();}); }
      state.audits.push({id:state.audits.length+1,eventType:'administrator.user_changed',actorUserId:actor.id,actorRole:actor.role,companyId:null,action:`admin_${operation}`,entityType:'user',entityId:userId,outcome:'success',correlationId,details:{operation,reason:payload.reason || ''},createdAt:new Date().toISOString()});
      return clone({id:userId,operation,status:user.status});
    },
    async softDeleteUser(actor,userId,payload,correlationId) {
      if(!actor.permissions.includes('administer_users')) { const error=new Error('You are not authorised to perform this action.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      const user=state.users.find(item=>item.id===userId&&!item.deletedAt); if(!user) throw notFound('The account was not found.');
      if(userId===actor.id || (user.roles || []).includes('administrator')) { const error=new Error('Administrator accounts cannot be deleted through account management.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      const deletedAt=new Date().toISOString(); user.status='archived'; user.disabledAt=deletedAt; user.deletedAt=deletedAt;
      state.sessions.filter(session=>session.userId===userId).forEach(session=>{session.revokedAt ||= deletedAt;});
      for(const representative of state.representatives.filter(item=>item.userId===userId)) { representative.active=false; representative.companyIds=[]; }
      state.audits.push({id:state.audits.length+1,eventType:'administrator.user_soft_deleted',actorUserId:actor.id,actorRole:actor.role,companyId:user.companyIds?.[0] || null,action:'delete_user_account',entityType:'user',entityId:userId,outcome:'success',correlationId,details:{reason:payload.reason,hardDeleted:false},createdAt:deletedAt});
      return {id:userId,status:'deleted',deletedAt};
    },
    async administerCompany(actor,companyId,operation,payload,correlationId) {
      if(!actor.permissions.includes('administer_users')) { const error=new Error('You are not authorised to perform this action.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      const company=state.companies.find(item=>item.id===companyId); if(!company) throw notFound('The company was not found.');
      if(operation==='update') Object.assign(company,{name:payload.name || company.name,area:payload.area ?? company.area,industry:payload.industry ?? company.industry,branchId:payload.branchId ?? company.branchId});
      if(operation==='representative') {
        const representative=state.representatives.find(item=>item.id===payload.representativeId&&item.active!==false);
        if(!representative || (company.branchId && representative.branchId !== company.branchId)) { const error=new Error('Select an active representative assigned to the customer area.'); error.code='VALIDATION_ERROR'; error.statusCode=422; throw error; }
        for(const item of state.representatives) item.companyIds=(item.companyIds || []).filter(id=>id!==companyId);
        representative.companyIds ||= []; representative.companyIds.push(companyId); company.representativeId=representative.id;
      }
      state.audits.push({id:state.audits.length+1,eventType:'administrator.company_changed',actorUserId:actor.id,actorRole:actor.role,companyId,action:`admin_${operation}`,entityType:'company',entityId:companyId,outcome:'success',correlationId,details:{operation,representativeId:operation==='representative'?payload.representativeId:undefined,reason:payload.reason || ''},createdAt:new Date().toISOString()}); return clone(company);
    },
    async getUserAudit(actor,userId) { if(!actor.permissions.includes('administer_users')) throw notFound('The account was not found.'); return clone(state.audits.filter(event=>event.actorUserId===userId || (event.entityType==='user' && event.entityId===userId))); },
    async getUserLoginHistory(actor,userId) { if(!actor.permissions.includes('administer_users')) throw notFound('The account was not found.'); return clone(state.sessions.filter(session=>session.userId===userId).map(({tokenHash,csrfTokenHash,...session})=>session)); },
    async saveUserProfileImage(actor,userId,document,correlationId) { if(actor.id!==userId&&!actor.permissions.includes('administer_users')) throw notFound('The account was not found.'); const previous=state.profileImages.get(userId); state.profileImages.set(userId,{...clone(document),userId}); state.audits.push({id:state.audits.length+1,eventType:'user.profile_image_updated',actorUserId:actor.id,actorRole:actor.role,action:'update_profile_image',entityType:'user',entityId:userId,outcome:'success',correlationId,details:{},createdAt:new Date().toISOString()}); return {accountId:userId,profileImageUrl:`/api/v1/users/me/personalisation/images/${userId}`,previousStorageKey:previous?.storageKey || null}; },
    async removeUserProfileImage(actor,userId,correlationId){if(actor.id!==userId&&!actor.permissions.includes('administer_users'))throw notFound('The account was not found.');const previous=state.profileImages.get(userId);state.profileImages.delete(userId);state.audits.push({id:state.audits.length+1,eventType:'user.profile_image_removed',actorUserId:actor.id,actorRole:actor.role,action:'remove_profile_image',entityType:'user',entityId:userId,outcome:'success',correlationId,details:{},createdAt:new Date().toISOString()});return {storageKey:previous?.storageKey||null};},
    async getUserProfileImage(actor,userId) { const image=state.profileImages.get(userId); if(!image || (actor.id!==userId && !actor.permissions.includes('administer_users'))) throw notFound('The profile image was not found.'); return clone({ ...image, storage_key:image.storageKey,original_name:image.originalName,media_type:image.mediaType }); },
    async getUserSettings(actor) { return clone(state.settings.get(actor.id) || null); },
    async saveUserSettings(actor, settings) {
      const previous = state.settings.get(actor.id);
      const row = { settings: clone(settings), row_version: (previous?.row_version || 0) + 1, updated_at: new Date().toISOString() };
      state.settings.set(actor.id, row);
      return clone(row);
    },
    async getNotificationPreferences(actor) { return clone(state.notificationPreferences.get(actor.id) || null); },
    async saveNotificationPreferences(actor, preferences) {
      const row = { preferences: clone(preferences), updated_at: new Date().toISOString() };
      state.notificationPreferences.set(actor.id, row);
      return clone(row);
    },
    async getEnquiryDraft(actor) { return clone(state.drafts.get(actor.id) || null); },
    async saveEnquiryDraft(actor, items) {
      const row = { items: clone(items), updated_at: new Date().toISOString() };
      state.drafts.set(actor.id, row);
      return clone(row);
    },
    async listNotifications(actor) { return clone(state.notifications.filter(item => item.recipientUserId === actor.id)); },
    async markNotificationRead(actor, notificationId, correlationId) {
      const item = state.notifications.find(notification => notification.id === notificationId && notification.recipientUserId === actor.id);
      if (!item) throw notFound('The notification was not found.');
      if (!item.readAt) {
        item.readAt = new Date().toISOString();
        state.audits.push({ eventType: 'notification.read', actorUserId: actor.id, action: 'mark_notification_read', entityId: item.id, correlationId, createdAt: item.readAt });
      }
      return clone({ id: item.id, readAt: item.readAt });
    },
    async markAllNotificationsRead(actor, correlationId) {
      let updated = 0;
      for (const item of state.notifications.filter(notification => notification.recipientUserId === actor.id && !notification.readAt)) {
        item.readAt = new Date().toISOString(); updated += 1;
      }
      if (updated) state.audits.push({ eventType: 'notification.all_read', actorUserId: actor.id, action: 'mark_all_notifications_read', details: { updatedCount: updated }, correlationId, createdAt: new Date().toISOString() });
      return { updated, updatedCount: updated };
    },
    async getWorkspaceRevision(actor) {
      const own = state.notifications.filter(item => item.recipientUserId === actor.id);
      const records = [...await this.listEnquiries(actor), ...await this.listOrders(actor)];
      return { revision: createHash('sha256').update(JSON.stringify({ id: actor.id, roles: actor.roles, permissions: actor.permissions, own, records })).digest('hex'), intervalSeconds: 300 };
    },
    async retryNotificationDelivery(actor,notificationId,deliveryId,correlationId){const item=state.notifications.find(notification=>notification.id===notificationId);if(!item||(!actor.permissions.includes('retry_notification_delivery')&&item.recipientUserId!==actor.id))throw notFound('The notification delivery was not found.');const delivery=(item.deliveries||[]).find(x=>x.id===deliveryId);if(!delivery)throw notFound('The notification delivery was not found.');delivery.status=delivery.channel==='in_app'?'in_app':`${delivery.channel}_pending`;delivery.attempts=Number(delivery.attempts||0)+1;delivery.lastAttemptAt=new Date().toISOString();state.audits.push({id:state.audits.length+1,eventType:'notification.delivery_retry_requested',actorUserId:actor.id,actorRole:actor.role,action:'retry_notification_delivery',entityType:'notification',entityId:notificationId,outcome:'success',correlationId,details:{deliveryId,channel:delivery.channel},createdAt:new Date().toISOString()});return clone(delivery);},
    async listAuditEvents(actor) {
      if (!actor.permissions.includes('administer_users') && !actor.permissions.includes('read_audit_history')) {
        const error = new Error('You are not authorised to perform this action.'); error.code = 'FORBIDDEN'; error.statusCode = 403; throw error;
      }
      return clone(state.audits.map(item => ({ ...item, timestamp: item.createdAt, actingUser: { id: item.actorUserId, displayName: state.users.find(user => user.id === item.actorUserId)?.displayName || 'System' } })).reverse());
    },
    async listCompanies(actor) {
      const canViewAll = actor.permissions.includes('administer_users') || actor.permissions.includes('view_all_companies');
      return clone(state.companies.filter(company => canViewAll || actor.companyIds.includes(company.id)));
    },
    async listRepresentatives() { return clone(state.representatives.map(item => ({ id: item.id, name: item.displayName, displayName: item.displayName, branch: item.branchName, branchName: item.branchName, branchId: item.branchId || '', code: item.code || '', userId: item.userId, active: item.active !== false }))); },
    async getEnquiryRepresentativeOptions(actor) {
      const company=state.companies.find(item=>item.id===actor.companyId);
      if(!company) return {customerArea:'',branchId:'',assignmentStatus:'company_unavailable',dedicatedRepresentative:null,eligibleRepresentatives:[]};
      const assigned=state.representatives.find(item=>(item.companyIds || []).includes(actor.companyId));
      const map=item=>({id:item.id,name:item.displayName,displayName:item.displayName,branch:item.branchName,branchName:item.branchName,branchId:item.branchId || '',userId:item.userId});
      if(assigned) return clone({customerArea:company.area || '',branchId:company.branchId || '',assignmentStatus:assigned.active===false?'inactive':'assigned',dedicatedRepresentative:assigned.active===false?null:map(assigned),eligibleRepresentatives:[]});
      const eligible=state.representatives.filter(item=>item.active!==false && company.branchId && item.branchId===company.branchId).map(map);
      return clone({customerArea:company.area || '',branchId:company.branchId || '',assignmentStatus:company.area&&company.branchId?'unassigned':'area_missing',dedicatedRepresentative:null,eligibleRepresentatives:eligible});
    },
    async listTechnicalUsers() { return clone(state.users.filter(user=>user.status==='active' && user.roles.some(role=>['technical_support','technical_manager','technical_director'].includes(role))).map(user=>({id:user.id,name:user.displayName,role:user.roles.find(role=>role.startsWith('technical_'))}))); },
    async getCurrentCompany(actor) { return clone(state.companies.find(company => company.id === actor.companyId) || null); },
    async getRepresentativeOrderOptions(actor) {
      const all=actor.permissions.includes('view_all_orders') || actor.permissions.includes('administer_users');
      const companies=state.companies.filter(company=>all || actor.companyIds.includes(company.id));
      return clone({ companies,contacts:state.users.filter(user=>user.roles.includes('customer') && companies.some(company=>user.companyIds.includes(company.id))).map(user=>({id:user.id,name:user.displayName,contact:user.displayName,email:user.email,phone:user.phone || '',companyId:user.companyIds[0]})),representatives:state.representatives.map(item=>({id:item.id,name:item.displayName,displayName:item.displayName,branch:item.branchName,branchName:item.branchName,branchId:item.branchId || '',userId:item.userId})) });
    },
    async checkRepresentativeOrderDuplicate(actor,candidate) {
      const matches=state.orders.filter(order=>(actor.permissions.includes('view_all_orders') || actor.companyIds.includes(order.companyId)) && order.companyId===candidate.companyId && (String(order.purchaseOrderNumber || '').toUpperCase()===String(candidate.purchaseOrderNumber || '').toUpperCase() || String(order.quotationNumber || '').toUpperCase()===String(candidate.quotationNumber || '').toUpperCase())).map(order=>({orderId:order.id,orderReference:order.reference,createdAt:order.createdAt}));
      return clone({likelyDuplicate:Boolean(matches.length),requiresExplicitConfirmation:Boolean(matches.length),matches,checkedAt:new Date().toISOString()});
    },
    async createRepresentativeOrder(actor,command) {
      const key=`${actor.id}:create_representative_order:${command.submissionKey}`; const replay=state.idempotency.get(key);
      if (replay) { if (replay.requestHash!==command.requestHash) { const error=new Error('This submission key was already used for different order details.'); error.code='IDEMPOTENCY_CONFLICT'; error.statusCode=409; throw error; } return clone({...replay.result,idempotent:true}); }
      const company=state.companies.find(item=>item.id===command.companyId); const contact=state.users.find(item=>item.id===command.customerContactId && item.companyIds.includes(command.companyId)); const representative=state.representatives.find(item=>item.id===command.representativeId); if (!company || !contact || !representative) throw notFound('The selected customer or representative is unavailable.');
      const duplicateMatches=state.orders.filter(order=>(actor.permissions.includes('view_all_orders') || actor.companyIds.includes(order.companyId)) && order.companyId===command.companyId && (String(order.purchaseOrderNumber || '').toUpperCase()===String(command.purchaseOrderNumber || '').toUpperCase() || String(order.quotationNumber || '').toUpperCase()===String(command.quotationNumber || '').toUpperCase())).map(order=>({orderId:order.id,orderReference:order.reference,createdAt:order.createdAt}));
      const duplicates={likelyDuplicate:Boolean(duplicateMatches.length),requiresExplicitConfirmation:Boolean(duplicateMatches.length),matches:duplicateMatches,checkedAt:new Date().toISOString()}; if (duplicates.likelyDuplicate && !command.duplicateConfirmed) { const error=new Error('A likely duplicate order exists.'); error.code='LIKELY_DUPLICATE'; error.statusCode=409; throw error; }
      const products=new Map(state.products.map(item=>[item.id,item])); if (command.items.some(item=>!products.has(item.productId))) { const error=new Error('One or more selected products are unavailable.'); error.code='INVALID_PRODUCT'; error.statusCode=422; throw error; }
      const createdAt=new Date().toISOString(); const id=randomUUID(); const reference=`OR-2099-${String(state.orders.length+1).padStart(6,'0')}`;
      const order={id,reference,companyId:company.id,company:company.name,contact:contact.displayName,representativeId:representative.id,selectedRep:{id:representative.id,name:representative.displayName,branchName:representative.branchName},workflowType:'order',trackingStatus:'awaiting_planning',status:'awaiting_planning',origin:'representative_loaded_order',source:command.source,application:command.application,fulfilment:command.fulfilment,deliveryAddress:command.deliveryAddress,collectionBranch:command.branchId,priority:command.priority,quotationNumber:command.quotationNumber,purchaseOrderNumber:command.purchaseOrderNumber,items:command.items.map((item,index)=>({id:randomUUID(),lineId:randomUUID(),productId:item.productId,code:products.get(item.productId).code,name:products.get(item.productId).name,quantity:item.quantity,configuration:clone(item.configuration)})),documents:command.documents.map(document=>({id:document.id,documentType:document.kind==='purchaseOrder'?'purchase_order':document.kind,fileName:document.originalName,mimeType:document.mediaType,sizeBytes:document.sizeBytes,customerVisible:['quotation','purchaseOrder'].includes(document.kind)})),trackingHistory:[],createdAt,updatedAt:createdAt};
      state.orders.push(order); state.audits.push({id:state.audits.length+1,eventType:'order.representative_loaded',actorUserId:actor.id,actorRole:actor.role,companyId:company.id,action:'load_customer_order',entityType:'order',entityId:id,outcome:'success',correlationId:command.correlationId,details:{itemCount:command.items.length},createdAt}); state.notifications.push({id:randomUUID(),companyId:company.id,recipientUserId:contact.id,orderId:id,eventType:'representative_order_created',title:'Order loaded',message:`${reference} is now available in Rhomberg Connect.`,customerVisible:true,createdAt});
      const result={order,duplicateCheck:duplicates}; state.idempotency.set(key,{requestHash:command.requestHash,result:clone(result)}); return clone(result);
    },
    async listOrders(actor) {
      const operationalQueue = ['view_planning_queue','view_expediting_queue','view_lab_queue','view_qa_queue','view_dispatch_queue'].some(permission => actor.permissions.includes(permission));
      return clone(state.orders.filter(order => actor.permissions.includes('view_all_orders') || operationalQueue || actor.companyIds.includes(order.companyId) || order.representativeId === actor.representativeId));
    },
    async getOrder(actor,id) {
      const order=state.orders.find(item=>item.id===id && canReadOrder(actor,item));
      if (!order) throw notFound('The order was not found or is outside your authorised scope.');
      return clone(order);
    },
    async performWorkflowAction(actor,command) {
      const collection=command.entityType==='rfq'?state.enquiries:state.orders;
      const record=collection.find(item=>item.id===command.id && (command.entityType==='rfq'
        ? (actor.permissions.includes('view_all_rfqs') || actor.companyIds.includes(item.companyId) || item.representativeId===actor.representativeId)
        : canReadOrder(actor,item)));
      if (!record) throw notFound(`The ${command.entityType==='rfq'?'RFQ':'order'} was not found or is outside your authorised scope.`);
      if (!command.definition.from.includes(record.trackingStatus)) { const error=new Error(`This action is not allowed while the record is ${record.trackingStatus}.`); error.code='INVALID_WORKFLOW_TRANSITION'; error.statusCode=409; throw error; }
      if (actor.role==='sales_representative' && record.representativeId!==actor.representativeId) { const error=new Error('This record is assigned to another representative.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
      if(command.entityType==='rfq' && command.action==='mark_quoted' && state.technicalRequests.some(item=>item.rfqId===record.id && !['technical_support_completed','technical_support_cancelled'].includes(item.status) && !item.quotationOverride?.active)) { const error=new Error('Technical Review Pending. Complete or formally override the technical request before marking the RFQ quoted.'); error.code='TECHNICAL_REVIEW_PENDING'; error.statusCode=409; throw error; }
      let toStatus=command.definition.to; record.details ||= {};
      if (toStatus === '__same__') toStatus = record.trackingStatus;
      if (DISPATCH_ACTIONS.includes(command.action)) {
        record.details.dispatch = applyDispatchAction({ ...record, status: record.trackingStatus }, command.action, command.data, actor, new Date().toISOString());
        Object.assign(record, dispatchProjection(record.details, actor));
      }
      if (toStatus==='__resume__') toStatus=record.details.previousStatus || 'expediting_in_progress';
      if (command.action==='place_on_hold') record.details.previousStatus=record.trackingStatus;
      if (command.action==='mark_quoted') record.details.quotation={...clone(command.data.quotation),recordedAt:new Date().toISOString(),recordedBy:actor.id};
      if (command.action==='complete_planning') record.details.planning={...clone(command.data.planning || command.data),completedAt:new Date().toISOString(),completedBy:actor.id};
      let createdOrder=null;
      if (command.entityType==='rfq' && command.action==='accept_order') {
        const now=new Date().toISOString(); const id=randomUUID();
        createdOrder={id,reference:`OR-2099-${String(state.orders.length+1).padStart(6,'0')}`,companyId:record.companyId,company:record.company,contact:record.contact,representativeId:record.representativeId,selectedRep:clone(record.selectedRep),workflowType:'order',trackingStatus:'awaiting_planning',status:'awaiting_planning',origin:'customer_submitted_rfq_order',application:record.application,fulfilment:record.fulfilment,deliveryAddress:record.deliveryAddress,collectionBranch:record.collectionBranch,priority:record.priority,items:clone(record.items),trackingHistory:[],details:{acceptance:clone(command.data.acceptance)},createdAt:now,updatedAt:now};
        state.orders.push(createdOrder); record.details.orderId=id; record.details.orderReference=createdOrder.reference;
      }
      const previous=record.trackingStatus; record.trackingStatus=toStatus; record.status=toStatus; record.updatedAt=new Date().toISOString();
      record.trackingHistory ||= []; record.trackingHistory.push({id:randomUUID(),fromStatus:previous,toStatus,status:toStatus,action:command.action,note:command.comment || '',customerVisible:Boolean(command.data.customerMessage),createdAt:record.updatedAt});
      state.audits.push({id:state.audits.length+1,eventType:'workflow.transition',actorUserId:actor.id,actorRole:actor.role,companyId:record.companyId,action:command.action,entityType:command.entityType,entityId:record.id,outcome:'success',correlationId:command.correlationId,details:{fromStatus:previous,toStatus,orderId:createdOrder?.id || null},createdAt:record.updatedAt});
      return clone(command.entityType==='rfq'?{enquiry:record,order:createdOrder}:{order:record});
    },
    async listLocations() { return clone(state.locations); },
    async saveLocation(_actor, location) {
      const id = location.id || randomUUID();
      const record = { ...clone(location), id, updatedAt: new Date().toISOString() };
      const index = state.locations.findIndex(item => item.id === id);
      if (index >= 0) state.locations[index] = record; else state.locations.push(record);
      return clone(record);
    },
    async listTechnicalRequests() { return clone(state.technicalRequests); },
    async getTechnicalSupportByRfq(actor,rfqId) {
      const rfq=state.enquiries.find(item=>item.id===rfqId && canRead(actor,item)); if(!rfq) throw notFound('The RFQ was not found or is outside your authorised scope.');
      return clone(state.technicalRequests.find(item=>item.rfqId===rfqId) || null);
    },
    async createTechnicalSupportRequest(actor,rfqId,command) {
      const rfq=state.enquiries.find(item=>item.id===rfqId && canRead(actor,item)); if(!rfq) throw notFound('The RFQ was not found or is outside your authorised scope.');
      if(!rfq.items.some(item=>item.id===command.lineItemId || item.lineId===command.lineItemId)) { const error=new Error('Select a line item from this RFQ.'); error.code='VALIDATION_ERROR'; error.statusCode=422; throw error; }
      if(state.technicalRequests.some(item=>item.rfqId===rfqId && !['technical_support_completed','technical_support_cancelled'].includes(item.status))) { const error=new Error('This RFQ already has an active Technical Support request.'); error.code='CONFLICT'; error.statusCode=409; throw error; }
      const createdAt=new Date().toISOString(); const original=rfq.details?.quotationTargetAt || new Date(new Date(createdAt).getTime()+72*36e5).toISOString(); const revised=new Date(new Date(original).getTime()+24*36e5).toISOString();
      const record={id:command.id,reference:`TS-${new Date().getUTCFullYear()}-${command.id.slice(0,8).toUpperCase()}`,rfqId,rfqReference:rfq.reference,companyId:rfq.companyId,company:rfq.company,representativeId:rfq.representativeId,representativeName:rfq.selectedRep?.name || '',requestedBy:actor.contact,assignedTechnicalUserId:command.requestedTechnicalUserId || null,category:command.category,question:command.question,lineItemId:command.lineItemId,priority:command.priority,classification:command.classification,status:'technical_support_requested',originalQuotationTarget:original,revisedQuotationTarget:revised,createdAt,updatedAt:createdAt,messages:[]};
      state.technicalRequests.push(record); rfq.details={...(rfq.details || {}),technicalSupportRequestId:record.id,originalQuotationTarget:original,revisedQuotationTarget:revised};
      state.audits.push({id:state.audits.length+1,eventType:'technical_support.requested',actorUserId:actor.id,actorRole:actor.role,companyId:rfq.companyId,action:'request_technical_support',entityType:'technical_support',entityId:record.id,outcome:'success',correlationId:command.correlationId,details:{rfqId,originalQuotationTarget:original,revisedQuotationTarget:revised},createdAt});
      return clone(record);
    },
    async transitionTechnicalSupport(actor,id,command) {
      const record=state.technicalRequests.find(item=>item.id===id); if(!record) throw notFound('The Technical Support request was not found.');
      if(command.action==='assign') { if(record.status!=='technical_support_requested') { const error=new Error('This request cannot be assigned at its current stage.'); error.code='INVALID_WORKFLOW_TRANSITION'; error.statusCode=409; throw error; } record.assignedTechnicalUserId=command.assignedUserId; }
      if(command.action==='start_review' && record.status!=='technical_support_assigned') { const error=new Error('This request must be assigned before review.'); error.code='INVALID_WORKFLOW_TRANSITION'; error.statusCode=409; throw error; }
      if(command.action==='complete' && record.status!=='technical_response_submitted') { const error=new Error('A technical response is required before completion.'); error.code='INVALID_WORKFLOW_TRANSITION'; error.statusCode=409; throw error; }
      if(command.toStatus) record.status=command.toStatus; if(command.action==='override') record.quotationOverride={active:true,reason:command.reason,actorUserId:actor.id,createdAt:new Date().toISOString()}; record.updatedAt=new Date().toISOString(); if(command.action==='complete') record.completedAt=record.updatedAt;
      state.audits.push({id:state.audits.length+1,eventType:`technical_support.${command.action}`,actorUserId:actor.id,actorRole:actor.role,companyId:record.companyId,action:command.action,entityType:'technical_support',entityId:id,outcome:'success',correlationId:command.correlationId,details:{status:record.status},createdAt:record.updatedAt}); return clone(record);
    },
    async addTechnicalSupportMessage(actor,id,command) {
      const record=state.technicalRequests.find(item=>item.id===id); if(!record) throw notFound('The Technical Support request was not found.');
      const createdAt=new Date().toISOString(); record.messages.push({id:randomUUID(),message:command.message,sender:actor.id,senderRole:actor.role,classification:command.classification,metadata:clone(command.metadata || {}),createdAt}); if(command.toStatus) record.status=command.toStatus; record.updatedAt=createdAt;
      state.audits.push({id:state.audits.length+1,eventType:'technical_support.message_posted',actorUserId:actor.id,actorRole:actor.role,companyId:record.companyId,action:command.action,entityType:'technical_support',entityId:id,outcome:'success',correlationId:command.correlationId,details:{classification:command.classification,status:record.status},createdAt}); return clone(record);
    },
    async getPolicy(_actor, code) { return clone(state.policies.get(code) || null); },
    async savePolicy(_actor, code, value) {
      const row = { value: clone(value), updated_at: new Date().toISOString() };
      state.policies.set(code, row); return clone(row);
    },
    async listEnquiries(actor) { return clone(state.enquiries.filter(item => canRead(actor, item))); },
    async getEnquiry(actor, id) {
      const enquiry = state.enquiries.find(item => item.id === id);
      if (!enquiry || !canRead(actor, enquiry)) throw notFound('The RFQ was not found or is outside your authorised company account.');
      return clone(enquiry);
    },
    async getDocument(actor, id) {
      const document = state.documents.find(item => item.id === id && (actor.companyIds.includes(item.companyId) || actor.permissions.includes('view_all_orders') || (item.kind === 'certificate' && actor.permissions.includes('download_certificates'))));
      if (!document) throw notFound('The document was not found or is outside your authorised company account.');
      return clone({ ...document, company_id: document.companyId, storage_key: document.storageKey, original_name: document.originalName, media_type: document.mediaType, scan_status: document.scanStatus, customer_visible: document.customerVisible });
    },
    async saveLaboratoryCertificate(actor, command) {
      const order=state.orders.find(item=>item.id===command.orderId && (actor.permissions.includes('view_all_orders') || actor.permissions.includes('view_lab_queue') || actor.companyIds.includes(item.companyId)));
      if(!order) throw notFound('The order was not found or is outside your authorised scope.');
      order.details ||= {}; order.details.laboratory ||= {}; const units=order.details.laboratory.units ||= [];
      const index=units.findIndex(unit=>unit.id===command.unit.id); const current=index>=0?units[index]:command.unit;
      if(command.replacement && !current.certificateId) { const error=new Error('There is no certificate to replace.'); error.code='CONFLICT'; error.statusCode=409; throw error; }
      if(!command.replacement && current.certificateId) { const error=new Error('Use controlled replacement for an existing certificate.'); error.code='CONFLICT'; error.statusCode=409; throw error; }
      const now=new Date().toISOString(); const previous=current.certificateId?{id:current.certificateId,certificateNumber:current.certificateNumber,issueDate:current.certificateIssueDate,serialNumber:current.serialNumber,replacedAt:now,replacementReason:command.unit.reason}:null;
      const updated={...current,...command.unit,certificateId:command.certificateId,certificateIssueDate:command.unit.issueDate,certificateStatus:'uploaded',status:'certificate_uploaded',certificateUploadedAt:now,updatedAt:now,certificateVersions:[...(current.certificateVersions || []),...(previous?[previous]:[])]};
      if(index>=0) units[index]=updated; else units.push(updated); order.updatedAt=now;
      state.documents.push({...clone(command.document),id:command.certificateId,companyId:order.companyId,orderId:order.id,kind:'certificate',scanStatus:'pending',customerVisible:true,createdAt:now});
      state.audits.push({id:state.audits.length+1,eventType:command.replacement?'certificate.replaced':'certificate.uploaded',actorUserId:actor.id,actorRole:actor.role,companyId:order.companyId,action:command.replacement?'replace_certificate':'upload_certificate',entityType:'document',entityId:command.certificateId,outcome:'success',correlationId:command.correlationId,details:{orderId:order.id,unitId:command.unit.id},createdAt:now});
      return clone(updated);
    },
    async saveLaboratoryCertificates(actor, commands) {
      const snapshot = clone({ orders: state.orders, documents: state.documents, audits: state.audits });
      try {
        const results = [];
        for (const command of commands) results.push(await this.saveLaboratoryCertificate(actor, command));
        return results;
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
    async archiveLaboratoryCertificates(actor,orderId,correlationId) {
      const order=state.orders.find(item=>item.id===orderId && (actor.permissions.includes('view_all_orders') || actor.permissions.includes('view_lab_queue'))); if(!order) throw notFound('The order was not found or is outside your authorised scope.');
      const now=new Date().toISOString(); const units=(order.details?.laboratory?.units || []).map(unit=>unit.certificateId?{...unit,certificateStatus:'archived',updatedAt:now}:unit); order.details.laboratory={...(order.details.laboratory || {}),units,archivedAt:now};
      state.audits.push({id:state.audits.length+1,eventType:'certificate.archived',actorUserId:actor.id,actorRole:actor.role,companyId:order.companyId,action:'archive_certificates',entityType:'order',entityId:orderId,outcome:'success',correlationId,details:{},createdAt:now}); return clone({orderId,archived:true,units});
    },
    async listOrderDocuments(actor,orderId){const order=state.orders.find(item=>item.id===orderId&&(actor.permissions.includes('view_all_orders')||actor.companyIds.includes(item.companyId)||item.representativeId===actor.representativeId));if(!order)throw notFound('The order was not found.');return clone((order.documents || []).map(document=>({...document,orderId})));},
    async replaceOrderDocument(actor,command){const order=state.orders.find(item=>item.id===command.orderId&&(actor.permissions.includes('view_all_orders')||item.representativeId===actor.representativeId));if(!order)throw notFound('The order was not found.');const previous=(order.documents || []).find(document=>document.id===command.documentId);if(!previous)throw notFound('The source document was not found.');const versions=(order.documents || []).filter(document=>document.documentType===previous.documentType);const created={id:command.document.id,orderId:order.id,documentType:previous.documentType,fileName:command.document.originalName,mimeType:command.document.mediaType,sizeBytes:command.document.sizeBytes,scanStatus:'pending',customerVisible:previous.customerVisible,version:Math.max(0,...versions.map(item=>Number(item.version || 1)))+1,supersedesDocumentId:previous.id};order.documents.push(created);state.documents.push({...clone(command.document),id:created.id,companyId:order.companyId,orderId:order.id,kind:created.documentType,scanStatus:'pending',customerVisible:created.customerVisible,version:created.version});state.audits.push({id:state.audits.length+1,eventType:'document.replaced',actorUserId:actor.id,actorRole:actor.role,companyId:order.companyId,action:'replace_order_source_document',entityType:'document',entityId:created.id,outcome:'success',correlationId:command.correlationId,details:{previousDocumentId:previous.id},createdAt:new Date().toISOString()});return clone(created);},
    async saveGeneratedOrderDocument(actor,command){const order=state.orders.find(item=>item.id===command.orderId&&(actor.permissions.includes('view_all_orders')||actor.companyIds.includes(item.companyId)));if(!order)throw notFound('The order was not found.');const created={id:command.document.id,orderId:order.id,documentType:command.kind,fileName:command.document.originalName,mimeType:'application/pdf',sizeBytes:command.document.sizeBytes,scanStatus:'clean',customerVisible:command.customerVisible,version:1};order.documents ||= [];order.documents.push(created);state.documents.push({...clone(command.document),id:created.id,companyId:order.companyId,orderId:order.id,kind:command.kind,scanStatus:'clean',customerVisible:command.customerVisible});return clone({...created,downloadUrl:`/api/v1/orders/${order.id}/source-documents/${created.id}/download`});},
    async recordOrderEmail(actor,orderId,command){const order=state.orders.find(item=>item.id===orderId&&(actor.permissions.includes('view_all_orders')||item.representativeId===actor.representativeId));if(!order)throw notFound('The order was not found.');if(command.recipient&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(command.recipient)){const error=new Error('Enter a valid recipient email address.');error.code='VALIDATION_ERROR';error.statusCode=422;throw error;}return {orderId,status:'email_pending',simulated:true};},
    async mutateOrderGovernance(actor,orderId,operation,payload,correlationId){const order=state.orders.find(item=>item.id===orderId&&(actor.permissions.includes('view_all_orders')||actor.companyIds.includes(item.companyId)));if(!order)throw notFound('The order was not found.');order.details ||= {};if(['archive','deletion_request'].includes(operation)&&order.details.legalHold?.active){const error=new Error('This record is protected by a legal hold.');error.code='LEGAL_HOLD_ACTIVE';error.statusCode=409;throw error;}if(operation==='approve_archive')order.details.archiveApproval={approved:true,reason:payload.reason,approvedBy:actor.id,approvedAt:new Date().toISOString()};if(operation==='legal_hold')order.details.legalHold={active:Boolean(payload.active),reason:payload.reason || '',changedBy:actor.id,changedAt:new Date().toISOString()};if(operation==='archive'){if(order.trackingStatus!=='completed'){const error=new Error('Only completed orders can be archived.');error.code='INVALID_ARCHIVE_STATUS';error.statusCode=409;throw error;}order.trackingStatus=order.status='archived';order.archivedAt=new Date().toISOString();}if(operation==='restore'){if(order.trackingStatus!=='archived'){const error=new Error('Only archived orders can be restored.');error.code='INVALID_ARCHIVE_STATUS';error.statusCode=409;throw error;}order.trackingStatus=order.status='completed';order.archivedAt=null;}if(operation==='deletion_request')order.details.deletionRequest={requested:true,status:'pending_approval',reason:payload.reason,requestedBy:actor.id,requestedAt:new Date().toISOString()};state.audits.push({id:state.audits.length+1,eventType:`order.${operation}`,actorUserId:actor.id,actorRole:actor.role,companyId:order.companyId,action:operation,entityType:'order',entityId:orderId,outcome:'success',correlationId,details:{reason:payload.reason || ''},createdAt:new Date().toISOString()});return clone({orderId,status:order.trackingStatus,archivedAt:order.archivedAt,details:order.details});},
    async listVisitClients(actor,{all=false}={}) { const allowed=all||actor.permissions.includes('view_visit_compliance')||actor.permissions.includes('administer_users'); const assignedCompanyIds=state.representatives.find(rep=>rep.id===actor.representativeId)?.companyIds||[];const companies=state.companies.filter(company=>allowed||assignedCompanyIds.includes(company.id)); return clone(companies.map(company=>{const rep=state.representatives.find(item=>item.companyIds?.includes(company.id));const completed=state.appointments.filter(item=>item.companyId===company.id&&item.status==='completed').sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))[0];return {id:company.id,company:company.name,primaryContact:state.users.find(user=>user.companyIds?.includes(company.id))?.displayName||'',address:company.address||company.area||'',branchId:company.branchId||'',latitude:null,longitude:null,representativeId:rep?.id||null,representativeName:rep?.displayName||'',lastVerifiedVisitAt:completed?.completedAt||null,nextPlannedVisitAt:state.appointments.find(item=>item.companyId===company.id&&item.status==='scheduled')?.scheduledAt||null,daysSinceLastVerifiedVisit:completed?Math.floor((Date.now()-new Date(completed.completedAt))/86400000):999,status:completed?'green':'red',rfqsThisMonth:0,quotationsThisMonth:0,ordersThisMonth:0,openRfqs:state.enquiries.filter(x=>x.companyId===company.id).length,openOrders:state.orders.filter(x=>x.companyId===company.id).length,lastInteraction:completed?.completedAt||null};})); },
    async listAppointments(actor) { const all=actor.permissions.includes('view_visit_compliance')||actor.permissions.includes('administer_users'); return clone(state.appointments.filter(item=>all||item.representativeId===actor.representativeId).map(item=>({...item,clientId:item.companyId,customer:state.companies.find(company=>company.id===item.companyId)?.name||'',representativeName:state.representatives.find(rep=>rep.id===item.representativeId)?.displayName||''}))); },
    async createAppointment(actor,command) { const rep=state.representatives.find(item=>item.id===actor.representativeId&&item.companyIds?.includes(command.companyId)); if(!rep) throw notFound('The customer is not assigned to this representative.'); const now=new Date().toISOString();const item={...clone(command),representativeId:rep.id,createdByUserId:actor.id,status:'scheduled',verificationStatus:'not_verified',createdAt:now,updatedAt:now};state.appointments.push(item);state.audits.push({id:state.audits.length+1,eventType:'appointment.scheduled',actorUserId:actor.id,actorRole:actor.role,companyId:item.companyId,action:'schedule_visit',entityType:'appointment',entityId:item.id,outcome:'success',correlationId:command.correlationId,details:{},createdAt:now});return clone(item); },
    async transitionAppointment(actor,id,command){const item=state.appointments.find(x=>x.id===id&&(x.representativeId===actor.representativeId||actor.permissions.includes('view_visit_compliance')));if(!item)throw notFound('The appointment was not found.');const now=new Date().toISOString();const allowed={start:['scheduled'],location_check:['in_progress'],customer_confirm:['in_progress'],create_qr:['in_progress'],verify_qr:['in_progress'],complete:['in_progress'],missed_reason:['missed_visit']};if(!allowed[command.action]?.includes(item.status)){const error=new Error('This visit action is not available at the current stage.');error.code='INVALID_WORKFLOW_TRANSITION';error.statusCode=409;throw error;}if(command.action==='start'){item.status='in_progress';item.startedAt=now;}if(command.action==='location_check')item.verificationStatus='location_matched';if(command.action==='customer_confirm')item.verificationStatus='customer_confirmed';if(command.action==='create_qr'){item.qrTokenHash=command.input.tokenHash;item.qrExpiresAt=command.input.expiresAt;}if(command.action==='verify_qr'){if(!item.qrTokenHash||item.qrTokenHash!==command.input.tokenHash||item.qrConsumedAt||new Date(item.qrExpiresAt)<new Date()){const error=new Error('The one-time confirmation token is invalid or expired.');error.code='INVALID_QR_TOKEN';error.statusCode=422;throw error;}item.qrConsumedAt=now;item.verificationStatus='qr_confirmed';}if(command.action==='complete'){item.status='completed';item.completedAt=now;item.verificationStatus=item.verificationStatus==='not_verified'?'not_verified':'verified';item.details={...item.details,completionNotes:String(command.input.notes||'')};}if(command.action==='missed_reason')item.details={...item.details,missedReason:String(command.input.reason||'')};item.updatedAt=now;state.audits.push({id:state.audits.length+1,eventType:`appointment.${command.action}`,actorUserId:actor.id,actorRole:actor.role,companyId:item.companyId,action:command.action,entityType:'appointment',entityId:id,outcome:'success',correlationId:command.correlationId,details:{verificationStatus:item.verificationStatus},createdAt:now});return clone(item);},
    async detectMissedAppointments(actor,correlationId){const now=new Date();let changed=0;for(const item of state.appointments){if(item.status==='scheduled'&&new Date(item.scheduledAt).getTime()+item.expectedDurationMinutes*60000+30*60000<now){item.status='missed_visit';item.updatedAt=now.toISOString();changed++;state.audits.push({id:state.audits.length+1,eventType:'appointment.missed',actorUserId:actor.id,actorRole:actor.role,companyId:item.companyId,action:'detect_missed_visit',entityType:'appointment',entityId:item.id,outcome:'success',correlationId,details:{},createdAt:now.toISOString()});}}return {changed};},
    async getWorkLocationSummary(actor){return {representativeId:actor.representativeId,privacyStatus:'disabled_pending_approval',clientVisitHours:0,officeHours:0,unclassifiedHours:0};},
    async manageRecord(actor,recordId,operation,payload,correlationId){const record=state.enquiries.find(x=>x.id===recordId)||state.orders.find(x=>x.id===recordId);if(!record)throw notFound('The workflow record was not found.');if(payload.expectedVersion&&Number(payload.expectedVersion)!==Number(record.version)){const error=new Error('This record changed since it was opened. Refresh and try again.');error.code='VERSION_CONFLICT';error.statusCode=409;throw error;}if(operation==='reassign'){const rep=state.representatives.find(x=>x.id===payload.representativeId);if(!rep)throw notFound('The representative was not found.');record.representativeId=rep.id;record.selectedRep={id:rep.id,name:rep.displayName,branchName:rep.branchName};}if(operation==='override_approval'){record.details||={};record.details.workflowOverrideApproval={targetStatus:payload.targetStatus,reason:payload.reason,approvedBy:actor.id,approvedAt:new Date().toISOString()};}if(operation==='correction'){record.details||={};Object.assign(record.details,payload.values||{});if(payload.values?.customerPoNumber)record.purchaseOrderNumber=payload.values.customerPoNumber;}record.version=Number(record.version||0)+1;state.audits.push({id:state.audits.length+1,eventType:`management.${operation}`,actorUserId:actor.id,actorRole:actor.role,companyId:record.companyId,action:operation,entityType:record.workflowType,entityId:record.id,outcome:'success',correlationId,details:{reason:payload.reason||''},createdAt:new Date().toISOString()});return clone({recordId,operation});},
    async saveCatalogueOverride(actor,kind,itemId,payload,correlationId){const row={kind,itemId,values:clone(payload.values||{}),updatedAt:new Date().toISOString()};state.catalogueOverrides.set(`${kind}:${itemId}`,row);state.audits.push({id:state.audits.length+1,eventType:'catalogue.override_saved',actorUserId:actor.id,actorRole:actor.role,action:'save_catalogue_override',entityType:kind,entityId:itemId,outcome:'success',correlationId,details:{reason:payload.reason||''},createdAt:new Date().toISOString()});return clone(row);},
    async listCatalogueOverrides(){return clone([...state.catalogueOverrides.values()]);},
    async createEnquiry(actor, command) {
      const key = `${actor.id}:create_enquiry:${command.idempotencyKey}`;
      const replay = state.idempotency.get(key);
      if (replay) {
        if (replay.requestHash !== command.requestHash) {
          const error = new Error('This idempotency key was already used for different RFQ details.'); error.code = 'IDEMPOTENCY_CONFLICT'; error.statusCode = 409; throw error;
        }
        return clone({ ...replay.result, idempotent: true });
      }
      const company=state.companies.find(item=>item.id===actor.companyId);
      if(!company) throw notFound('Your company account is unavailable.');
      const currentAssignment=state.representatives.find(item=>(item.companyIds || []).includes(actor.companyId));
      let representative=currentAssignment;
      if(currentAssignment?.active===false) { const error=new Error('Your dedicated representative is unavailable. Contact Rhomberg to update the assignment.'); error.code='REPRESENTATIVE_INACTIVE'; error.statusCode=409; throw error; }
      if(currentAssignment && command.representativeId && command.representativeId!==currentAssignment.id) { const error=new Error('Your dedicated representative cannot be changed during RFQ submission.'); error.code='REPRESENTATIVE_ASSIGNMENT_CONFLICT'; error.statusCode=409; throw error; }
      if(!currentAssignment) {
        representative=state.representatives.find(item=>item.id===command.representativeId&&item.active!==false&&company.branchId&&item.branchId===company.branchId);
        if(!representative) { const error=new Error(company.area?'Select an active representative available in your area.':'Your company area must be completed before an RFQ can be submitted.'); error.code='REPRESENTATIVE_NOT_ELIGIBLE'; error.statusCode=422; throw error; }
        representative.companyIds ||= []; representative.companyIds.push(actor.companyId); company.representativeId=representative.id;
        state.audits.push({id:state.audits.length+1,eventType:'company.dedicated_representative_assigned',actorUserId:actor.id,actorRole:actor.role,companyId:actor.companyId,action:'assign_dedicated_representative',entityType:'company',entityId:actor.companyId,outcome:'success',correlationId:command.correlationId,details:{representativeId:representative.id,source:'first_rfq'},createdAt:new Date().toISOString()});
      }
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
