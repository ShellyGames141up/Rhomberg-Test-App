import { randomUUID } from 'node:crypto';
import { notFound } from '../errors.js';

const json = value => JSON.stringify(value ?? {});

function assertConfiguration(product, configuration) {
  for (const field of product.configuration_schema || []) {
    const value = configuration?.[field.key];
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      const error = new Error(`Complete the required ${field.key} configuration.`); error.code = 'INVALID_PRODUCT_CONFIGURATION'; error.statusCode = 422; throw error;
    }
    if (Array.isArray(field.options) && value !== undefined && !field.options.includes(value)) {
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
  const permissions = await client.query(`SELECT DISTINCT rp.permission_code
      FROM app.user_roles ur JOIN app.role_permissions rp ON rp.role_code = ur.role_code
      JOIN app.permissions p ON p.code = rp.permission_code AND p.is_active
      WHERE ur.user_id = $1 AND ur.revoked_at IS NULL`, [user.id]);
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
    const [items, documents] = await Promise.all([
      client.query('SELECT * FROM app.rfq_items WHERE rfq_id = $1 ORDER BY line_number', [id]),
      client.query('SELECT * FROM app.document_metadata WHERE rfq_id = $1 AND deleted_at IS NULL ORDER BY created_at', [id]),
    ]);
    return mapEnquiry(result.rows[0], items.rows, documents.rows);
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
          status, disabled_at, deleted_at FROM app.users
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
        const result = await client.query(`SELECT s.id AS session_id, s.user_id AS id, s.csrf_token_hash,
          s.expires_at, u.username, u.email, u.display_name, u.identity_provider, u.status
          FROM app.sessions s JOIN app.users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.deleted_at IS NULL`, [tokenHash]);
        const row = result.rows[0];
        if (!row || row.status !== 'active') return null;
        await client.query('SELECT app.establish_request_context($1)', [tokenHash]);
        const actor = await loadActor(client, row, tokenHash);
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
    async updateLastLogin(userId) {
      return inTransaction(client => client.query('UPDATE app.users SET last_login_at = now() WHERE id = $1', [userId]), { authLookup: true });
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
        const [users, roles, permissions, rolePermissions] = await Promise.all([
          client.query('SELECT * FROM app.list_internal_users()'),
          client.query("SELECT code, name FROM app.roles WHERE is_internal AND is_active AND code <> 'administrator' ORDER BY name"),
          client.query('SELECT code FROM app.permissions WHERE is_active ORDER BY code'),
          client.query('SELECT role_code, permission_code FROM app.role_permissions ORDER BY role_code, permission_code'),
        ]);
        const mappedUsers = users.rows.map(user => ({
          id: user.id, contact: user.display_name, displayName: user.display_name,
          email: user.email, signInName: user.username, username: user.username,
          role: user.role_codes[0], roles: user.role_codes, permissions: [], company: 'Internal',
          category: 'internal', department: '', branchId: '', status: user.status,
          lastLoginAt: user.last_login_at, createdAt: user.created_at, loginHistoryCount: 0,
          notificationPreferences: {},
        }));
        return {
          summary: { users: mappedUsers.length, customerCompanies: 0, internalAccounts: mappedUsers.length, auditEvents: 0 },
          users: mappedUsers, companies: [], representatives: [], branches: [], departments: [],
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
          return { id: row.id, username: row.username, email: row.email, displayName: row.display_name, role: row.role_code, status: row.status, createdAt: row.created_at };
        }, { actor });
      } catch (error) {
        if (error.code === '23505') {
          error.code = 'CONFLICT'; error.statusCode = 409; error.message = 'That sign-in name or email is already in use.';
        }
        throw error;
      }
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
        const result = await client.query(`SELECT id, company_id, rfq_id, kind, original_name, media_type, size_bytes,
          sha256_hex, scan_status, customer_visible, created_at
          FROM app.document_metadata WHERE id = $1 AND deleted_at IS NULL`, [id]);
        if (!result.rows[0]) throw notFound('The document was not found or is outside your authorised company account.');
        return result.rows[0];
      }, { actor });
    },
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

        const representative = await client.query(`SELECT rep.* FROM app.representatives rep
          JOIN app.representative_company_assignments a ON a.representative_id = rep.id
          WHERE rep.id = $1 AND a.company_id = $2 AND rep.is_active AND a.ended_at IS NULL`, [command.representativeId, actor.companyId]);
        if (!representative.rows[0]) throw notFound('The selected representative is not assigned to this company.');
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
          id, reference, actor.companyId, actor.id, command.representativeId, command.application, command.medium,
          command.area, command.fulfilment, command.deliveryAddress, command.collectionBranch, command.notes,
        ]);
        for (const [index, item] of command.items.entries()) {
          const product = productMap.get(item.productId);
          assertConfiguration(product, item.configuration);
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
