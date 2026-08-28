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
import { createRegistrationService } from './services/registrationService.js';
import { createPublicReferenceService } from './services/publicReferenceService.js';
import { createPhase1WorkspaceService } from './services/phase1WorkspaceService.js';
import { createRepresentativeOrderService } from './services/representativeOrderService.js';
import { createWorkflowService } from './services/workflowService.js';
import { QA_QUEUE_STATUSES } from './domain/qualityOptions.js';
import { TECHNICAL_CATEGORY_OPTIONS } from './domain/technicalOptions.js';
import { createTechnicalSupportService } from './services/technicalSupportService.js';
import { technicalMetrics } from './services/technicalMetrics.js';
import { createLaboratoryService } from './services/laboratoryService.js';
import { createGovernanceService, simplePdf } from './services/governanceService.js';
import { createClientVisitService } from './services/clientVisitService.js';
import { createPersonalisationService } from './services/personalisationService.js';
import { createLocalPasswordIdentityProvider, createUnconfiguredExternalIdentityProvider } from './identity/localPasswordIdentityProvider.js';
import { PERMISSIONS, requirePermission } from './authorization/permissions.js';
import { branches, areas } from './data/branches.js';

const packageFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageMetadata = JSON.parse(await fs.readFile(packageFile, 'utf8'));
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const corsMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
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
  forcePasswordChange: Boolean(actor.forcePasswordChange),
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

async function parseRepresentativeOrderRequest(request, maxBytes) {
  if (!request.isMultipart()) throw validationError({ documents: 'Attach the quotation and Purchase Order documents.' });
  let payload; const files={ quotation:[],purchaseOrder:[],supportingDocuments:[] };
  for await (const part of request.parts()) {
    if (part.type === 'field' && part.fieldname === 'payload') {
      try { payload=JSON.parse(String(part.value)); } catch { throw validationError({ payload:'The order payload is not valid JSON.' }); }
      continue;
    }
    if (part.type !== 'file') continue;
    if (!Object.hasOwn(files,part.fieldname)) { await part.toBuffer().catch(() => undefined); throw validationError({ documents:'An unsupported document field was supplied.' }); }
    const originalName=path.basename(String(part.filename || ''));
    if (!originalName || !approvedDocumentExtension.test(originalName) || !approvedDocumentTypes.has(part.mimetype)) { await part.toBuffer().catch(() => undefined); throw validationError({ [part.fieldname]:'Use an approved PDF, DOC, DOCX, PNG or JPEG document.' }); }
    const buffer=await part.toBuffer();
    if (!buffer.length || buffer.length>maxBytes) throw validationError({ [part.fieldname]:`Documents must contain data and be no larger than ${maxBytes} bytes.` });
    files[part.fieldname].push({ buffer,originalName,mediaType:part.mimetype });
  }
  if (!payload) throw validationError({ payload:'The order payload is required.' });
  if (files.quotation.length>1 || files.purchaseOrder.length>1 || files.supportingDocuments.length>8) throw validationError({ documents:'Attach one quotation, one Purchase Order and no more than eight supporting documents.' });
  return { payload,files };
}

async function parseOptionalDocumentRequest(request,maxBytes) {
  if (!request.isMultipart()) return {payload:request.body || {},attachment:null};
  let payload; let attachment;
  for await (const part of request.parts()) {
    if (part.type==='field' && part.fieldname==='payload') { try { payload=JSON.parse(String(part.value)); } catch { throw validationError({payload:'The request payload is not valid JSON.'}); } continue; }
    if (part.type!=='file') continue;
    if (attachment) { await part.toBuffer().catch(()=>undefined); throw validationError({attachment:'Attach only one document.'}); }
    const originalName=path.basename(String(part.filename || ''));
    if (!originalName || !approvedDocumentExtension.test(originalName) || !approvedDocumentTypes.has(part.mimetype)) { await part.toBuffer().catch(()=>undefined); throw validationError({attachment:'Use an approved PDF, DOC, DOCX, PNG or JPEG document.'}); }
    const buffer=await part.toBuffer(); if(!buffer.length || buffer.length>maxBytes) throw validationError({attachment:`The document must contain data and be no larger than ${maxBytes} bytes.`});
    attachment={buffer,originalName,mediaType:part.mimetype};
  }
  if(!payload) throw validationError({payload:'The request payload is required.'}); return {payload,attachment};
}

