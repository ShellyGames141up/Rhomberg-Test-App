# Initial Administrator bootstrap

## Purpose and boundary

The initial Administrator is created once, on the server, after migrations and runtime grants are complete. The process has no HTTP route and no browser-local fallback. It uses the migration/bootstrap database identity, writes the Administrator role to PostgreSQL, records an immutable audit event, and permanently records that bootstrap has completed.

The staging database begins with no users, companies, customers, RFQs, orders, certificates, documents, notifications, workflow records, or test-client records. Roles and permissions are reference data, not operational records.

## Required environment-variable names

- `RHOMBERG_API_ENV`
- `RHOMBERG_API_DATABASE_URL`
- `RHOMBERG_API_DATABASE_SSL`
- `RHOMBERG_API_SESSION_PEPPER`
- `RHOMBERG_API_ALLOWED_ORIGIN`
- `RHOMBERG_API_IDENTITY_MODE`
- `RHOMBERG_API_BOOTSTRAP_USERNAME`
- `RHOMBERG_API_BOOTSTRAP_PASSWORD`

Values must be provided privately by the authorised operator. Never place them in source control, command history, tickets, screenshots, chat, or deployment documentation.

## Controlled procedure

1. Apply all migrations with the migration/bootstrap database identity.
2. Apply the runtime grants to the separate runtime database role.
3. Supply the bootstrap username and strong password through the approved secret-injection mechanism in the operator process.
4. Run `pnpm run api:bootstrap-admin` once from the secured application host or approved administrative workstation.
5. Confirm the command reports `created`. The command never prints the username, password, password hash, user ID, or session material.
6. Remove the two bootstrap input variables from the process environment and secret-injection job.
7. Start the API with the runtime database identity and sign in through the normal server-backed login flow.
8. Create additional internal staff only through Administrator → User Management. Explicitly created fabricated test companies or clients must be visibly marked as test records and must never contain real information.

Running the command again reports `already_initialised` and creates nothing. If an active Administrator exists but the bootstrap completion record is missing, the command refuses to continue and requires manual database review. There is no recovery or reset switch in the application.

## Security properties

- Passwords are hashed with the approved scrypt implementation before database insertion.
- Plaintext passwords and hashes are never returned or logged.
- PostgreSQL serialisation and an advisory transaction lock prevent concurrent duplicate initialisation.
- The bootstrap state table is not granted to the runtime database role.
- The runtime API cannot create another Administrator through ordinary user management.
- Internal user creation requires an authenticated session, CSRF validation, `administer_users`, and the database-authoritative internal-user function.
- The Administrator enters an approved temporary employee password through the protected user-management form. It is hashed server-side and is never returned in the API response, logs or audit history.
- External identity integration remains a later, approved phase. Local-password staging authentication is not a substitute for Microsoft Entra ID or the approved customer identity service.

## Operational warning

This mechanism prepares controlled internal staging only. It does not authorise real Rhomberg or customer data, VM deployment, production use, public exposure, or production identity-provider activation.
