import { randomUUID } from 'node:crypto';
import { ApiError } from '../errors.js';
import { hashPassword, hashSessionToken, randomToken, sha256, verifyPassword } from '../security/crypto.js';

const safeUser = actor => ({
  id: actor.id, companyId: actor.companyId, company: actor.company, contact: actor.contact,
  username: actor.username, email: actor.email, role: actor.role, roles: actor.roles, permissions: actor.permissions,
  forcePasswordChange: Boolean(actor.forcePasswordChange),
});

export function createAuthService({ repository, identityProvider, config, now = () => new Date() }) {
  return {
    async login({ identifier, email, password, correlationId, ipAddress = '', userAgent = '' }) {
      const user = await identityProvider.authenticate({ identifier: identifier || email, password });
      if (!user) {
        await repository.appendAudit({ eventType: 'auth.login_failed', actorUserId: null, actorRole: null, companyId: null, action: 'login', entityType: 'session', entityId: null, outcome: 'failed', correlationId, details: { reason: 'invalid_credentials' } });
        throw new ApiError('INVALID_CREDENTIALS', 'The sign-in name or password is incorrect.', 401);
      }
      const token = randomToken(); const csrfToken = randomToken();
      const expiresAt = new Date(now().getTime() + config.sessionTtlSeconds * 1000).toISOString();
      await repository.createSession({ id: randomUUID(), userId: user.id, tokenHash: hashSessionToken(token, config.sessionPepper), csrfTokenHash: sha256(csrfToken), expiresAt, ipHash: ipAddress ? sha256(ipAddress) : null, userAgentHash: userAgent ? sha256(userAgent) : null });
      await repository.updateLastLogin(user.id);
      const resolved = await repository.getSessionActor(hashSessionToken(token, config.sessionPepper));
      await repository.appendAudit({ eventType: 'auth.login_succeeded', actorUserId: user.id, actorRole: resolved.actor.role, companyId: resolved.actor.companyId, action: 'login', entityType: 'session', entityId: resolved.session.id, outcome: 'success', correlationId, details: {} });
      return { token, csrfToken, expiresAt, user: safeUser(resolved.actor) };
    },
    async authenticate(token) {
      if (!token) return null;
      return repository.getSessionActor(hashSessionToken(token, config.sessionPepper));
    },
    async rotateCsrf(session) {
      const csrfToken = randomToken();
      if (session) await repository.rotateSessionCsrf(session.id, sha256(csrfToken));
      return csrfToken;
    },
    async logout({ token, actor, session, correlationId }) {
      await repository.revokeSession(hashSessionToken(token, config.sessionPepper));
      await repository.appendAudit({ eventType: 'auth.logout', actorUserId: actor.id, actorRole: actor.role, companyId: actor.companyId, action: 'logout', entityType: 'session', entityId: session.id, outcome: 'success', correlationId, details: {} });
    },
    async changeOwnPassword({ actor, currentPassword, newPassword, correlationId }) {
      const current = String(currentPassword || '');
      const replacement = String(newPassword || '');
      const authenticated = await identityProvider.authenticate({ identifier: actor.username || actor.email, password: current });
      if (!authenticated || authenticated.id !== actor.id) throw new ApiError('INVALID_CURRENT_PASSWORD', 'The current password is incorrect.', 401);
      if (replacement.length < 16 || !/[a-z]/.test(replacement) || !/[A-Z]/.test(replacement) || !/[0-9]/.test(replacement) || !/[^A-Za-z0-9]/.test(replacement)) {
        throw new ApiError('PASSWORD_WEAK', 'Use at least 16 characters including upper-case, lower-case, numeric and symbol characters.', 422, { newPassword: 'Use a stronger password.' });
      }
      if (await verifyPassword(replacement, authenticated.passwordHash || authenticated.password_hash)) {
        throw new ApiError('PASSWORD_REUSED', 'Choose a new password.', 422, { newPassword: 'Choose a different password.' });
      }
      await repository.changeOwnPassword(actor, await hashPassword(replacement), correlationId);
      return { sessionEnded: true };
    },
    safeUser,
  };
}
