import path from 'node:path';
import { ApiError } from './errors.js';

const booleanValue = (value, fallback = false) => value === undefined ? fallback : String(value).toLowerCase() === 'true';
const integerValue = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const stagingOrigins = new Set([
  'https://connect.rhomberg.co.za',
  'https://connect.rhomberg.co.za:8443',
]);

export function parseApprovedOrigins(value, environment) {
  const entries = String(value || '').split(',').map(entry => entry.trim());
  if (!entries.some(Boolean)) return Object.freeze([]);
  if (entries.some(entry => !entry)) throw new ApiError('INVALID_CONFIGURATION', 'Approved origins must not contain empty entries.', 500);
  const origins = entries.map(entry => {
    if (entry.includes('*')) throw new ApiError('INVALID_CONFIGURATION', 'Wildcard origins are not permitted.', 500);
    let parsed;
    try { parsed = new URL(entry); } catch { throw new ApiError('INVALID_CONFIGURATION', 'An approved origin is malformed.', 500); }
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new ApiError('INVALID_CONFIGURATION', 'Approved origins must be origins only and cannot contain credentials, paths, queries or fragments.', 500);
    }
    if (['staging', 'production'].includes(environment)) {
      if (parsed.protocol !== 'https:' || !stagingOrigins.has(parsed.origin)) {
        throw new ApiError('INVALID_CONFIGURATION', 'Only reviewed Rhomberg HTTPS application origins are permitted outside local development.', 500);
      }
    } else if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ApiError('INVALID_CONFIGURATION', 'Approved origins must use HTTP or HTTPS.', 500);
    }
    return parsed.origin;
  });
  if (new Set(origins).size !== origins.length) throw new ApiError('INVALID_CONFIGURATION', 'Approved origins must be unique.', 500);
  return Object.freeze(origins);
}

export function loadConfig(env = process.env) {
  const environment = env.RHOMBERG_API_ENV || 'development';
  if (env.RHOMBERG_API_ALLOWED_ORIGINS && env.RHOMBERG_API_ALLOWED_ORIGIN) {
    throw new ApiError('INVALID_CONFIGURATION', 'Use RHOMBERG_API_ALLOWED_ORIGINS only; do not configure both origin variables.', 500);
  }
  const allowedOrigins = parseApprovedOrigins(env.RHOMBERG_API_ALLOWED_ORIGINS ?? env.RHOMBERG_API_ALLOWED_ORIGIN, environment);
  const config = {
    environment,
    host: env.RHOMBERG_API_HOST || '127.0.0.1',
    port: integerValue(env.RHOMBERG_API_PORT, 3001),
    logLevel: env.RHOMBERG_API_LOG_LEVEL || 'info',
    trustProxy: booleanValue(env.RHOMBERG_API_TRUST_PROXY),
    cookieSecure: booleanValue(env.RHOMBERG_API_COOKIE_SECURE, environment === 'staging' || environment === 'production'),
    cookieName: env.RHOMBERG_API_COOKIE_NAME || 'rhomberg_session',
    sessionTtlSeconds: integerValue(env.RHOMBERG_API_SESSION_TTL_SECONDS, 8 * 60 * 60),
    sessionPepper: env.RHOMBERG_API_SESSION_PEPPER || '',
    databaseUrl: env.RHOMBERG_API_DATABASE_URL || '',
    databaseSsl: booleanValue(env.RHOMBERG_API_DATABASE_SSL),
    databasePoolMax: integerValue(env.RHOMBERG_API_DATABASE_POOL_MAX, 10),
    storageAdapter: env.RHOMBERG_API_STORAGE_ADAPTER || 'local',
    localStorageRoot: path.resolve(env.RHOMBERG_API_LOCAL_STORAGE_ROOT || './private/api-documents'),
    maxUploadBytes: integerValue(env.RHOMBERG_API_MAX_UPLOAD_BYTES, 4 * 1024 * 1024),
    identityMode: env.RHOMBERG_API_IDENTITY_MODE || 'external',
    allowedOrigins,
    shutdownTimeoutMs: integerValue(env.RHOMBERG_API_SHUTDOWN_TIMEOUT_MS, 10000),
  };

  if (!['development', 'test', 'staging', 'production'].includes(config.environment)) {
    throw new ApiError('INVALID_CONFIGURATION', 'RHOMBERG_API_ENV must be development, test, staging or production.', 500);
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new ApiError('INVALID_CONFIGURATION', 'RHOMBERG_API_PORT is invalid.', 500);
  }
  if (config.environment !== 'test' && config.sessionPepper.length < 32) {
    throw new ApiError('INVALID_CONFIGURATION', 'RHOMBERG_API_SESSION_PEPPER must be supplied securely and contain at least 32 characters.', 500);
  }
  if (config.environment !== 'test' && !config.databaseUrl) {
    throw new ApiError('INVALID_CONFIGURATION', 'RHOMBERG_API_DATABASE_URL is required.', 500);
  }
  if (['staging', 'production'].includes(config.environment) && !config.cookieSecure) {
    throw new ApiError('INVALID_CONFIGURATION', 'Secure session cookies are required outside local development.', 500);
  }
  if (!['local_password', 'external'].includes(config.identityMode)) {
    throw new ApiError('INVALID_CONFIGURATION', 'RHOMBERG_API_IDENTITY_MODE must be local_password or external.', 500);
  }
  if (config.storageAdapter !== 'local') {
    throw new ApiError('INVALID_CONFIGURATION', 'Only the local private-storage adapter is available in Phase 1.', 500);
  }
  if (['staging', 'production'].includes(config.environment) && config.allowedOrigins.length === 0) {
    throw new ApiError('INVALID_CONFIGURATION', 'RHOMBERG_API_ALLOWED_ORIGINS must contain at least one approved HTTPS origin outside local development.', 500);
  }
  return Object.freeze(config);
}
