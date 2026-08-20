import path from 'node:path';
import { ApiError } from './errors.js';

const booleanValue = (value, fallback = false) => value === undefined ? fallback : String(value).toLowerCase() === 'true';
const integerValue = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

export function loadConfig(env = process.env) {
  const environment = env.RHOMBERG_API_ENV || 'development';
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
    allowedOrigin: env.RHOMBERG_API_ALLOWED_ORIGIN || '',
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
  if (['staging', 'production'].includes(config.environment) && (!config.allowedOrigin.startsWith('https://'))) {
    throw new ApiError('INVALID_CONFIGURATION', 'An approved HTTPS RHOMBERG_API_ALLOWED_ORIGIN is required outside local development.', 500);
  }
  return Object.freeze(config);
}
