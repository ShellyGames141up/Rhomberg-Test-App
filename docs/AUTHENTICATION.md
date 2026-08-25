# Authentication and credential-change design

## Phase 1 server implementation

The local `apps/api` slice uses a replaceable identity boundary. Fabricated development-password identities are verified server-side with salted, memory-hard `scrypt` hashes. The implementation issues a cryptographically random opaque session token in an `HttpOnly`, `SameSite=Lax` cookie; only a peppered SHA-256 token hash is persisted. Session expiry, revocation, disabled-user checks, login throttling, session fixation resistance and CSRF tokens are enforced by the API.

This development identity provider is blocked by configuration in staging and production. Microsoft Entra ID for internal users and the approved external customer identity platform still require IT and security approval. No browser permission or client-supplied company/role value is an authorisation source.

## Normal Desktop and Mobile entry points

The normal routes are `/desktop/` and `/mobile/`. Both show the shared startup animation before Sign In, contain no Preview Centre navigation and use the same authentication service. Public GitHub Pages deliberately rejects fabricated `.invalid` and `.test` Preview Centre identities on these normal routes and disables public browser-local registration. Approved private accounts require the production backend or identity provider described in [Private User Administration](PRIVATE_USER_ADMINISTRATION.md).

Device access is enforced by the authoritative `APPLICATION_ACCESS_MATRIX` before a workspace is loaded. Changing a URL cannot grant a desktop-only role access to Mobile. The API must repeat and own this decision in production.

Internal identities support one or more role assignments and one active workspace. Work email is preferred; an approved username is supported when no email exists. The employee profile remains independent of the authentication method so Microsoft Entra ID, Active Directory or another approved provider can replace local authentication without losing historical ownership.

New local accounts receive a one-time temporary password that is hashed before storage, displayed only through the authorised administrative handover, and never audited. The authoritative `must_change_password` database flag is included in the server session actor. First login opens only Security settings; operational API requests return `PASSWORD_CHANGE_REQUIRED` until the user verifies the current temporary password and replaces it. A successful replacement clears the flag, records safe audit metadata, revokes every existing session and requires a fresh login. Production must additionally use MFA, IT-approved breached-password checks, reset expiry and incident-recovery controls.

The implemented endpoint is `POST /api/v1/auth/change-password`. It requires an authenticated secure-cookie session, a valid CSRF token, the current password and a new 16–256 character password containing upper-case, lower-case, numeric and symbol characters. Password request fields are explicitly redacted from structured logs. The runtime database role cannot update `app.users` directly; migration `013_first_login_password_change.sql` exposes only the authenticated-account-scoped `app.change_own_password(text,text)` security-definer function, which can update only the current active local account.

The preview uses fabricated browser-only accounts and is not production authentication.

All normal Customer Mobile, Customer Desktop, Representative/Expeditor Mobile and Internal Desktop entries follow the same order: Rhomberg Connect splash, then sign-in. They never redirect through Preview Centre. The application route accepts the appropriate authorised customer or internal identity and derives the first workspace from the server-verified role.

## Separate realms

Customer and internal staff authentication are distinct realms with different login screens, route sets and role populations. A valid account from one realm cannot sign in through the other. Shared implementation is acceptable only when the session retains a server-verified realm and every route enforces it.

## Credential change

1. An authenticated user requests a username or password change.
2. The server rate-limits the request and creates a hashed, six-digit, short-lived one-time challenge.
3. Delivery is sent only to the already verified account email.
4. Attempts decrement on failure. Expired, consumed or invalidated codes cannot be reused.
5. A valid code applies the change in one transaction, audits it, invalidates the challenge and revokes sessions after a password change.
6. A confirmation notification is queued without echoing the new credential.

Mock mode simulates delivery and may show a clearly labelled development code. Production builds must exclude demo accounts and development codes. Passwords require an approved modern hash, strength controls, breach screening, reset safeguards, suspicious-activity monitoring and secure cookies. Logs must never contain credentials or verification codes.

Temporary-password generation fails closed if a cryptographically secure random source is unavailable. It must never fall back to `Math.random`. High-risk identity, permission and suspension changes require confirmation, reason evidence and immutable audit events.

## Executive Demo role switching

The `/demo/executive-workflow/` role switcher is deliberately restricted to the fabricated GitHub Pages demonstration. It changes only the mock service session so executives can inspect the same scenario from different authorised perspectives. It is not impersonation, delegated administration or a production authentication feature. The production build aliases this module to an inert implementation and scans the output to ensure demo accounts, passwords and scenario markers are absent.
