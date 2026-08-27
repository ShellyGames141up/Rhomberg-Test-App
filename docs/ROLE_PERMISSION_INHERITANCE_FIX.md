# Administrator role and permission correction

## Confirmed causes

- Migration 008 attempted role upserts on `(user_id, role_code)` although the
  primary key includes `assigned_at`. PostgreSQL cannot use that conflict target.
- Administration Overview returned empty permission arrays, so the editor did
  not show inherited permissions.
- Session loading and the protected database request context disagreed about
  individual grants; the grant table also hid an employee's own overrides.
- Dialog failures were displayed behind the open confirmation panel.
- Quality Manager had no database defaults despite its approved QA permission
  definition. Migration 018 fills that mapping. Buyer receives only its existing
  prepared access/catalogue/self-credential defaults, not an operational workflow.

## Effective access

`effective = union(active assigned-role defaults, explicit additional grants)
minus explicit restrictions`.

Defaults come from the authoritative database role/permission tables, not the
React interface. Planning plus Dispatch receives both sets automatically.
Removing Planning retains shared permissions and Dispatch permissions; it removes
Planning-only defaults. Existing explicit exceptions remain in effect and are
shown separately. Rechecking a restricted permission restores it. **Reset to
assigned role defaults** removes individual additions and restrictions when saved.
New employee primary/additional roles use the same inheritance immediately, while
the mandatory first-login password-change boundary remains enforced.

The active session is re-authorised from the database on each API request.
Users should refresh their interface after an Administrator changes access, or
sign out/in to refresh navigation. No login reset is necessary. Selecting an
unassigned workspace remains forbidden.

Adding Sales Representative creates/reactivates its representative profile without
resetting credentials. Removing Sales deactivates that profile while retaining its
identifier and historical records. Review dedicated-customer assignments before
removing Sales responsibility; customers must be reassigned to an active representative.

## Security and history

- Administrator session, valid CSRF token, reason (at least eight characters),
  and current Administrator password confirmation are required for these edits.
  Password confirmation is bounded and rate-limited; it is neither persisted nor
  included in audit details.
- Self role/permission changes, protected Administrator accounts, customer
  conversion to internal roles and Administrator role grants are rejected.
- Individual grants are restricted to permissions defined for active, non-admin
  internal roles. They cannot manufacture an Administrator account.
- Removed assignments are revoked, not deleted. Before/after roles and explicit
  exceptions are included in the append-only audit record in the same transaction.
- Runtime SQL has no write privileges to role assignments or permission exceptions.
  It can read only its own exceptions or those authorised for administration.
- Company membership, assignment restrictions, RLS, workflow transitions and
  document controls are not bypassed by the UI.

## Migration / deployment boundary

Apply **018_role_permission_inheritance.sql** using the normal migration runner
and migration identity. Then run the updated **phase1-runtime-grants.sql** with
the runtime role parameter. The script checks that migration 018's table exists
before revoking privileges; old grants must not be used for the new backend.

Migration 018 adds an active-assignment unique index and the RLS-protected
`user_permission_denials` table; it replaces the administration and protected
request-context functions without rewriting historical migrations. Duplicate
active assignments are revoked while retaining history. Any pre-existing
protected/customer individual grants are revoked and individually audited rather
than becoming newly effective after the context fix. No users or operational
records are seeded.

This is a **local source change**, not an RHOMAPP deployment. Use a reviewed,
exact-commit release and the established side-by-side procedure after approval.
Do not hand-edit the deployed database functions.

## Regression coverage

- SQL-backed API tests exercise add/remove/re-add/repeated role changes,
  shared defaults, individual grants/restrictions/restoration, new multi-role
  employee creation, current-session authority and permission directory projection.
- Negative cases cover customers, self-editing, Administrator escalation,
  unknown values, incorrect password confirmation, missing CSRF, direct runtime
  writes and audit immutability. Secret sentinels are checked in captured logs.
- The same suite can run on an **empty disposable loopback-only** real PostgreSQL
  database via `RHOMBERG_TEST_ROLE_DATABASE_URL`; it refuses non-local hosts and
  database names outside `rhomberg_role_test_*`. It creates only fabricated users.
  Never point test suites at staging.
- Public mock tests verify equivalent inheritance and exceptions; the UI contract
  requires service-provided permission options and visible dialog errors.

Local validation used Node 22.23.2, pnpm 11.19.0 and PostgreSQL 17.10. No RHOMAPP
connection, production data, deployment, commit or push is part of this correction.

### Validation results (27 August 2026)

- Frozen pnpm install, JavaScript checks, CSS checks and complete frontend suite: passed.
- Complete backend suite with the existing real-PostgreSQL integration enabled:
  **75 passed, zero failures, zero skipped**. This includes authentication/CORS,
  bootstrap, company isolation, runtime grants, RFQ submission and downstream workflows.
- New role/permission suite additionally ran on a separate fresh real PostgreSQL
  17.10 database: passed, including malformed-input rejection and secret checks.
  All 18 migrations applied and repeated successfully. Only fabricated identities
  were used on loopback; the deployed staging database was not contacted.
- Public build, production build, internal-staging build, five standalone previews
  and combined GitHub Pages build: passed.
- Production/internal-staging artifact security scans, Android project checks,
  catalogue/document integrity and Windows packaging tests: passed.
- `git diff --check`: passed. Changes remain uncommitted.

### Changed file groups / remaining acceptance

- Database: migration 018 and the runtime-grant preflight/SELECT grant.
- API: authoritative permission calculation, administration directory, validated
  password-confirmed mutations, rate limits, safe errors and log redaction.
- Interface/mock: role-default explanation, effective permission editor/reset,
  visible dialog errors, equivalent fabricated-preview inheritance and regenerated
  public `app.js`/`app.js.map` (source map excluded from staging).
- Tests and documentation: regression suites and README/API/schema/permission notes.

Actual RHOMAPP browser acceptance remains required after the reviewed release is
deployed: assign Planning plus Dispatch, refresh the target account, verify both
workspaces, remove Planning and verify access is revoked, then test an individual
restriction and reset to role defaults. Retain at least one valid internal role.
Protected Administrator/customer boundaries are intentional, not editable here.
No APK, AAB, deployment ZIP or staging cutover was created by this work.
