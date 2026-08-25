import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiServices } from '../../../src/services/api/createApiServices.js';
import { createFixture, FABRICATED_PASSWORD } from './fixtures.js';

const bodyFromRequest = async body => {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof FormData) return body;
  return body;
};

function createInjectFetch(app) {
  let cookie = '';
  return async (url, options = {}) => {
    const headers = Object.fromEntries(new Headers(options.headers || {}).entries());
    if (cookie) headers.cookie = cookie;
    const response = await app.inject({
      method: options.method || 'GET',
      url: `${url.pathname}${url.search}`,
      headers,
      payload: await bodyFromRequest(options.body),
    });
    const setCookie = response.headers['set-cookie'];
    if (setCookie) cookie = String(setCookie).split(';')[0];
    if (response.statusCode === 204) return new Response(null, { status: 204, headers: response.headers });
    return new Response(response.body, { status: response.statusCode, headers: response.headers });
  };
}

function createBrowserNativeFetch(app) {
  const injectedFetch = createInjectFetch(app);
  return function browserNativeFetch(url, options) {
    if (this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    return injectedFetch(url, options);
  };
}

const containsSensitiveProductKey = value => {
  if (Array.isArray(value)) return value.some(containsSensitiveProductKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (
    /^(?:unitPrice|costPrice|privatePrice|supplierCost|password|passwordHash)$/i.test(key)
    || containsSensitiveProductKey(child)
  ));
};

test('signed-out API startup loads approved catalogue/reference data and treats auth/me 401 as signed out', async t => {
  const { app } = await createFixture();
  t.after(() => app.close());
  const services = createApiServices({
    apiBaseUrl: '/api/v1',
    requestTimeoutMs: 5000,
    fetchImplementation: createInjectFetch(app),
  });

  await services.initialize();
  const [catalogue, registration, session] = await Promise.all([
    services.products.getCatalogue(),
    services.accounts.getRegistrationOptions(),
    services.auth.getSession(),
  ]);

  assert.equal(session, null);
  assert.equal(catalogue.categories.length, 8);
  assert.equal(catalogue.products.length, 84);
  assert.ok(Object.keys(catalogue.recommendedCategories).length > 0);
  assert.equal(containsSensitiveProductKey(catalogue), false);
  assert.ok(registration.areas.length > 0);
  assert.ok(registration.industries.length > 0);
  assert.ok(registration.branches.length > 0);
  assert.ok(Object.values(registration.areaDirectory).every(entry => entry.representatives.length === 0));
  assert.doesNotMatch(JSON.stringify(registration), /fabricated|example\.invalid/i);
});

test('browser-native fetch keeps its Window receiver through the complete signed-out startup sequence', async t => {
  const { app } = await createFixture();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createBrowserNativeFetch(app);
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await app.close();
  });

  const services = createApiServices({
    apiBaseUrl: 'https://connect.rhom.co.za:8443/api/v1',
    requestTimeoutMs: 5000,
  });

  await services.initialize();
  const [catalogue, registration, session] = await Promise.all([
    services.products.getCatalogue(),
    services.accounts.getRegistrationOptions(),
    services.auth.getSession(),
  ]);

  assert.equal(session, null, 'signed-out auth/me must lead to sign-in rather than service-unavailable');
  assert.equal(catalogue.categories.length, 8);
  assert.equal(catalogue.products.length, 84);
  assert.ok(Object.keys(catalogue.recommendedCategories).length > 0);
  assert.ok(registration.areas.length > 0);
});

test('fabricated Administrator completes the first authenticated application bootstrap', async t => {
  const { app } = await createFixture();
  t.after(() => app.close());
  const services = createApiServices({
    apiBaseUrl: '/api/v1',
    requestTimeoutMs: 5000,
    fetchImplementation: createInjectFetch(app),
  });

  await services.initialize();
  const administrator = await services.auth.signIn({ email: 'fabricated-admin', password: FABRICATED_PASSWORD });
  assert.equal(administrator.role, 'administrator');

  const [enquiries, orders, notifications, preferences, settings, registration, overview] = await Promise.all([
    services.enquiries.list(),
    services.orders.list(),
    services.notifications.list(),
    services.notifications.getPreferences(),
    services.userSettings.get(),
    services.accounts.getRegistrationOptions(),
    services.administration.getOverview(),
  ]);

  assert.deepEqual(enquiries, []);
  assert.deepEqual(orders, []);
  assert.deepEqual(notifications, []);
  assert.equal(preferences.channels.inApp, true);
  assert.equal(settings.appearance.mode, 'light');
  assert.ok(registration.areas.length > 0);
  assert.ok(overview.users.some(user => user.username === 'fabricated-admin'));
});

test('authenticated bootstrap resources remain protected before login', async t => {
  const { app } = await createFixture();
  t.after(() => app.close());
  for (const url of [
    '/api/v1/orders',
    '/api/v1/notifications',
    '/api/v1/users/me/notification-preferences',
    '/api/v1/users/me/settings',
    '/api/v1/administration/overview',
    '/api/v1/enquiries/options',
  ]) {
    const response = await app.inject({ method: 'GET', url });
    assert.equal(response.statusCode, 401, url);
  }
});

test('customer RFQ options expose only the company-assigned representative after authentication', async t => {
  const { app } = await createFixture();
  t.after(() => app.close());
  const services = createApiServices({ apiBaseUrl: '/api/v1', requestTimeoutMs: 5000, fetchImplementation: createInjectFetch(app) });

  await services.initialize();
  const publicOptions = await services.accounts.getRegistrationOptions();
  assert.ok(Object.values(publicOptions.areaDirectory).every(entry => entry.representatives.length === 0));

  await services.auth.signIn({ email: 'customer.a@example.invalid', password: FABRICATED_PASSWORD });
  const enquiryOptions = await services.accounts.getEnquiryOptions();
  assert.equal(enquiryOptions.preferredRepresentative.id, '30000000-0000-4000-8000-000000000001');
  assert.ok(Object.values(enquiryOptions.areaDirectory).every(entry => entry.representatives.length === 1));
  assert.ok(Object.values(enquiryOptions.areaDirectory).every(entry => entry.representatives[0].id === enquiryOptions.preferredRepresentative.id));
  assert.doesNotMatch(JSON.stringify(enquiryOptions), /30000000-0000-4000-8000-000000000002/);
});
