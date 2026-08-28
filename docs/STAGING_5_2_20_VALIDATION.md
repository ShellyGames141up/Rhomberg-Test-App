# Staging 5.2.20 validation and update boundary

This release includes the pending 5.2.18 / 5.2.19 work plus the Technical referral, management navigation and fifteen-minute refresh corrections. It contains no operational test data or demo login fallback. No RHOMAPP access or deployment was performed during preparation.

## Gates

- Node.js 22.23.2; pnpm 11.19.0; frozen install.
- JavaScript and CSS checks; full frontend suite (16 Node subtests plus imported assertion suites).
- Complete backend suite with the opt-in real PostgreSQL test enabled: 96 passed, zero failures, zero skips.
- Disposable local PostgreSQL 17.10: migrations 001–023 from empty databases and repeat migrations; restricted runtime role; Technical referral/assignment/correspondence/completion; public customer registration visible to Administrator; Laboratory certificate batch and document boundaries.
- Production/internal-staging builds and artifact scans; catalogue integrity; manifest, service-worker and IIS validation; Android static packaging checks; all five previews and combined GitHub Pages build.
- Local browser checks use the actual Technical, Laboratory and management components with fabricated fixtures. Technical category, saved line and advisor selections work. Laboratory lists physical units and enables multiple certificate selections. Owner and Sales Manager display workflow/quality/unit/commercial sections and the 31-day PDF report controls in light and dark themes. This is not deployed-environment acceptance or a physical-device test.

The opt-in legacy lifecycle test was updated to use a valid historical quotation date and to supply the required Dispatch receipt and delivery evidence. Runtime validation was not relaxed. The Technical test bootstrap uses a local privileged test owner only for fixture/role setup, then switches to a NOSUPERUSER/NOBYPASSRLS runtime role for application operations. An initial attempt using a migration identity without SET ROLE membership was correctly denied and rerun with the documented bootstrap boundary.

The Temperature Laboratory Manager's legacy UI filter now includes SANAS and retains historical Traceable records. Regression coverage confirms ordinary customer, Sales, Dispatch and inactive technician roles gain no Laboratory access through this filter.

## Deployment requirements

Deploy the matching API and site, run migrations through 023, and reapply the packaged explicit runtime grants. Preserve the current private storage, protected session pepper and rollback release. Never rerun the initial Administrator bootstrap on the existing database. Stop on any failed migration or grant preflight.

After cutover, save open work and reload each client once. The 15-minute polling is data refresh only, not software installation. A visible, online, idle Administration view sees newly registered customers on its next successful refresh. Unsaved forms, offline/hidden tabs and errors can defer refresh. Manual refresh remains available.

Retest a real staging RFQ referral, customer reply, Laboratory selection, both management roles and a fabricated new registration before accepting the deployed update. Existing database accounts and records are preserved; no credentials are included in the package.

## Limits

No real-data or production approval. Malware scanning / approved document release remains an external requirement. Management aggregates and Technical per-request detail queries need load testing before larger deployments. Android APK/AAB and Windows display scaling were not rebuilt/retested for this browser/API-only correction. Historical reports are retained, not deleted after 31 days.
