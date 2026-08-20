import { randomUUID } from 'node:crypto';
import { validationError } from '../errors.js';
import { hashPassword } from '../security/crypto.js';

const usernamePattern = /^[A-Za-z][A-Za-z0-9._-]{2,39}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAdministrationService({ repository, passwordHasher = hashPassword }) {
  return Object.freeze({
    async createInternalUser(actor, input, correlationId) {
      const displayName = String(input.displayName || '').trim();
      const username = String(input.username || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      const role = String(input.role || '').trim();
      const errors = {};
      if (displayName.length < 2) errors.displayName = 'Enter the employee display name.';
      if (!usernamePattern.test(username)) errors.username = 'Use a valid sign-in name of 3–40 characters.';
      if (email && !emailPattern.test(email)) errors.email = 'Enter a valid work email address or leave it blank.';
      if (password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        errors.password = 'Use at least 16 characters including upper-case, lower-case, numeric and symbol characters.';
      }
      if (!role || ['administrator', 'customer'].includes(role)) errors.role = 'Select an approved internal employee role.';
      if (Object.keys(errors).length) throw validationError(errors);
      const passwordHash = await passwordHasher(password);
      const account = await repository.createInternalUser(actor, {
        id: randomUUID(), username, email: email || null, displayName, passwordHash, role,
        correlationId, reason: String(input.reason || '').trim(),
      });
      return { account: { ...account, contact: account.displayName } };
    },
  });
}
