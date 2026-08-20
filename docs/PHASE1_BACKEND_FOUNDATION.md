# Phase 1 backend foundation

Status: local implementation only. No VM, Azure resource, staging service or production system is connected.

## Proven vertical slice

The isolated Fastify application in `apps/api` proves this path with fabricated records only:

```text
authenticated user
  -> opaque server session
  -> database-derived company/role/permissions
  -> create and retrieve authorised RFQs
  -> record private document metadata
  -> append immutable audit evidence
  -> persist an assigned-representative in-app notification
```

The React service adapter already targets these `/api/v1` routes. GitHub Pages continues to select `createMockServices`; the Windows production bundle continues to compile only the API adapter. No other workflow has been migrated from the mock service.

## Architecture

- HTTP: Fastify 5, cookie, multipart and rate-limit plugins.
- Domain orchestration: authentication and enquiry services validate commands and invoke repositories.
- Authorisation: permissions and company scope come from server/database state. Ownership, roles, statuses and priority values supplied by customers are rejected.
- Persistence: pooled `pg` connections, parameterised queries, transactions and forward-only SQL migrations.
- Identity: replaceable fabricated development-password provider using salted `scrypt`; prohibited in staging/production.
- Sessions: random opaque token, peppered token hash at rest, `HttpOnly` cookie, configurable `Secure`, `SameSite=Lax`, expiry and revocation.
- Documents: private storage interface. Local development writes random, non-public keys outside the public app. Responses expose metadata but never storage paths or public URLs.
- Audit: append-only table protected by a mutation-rejecting database trigger.
- Notifications: transactionally persisted in-app recipient record only; no email or push.
- Logging: structured Fastify logs with credential, cookie, token, CSRF and database configuration redaction.

## Local development

Requirements: Node.js 22.23.2, pnpm 11.19.0 and a local PostgreSQL instance supported by the company/IT team.

Copy `.env.example` to an untracked `.env` and provide local values through the shell or an approved secrets mechanism. Never commit the file. Then run:

```text
pnpm install --frozen-lockfile
pnpm run api:migrate
pnpm --filter @rhomberg/connect-api seed:fabricated
pnpm run api:start
```

Fabricated seeding requires `RHOMBERG_API_ENV=development`, `RHOMBERG_API_DEV_IDENTITY_ENABLED=true`, and a runtime-only `RHOMBERG_API_DEV_SEED_PASSWORD`. The script prints fabricated IDs and `.example.invalid` identities but never prints or stores the supplied password in source.

## Implemented endpoints

- `GET /health/live`
- `GET /health/ready`
- `GET /health/version`
- `GET /api/v1/auth/csrf-token`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/enquiries`
- `POST /api/v1/enquiries`
- `GET /api/v1/enquiries/{id}`
- `GET /api/v1/documents/{id}` (metadata only; no download route)

All other OpenAPI routes remain proposed and unavailable.

## Environment-variable names

- `RHOMBERG_API_ENV`
- `RHOMBERG_API_HOST`
- `RHOMBERG_API_PORT`
- `RHOMBERG_API_LOG_LEVEL`
- `RHOMBERG_API_TRUST_PROXY`
- `RHOMBERG_API_COOKIE_SECURE`
- `RHOMBERG_API_COOKIE_NAME`
- `RHOMBERG_API_SESSION_TTL_SECONDS`
- `RHOMBERG_API_SESSION_PEPPER`
- `RHOMBERG_API_DATABASE_URL`
- `RHOMBERG_API_DATABASE_SSL`
- `RHOMBERG_API_DATABASE_POOL_MAX`
- `RHOMBERG_API_STORAGE_ADAPTER`
- `RHOMBERG_API_LOCAL_STORAGE_ROOT`
- `RHOMBERG_API_MAX_UPLOAD_BYTES`
- `RHOMBERG_API_DEV_IDENTITY_ENABLED`
- `RHOMBERG_API_DEV_SEED_PASSWORD`
- `RHOMBERG_API_ALLOWED_ORIGIN`
- `RHOMBERG_API_SHUTDOWN_TIMEOUT_MS`

## Windows Server staging expectations

- Bind the API to `127.0.0.1` or a private interface; IIS is the only public entry point.
- IIS must terminate approved HTTPS and reverse-proxy `/api/*` to the private API port. The current static `web.config` intentionally does not claim that this proxy exists.
- Set `RHOMBERG_API_COOKIE_SECURE=true` and use a secret-store-provided session pepper.
- Run migrations through a separately controlled migration database identity. The runtime identity receives only required DML/function privileges and must not own the schema.
- Use separate Windows service credentials and a future approved service wrapper. None is installed in this phase.
- Direct structured logs to an IT-approved protected location/collector; do not log document contents or sensitive personal data.
- Health probes: `/health/live` for process liveness and `/health/ready` for database readiness.
- Start command: `pnpm --filter @rhomberg/connect-api start`.
- Migration command: `pnpm --filter @rhomberg/connect-api migrate`.
- The server handles `SIGINT`/`SIGTERM` with bounded graceful shutdown.

The PostgreSQL deployment uses two identities. The migration identity owns or is authorised to evolve the `app` schema and migration ledger. The runtime identity does not own schema objects and receives only the table, sequence and function privileges needed by the API. Innovate IT must approve the exact role names and grants; no database users or passwords are created by this repository.

## Threat model and controls

| Risk | Phase 1 control | Remaining production requirement |
|---|---|---|
| Broken access control / IDOR | Server-derived actor; company predicates; RLS; 404 for foreign objects; negative tests | Independent penetration test and complete endpoint review |
| SQL injection | Parameterised queries; no client-generated SQL | Database query monitoring and least-privilege runtime grants |
| Session theft/fixation | Random opaque tokens, token hash at rest, HttpOnly/SameSite cookie, new token at login | Entra/external identity, HTTPS, incident revocation and session administration |
| CSRF | Per-session random token hash and required header on cookie-authenticated mutations; origin check | Approved staging origins and reverse-proxy header validation |
| Brute force | Rate-limited login and generic errors | Distributed rate limiting/lockout/identity-provider policies |
| Mass assignment / privilege escalation | Explicit command projection; forbidden ownership, role, priority and status keys | Apply the same pattern to every future route |
| Unsafe files | Allowlisted type/extension, strict size/empty checks, random private key, no download route | Backend signature validation, malware scanning, quarantine and Blob integration |
| Log/secret leakage | Structured redaction; safe error envelopes; no stack traces outside development/test | Central logging policy, retention controls and operational review |
| Company isolation | Company memberships resolved server-side; RLS and repository checks; cross-company tests | Production RLS role/grant verification and tenant-isolation test suite |
| Replay abuse | Actor/operation/idempotency-key unique record plus request hash | Retention policy and concurrency/load testing against production PostgreSQL |

## Known limitations

- The slice has not been deployed and has not been exercised against the Rhomberg VM.
- The test suite uses an in-memory repository and PGlite for deterministic security/migration coverage; staging must repeat migration and concurrency tests on the approved PostgreSQL version.
- Development password login is not the production identity solution.
- Local storage is not Azure Blob Storage or approved Windows private storage.
- No malware scanner, document download, email, push, registration, catalogue API, drafts or later workflow endpoints exist yet.
- PostgreSQL migration/runtime identities and grants require Innovate IT approval and provisioning.
