const supplied = globalThis.__RHOMBERG_APP_CONFIG__ || {};

export const runtimeConfig = Object.freeze({
  apiBaseUrl: supplied.apiBaseUrl || '/api/v1',
  requestTimeoutMs: Number(supplied.requestTimeoutMs) || 15000,
});
