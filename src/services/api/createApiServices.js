import { ServiceError } from '../contracts.js';
import {
  MAX_ACCEPTANCE_DOCUMENT_BYTES,
  MAX_DISPATCH_PROOF_BYTES,
  MAX_PO_FILE_BYTES,
  MAX_QUOTATION_DOCUMENT_BYTES,
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

export function createApiServices(config = {}) {
  const client = new HttpClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.requestTimeoutMs, fetchImplementation: config.fetchImplementation });
  const preferenceStore = createBrowserStore(config.storage);
  let draftSaveQueue = Promise.resolve();
  let expeditingWorkspaceOptions = null;
  let dispatchWorkspaceOptions = null;

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
      const result = await client.post('/auth/register', data);
      if (result?.csrfToken) client.setCsrfToken(result.csrfToken);
      return result.user;
    },

    async signOut() {
      await client.post('/auth/logout', {});
      client.setCsrfToken('');
    },

    async getDemoLogins() {
      return [];
    },
  };

  const accounts = {
    getCurrent: () => client.get('/companies/me'),
    getRegistrationOptions: () => client.get('/reference-data/registration'),
    listCompanies: () => client.get('/companies'),
  };

  const credentials = {
    requestVerification: input => client.post('/auth/credential-changes/challenges', input),
    confirmChange: input => client.post(
      `/auth/credential-changes/challenges/${encodeURIComponent(input.challengeId)}/confirm`,
      input,
    ),
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
          data: validateExpeditingAction(request.action, request.data, expeditingWorkspaceOptions || {}),
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
  };

  const administration = {
    getOverview: () => client.get('/administration/overview'),
    setAccountStatus: (accountId, status) => client.put(
      `/administration/users/${encodeURIComponent(accountId)}/status`,
      { status },
    ),
    assignRepresentative: (companyId, representativeId) => client.put(
      `/administration/companies/${encodeURIComponent(companyId)}/representative`,
      { representativeId },
    ),
    resetDemoData: () => {
      throw new ServiceError('Fabricated-data reset controls are not available in the private-cloud application.', {
        code: 'PREVIEW_ONLY_OPERATION',
        status: 404,
      });
    },
  };

  const executiveDemo = Object.freeze({
    getState: async () => null,
    getCatalogue: async () => ({ scenarios: [], roles: [], current: null }),
    selectScenario: async () => null,
    setStep: async () => null,
    setPresentationMode: async () => null,
    setLayoutMode: async () => null,
    setDevicePreview: async () => null,
    resetScenario: async () => null,
    switchRole: async () => {
      throw new ServiceError('Guided role switching is not available in the private-cloud application.', {
        code: 'PREVIEW_ONLY_OPERATION',
        status: 404,
      });
    },
  });

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
    updateUnit: (orderId, unitId, action, input) => client.post(
      `/laboratory/orders/${encodeURIComponent(orderId)}/units/${encodeURIComponent(unitId)}/actions/${encodeURIComponent(action)}`,
      input,
      { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `lab-unit-${Date.now()}` } },
    ),
    uploadCertificate(orderId, unitId, input) {
      const metadata = validateCertificateUpload(input);
      const form = new FormData();
      form.append('metadata', JSON.stringify({ ...metadata, fileName: undefined, mimeType: undefined, sizeBytes: undefined }));
      form.append('certificate', input.file, input.file.name);
      return client.post(
        `/laboratory/orders/${encodeURIComponent(orderId)}/units/${encodeURIComponent(unitId)}/certificate`,
        form,
        { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `certificate-${Date.now()}` } },
      );
    },
    downloadCertificate: certificateId => client.get(`/certificates/${encodeURIComponent(certificateId)}/download`),
    archiveCertificates: orderId => client.post(`/laboratory/orders/${encodeURIComponent(orderId)}/certificates/archive`, {}),
  };

  const qualityAssurance = {
    getWorkspaceOptions: () => client.get('/quality-assurance/workspace-options'),
    listOrders: filters => client.get('/quality-assurance/orders', { query: filters }),
    getDashboard: filters => client.get('/quality-assurance/dashboard', { query: filters }),
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
      return preferenceStore.get(THEME_PREFERENCE_KEY, null) || (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },
    async setTheme(theme) {
      const safeTheme = theme === 'dark' ? 'dark' : 'light';
      preferenceStore.set(THEME_PREFERENCE_KEY, safeTheme);
      return safeTheme;
    },
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
    workflow,
    tracking: workflow,
    audit,
    orderDocuments,
    archive,
    management,
    administration,
    executiveDemo,
    notifications,
    planning,
    expediting,
    laboratory,
    qualityAssurance,
    dispatch,
    personalisation,
    preferences,
    preview: {
      emailRecipient: '',
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      maxQuotationDocumentBytes: MAX_QUOTATION_DOCUMENT_BYTES,
      maxAcceptanceDocumentBytes: MAX_ACCEPTANCE_DOCUMENT_BYTES,
      maxDispatchProofBytes: MAX_DISPATCH_PROOF_BYTES,
      maxCertificateBytes: MAX_CERTIFICATE_BYTES,
      persistenceLabel: 'the secure company service',
    },
  };
}
