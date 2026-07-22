import { ServiceError } from '../contracts.js';
import { MAX_PO_FILE_BYTES, validateEnquiry, validateRegistration, validateSignIn, validateWorkflowActionRequest } from '../validation.js';
import { createBrowserStore } from '../browserStore.js';
import { THEME_PREFERENCE_KEY } from '../serviceKeys.js';
import { HttpClient } from './HttpClient.js';

export function createApiServices(config = {}) {
  const client = new HttpClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.requestTimeoutMs, fetchImplementation: config.fetchImplementation });
  const preferenceStore = createBrowserStore(config.storage);
  let draftSaveQueue = Promise.resolve();

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

  const workflow = {
    list: filters => client.get('/orders', { query: filters }),
    getAllowedActions(recordId, { entityType = 'rfq' } = {}) {
      const resource = entityType === 'order' ? 'orders' : 'enquiries';
      return client.get(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`);
    },
    async performAction(recordId, input) {
      const request = validateWorkflowActionRequest(input);
      const resource = input?.entityType === 'order' ? 'orders' : 'enquiries';
      return client.post(`/${resource}/${encodeURIComponent(recordId)}/workflow-actions`, request, {
        headers: { 'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `workflow-${Date.now()}` },
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
    workflow,
    tracking: workflow,
    audit,
    notifications,
    preferences,
    preview: {
      emailRecipient: '',
      maxPoFileBytes: MAX_PO_FILE_BYTES,
      persistenceLabel: 'the secure company service',
    },
  };
}
