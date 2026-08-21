export const INTERNAL_STAGING_DEFAULT_API_URL = 'https://connect.rhomberg.co.za:8443/api/v1';

export function validateInternalStagingApiUrl(value) {
  const candidate = String(value || INTERNAL_STAGING_DEFAULT_API_URL).trim();
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('RHOMBERG_PUBLIC_API_URL must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Internal-staging API access must use HTTPS.');
  if (parsed.hostname !== 'connect.rhomberg.co.za') throw new Error('Internal-staging API host must be connect.rhomberg.co.za.');
  if (parsed.port !== '8443') throw new Error('Internal-staging API port must be 8443.');
  if (parsed.pathname.replace(/\/$/, '') !== '/api/v1' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('Internal-staging API URL must contain only the approved origin and /api/v1 path.');
  }
  return parsed.toString().replace(/\/$/, '');
}
