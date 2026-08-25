import { ServiceError } from '../contracts.js';
import {
  MAX_ACCEPTANCE_DOCUMENT_BYTES,
  MAX_DISPATCH_PROOF_BYTES,
  MAX_PO_FILE_BYTES,
  MAX_QUOTATION_DOCUMENT_BYTES,
  MAX_REPRESENTATIVE_ORDER_DOCUMENT_BYTES,
  validateEnquiry,
  validateDispatchAction,
  validateDispatchReceipt,
  validateExpeditingAction,
  validateOrderAcceptance,
  validatePersonalisation,
  validatePersonalisationImage,
  validateNotificationPreferenceSettings,
  validatePlanningSubmission,
  validateQuotationConfirmation,
  validateRegistration,
  validateRepresentativeDocumentReplacement,
  validateRepresentativeLoadedOrder,
  validateSignIn,
  validateWorkflowActionRequest,
} from '../validation.js';
import { createBrowserStore } from '../browserStore.js';
import { THEME_PREFERENCE_KEY } from '../serviceKeys.js';
import { HttpClient } from './HttpClient.js';
import { MAX_CERTIFICATE_BYTES, validateCertificateUpload } from '../../domain/certification.js';
import {
  validateQaFailure,
  validateQaPass,
  validateQaRework,
  validateQaStart,
} from '../../domain/qualityAssurance.js';
import {
  validateTechnicalMessage,
  validateTechnicalResponse,
} from '../../domain/technicalSupport.js';

