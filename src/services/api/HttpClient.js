import { ServiceError } from '../contracts.js';

const makeRequestId = () => globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class HttpClient {
  constructor({ baseUrl, timeoutMs = 15000, fetchImplementation = globalThis.fetch } = {}) {
    this.baseUrl = String(baseUrl || '/api/v1').replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.hasInjectedTransport = fetchImplementation !== globalThis.fetch;
    this.fetch = this.hasInjectedTransport
      ? fetchImplementation
      : fetchImplementation?.bind(globalThis);
    this.csrfToken = '';
  }

  setCsrfToken(token) {
    this.csrfToken = String(token || '');
  }

  async request(path, { method = 'GET', body, query, signal, headers = {} } = {}) {
    const safeToRetry = ['GET', 'HEAD'].includes(method);
    const attempts = safeToRetry ? 2 : 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await this.requestOnce(path, { method, body, query, signal, headers });
      } catch (error) {
        lastError = error;
        const retryable = error?.code === 'NETWORK_ERROR'
          || error?.name === 'AbortError'
          || [502, 503, 504].includes(error?.status);
        if (!safeToRetry || !retryable || attempt === attempts - 1 || signal?.aborted) throw error;
      }
    }
    throw lastError;
  }

  async requestOnce(path, { method = 'GET', body, query, signal, headers = {} } = {}) {
    const requestUrl = `${this.baseUrl}${path}`;
    const browserOrigin = globalThis.location?.origin;
    if (!browserOrigin && !/^https:\/\//i.test(requestUrl) && !this.hasInjectedTransport) {
      throw new ServiceError('The application API address is not configured for this environment.', {
        code: 'INVALID_API_CONFIGURATION',
        status: 500,
      });
    }
    const url = browserOrigin
      ? new URL(requestUrl, browserOrigin)
      : /^https:\/\//i.test(requestUrl)
        ? new URL(requestUrl)
        : new URL(requestUrl, 'https://injected-transport.invalid');
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

  delete(path, options) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}
