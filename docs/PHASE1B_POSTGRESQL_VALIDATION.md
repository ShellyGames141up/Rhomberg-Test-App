# Phase 1B real PostgreSQL validation

Status: completed locally with fabricated data only. This is not approval for real company data.

## Tested database

- PostgreSQL 17.10, 64-bit Windows build
- loopback-only disposable cluster on the development computer
- no Windows service, cloud resource, Rhomberg VM connection or external database
- Node.js 22.23.2 and pnpm 11.19.0

PostgreSQL 17 was selected as a currently supported, conservative target for later Windows staging. Innovate IT must approve the staging version and patch policy before deployment.

## Migration result

Both migrations ran successfully from an empty database under a non-superuser database owner:

1. `001_phase1_vertical_slice.sql`
2. `002_protected_request_context.sql`

A repeat run left one ledger row per migration and created no duplicate objects. The expected foreign keys, checks, unique constraints, indexes, RFQ reference sequence, RLS policies and append-only audit trigger were present. PostgreSQL installation, database/role creation and revocation of public schema creation are bootstrap actions; the application migrations did not require superuser rights.

## Database identities and grants

Two passwordless local-only test identities were created outside source control:

- migration/bootstrap: owns the disposable database and schema; `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS`;
- runtime application: `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS`.

The repeatable grant script is `apps/api/sql/phase1-runtime-grants.sql`. It expects an already-created role supplied as a psql variable and never creates credentials. Runtime access is limited to the reads and inserts needed by the Phase 1 slice, updates to the CSRF hash/last-seen/revocation fields of sessions, update of `users.last_login_at`, RFQ sequence use and execution of protected context helpers. It cannot create, alter, truncate or drop application tables and has no UPDATE or DELETE permission on audit events.

Every later migration must update and re-test this grant script rather than grant schema ownership to the runtime identity.

## Protected company context

Migration 002 replaces caller-controlled company/privilege settings with a protected transaction context derived from an active hashed session. The context table is inaccessible to the runtime role. RLS helpers read only the context established for the current PostgreSQL backend and transaction. Fabricated tests confirmed that changing the old custom settings does not grant company access.

The application still applies explicit company and representative predicates in addition to RLS. Database credentials remain high-value secrets: possession of an application database credential must be treated as a backend compromise, not as an end-user access path.

## Real PostgreSQL test coverage

The opt-in test `apps/api/test/postgresql-real.test.js` requires these names:

- `RHOMBERG_TEST_POSTGRES_MIGRATION_URL`
- `RHOMBERG_TEST_POSTGRES_RUNTIME_URL`

It validates fabricated login, hashed sessions, expiry, logout/revocation, disabled users, CSRF, throttling, RFQ transactions, line items, documents, notifications, audit events, rollback, concurrent advisory-lock idempotency, Company A/B isolation, representative assignment scope, injection inputs, mass assignment, malformed identifiers, invalid references, DDL denial, audit immutability and structured-log redaction. It skips when the disposable URLs are absent, so normal tests and GitHub Pages previews remain database-independent.

## Windows staging connectivity requirements

Innovate IT must approve or provide:

- a supported PostgreSQL release and patch schedule (17.10 was tested locally);
- a private hostname and port (normally 5432);
- TLS with server-certificate verification;
- separately stored migration and runtime connection details;
- firewall and `pg_hba.conf` rules allowing only the API service host/identity;
- no public database exposure;
- runtime pool sizing via `RHOMBERG_API_DATABASE_POOL_MAX`;
- API binding, reverse proxy and service-account ownership;
- backup, point-in-time recovery, restore rehearsal, monitoring and alerting.

Expected application environment-variable names are documented in `.env.example`. No password or connection secret belongs in the repository.

## Remaining real-data blockers

Real Rhomberg/customer data remains prohibited until there are approved customer and internal identity providers; production session lifecycle and recovery; private scanned document storage; TLS and trusted-proxy configuration; managed secrets; backup/restore evidence; monitoring and privacy-approved log retention; complete workflow/API migration; independent security testing; approved retention/legal rules; and Innovate IT operational acceptance.