export function createApiServices(config = {}) {
  const client = new HttpClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.requestTimeoutMs, fetchImplementation: config.fetchImplementation });
  const preferenceStore = createBrowserStore(config.storage);
  let draftSaveQueue = Promise.resolve();
  let expeditingWorkspaceOptions = null;
  let dispatchWorkspaceOptions = null;
  const today = () => (typeof config.now === 'function' ? config.now() : new Date()).toISOString().slice(0, 10);

  const refreshCsrfToken = async () => {
    const result = await client.get('/auth/csrf-token');
    client.setCsrfToken(result?.token);
  };

  const auth = {
    async getSession() {
      try {
        return await client.get('/auth/me');
      } catch (error) {
        if (error instanceof ServiceError && error.status === 401) return null;
        throw error;
      }
    },

    async signIn(credentials) {
      validateSignIn(credentials);
      const result = await client.post('/auth/login', credentials);
      if (result?.csrfToken) client.setCsrfToken(result.csrfToken);
      return result.user;
    },

    async register(data) {
      validateRegistration(data);
      throw new ServiceError('Public self-registration is unavailable. An authorised Administrator must create the company account.', { code: 'ADMINISTRATOR_PROVISIONING_REQUIRED', status: 403 });
    },

    async signOut() {
      await client.post('/auth/logout', {});
      client.setCsrfToken('');
    },

    async changePassword({ currentPassword, newPassword }) {
      await client.post('/auth/change-password', { currentPassword, newPassword });
      client.setCsrfToken('');
      return { sessionEnded: true };
    },

    switchWorkspace: role => client.post('/auth/workspace', { role }).then(result => result.user),

    async getDemoLogins() {
      return [];
    },
  };

  const accounts = {
    getCurrent: () => client.get('/companies/me'),
    getRegistrationOptions: () => client.get('/reference-data/registration'),
    getEnquiryOptions: () => client.get('/enquiries/options'),
    listCompanies: () => client.get('/companies'),
  };

  const credentials = {
    requestVerification: () => { throw new ServiceError('Self-service credential changes require the approved identity and email-delivery integration. Contact your Administrator.', { code: 'IDENTITY_INTEGRATION_REQUIRED', status: 501 }); },
    confirmChange: () => { throw new ServiceError('Self-service credential changes require the approved identity integration.', { code: 'IDENTITY_INTEGRATION_REQUIRED', status: 501 }); },
  };

  const products = {
    async getCatalogue() {
      const [categoryList, productList, recommendations] = await Promise.all([
        client.get('/products/categories'),
        client.get('/products'),
        client.get('/products/recommendations'),
      ]);
      return { categories: categoryList, products: productList, recommendedCategories: recommendations };
    },
    list: filters => client.get('/products', { query: filters }),
    getById: productId => client.get(`/products/${encodeURIComponent(productId)}`),
  };

  const enquiries = {
    list: filters => client.get('/enquiries', { query: filters }),
    listRepresentativeInbox: filters => client.get('/enquiries/inbox', { query: filters }),
    getById: enquiryId => client.get(`/enquiries/${encodeURIComponent(enquiryId)}`),
    getDraft: () => client.get('/enquiry-drafts/current').then(result => result?.items || []),
    saveDraft(lines) {
      const request = draftSaveQueue
        .catch(() => undefined)
        .then(() => client.put('/enquiry-drafts/current', { items: lines }))
        .then(result => result?.items || []);
      draftSaveQueue = request;
      return request;
    },
    async submit(details, lines) {
      validateEnquiry(details, lines);
      await draftSaveQueue.catch(() => undefined);
      const { poFile, submissionKey, ...serialisableDetails } = details;
      const form = new FormData();
      form.append('payload', JSON.stringify({ details: serialisableDetails, items: lines }));
      if (poFile) form.append('purchaseOrder', poFile, poFile.name);
      return client.post('/enquiries', form, {
        headers: { 'Idempotency-Key': submissionKey || globalThis.crypto?.randomUUID?.() || `rfq-${Date.now()}` },
      });
    },
  };

  const orders = {
    list: filters => client.get('/orders', { query: filters }),
    getById: orderId => client.get(`/orders/${encodeURIComponent(orderId)}`),
  };

  const representativeOrders = {
    getOptions: () => client.get('/representatives/orders/options'),
    checkDuplicate: candidate => client.post('/representatives/orders/duplicate-check', candidate),
    create(input) {
      const { order, quotationFile, purchaseOrderFile, supportingDocuments } = validateRepresentativeLoadedOrder(input, { today: today() });
      const { submissionKey, ...payload } = order;
      const form = new FormData();
      form.append('payload', JSON.stringify(payload));
      form.append('quotation', quotationFile, quotationFile.name);
      form.append('purchaseOrder', purchaseOrderFile, purchaseOrderFile.name);
      supportingDocuments.forEach(file => form.append('supportingDocuments', file, file.name));
      return client.post('/representatives/orders', form, {
        headers: { 'Idempotency-Key': submissionKey },
      });
    },
    listDocuments: orderId => client.get(`/orders/${encodeURIComponent(orderId)}/source-documents`),
    async downloadDocument(orderId, documentId) {
      return client.download(`/orders/${encodeURIComponent(orderId)}/source-documents/${encodeURIComponent(documentId)}/download`);
    },
    replaceDocument(orderId, documentId, input) {
      const replacement = validateRepresentativeDocumentReplacement(input);
      const form = new FormData();
      form.append('payload', JSON.stringify({ reason: replacement.reason }));
      form.append('document', replacement.file, replacement.file.name);
      return client.post(`/orders/${encodeURIComponent(orderId)}/source-documents/${encodeURIComponent(documentId)}/versions`, form, {
        headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `document-replacement-${Date.now()}` },
      });
    },
  };

  const workflow = {
    async list(filters) {
      const [rfqs, customerOrders] = await Promise.all([enquiries.list(filters), orders.list(filters)]);
      return [...rfqs, ...customerOrders];
    },
    getAllowedActions(recordId, { entityType = 'rfq' } = {}) {
      const resource = entityType === 'order' ? 'orders' : 'enquiries';
      return client.get(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`);
    },
    async performAction(recordId, input) {
      let request = validateWorkflowActionRequest(input);
      const resource = input?.entityType === 'order' ? 'orders' : 'enquiries';
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `workflow-${Date.now()}`;
      if (request.action === 'mark_quoted') {
        const { quotation, quotationDocumentFile } = validateQuotationConfirmation(request.data);
        request = { ...request, data: { quotation } };
        if (quotationDocumentFile) {
          const form = new FormData();
          form.append('payload', JSON.stringify(request));
          form.append('quotationDocument', quotationDocumentFile, quotationDocumentFile.name);
          return client.post(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`, form, {
            headers: { 'Idempotency-Key': idempotencyKey },
          });
        }
      }
      if (request.action === 'accept_order') {
        const { acceptance, acceptanceDocumentFile } = validateOrderAcceptance(request.data);
        request = { ...request, data: { acceptance } };
        if (acceptanceDocumentFile) {
          const form = new FormData();
          form.append('payload', JSON.stringify(request));
          form.append('acceptanceDocument', acceptanceDocumentFile, acceptanceDocumentFile.name);
          return client.post(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`, form, {
            headers: { 'Idempotency-Key': idempotencyKey },
          });
        }
      }
      if (request.action === 'complete_planning') {
        request = { ...request, data: validatePlanningSubmission(request.data) };
      }
      if (request.action === 'start_qa' || request.action === 'start_qa_reinspection') {
        request = { ...request, data: { qaStart: validateQaStart(request.data?.qaStart || request.data) } };
      }
      if (request.action === 'pass_qa') {
        request = { ...request, data: { qaPass: validateQaPass(request.data?.qaPass || request.data) } };
      }
      if (request.action === 'fail_qa') {
        request = { ...request, data: { qaFailure: validateQaFailure(request.data?.qaFailure || request.data) } };
      }
      if (request.action === 'resubmit_to_qa') {
        request = { ...request, data: { qaRework: validateQaRework(request.data?.qaRework || request.data) } };
      }
      if (request.action === 'confirm_dispatch_receipt') {
        request = { ...request, data: { dispatchReceipt: validateDispatchReceipt(request.data) } };
      }
      const hasExpeditingPayload = Boolean(
        request.data?.expeditingUpdate
        || request.data?.expeditingCustomerMessage
        || request.data?.expeditingProgressStep
        || request.data?.expeditingReadyExceptionAuthorised,
      );
      if (
        ['start_expediting', 'add_expediting_update', 'complete_expediting'].includes(request.action)
        || (['place_on_hold', 'resume_order'].includes(request.action) && hasExpeditingPayload)
      ) {
        request = {
          ...request,
          data: validateExpeditingAction(request.action, request.data, { ...(expeditingWorkspaceOptions || {}), today: today() }),
        };
      }
      if ([
        'mark_ready_for_collection',
        'start_delivery',
        'confirm_collection',
        'confirm_delivery',
        'complete_collection',
        'complete_delivery',
        'report_delivery_problem',
      ].includes(request.action)) {
        const { dispatchUpdate, dispatchProofFile } = validateDispatchAction(
          request.action,
          request.data,
          dispatchWorkspaceOptions || {},
        );
        request = { ...request, data: { dispatchUpdate } };
        if (dispatchProofFile) {
          const form = new FormData();
          form.append('payload', JSON.stringify(request));
          form.append('dispatchProof', dispatchProofFile, dispatchProofFile.name);
          return client.post(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`, form, {
            headers: { 'Idempotency-Key': idempotencyKey },
          });
        }
      }
      return client.post(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`, request, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  };

  const audit = {
    list: filters => client.get('/audit-events', { query: filters }),
  };

  const orderDocuments = {
    getSharingOptions: orderId => client.get(`/orders/${encodeURIComponent(orderId)}/summary-sharing-options`),
    generate: (orderId, input) => client.post(
      `/orders/${encodeURIComponent(orderId)}/summary-pdfs`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `order-pdf-${Date.now()}` } },
    ),
    email: (orderId, input) => client.post(
      `/orders/${encodeURIComponent(orderId)}/summary-emails`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `order-email-${Date.now()}` } },
    ),
  };

  const archive = {
    getPolicy: () => client.get('/admin/retention-policy'),
    savePolicy: input => client.put('/admin/retention-policy', input),
    list: filters => client.get('/archived-orders', { query: filters }),
    approveArchival: (orderId, input) => client.post(
      `/orders/${encodeURIComponent(orderId)}/archive-approval`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `archive-approval-${Date.now()}` } },
    ),
    archiveOrder: (orderId, input) => client.post(
      `/orders/${encodeURIComponent(orderId)}/archive`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `archive-${Date.now()}` } },
    ),
    restoreOrder: (orderId, input) => client.post(
      `/orders/${encodeURIComponent(orderId)}/restore`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `restore-${Date.now()}` } },
    ),
    setLegalHold: (orderId, input) => client.put(`/orders/${encodeURIComponent(orderId)}/legal-hold`, input),
    exportBeforeDeletion: orderId => client.post(
      `/orders/${encodeURIComponent(orderId)}/retention-exports`,
      {},
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `retention-export-${Date.now()}` } },
    ),
    requestPermanentDeletion: (orderId, input) => client.post(`/orders/${encodeURIComponent(orderId)}/deletion-requests`, input),
  };

  const management = {
    getDashboard: filters => client.get('/management/dashboard', { query: filters }),
    getRepresentativeOptions: () => client.get('/management/representatives'),
    getPerformanceReportOptions: () => client.get('/management/performance-report-options'),
    reassignRepresentative: (recordId, input) => client.post(
      `/management/records/${encodeURIComponent(recordId)}/representative`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `reassign-${Date.now()}` } },
    ),
    approveWorkflowOverride: (recordId, input) => client.post(
      `/management/records/${encodeURIComponent(recordId)}/workflow-override-approval`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `override-approval-${Date.now()}` } },
    ),
    exportOperationalReport: filters => client.post(
      '/management/reports',
      filters || {},
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `management-report-${Date.now()}` } },
    ),
    exportPerformancePdf: input => client.post(
      '/management/performance-reports',
      input || {},
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `management-performance-report-${Date.now()}` } },
    ),
  };

  const administration = {
    getOverview: () => client.get('/administration/overview'),
    createCustomer: input => client.post('/admin/customer-accounts', { ...input.values, reason: input.reason || '' }),
    createEmployee: input => client.post('/admin/users', {
      displayName: input.values?.displayName,
      username: input.values?.username,
      email: input.values?.email || '',
      password: input.values?.password || '',
      role: input.values?.primaryRole,
      additionalRoles: input.values?.additionalRoles || [],
      branchId: input.values?.branchId || '',
      department: input.values?.department || '',
      phone: input.values?.phone || '',
      reason: input.reason || '',
    }),
    assignAccountRoles: (accountId, input) => client.post(`/admin/users/${encodeURIComponent(accountId)}/roles`, input),
    assignAccountBranch: (accountId, input) => client.post(`/admin/users/${encodeURIComponent(accountId)}/branch`, input),
    resetUserLogin: (accountId, input) => client.post(`/admin/users/${encodeURIComponent(accountId)}/temporary-password`, input),
    archiveEmployee: (accountId, input) => client.post(`/admin/users/${encodeURIComponent(accountId)}/archive`, input),
    uploadEmployeeProfileImage: (accountId, file, input = {}) => {
      const body = new FormData();
      body.append('file', file);
      body.append('reason', input.reason || '');
      return client.post(`/admin/users/${encodeURIComponent(accountId)}/profile-image`, body);
    },
    getUserAudit: accountId => client.get(`/admin/users/${encodeURIComponent(accountId)}/audit`),
    getUserLoginHistory: accountId => client.get(`/admin/users/${encodeURIComponent(accountId)}/login-history`),
    setAccountStatus: (accountId, input) => client.put(
      `/administration/users/${encodeURIComponent(accountId)}/status`,
      input,
    ),
    assignRepresentative: (companyId, input) => client.put(
      `/administration/companies/${encodeURIComponent(companyId)}/representative`,
      input,
    ),
    updateCompany: (companyId, input) => client.patch(`/administration/companies/${encodeURIComponent(companyId)}`, input),
    updateAccount: (accountId, input) => client.patch(`/administration/users/${encodeURIComponent(accountId)}`, input),
    setAccountPermissions: (accountId, input) => client.put(`/administration/users/${encodeURIComponent(accountId)}/permissions`, input),
    updateNotificationPreferences: (accountId, input) => client.put(`/administration/users/${encodeURIComponent(accountId)}/notification-preferences`, input),
    saveCatalogueItem: (kind, itemId, input) => client.patch(`/administration/catalogue/${encodeURIComponent(kind)}s/${encodeURIComponent(itemId)}`, input),
    correctRecord: (recordId, input) => client.post(`/administration/workflow-records/${encodeURIComponent(recordId)}/corrections`, input, {
      headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `administration-correction-${Date.now()}` },
    }),
    resetDemoData: () => {
      throw new ServiceError('Data reset controls are not available in the private-cloud application.', {
        code: 'PREVIEW_ONLY_OPERATION',
        status: 404,
      });
    },
  };

  const notifications = {
    list: filters => client.get('/notifications', { query: filters }),
    markRead: notificationId => client.post(`/notifications/${encodeURIComponent(notificationId)}/read`, {}),
    markAllRead: () => client.post('/notifications/read-all', {}),
    getPreferences: () => client.get('/users/me/notification-preferences'),
    savePreferences(candidate) {
      return client.put('/users/me/notification-preferences', validateNotificationPreferenceSettings(candidate));
    },
    retryDelivery: (notificationId, deliveryId) => client.post(
      `/notifications/${encodeURIComponent(notificationId)}/deliveries/${encodeURIComponent(deliveryId)}/retry`,
      {},
    ),
  };

  const planning = {
    getWorkspaceOptions: () => client.get('/planning/workspace-options'),
  };

  const expediting = {
    async getWorkspaceOptions() {
      expeditingWorkspaceOptions = await client.get('/expediting/workspace-options');
      return expeditingWorkspaceOptions;
    },
  };

  const dispatch = {
    async getWorkspaceOptions() {
      dispatchWorkspaceOptions = await client.get('/dispatch/workspace-options');
      return dispatchWorkspaceOptions;
    },
  };

  const laboratory = {
    getWorkspaceOptions: () => client.get('/laboratory/workspace-options'),
    listOrders: filters => client.get('/laboratory/orders', { query: filters }),
    getDashboard: filters => client.get('/laboratory/dashboard', { query: filters }),
    downloadLabDocument: documentId => client.download(`/laboratory/documents/${encodeURIComponent(documentId)}/download`),
    uploadCertificate(orderId, unitId, input) {
      const metadata = validateCertificateUpload(input);
      const form = new FormData();
      form.append('metadata', JSON.stringify({ ...metadata, serialNumber: input.serialNumber, certificationType: input.certificationType, confirmAssociation: input.confirmAssociation, fileName: undefined, mimeType: undefined, sizeBytes: undefined }));
      form.append('certificate', input.file, input.file.name);
      return client.post(
        `/laboratory/orders/${encodeURIComponent(orderId)}/units/${encodeURIComponent(unitId)}/certificate`,
        form,
        { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `certificate-${Date.now()}` } },
      );
    },
    uploadCertificatesBatch(orderId, entries = []) {
      const form = new FormData();
      const metadata = entries.map((entry, index) => {
        const certificate = validateCertificateUpload(entry);
        form.append('certificates', entry.file, `${index + 1}-${entry.file.name}`);
        return { ...certificate, unitId: entry.unitId, serialNumber: entry.serialNumber, certificationType: entry.certificationType, confirmAssociation: entry.confirmAssociation, notes: entry.notes || '', fileName: undefined, mimeType: undefined, sizeBytes: undefined };
      });
      form.append('metadata', JSON.stringify(metadata));
      return client.post(`/laboratory/orders/${encodeURIComponent(orderId)}/certificates/batch`, form, { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `certificate-batch-${Date.now()}` } });
    },
    replaceCertificate(orderId, unitId, input) {
      const metadata = validateCertificateUpload(input);
      const form = new FormData();
      form.append('metadata', JSON.stringify({ ...metadata, reason: input.reason, serialNumber: input.serialNumber, certificationType: input.certificationType, confirmAssociation: input.confirmAssociation, fileName: undefined, mimeType: undefined, sizeBytes: undefined }));
      form.append('certificate', input.file, input.file.name);
      return client.post(`/laboratory/orders/${encodeURIComponent(orderId)}/units/${encodeURIComponent(unitId)}/certificate/replace`, form, { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `certificate-replacement-${Date.now()}` } });
    },
    downloadCertificate: certificateId => client.download(`/certificates/${encodeURIComponent(certificateId)}/download`),
    archiveCertificates: orderId => client.post(`/laboratory/orders/${encodeURIComponent(orderId)}/certificates/archive`, {}),
  };

  const qualityAssurance = {
    getWorkspaceOptions: () => client.get('/quality-assurance/workspace-options'),
    listOrders: filters => client.get('/quality-assurance/orders', { query: filters }),
    getDashboard: filters => client.get('/quality-assurance/dashboard', { query: filters }),
  };

  const technicalMultipart = (payload, attachment) => {
    const form = new FormData();
    form.append('payload', JSON.stringify({ ...payload, attachment: undefined }));
    if (attachment) form.append('attachment', attachment, attachment.name);
    return form;
  };

  const technicalSupport = {
    getOptions: () => client.get('/technical-support/options'),
    getByRfq: rfqId => client.get(`/rfqs/${encodeURIComponent(rfqId)}/technical-support`),
    listQueue: filters => client.get('/technical-support/queue', { query: filters }),
    request(rfqId, input) {
      return client.post(`/rfqs/${encodeURIComponent(rfqId)}/technical-support`, technicalMultipart(input, input.attachment));
    },
    assign: (requestId, input) => client.post(`/technical-support/${encodeURIComponent(requestId)}/assign`, input),
    startReview: requestId => client.post(`/technical-support/${encodeURIComponent(requestId)}/start-review`, {}),
    postMessage(requestId, input) {
      validateTechnicalMessage(input, { customer: false });
      return client.post(`/technical-support/${encodeURIComponent(requestId)}/messages`, technicalMultipart(input, input.attachment));
    },
    requestInformation(requestId, input) {
      validateTechnicalMessage({ ...input, classification: 'internal_only' });
      return client.post(`/technical-support/${encodeURIComponent(requestId)}/request-information`, technicalMultipart(input, input.attachment));
    },
    forwardCustomerRequest(requestId, input) {
      validateTechnicalMessage({ ...input, classification: 'customer_safe' });
      return client.post(`/technical-support/${encodeURIComponent(requestId)}/request-information/customer`, technicalMultipart(input, input.attachment));
    },
    respond(requestId, input) {
      validateTechnicalResponse(input);
      return client.post(`/technical-support/${encodeURIComponent(requestId)}/respond`, technicalMultipart(input, input.attachment));
    },
    complete: (requestId, input) => client.post(`/technical-support/${encodeURIComponent(requestId)}/complete`, input),
    override: (requestId, input) => client.post(`/technical-support/${encodeURIComponent(requestId)}/override`, input),
    downloadRfq: requestId => client.get(`/technical-support/${encodeURIComponent(requestId)}/rfq/download`),
    downloadAttachment: (requestId, attachmentId) => client.download(`/technical-support/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/download`),
    getMetrics: filters => client.get('/technical-support/metrics', { query: filters }),
  };

  const clientVisits = {
    listClients: filters => client.get('/representatives/clients', { query: filters }),
    getOverview: filters => client.get('/representatives/client-activity', { query: filters }),
    listAppointments: filters => client.get('/representatives/appointments', { query: filters }),
    schedule: (clientId, input) => client.post(`/clients/${encodeURIComponent(clientId)}/appointments`, input),
    start: appointmentId => client.post(`/appointments/${encodeURIComponent(appointmentId)}/start`, {}),
    locationCheck: (appointmentId, input) => client.post(`/appointments/${encodeURIComponent(appointmentId)}/location-check`, input),
    customerConfirm: appointmentId => client.post(`/appointments/${encodeURIComponent(appointmentId)}/customer-confirmation`, {}),
    createQr: appointmentId => client.post(`/appointments/${encodeURIComponent(appointmentId)}/qr`, {}),
    verifyQr: (appointmentId, token) => client.post(`/appointments/${encodeURIComponent(appointmentId)}/qr/verify`, { token }),
    complete: (appointmentId, input) => client.post(`/appointments/${encodeURIComponent(appointmentId)}/complete`, input),
    detectMissed: () => client.post('/sales-manager/missed-visits/detect', {}),
    submitMissedReason: (appointmentId, input) => client.post(`/appointments/${encodeURIComponent(appointmentId)}/missed-reason`, input),
    getCompliance: filters => client.get('/sales-manager/visit-compliance', { query: filters }),
    getLocations: () => client.get('/admin/locations'),
    saveLocation: input => input.id ? client.patch(`/admin/locations/${encodeURIComponent(input.id)}`, input) : client.post('/admin/locations', input),
    getPolicy: () => client.get('/admin/visit-policy'),
    savePolicy: input => client.put('/admin/visit-policy', input),
    getOwnWorkSummary: filters => client.get('/representatives/work-location-summary', { query: filters }),
  };

  const personalisation = {
    get: () => client.get('/users/me/personalisation'),
    save(candidate) {
      validatePersonalisation(candidate);
      return client.put('/users/me/personalisation', candidate);
    },
    complete(candidate) {
      validatePersonalisation({ ...candidate, setupCompleted: true });
      return client.put('/users/me/personalisation', { ...candidate, setupCompleted: true });
    },
    reset: options => client.post('/users/me/personalisation/reset', options || {}),
    uploadImage(file, kind, position = { x: 50, y: 50 }) {
      if (kind !== 'profileImage') throw new ServiceError('Customer-controlled application branding is disabled.', { code: 'INVALID_IMAGE_KIND', status: 422 });
      validatePersonalisationImage(file);
      const form = new FormData();
      form.append('kind', kind);
      form.append('position', JSON.stringify(position));
      form.append('image', file, file.name);
      return client.post('/users/me/personalisation/images', form);
    },
    removeImage: imageId => client.delete(`/users/me/personalisation/images/${encodeURIComponent(imageId)}`),
  };

  const preferences = {
    async getTheme() {
      return preferenceStore.get(THEME_PREFERENCE_KEY, null) || 'light';
    },
    async setTheme(theme) {
      const safeTheme = theme === 'dark' ? 'dark' : 'light';
      preferenceStore.set(THEME_PREFERENCE_KEY, safeTheme);
      return safeTheme;
    },
  };

  const userSettings = {
    get: () => client.get('/users/me/settings'),
    save: candidate => client.put('/users/me/settings', candidate),
    completeWelcome: () => client.post('/users/me/settings/onboarding/welcome', {}),
    saveTutorialProgress: input => client.put('/users/me/settings/onboarding/tutorial', input),
    resetTutorial: () => client.post('/users/me/settings/onboarding/tutorial/reset', {}),
    reset: () => client.post('/users/me/settings/reset', {}),
  };

  return {
    mode: 'api',
    initialize: refreshCsrfToken,
    auth,
    accounts,
    credentials,
    products,
    enquiries,
    orders,
    representativeOrders,
    workflow,
    tracking: workflow,
    audit,
    orderDocuments,
    archive,
    management,
    administration,
    notifications,
    planning,
    expediting,
    laboratory,
    qualityAssurance,
    dispatch,
    technicalSupport,
    clientVisits,
    personalisation,
    userSettings,
    preferences,
    preview: {
      emailRecipient: '',
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      maxQuotationDocumentBytes: MAX_QUOTATION_DOCUMENT_BYTES,
      maxAcceptanceDocumentBytes: MAX_ACCEPTANCE_DOCUMENT_BYTES,
      maxDispatchProofBytes: MAX_DISPATCH_PROOF_BYTES,
      maxRepresentativeOrderDocumentBytes: MAX_REPRESENTATIVE_ORDER_DOCUMENT_BYTES,
      maxCertificateBytes: MAX_CERTIFICATE_BYTES,
      persistenceLabel: 'the secure company service',
    },
  };
}
