import { ServiceError } from '../contracts.js';

const makeRequestId = () => globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class HttpClient {
  constructor({ baseUrl, timeoutMs = 15000, fetchImplementation = globalThis.fetch } = {}) {
    this.baseUrl = String(baseUrl || '/api/v1').replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImplementation;
    this.csrfToken = '';
  }

  setCsrfToken(token) {
    this.csrfToken = String(token || '');
  }

  async request(path, { method = 'GET', body, query, signal, headers = {} } = {}) {
    const url = new URL(`${this.baseUrl}${path}`, globalThis.location?.origin || 'http://localhost');
    for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    try {
      const response = await this.fetch(url, {
        method,
        credentials: 'include',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Request-ID': makeRequestId(),
          ...(this.csrfToken && !['GET', 'HEAD'].includes(method) ? { 'X-CSRF-Token': this.csrfToken } : {}),
          ...(!isFormData && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      });

      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const apiError = payload?.error || {};
        throw new ServiceError(apiError.message || 'The server could not complete this request.', {
          code: apiError.code || `HTTP_${response.status}`,
          status: response.status,
          fieldErrors: apiError.fieldErrors || {},
        });
      }
      return payload?.data ?? payload;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error?.name === 'AbortError') throw error;
      throw new ServiceError('The private-cloud service is unavailable. Check your connection and try again.', { code: 'NETWORK_ERROR', status: 503, cause: error });
    } finally {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  get(path, options) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options) {
    return this.request(path, { ...options, method: 'POST', body });
  }

  put(path, body, options) {
    return this.request(path, { ...options, method: 'PUT', body });
  }
}
