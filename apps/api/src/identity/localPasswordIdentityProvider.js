import { verifyPassword } from '../security/crypto.js';

export function createLocalPasswordIdentityProvider({ repository }) {
  return Object.freeze({
    kind: 'local_password',
    async authenticate({ identifier, email, password }) {
      const loginIdentifier = String(identifier || email || '').trim().toLowerCase();
      const user = await repository.findUserByIdentifier(loginIdentifier);
      if (!user || user.status !== 'active' || user.identity_provider === 'external') return null;
      const matches = await verifyPassword(String(password || ''), user.passwordHash || user.password_hash);
      return matches ? user : null;
    },
  });
}

export function createUnconfiguredExternalIdentityProvider() {
  return Object.freeze({
    kind: 'external_identity_not_configured',
    async authenticate() { return null; },
  });
}
