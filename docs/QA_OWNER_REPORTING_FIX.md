# QA controls and Company Owner reporting correction

5.2.18 staging correction based on 5.2.17 (`4a9ad2d2f4623c55fc79ed452023ad1ac0b0fc02`).
Approved for a local exact-commit release package. The package manifest records the
new source commit. RHOMAPP deployment and a GitHub push have not been performed.
All verification data is fabricated and confined to local test instances.

## Causes and corrections

1. API QA options were strings with different IDs; dropdowns required `{id,label}`.
   API and demo validation now share the existing 13 categories, 3 severities and
   10 rework destinations. Affected items still come from the selected order.
2. Dedicated QA endpoints used obsolete `awaiting_quality_assurance` and omitted
   rework/reinspection/pass states. They now use `awaiting_qa`, `qa_in_progress`,
   `qa_failed`, `returned_to_expediting`, `qa_reinspection_required`, `qa_passed`.
3. Persisted `qualityUpdates` did not populate the inspection history contract.
   A read projection now preserves failed/passed attempts and rework counts without
   overwriting stored history. Customers receive safe messages, never internal QA notes.
4. Owner `view_all_orders` did not allow company rows required by RLS-protected joins.
   Migration 020 adds the intended existing read permissions, not an RLS bypass.
5. Detailed report fields were placeholders. They now calculate from authorised
   persisted orders/items, workflow timestamps and QA/certificate information.
   Reports no longer silently stop at 100 RFQs/200 orders. Item/event reads are batched
   rather than issuing two additional queries per order.

## Statistics definitions

- Totals cover authorised non-deleted RFQs/orders, including archived orders.
- Unit counts sum quantities, not line counts, grouped by product/category/month/year/
  representative/company. The approved catalogue supplies a missing category when
  available; otherwise it remains unspecified.
- QA pass rate uses all inspection attempts; first-time pass rate uses attempt 1.
  Failures and rework cycles remain distinct measures.
- Certificates use current persisted IDs; pending counts include required certified
  units even before Laboratory first opens the order.
- Durations use valid recorded start/end pairs, not estimates. Missing evidence keeps
  the existing zero-hour UI convention; zero is not proof work was instantaneous.
  The simplified Laboratory flow may not record every timing milestone.
- Search/branch/status filters narrow record/ageing lists; headline totals retain
  existing all-authorised-records behaviour. No pricing/revenue is inferred.
- Recent activity comes from scoped audit events, not disguised order records.

## Security

Owner company-wide access remains read-only operational reporting. No Administrator,
workflow-override or QA mutation permission is added. Explicit user restrictions remain
authoritative. Customers cannot obtain management reports or another company's order.
QA failures validate canonical selections and an affected item from the same order.
Existing state/CSRF/cookie/origin/document/audit protections remain in place. Reports
use a positive safe-field projection instead of raw JSON. Production/internal-staging
remain API-only; public demos remain compile-time separated.

## Validation

Node 22.23.2 / pnpm 11.19.0; real disposable local PostgreSQL 17.10 (Windows 64-bit).
No VM/database credentials or real records are used.

- `quality-owner-reporting.test.js`: all option combinations and clone safety;
  calculated QA/units/certificate/timing values; safe report fields.
- `quality-owner-database.test.js`: migrations 001–020 twice, restricted runtime
  role/RLS; QA/QA Manager options/queues; failure, corrective work, reinspection,
  pass and Dispatch release; persisted two-attempt history; safe notifications;
  company isolation; Owner sees all 207 fabricated orders across two companies;
  no Administrator/override escalation; SQL role mutation denied; redacted logs.
  Passed on PGlite and real local PostgreSQL. PostgreSQL mode requires a fresh empty
  `rhomberg_qa_test_*` database on loopback via `RHOMBERG_TEST_QA_DATABASE_URL`.
- `quality-options-ui.test.mjs`: real React QA and QA Manager components render
  each API option label/value and actual affected order item, not empty options.
- Local browser component validation: all four selections, QA/Owner light and dark
  themes, calculated Owner totals, no browser warnings/errors. Not authenticated VM UAT.
- Complete backend suite including the existing real-PostgreSQL security/concurrency
  regression: 81 passed, zero failed/skipped.
- Frozen install, JavaScript/import checks, CSS check and complete frontend suite
  passed, including staging identity, Windows packaging, catalogue/document integrity
  and preview separation. Production/internal-staging builds and their security
  scanners passed: 85 files, 78 approved assets, 15 service-worker targets.
  All five standalone previews, combined GitHub Pages build and Android project
  security/static checks passed. Native APK/AAB compilation is unchanged and was not
  repeated for this API/reference-data correction.

## File summary (21 paths)

- API: `apps/api/src/app.js`, `repositories/postgresRepository.js`,
  `services/phase1WorkspaceService.js`, `services/workflowService.js`;
  new domain modules `qualityOptions.js`, `qualityProjection.js`,
  `operationalStatistics.js` under `apps/api/src/domain/`.
- Database: new `apps/api/migrations/020_owner_reporting_scope.sql`.
- Frontend: `src/domain/qualityAssurance.js`; regenerated public-demo `app.js`
  and `app.js.map` (source map remains excluded from staging).
- Tests: `apps/api/test/migration.test.js`, new
  `apps/api/test/quality-owner-reporting.test.js`,
  `apps/api/test/quality-owner-database.test.js`,
  `tests/quality-options-ui.test.mjs`, and `tests/run-tests.mjs`.
- Documentation: `README.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_SCHEMA.md`,
  `docs/ROLE_PERMISSION_MATRIX.md`, and this report.

## Next controlled update

The 30-second polling interval refreshes authorised operational records; it does not
install releases, run migrations or replace a bundled frontend. Deploy this matching
API/frontend and migration first. Save work and reload/reopen the web/PWA client once
after cutover, then verify the new service-worker identity. Polling can pause for a
hidden/offline tab, protect in-progress form edits, or back off after a network error;
it is not a guaranteed 30-second software-update mechanism.

After review, use the normal exact-commit release process and preserve the current
5.2.17 rollback release/data. Matching API/frontend and migration 020 are required:
frontend-only copying cannot repair Owner database access. Run migrations with the
migration identity, then the approved runtime-grant preflight and startup checks.
No new secret or runtime privilege is required. After cutover, verify:

1. QA/QA Manager can select category, severity, destination and actual affected item.
2. A fabricated QA failure survives refresh/re-login with correct audit/notification.
3. Rework/reinspection/pass reaches Dispatch and retains both inspection attempts.
4. Owner totals match known test-company records; customers/department users remain
   blocked from Owner reporting and gain no extra mutation rights.

## Remaining limits

RHOMAPP acceptance has not run for this correction. Larger-scale reporting should use
scoped SQL aggregates and paged report lists: silent truncation is fixed but statistics
still compute in API memory. Normal workspace page limits are unchanged. Missing legacy
timing/QA evidence is not fabricated. Commercial reporting remains disabled. This is
not production or real-customer approval.