async function parseWorkflowRequest(request, maxBytes) {
  if (!request.isMultipart()) return { payload: request.body || {}, attachment: null };
  let payload; let attachment; let fileField;
  for await (const part of request.parts()) {
    if (part.type === 'field') {
      if (part.fieldname !== 'payload' || payload !== undefined || part.valueTruncated) throw validationError({ payload: 'Supply one complete workflow payload.' });
      try { payload = JSON.parse(String(part.value)); } catch { throw validationError({ payload: 'The workflow payload is invalid.' }); }
      continue;
    }
    if (attachment || !['quotationDocument', 'acceptanceDocument', 'dispatchProof'].includes(part.fieldname)) {
      await part.toBuffer().catch(() => undefined);
      throw validationError({ document: 'Attach only the expected workflow document.' });
    }
    const originalName = path.basename(String(part.filename || ''));
    const types = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    const extension = path.extname(originalName).slice(1).toLowerCase();
    const buffer = await part.toBuffer();
    if (!types[extension] || types[extension] !== part.mimetype || !buffer.length || part.file.truncated || buffer.length > Math.min(maxBytes, 4 * 1024 * 1024)) throw validationError({ document: 'Use a non-empty approved document, no larger than 4 MB, with a matching file type.' });
    if (extension === 'pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw validationError({ document: 'Attach a valid PDF document.' });
    attachment = { buffer, originalName, mediaType: part.mimetype };
    fileField = part.fieldname;
  }
  const expectedField = { mark_quoted: 'quotationDocument', accept_order: 'acceptanceDocument',
    mark_ready_for_collection: 'dispatchProof', start_delivery: 'dispatchProof', confirm_collection: 'dispatchProof',
    confirm_delivery: 'dispatchProof', complete_collection: 'dispatchProof', complete_delivery: 'dispatchProof', report_delivery_problem: 'dispatchProof' }[payload?.action];
  if (!expectedField || !attachment || fileField !== expectedField) throw validationError({ document: 'The attachment does not match the workflow action.' });
  return { payload, attachment };
}

async function parseCertificateRequest(request, maxBytes, { batch = false } = {}) {
  if (!request.isMultipart()) throw validationError({ certificate: 'Attach the certificate PDF.' });
  let metadata; const files = [];
  for await (const part of request.parts()) {
    if (part.type === 'field' && part.fieldname === 'metadata') {
      try { metadata = JSON.parse(String(part.value)); } catch { throw validationError({ metadata: 'The certificate metadata is not valid JSON.' }); }
      continue;
    }
    if (part.type !== 'file') continue;
    if ((!batch && files.length) || !['certificate', 'certificates'].includes(part.fieldname)) { await part.toBuffer().catch(() => undefined); throw validationError({ certificate: 'Attach only the expected certificate PDF files.' }); }
    const originalName = path.basename(String(part.filename || ''));
    if (!originalName || !/\.pdf$/i.test(originalName) || part.mimetype !== 'application/pdf') { await part.toBuffer().catch(() => undefined); throw validationError({ certificate: 'Only PDF certificates are accepted.' }); }
    const buffer = await part.toBuffer();
    if (!buffer.length || buffer.length > maxBytes || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw validationError({ certificate: 'Attach a valid, non-empty PDF within the upload limit.' });
    files.push({ buffer, originalName, mediaType: 'application/pdf' });
  }
  if (!metadata || (batch ? !Array.isArray(metadata) : Array.isArray(metadata))) throw validationError({ metadata: 'Complete the certificate metadata.' });
  if (!files.length) throw validationError({ certificate: 'Attach the certificate PDF.' });
  return { metadata, files };
}

async function parseProfileImageRequest(request, maxBytes) {
  if (!request.isMultipart()) throw validationError({ profileImage: 'Choose a PNG or JPEG image.' });
  let file;
  for await (const part of request.parts()) {
    if (part.type !== 'file') continue;
    if (file || part.fieldname !== 'file') { await part.toBuffer().catch(() => undefined); throw validationError({ profileImage: 'Attach one profile image.' }); }
    const originalName=path.basename(String(part.filename || '')); const mediaType=String(part.mimetype || ''); const buffer=await part.toBuffer();
    const jpeg=mediaType==='image/jpeg' && /\.jpe?g$/i.test(originalName) && buffer[0]===0xff && buffer[1]===0xd8;
    const png=mediaType==='image/png' && /\.png$/i.test(originalName) && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(!buffer.length || buffer.length>Math.min(maxBytes,4*1024*1024) || (!jpeg && !png)) throw validationError({profileImage:'Use a valid PNG or JPEG image no larger than 4 MB.'});
    file={buffer,originalName,mediaType};
  }
  if(!file) throw validationError({profileImage:'Choose a PNG or JPEG image.'}); return file;
}

async function parsePersonalisationImageRequest(request,maxBytes){if(!request.isMultipart())throw validationError({image:'Choose a PNG or JPEG image.'});let file,kind='',position={x:50,y:50};for await(const part of request.parts()){if(part.type==='field'){if(part.fieldname==='kind')kind=String(part.value);if(part.fieldname==='position'){try{position=JSON.parse(String(part.value));}catch{throw validationError({position:'Choose a valid image position.'});}}continue;}if(file||part.fieldname!=='image'){await part.toBuffer().catch(()=>undefined);throw validationError({image:'Attach one profile image.'});}const originalName=path.basename(String(part.filename||''));const mediaType=String(part.mimetype||'');const buffer=await part.toBuffer();const jpeg=mediaType==='image/jpeg'&&/\.jpe?g$/i.test(originalName)&&buffer[0]===0xff&&buffer[1]===0xd8;const png=mediaType==='image/png'&&/\.png$/i.test(originalName)&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(!buffer.length||buffer.length>Math.min(maxBytes,1024*1024)||(!jpeg&&!png))throw validationError({image:'Use a valid PNG or JPEG image no larger than 1 MB.'});file={buffer,originalName,mediaType};}if(kind!=='profileImage')throw validationError({kind:'Only a personal profile image may be uploaded.'});if(!file)throw validationError({image:'Choose a profile image.'});return{file,position};}

async function parseReplacementDocumentRequest(request,maxBytes){
  if(!request.isMultipart())throw validationError({document:'Attach the replacement document.'});let payload={};let file;
  for await(const part of request.parts()){
    if(part.type==='field'&&part.fieldname==='payload'){try{payload=JSON.parse(String(part.value));}catch{throw validationError({payload:'The replacement details are invalid.'});}continue;}
    if(part.type!=='file')continue;if(file||part.fieldname!=='document'){await part.toBuffer().catch(()=>undefined);throw validationError({document:'Attach one replacement document.'});}
    const originalName=path.basename(String(part.filename || ''));if(!approvedDocumentExtension.test(originalName)||!approvedDocumentTypes.has(part.mimetype)){await part.toBuffer().catch(()=>undefined);throw validationError({document:'Use an approved PDF, DOC, DOCX, PNG or JPEG document.'});}
    const buffer=await part.toBuffer();if(!buffer.length||buffer.length>maxBytes)throw validationError({document:'The replacement document is empty or too large.'});file={buffer,originalName,mediaType:part.mimetype};
  }return{payload,file};
}

export async function buildApp({ config, repository, storage, identityProvider, logger = true, logStream } = {}) {
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false } },
    logger: logger ? {
      level: config.logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-csrf-token', 'res.headers.set-cookie', 'body.verification', '*.verification', 'body.password', 'body.currentPassword', 'body.newPassword', '*.password', '*.currentPassword', '*.newPassword', '*.sessionToken', '*.csrfToken', '*.databaseUrl'],
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
  const administrationService = createAdministrationService({ repository, storage, identityProvider: resolvedIdentityProvider });
  const publicReferenceService = createPublicReferenceService();
  const registrationService = createRegistrationService({ repository, publicReferenceService });
  const phase1WorkspaceService = createPhase1WorkspaceService({ repository, maxUploadBytes: config.maxUploadBytes });
  const representativeOrderService = createRepresentativeOrderService({ repository, storage, publicReferenceService, branches });
  const workflowService = createWorkflowService({ repository, storage });
  const technicalSupportService = createTechnicalSupportService({ repository,storage });
  const laboratoryService = createLaboratoryService({ repository, storage });
  const governanceService = createGovernanceService({ repository, storage });
  const clientVisitService = createClientVisitService({ repository });
  const personalisationService = createPersonalisationService({ repository,storage });
  const approvedOrigins = new Set(config.allowedOrigins || (config.allowedOrigin ? [config.allowedOrigin] : []));
  const requiresApprovedMutationOrigin = ['staging', 'production'].includes(config.environment);

  await app.register(cookie);
  await app.register(multipart, { limits: { files: 10, fileSize: config.maxUploadBytes, fields: 6, parts: 16 } });
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
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
    const requestPath = request.url.split('?')[0];
    const firstLoginAllowed = new Set([
      '/api/v1/auth/csrf-token', '/api/v1/auth/me', '/api/v1/auth/logout', '/api/v1/auth/change-password',
    ]);
    const publicReferenceRequest = requestPath.startsWith('/api/v1/products') || requestPath.startsWith('/api/v1/reference-data/');
    if (request.actor?.forcePasswordChange && requestPath.startsWith('/api/v1/') && !firstLoginAllowed.has(requestPath) && !publicReferenceRequest) {
      throw new ApiError('PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing.', 403);
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
  app.post('/api/v1/auth/register', {
    config: { rateLimit: { max: 3, timeWindow: '10 minutes', ban: 2 } },
    schema: { body: { type: 'object', additionalProperties: false, required: ['company','contact','email','phone','area','industry','password'], properties: {
      company:{type:'string',minLength:2,maxLength:200},contact:{type:'string',minLength:2,maxLength:160},
      email:{type:'string',minLength:3,maxLength:254},phone:{type:'string',minLength:7,maxLength:50},
      area:{type:'string',minLength:2,maxLength:120},industry:{type:'string',minLength:2,maxLength:160},
      password:{type:'string',minLength:16,maxLength:256},
    } } },
  }, async (request, reply) => {
    await registrationService.register(request.body, request.id);
    const result = await authService.login({ identifier: request.body.email, password: request.body.password, correlationId: request.id, ipAddress: request.ip, userAgent: request.headers['user-agent'] || '' });
    reply.setCookie(config.cookieName, result.token, { path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', maxAge: config.sessionTtlSeconds }).code(201);
    return { data: { user: result.user, csrfToken: result.csrfToken, onboardingStatus: 'active' }, meta: { requestId: request.id } };
  });
  app.get('/api/v1/auth/me', { preHandler: requireAuthentication }, async request => ({ data: publicActor(request.actor), meta: { requestId: request.id } }));
  app.post('/api/v1/auth/logout', { preHandler: requireCsrf }, async (request, reply) => {
    await authService.logout({ token: request.sessionToken, actor: request.actor, session: request.session, correlationId: request.id });
    reply.clearCookie(config.cookieName, { path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: 'lax' }).code(204).send();
  });
  app.post('/api/v1/auth/change-password', {
    preHandler: requireCsrf,
    schema: { body: { type: 'object', additionalProperties: false, required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string', minLength: 1, maxLength: 256 }, newPassword: { type: 'string', minLength: 16, maxLength: 256 } } } },
  }, async (request, reply) => {
    await authService.changeOwnPassword({ actor: request.actor, currentPassword: request.body.currentPassword, newPassword: request.body.newPassword, correlationId: request.id });
    reply.clearCookie(config.cookieName, { path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: 'lax' }).code(204).send();
  });
  app.post('/api/v1/auth/workspace', { preHandler: requireCsrf }, async request=>({data:publicActor(await repository.setSessionRole(request.actor,request.session.id,String(request.body?.role||''))),meta:{requestId:request.id}}));

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

  app.get('/api/v1/enquiries', { preHandler: requireAuthentication }, async request => ({ data: (await enquiryService.list(request.actor)).map(record => workflowService.enrich(request.actor, 'rfq', record)), meta: { page: 1, pageSize: 100, requestId: request.id } }));
  app.get('/api/v1/enquiries/options', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.CREATE_RFQ);
    const reference = publicReferenceService.getRegistrationReference();
    const options = await repository.getEnquiryRepresentativeOptions(request.actor);
    const representatives = options.dedicatedRepresentative ? [options.dedicatedRepresentative] : options.eligibleRepresentatives;
    const preferredRepresentative = options.dedicatedRepresentative || null;
    return {
      data: {
        ...reference,
        customerArea: options.customerArea,
        representativeAssignmentStatus: options.assignmentStatus,
        requiresRepresentativeSelection: options.assignmentStatus === 'unassigned',
        areaDirectory: Object.fromEntries(Object.entries(reference.areaDirectory).map(([area, entry]) => [area, { ...entry, representatives: area === options.customerArea ? representatives : [] }])),
        eligibleRepresentatives: options.eligibleRepresentatives,
        preferredRepresentative,
      },
      meta: { requestId: request.id },
    };
  });
  app.post('/api/v1/enquiries', { preHandler: requireCsrf }, async (request, reply) => {
    const { payload, documentFile } = await parseEnquiryRequest(request, config.maxUploadBytes);
    const result = await enquiryService.create(request.actor, payload, { idempotencyKey: String(request.headers['idempotency-key'] || ''), correlationId: request.id, documentFile });
    reply.code(result.idempotent ? 200 : 201);
    return { data: result, meta: { requestId: request.id, idempotent: Boolean(result.idempotent) } };
  });
  app.get('/api/v1/enquiries/:id', { preHandler: requireAuthentication, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async request => ({ data: workflowService.enrich(request.actor, 'rfq', await enquiryService.get(request.actor, request.params.id)), meta: { requestId: request.id } }));
  app.get('/api/v1/enquiries/inbox', { preHandler: requireAuthentication }, async request => ({ data: (await enquiryService.list(request.actor)).map(record => workflowService.enrich(request.actor, 'rfq', record)), meta: { page: 1, pageSize: 100, requestId: request.id } }));
  app.get('/api/v1/enquiries/:id/workflow-actions', { preHandler: requireAuthentication }, async request => ({ data: await workflowService.allowed(request.actor,'rfq',request.params.id), meta: { requestId: request.id } }));
  app.post('/api/v1/enquiries/:id/workflow-actions', { preHandler: requireCsrf }, async request => {
    const { payload, attachment } = await parseWorkflowRequest(request, config.maxUploadBytes);
    return { data: await workflowService.perform(request.actor, 'rfq', request.params.id, payload, request.id, attachment), meta: { requestId: request.id } };
  });
  app.get('/api/v1/documents/:id', { preHandler: requireAuthentication, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async request => ({ data: await enquiryService.getDocument(request.actor, request.params.id, request.id), meta: { requestId: request.id } }));

  // Authenticated Phase 1 bootstrap resources. Empty collections are truthful for
  // a fresh staging database; they do not seed or emulate later workflow domains.
  app.get('/api/v1/enquiry-drafts/current', { preHandler: requireAuthentication }, async request => ({ data: await phase1WorkspaceService.getCurrentDraft(request.actor), meta: { requestId: request.id } }));
  app.put('/api/v1/enquiry-drafts/current', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.saveCurrentDraft(request.actor, request.body?.items), meta: { requestId: request.id } }));
  app.get('/api/v1/orders', { preHandler: requireAuthentication }, async request => ({ data: (await phase1WorkspaceService.listOrders(request.actor)).map(record => workflowService.enrich(request.actor, 'order', record)), meta: { requestId: request.id } }));
  app.get('/api/v1/orders/:id', { preHandler: requireAuthentication }, async request => ({ data: workflowService.enrich(request.actor, 'order', await repository.getOrder(request.actor,request.params.id)), meta: { requestId: request.id } }));
  app.get('/api/v1/orders/:orderId/source-documents', { preHandler: requireAuthentication }, async request => ({data:await governanceService.listDocuments(request.actor,request.params.orderId),meta:{requestId:request.id}}));
  app.get('/api/v1/orders/:orderId/source-documents/:documentId/download', { preHandler: requireAuthentication }, async(request,reply)=>{const result=await governanceService.download(request.actor,request.params.orderId,request.params.documentId,request.id);reply.header('Content-Type',result.mediaType).header('Content-Disposition',`attachment; filename="${result.fileName.replace(/["\\\r\n]/g,'_')}"`).header('X-Content-Type-Options','nosniff');return reply.send(result.buffer);});
  app.post('/api/v1/orders/:orderId/source-documents/:documentId/versions', { preHandler: requireCsrf }, async request=>{const parsed=await parseReplacementDocumentRequest(request,config.maxUploadBytes);return{data:await governanceService.replaceDocument(request.actor,request.params.orderId,request.params.documentId,parsed.payload,parsed.file,request.id),meta:{requestId:request.id}};});
  app.get('/api/v1/orders/:orderId/summary-sharing-options', { preHandler: requireAuthentication }, async request=>({data:await governanceService.sharingOptions(request.actor,request.params.orderId),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/summary-pdfs', { preHandler: requireCsrf }, async request=>({data:await governanceService.generateSummary(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/summary-emails', { preHandler: requireCsrf }, async request=>({data:await governanceService.queueEmail(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/archive-approval', { preHandler: requireCsrf }, async request=>({data:await governanceService.approve(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/archive', { preHandler: requireCsrf }, async request=>({data:await governanceService.archive(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/restore', { preHandler: requireCsrf }, async request=>({data:await governanceService.restore(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.put('/api/v1/orders/:orderId/legal-hold', { preHandler: requireCsrf }, async request=>({data:await governanceService.legalHold(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/deletion-requests', { preHandler: requireCsrf }, async request=>({data:await governanceService.deletionRequest(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/orders/:orderId/retention-exports', { preHandler: requireCsrf }, async request=>({data:await governanceService.retentionExport(request.actor,request.params.orderId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.get('/api/v1/orders/:id/workflow-actions', { preHandler: requireAuthentication }, async request => ({ data: await workflowService.allowed(request.actor,'order',request.params.id), meta: { requestId: request.id } }));
  app.post('/api/v1/orders/:id/workflow-actions', { preHandler: requireCsrf }, async request => {
    const { payload, attachment } = await parseWorkflowRequest(request, config.maxUploadBytes);
    return { data: await workflowService.perform(request.actor,'order',request.params.id,payload,request.id,attachment), meta: { requestId: request.id } };
  });
  app.get('/api/v1/notifications', { preHandler: requireAuthentication }, async request => ({ data: await phase1WorkspaceService.listNotifications(request.actor), meta: { requestId: request.id } }));
  app.post('/api/v1/notifications/:id/read', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.markNotificationRead(request.actor, request.params.id, request.id), meta: { requestId: request.id } }));
  app.post('/api/v1/notifications/read-all', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.markAllNotificationsRead(request.actor, request.id), meta: { requestId: request.id } }));
  app.get('/api/v1/workspace/updates', { preHandler: requireAuthentication }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { data: await phase1WorkspaceService.getWorkspaceRevision(request.actor), meta: { requestId: request.id } };
  });
  app.post('/api/v1/notifications/:notificationId/deliveries/:deliveryId/retry', { preHandler: requireCsrf }, async request => ({data:await repository.retryNotificationDelivery(request.actor,request.params.notificationId,request.params.deliveryId,request.id),meta:{requestId:request.id}}));
  app.get('/api/v1/audit-events', { preHandler: requireAuthentication }, async request => {
    if (!request.actor.permissions.includes(PERMISSIONS.ADMINISTER_USERS) && !request.actor.permissions.includes(PERMISSIONS.READ_AUDIT_HISTORY)) requirePermission(request.actor, PERMISSIONS.READ_AUDIT_HISTORY);
    return { data: await phase1WorkspaceService.listAuditEvents(request.actor), meta: { requestId: request.id } };
  });
  app.get('/api/v1/users/me/notification-preferences', { preHandler: requireAuthentication }, async request => ({ data: await phase1WorkspaceService.getNotificationPreferences(request.actor), meta: { requestId: request.id } }));
  app.put('/api/v1/users/me/notification-preferences', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.saveNotificationPreferences(request.actor, request.body), meta: { requestId: request.id } }));
  app.get('/api/v1/users/me/settings', { preHandler: requireAuthentication }, async request => ({ data: await phase1WorkspaceService.getUserSettings(request.actor), meta: { requestId: request.id } }));
  app.put('/api/v1/users/me/settings', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.saveUserSettings(request.actor, request.body), meta: { requestId: request.id } }));
  app.post('/api/v1/users/me/settings/onboarding/welcome', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.updateOnboarding(request.actor, { welcomeCompleted: true }), meta: { requestId: request.id } }));
  app.put('/api/v1/users/me/settings/onboarding/tutorial', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.updateOnboarding(request.actor, { tutorialProgress: Number(request.body?.step || 0), tutorialKind: String(request.body?.tutorialKind || 'full'), tutorialCompleted: Boolean(request.body?.completed) }), meta: { requestId: request.id } }));
  app.post('/api/v1/users/me/settings/onboarding/tutorial/reset', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.updateOnboarding(request.actor, { tutorialProgress: 0, tutorialCompleted: false }), meta: { requestId: request.id } }));
  app.post('/api/v1/users/me/settings/reset', { preHandler: requireCsrf }, async request => ({ data: await phase1WorkspaceService.resetUserSettings(request.actor), meta: { requestId: request.id } }));
  app.get('/api/v1/users/me/personalisation', { preHandler: requireAuthentication }, async request => ({data:await personalisationService.get(request.actor),meta:{requestId:request.id}}));
  app.put('/api/v1/users/me/personalisation', { preHandler: requireCsrf }, async request => ({data:await personalisationService.save(request.actor,request.body||{}),meta:{requestId:request.id}}));
  app.post('/api/v1/users/me/personalisation/reset', { preHandler: requireCsrf }, async request => ({data:await personalisationService.reset(request.actor,request.body||{}),meta:{requestId:request.id}}));
  app.post('/api/v1/users/me/personalisation/images', { preHandler: requireCsrf }, async request => {const parsed=await parsePersonalisationImageRequest(request,config.maxUploadBytes);return{data:await personalisationService.uploadImage(request.actor,parsed.file,parsed.position,request.id),meta:{requestId:request.id}};});
  app.delete('/api/v1/users/me/personalisation/images/:imageId', { preHandler: requireCsrf }, async request => ({data:await personalisationService.removeImage(request.actor,request.params.imageId,request.id),meta:{requestId:request.id}}));
  app.get('/api/v1/users/me/personalisation/images/:imageId', { preHandler: requireAuthentication }, async(request,reply)=>{if(request.params.imageId!==request.actor.id)throw new ApiError('FORBIDDEN','The profile image is outside your account.',403);const image=await personalisationService.image(request.actor);reply.header('Content-Type',image.media_type||image.mediaType).header('Cache-Control','private, max-age=300').header('X-Content-Type-Options','nosniff');return reply.send(image.buffer);});
  app.get('/api/v1/companies/me', { preHandler: requireAuthentication }, async request => ({ data: await repository.getCurrentCompany(request.actor), meta: { requestId: request.id } }));
  app.get('/api/v1/companies', { preHandler: requireAuthentication }, async request => {
    if (!request.actor.permissions.includes(PERMISSIONS.ADMINISTER_USERS) && !request.actor.permissions.includes('view_all_companies')) requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    return { data: await repository.listCompanies(request.actor), meta: { requestId: request.id } };
  });
  app.get('/api/v1/representatives/orders/options', { preHandler: requireAuthentication }, async request => ({ data: await representativeOrderService.getOptions(request.actor), meta: { requestId: request.id } }));
  app.post('/api/v1/representatives/orders/duplicate-check', { preHandler: requireCsrf }, async request => ({ data: await representativeOrderService.checkDuplicate(request.actor,request.body || {}), meta: { requestId: request.id } }));
  app.post('/api/v1/representatives/orders', { preHandler: requireCsrf }, async (request,reply) => {
    const parsed=await parseRepresentativeOrderRequest(request,config.maxUploadBytes);
    const result=await representativeOrderService.create(request.actor,parsed.payload,{ files:parsed.files,idempotencyKey:String(request.headers['idempotency-key'] || ''),correlationId:request.id });
    reply.code(result.idempotent ? 200 : 201); return { data:result,meta:{requestId:request.id,idempotent:Boolean(result.idempotent)} };
  });
  app.get('/api/v1/planning/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: await phase1WorkspaceService.getPlanningOptions(request.actor), meta: { requestId: request.id } }));
  app.get('/api/v1/expediting/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getExpeditingOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/dispatch/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getDispatchOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/laboratory/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getLaboratoryOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/laboratory/orders', { preHandler: requireAuthentication }, async request => ({ data: await laboratoryService.listOrders(request.actor), meta: { requestId: request.id } }));
  app.get('/api/v1/laboratory/dashboard', { preHandler: requireAuthentication }, async request => ({ data: await laboratoryService.dashboard(request.actor), meta: { requestId: request.id } }));
  app.post('/api/v1/laboratory/orders/:orderId/units/:unitId/certificate', { preHandler: requireCsrf }, async request => { const parsed = await parseCertificateRequest(request, config.maxUploadBytes); return { data: await laboratoryService.upload(request.actor, request.params.orderId, request.params.unitId, parsed.metadata, parsed.files[0], request.id), meta: { requestId: request.id } }; });
  app.post('/api/v1/laboratory/orders/:orderId/units/:unitId/certificate/replace', { preHandler: requireCsrf }, async request => { const parsed = await parseCertificateRequest(request, config.maxUploadBytes); return { data: await laboratoryService.replace(request.actor, request.params.orderId, request.params.unitId, parsed.metadata, parsed.files[0], request.id), meta: { requestId: request.id } }; });
  app.post('/api/v1/laboratory/orders/:orderId/certificates/batch', { preHandler: requireCsrf }, async request => { const parsed = await parseCertificateRequest(request, config.maxUploadBytes, { batch: true }); return { data: await laboratoryService.batch(request.actor, request.params.orderId, parsed.metadata, parsed.files, request.id), meta: { requestId: request.id } }; });
  app.post('/api/v1/laboratory/orders/:orderId/certificates/archive', { preHandler: requireCsrf }, async request => ({ data: await laboratoryService.archive(request.actor, request.params.orderId, request.id), meta: { requestId: request.id } }));
  const sendCertificate = async (request, reply) => { const result = await laboratoryService.download(request.actor, request.params.documentId || request.params.certificateId, request.id); reply.header('Content-Type', result.mediaType).header('Content-Disposition', `attachment; filename="${result.fileName.replace(/["\\\r\n]/g, '_')}"`).header('X-Content-Type-Options', 'nosniff'); return reply.send(result.buffer); };
  app.get('/api/v1/laboratory/documents/:documentId/download', { preHandler: requireAuthentication }, sendCertificate);
  app.get('/api/v1/certificates/:certificateId/download', { preHandler: requireAuthentication }, sendCertificate);
  app.get('/api/v1/quality-assurance/workspace-options', { preHandler: requireAuthentication }, async request => ({ data: phase1WorkspaceService.getQualityOptions(), meta: { requestId: request.id } }));
  app.get('/api/v1/quality-assurance/orders', { preHandler: requireAuthentication }, async request => { requirePermission(request.actor,'view_qa_queue');const records=(await repository.listOrders(request.actor)).filter(item=>QA_QUEUE_STATUSES.includes(item.trackingStatus));return{data:records,meta:{requestId:request.id}};});
  app.get('/api/v1/quality-assurance/dashboard', { preHandler: requireAuthentication }, async request => {requirePermission(request.actor,'view_qa_queue');const records=(await repository.listOrders(request.actor)).filter(item=>QA_QUEUE_STATUSES.includes(item.trackingStatus));return{data:{total:records.length,awaitingInspection:records.filter(x=>x.trackingStatus==='awaiting_qa').length,inProgress:records.filter(x=>x.trackingStatus==='qa_in_progress').length,failed:records.filter(x=>x.trackingStatus==='qa_failed').length,onHold:records.filter(x=>x.trackingStatus==='on_hold').length},meta:{requestId:request.id}};});
  app.get('/api/v1/admin/locations', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_LOCATION_SETTINGS);
    return { data: await phase1WorkspaceService.getLocations(request.actor), meta: { requestId: request.id } };
  });
  app.post('/api/v1/admin/locations', { preHandler: requireCsrf }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_LOCATION_SETTINGS);
    return { data: await phase1WorkspaceService.saveLocation(request.actor, request.body, request.id), meta: { requestId: request.id } };
  });
  app.patch('/api/v1/admin/locations/:id', { preHandler: requireCsrf }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_LOCATION_SETTINGS);
    return { data: await phase1WorkspaceService.saveLocation(request.actor, { ...request.body, id: request.params.id }, request.id), meta: { requestId: request.id } };
  });
  app.get('/api/v1/admin/visit-policy', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_LOCATION_SETTINGS);
    return { data: await phase1WorkspaceService.getPolicy(request.actor, 'visit_policy', { radiusMetres: 250, missedVisitGraceMinutes: 30, requireCustomerConfirmation: true }), meta: { requestId: request.id } };
  });
  app.put('/api/v1/admin/visit-policy', { preHandler: requireCsrf }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_LOCATION_SETTINGS);
    return { data: await phase1WorkspaceService.savePolicy(request.actor, 'visit_policy', request.body), meta: { requestId: request.id } };
  });
  app.get('/api/v1/representatives/clients', { preHandler: requireAuthentication }, async request => ({ data: await clientVisitService.listClients(request.actor), meta: { requestId: request.id } }));
  app.get('/api/v1/representatives/client-activity', { preHandler: requireAuthentication }, async request => ({ data: await clientVisitService.overview(request.actor), meta: { requestId: request.id } }));
  app.get('/api/v1/representatives/appointments', { preHandler: requireAuthentication }, async request => ({ data: await clientVisitService.listAppointments(request.actor), meta: { requestId: request.id } }));
  app.post('/api/v1/clients/:clientId/appointments', { preHandler: requireCsrf }, async (request, reply) => { const result=await clientVisitService.schedule(request.actor,request.params.clientId,request.body||{},request.id);reply.code(201);return {data:result,meta:{requestId:request.id}}; });
  app.post('/api/v1/appointments/:appointmentId/start', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.transition(request.actor,request.params.appointmentId,'start',{},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/appointments/:appointmentId/location-check', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.transition(request.actor,request.params.appointmentId,'location_check',request.body||{},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/appointments/:appointmentId/customer-confirmation', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.transition(request.actor,request.params.appointmentId,'customer_confirm',{},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/appointments/:appointmentId/qr', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.createQr(request.actor,request.params.appointmentId,request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/appointments/:appointmentId/qr/verify', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.verifyQr(request.actor,request.params.appointmentId,request.body?.token,request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/appointments/:appointmentId/complete', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.transition(request.actor,request.params.appointmentId,'complete',request.body||{},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/appointments/:appointmentId/missed-reason', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.transition(request.actor,request.params.appointmentId,'missed_reason',request.body||{},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/sales-manager/missed-visits/detect', { preHandler: requireCsrf }, async request => ({data:await clientVisitService.detectMissed(request.actor,request.id),meta:{requestId:request.id}}));
  app.get('/api/v1/sales-manager/visit-compliance', { preHandler: requireAuthentication }, async request => ({data:await clientVisitService.compliance(request.actor),meta:{requestId:request.id}}));
  app.get('/api/v1/representatives/work-location-summary', { preHandler: requireAuthentication }, async request => ({data:await clientVisitService.workSummary(request.actor),meta:{requestId:request.id}}));
  app.get('/api/v1/admin/retention-policy', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_RETENTION_POLICY);
    return { data: await phase1WorkspaceService.getPolicy(request.actor, 'retention_policy', { retentionMonths: 84, archiveAfterDays: 90, requireApproval: true }), meta: { requestId: request.id } };
  });
  app.put('/api/v1/admin/retention-policy', { preHandler: requireCsrf }, async request => {
    requirePermission(request.actor, PERMISSIONS.MANAGE_RETENTION_POLICY);
    return { data: await phase1WorkspaceService.savePolicy(request.actor, 'retention_policy', request.body), meta: { requestId: request.id } };
  });
  app.get('/api/v1/technical-support/options', { preHandler: requireAuthentication }, async request => {
    if (!request.actor.permissions.includes(PERMISSIONS.VIEW_TECHNICAL_QUEUE) && !request.actor.permissions.includes('request_technical_support')) requirePermission(request.actor, PERMISSIONS.VIEW_TECHNICAL_QUEUE);
    return { data: { categories: TECHNICAL_CATEGORY_OPTIONS, priorities: ['standard','high','urgent'], departments: ['Technical Support'], technicalUsers: await repository.listTechnicalUsers(request.actor) }, meta: { requestId: request.id } };
  });
  app.get('/api/v1/rfqs/:rfqId/technical-support', { preHandler: requireAuthentication }, async request => ({data:await technicalSupportService.getByRfq(request.actor,request.params.rfqId),meta:{requestId:request.id}}));
  app.post('/api/v1/rfqs/:rfqId/technical-support', { preHandler: requireCsrf }, async (request,reply) => { const parsed=await parseOptionalDocumentRequest(request,config.maxUploadBytes); const result=await technicalSupportService.request(request.actor,request.params.rfqId,parsed.payload,{attachment:parsed.attachment,correlationId:request.id}); reply.code(201); return {data:result,meta:{requestId:request.id}}; });
  app.post('/api/v1/technical-support/:requestId/assign', { preHandler: requireCsrf }, async request => ({data:await technicalSupportService.assign(request.actor,request.params.requestId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/technical-support/:requestId/start-review', { preHandler: requireCsrf }, async request => ({data:await technicalSupportService.startReview(request.actor,request.params.requestId,request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/technical-support/:requestId/messages', { preHandler: requireCsrf }, async request => { const parsed=await parseOptionalDocumentRequest(request,config.maxUploadBytes); return {data:await technicalSupportService.postMessage(request.actor,request.params.requestId,parsed.payload,{attachment:parsed.attachment,correlationId:request.id}),meta:{requestId:request.id}}; });
  app.post('/api/v1/technical-support/:requestId/request-information', { preHandler: requireCsrf }, async request => { const parsed=await parseOptionalDocumentRequest(request,config.maxUploadBytes); return {data:await technicalSupportService.requestInformation(request.actor,request.params.requestId,parsed.payload,{attachment:parsed.attachment,correlationId:request.id}),meta:{requestId:request.id}}; });
  app.post('/api/v1/technical-support/:requestId/request-information/customer', { preHandler: requireCsrf }, async request => { const parsed=await parseOptionalDocumentRequest(request,config.maxUploadBytes); return {data:await technicalSupportService.forwardCustomerRequest(request.actor,request.params.requestId,parsed.payload,{attachment:parsed.attachment,correlationId:request.id}),meta:{requestId:request.id}}; });
  app.post('/api/v1/technical-support/:requestId/respond', { preHandler: requireCsrf }, async request => { const parsed=await parseOptionalDocumentRequest(request,config.maxUploadBytes); return {data:await technicalSupportService.respond(request.actor,request.params.requestId,parsed.payload,{attachment:parsed.attachment,correlationId:request.id}),meta:{requestId:request.id}}; });
  app.post('/api/v1/technical-support/:requestId/complete', { preHandler: requireCsrf }, async request => ({data:await technicalSupportService.complete(request.actor,request.params.requestId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.post('/api/v1/technical-support/:requestId/override', { preHandler: requireCsrf }, async request => ({data:await technicalSupportService.override(request.actor,request.params.requestId,request.body || {},request.id),meta:{requestId:request.id}}));
  app.get('/api/v1/technical-support/queue', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.VIEW_TECHNICAL_QUEUE);
    return { data: await technicalSupportService.listQueue(request.actor, request.query || {}), meta: { requestId: request.id } };
  });
  app.get('/api/v1/technical-support/metrics', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.VIEW_TECHNICAL_QUEUE);
    const records = await phase1WorkspaceService.listTechnicalRequests(request.actor);
    return { data: technicalMetrics(records), meta: { requestId: request.id } };
  });
  app.get('/api/v1/technical-support/:requestId/rfq/download', { preHandler: requireAuthentication }, async request=>({data:await technicalSupportService.downloadRfq(request.actor,request.params.requestId,request.id),meta:{requestId:request.id}}));
  app.get('/api/v1/technical-support/:requestId/attachments/:attachmentId/download', { preHandler: requireAuthentication }, async(request,reply)=>{const result=await technicalSupportService.downloadAttachment(request.actor,request.params.requestId,request.params.attachmentId,request.id);reply.header('Content-Type',result.mediaType).header('Content-Disposition',`attachment; filename="${result.fileName.replace(/["\\\r\n]/g,'_')}"`).header('X-Content-Type-Options','nosniff');return reply.send(result.buffer);});
  app.get('/api/v1/management/dashboard', { preHandler: requireAuthentication }, async request => {
    if (!request.actor.permissions.includes('view_reports') && !request.actor.permissions.includes(PERMISSIONS.VIEW_ALL_ORDERS)) requirePermission(request.actor, PERMISSIONS.VIEW_ALL_ORDERS);
    return { data: await phase1WorkspaceService.getManagementDashboard(request.actor, request.query || {}), meta: { requestId: request.id } };
  });
  app.get('/api/v1/management/representatives', { preHandler: requireAuthentication }, async request => {
    if (!request.actor.permissions.includes('reassign_representative') && !request.actor.permissions.includes(PERMISSIONS.ADMINISTER_USERS)) requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    return { data: await repository.listRepresentatives(request.actor), meta: { requestId: request.id } };
  });
  app.get('/api/v1/management/performance-report-options', { preHandler: requireAuthentication }, async request => ({
    data: await phase1WorkspaceService.getPerformanceReportOptions(request.actor), meta: { requestId: request.id },
  }));
  app.post('/api/v1/management/reports', { preHandler: requireCsrf }, async request => {requirePermission(request.actor,'export_operational_reports');const dashboard=await phase1WorkspaceService.getManagementDashboard(request.actor);const rows=['Reference,Type,Company,Status,Representative',...dashboard.records.map(item=>[item.reference,item.workflowType,item.company,item.trackingStatus,item.selectedRep?.name||''].map(value=>`"${String(value||'').replaceAll('"','""')}"`).join(','))];await repository.appendAudit({eventType:'management.report_exported',actorUserId:request.actor.id,actorRole:request.actor.role,action:'export_operational_report',entityType:'report',entityId:request.id,outcome:'success',correlationId:request.id,details:{recordCount:dashboard.records.length}});return{data:{csv:rows.join('\r\n'),mimeType:'text/csv',fileName:`rhomberg-operational-${new Date().toISOString().slice(0,10)}.csv`},meta:{requestId:request.id}};});
  app.post('/api/v1/management/performance-reports', { preHandler: requireCsrf }, async request => ({
    data: await phase1WorkspaceService.createPerformanceReport(request.actor, request.body || {}, request.id),
    meta: { requestId: request.id },
  }));
  app.post('/api/v1/management/records/:recordId/representative', { preHandler: requireCsrf }, async request=>{requirePermission(request.actor,'reassign_representative');if(String(request.body?.reason||'').trim().length<5)throw validationError({reason:'Record why the representative is changing.'});return{data:await repository.manageRecord(request.actor,request.params.recordId,'reassign',request.body||{},request.id),meta:{requestId:request.id}};});
  app.post('/api/v1/management/records/:recordId/workflow-override-approval', { preHandler: requireCsrf }, async request=>{requirePermission(request.actor,'approve_workflow_override');if(String(request.body?.reason||'').trim().length<10)throw validationError({reason:'Record a detailed override approval reason.'});return{data:await repository.manageRecord(request.actor,request.params.recordId,'override_approval',request.body||{},request.id),meta:{requestId:request.id}};});
  app.get('/api/v1/archived-orders', { preHandler: requireAuthentication }, async request => {
    if (!request.actor.permissions.includes('archive_orders') && !request.actor.permissions.includes('restore_archived_orders') && !request.actor.permissions.includes(PERMISSIONS.VIEW_ALL_ORDERS)) requirePermission(request.actor, PERMISSIONS.VIEW_ALL_ORDERS);
    return { data: await phase1WorkspaceService.listArchivedOrders(request.actor), meta: { requestId: request.id } };
  });

  app.get('/api/v1/admin/overview', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    const overview = await repository.getAdministrationOverview(request.actor);
    const overrides = await repository.listCatalogueOverrides(request.actor);
    const applyOverrides = (kind,items) => { const byId=new Map(overrides.filter(item=>item.kind===kind).map(item=>[item.itemId,item.values]));return items.map(item=>({...item,...(byId.get(item.id)||{})})); };
    return { data: { ...overview, branches, areas, departments: ['Sales','Planning','Expediting','Laboratory','Quality Assurance','Dispatch','Technical Support','Administration'], catalogue: { categories: applyOverrides('category',publicReferenceService.listCategories()), products: applyOverrides('product',publicReferenceService.listProducts()) } }, meta: { requestId: request.id } };
  });
  app.get('/api/v1/administration/overview', { preHandler: requireAuthentication }, async request => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    const overview = await repository.getAdministrationOverview(request.actor);
    const overrides = await repository.listCatalogueOverrides(request.actor);
    const applyOverrides = (kind,items) => { const byId=new Map(overrides.filter(item=>item.kind===kind).map(item=>[item.itemId,item.values]));return items.map(item=>({...item,...(byId.get(item.id)||{})})); };
    return { data: { ...overview, branches, areas, departments: ['Sales','Planning','Expediting','Laboratory','Quality Assurance','Dispatch','Technical Support','Administration'], catalogue: { categories: applyOverrides('category',publicReferenceService.listCategories()), products: applyOverrides('product',publicReferenceService.listProducts()) } }, meta: { requestId: request.id } };
  });
  app.post('/api/v1/admin/users', {
    preHandler: requireCsrf,
    schema: { body: { type: 'object', additionalProperties: false, required: ['displayName', 'username', 'password', 'role'], properties: {
      displayName: { type: 'string', minLength: 2, maxLength: 160 }, username: { type: 'string', minLength: 3, maxLength: 40 },
      email: { type: 'string', maxLength: 254 }, password: { type: 'string', minLength: 16, maxLength: 256 },
      role: { type: 'string', minLength: 3, maxLength: 80 }, reason: { type: 'string', maxLength: 1000 },
      additionalRoles: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 3, maxLength: 80 } },
      branchId: { type: 'string', minLength: 2, maxLength: 80 }, department: { type: 'string', minLength: 2, maxLength: 120 },
      phone: { type: 'string', maxLength: 50 },
    } } },
  }, async (request, reply) => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    const result = await administrationService.createInternalUser(request.actor, request.body, request.id);
    reply.code(201);
    return { data: result, meta: { requestId: request.id } };
  });
  app.post('/api/v1/admin/customer-accounts', {
    preHandler: requireCsrf,
    schema: { body: { type: 'object', additionalProperties: false, required: ['companyName','contactName','email','phone','area','industry','branchId','password'], properties: {
      companyName:{type:'string',minLength:2,maxLength:200},contactName:{type:'string',minLength:2,maxLength:160},
      email:{type:'string',minLength:3,maxLength:254},phone:{type:'string',minLength:7,maxLength:50},
      area:{type:'string',minLength:2,maxLength:120},industry:{type:'string',minLength:2,maxLength:160},
      branchId:{type:'string',minLength:2,maxLength:80},representativeId:{type:'string',format:'uuid'},
      password:{type:'string',minLength:16,maxLength:256},reason:{type:'string',maxLength:1000},
    } } },
  }, async (request, reply) => {
    requirePermission(request.actor, PERMISSIONS.ADMINISTER_USERS);
    const result = await administrationService.createCustomerAccount(request.actor, request.body, request.id);
    reply.code(201); return { data: result, meta: { requestId: request.id } };
  });
  app.patch('/api/v1/administration/users/:accountId', { preHandler: requireCsrf }, async request => ({ data: await administrationService.updateUser(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.put('/api/v1/administration/users/:accountId/status', { preHandler: requireCsrf }, async request => ({ data: await administrationService.updateStatus(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.post('/api/v1/admin/users/:accountId/archive', { preHandler: requireCsrf }, async request => ({ data: await administrationService.archiveUser(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.delete('/api/v1/admin/users/:accountId', {
    preHandler: requireCsrf,
    schema: { body: { type:'object', additionalProperties:false, required:['reason'], properties:{ reason:{type:'string',minLength:8,maxLength:1000} } } },
  }, async request => ({ data: await administrationService.deleteUser(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.post('/api/v1/admin/users/:accountId/roles', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, preHandler: requireCsrf }, async request => ({ data: await administrationService.assignRoles(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.post('/api/v1/admin/users/:accountId/branch', { preHandler: requireCsrf }, async request => ({ data: await administrationService.assignBranch(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.put('/api/v1/administration/users/:accountId/permissions', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, preHandler: requireCsrf }, async request => ({ data: await administrationService.setPermissions(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.put('/api/v1/administration/users/:accountId/notification-preferences', { preHandler: requireCsrf }, async request => ({ data: await administrationService.setNotificationPreferences(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.patch('/api/v1/administration/catalogue/:kinds/:itemId', { preHandler: requireCsrf }, async request=>{requirePermission(request.actor,'manage_products');const kind=String(request.params.kinds||'').replace(/s$/,'');if(!['category','product'].includes(kind))throw validationError({kind:'Choose a supported catalogue record type.'});if(String(request.body?.reason||'').trim().length<5)throw validationError({reason:'Record why the catalogue information is changing.'});return{data:await repository.saveCatalogueOverride(request.actor,kind,request.params.itemId,request.body||{},request.id),meta:{requestId:request.id}};});
  app.post('/api/v1/administration/workflow-records/:recordId/corrections', { preHandler: requireCsrf }, async request=>{requirePermission(request.actor,'correct_approved_records');if(String(request.body?.reason||'').trim().length<10)throw validationError({reason:'Record a detailed correction reason.'});if(!request.body?.values||!Object.keys(request.body.values).length)throw validationError({values:'Enter at least one approved correction.'});return{data:await repository.manageRecord(request.actor,request.params.recordId,'correction',request.body,request.id),meta:{requestId:request.id}};});
  app.post('/api/v1/admin/users/:accountId/temporary-password', { preHandler: requireCsrf }, async request => ({ data: await administrationService.resetTemporaryPassword(request.actor,request.params.accountId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.get('/api/v1/admin/users/:accountId/audit', { preHandler: requireAuthentication }, async request => ({ data: await administrationService.getUserAudit(request.actor,request.params.accountId), meta:{requestId:request.id} }));
  app.get('/api/v1/admin/users/:accountId/login-history', { preHandler: requireAuthentication }, async request => ({ data: await administrationService.getUserLoginHistory(request.actor,request.params.accountId), meta:{requestId:request.id} }));
  app.patch('/api/v1/administration/companies/:companyId', { preHandler: requireCsrf }, async request => ({ data: await administrationService.updateCompany(request.actor,request.params.companyId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.put('/api/v1/administration/companies/:companyId/representative', { preHandler: requireCsrf }, async request => ({ data: await administrationService.assignRepresentative(request.actor,request.params.companyId,request.body || {},request.id), meta:{requestId:request.id} }));
  app.post('/api/v1/admin/users/:accountId/profile-image', { preHandler: requireCsrf }, async request => ({ data: await administrationService.saveProfileImage(request.actor,request.params.accountId,await parseProfileImageRequest(request,config.maxUploadBytes),request.id), meta:{requestId:request.id} }));
  app.get('/api/v1/admin/users/:accountId/profile-image', { preHandler: requireAuthentication }, async (request,reply) => { const image=await administrationService.getProfileImage(request.actor,request.params.accountId); reply.header('Content-Type',image.media_type).header('Cache-Control','private, max-age=300').header('X-Content-Type-Options','nosniff'); return reply.send(image.buffer); });

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
