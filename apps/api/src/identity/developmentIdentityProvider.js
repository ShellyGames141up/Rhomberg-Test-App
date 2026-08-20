import { verifyPassword } from '../security/crypto.js';

export function createDevelopmentIdentityProvider({ repository }) {
  return Object.freeze({
    kind: 'fabricated_development_password',
    async authenticate({ email, password }) {
      const user = await repository.findUserByEmail(String(email || '').trim().toLowerCase());
      if (!user || user.status !== 'active') return null;
      const matches = await verifyPassword(String(password || ''), user.passwordHash || user.password_hash);
      return matches ? user : null;
    },
  });
}

export function createUnconfiguredProductionIdentityProvider() {
  return Object.freeze({
    kind: 'unconfigured_production_identity',
    async authenticate() { return null; },
  });
}
