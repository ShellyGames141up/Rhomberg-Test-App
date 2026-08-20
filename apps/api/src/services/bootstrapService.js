import { randomUUID } from 'node:crypto';
import { ApiError } from '../errors.js';
import { hashPassword } from '../security/crypto.js';

const usernamePattern = /^[A-Za-z][A-Za-z0-9._-]{2,39}$/;

function validatePassword(password) {
  const value = String(password || '');
  return value.length >= 16 && value.length <= 256
    && /[a-z]/.test(value) && /[A-Z]/.test(value)
    && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export function loadBootstrapInput(env = process.env) {
  const username = String(env.RHOMBERG_API_BOOTSTRAP_USERNAME || '').trim();
  const password = String(env.RHOMBERG_API_BOOTSTRAP_PASSWORD || '');
  if (!usernamePattern.test(username)) {
    throw new ApiError('INVALID_BOOTSTRAP_CONFIGURATION', 'RHOMBERG_API_BOOTSTRAP_USERNAME must be a valid sign-in name.', 500);
  }
  if (!validatePassword(password)) {
    throw new ApiError('INVALID_BOOTSTRAP_CONFIGURATION', 'RHOMBERG_API_BOOTSTRAP_PASSWORD must be 16–256 characters and include upper-case, lower-case, numeric and symbol characters.', 500);
  }
  return Object.freeze({ username, password });
}

export function createBootstrapService({ repository, passwordHasher = hashPassword, idFactory = randomUUID }) {
  return Object.freeze({
    async initialise({ username, password }) {
      if (!usernamePattern.test(String(username || '').trim()) || !validatePassword(password)) {
        throw new ApiError('INVALID_BOOTSTRAP_CONFIGURATION', 'The initial Administrator bootstrap input is invalid.', 500);
      }
      const state = await repository.getBootstrapState();
      if (state) return Object.freeze({ status: 'already_initialised' });
      if (await repository.hasAdministrator()) {
        throw new ApiError('UNSAFE_BOOTSTRAP_REFUSED', 'An Administrator already exists but the one-time bootstrap state is incomplete. Manual database review is required.', 409);
      }
      const passwordHash = await passwordHasher(password);
      const result = await repository.initialiseAdministrator({
        userId: idFactory(),
        username: String(username).trim(),
        displayName: String(username).trim(),
        passwordHash,
        correlationId: idFactory(),
      });
      return Object.freeze({ status: result.status });
    },
  });
}
