import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { ApiError, unauthenticated, validationError } from './errors.js';
import { secureHashEquals } from './security/crypto.js';
import { createAuthService } from './services/authService.js';
import { createEnquiryService } from './services/enquiryService.js';
import { createAdministrationService } from './services/administrationService.js';
import { createPublicReferenceService } from './services/publicReferenceService.js';
import { createPhase1WorkspaceService } from './services/phase1WorkspaceService.js';
import { createLocalPasswordIdentityProvider, createUnconfiguredExternalIdentityProvider } from './identity/localPasswordIdentityProvider.js';
import { PERMISSIONS, requirePermission } from './authorization/permissions.js';

const packageFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageMetadata = JSON.parse(await fs.readFile(packageFile, 'utf8'));
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const corsMethods = new Set(['GET', 'POST', 'OPTIONS']);
const corsHeaders = new Map([
  ['accept', 'Accept'],
  ['content-type', 'Content-Type'],
  ['idempotency-key', 'Idempotency-Key'],
  ['x-csrf-token', 'X-CSRF-Token'],
  ['x-request-id', 'X-Request-ID'],
]);
const approvedDocumentTypes = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg']);
const approvedDocumentExtension = /\.(?:pdf|docx?|png|jpe?g)$/i;

const publicActor = actor => ({
  id: actor.id, companyId: actor.companyId, company: actor.company, contact: actor.contact,
  username: actor.username, email: actor.email, role: actor.role, roles: actor.roles, permissions: actor.permissions,
});

async function parseEnquiryRequest(request, maxBytes) {
  if (!request.isMultipart()) return { payload: request.body || {}, documentFile: null };
  let payload;
  let documentFile;
  for await (const part of request.parts()) {
    if (part.type === 'field' && part.fieldname === 'payload') {
      try { payload = JSON.parse(String(part.value)); } catch { throw validationError({ payload: 'The RFQ payload is not valid JSON.' }); }
      continue;
    }
    if (part.type === 'file' && part.fieldname === 'purchaseOrder') {
      if (documentFile) throw validationError({ purchaseOrder: 'Attach only one Purchase Order document.' });
      const originalName = path.basename(String(part.filename || ''));
      if (!originalName || !approvedDocumentExtension.test(originalName) || !approvedDocumentTypes.has(part.mimetype)) {
        await part.toBuffer().catch(() => undefined);
        throw validationError({ purchaseOrder: 'Use an approved PDF, DOC, DOCX, PNG or JPEG document.' });
      }
      const buffer = await part.toBuffer();
      if (!buffer.length || buffer.length > maxBytes) throw validationError({ purchaseOrder: `The document must contain data and be no larger than ${maxBytes} bytes.` });
      documentFile = { buffer, originalName, mediaType: part.mimetype };
      continue;
    }
    if (part.type === 'file') await part.toBuffer().catch(() => undefined);
  }
  if (!payload) throw validationError({ payload: 'The RFQ payload is required.' });
  return { payload, documentFile };
}

