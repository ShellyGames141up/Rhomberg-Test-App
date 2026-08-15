# Pre-server final readiness report

Audit date: 15 August 2026

## Repository

- Branch: `main`
- Baseline commit: `b000152baa004920ea7dbd95ff77ce5ecc6142ce`
- Working tree: intentionally modified; nothing in this phase is committed or pushed.
- A binary patch and all 54 then-untracked files were backed up at `C:\Users\EricuVercuiel\Documents\Codex\backups\Rhomberg-PreServer-20260815` before cleanup.
- Removed: uncommitted `apps/api`, `infra/azure/staging`, Phase 1/2 Azure docs, Docker/runtime/IaC files and Azure/backend-only package/config changes.
- Preserved: the nine pre-existing Laboratory batch-certificate changes—`README.md`, compiled `app.js`/map, Lab workflow documentation, Laboratory component, API/mock adapters, styles and Lab test.

## Application and workflows

All existing automated suites pass after cleanup, including catalogue, authentication/realm separation, RFQ, quotation, Technical Support, representative-loaded orders, Planning, Laboratory domain/launch, Expediting, QA, Dispatch, notifications, PDFs, retention, management, administration, end-to-end demo, security, production separation, accessibility and preview routing.

Real browser smoke tests passed for Customer Desktop, Customer Mobile, Sales Representative Desktop, Executive Demo, dark mode, role/scenario switching and the inline Laboratory multi-certificate form. See `PRE_SERVER_AUDIT_MATRIX.md` for the workflow-by-workflow result.

One defect was fixed: compact preview navigation, order-tracking and search-clear actions could fall below a comfortable touch target. They now have at least 44px action dimensions; the browser retest found no undersized visible buttons/links in the inspected mobile representative view.

## UI and accessibility

- Tested width classes: 360, 390, 412, 600, 768, 1024, 1280, 1366, 1440, 1920 and 2560, plus Customer Mobile and Executive layouts.
- Result: no page horizontal overflow or detected text clipping on inspected primary screens.
- Light/dark theme and shared contrast tests pass.
- Reduced motion, focus, semantic labels/headings, responsive tables/forms, safe areas and font scaling pass existing automated contracts.
- Manual physical screen-reader, keyboard-with-native-shell, browser zoom and device orientation testing remains a UAT gate.

## Scalability and performance

Temporary generated data was not added to production assets. A repeatable test exercises 10,000 RFQs, 10,000 Planning orders, 10,000 Expediting orders and 50,000 notification authorisation checks. In the last full-suite run, the four operations completed in 22.3 ms, 40.6 ms, 108.7 ms and 29.8 ms respectively; repeated runs remained below the two-second readiness ceiling. These are not server/database benchmarks.

The production API must paginate and index every growing queue/timeline. Mock mode intentionally remains browser-local and unsuitable for large or shared operational datasets. File bytes must be streamed to private storage rather than loaded into browser persistence.

## Security

Production-safe build scanning and access-control tests pass: no real credentials/data, protected price book, demo accounts, mock services or Executive role switching enter the production candidate. Customer company and representative assignment projections, internal-note exclusion, workflow transitions, PDFs, document metadata and audit rules have tests.

This does not make GitHub Pages production-secure. Server-side authentication, RBAC/company isolation, CSRF/session enforcement, database RLS, private scanned document storage, immutable audit controls, rate limits, logging/redaction, monitoring and restore evidence are mandatory before real data.

## Server readiness

Innovate IT must provide the approved runtime/hosting, PostgreSQL, identity, private storage/scanning, DNS/TLS/networking, Microsoft 365/SMTP, secrets management, monitoring, backup/restore, deployment and support decisions listed in `INNOVATE_IT_SERVER_CONNECTION_CHECKLIST.md`.

The existing API adapter, runtime API URL, OpenAPI proposal, PostgreSQL proposal and service boundaries remain intact. No backend was introduced in this phase.

## Mobile and stores

- Capacitor is the recommended mobile wrapper, but packages/native projects are deliberately absent.
- Proposed separate products: Rhomberg Connect (customer) and Rhomberg Operations (internal).
- Google Play: current target SDK, AAB/signing, Data Safety/privacy, listing and internal/closed testing requirements are documented for re-verification at release.
- Apple: bundle/signing, current SDK/Xcode, privacy manifest/disclosures, screenshots, TestFlight and review gates are documented.
- No IDs are registered, no signing material exists and no store submission was attempted.

## Windows

Installed PWA is the recommended first path. A Store PWA or MSIX can follow if enterprise distribution or native capabilities justify it. Tauri is a later evaluation; Electron is not justified currently.

## Builds and checks

Final verification passed:

- `npm test`
- `npm run check`
- `npm run check:css`
- `npm run build:production`
- `npm run build:previews` (Customer Desktop, Customer Mobile, Internal Mobile, Internal Desktop, Executive Demo)
- focused fabricated-volume readiness test (10,000/10,000/10,000/50,000 generated records)
- manual browser responsive/dark/mobile/Executive/Laboratory smoke checks

No test or build failed in the final rerun.

## Monday recommendation

Do not restart cloud work based on assumptions. Meet Innovate IT, complete the server checklist, approve the target architecture and open a reviewed implementation branch for the smallest server vertical slice: authenticated user → company/role authorisation → RFQ create/read → private document metadata → audit/notification. Use fabricated staging data until security, restore and UAT gates pass.
