# Password security

Rhomberg Connect's public mock mode contains fabricated credentials only. Real passwords, password hashes, recovery codes and temporary credentials must never be placed in GitHub, source code, README files, JSON fixtures, seed scripts, tests, screenshots or support messages.

## Pre-production behaviour

- An authorised Administrator may create or reset an internal account and generate a cryptographically random temporary password.
- The temporary password is returned once for controlled handover. It is not stored in directory responses or audit metadata.
- The account remains `pending_activation` and must change its password on first login.
- Password changes end the current session. Reset and activation actions create immutable audit events without recording the secret.
- High-risk Administrator actions require step-up verification and a reason.

The browser implementation exists only to demonstrate the workflow. Production credential generation, hashing, comparison, expiry, lockout, session revocation and recovery must run in the authenticated backend or approved identity provider. The production service should use Microsoft Entra ID where approved, or a current memory-hard password hashing scheme such as Argon2id with centrally managed parameters. All traffic must use TLS, secrets must be filtered from logs, and temporary credentials must have a short expiry and attempt limit.

## Public demo boundary

Demo accounts use reserved `.invalid` or `.test` addresses and fabricated passwords. Production builds reject demo logins, mock authentication data, real Rhomberg staff addresses and credential-bearing configuration. The ignored private staff roster may contain approved account identifiers, but it must never contain passwords or other credentials.

Before production release, Rhomberg and IT must approve the identity provider, password policy, multi-factor authentication, account recovery, credential handover, audit retention, monitoring and incident-response procedures.