export async function buildApp({ config, repository, storage, identityProvider, logger = true, logStream } = {}) {
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false } },
    logger: logger ? {
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-csrf-token', 'res.headers.set-cookie', 'body.password', '*.password', '*.sessionToken', '*.csrfToken', '*.databaseUrl'],
        censor: '[REDACTED]',
      },
      ...(logStream ? { stream: logStream } : {}),
    } : false,
    trustProxy: config.trustProxy,
    bodyLimit: Math.max(1024 * 1024, config.maxUploadBytes + 64 * 1024),
    requestIdHeader: 'x-request-id',
    genReqId: request => /^[a-zA-Z0-9._:-]{8,128}$/.test(String(request.headers['x-request-id'] || '')) ? request.headers['x-request-id'] : crypto.randomUUID(),
  });
  const resolvedIdentityProvider = identityProvider || (config.identityMode === 'local_password'
    ? createLocalPasswordIdentityProvider({ repository })
    : createUnconfiguredExternalIdentityProvider());
  const authService = createAuthService({ repository, identityProvider: resolvedIdentityProvider, config });
  const enquiryService = createEnquiryService({ repository, storage });
  const administrationService = createAdministrationService({ repository });
  const publicReferenceService = createPublicReferenceService();
  const phase1WorkspaceService = createPhase1WorkspaceService({ maxUploadBytes: config.maxUploadBytes });
  const approvedOrigins = new Set(config.allowedOrigins || (config.allowedOrigin ? [config.allowedOrigin] : []));
  const requiresApprovedMutationOrigin = ['staging', 'production'].includes(config.environment);

  await app.register(cookie);
  await app.register(multipart, { limits: { files: 1, fileSize: config.maxUploadBytes, fields: 4, parts: 5 } });
  await app.register(rateLimit, { global: false, keyGenerator: request => request.ip, errorResponseBuilder: () => new ApiError('RATE_LIMITED', 'Too many attempts. Please wait and try again.', 429) });

  app.decorateRequest('actor', null);
  app.decorateRequest('session', null);
  app.decorateRequest('sessionToken', '');

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-ID', request.id);
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    const isApiRequest = request.url.startsWith('/api/');
    const origin = String(request.headers.origin || '');
    if (isApiRequest && origin) {
      if (!approvedOrigins.has(origin)) throw new ApiError('INVALID_ORIGIN', 'The request origin is not authorised.', 403);
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Vary', 'Origin');
    }
    if (isApiRequest && request.method === 'OPTIONS') {
      if (!origin) throw new ApiError('INVALID_ORIGIN', 'An approved request origin is required.', 403);
      const requestedMethod = String(request.headers['access-control-request-method'] || '').toUpperCase();
      if (!corsMethods.has(requestedMethod) || requestedMethod === 'OPTIONS') throw new ApiError('CORS_METHOD_REJECTED', 'The requested cross-origin method is not permitted.', 403);
      const requestedHeaders = String(request.headers['access-control-request-headers'] || '')
        .split(',').map(header => header.trim().toLowerCase()).filter(Boolean);
      if (requestedHeaders.some(header => !corsHeaders.has(header))) throw new ApiError('CORS_HEADERS_REJECTED', 'The requested cross-origin headers are not permitted.', 403);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', [...corsHeaders.values()].join(', '));
      reply.header('Access-Control-Max-Age', '600');
      return reply.code(204).send();
    }
    if (isApiRequest && unsafeMethods.has(request.method) && requiresApprovedMutationOrigin && !origin) {
      throw new ApiError('INVALID_ORIGIN', 'An approved request origin is required.', 403);
    }
    const token = request.cookies[config.cookieName];
    if (token) {
      const authenticated = await authService.authenticate(token);
      if (authenticated) {
        request.actor = authenticated.actor;
        request.session = authenticated.session;
        request.sessionToken = token;
      }
    }
  });

  const requireAuthentication = async request => {
    if (!request.actor) throw unauthenticated();
  };
  const requireCsrf = async request => {
    await requireAuthentication(request);
    const supplied = String(request.headers['x-csrf-token'] || '');
    if (!supplied || !secureHashEquals(supplied, request.session.csrfTokenHash)) throw new ApiError('CSRF_REJECTED', 'The security token is missing or expired. Refresh and try again.', 403);
  };

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const ready = await repository.health().catch(() => false);
    if (!ready) reply.code(503);
    return { status: ready ? 'ready' : 'not_ready' };
  });
  app.get('/health/version', async () => ({ version: packageMetadata.version, runtime: process.version, environment: config.environment }));

  app.get('/api/v1/auth/csrf-token', async request => ({
    data: { token: await authService.rotateCsrf(request.session) }, meta: { requestId: request.id },
  }));
  app.post('/api/v1/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute', ban: 2 } },
      schema: { body: { type: 'object', additionalProperties: false, required: ['password'], anyOf: [{ required: ['identifier'] }, { required: ['email'] }], properties: { identifier: { type: 'string', minLength: 3, maxLength: 254 }, email: { type: 'string', minLength: 3, maxLength: 254 }, password: { type: 'string', minLength: 1, maxLength: 256 } } } },
  }, async (request, reply) => {
    const result = await authService.login({ ...request.body, correlationId: request.id, ipAddress: request.ip, userAgent: request.headers['user-agent'] || '' });
    reply.setCookie(config.cookieName, result.token, { path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', maxAge: config.sessionTtlSeconds });
    return { data: { user: result.user, csrfToken: result.csrfToken }, meta: { requestId: request.id } };
  });
  app.get('/api/v1/auth/me', { preHandler: requireAuthentication }, async request => ({ data: publicActor(request.actor), meta: { requestId: request.id } }));
  app.post('/api/v1/auth/logout', { preHandler: requireCsrf }, async (request, reply) => {
    await authService.logout({ token: request.sessionToken, actor: request.actor, session: request.session, correlationId: request.id });
    reply.clearCookie(config.cookieName, { path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: 'lax' }).code(204).send();
  });

  // Approved product and registration reference data is required before sign-in.
  // These endpoints expose no identities, customer records, pricing or private data.
  app.get('/api/v1/products/categories', async request => ({ data: publicReferenceService.listCategories(), meta: { requestId: request.id } }));
  app.get('/api/v1/products/recommendations', async request => ({ data: publicReferenceService.getRecommendations(), meta: { requestId: request.id } }));
  app.get('/api/v1/products', {
    schema: { querystring: { type: 'object', additionalProperties: false, properties: { categoryId: { type: 'string', maxLength: 80 }, query: { type: 'string', maxLength: 160 } } } },
  }, async request => ({ data: publicReferenceService.listProducts(request.query), meta: { requestId: request.id } }));
  app.get('/api/v1/products/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 160 } } } },
  }, async request => ({ data: publicReferenceService.getProduct(request.params.id), meta: { requestId: request.id } }));
  app.get('/api/v1/reference-data/registration', async request => ({ data: publicReferenceService.getRegistrationReference(), meta: { requestId: request.id } }));

  app.get('/api/v1/enquiries', { preHandler: requireAuthentication }, async request => ({ data: await enquiryService.list(request.actor), meta: { page: 1, pageSize: 100, requestId: request.id } }));
  app.post('/api/v1/enquiries', { preHandler: requireCsrf }, async (request, reply) => {
    const { payload, documentFile } = await parseEnquiryRequest(request, config.maxUploadBytes);
    const result = await enquiryService.create(request.actor, payload, { idempotencyKey: String(request.headers['idempotency-key'] || ''), correlationId: request.id, documentFile });
    reply.code(result.idempotent ? 200 : 201);
    return { data: result, meta: { requestId: request.id, idempotent: Boolean(result.idempotent) } };
  });
  app.get('/api/v1/enquiries/:id', { preHandler: requireAuthentication, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async request => ({ data: await enquiryService.get(request.actor, request.params.id), meta: { requestId: request.id } }));
  app.get('/api/v1/documents/:id', { preHandler: requireAuthentication, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async request => ({ data: await enquiryService.getDocument(request.actor, request.params.id, request.id), meta: { requestId: request.id } }));

  // Authenticated Phase 1 bootstrap resources. Empty collections are truthful for
  // a fresh staging database; they do not seed or emulate later workflow domains.
  app.get('/api/v1/enquiry-drafts/current', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getCurrentDraft(), meta: { requestId: request.id } }));
  app.get('/api/v1/orders', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.listOrders(), meta: { requestId: request.id } }));
  app.get('/api/v1/notifications', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.listNotifications(), meta: { requestId: request.id } }));
  app.get('/api/v1/audit-events', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    return { data: phase1WorkspaceService.listAuditEvents(), meta: { requestId: request.id } };
  });
  app.get('/api/v1/users/me/notification-preferences', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getNotificationPreferences(), meta: { requestId: request.id } }));
  app.get('/api/v1/users/me/settings', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getUserSettings(), meta: { requestId: request.id } }));
  app.get('/api/v1/planning/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getPlanningOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/expediting/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getExpeditingOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/dispatch/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getDispatchOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/laboratory/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getLaboratoryOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/quality-assurance/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getQualityOptions(), meta: { requestId: request.id } }));

  app.get('/api/v1/admin/overview', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    return { data: await repository.getAdministrationOverview(request.actor), meta: { requestId: request.id } };
  });
  app.get('/api/v1/administration/overview', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    return { data: await repository.getAdministrationOverview(request.actor), meta: { requestId: request.id } };
  });
  app.post('/api/v1/admin/users', {
    preHandler: requireCsrf,
    schema: { body: { type: 'object', additionalProperties: false, required: ['displayName', 'username', 'password', 'role'], properties: {
      displayName: { type: 'string', minLength: 2, maxLength: 160 }, username: { type: 'string', minLength: 3, maxLength: 40 },
      email: { type: 'string', maxLength: 254 }, password: { type: 'string', minLength: 16, maxLength: 256 },
      role: { type: 'string', minLength: 3, maxLength: 80 }, reason: { type: 'string', maxLength: 1000 },
    } } },
  }, async (request, reply) => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    const result = await administrationService.createInternalUser(request.actor, request.body, request.id);
    reply.code(201);
    return { data: result, meta: { requestId: request.id } };
  });

  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'The requested endpoint was not found.', correlationId: request.id } }));
  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    const code = error.code || (error.validation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');
    if (request.actor && [403, 404].includes(statusCode)) {
      await repository.appendAudit({ eventType: 'security.access_denied', actorUserId: request.actor.id, actorRole: request.actor.role, companyId: request.actor.companyId, action: request.method.toLowerCase(), entityType: 'http_resource', entityId: request.routerPath || request.url.split('?')[0], outcome: 'denied', correlationId: request.id, details: { code } }).catch(() => undefined);
    }
    if (statusCode >= 500) request.log.error({ err: error, code }, 'request failed');
    reply.code(statusCode).send({ error: { code, message: statusCode >= 500 && !['development', 'test'].includes(config.environment) ? 'The server could not complete this request.' : (error.message || 'The server could not complete this request.'), ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}), correlationId: request.id } });
  });

  return app;
}
