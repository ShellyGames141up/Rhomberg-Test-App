import { randomUUID } from 'node:crypto';
import { notFound } from '../errors.js';

const json = value => JSON.stringify(value ?? {});

function shouldValidateConfigurationField(field, configuration) {
  // Older catalogue rows predate explicit showWhen metadata for custom ranges.
  // Preserve the same rule used by both configurators while migration 016
  // normalises those stored schemas.
  if (field.key === 'customRange' && configuration?.range !== 'Custom range - sales review') return false;
  if (!field.showWhen) return true;
  const actual = configuration?.[field.showWhen.key];
  if (Array.isArray(field.showWhen.values)) return field.showWhen.values.includes(actual);
  if (Object.hasOwn(field.showWhen, 'notValue')) return actual !== field.showWhen.notValue;
  return actual === field.showWhen.value;
}

function allowedConfigurationOptions(field, configuration) {
  if (!field.optionsBy) return field.options || [];
  const dependency = configuration?.[field.optionsBy.key];
  return field.optionsBy.map?.[dependency] || field.optionsBy.fallback || field.options || [];
}

export function assertProductConfiguration(product, configuration) {
  for (const field of product.configuration_schema || []) {
    if (!shouldValidateConfigurationField(field, configuration)) continue;
    const value = configuration?.[field.key];
    const missing = value === undefined || value === null || String(value).trim() === '' || (Array.isArray(value) && value.length === 0);
    if (field.required && missing) {
      const error = new Error(`Complete the required ${field.key} configuration.`); error.code = 'INVALID_PRODUCT_CONFIGURATION'; error.statusCode = 422; throw error;
    }
    const options = allowedConfigurationOptions(field, configuration);
    const invalidOption = value !== undefined && options.length && (
      field.type === 'multiChoice'
        ? !Array.isArray(value) || value.some(option => !options.includes(option))
        : !options.includes(value)
    );
    if (invalidOption) {
      const error = new Error(`Select an approved ${field.key} option.`); error.code = 'INVALID_PRODUCT_CONFIGURATION'; error.statusCode = 422; throw error;
    }
  }
}

const actorFromRows = (user, roles, permissions, companies, representative) => ({
  id: user.id,
  username: user.username || null,
  email: user.email,
  contact: user.display_name,
  displayName: user.display_name,
  status: user.status,
  identityProvider: user.identity_provider,
  forcePasswordChange: Boolean(user.must_change_password),
  roles: roles.map(row => row.role_code),
  role: roles[0]?.role_code || null,
  permissions: [...new Set(permissions.map(row => row.permission_code))],
  companyIds: companies.map(row => row.company_id),
  companyId: companies.find(row => row.is_primary)?.company_id || companies[0]?.company_id || null,
  company: companies.find(row => row.is_primary)?.company_name || companies[0]?.company_name || '',
  representativeId: representative?.id || null,
});

async function setAuthLookup(client) {
  await client.query("SELECT set_config('app.authentication_lookup', 'enabled', true)");
}

async function setActorScope(client, actor) {
  if (!actor.databaseSessionTokenHash) throw new Error('A database-backed actor requires an active session context.');
  const result = await client.query('SELECT app.establish_request_context($1) AS user_id', [actor.databaseSessionTokenHash]);
  if (result.rows[0]?.user_id !== actor.id) throw new Error('The database session context does not match the authenticated actor.');
}

async function loadActor(client, user, databaseSessionTokenHash = '') {
  const roles = await client.query(`SELECT role_code FROM app.user_roles WHERE user_id = $1 AND revoked_at IS NULL ORDER BY assigned_at`, [user.id]);
  const permissions = await client.query(`SELECT DISTINCT permission_code FROM (
      SELECT rp.permission_code
      FROM app.user_roles ur JOIN app.role_permissions rp ON rp.role_code = ur.role_code
      JOIN app.permissions p ON p.code = rp.permission_code AND p.is_active
      WHERE ur.user_id = $1 AND ur.revoked_at IS NULL
      UNION ALL
      SELECT grant_record.permission_code FROM app.user_permission_grants grant_record
      JOIN app.permissions p ON p.code=grant_record.permission_code AND p.is_active
      WHERE grant_record.user_id=$1 AND grant_record.revoked_at IS NULL
    ) effective`, [user.id]);
  const companies = await client.query(`SELECT cu.company_id, cu.is_primary, c.name AS company_name
      FROM app.company_users cu JOIN app.companies c ON c.id = cu.company_id
      WHERE cu.user_id = $1 AND cu.revoked_at IS NULL AND c.status = 'active' AND c.deleted_at IS NULL
      UNION
      SELECT a.company_id, false AS is_primary, c.name AS company_name
      FROM app.representatives rep
      JOIN app.representative_company_assignments a ON a.representative_id = rep.id AND a.ended_at IS NULL
      JOIN app.companies c ON c.id = a.company_id
      WHERE rep.user_id = $1 AND rep.is_active AND c.status = 'active' AND c.deleted_at IS NULL`, [user.id]);
  const representative = await client.query('SELECT id FROM app.representatives WHERE user_id = $1 AND is_active', [user.id]);
  return { ...actorFromRows(user, roles.rows, permissions.rows, companies.rows, representative.rows[0]), databaseSessionTokenHash };
}

