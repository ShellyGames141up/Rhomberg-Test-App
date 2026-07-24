import { ServiceError } from '../contracts.js';
import {
  MAX_ACCEPTANCE_DOCUMENT_BYTES,
  MAX_PO_FILE_BYTES,
  MAX_QUOTATION_DOCUMENT_BYTES,
  validateEnquiry,
  validateExpeditingAction,
  validateOrderAcceptance,
  validatePlanningSubmission,
  validateQuotationConfirmation,
  validateRegistration,
  validateSignIn,
  validateWorkflowActionRequest,
} from '../validation.js';
import { createBrowserStore } from '../browserStore.js';
import { THEME_PREFERENCE_KEY } from '../serviceKeys.js';
import { HttpClient } from './HttpClient.js';

export function createApiServices(config = {}) {
  const client = new HttpClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.requestTimeoutMs, fetchImplementation: config.fetchImplementation });
  const preferenceStore = createBrowserStore(config.storage);
  let draftSaveQueue = Promise.resolve();
  let expeditingWorkspaceOptions = null;

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
      const { poFile, ...serialisableDetails } = details;
      const form = new FormData();
      form.append('payload', JSON.stringify({ details: serialisableDetails, items: lines }));
      if (poFile) form.append('purchaseOrder', poFile, poFile.name);
      return client.post('/enquiries', form, { headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `rfq-${Date.now()}` } });
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
      return client.post(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`, request, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
  };

  const audit = {
    list: filters => client.get('/audit-events', { query: filters }),
  };

  const notifications = {
    list: filters => client.get('/notifications', { query: filters }),
    markRead: notificationId => client.post(`/notifications/${encodeURIComponent(notificationId)}/read`, {}),
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
    products,
    enquiries,
    orders,
    workflow,
    tracking: workflow,
    audit,
    notifications,
    planning,
    expediting,
    preferences,
    preview: {
      emailRecipient: '',
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      maxQuotationDocumentBytes: MAX_QUOTATION_DOCUMENT_BYTES,
      maxAcceptanceDocumentBytes: MAX_ACCEPTANCE_DOCUMENT_BYTES,
      persistenceLabel: 'the secure company service',
    },
  };
}