function mapEnquiry(row, items = [], documents = []) {
  return {
    id: row.id,
    reference: row.reference,
    companyId: row.company_id,
    company: row.company_name,
    contact: row.requester_name,
    selectedRep: { id: row.representative_id, name: row.representative_name, branchName: row.branch_name },
    representativeId: row.representative_id,
    application: row.application,
    medium: row.process_medium || '',
    area: row.area,
    fulfilment: row.fulfilment,
    deliveryAddress: row.delivery_address || '',
    collectionBranch: row.collection_branch || '',
    notes: row.customer_notes || '',
    workflowType: 'rfq',
    trackingStatus: row.status,
    status: row.status === 'assigned_to_rep' ? 'Assigned to representative' : 'RFQ submitted',
    priority: row.internal_priority,
    version: row.row_version,
    items: items.map(item => ({
      id: item.id,
      productId: item.product_id,
      product: { id: item.product_id, code: item.product_code_snapshot, name: item.product_name_snapshot },
      quantity: item.quantity,
      configuration: item.configuration,
    })),
    documents: documents.map(document => ({
      id: document.id,
      documentType: document.kind,
      fileName: document.original_name,
      mimeType: document.media_type,
      sizeBytes: Number(document.size_bytes),
      scanStatus: document.scan_status,
      customerVisible: document.customer_visible,
      uploadedAt: document.created_at,
    })),
    allowedWorkflowActions: [],
    trackingHistory: [],
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const enquirySelect = `SELECT r.*, c.name AS company_name, u.display_name AS requester_name,
  rep.display_name AS representative_name, rep.branch_name
  FROM app.rfqs r
  JOIN app.companies c ON c.id = r.company_id
  JOIN app.users u ON u.id = r.requester_user_id
  JOIN app.representatives rep ON rep.id = r.representative_id`;

export function createPostgresRepository(pool) {
  const inTransaction = async (callback, { actor, authLookup = false } = {}) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (authLookup) await setAuthLookup(client);
      if (actor) await setActorScope(client, actor);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  const loadEnquiry = async (client, id) => {
    const result = await client.query(`${enquirySelect} WHERE r.id = $1`, [id]);
    if (!result.rows[0]) throw notFound('The RFQ was not found or is outside your authorised company account.');
    const items = await client.query('SELECT * FROM app.rfq_items WHERE rfq_id = $1 ORDER BY line_number', [id]);
    const documents = await client.query('SELECT * FROM app.document_metadata WHERE rfq_id = $1 AND deleted_at IS NULL ORDER BY created_at', [id]);
    return mapEnquiry(result.rows[0], items.rows, documents.rows);
  };

  const loadOrder = async (client,id) => {
    const result=await client.query(`SELECT o.*,c.name AS company_name,customer.display_name AS customer_name,
      rep.display_name AS representative_name,rep.branch_name FROM app.orders o JOIN app.companies c ON c.id=o.company_id
      LEFT JOIN app.users customer ON customer.id=o.customer_user_id LEFT JOIN app.representatives rep ON rep.id=o.representative_id
      WHERE o.id=$1 AND o.deleted_at IS NULL`,[id]);
    const row=result.rows[0]; if (!row) throw notFound('The order was not found or is outside your authorised scope.');
    const items=await client.query('SELECT * FROM app.order_items WHERE order_id=$1 ORDER BY line_number',[id]);
    const history=await client.query("SELECT * FROM app.workflow_events WHERE entity_type='order' AND entity_id=$1 ORDER BY created_at",[id]);
    const documents=await client.query('SELECT * FROM app.document_metadata WHERE order_id=$1 AND deleted_at IS NULL ORDER BY created_at',[id]);
    return { id:row.id,reference:row.reference,workflowType:'order',trackingStatus:row.status,status:row.status,companyId:row.company_id,company:row.company_name,
      contact:row.customer_name || '',customerUserId:row.customer_user_id,representativeId:row.representative_id,selectedRep:{id:row.representative_id,name:row.representative_name || '',branchName:row.branch_name || ''},
      application:row.application,fulfilment:row.fulfilment,deliveryAddress:row.delivery_address || '',collectionBranch:row.collection_branch || '',notes:row.customer_notes || '',priority:row.internal_priority,
      poNumber:row.purchase_order_number || '',purchaseOrderNumber:row.purchase_order_number || '',quotationNumber:row.quotation_number || '',origin:row.origin,source:row.source,version:row.row_version,details:row.details || {},laboratory:row.details?.laboratory || undefined,createdAt:row.created_at,updatedAt:row.updated_at,completedAt:row.completed_at,archivedAt:row.archived_at,
      items:items.rows.map(item=>({id:item.id,lineId:item.id,productId:item.product_id,code:item.product_code_snapshot,name:item.product_name_snapshot,quantity:item.quantity,configuration:item.configuration,unitState:item.unit_state})),
      documents:documents.rows.map(document=>({id:document.id,documentType:document.kind,fileName:document.original_name,mimeType:document.media_type,sizeBytes:Number(document.size_bytes),scanStatus:document.scan_status,customerVisible:document.customer_visible,uploadedAt:document.created_at})),
      trackingHistory:history.rows.map(event=>({id:event.id,fromStatus:event.from_status,toStatus:event.to_status,status:event.to_status,entityType:'order',action:event.action,note:event.customer_note || event.internal_note || '',customerVisible:event.customer_visible,createdAt:event.created_at})),allowedWorkflowActions:[] };
  };

  return {
    async health() {
      const result = await pool.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    },
    async close() { await pool.end(); },
    async findUserByIdentifier(identifier) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT id, username, email, display_name, password_hash, identity_provider,
          status, must_change_password, disabled_at, deleted_at FROM app.users
          WHERE (lower(username) = lower($1) OR email = lower($1)) AND deleted_at IS NULL`, [identifier]);
        return result.rows[0] || null;
      }, { authLookup: true });
    },
    async createSession(data) {
      return inTransaction(client => client.query(`INSERT INTO app.sessions
        (id, user_id, token_hash, csrf_token_hash, expires_at, ip_hash, user_agent_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [data.id, data.userId, data.tokenHash, data.csrfTokenHash, data.expiresAt, data.ipHash, data.userAgentHash]), { authLookup: true });
    },
    async getSessionActor(tokenHash) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT s.id AS session_id, s.user_id AS id, s.csrf_token_hash, s.selected_role,
          s.expires_at, u.username, u.email, u.display_name, u.identity_provider, u.status, u.must_change_password
          FROM app.sessions s JOIN app.users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.deleted_at IS NULL`, [tokenHash]);
        const row = result.rows[0];
        if (!row || row.status !== 'active') return null;
        await client.query('SELECT app.establish_request_context($1)', [tokenHash]);
        const actor = await loadActor(client, row, tokenHash);
        if(row.selected_role && actor.roles.includes(row.selected_role)) actor.role=row.selected_role;
        await client.query('UPDATE app.sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]);
        return { actor, session: { id: row.session_id, csrfTokenHash: row.csrf_token_hash, expiresAt: row.expires_at } };
      }, { authLookup: true });
    },
    async revokeSession(tokenHash) {
      return inTransaction(client => client.query('UPDATE app.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]), { authLookup: true });
    },
    async rotateSessionCsrf(sessionId, csrfTokenHash) {
      return inTransaction(client => client.query('UPDATE app.sessions SET csrf_token_hash = $2 WHERE id = $1 AND revoked_at IS NULL', [sessionId, csrfTokenHash]), { authLookup: true });
    },
    async setSessionRole(actor,sessionId,role){return inTransaction(async client=>{if(!actor.roles.includes(role)){const error=new Error('That workspace is not assigned to this account.');error.code='FORBIDDEN';error.statusCode=403;throw error;}await client.query('UPDATE app.sessions SET selected_role=$2,last_seen_at=now() WHERE id=$1',[sessionId,role]);return{...actor,role};},{actor});},
    async updateLastLogin(userId) {
      return inTransaction(client => client.query('UPDATE app.users SET last_login_at = now() WHERE id = $1', [userId]), { authLookup: true });
    },
    async changeOwnPassword(actor, passwordHash, correlationId) {
      return inTransaction(async client => {
        await client.query('SELECT app.change_own_password($1,$2)', [passwordHash, correlationId]);
      }, { actor });
    },
    async appendAudit(event) {
      return inTransaction(client => client.query(`INSERT INTO app.audit_events
        (event_type, actor_user_id, actor_role, company_id, action, entity_type, entity_id, outcome, correlation_id, details)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [
        event.eventType, event.actorUserId, event.actorRole, event.companyId, event.action,
        event.entityType, event.entityId, event.outcome, event.correlationId, json(event.details),
      ]), { authLookup: true });
    },
    async getAdministrationOverview(actor) {
      return inTransaction(async client => {
        // A pg Client represents one PostgreSQL connection. Keep all statements on
        // this transaction sequential; concurrent client.query calls can leave the
        // protocol queue blocked and eventually exhaust the pool under retries.
        const users = await client.query('SELECT * FROM app.list_internal_users()');
        const customerUsers = await client.query(`SELECT user_record.id,user_record.username,user_record.email,user_record.display_name,user_record.phone,
            user_record.status,user_record.last_login_at,user_record.created_at,company.id AS company_id,company.name AS company_name,
            company.area,company.branch_id
            FROM app.users user_record JOIN app.company_users membership ON membership.user_id=user_record.id AND membership.revoked_at IS NULL
            JOIN app.companies company ON company.id=membership.company_id AND company.deleted_at IS NULL
            JOIN app.user_roles role ON role.user_id=user_record.id AND role.role_code='customer' AND role.revoked_at IS NULL
            WHERE user_record.deleted_at IS NULL ORDER BY company.name,user_record.display_name`);
        const roles = await client.query("SELECT code, name FROM app.roles WHERE is_internal AND is_active AND code <> 'administrator' ORDER BY name");
        const permissions = await client.query('SELECT code FROM app.permissions WHERE is_active ORDER BY code');
        const rolePermissions = await client.query('SELECT role_code, permission_code FROM app.role_permissions ORDER BY role_code, permission_code');
        const companies = await client.query(`SELECT company.id,company.name,company.status,company.area,company.industry,company.branch_id,
            company.created_at,company.updated_at,count(DISTINCT member.user_id)::integer AS contacts,
            assignment.representative_id
            FROM app.companies company
            LEFT JOIN app.company_users member ON member.company_id=company.id AND member.revoked_at IS NULL
            LEFT JOIN app.representative_company_assignments assignment ON assignment.company_id=company.id AND assignment.ended_at IS NULL
            WHERE company.deleted_at IS NULL
            GROUP BY company.id,assignment.representative_id ORDER BY company.name`);
        const representatives = await client.query('SELECT id,user_id,display_name,branch_name,branch_id,code,is_active FROM app.representatives ORDER BY display_name');
        const auditCount = await client.query('SELECT count(*)::integer AS count FROM app.audit_events');
        const mappedInternalUsers = users.rows.map(user => ({
          id: user.id, contact: user.display_name, displayName: user.display_name,
          email: user.email, signInName: user.username, username: user.username,
          role: user.role_codes[0], roles: user.role_codes, permissions: [], company: 'Internal',
          category: 'internal', department: user.department || '', branchId: user.branch_id || '', phone: user.phone || '', status: user.status,
          lastLoginAt: user.last_login_at, createdAt: user.created_at, loginHistoryCount: 0,
          notificationPreferences: {},
        }));
        const mappedCustomerUsers = customerUsers.rows.map(user => ({
          id:user.id,contact:user.display_name,displayName:user.display_name,email:user.email,signInName:user.username || '',username:user.username || '',
          phone:user.phone || '',role:'customer',roles:['customer'],permissions:[],companyId:user.company_id,company:user.company_name,
          category:'customer',area:user.area || '',branchId:user.branch_id || '',department:'',status:user.status,lastLoginAt:user.last_login_at,
          createdAt:user.created_at,loginHistoryCount:0,notificationPreferences:{ channels:{ inApp:true,email:false,push:false } },
        }));
        const mappedUsers = [...mappedCustomerUsers,...mappedInternalUsers];
        return {
          summary: { users: mappedUsers.length, customerCompanies: companies.rows.length, internalAccounts: mappedInternalUsers.length, auditEvents: auditCount.rows[0]?.count || 0 },
          users: mappedUsers,
          companies: companies.rows.map(company => ({ id: company.id, name: company.name, company: company.name, status: company.status, area: company.area || '', industry: company.industry || '', branchId: company.branch_id || '', contacts: Number(company.contacts || 0), representativeId: company.representative_id || '', createdAt: company.created_at, updatedAt: company.updated_at })),
          representatives: representatives.rows.map(rep => ({ id: rep.id, userId: rep.user_id, name: rep.display_name, displayName: rep.display_name, branch: rep.branch_name, branchName: rep.branch_name, branchId: rep.branch_id || '', code: rep.code || '', active: rep.is_active })),
          branches: [], departments: [],
          accountStatuses: ['active', 'disabled', 'archived'], authenticationTypes: ['password'],
          activationMethods: ['administrator_temporary_password'], correctionRecords: [], archivedRecords: [],
          roles: roles.rows.map(role => ({ id: role.code, label: role.name, permissions: rolePermissions.rows.filter(item => item.role_code === role.code).map(item => item.permission_code) })),
          permissions: permissions.rows.map(item => item.code), catalogue: { categories: [], products: [] }, configurations: {},
        };
      }, { actor });
    },
    async createInternalUser(actor, command) {
      try {
        return await inTransaction(async client => {
          const result = await client.query(`SELECT * FROM app.create_internal_user($1,$2,$3,$4,$5,$6,$7)`, [
            command.id, command.username, command.email, command.displayName, command.passwordHash,
            command.role, command.correlationId,
          ]);
          const row = result.rows[0];
          await client.query('SELECT app.complete_internal_user_profile($1,$2,$3,$4,$5,$6,$7,$8)', [
            row.id, command.phone || '', command.department || '', command.branchId || '', command.additionalRoles || [],
            randomUUID(), command.branchName || command.branchId || 'Unassigned', command.username.toUpperCase().slice(0, 20),
          ]);
          return { id: row.id, username: row.username, email: row.email, displayName: row.display_name, role: row.role_code, status: row.status, createdAt: row.created_at };
        }, { actor });
      } catch (error) {
        if (error.code === '23505') {
          error.code = 'CONFLICT'; error.statusCode = 409; error.message = 'That sign-in name or email is already in use.';
        }
        throw error;
      }
    },
    async createCustomerAccount(actor, command) {
      try {
        return await inTransaction(async client => {
          await client.query('SELECT * FROM app.create_customer_account($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [
            command.companyId, command.userId, command.companyName, command.contactName, command.email, command.phone,
            command.area, command.industry, command.branchId, command.representativeId, command.passwordHash, command.correlationId,
          ]);
          return { company: { id: command.companyId, name: command.companyName, area: command.area, industry: command.industry, branchId: command.branchId, representativeId: command.representativeId || '', status: 'active' }, account: { id: command.userId, contact: command.contactName, displayName: command.contactName, email: command.email, role: 'customer', roles: ['customer'], companyId: command.companyId, company: command.companyName, status: 'active' } };
        }, { actor });
      } catch (error) {
        if (error.code === '23505') { error.code='CONFLICT'; error.statusCode=409; error.message='That company account or email already exists.'; }
        throw error;
      }
    },
    async registerCustomerAccount(command) {
      try {
        return await inTransaction(async client => {
          await client.query('SELECT * FROM app.register_customer_account($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
            command.companyId,command.userId,command.companyName,command.contactName,command.email,command.phone,
            command.area,command.industry,command.branchId,command.passwordHash,command.correlationId,
          ]);
          return {company:{id:command.companyId,name:command.companyName,area:command.area,industry:command.industry,branchId:command.branchId,status:'active'},account:{id:command.userId,email:command.email,displayName:command.contactName,role:'customer',companyId:command.companyId,status:'active'},onboardingStatus:'active'};
        }, { authLookup:true });
      } catch(error) {
        if(error.code==='23505') { error.code='CONFLICT'; error.statusCode=409; error.message='That company account or email already exists.'; }
        throw error;
      }
    },
    async administerUser(actor,userId,operation,payload,correlationId) {
      return inTransaction(async client => (await client.query('SELECT app.administer_user($1,$2,$3::jsonb,$4) AS result',[userId,operation,json(payload),correlationId])).rows[0].result,{actor});
    },
    async softDeleteUser(actor,userId,payload,correlationId) {
      try {
        return await inTransaction(async client => (await client.query('SELECT app.soft_delete_user($1,$2,$3) AS result',[userId,payload.reason,correlationId])).rows[0].result,{actor});
      } catch(error) {
        if(error.code==='22023') { error.code='VALIDATION_ERROR'; error.statusCode=422; }
        if(error.code==='P0002') { error.code='NOT_FOUND'; error.statusCode=404; }
        if(error.code==='42501') { error.code='FORBIDDEN'; error.statusCode=403; }
        throw error;
      }
    },
    async administerCompany(actor,companyId,operation,payload,correlationId) {
      try {
        return await inTransaction(async client => (await client.query('SELECT app.administer_company($1,$2,$3::jsonb,$4) AS result',[companyId,operation,json(payload),correlationId])).rows[0].result,{actor});
      } catch(error) {
        if(error.code==='22023') { error.code='VALIDATION_ERROR'; error.statusCode=422; error.message='Select an active representative assigned to the customer area.'; }
        if(error.code==='P0002') { error.code='NOT_FOUND'; error.statusCode=404; }
        throw error;
      }
    },
    async getUserAudit(actor,userId) {
      return inTransaction(async client => (await client.query(`SELECT id,event_type,actor_user_id,actor_role,action,entity_type,entity_id,outcome,correlation_id,details,created_at FROM app.audit_events WHERE actor_user_id=$1 OR (entity_type='user' AND entity_id=$1::text) ORDER BY created_at DESC LIMIT 200`,[userId])).rows,{actor});
    },
    async getUserLoginHistory(actor,userId) {
      return inTransaction(async client => (await client.query('SELECT * FROM app.admin_user_login_history($1)',[userId])).rows,{actor});
    },
    async saveUserProfileImage(actor,userId,document,correlationId) {
      return inTransaction(async client => {
        const previous=(await client.query('SELECT storage_key FROM app.user_profile_images WHERE user_id=$1',[userId])).rows[0];
        await client.query(`INSERT INTO app.user_profile_images(user_id,storage_key,original_name,media_type,size_bytes,sha256_hex,uploaded_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(user_id) DO UPDATE SET storage_key=EXCLUDED.storage_key,original_name=EXCLUDED.original_name,media_type=EXCLUDED.media_type,size_bytes=EXCLUDED.size_bytes,sha256_hex=EXCLUDED.sha256_hex,uploaded_by_user_id=EXCLUDED.uploaded_by_user_id,updated_at=now()`,[userId,document.storageKey,document.originalName,document.mediaType,document.sizeBytes,document.sha256Hex,actor.id]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('administrator.profile_image_updated',$1,$2,'update_profile_image','user',$3,'success',$4,'{}')`,[actor.id,actor.role,userId,correlationId]);
        return {accountId:userId,profileImageUrl:`/api/v1/admin/users/${userId}/profile-image`,previousStorageKey:previous?.storage_key || null};
      },{actor});
    },
    async getUserProfileImage(actor,userId) {
      return inTransaction(async client => { const row=(await client.query('SELECT * FROM app.user_profile_images WHERE user_id=$1',[userId])).rows[0]; if(!row) throw notFound('The profile image was not found.'); return row; },{actor});
    },
    async removeUserProfileImage(actor,userId,correlationId){return inTransaction(async client=>{const previous=(await client.query('DELETE FROM app.user_profile_images WHERE user_id=$1 RETURNING storage_key',[userId])).rows[0];await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('user.profile_image_removed',$1,$2,'remove_profile_image','user',$3,'success',$4,'{}')`,[actor.id,actor.role,userId,correlationId]);return {storageKey:previous?.storage_key||null};},{actor});},
    async getUserSettings(actor) {
      return inTransaction(async client => {
        const result = await client.query('SELECT settings, row_version, updated_at FROM app.user_settings WHERE user_id = $1', [actor.id]);
        return result.rows[0] || null;
      }, { actor });
    },
    async saveUserSettings(actor, settings) {
      return inTransaction(async client => {
        const result = await client.query(`INSERT INTO app.user_settings (user_id, settings)
          VALUES ($1,$2::jsonb)
          ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings,
            row_version = app.user_settings.row_version + 1, updated_at = now()
          RETURNING settings, row_version, updated_at`, [actor.id, json(settings)]);
        return result.rows[0];
      }, { actor });
    },
    async getNotificationPreferences(actor) {
      return inTransaction(async client => {
        const result = await client.query('SELECT preferences, updated_at FROM app.notification_preferences WHERE user_id = $1', [actor.id]);
        return result.rows[0] || null;
      }, { actor });
    },
    async saveNotificationPreferences(actor, preferences) {
      return inTransaction(async client => {
        const result = await client.query(`INSERT INTO app.notification_preferences (user_id, preferences)
          VALUES ($1,$2::jsonb)
          ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = now()
          RETURNING preferences, updated_at`, [actor.id, json(preferences)]);
        return result.rows[0];
      }, { actor });
    },
    async getEnquiryDraft(actor) {
      return inTransaction(async client => {
        const result = await client.query('SELECT items, updated_at FROM app.enquiry_drafts WHERE user_id = $1', [actor.id]);
        return result.rows[0] || null;
      }, { actor });
    },
    async saveEnquiryDraft(actor, items) {
      return inTransaction(async client => {
        const result = await client.query(`INSERT INTO app.enquiry_drafts (user_id, company_id, items)
          VALUES ($1,$2,$3::jsonb)
          ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id, items = EXCLUDED.items, updated_at = now()
          RETURNING items, updated_at`, [actor.id, actor.companyId, json(items)]);
        return result.rows[0];
      }, { actor });
    },
    async listNotifications(actor) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT n.*, r.reference AS rfq_reference, o.reference AS order_reference
          FROM app.notifications n
          LEFT JOIN app.rfqs r ON r.id = n.rfq_id
          LEFT JOIN app.orders o ON o.id = n.order_id
          WHERE n.recipient_user_id = $1 ORDER BY n.created_at DESC LIMIT 200`, [actor.id]);
        return result.rows.map(row => ({
          id: row.id, companyId: row.company_id, recipientUserId: row.recipient_user_id,
          eventType: row.event_type, title: row.title, message: row.message,
          customerVisible: row.customer_visible, readAt: row.read_at,
          createdAt: row.created_at, rfqId: row.rfq_id, orderId: row.order_id,
          recordId: row.order_id || row.rfq_id, reference: row.order_reference || row.rfq_reference || '',
          link: row.link_path || '', deliveries: row.deliveries || [],
        }));
      }, { actor });
    },
    async markNotificationRead(actor, notificationId) {
      return inTransaction(async client => {
        const result = await client.query(`UPDATE app.notifications SET read_at = COALESCE(read_at, now())
          WHERE id = $1 AND recipient_user_id = $2 RETURNING id, read_at`, [notificationId, actor.id]);
        if (!result.rows[0]) throw notFound('The notification was not found.');
        return { id: result.rows[0].id, readAt: result.rows[0].read_at };
      }, { actor });
    },
    async markAllNotificationsRead(actor) {
      return inTransaction(async client => {
        const result = await client.query('UPDATE app.notifications SET read_at = COALESCE(read_at, now()) WHERE recipient_user_id = $1 AND read_at IS NULL', [actor.id]);
        return { updated: result.rowCount };
      }, { actor });
    },
    async retryNotificationDelivery(actor,notificationId,deliveryId,correlationId){return inTransaction(async client=>{const row=(await client.query('SELECT * FROM app.notifications WHERE id=$1 FOR UPDATE',[notificationId])).rows[0];if(!row)throw notFound('The notification delivery was not found.');const deliveries=Array.isArray(row.deliveries)?row.deliveries:[];const index=deliveries.findIndex(item=>item.id===deliveryId);if(index<0)throw notFound('The notification delivery was not found.');const delivery={...deliveries[index],status:deliveries[index].channel==='in_app'?'in_app':`${deliveries[index].channel}_pending`,attempts:Number(deliveries[index].attempts||0)+1,lastAttemptAt:new Date().toISOString()};deliveries[index]=delivery;await client.query('UPDATE app.notifications SET deliveries=$2::jsonb WHERE id=$1',[notificationId,json(deliveries)]);await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('notification.delivery_retry_requested',$1,$2,$3,'retry_notification_delivery','notification',$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,row.company_id,notificationId,correlationId,json({deliveryId,channel:delivery.channel})]);return delivery;},{actor});},
    async listAuditEvents(actor) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT event.id, event.event_type, event.actor_user_id, event.actor_role,
          event.company_id, event.action, event.entity_type, event.entity_id, event.outcome,
          event.correlation_id, event.details, event.created_at, actor.display_name AS actor_name
          FROM app.audit_events event LEFT JOIN app.users actor ON actor.id = event.actor_user_id
          ORDER BY event.created_at DESC LIMIT 500`);
        return result.rows.map(row => ({
          id: String(row.id), eventType: row.event_type, actorUserId: row.actor_user_id,
          actorRole: row.actor_role, companyId: row.company_id, action: row.action,
          entityType: row.entity_type, entityId: row.entity_id, outcome: row.outcome,
          correlationId: row.correlation_id, details: row.details || {}, timestamp: row.created_at,
          createdAt: row.created_at, actingUser: { id: row.actor_user_id, displayName: row.actor_name || 'System' },
        }));
      }, { actor });
    },
    async listCompanies(actor) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT c.id, c.name, c.status, c.area, c.industry, c.created_at, c.updated_at
          FROM app.companies c ORDER BY c.name`);
        return result.rows.map(row => ({ id: row.id, name: row.name, company: row.name, status: row.status, area: row.area || '', industry: row.industry || '', createdAt: row.created_at, updatedAt: row.updated_at }));
      }, { actor });
    },
    async listRepresentatives(actor) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT rep.id, rep.display_name, rep.branch_name, rep.branch_id, rep.code, rep.user_id, rep.is_active
          FROM app.representatives rep WHERE rep.is_active ORDER BY rep.display_name`);
        return result.rows.map(row => ({ id: row.id, name: row.display_name, displayName: row.display_name, branch: row.branch_name, branchName: row.branch_name, branchId: row.branch_id || '', code: row.code || '', userId: row.user_id, active: row.is_active }));
      }, { actor });
    },
    async getEnquiryRepresentativeOptions(actor) {
      if (!actor.companyId) return {customerArea:'',branchId:'',assignmentStatus:'company_unavailable',dedicatedRepresentative:null,eligibleRepresentatives:[]};
      return inTransaction(async client => {
        const company=(await client.query('SELECT id,area,branch_id FROM app.companies WHERE id=$1 AND status=\'active\' AND deleted_at IS NULL',[actor.companyId])).rows[0];
        if(!company) return {customerArea:'',branchId:'',assignmentStatus:'company_unavailable',dedicatedRepresentative:null,eligibleRepresentatives:[]};
        const assignment=(await client.query(`SELECT rep.id,rep.display_name,rep.branch_name,rep.branch_id,rep.user_id,rep.is_active
          FROM app.representative_company_assignments assignment JOIN app.representatives rep ON rep.id=assignment.representative_id
          WHERE assignment.company_id=$1 AND assignment.ended_at IS NULL ORDER BY assignment.assigned_at DESC LIMIT 1`,[actor.companyId])).rows[0];
        const map=row=>({id:row.id,name:row.display_name,displayName:row.display_name,branch:row.branch_name,branchName:row.branch_name,branchId:row.branch_id || '',userId:row.user_id});
        if(assignment) return {customerArea:company.area || '',branchId:company.branch_id || '',assignmentStatus:assignment.is_active?'assigned':'inactive',dedicatedRepresentative:assignment.is_active?map(assignment):null,eligibleRepresentatives:[]};
        const eligible=company.branch_id ? (await client.query(`SELECT id,display_name,branch_name,branch_id,user_id FROM app.representatives WHERE is_active AND branch_id=$1 ORDER BY display_name`,[company.branch_id])).rows.map(map) : [];
        return {customerArea:company.area || '',branchId:company.branch_id || '',assignmentStatus:company.area&&company.branch_id?'unassigned':'area_missing',dedicatedRepresentative:null,eligibleRepresentatives:eligible};
      }, { actor });
    },
    async listTechnicalUsers(actor) {
      return inTransaction(async client => (await client.query(`SELECT DISTINCT users.id,users.display_name AS name,roles.role_code AS role
        FROM app.users users JOIN app.user_roles roles ON roles.user_id=users.id AND roles.revoked_at IS NULL
        WHERE roles.role_code IN ('technical_support','technical_manager','technical_director') AND users.status='active' AND users.deleted_at IS NULL ORDER BY users.display_name`)).rows,{actor});
    },
    async getCurrentCompany(actor) {
      if (!actor.companyId) return null;
      return inTransaction(async client => {
        const result = await client.query('SELECT id, name, status, area, industry, created_at, updated_at FROM app.companies WHERE id = $1', [actor.companyId]);
        const row = result.rows[0];
        return row ? { id: row.id, name: row.name, company: row.name, status: row.status, area: row.area || '', industry: row.industry || '', createdAt: row.created_at, updatedAt: row.updated_at } : null;
      }, { actor });
    },
    async getRepresentativeOrderOptions(actor) {
      return inTransaction(async client => {
        const companies = await client.query("SELECT id,name,area,industry,branch_id FROM app.companies WHERE status='active' AND deleted_at IS NULL ORDER BY name");
        const contacts = await client.query(`SELECT user_record.id,user_record.display_name AS name,user_record.email,user_record.phone,membership.company_id
            FROM app.company_users membership JOIN app.users user_record ON user_record.id=membership.user_id
            WHERE membership.revoked_at IS NULL AND user_record.status='active' AND user_record.deleted_at IS NULL ORDER BY user_record.display_name`);
        const representatives = await client.query('SELECT id,display_name,branch_name,branch_id,user_id FROM app.representatives WHERE is_active ORDER BY display_name');
        return {
          companies:companies.rows.map(row=>({id:row.id,name:row.name,area:row.area || '',industry:row.industry || '',branchId:row.branch_id || ''})),
          contacts:contacts.rows.map(row=>({id:row.id,name:row.name,contact:row.name,email:row.email,phone:row.phone || '',companyId:row.company_id})),
          representatives:representatives.rows.map(row=>({id:row.id,name:row.display_name,displayName:row.display_name,branch:row.branch_name,branchName:row.branch_name,branchId:row.branch_id || '',userId:row.user_id})),
        };
      }, { actor });
    },
    async checkRepresentativeOrderDuplicate(actor,candidate) {
      return inTransaction(async client => {
        const companyId=String(candidate.companyId || ''); const po=String(candidate.purchaseOrderNumber || '').trim(); const quotation=String(candidate.quotationNumber || '').trim();
        if (!/^[0-9a-f-]{36}$/i.test(companyId) || (!po && !quotation)) return { likelyDuplicate:false,requiresExplicitConfirmation:false,matches:[],checkedAt:new Date().toISOString() };
        const result=await client.query(`SELECT id,reference,purchase_order_number,quotation_number,created_at FROM app.orders
          WHERE company_id=$1 AND deleted_at IS NULL AND status<>'cancelled' AND
          ((NULLIF($2,'') IS NOT NULL AND upper(purchase_order_number)=upper($2)) OR (NULLIF($3,'') IS NOT NULL AND upper(quotation_number)=upper($3)))
          ORDER BY created_at DESC LIMIT 20`,[companyId,po,quotation]);
        const matches=result.rows.map(row=>({orderId:row.id,orderReference:row.reference,samePurchaseOrderNumber:Boolean(po && row.purchase_order_number?.toUpperCase()===po.toUpperCase()),sameQuotationNumber:Boolean(quotation && row.quotation_number?.toUpperCase()===quotation.toUpperCase()),sameProductLines:false,createdAt:row.created_at}));
        return { likelyDuplicate:Boolean(matches.length),requiresExplicitConfirmation:Boolean(matches.length),matches,checkedAt:new Date().toISOString() };
      }, { actor });
    },
    async createRepresentativeOrder(actor,command) {
      return inTransaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${actor.id}:create_representative_order:${command.submissionKey}`]);
        const existing=await client.query(`SELECT response_body FROM app.idempotency_records WHERE user_id=$1 AND operation='create_representative_order' AND idempotency_key=$2 AND expires_at>now()`,[actor.id,command.submissionKey]);
        if (existing.rows[0]) {
          if (existing.rows[0].response_body.requestHash!==command.requestHash) { const error=new Error('This submission key was already used for different order details.'); error.code='IDEMPOTENCY_CONFLICT'; error.statusCode=409; throw error; }
          return { ...existing.rows[0].response_body.result,idempotent:true };
        }
        if (actor.role==='sales_representative' && command.representativeId!==actor.representativeId) { const error=new Error('Representatives may load orders only for their own assignment.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
        const company=(await client.query("SELECT id,name FROM app.companies WHERE id=$1 AND status='active' AND deleted_at IS NULL",[command.companyId])).rows[0];
        if (!company) throw notFound('The selected customer company is unavailable.');
        const contact=(await client.query(`SELECT user_record.id,user_record.display_name FROM app.users user_record JOIN app.company_users membership ON membership.user_id=user_record.id
          WHERE user_record.id=$1 AND membership.company_id=$2 AND membership.revoked_at IS NULL AND user_record.status='active'`,[command.customerContactId,command.companyId])).rows[0];
        if (!contact) throw notFound('The selected customer contact is not authorised for this company.');
        const representative=(await client.query('SELECT id,user_id,display_name,branch_name FROM app.representatives WHERE id=$1 AND is_active',[command.representativeId])).rows[0];
        if (!representative) throw notFound('The selected representative is unavailable.');
        const duplicate=await client.query(`SELECT id,reference FROM app.orders WHERE company_id=$1 AND deleted_at IS NULL AND status<>'cancelled' AND
          (upper(purchase_order_number)=upper($2) OR upper(quotation_number)=upper($3)) LIMIT 10`,[command.companyId,command.purchaseOrderNumber,command.quotationNumber]);
        if (duplicate.rows.length && !command.duplicateConfirmed) { const error=new Error('A likely duplicate order exists. Review it and explicitly confirm before creating another.'); error.code='LIKELY_DUPLICATE'; error.statusCode=409; error.matches=duplicate.rows; throw error; }
        const productIds=command.items.map(item=>item.productId);
        const products=await client.query('SELECT id,code,name,configuration_schema FROM app.products WHERE id=ANY($1::text[]) AND is_active',[productIds]);
        const productMap=new Map(products.rows.map(product=>[product.id,product]));
        if (productMap.size!==new Set(productIds).size) { const error=new Error('One or more selected products are unavailable.'); error.code='INVALID_PRODUCT'; error.statusCode=422; throw error; }
        const id=randomUUID(); const sequence=(await client.query("SELECT nextval('app.order_reference_sequence') AS value")).rows[0].value;
        const reference=`OR-${new Date().getUTCFullYear()}-${String(sequence).padStart(6,'0')}`;
        const details={ sourceOther:command.sourceOther,quotationDate:command.quotationDate,quotationRevision:command.quotationRevision,purchaseOrderDate:command.purchaseOrderDate,confirmationNote:command.confirmationNote,sourceConfirmed:true,loadedByRepresentative:true };
        await client.query(`INSERT INTO app.orders(id,reference,company_id,customer_user_id,representative_id,origin,source,status,internal_priority,application,fulfilment,delivery_address,collection_branch,customer_notes,internal_notes,quotation_number,purchase_order_number,required_date,details,created_by_user_id)
          VALUES($1,$2,$3,$4,$5,'representative_loaded_order',$6,'awaiting_planning',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)`,[id,reference,command.companyId,command.customerContactId,command.representativeId,command.source,command.priority,command.application,command.fulfilment,command.fulfilment==='delivery'?command.deliveryAddress:null,command.fulfilment==='collect'?command.branchId:null,command.customerNotes,command.internalNotes,command.quotationNumber,command.purchaseOrderNumber,command.requiredDate || null,json(details),actor.id]);
        for (const [index,item] of command.items.entries()) { const product=productMap.get(item.productId); assertProductConfiguration(product,item.configuration); await client.query(`INSERT INTO app.order_items(id,order_id,line_number,product_id,product_code_snapshot,product_name_snapshot,quantity,configuration) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[randomUUID(),id,index+1,item.productId,product.code,product.name,item.quantity,json(item.configuration)]); }
        const documents=[];
        for (const document of command.documents) { const kind=document.kind==='quotation'?'quotation':document.kind==='purchaseOrder'?'purchase_order':'supporting_document'; await client.query(`INSERT INTO app.document_metadata(id,company_id,order_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,customer_visible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[document.id,command.companyId,id,actor.id,kind,document.originalName,document.storageKey,document.mediaType,document.sizeBytes,document.sha256Hex,['quotation','purchase_order'].includes(kind)]); documents.push({id:document.id,documentType:kind,fileName:document.originalName,mimeType:document.mediaType,sizeBytes:document.sizeBytes,customerVisible:['quotation','purchase_order'].includes(kind)}); }
        const eventId=randomUUID(); await client.query(`INSERT INTO app.workflow_events(id,company_id,entity_type,entity_id,to_status,action,customer_note,internal_note,customer_visible,actor_user_id,actor_role,metadata) VALUES($1,$2,'order',$3,'awaiting_planning','representative_loaded_order',$4,$5,true,$6,$7,$8::jsonb)`,[eventId,command.companyId,id,'Your accepted order is waiting for Planning.',command.internalNotes,actor.id,actor.role,json({source:command.source})]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('order.representative_loaded',$1,$2,$3,'load_customer_order','order',$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,command.companyId,id,command.correlationId,json({reference,itemCount:command.items.length,documentCount:command.documents.length,representativeId:command.representativeId})]);
        const recipients=new Set([command.customerContactId,representative.user_id]);
        const planning=await client.query("SELECT DISTINCT user_id FROM app.user_roles WHERE role_code='planning' AND revoked_at IS NULL"); for (const row of planning.rows) recipients.add(row.user_id);
        for (const recipient of recipients) await client.query(`INSERT INTO app.notifications(id,company_id,recipient_user_id,order_id,event_type,title,message,customer_visible,link_path) VALUES($1,$2,$3,$4,'representative_order_created','Order loaded',$5,$6,$7)`,[randomUUID(),command.companyId,recipient,id,recipient===command.customerContactId?`${reference} is now available in Rhomberg Connect.`:`${reference} was loaded by Sales and is waiting for Planning.`,recipient===command.customerContactId,`/orders/${id}`]);
        const result={ order:{ id,reference,companyId:command.companyId,company:company.name,contact:contact.display_name,representativeId:command.representativeId,selectedRep:{id:representative.id,name:representative.display_name,branchName:representative.branch_name},workflowType:'order',trackingStatus:'awaiting_planning',status:'awaiting_planning',origin:'representative_loaded_order',source:command.source,application:command.application,fulfilment:command.fulfilment,deliveryAddress:command.deliveryAddress,collectionBranch:command.branchId,priority:command.priority,quotationNumber:command.quotationNumber,purchaseOrderNumber:command.purchaseOrderNumber,items:command.items.map((item,index)=>({id:`${id}-${index+1}`,lineId:`${id}-${index+1}`,productId:item.productId,code:productMap.get(item.productId).code,name:productMap.get(item.productId).name,quantity:item.quantity,configuration:item.configuration})),documents,trackingHistory:[{id:eventId,toStatus:'awaiting_planning',status:'awaiting_planning',action:'representative_loaded_order',customerVisible:true,createdAt:new Date().toISOString()}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString() },duplicateCheck:{likelyDuplicate:Boolean(duplicate.rows.length),matches:duplicate.rows} };
        await client.query(`INSERT INTO app.idempotency_records(user_id,operation,idempotency_key,request_hash,response_status,response_body,expires_at) VALUES($1,'create_representative_order',$2,$3,201,$4::jsonb,now()+interval '24 hours')`,[actor.id,command.submissionKey,command.requestHash,json({requestHash:command.requestHash,result})]);
        return result;
      }, { actor });
    },
    async listOrders(actor) {
      return inTransaction(async client => {
        const queueStatuses = actor.permissions.includes('view_planning_queue') ? ['awaiting_planning','planning_in_progress','planned']
          : actor.permissions.includes('view_expediting_queue') ? ['awaiting_lab_receipt_expediting','submitted_to_expediting','expediting_in_progress','qa_failed','returned_to_expediting','awaiting_qa','awaiting_dispatch','on_hold']
            : actor.permissions.includes('view_lab_queue') ? ['awaiting_lab','lab_received','calibration_in_progress','calibration_on_hold','calibration_completed','awaiting_lab_release','released_from_lab']
              : actor.permissions.includes('view_qa_queue') ? ['awaiting_qa','qa_in_progress','qa_failed','returned_to_expediting','qa_reinspection_required','qa_passed']
                : actor.permissions.includes('view_dispatch_queue') ? ['awaiting_lab_receipt_dispatch','awaiting_dispatch','ready_for_collection','out_for_delivery','delivered','collected'] : null;
        let predicate = actor.permissions.includes('view_all_orders') ? 'TRUE'
          : queueStatuses ? 'o.status = ANY($1::text[])' : 'o.company_id = ANY($1::uuid[])';
        const values = actor.permissions.includes('view_all_orders') ? [] : [queueStatuses || actor.companyIds];
        if (actor.permissions.includes('view_assigned_orders') && !actor.permissions.includes('view_all_orders')) {
          predicate += ` AND o.representative_id = $${values.length + 1}`;
          values.push(actor.representativeId);
        }
        const result = await client.query(`SELECT o.*, c.name AS company_name, customer.display_name AS customer_name,
          rep.display_name AS representative_name, rep.branch_name
          FROM app.orders o JOIN app.companies c ON c.id = o.company_id
          LEFT JOIN app.users customer ON customer.id = o.customer_user_id
          LEFT JOIN app.representatives rep ON rep.id = o.representative_id
          WHERE ${predicate} AND o.deleted_at IS NULL ORDER BY o.updated_at DESC LIMIT 200`, values);
        const records = [];
        for (const row of result.rows) {
          const items = await client.query('SELECT * FROM app.order_items WHERE order_id = $1 ORDER BY line_number', [row.id]);
          const history = await client.query("SELECT * FROM app.workflow_events WHERE entity_type = 'order' AND entity_id = $1 ORDER BY created_at", [row.id]);
          records.push({
            id: row.id, reference: row.reference, workflowType: 'order', trackingStatus: row.status,
            status: row.status, companyId: row.company_id, company: row.company_name,
            contact: row.customer_name || '', representativeId: row.representative_id,
            selectedRep: { id: row.representative_id, name: row.representative_name || '', branchName: row.branch_name || '' },
            application: row.application, fulfilment: row.fulfilment, deliveryAddress: row.delivery_address || '',
            collectionBranch: row.collection_branch || '', notes: row.customer_notes || '', priority: row.internal_priority,
            poNumber: row.purchase_order_number || '', quotationNumber: row.quotation_number || '', origin: row.origin,
            version: row.row_version, details: row.details || {}, laboratory: row.details?.laboratory || undefined, createdAt: row.created_at, updatedAt: row.updated_at,
            items: items.rows.map(item => ({ id: item.id, lineId: item.id, productId: item.product_id, code: item.product_code_snapshot, name: item.product_name_snapshot, quantity: item.quantity, configuration: item.configuration, unitState: item.unit_state })),
            trackingHistory: history.rows.map(event => ({ id: event.id, fromStatus: event.from_status, toStatus: event.to_status, status: event.to_status, entityType: 'order', action: event.action, note: event.customer_note || event.internal_note || '', customerVisible: event.customer_visible, createdAt: event.created_at })),
            allowedWorkflowActions: [],
          });
        }
        return records;
      }, { actor });
    },
    async getOrder(actor,id) { return inTransaction(client=>loadOrder(client,id),{actor}); },
    async performWorkflowAction(actor,command) {
      return inTransaction(async client => {
        const table=command.entityType==='rfq'?'rfqs':'orders';
        const record=(await client.query(`SELECT * FROM app.${table} WHERE id=$1 FOR UPDATE`,[command.id])).rows[0];
        if (!record) throw notFound(`The ${command.entityType === 'rfq' ? 'RFQ' : 'order'} was not found or is outside your authorised scope.`);
        if (!command.definition.from.includes(record.status)) { const error=new Error(`This action is not allowed while the record is ${record.status}.`); error.code='INVALID_WORKFLOW_TRANSITION'; error.statusCode=409; throw error; }
        if (actor.role==='sales_representative' && record.representative_id!==actor.representativeId) { const error=new Error('This record is assigned to another representative.'); error.code='FORBIDDEN'; error.statusCode=403; throw error; }
        if (command.entityType==='rfq' && command.action==='mark_quoted') {
          const pending=await client.query("SELECT 1 FROM app.technical_support_requests WHERE rfq_id=$1 AND status NOT IN ('technical_support_completed','technical_support_cancelled') LIMIT 1",[record.id]);
          if (pending.rows[0]) { const error=new Error('Technical Review Pending. Complete or formally override the technical request before marking the RFQ quoted.'); error.code='TECHNICAL_REVIEW_PENDING'; error.statusCode=409; throw error; }
        }
        let toStatus=command.definition.to; const details={...(record.details || {})};
        if (toStatus==='__resume__') toStatus=details.previousStatus || 'expediting_in_progress';
        if (command.action==='place_on_hold') details.previousStatus=record.status;
        if (command.action==='mark_quoted') details.quotation={...command.data.quotation,recordedAt:new Date().toISOString(),recordedBy:actor.id};
        if (command.action==='complete_planning') details.planning={...(command.data.planning || command.data),completedAt:new Date().toISOString(),completedBy:actor.id};
        if (['start_expediting','add_expediting_update'].includes(command.action)) details.expeditingUpdates=[...(details.expeditingUpdates || []),{...(command.data.expeditingUpdate || command.data),createdAt:new Date().toISOString(),createdBy:actor.id}];
        if (command.action.includes('qa') || ['pass_qa','fail_qa'].includes(command.action)) details.qualityUpdates=[...(details.qualityUpdates || []),{action:command.action,...command.data,createdAt:new Date().toISOString(),createdBy:actor.id}];
        if (['mark_ready_for_collection','start_delivery','confirm_collection','confirm_delivery','complete_collection','complete_delivery'].includes(command.action)) details.dispatchUpdates=[...(details.dispatchUpdates || []),{action:command.action,...command.data,createdAt:new Date().toISOString(),createdBy:actor.id}];
        let orderId=null; let orderReference='';
        if (command.entityType==='rfq' && command.action==='accept_order') {
          details.acceptance={...command.data.acceptance,recordedAt:new Date().toISOString(),recordedBy:actor.id};
          orderId=randomUUID(); const sequence=(await client.query("SELECT nextval('app.order_reference_sequence') AS value")).rows[0].value; orderReference=`OR-${new Date().getUTCFullYear()}-${String(sequence).padStart(6,'0')}`;
          await client.query(`INSERT INTO app.orders(id,reference,source_rfq_id,company_id,customer_user_id,representative_id,origin,source,status,internal_priority,application,fulfilment,delivery_address,collection_branch,customer_notes,details,created_by_user_id)
            VALUES($1,$2,$3,$4,$5,$6,'customer_submitted_rfq_order','application','awaiting_planning',$7,$8,$9,$10,$11,$12,$13::jsonb,$14)`,[orderId,orderReference,record.id,record.company_id,record.requester_user_id,record.representative_id,record.internal_priority,record.application,record.fulfilment,record.delivery_address,record.collection_branch,record.customer_notes,json({acceptance:details.acceptance}),actor.id]);
          const sourceItems=(await client.query('SELECT * FROM app.rfq_items WHERE rfq_id=$1 ORDER BY line_number',[record.id])).rows;
          for (const item of sourceItems) await client.query(`INSERT INTO app.order_items
            (id,order_id,line_number,product_id,product_code_snapshot,product_name_snapshot,quantity,configuration)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[randomUUID(),orderId,item.line_number,item.product_id,item.product_code_snapshot,item.product_name_snapshot,item.quantity,json(item.configuration)]);
          await client.query(`INSERT INTO app.workflow_events(id,company_id,entity_type,entity_id,to_status,action,customer_note,customer_visible,actor_user_id,actor_role,metadata)
            VALUES($1,$2,'order',$3,'awaiting_planning','order_created','Your accepted order is waiting for Planning.',true,$4,$5,$6::jsonb)`,[randomUUID(),record.company_id,orderId,actor.id,actor.role,json({sourceRfqId:record.id})]);
          details.orderId=orderId; details.orderReference=orderReference;
        }
        await client.query(`UPDATE app.${table} SET status=$2,details=$3::jsonb,row_version=row_version+1,updated_at=now()${command.entityType==='order' && ['complete_collection','complete_delivery'].includes(command.action)?',completed_at=now()':''} WHERE id=$1`,[record.id,toStatus,json(details)]);
        const companyId=record.company_id; const eventId=randomUUID(); const customerNote=String(command.data?.customerMessage || command.data?.expeditingUpdate?.customerMessage || command.data?.dispatchUpdate?.customerMessage || '').trim();
        await client.query(`INSERT INTO app.workflow_events(id,company_id,entity_type,entity_id,from_status,to_status,action,customer_note,internal_note,customer_visible,actor_user_id,actor_role,metadata)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,[eventId,companyId,command.entityType,record.id,record.status,toStatus,command.action,customerNote || null,command.comment || null,Boolean(customerNote || ['acknowledge_quotation','accept_order','start_planning','submit_to_expediting','mark_ready_for_collection','start_delivery','confirm_collection','confirm_delivery','complete_collection','complete_delivery'].includes(command.action)),actor.id,actor.role,json({orderId,orderReference})]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
          VALUES('workflow.transition',$1,$2,$3,$4,$5,$6,'success',$7,$8::jsonb)`,[actor.id,actor.role,companyId,command.action,command.entityType,record.id,command.correlationId,json({fromStatus:record.status,toStatus,orderId})]);
        const customerUserId=command.entityType==='rfq'?record.requester_user_id:record.customer_user_id; const representative=(await client.query('SELECT user_id FROM app.representatives WHERE id=$1',[record.representative_id])).rows[0]?.user_id;
        const recipients=new Set([customerUserId,representative].filter(Boolean));
        const roleForAction=command.action==='accept_order'?'planning':command.action==='submit_to_expediting'?'expeditor':command.action==='release_qa_order'?'dispatch':null;
        if (roleForAction) for (const row of (await client.query('SELECT user_id FROM app.user_roles WHERE role_code=$1 AND revoked_at IS NULL',[roleForAction])).rows) recipients.add(row.user_id);
        for (const recipient of recipients) await client.query(`INSERT INTO app.notifications(id,company_id,recipient_user_id,rfq_id,order_id,event_type,title,message,customer_visible,link_path)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[randomUUID(),companyId,recipient,command.entityType==='rfq'?record.id:null,command.entityType==='order'?record.id:orderId,`workflow_${command.action}`,command.definition.label,customerNote || `Status updated to ${toStatus.replaceAll('_',' ')}.`,recipient===customerUserId,command.entityType==='rfq'?`/rfqs/${record.id}`:`/orders/${record.id}`]);
        return command.entityType==='rfq' ? { enquiry:await loadEnquiry(client,record.id),order:orderId?await loadOrder(client,orderId):null } : { order:await loadOrder(client,record.id) };
      }, { actor });
    },
    async listLocations(actor) {
      return inTransaction(async client => {
        const result = await client.query('SELECT * FROM app.locations ORDER BY name');
        return result.rows.map(row => ({ id: row.id, name: row.name, branch: row.name, branchId: row.branch_code, branchCode: row.branch_code, address: row.address, latitude: row.latitude === null ? null : Number(row.latitude), longitude: row.longitude === null ? null : Number(row.longitude), radiusMetres: row.radius_metres, status: row.status, active: row.status === 'active', createdAt: row.created_at, updatedAt: row.updated_at }));
      }, { actor });
    },
    async saveLocation(actor, location) {
      return inTransaction(async client => {
        const id = location.id || randomUUID();
        const result = await client.query(`INSERT INTO app.locations
          (id,name,branch_code,address,latitude,longitude,radius_metres,status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,branch_code=EXCLUDED.branch_code,
            address=EXCLUDED.address,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
            radius_metres=EXCLUDED.radius_metres,status=EXCLUDED.status,updated_at=now()
          RETURNING *`, [id, location.name, location.branchCode, location.address, location.latitude, location.longitude, location.radiusMetres, location.status]);
        const row = result.rows[0];
        await client.query(`INSERT INTO app.audit_events
          (event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
          VALUES ('location.saved',$1,$2,NULL,'save_location','location',$3,'success',$4,$5::jsonb)`,
        [actor.id, actor.role, id, location.correlationId, json({ branchCode: row.branch_code, status: row.status })]);
        return { id: row.id, name: row.name, branch: row.name, branchId: row.branch_code, branchCode: row.branch_code, address: row.address, latitude: Number(row.latitude), longitude: Number(row.longitude), radiusMetres: row.radius_metres, status: row.status, active: row.status === 'active', createdAt: row.created_at, updatedAt: row.updated_at };
      }, { actor });
    },
    async listTechnicalRequests(actor) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT request.*, rfq.reference AS rfq_reference, company.name AS company_name,
          representative.display_name AS representative_name, requester.display_name AS requester_name,
          assignee.display_name AS assignee_name
          FROM app.technical_support_requests request
          JOIN app.rfqs rfq ON rfq.id=request.rfq_id JOIN app.companies company ON company.id=request.company_id
          JOIN app.representatives representative ON representative.id=request.representative_id
          JOIN app.users requester ON requester.id=request.requested_by_user_id
          LEFT JOIN app.users assignee ON assignee.id=request.assigned_user_id
          ORDER BY request.updated_at DESC`);
        const records = [];
        for (const row of result.rows) {
          const messages = await client.query('SELECT * FROM app.technical_support_messages WHERE request_id=$1 ORDER BY created_at', [row.id]);
          records.push({ id: row.id, reference: row.reference, rfqId: row.rfq_id, rfqReference: row.rfq_reference, companyId: row.company_id, company: row.company_name, representativeId: row.representative_id, representativeName: row.representative_name, requestedBy: row.requester_name, assignedTechnicalUserId: row.assigned_user_id, assignedTechnicalUserName: row.assignee_name || '', category: row.category, question: row.question, lineItemId: row.line_item_id, priority: row.priority, classification: row.classification, status: row.status, originalQuotationTarget: row.original_due_at, revisedQuotationTarget: row.revised_due_at, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, messages: messages.rows.map(message => ({ id: message.id, message: message.message, sender: message.sender_user_id, senderRole: message.sender_role, classification: message.classification, metadata: message.metadata, createdAt: message.created_at })) });
        }
        return records;
      }, { actor });
    },
    async getTechnicalSupportByRfq(actor,rfqId) {
      return inTransaction(async client => {
        const row=(await client.query('SELECT id FROM app.technical_support_requests WHERE rfq_id=$1 ORDER BY created_at DESC LIMIT 1',[rfqId])).rows[0];
        if(!row) return null;
        const records=await client.query(`SELECT request.*, rfq.reference AS rfq_reference, company.name AS company_name,
          representative.display_name AS representative_name, requester.display_name AS requester_name, assignee.display_name AS assignee_name
          FROM app.technical_support_requests request JOIN app.rfqs rfq ON rfq.id=request.rfq_id JOIN app.companies company ON company.id=request.company_id
          JOIN app.representatives representative ON representative.id=request.representative_id JOIN app.users requester ON requester.id=request.requested_by_user_id
          LEFT JOIN app.users assignee ON assignee.id=request.assigned_user_id WHERE request.id=$1`,[row.id]);
        const item=records.rows[0]; const messages=(await client.query('SELECT * FROM app.technical_support_messages WHERE request_id=$1 ORDER BY created_at',[item.id])).rows;
        return {id:item.id,reference:item.reference,rfqId:item.rfq_id,rfqReference:item.rfq_reference,companyId:item.company_id,company:item.company_name,representativeId:item.representative_id,representativeName:item.representative_name,requestedBy:item.requester_name,assignedTechnicalUserId:item.assigned_user_id,assignedTechnicalUserName:item.assignee_name || '',category:item.category,question:item.question,lineItemId:item.line_item_id,priority:item.priority,classification:item.classification,status:item.status,originalQuotationTarget:item.original_due_at,revisedQuotationTarget:item.revised_due_at,createdAt:item.created_at,updatedAt:item.updated_at,completedAt:item.completed_at,messages:messages.map(message=>({id:message.id,message:message.message,sender:message.sender_user_id,senderRole:message.sender_role,classification:message.classification,metadata:message.metadata,createdAt:message.created_at}))};
      },{actor});
    },
    async createTechnicalSupportRequest(actor,rfqId,command) {
      return inTransaction(async client => {
        const rfq=(await client.query('SELECT * FROM app.rfqs WHERE id=$1 FOR UPDATE',[rfqId])).rows[0]; if(!rfq) throw notFound('The RFQ was not found or is outside your authorised scope.');
        const line=(await client.query('SELECT id FROM app.rfq_items WHERE id=$1 AND rfq_id=$2',[command.lineItemId,rfqId])).rows[0]; if(!line) { const error=new Error('Select a line item from this RFQ.'); error.code='VALIDATION_ERROR'; error.statusCode=422; throw error; }
        const active=(await client.query("SELECT id FROM app.technical_support_requests WHERE rfq_id=$1 AND status NOT IN ('technical_support_completed','technical_support_cancelled')",[rfqId])).rows[0]; if(active) { const error=new Error('This RFQ already has an active Technical Support request.'); error.code='CONFLICT'; error.statusCode=409; throw error; }
        const original=rfq.details?.quotationTargetAt || new Date(new Date(rfq.submitted_at).getTime()+72*36e5).toISOString(); const revised=new Date(new Date(original).getTime()+24*36e5).toISOString(); const reference=`TS-${new Date().getUTCFullYear()}-${command.id.slice(0,8).toUpperCase()}`;
        await client.query(`INSERT INTO app.technical_support_requests(id,reference,rfq_id,company_id,representative_id,requested_by_user_id,assigned_user_id,category,question,line_item_id,priority,classification,original_due_at,revised_due_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[command.id,reference,rfqId,rfq.company_id,rfq.representative_id,actor.id,command.requestedTechnicalUserId || null,command.category,command.question,command.lineItemId,command.priority,command.classification,original,revised]);
        if(command.document) await client.query(`INSERT INTO app.document_metadata(id,company_id,rfq_id,technical_request_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,scan_status,customer_visible)
          VALUES($1,$2,$3,$4,$5,'technical_attachment',$6,$7,$8,$9,$10,'pending',$11)`,[randomUUID(),rfq.company_id,rfqId,command.id,actor.id,command.document.originalName,command.document.storageKey,command.document.mediaType,command.document.sizeBytes,command.document.sha256Hex,command.classification==='customer_safe']);
        await client.query('UPDATE app.rfqs SET details=details || $2::jsonb,updated_at=now(),row_version=row_version+1 WHERE id=$1',[rfqId,json({technicalSupportRequestId:command.id,originalQuotationTarget:original,revisedQuotationTarget:revised})]);
        await client.query(`INSERT INTO app.workflow_events(id,company_id,entity_type,entity_id,to_status,action,customer_note,internal_note,customer_visible,actor_user_id,actor_role,metadata)
          VALUES($1,$2,'technical_support',$3,'technical_support_requested','request_technical_support',$4,$5,true,$6,$7,$8::jsonb)`,[randomUUID(),rfq.company_id,command.id,'Technical review is required for your enquiry. The quotation timeframe has been extended by up to 24 hours.',command.question,actor.id,actor.role,json({rfqId,originalQuotationTarget:original,revisedQuotationTarget:revised})]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('technical_support.requested',$1,$2,$3,'request_technical_support','technical_support',$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,rfq.company_id,command.id,command.correlationId,json({rfqId,originalQuotationTarget:original,revisedQuotationTarget:revised})]);
        const recipients=new Set(); const repUser=(await client.query('SELECT user_id FROM app.representatives WHERE id=$1',[rfq.representative_id])).rows[0]?.user_id; if(repUser) recipients.add(repUser); for(const row of (await client.query("SELECT user_id FROM app.user_roles WHERE role_code IN ('technical_support','technical_manager','technical_director') AND revoked_at IS NULL")).rows) recipients.add(row.user_id);
        for(const recipient of recipients) await client.query(`INSERT INTO app.notifications(id,company_id,recipient_user_id,rfq_id,event_type,title,message,customer_visible,link_path) VALUES($1,$2,$3,$4,'technical_support_requested','Technical Support request', $5,false,$6)`,[randomUUID(),rfq.company_id,recipient,rfqId,`${reference} requires review.`,`/technical/${command.id}`]);
        return (await client.query('SELECT * FROM app.technical_support_requests WHERE id=$1',[command.id])).rows[0];
      },{actor});
    },
    async transitionTechnicalSupport(actor,id,command) {
      return inTransaction(async client => {
        const record=(await client.query('SELECT * FROM app.technical_support_requests WHERE id=$1 FOR UPDATE',[id])).rows[0]; if(!record) throw notFound('The Technical Support request was not found.');
        const allowed={assign:['technical_support_requested'],start_review:['technical_support_assigned'],complete:['technical_response_submitted']}; if(allowed[command.action] && !allowed[command.action].includes(record.status)) { const error=new Error('This Technical Support action is not available at the current stage.'); error.code='INVALID_WORKFLOW_TRANSITION'; error.statusCode=409; throw error; }
        if(command.action==='assign') { const user=(await client.query("SELECT 1 FROM app.user_roles WHERE user_id=$1 AND role_code IN ('technical_support','technical_manager','technical_director') AND revoked_at IS NULL",[command.assignedUserId])).rows[0]; if(!user) { const error=new Error('Select an active Technical Advisor.'); error.code='VALIDATION_ERROR'; error.statusCode=422; throw error; } }
        const metadata=command.action==='override'?{quotationOverride:{active:true,reason:command.reason,actorUserId:actor.id,createdAt:new Date().toISOString()}}:{};
        const result=(await client.query(`UPDATE app.technical_support_requests SET status=COALESCE($2,status),assigned_user_id=COALESCE($3,assigned_user_id),updated_at=now(),completed_at=CASE WHEN $2='technical_support_completed' THEN now() ELSE completed_at END WHERE id=$1 RETURNING *`,[id,command.toStatus,command.assignedUserId || null])).rows[0];
        await client.query(`INSERT INTO app.workflow_events(id,company_id,entity_type,entity_id,from_status,to_status,action,internal_note,customer_visible,actor_user_id,actor_role,metadata) VALUES($1,$2,'technical_support',$3,$4,$5,$6,$7,false,$8,$9,$10::jsonb)`,[randomUUID(),record.company_id,id,record.status,result.status,command.action,command.comment || command.reason || null,actor.id,actor.role,json(metadata)]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES($1,$2,$3,$4,$5,'technical_support',$6,'success',$7,$8::jsonb)`,[`technical_support.${command.action}`,actor.id,actor.role,record.company_id,command.action,id,command.correlationId,json({fromStatus:record.status,toStatus:result.status,...metadata})]); return result;
      },{actor});
    },
    async addTechnicalSupportMessage(actor,id,command) {
      return inTransaction(async client => {
        const record=(await client.query('SELECT * FROM app.technical_support_requests WHERE id=$1 FOR UPDATE',[id])).rows[0]; if(!record) throw notFound('The Technical Support request was not found.'); const messageId=randomUUID();
        await client.query(`INSERT INTO app.technical_support_messages(id,request_id,company_id,sender_user_id,sender_role,message,classification,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[messageId,id,record.company_id,actor.id,actor.role,command.message,command.classification,json(command.metadata || {})]);
        if(command.document) await client.query(`INSERT INTO app.document_metadata(id,company_id,rfq_id,technical_request_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,scan_status,customer_visible) VALUES($1,$2,$3,$4,$5,'technical_attachment',$6,$7,$8,$9,$10,'pending',$11)`,[randomUUID(),record.company_id,record.rfq_id,id,actor.id,command.document.originalName,command.document.storageKey,command.document.mediaType,command.document.sizeBytes,command.document.sha256Hex,command.classification==='customer_safe']);
        if(command.toStatus) await client.query('UPDATE app.technical_support_requests SET status=$2,updated_at=now() WHERE id=$1',[id,command.toStatus]); else await client.query('UPDATE app.technical_support_requests SET updated_at=now() WHERE id=$1',[id]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('technical_support.message_posted',$1,$2,$3,$4,'technical_support',$5,'success',$6,$7::jsonb)`,[actor.id,actor.role,record.company_id,command.action,id,command.correlationId,json({classification:command.classification,toStatus:command.toStatus || record.status})]);
        return {id:messageId,requestId:id,status:command.toStatus || record.status,message:command.message,classification:command.classification,createdAt:new Date().toISOString()};
      },{actor});
    },
    async getPolicy(actor, code) {
      return inTransaction(async client => (await client.query('SELECT value, updated_at FROM app.platform_policies WHERE code = $1', [code])).rows[0] || null, { actor });
    },
    async savePolicy(actor, code, value) {
      return inTransaction(async client => (await client.query(`INSERT INTO app.platform_policies(code,value,updated_by_user_id)
        VALUES ($1,$2::jsonb,$3) ON CONFLICT(code) DO UPDATE SET value=EXCLUDED.value,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=now()
        RETURNING value,updated_at`, [code, json(value), actor.id])).rows[0], { actor });
    },
    async listEnquiries(actor) {
      return inTransaction(async client => {
        let predicate = actor.permissions.includes('view_all_rfqs') ? 'TRUE' : 'r.company_id = ANY($1::uuid[])';
        const values = actor.permissions.includes('view_all_rfqs') ? [] : [actor.companyIds];
        if (actor.permissions.includes('view_assigned_rfqs') && !actor.permissions.includes('view_all_rfqs')) {
          predicate += ` AND r.representative_id = $${values.length + 1}`;
          values.push(actor.representativeId);
        }
        const result = await client.query(`${enquirySelect} WHERE ${predicate} ORDER BY r.created_at DESC LIMIT 100`, values);
        return result.rows.map(row => mapEnquiry(row));
      }, { actor });
    },
    async getEnquiry(actor, id) {
      return inTransaction(client => loadEnquiry(client, id), { actor });
    },
    async getDocument(actor, id) {
      return inTransaction(async client => {
        const result = await client.query(`SELECT id, company_id, rfq_id, order_id, technical_request_id, uploaded_by_user_id,
          kind, original_name, storage_key, media_type, size_bytes,
          sha256_hex, scan_status, customer_visible, created_at
          FROM app.document_metadata WHERE id = $1 AND deleted_at IS NULL`, [id]);
        if (!result.rows[0]) throw notFound('The document was not found or is outside your authorised company account.');
        return result.rows[0];
      }, { actor });
    },
    async saveLaboratoryCertificate(actor, command) {
      return inTransaction(async client => {
        const order = (await client.query('SELECT id,company_id,details FROM app.orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [command.orderId])).rows[0];
        if (!order) throw notFound('The order was not found or is outside your authorised scope.');
        const laboratory = order.details?.laboratory || {};
        const units = Array.isArray(laboratory.units) ? [...laboratory.units] : [];
        const index = units.findIndex(unit => unit.id === command.unit.id);
        const current = index >= 0 ? units[index] : command.unit;
        if (command.replacement && !current.certificateId) { const error = new Error('There is no certificate to replace.'); error.code = 'CONFLICT'; error.statusCode = 409; throw error; }
        if (!command.replacement && current.certificateId) { const error = new Error('Use controlled replacement for an existing certificate.'); error.code = 'CONFLICT'; error.statusCode = 409; throw error; }
        await client.query(`INSERT INTO app.document_metadata(id,company_id,order_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,scan_status,customer_visible)
          VALUES($1,$2,$3,$4,'certificate',$5,$6,$7,$8,$9,'pending',true)`, [command.certificateId, order.company_id, order.id, actor.id, command.document.originalName, command.document.storageKey, command.document.mediaType, command.document.sizeBytes, command.document.sha256Hex]);
        const now = new Date().toISOString();
        const previous = current.certificateId ? { id: current.certificateId, certificateNumber: current.certificateNumber, issueDate: current.certificateIssueDate, serialNumber: current.serialNumber, replacedAt: now, replacementReason: command.unit.reason } : null;
        const updated = { ...current, ...command.unit, certificateId: command.certificateId, certificateNumber: command.unit.certificateNumber, certificateIssueDate: command.unit.issueDate, serialNumber: command.unit.serialNumber, certificateStatus: 'uploaded', status: 'certificate_uploaded', certificateUploadedAt: now, updatedAt: now, certificateVersions: [...(current.certificateVersions || []), ...(previous ? [previous] : [])] };
        if (index >= 0) units[index] = updated; else units.push(updated);
        const details = { ...(order.details || {}), laboratory: { ...laboratory, units, lastUpdatedAt: now } };
        await client.query('UPDATE app.orders SET details=$2::jsonb,row_version=row_version+1,updated_at=now() WHERE id=$1', [order.id, json(details)]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
          VALUES($1,$2,$3,$4,$5,'document',$6,'success',$7,$8::jsonb)`, [command.replacement ? 'certificate.replaced' : 'certificate.uploaded', actor.id, actor.role, order.company_id, command.replacement ? 'replace_certificate' : 'upload_certificate', command.certificateId, command.correlationId, json({ orderId: order.id, unitId: command.unit.id, previousCertificateId: previous?.id || null })]);
        const customer = (await client.query('SELECT customer_user_id FROM app.orders WHERE id=$1', [order.id])).rows[0]?.customer_user_id;
        if (customer) await client.query(`INSERT INTO app.notifications(id,company_id,recipient_user_id,order_id,event_type,title,message,customer_visible,link_path)
          VALUES($1,$2,$3,$4,'certificate_available','Certificate update','A calibration certificate has been added to your order.',true,$5)`, [randomUUID(), order.company_id, customer, order.id, `/tracking/${order.id}`]);
        return updated;
      }, { actor });
    },
    async archiveLaboratoryCertificates(actor, orderId, correlationId) {
      return inTransaction(async client => {
        const order=(await client.query('SELECT id,company_id,details FROM app.orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[orderId])).rows[0];
        if(!order) throw notFound('The order was not found or is outside your authorised scope.');
        const laboratory=order.details?.laboratory || {}; const units=(laboratory.units || []).map(unit=>unit.certificateId?{...unit,certificateStatus:'archived',updatedAt:new Date().toISOString()}:unit);
        const details={...(order.details || {}),laboratory:{...laboratory,units,archivedAt:new Date().toISOString()}};
        await client.query('UPDATE app.orders SET details=$2::jsonb,row_version=row_version+1,updated_at=now() WHERE id=$1',[orderId,json(details)]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('certificate.archived',$1,$2,$3,'archive_certificates','order',$4,'success',$5,'{}')`,[actor.id,actor.role,order.company_id,orderId,correlationId]);
        return { orderId, archived: true, units };
      },{actor});
    },
    async listOrderDocuments(actor,orderId) {
      return inTransaction(async client => (await client.query(`SELECT id,order_id,kind AS document_type,original_name AS file_name,media_type,size_bytes,scan_status,customer_visible,version,supersedes_document_id,created_at FROM app.document_metadata WHERE order_id=$1 AND deleted_at IS NULL ORDER BY kind,version DESC,created_at DESC`,[orderId])).rows.map(row=>({...row,id:row.id,orderId:row.order_id,documentType:row.document_type,fileName:row.file_name,mimeType:row.media_type,sizeBytes:Number(row.size_bytes),scanStatus:row.scan_status,customerVisible:row.customer_visible,supersedesDocumentId:row.supersedes_document_id,createdAt:row.created_at})),{actor});
    },
    async replaceOrderDocument(actor,command) {
      return inTransaction(async client=>{
        const order=(await client.query('SELECT id,company_id FROM app.orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[command.orderId])).rows[0]; if(!order) throw notFound('The order was not found.');
        const previous=(await client.query("SELECT * FROM app.document_metadata WHERE id=$1 AND order_id=$2 AND kind IN ('quotation','purchase_order') AND deleted_at IS NULL",[command.documentId,order.id])).rows[0]; if(!previous) throw notFound('The source document was not found.');
        const version=(await client.query('SELECT COALESCE(max(version),0)+1 AS value FROM app.document_metadata WHERE order_id=$1 AND kind=$2',[order.id,previous.kind])).rows[0].value;
        await client.query(`INSERT INTO app.document_metadata(id,company_id,order_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,scan_status,customer_visible,version,supersedes_document_id,replacement_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$13,$14)`,[command.document.id,order.company_id,order.id,actor.id,previous.kind,command.document.originalName,command.document.storageKey,command.document.mediaType,command.document.sizeBytes,command.document.sha256Hex,previous.customer_visible,version,previous.id,command.reason]);
        await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('document.replaced',$1,$2,$3,'replace_order_source_document','document',$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,order.company_id,command.document.id,command.correlationId,json({orderId:order.id,previousDocumentId:previous.id,reason:command.reason,version})]);
        return {id:command.document.id,orderId:order.id,documentType:previous.kind,fileName:command.document.originalName,version:Number(version),scanStatus:'pending',customerVisible:previous.customer_visible};
      },{actor});
    },
    async saveGeneratedOrderDocument(actor,command) {
      return inTransaction(async client=>{const order=(await client.query('SELECT id,company_id FROM app.orders WHERE id=$1 AND deleted_at IS NULL',[command.orderId])).rows[0];if(!order)throw notFound('The order was not found.');await client.query(`INSERT INTO app.document_metadata(id,company_id,order_id,uploaded_by_user_id,kind,original_name,storage_key,media_type,size_bytes,sha256_hex,scan_status,customer_visible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'clean',$11)`,[command.document.id,order.company_id,order.id,actor.id,command.kind,command.document.originalName,command.document.storageKey,command.document.mediaType,command.document.sizeBytes,command.document.sha256Hex,command.customerVisible]);await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('order.summary_generated',$1,$2,$3,'export_order_pdf','document',$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,order.company_id,command.document.id,command.correlationId,json({orderId:order.id,customerVisible:command.customerVisible})]);return {id:command.document.id,orderId:order.id,fileName:command.document.originalName,mediaType:'application/pdf',customerVisible:command.customerVisible,downloadUrl:`/api/v1/orders/${order.id}/source-documents/${command.document.id}/download`};},{actor});
    },
    async recordOrderEmail(actor,orderId,command) {return inTransaction(async client=>{const order=(await client.query('SELECT id,company_id FROM app.orders WHERE id=$1',[orderId])).rows[0];if(!order)throw notFound('The order was not found.');if(command.recipient&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(command.recipient)){const error=new Error('Enter a valid recipient email address.');error.code='VALIDATION_ERROR';error.statusCode=422;throw error;}await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('order.summary_email_pending',$1,$2,$3,'email_order_summary','order',$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,order.company_id,order.id,command.correlationId,json({recipient:command.recipient?'<validated-recipient>':'assigned-parties',deliveryStatus:'email_pending'})]);return {orderId,status:'email_pending',simulated:true};},{actor});},
    async mutateOrderGovernance(actor,orderId,operation,payload,correlationId) {return inTransaction(async client=>{const order=(await client.query('SELECT * FROM app.orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[orderId])).rows[0];if(!order)throw notFound('The order was not found.');const details={...(order.details || {})};const hold=Boolean(details.legalHold?.active);let status=order.status;let archivedAt=order.archived_at;
      if(['archive','deletion_request'].includes(operation)&&hold){const error=new Error('This record is protected by a legal hold.');error.code='LEGAL_HOLD_ACTIVE';error.statusCode=409;throw error;}
      if(operation==='approve_archive') details.archiveApproval={approved:true,reason:String(payload.reason || ''),approvedBy:actor.id,approvedAt:new Date().toISOString()};
      if(operation==='legal_hold'){details.legalHold={active:Boolean(payload.active),reason:String(payload.reason || ''),changedBy:actor.id,changedAt:new Date().toISOString()};}
      if(operation==='archive'){if(order.status!=='completed'){const error=new Error('Only completed orders can be archived.');error.code='INVALID_ARCHIVE_STATUS';error.statusCode=409;throw error;}const policy=(await client.query("SELECT value FROM app.platform_policies WHERE code='retention_policy'")).rows[0]?.value;if(policy?.requireApproval&&!details.archiveApproval?.approved){const error=new Error('Archival approval is required.');error.code='ARCHIVE_APPROVAL_REQUIRED';error.statusCode=409;throw error;}status='archived';archivedAt=new Date().toISOString();}
      if(operation==='restore'){if(order.status!=='archived'){const error=new Error('Only archived orders can be restored.');error.code='INVALID_ARCHIVE_STATUS';error.statusCode=409;throw error;}status='completed';archivedAt=null;details.restored={reason:String(payload.reason || ''),by:actor.id,at:new Date().toISOString()};}
      if(operation==='deletion_request')details.deletionRequest={requested:true,reason:String(payload.reason || ''),requestedBy:actor.id,requestedAt:new Date().toISOString(),status:'pending_approval'};
      await client.query('UPDATE app.orders SET status=$2,archived_at=$3,details=$4::jsonb,row_version=row_version+1,updated_at=now() WHERE id=$1',[order.id,status,archivedAt,json(details)]);await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES($1,$2,$3,$4,$5,'order',$6,'success',$7,$8::jsonb)`,[`order.${operation}`,actor.id,actor.role,order.company_id,operation,order.id,correlationId,json({reason:String(payload.reason || ''),legalHold:details.legalHold?.active || false})]);return {orderId:order.id,status,archivedAt,details};},{actor});},
    async listVisitClients(actor,{all=false}={}) { return inTransaction(async client=>{const result=await client.query(`SELECT c.*,assignment.representative_id,rep.display_name AS representative_name,rep.branch_name,
        contact.display_name AS contact_name,last_visit.completed_at AS last_visit_at,next_visit.scheduled_at AS next_visit_at
        FROM app.companies c JOIN app.representative_company_assignments assignment ON assignment.company_id=c.id AND assignment.ended_at IS NULL
        JOIN app.representatives rep ON rep.id=assignment.representative_id
        LEFT JOIN LATERAL (SELECT u.display_name FROM app.company_users cu JOIN app.users u ON u.id=cu.user_id WHERE cu.company_id=c.id AND cu.revoked_at IS NULL ORDER BY cu.is_primary DESC LIMIT 1) contact ON true
        LEFT JOIN LATERAL (SELECT completed_at FROM app.client_appointments WHERE company_id=c.id AND status='completed' ORDER BY completed_at DESC LIMIT 1) last_visit ON true
        LEFT JOIN LATERAL (SELECT scheduled_at FROM app.client_appointments WHERE company_id=c.id AND status='scheduled' ORDER BY scheduled_at LIMIT 1) next_visit ON true
        WHERE c.deleted_at IS NULL AND c.status='active' ${all||actor.permissions.includes('view_visit_compliance')?'':'AND assignment.representative_id=$1'} ORDER BY c.name`,all||actor.permissions.includes('view_visit_compliance')?[]:[actor.representativeId]);return result.rows.map(row=>({id:row.id,company:row.name,primaryContact:row.contact_name||'',address:row.area||'',branchId:row.branch_id||row.branch_name||'',latitude:null,longitude:null,representativeId:row.representative_id,representativeName:row.representative_name,lastVerifiedVisitAt:row.last_visit_at,nextPlannedVisitAt:row.next_visit_at,daysSinceLastVerifiedVisit:row.last_visit_at?Math.floor((Date.now()-new Date(row.last_visit_at))/86400000):999,status:row.last_visit_at?'green':'red',rfqsThisMonth:0,quotationsThisMonth:0,ordersThisMonth:0,openRfqs:0,openOrders:0,lastInteraction:row.last_visit_at}));},{actor});},
    async listAppointments(actor){return inTransaction(async client=>(await client.query(`SELECT appointment.*,company.name AS customer,rep.display_name AS representative_name FROM app.client_appointments appointment JOIN app.companies company ON company.id=appointment.company_id JOIN app.representatives rep ON rep.id=appointment.representative_id ORDER BY appointment.scheduled_at DESC`)).rows.map(row=>({id:row.id,clientId:row.company_id,companyId:row.company_id,customer:row.customer,representativeId:row.representative_id,representativeName:row.representative_name,scheduledAt:row.scheduled_at,expectedDurationMinutes:row.expected_duration_minutes,purpose:row.purpose,contact:row.contact_name,address:row.address,status:row.status,verificationStatus:row.verification_status,missedReason:row.details?.missedReason||'',startedAt:row.started_at,completedAt:row.completed_at,createdAt:row.created_at,updatedAt:row.updated_at})),{actor});},
    async createAppointment(actor,command){return inTransaction(async client=>{const assignment=(await client.query('SELECT 1 FROM app.representative_company_assignments WHERE representative_id=$1 AND company_id=$2 AND ended_at IS NULL',[actor.representativeId,command.companyId])).rows[0];if(!assignment)throw notFound('The customer is not assigned to this representative.');const row=(await client.query(`INSERT INTO app.client_appointments(id,company_id,representative_id,created_by_user_id,scheduled_at,expected_duration_minutes,purpose,contact_name,address,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,[command.id,command.companyId,actor.representativeId,actor.id,command.scheduledAt,command.expectedDurationMinutes,command.purpose,command.contact,command.address,json(command.details)])).rows[0];await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('appointment.scheduled',$1,$2,$3,'schedule_visit','appointment',$4,'success',$5,'{}')`,[actor.id,actor.role,command.companyId,command.id,command.correlationId]);return {id:row.id,clientId:row.company_id,companyId:row.company_id,representativeId:row.representative_id,scheduledAt:row.scheduled_at,purpose:row.purpose,status:row.status,verificationStatus:row.verification_status};},{actor});},
    async transitionAppointment(actor,id,command){return inTransaction(async client=>{const row=(await client.query('SELECT * FROM app.client_appointments WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw notFound('The appointment was not found.');const allowed={start:['scheduled'],location_check:['in_progress'],customer_confirm:['in_progress'],create_qr:['in_progress'],verify_qr:['in_progress'],complete:['in_progress'],missed_reason:['missed_visit']};if(!allowed[command.action]?.includes(row.status)){const error=new Error('This visit action is not available at the current stage.');error.code='INVALID_WORKFLOW_TRANSITION';error.statusCode=409;throw error;}let status=row.status,verification=row.verification_status,details={...(row.details||{})},started=row.started_at,completed=row.completed_at,qrHash=row.qr_token_hash,qrExpiry=row.qr_expires_at,qrConsumed=row.qr_consumed_at;const now=new Date().toISOString();if(command.action==='start'){status='in_progress';started=now;}if(command.action==='location_check')verification='location_matched';if(command.action==='customer_confirm')verification='customer_confirmed';if(command.action==='create_qr'){qrHash=command.input.tokenHash;qrExpiry=command.input.expiresAt;}if(command.action==='verify_qr'){if(!qrHash||qrHash!==command.input.tokenHash||qrConsumed||new Date(qrExpiry)<new Date()){const error=new Error('The one-time confirmation token is invalid or expired.');error.code='INVALID_QR_TOKEN';error.statusCode=422;throw error;}qrConsumed=now;verification='qr_confirmed';}if(command.action==='complete'){status='completed';completed=now;verification=verification==='not_verified'?'not_verified':'verified';details.completionNotes=String(command.input.notes||'');}if(command.action==='missed_reason')details.missedReason=String(command.input.reason||'');const updated=(await client.query(`UPDATE app.client_appointments SET status=$2,verification_status=$3,details=$4::jsonb,started_at=$5,completed_at=$6,qr_token_hash=$7,qr_expires_at=$8,qr_consumed_at=$9,updated_at=now() WHERE id=$1 RETURNING *`,[id,status,verification,json(details),started,completed,qrHash,qrExpiry,qrConsumed])).rows[0];await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES($1,$2,$3,$4,$5,'appointment',$6,'success',$7,$8::jsonb)`,[`appointment.${command.action}`,actor.id,actor.role,row.company_id,command.action,id,command.correlationId,json({verificationStatus:verification})]);return updated;},{actor});},
    async detectMissedAppointments(actor,correlationId){return inTransaction(async client=>{const rows=(await client.query("UPDATE app.client_appointments SET status='missed_visit',updated_at=now() WHERE status='scheduled' AND scheduled_at + expected_duration_minutes * interval '1 minute' + interval '30 minutes' < now() RETURNING id,company_id")).rows;for(const row of rows)await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('appointment.missed',$1,$2,$3,'detect_missed_visit','appointment',$4,'success',$5,'{}')`,[actor.id,actor.role,row.company_id,row.id,correlationId]);return {changed:rows.length};},{actor});},
    async getWorkLocationSummary(actor){return {representativeId:actor.representativeId,privacyStatus:'disabled_pending_approval',clientVisitHours:0,officeHours:0,unclassifiedHours:0};},
    async manageRecord(actor,recordId,operation,payload,correlationId){return inTransaction(async client=>{let entityType='rfq',record=(await client.query('SELECT id,company_id,representative_id,row_version,details FROM app.rfqs WHERE id=$1 FOR UPDATE',[recordId])).rows[0];if(!record){entityType='order';record=(await client.query('SELECT id,company_id,representative_id,row_version,details FROM app.orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[recordId])).rows[0];}if(!record)throw notFound('The workflow record was not found.');if(payload.expectedVersion&&Number(payload.expectedVersion)!==record.row_version){const error=new Error('This record changed since it was opened. Refresh and try again.');error.code='VERSION_CONFLICT';error.statusCode=409;throw error;}let details={...(record.details||{})};if(operation==='reassign'){const rep=(await client.query('SELECT id FROM app.representatives WHERE id=$1 AND is_active',[payload.representativeId])).rows[0];if(!rep)throw notFound('The representative was not found.');await client.query(`UPDATE app.${entityType==='rfq'?'rfqs':'orders'} SET representative_id=$2,row_version=row_version+1,updated_at=now() WHERE id=$1`,[recordId,payload.representativeId]);}if(operation==='override_approval'){details.workflowOverrideApproval={targetStatus:payload.targetStatus,reason:payload.reason,approvedBy:actor.id,approvedAt:new Date().toISOString()};await client.query(`UPDATE app.${entityType==='rfq'?'rfqs':'orders'} SET details=$2::jsonb,row_version=row_version+1,updated_at=now() WHERE id=$1`,[recordId,json(details)]);}if(operation==='correction'){const values=payload.values||{};if(entityType==='rfq'){if(values.contact){const error=new Error('Customer contact corrections must be made through authorised account administration.');error.code='VALIDATION_ERROR';error.statusCode=422;throw error;}}else{details={...details,planning:{...(details.planning||{}),internalJobNumber:values.internalJobNumber||details.planning?.internalJobNumber,salesOrderNumber:values.salesOrderNumber||details.planning?.salesOrderNumber},customerPoNumber:values.customerPoNumber||details.customerPoNumber};await client.query('UPDATE app.orders SET details=$2::jsonb,purchase_order_number=COALESCE(NULLIF($3,\'\'),purchase_order_number),row_version=row_version+1,updated_at=now() WHERE id=$1',[recordId,json(details),values.customerPoNumber||'']);}}await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES($1,$2,$3,$4,$5,$6,$7,'success',$8,$9::jsonb)`,[`management.${operation}`,actor.id,actor.role,record.company_id,operation,entityType,recordId,correlationId,json({reason:payload.reason||'',values:operation==='correction'?payload.values:undefined})]);return{recordId,entityType,operation};},{actor});},
    async saveCatalogueOverride(actor,kind,itemId,payload,correlationId){return inTransaction(async client=>{const row=(await client.query(`INSERT INTO app.catalogue_overrides(kind,item_id,values,updated_by_user_id) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(kind,item_id) DO UPDATE SET values=EXCLUDED.values,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=now() RETURNING *`,[kind,itemId,json(payload.values||{}),actor.id])).rows[0];await client.query(`INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('catalogue.override_saved',$1,$2,'save_catalogue_override',$3,$4,'success',$5,$6::jsonb)`,[actor.id,actor.role,kind,itemId,correlationId,json({reason:payload.reason||''})]);return row;},{actor});},
    async listCatalogueOverrides(actor){return inTransaction(async client=>(await client.query('SELECT kind,item_id AS "itemId",values,updated_at AS "updatedAt" FROM app.catalogue_overrides ORDER BY kind,item_id')).rows,{actor});},
    async createEnquiry(actor, command) {
      return inTransaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${actor.id}:create_enquiry:${command.idempotencyKey}`]);
        const existing = await client.query(`SELECT response_body FROM app.idempotency_records
          WHERE user_id = $1 AND operation = 'create_enquiry' AND idempotency_key = $2 AND expires_at > now()`, [actor.id, command.idempotencyKey]);
        if (existing.rows[0]) {
          if (existing.rows[0].response_body.requestHash !== command.requestHash) {
            const error = new Error('This idempotency key was already used for different RFQ details.');
            error.code = 'IDEMPOTENCY_CONFLICT'; error.statusCode = 409; throw error;
          }
          return { ...existing.rows[0].response_body.result, idempotent: true };
        }

        let representative;
        try {
          const resolved=(await client.query('SELECT app.resolve_rfq_representative($1,$2,$3) AS representative',[actor.companyId,command.representativeId || null,command.correlationId])).rows[0].representative;
          representative={rows:[{id:resolved.id,user_id:resolved.userId,display_name:resolved.displayName,branch_name:resolved.branchName,branch_id:resolved.branchId,is_active:resolved.isActive}]};
        } catch(error) {
          if(error.code==='P0002') { error.code='NOT_FOUND'; error.statusCode=404; error.message='Your company account is unavailable.'; }
          else if(error.code==='55000') { error.code='REPRESENTATIVE_INACTIVE'; error.statusCode=409; error.message='Your dedicated representative is unavailable. Contact Rhomberg to update the assignment.'; }
          else if(error.code==='23514') { error.code='REPRESENTATIVE_ASSIGNMENT_CONFLICT'; error.statusCode=409; error.message='Your dedicated representative cannot be changed during RFQ submission.'; }
          else if(error.code==='22023' && /area required/i.test(error.message)) { error.code='CUSTOMER_AREA_REQUIRED'; error.statusCode=422; error.message='Your company area must be completed before an RFQ can be submitted.'; }
          else if(error.code==='22023') { error.code='REPRESENTATIVE_NOT_ELIGIBLE'; error.statusCode=422; error.message='Select an active representative available in your area.'; }
          throw error;
        }
        const productIds = command.items.map(item => item.productId);
        const products = await client.query('SELECT id, code, name, configuration_schema FROM app.products WHERE id = ANY($1::text[]) AND is_active', [productIds]);
        const productMap = new Map(products.rows.map(product => [product.id, product]));
        if (productMap.size !== new Set(productIds).size) {
          const error = new Error('One or more selected products are unavailable.'); error.code = 'INVALID_PRODUCT'; error.statusCode = 422; throw error;
        }

        const id = randomUUID();
        const sequence = (await client.query("SELECT nextval('app.rfq_reference_sequence') AS value")).rows[0].value;
        const reference = `RQ-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
        await client.query(`INSERT INTO app.rfqs
          (id, reference, company_id, requester_user_id, representative_id, application, process_medium, area,
           fulfilment, delivery_address, collection_branch, customer_notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
          id, reference, actor.companyId, actor.id, representative.rows[0].id, command.application, command.medium,
          command.area, command.fulfilment, command.deliveryAddress, command.collectionBranch, command.notes,
        ]);
        for (const [index, item] of command.items.entries()) {
          const product = productMap.get(item.productId);
          assertProductConfiguration(product, item.configuration);
          await client.query(`INSERT INTO app.rfq_items
            (id, rfq_id, line_number, product_id, product_code_snapshot, product_name_snapshot, quantity, configuration)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [randomUUID(), id, index + 1, item.productId, product.code, product.name, item.quantity, json(item.configuration)]);
        }
        if (command.document) {
          await client.query(`INSERT INTO app.document_metadata
            (id, company_id, rfq_id, uploaded_by_user_id, kind, original_name, storage_key, media_type, size_bytes, sha256_hex)
            VALUES ($1,$2,$3,$4,'purchase_order',$5,$6,$7,$8,$9)`, [
            command.document.id, actor.companyId, id, actor.id, command.document.originalName, command.document.storageKey,
            command.document.mediaType, command.document.sizeBytes, command.document.sha256Hex,
          ]);
          await client.query(`INSERT INTO app.audit_events
            (event_type, actor_user_id, actor_role, company_id, action, entity_type, entity_id, outcome, correlation_id, details)
            VALUES ('document.metadata_created',$1,$2,$3,'create_document_metadata','document',$4,'success',$5,$6::jsonb)`, [actor.id, actor.role, actor.companyId, command.document.id, command.correlationId, json({ kind: 'purchase_order', sizeBytes: command.document.sizeBytes })]);
        }
        await client.query(`INSERT INTO app.audit_events
          (event_type, actor_user_id, actor_role, company_id, action, entity_type, entity_id, outcome, correlation_id, details)
          VALUES ('rfq.created',$1,$2,$3,'create_rfq','rfq',$4,'success',$5,$6::jsonb)`, [actor.id, actor.role, actor.companyId, id, command.correlationId, json({ itemCount: command.items.length, documentCount: command.document ? 1 : 0 })]);
        const notificationId = randomUUID();
        const recipient = representative.rows[0].user_id;
        if (recipient) {
          await client.query(`INSERT INTO app.notifications
            (id, company_id, recipient_user_id, rfq_id, event_type, title, message)
            VALUES ($1,$2,$3,$4,'rfq_assigned','New RFQ assigned',$5)`, [notificationId, actor.companyId, recipient, id, `${reference} is ready for review.`]);
        }
        const enquiry = await loadEnquiry(client, id);
        const result = { enquiry, delivery: { ok: true, deliveryMode: 'in_app', message: 'Your RFQ was submitted and assigned.' } };
        await client.query(`INSERT INTO app.idempotency_records
          (user_id, operation, idempotency_key, request_hash, response_status, response_body, expires_at)
          VALUES ($1,'create_enquiry',$2,$3,201,$4::jsonb,now() + interval '24 hours')`, [actor.id, command.idempotencyKey, command.requestHash, json({ requestHash: command.requestHash, result })]);
        return result;
      }, { actor });
    },
  };
}
