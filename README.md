# Rhomberg Connect - IT Handover Repository

## Phase 1 production API foundation

`apps/api` now contains the first local, server-backed `/api/v1` vertical slice for Rhomberg Connect 5.2.0. It proves server-side local-password authentication, opaque server sessions, database-derived company/role permissions, customer RFQ creation and retrieval, private document metadata, append-only audit evidence and persisted in-app notification creation. The API is intentionally local-only at this phase: it is not deployed, does not connect to company infrastructure and must not contain real data.

The existing GitHub Pages and Executive Demo previews remain independent and mock-based. Production frontend builds remain API-only and continue to exclude demonstration accounts, passwords, Preview Centre/Executive Demo controls, mock services and browser-local operational persistence. A fresh staging database contains no operational records. The initial Administrator is created once through a server-only, database-authoritative bootstrap; additional staff must be created through authenticated Administrator user management. Start with [Phase 1 backend foundation](docs/PHASE1_BACKEND_FOUNDATION.md) and [Initial Administrator bootstrap](docs/INITIAL_ADMINISTRATOR_BOOTSTRAP.md). The API requires Node.js 22 and pnpm 11.19.0.

## Secure employee account management

The Administrator desktop now includes a reusable Internal User Directory with branch, department, role and status filters; employee creation; multi-role workspace assignments; effective-dated branch transfers; username-only Laboratory logins; one-time temporary credentials; forced first-login password changes; login and immutable audit history; profile-image validation; account disabling; and safe employee archiving. Real staff identities remain in an ignored private configuration file and never appear in GitHub Pages demo logins or the public bundle.

Functional application and workflow implementation is complete in mock mode. Production infrastructure and backend integration remain subject to IT review and staging deployment.

The Windows Server staging packaging correction now pins Node.js 22 LTS and pnpm 11.19.0, standardises the staging baseline on version 5.2.0, produces a clean API-only static frontend, uses an explicit asset allowlist, validates the root PWA manifest and service-worker precache, supplies a defensive IIS configuration, and generates release manifests and SHA-256 checksums without creating a deployment ZIP. The five listed catalogue PDFs are approved for this staging static frontend. Preview/demo identities and browser-local operational services remain confined to the separate GitHub Pages builds. See [Windows staging deployment](docs/WINDOWS_SERVER_STAGING_DEPLOYMENT.md), [build and deployment](docs/BUILD_AND_DEPLOYMENT.md), and the [production asset allowlist](docs/PRODUCTION_ASSET_ALLOWLIST.md).

The final pre-server audit removed the uncommitted temporary Azure/backend experiment while preserving the approved Laboratory batch-certificate work. Source checks, the full mock workflow/security suite, production/demo separation, all five preview builds, fabricated-volume benchmarks and real-browser responsive smoke checks pass. One public credential-document password was removed from source and now must be provided privately at generation time. See the [pre-server readiness report](docs/PRE_SERVER_FINAL_READINESS_REPORT.md), [audit matrix](docs/PRE_SERVER_AUDIT_MATRIX.md) and [Innovate IT connection checklist](docs/INNOVATE_IT_SERVER_CONNECTION_CHECKLIST.md). No server, cloud resource, native package or store listing was created.

The latest update adds corrected Laboratory worksheets and secure Sales client-visit management. Pressure calibration now enforces 6 Increasing, 5 Repeatability and 5 Decreasing points. Temperature technicians can add, duplicate and reorder any number of calibration points, with at least six paired Reference Standard/UUT readings, actual timestamps, ambient/immersion/stabilisation evidence and controlled post-calculation corrections. The supplied Pressure/Temperature workbooks and Digital/Mechanical thermometer procedures were reviewed; unresolved external formulas remain clearly blocked for Laboratory Management and Technical Signatory approval.

Sales Representatives now have a responsive **Clients** workspace with assigned-customer isolation, monthly visit health, appointment scheduling, advance reminders, overdue and missed-visit handling, consented fabricated geofence checks, customer confirmation and short-lived one-time QR verification. Sales Managers receive visit-compliance and exception reporting. Administrators can configure fabricated office locations and visit-cycle policy. Public mock mode never enables routine GPS collection, and production location processing remains disabled pending formal Rhomberg, IT, HR/legal and privacy approval.

This repository contains the shared React implementation for **Rhomberg Connect**, including its customer and internal role-specific workspaces. The GitHub Pages site is a demonstration environment that uses fabricated browser-local records. It is not a production system and must not receive real customer, employee, pricing, credential or infrastructure data.

The official experience now includes refined responsive Rhomberg Connect logo assets, a professional startup splash, one-time customer welcome, an interactive isolated fake-RFQ tutorial, varied adjustable UI sounds/mobile haptics, restrained micro-interactions and a dedicated service-backed Settings area for every user role. Customer-defined application colours and company-logo branding have been removed; Light, Dark, System and approved accessibility options use the protected official design system. A customer's first authorised representative choice is remembered at company level and reused on later RFQs.

## Launch Rhomberg Connect

### [🚀 Open Rhomberg Connect Application](https://shellygames141up.github.io/Rhomberg-Test-App/app/)

Opens the normal responsive Rhomberg Connect application in your browser. The desktop and mobile application surfaces share one codebase, authentication service, role model and workflow implementation.

### [🖥 Open the Preview Centre](https://shellygames141up.github.io/Rhomberg-Test-App/)

Opens the controlled customer, internal, mobile and executive demonstration choices. All public previews use fabricated browser-local data.

The normal application shows the Rhomberg Connect splash, proceeds directly to Sign In and contains no Preview Centre navigation or fabricated-login shortcuts. The public GitHub Pages build cannot authenticate private operational users; that requires the approved backend or identity provider.

## Private User Administration

Real staff identities belong only in the ignored `private/internal-staff.local.json` roster. The tracked `private-config/internal-staff.example.json` contains explicit owner-supplied placeholders and no credentials. After the owner and IT approve the roster, an authorised administrator runs `npm run docs:private-credentials` on a controlled device to create:

`private/RHOMBERG_CONNECT_INITIAL_USER_CREDENTIALS.pdf`

The encrypted document is ignored by Git, excluded from every public/production build and must be transferred through an IT-approved private channel. It is not available from GitHub Pages or any public repository URL.

Before generation, an authorised administrator supplies `RHOMBERG_CREDENTIAL_PDF_PASSWORD` through the approved private environment/secrets mechanism. The value must never be placed in source control, documentation or browser configuration. Each configured account receives a unique cryptographically random temporary password of at least 16 characters and must change it at first successful login. Secure server-side hashing, MFA, expiry, recovery and session enforcement still require the production backend or identity provider. See [Private User Administration](docs/PRIVATE_USER_ADMINISTRATION.md).

## Application access matrix

| Role | Desktop | Mobile | Status |
| --- | :---: | :---: | --- |
| Customer | Yes | Yes | Active |
| Sales Representative | Yes | Yes | Active |
| Expeditor | Yes | Yes | Active |
| Manager | Yes | Yes | Active |
| Planning, Dispatch, Laboratory, QA, Technical, Sales Manager, Company Owner, Administrator | Yes | No | Active desktop workflows |
| Buyer | Yes | No | Prepared/inactive |

`src/shared/platform/applicationAccess.js` is the single route-access authority; the existing service permission model remains the workflow authority. Editing a URL cannot grant an unauthorised workspace.

## Sales Representative test-client matrix

| Fabricated Representative | Fabricated test company | Customer login | Supported application |
| --- | --- | --- | --- |
| Sales Workflow Test (`C-27`) | `TEST CLIENT - Sales Workflow Test` | `cape.demo@client.test` | Customer Desktop and Mobile |

The test client is fabricated, assigned to exactly one representative and contains enough browser-local records to exercise RFQ, quotation, order, visit and customer workflows. Automated isolation checks confirm the representative cannot see another representative's client records.

## Preview Centre

The Preview Centre is for authorised demonstrations and showcase presentations only. It uses fabricated `.invalid` and `.test` identities and browser-local data.
The separate Preview Centre is for authorised project reviews, presentations, management demonstrations and IT testing. It provides:

- Customer Mobile
- Customer Desktop
- Rep/Expeditor Mobile
- Internal Desktop
- Executive Workflow Demo

For a presentation, open the Preview Centre link above, select the device or workflow experience, and use only the fabricated account listed under **Preview Centre Demo Logins** below. Start with the Executive Workflow Demo for a guided end-to-end story, or choose a role preview for focused department review. Reset the fabricated scenario before a new audience and never enter real customer, employee, pricing or document data.

Use the normal Application link above to open the shared splash and sign-in journey directly. It does not open or link back to the Preview Centre. See [Preview Centre instructions](docs/PREVIEW_CENTRE.md) for the presenter sequence and access boundaries.

## Project Status

- Version: `5.2.0`
- Handover scope: executive demonstration and Innovate IT technical review
- Front end: React 19 and shared CSS
- Current public service: browser-local mock adapter
- Future service: private backend API through the interchangeable API adapter
- Database: versioned PostgreSQL migrations and tested Phase 1 repository; no company database is connected
- Authentication: server-side local-password staging foundation and one-time Administrator bootstrap; production identity providers are not connected
- Documents: generated or simulated in the browser; production private storage is not connected
- Email and push: simulated only
- Production deployment: not started
- Current `main` scope: representative-loaded customer orders, controlled Laboratory calibration and RFQ Technical Support are integrated in mock mode
- Current verification: 96 React source files compile; 41 application test modules plus the backend suite, the shared build, all five preview builds, the GitHub Pages artifact and the API-only production candidate pass their final checks

## Innovate IT handover

The temporary Azure/backend experiment has been removed. Innovate IT should begin with the [server connection checklist](docs/INNOVATE_IT_SERVER_CONNECTION_CHECKLIST.md) and confirm the approved hosting/runtime, PostgreSQL, staff and customer identity, private document storage and malware scanning, DNS/TLS/networking, Microsoft 365 or SMTP delivery, secrets management, monitoring, backup/restore, deployment and support ownership.

The repository is ready for technical review but not for real company/customer data. The recommended first server implementation is a deliberately small fabricated-data slice:

`authenticated user → company/role authorisation → RFQ create/read → private document metadata → audit event and notification`

Innovate IT must preserve the existing `/api/v1` contract, interchangeable service layer, company isolation, workflow state machine, role permissions, document visibility and immutable audit requirements. No frontend route or role-hidden control may be treated as a security boundary. See the [pre-server final readiness report](docs/PRE_SERVER_FINAL_READINESS_REPORT.md), [production deployment requirements](docs/PRODUCTION-DEPLOYMENT.md), [API contract](docs/API_CONTRACT.md), [OpenAPI proposal](docs/api/openapi.yaml) and [PostgreSQL proposal](docs/database/postgresql-schema.sql).

## Final UI/UX Delivery Ledger — 62 Steps

This ledger records the complete final review specification. All 62 steps are implemented, tested, documented, committed and pushed. Steps 1–61 preserve their individual checkpoints; Step 62 is the consolidated release-verification checkpoint.

| Step | Delivered checkpoint | Status |
| ---: | --- | :---: |
| 1 | Global default theme | Complete |
| 2 | Complete responsive UI audit | Complete |
| 3 | Mobile bottom navigation | Complete |
| 4 | Customer Settings — Sounds & Vibration | Complete |
| 5 | Customer Settings — Security | Complete |
| 6 | Customer Home — lead time | Complete |
| 7 | Customer Home — recommended cards | Complete |
| 8 | Customer product details | Complete |
| 9 | Customer product configuration | Complete |
| 10 | RFQ selected-unit quantity | Complete |
| 11 | RFQ submission success modal | Complete |
| 12 | Customer order timeline | Complete |
| 13 | Customer catalogue | Complete |
| 14 | Representative RFQ details | Complete |
| 15 | Representative unit details | Complete |
| 16 | Remove customer emergency data | Complete |
| 17 | Client Visit dashboard readability | Complete |
| 18 | Client Visit scheduling | Complete |
| 19 | Client Visit customer cards | Complete |
| 20 | Representative Load Customer Order | Complete |
| 21 | Representative-loaded order — existing or new client | Complete |
| 22 | Representative Settings | Complete |
| 23 | Expeditor unit details | Complete |
| 24 | Expeditor hand-off banner cleanup | Complete |
| 25 | Expeditor update history | Complete |
| 26 | Expeditor progress form | Complete |
| 27 | Management export | Complete |
| 28 | Executive/Owner responsiveness | Complete |
| 29 | Technical Support filters | Complete |
| 30 | Internal desktop Clients page | Complete |
| 31 | Planning queue | Complete |
| 32 | Planning unit details | Complete |
| 33 | Planning form cleanup | Complete |
| 34 | Sales Order Number | Complete |
| 35 | Dispatch queue | Complete |
| 36 | Dispatch unit details | Complete |
| 37 | Common internal unit-detail component | Complete |
| 38 | Laboratory demo-login cleanup | Complete |
| 39 | Normal application entry flow | Complete |
| 40 | Remove Preview links from normal app UI | Complete |
| 41 | Preview Centre | Complete |
| 42 | Login screen | Complete |
| 43 | Real internal login identifiers | Complete |
| 44 | Password security | Complete |
| 45 | README login documentation | Complete |
| 46 | README Preview Centre instructions | Complete |
| 47 | Remove Preview Centre from normal app | Complete |
| 48 | Executive dashboard | Complete |
| 49 | Global information-banner cleanup | Complete |
| 50 | Global language cleanup | Complete |
| 51 | Text readability | Complete |
| 52 | Table responsiveness | Complete |
| 53 | Form responsiveness | Complete |
| 54 | Sticky action bars | Complete |
| 55 | Preview badges | Complete |
| 56 | Automated UI testing | Complete |
| 57 | Visual-regression framework | Complete |
| 58 | Build and routing verification | Complete |
| 59 | Documentation | Complete |
| 60 | Final manual review | Complete |
| 61 | Final report | Complete |
| 62 | Consolidated release verification and final push | Complete |

The detailed operating, access, responsive-layout and preview rules are maintained in `docs/`. Git history preserves the separate pushed checkpoint for every completed step.

See `docs/FINAL_COMPLETION_REPORT.md` for the detailed final UI/UX report, `docs/FINAL_MANUAL_UI_REVIEW.md` for the role/theme inspection evidence and `docs/FINAL_RELEASE_VERIFICATION.md` for the consolidated Step 62 release evidence.

## Current Updates

### Final workflow and interface refinement — Steps 20–27

- The Sales Representative **Load Customer Order** workflow no longer displays a redundant public-preview banner.
- Representatives must first choose an existing customer or a new/offline customer. New customers create a validated pending profile with no automatic portal access, remain separate from active accounts and produce immutable audit evidence.
- Sales Representatives now use their role-defined landing page automatically while retaining approved application, language, sound, notification, accessibility, security and download settings.
- Expediting reuses the shared expandable configured-unit component so complete immutable product configuration can be inspected consistently across departments.
- The permanent **Handed to Dispatch** banner was removed; the brief action confirmation, workflow status and immutable history remain the hand-off evidence.
- Expeditor history is a simpler chronological record with customer-safe messages and internal notes visibly separated.
- The Expeditor progress form now keeps selectors, messages, dates, delay information and controlled references contained at all supported widths, with its save action clear of mobile bottom navigation.
- Management now presents **Download Operational PDF** as the primary export. Date range, authorised report sections, representative and branch scope remain selectable; CSV is retained only as an advanced secondary option.

### Laboratory worksheets and Sales client visits

- Pressure worksheets use the required 6 Increasing + 5 Repeatability + 5 Decreasing structure.
- Temperature worksheets support dynamic points, six-or-more paired readings, timestamps, ambient conditions, immersion depth, stabilisation evidence, interval review and immutable calculated revisions.
- The private workbook review records sheet protection, formulas, inputs, outputs, external links and unresolved errors without publishing source workbooks or credentials.
- Representative Clients shows assigned customers only, green/amber/red monthly visit health, activity measures and linked appointment history on mobile and desktop.
- Visit verification combines appointment, explicit geofence check, customer confirmation or one-time QR, start/end time and duration. GPS alone cannot automatically verify a visit or drive disciplinary action.
- Sales Manager compliance includes visited, scheduled, missed, overdue, average frequency/duration and approximate fabricated working-location summaries.
- Administrator Locations manages branch offices, coordinates, radius, working hours and visit-cycle settings through audited service actions.
- API `0.9.0` and the PostgreSQL proposal include appointment, verification, QR, location, retention and compliance entities. No production connection or real location tracking is active.
- See [Workbook Review 2](docs/LAB_WORKBOOK_REVIEW_2.md), [Calculation Comparison 2](docs/LAB_CALCULATION_COMPARISON_2.md), [Temperature Worksheet](docs/TEMPERATURE_CALIBRATION_WORKSHEET.md), [Pressure Worksheet](docs/PRESSURE_CALIBRATION_WORKSHEET.md), [Rep Client Visits](docs/SALES_REP_CLIENT_VISITS.md), [Manager Compliance](docs/SALES_MANAGER_VISIT_COMPLIANCE.md) and [Location Privacy](docs/REP_LOCATION_AND_VISIT_PRIVACY.md).

### Interactive customer experience

- The customer tutorial now requires the user to perform a complete fabricated journey: Catalogue → Pressure → PBG → Configure → RFQ details → Review → Submit → Tracking.
- Tutorial actions are highlighted and progress only after the required interaction. The fake `RQ-TUTORIAL-0001` record never calls the operational RFQ service and cannot enter customer history, representative queues, notifications, reports or audit history.
- UI feedback now has louder adjustable defaults and small randomised tone variants for navigation, primary/secondary actions, selections, toggles and tutorial steps, while warnings, errors, success and RFQ submissions remain distinct.
- The first genuine representative selected by a customer is stored as the authoritative company assignment. Later RFQ forms reload and display that representative automatically; audited management reassignment remains available.

### RFQ Technical Support

- Assigned representatives now receive a clear **Quote Client** or **Send to Technical for Assistance** decision while reviewing an RFQ. The Technical option records a required question or note against a specific line item, with category, priority and optional supporting attachment.
- One Technical Advisor role handles assignment, review, correspondence, completion and reporting in a single Operations Desktop workspace; Technical Director oversight remains separate.
- Technical Advisors can return a concise controlled answer to Sales in one action. The assigned representative sees the answer and recommendation on the RFQ and can continue directly to the quotation form once the review is complete.
- The controlled request covers assignment, review, routed information requests, append-only correspondence, recommendation and completion. Final quotation is blocked while review is active; only Sales Managers and Administrators have a reasoned audited override.
- One active Technical Support cycle adds one 24-hour quotation allowance. The customer is notified when the RFQ moves to Technical and again when it returns to the representative, while internal questions, answers, calculations, notes and warnings remain protected.
- Central notifications, immutable audit events, management metrics, future API contracts and PostgreSQL proposals are included. Email/push remain simulated and mock attachments remain metadata-only.
- Open the Internal Desktop experience from the Preview Centre and use the Technical Advisor credentials below. See the [Technical Support workflow](docs/TECHNICAL_SUPPORT_WORKFLOW.md) and [RFQ workflow](docs/RFQ_WORKFLOW.md) for the complete controlled process.

### Customer RFQs and representative-loaded orders

- Customer RFQ forms no longer contain emergency, urgent or priority controls. The service rejects those fields even if a request is forged; authorised internal users retain controlled priority management.
- Sales Representatives can use **Load Customer Order** on Operations desktop and mobile for approved offline orders received by email, telephone, in person, from an existing quotation or another explained source.
- A representative-loaded order requires an authorised company/contact/branch/representative, at least one configured product with quantity, a customer quotation and Purchase Order, both references/dates, and the five-part representative confirmation.
- Successful submissions create a permanent order directly in `awaiting_planning` with origin `representative_loaded_order`; no placeholder RFQ is created.
- Duplicate matching and idempotency protect repeat submissions. Customer, Planning and internal notifications are generated, and source-document uploads, replacements and downloads are audited.
- The GitHub Pages mock stores document metadata only. Production file bytes require private storage, backend validation and malware scanning.

### Laboratory launch workflow

- The launch interface is a manager-only certificate dashboard for qualifying Pressure SANAS and Temperature Traceable units.
- Unfinished technician receipt, stabilisation, inspection, worksheet, calculation, sign-off, draft-generation and method-selection controls are disabled and excluded from live navigation.
- Each physical unit requires its own final PDF, certificate number, date and serial number. The inline order panel supports selecting and uploading several physical-unit certificates in one controlled batch; multi-unit work stays active until every required certificate is present.
- Completed work moves out of the active queue into searchable **Completed Certificates** history. Replacements preserve the superseded version, actor, time and reason.
- Customers select **My Company** or **My Client** for each certified configured unit. An immutable certificate-recipient snapshot follows that unit through RFQ, Order, Planning, Expediting and Laboratory views.
- Customer downloads remain company-scoped and audited. Mock files are browser-only; production requires private authenticated object storage, malware scanning and server-side authorisation.

> The initial production scope uses a simplified Laboratory certificate-upload workflow. Detailed technician calibration worksheets and calculation functionality are deferred to a future Laboratory phase.

GitHub Pages is demonstration-only. Browser storage, browser-side permissions and fabricated passwords are not production security controls.

## Application Products

### Rhomberg Connect

Customer-facing desktop, mobile and future PWA interfaces. A customer account is limited to records associated with its authorised company. Customer projections exclude internal notes, protected document data, workflow overrides and operational-only details.

### Rhomberg Connect internal operations

Role-aware internal interfaces for Sales, Planning, Laboratory, Expediting, Quality Assurance, Dispatch, management and Administration. Navigation and record queues are driven by the central permission model and controlled workflow state machine.

Both products use the same domain rules, validation, notifications, audit model, product data and replaceable service contracts.

### Laboratory certificate workspace

The current `main` branch includes the fabricated manager-only PDF certificate journey. Historical calibration-engine code and technical documents remain isolated for a later approved phase and are not launch functionality.

## Internal User Account Matrix

The approved internal matrix records each employee's user name, login email or username, branch, role or roles, workspace and activation status. Because this is a public repository, real staff identifiers are not published in README or GitHub Pages.

Authorised Rhomberg and IT reviewers can validate the ignored local roster with `npm run check:private-staff`, then generate the private review table with `npm run docs:private-staff`. The output is written to `docs/private/INTERNAL_USER_ACCOUNT_MATRIX.md`, which is excluded from source control and public deployment. See [Internal User Account Matrix controls](docs/INTERNAL_USER_ACCOUNT_MATRIX.md) for ownership and activation requirements.

No matrix, public or private, may contain passwords, password hashes, recovery codes or temporary credentials.

## Preview Centre Demo Logins

**DEMO CREDENTIALS ONLY — NO PRODUCTION ACCESS**

These accounts exist only in public mock builds. They use reserved `.invalid` or `.test` domains and are excluded from the production candidate.

| Role | Username | Password | Supported preview |
| --- | --- | --- | --- |
| Customer | `customer.demo@example.invalid` | `Demo123!` | Connect desktop/mobile; Executive Demo |
| Sales Representative | `sales.workflow@example.invalid` | `Sales123!` | Operations mobile/desktop; Executive Demo |
| Technical Advisor (Technical Support) | `technical.support@example.invalid` | `TechnicalDemo123!` | Operations desktop; Executive Demo |
| Technical Director | `technical.director@example.invalid` | `TechnicalDirector123!` | Operations desktop; Executive Demo |
| Planning | `planning.workflow@example.invalid` | `Planning123!` | Operations desktop; Executive Demo |
| Expeditor | `expeditor.workflow@example.invalid` | `Expedite123!` | Operations mobile/desktop; Executive Demo |
| Laboratory Manager (fabricated preview) | `laboratory.manager@example.invalid` | `LabManager123!` | Operations desktop; certificate upload demo |
| Quality Assurance | `quality.workflow@example.invalid` | `Quality123!` | Operations desktop; Executive Demo |
| Quality Manager | `quality.manager@example.invalid` | `QualityManager123!` | Operations desktop |
| Dispatch | `dispatch.workflow@example.invalid` | `Dispatch123!` | Operations desktop; Executive Demo |
| Buyer - prepared/inactive | `buyer.workflow@example.invalid` | `Buyer123!` | Operations desktop |
| Manager | `manager.workflow@example.invalid` | `Manager123!` | Operations mobile/desktop |
| Sales Manager | `sales.manager@example.invalid` | `SalesManager123!` | Operations desktop; Executive Demo |
| Company Owner | `owner.workflow@example.invalid` | `Owner12345!` | Operations desktop; Executive Demo |
| Administrator | `administrator.workflow@example.invalid` | `Admin123!` | Operations desktop; Executive Demo |

The Laboratory scenarios include fabricated SANAS and Traceable records. The Administrator login exposes the permission-controlled account, company, role, configuration, audit, archive and mock-data views.

## Repository Structure

| Path | Purpose |
| --- | --- |
| `src/apps/` | Preview centre, customer personalisation and executive-demo applications |
| `src/components/` | Shared customer and internal React workspaces |
| `src/domain/` | Workflow, permission-adjacent domain rules, notifications, documents, Laboratory, QA and analytics |
| `src/services/mock/` | Fabricated browser-local service implementation |
| `src/services/api/` | Future private-cloud HTTP service implementation |
| `src/shared/` | Platform routing and customer personalisation |
| `src/shared/design/` | Semantic colour, contrast, typography, breakpoint and status contracts |
| `tests/` | Automated unit, integration, isolation and production-exclusion checks |
| `docs/` | IT architecture, API, database, security, workflow and deployment handover |
| `preview/` | Four product preview route entry points |
| `demo/executive-workflow/` | Executive demonstration route entry point |
| `scripts/` | Verified build, check and preview tooling |
| `assets/` | Public static product and brand assets |

Ignored `private/`, environment files and generated build directories are not deployment inputs and must not be committed.

## Verified Commands

Use Node.js and the package lock committed to this repository.

```text
npm install
npm run check
npm run check:css
npm test
npm run build
npm run build:customer-desktop
npm run build:customer-mobile
npm run build:internal-mobile
npm run build:internal-desktop
npm run build:executive-demo
npm run build:previews
npm run build:production
```

Local preview commands:

```text
npm run dev:customer-desktop
npm run dev:customer-mobile
npm run dev:internal-mobile
npm run dev:internal-desktop
npm run dev:executive-demo
```

`build` prepares the GitHub Pages mock. `build:production` prepares and scans an API-only candidate in `dist-production/`. The production candidate excludes mock accounts, public-preview controls, executive role switching, browser-local workflow storage and source maps.

## Accessibility and responsive UI

The shared UI now uses protected light/dark foreground tokens, contrast-checked status pairs, a central rem-based typography scale and shared breakpoint definitions. All roles use the official Rhomberg Connect brand; customers can select Light, Dark or System appearance but cannot replace company colours or logos. Customer Desktop, Internal Desktop and Executive Full Application mode use real wide workspaces with a navigation rail from 1024 px; mobile and tablet views reflow controls and reserve space for bottom navigation.

Run `npm test` for automated contrast/theme/status/responsive contracts and follow [the visual test checklist](docs/VISUAL_TEST_CHECKLIST.md) for rendered viewport, theme, text-size and zoom checks.

The completed repair scope, rendered matrix, command results and remaining human-review items are recorded in [the accessibility and responsive completion report](docs/ACCESSIBILITY_RESPONSIVE_COMPLETION_REPORT.md).

## Mock Mode

- Records persist only in the current browser profile.
- Different browsers and devices do not synchronise.
- Refreshing the page preserves the active fabricated session and executive scenario.
- Reset controls restore seeded fabricated workflow records.
- File handling is metadata or browser-memory simulation.
- Email and push delivery states are simulated.
- No permanent server-side audit, backup, retention or recovery exists.
- Mock passwords and browser-side authorisation are for demonstration convenience only.

Do not import real customer data into mock mode.

## Intended Production Architecture

```text
Rhomberg Connect and Rhomberg Operations
                    |
                    v
          Secure Backend API
                    |
                    v
           PostgreSQL Database
                    |
                    v
       Private Document Storage
```

The production server must enforce authentication, roles, permissions, company scoping, workflow transitions, document access, audit immutability and notification recipient rules. Front-end checks provide user guidance but are not an authority.

## Innovate IT Requirements

Innovate IT must confirm or provide:

- staging, UAT and production hosting standards;
- PostgreSQL and backup/recovery services;
- customer, internal and API domains;
- DNS, TLS, firewall and network controls;
- internal identity-provider and customer-authentication approach;
- private object storage and upload malware scanning;
- secrets management;
- Microsoft 365 or approved SMTP delivery;
- monitoring, central logging and incident response;
- mobile push, App Store, Play Store and Windows distribution ownership;
- named technical contact, security reviewer and production approver.

No infrastructure values, credentials or private endpoints belong in this repository.

## Recommended Deployment Sequence

1. Technical and security review
2. Staging environment approval
3. Backend API deployment
4. PostgreSQL creation and migration review
5. Internal and customer authentication integration
6. Private file storage and malware scanning
7. Email and notification integration
8. Security and penetration testing
9. User acceptance testing
10. Production release approval

## Security Warnings

- Do not use GitHub Pages for production.
- Do not place secrets, connection strings or server passwords in source control.
- Do not reuse demonstration passwords.
- Do not expose uploaded documents through public URLs.
- Do not trust client-side permissions, statuses or company identifiers.
- Do not place protected pricing in a public bundle.
- Do not connect the mock adapter to production data.
- Do not claim this repository is production-secure before backend enforcement and IT testing.

## Known Limitations

- No production API, database, object storage, identity provider, email provider or push provider is connected.
- No cross-device data persistence exists in mock mode.
- The Buyer workflow is prepared but inactive.
- Outlook quotation preparation and customer payment/PO exchange remain external to the application.
- Laboratory calculations, methods, uncertainty models, reference standards and certificate templates require formal technical and accreditation review before production use.
- External certificate signing remains outside the application; the mock records the controlled hand-off, signed-PDF return and release evidence only.
- Mobile native packaging, signing, store submission and Windows distribution require IT-owned processes.
- Retention, archive and permanent deletion require approved server-side jobs.
- GitHub Pages cannot enforce private access to the demonstration.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [RFQ workflow](docs/RFQ_WORKFLOW.md)
- [Technical Support workflow](docs/TECHNICAL_SUPPORT_WORKFLOW.md)
- [Order workflow](docs/ORDER_WORKFLOW.md)
- [Representative workflow](docs/REPRESENTATIVE_WORKFLOW.md)
- [Document access matrix](docs/DOCUMENT_ACCESS_MATRIX.md)
- [Role and permission matrix](docs/ROLE_PERMISSION_MATRIX.md)
- [API contract](docs/API_CONTRACT.md) and [OpenAPI](docs/api/openapi.yaml)
- [Database schema](docs/DATABASE_SCHEMA.md) and [PostgreSQL proposal](docs/database/postgresql-schema.sql)
- [Phase 1 backend foundation](docs/PHASE1_BACKEND_FOUNDATION.md) and [real PostgreSQL validation](docs/PHASE1B_POSTGRESQL_VALIDATION.md)
- [Notification architecture](docs/NOTIFICATION_ARCHITECTURE.md)
- [PDF and email export](docs/PDF_AND_EMAIL_EXPORT.md)
- [Retention and archiving](docs/RETENTION_AND_ARCHIVING.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Deployment handover](docs/DEPLOYMENT_HANDOVER.md)
- [End-to-end demo script](docs/END_TO_END_DEMO_SCRIPT.md)
- [Executive demo guide](docs/EXECUTIVE_DEMO_GUIDE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Accessibility](docs/ACCESSIBILITY.md)
- [Responsive layout](docs/RESPONSIVE_LAYOUT.md)
- [Desktop UI guidelines](docs/DESKTOP_UI_GUIDELINES.md)
- [Visual test checklist](docs/VISUAL_TEST_CHECKLIST.md)
- [Accessibility and responsive completion report](docs/ACCESSIBILITY_RESPONSIVE_COMPLETION_REPORT.md)
- [Preview guide](docs/PREVIEW_GUIDE.md)
- [Build and deployment](docs/BUILD_AND_DEPLOYMENT.md)
- [Mock-mode limitations](docs/MOCK_MODE_LIMITATIONS.md)
- [Laboratory workflow](docs/LAB_WORKFLOW.md), [implementation completion report](docs/LAB_IMPLEMENTATION_COMPLETION_REPORT.md), [template analysis](docs/LAB_TEMPLATE_ANALYSIS.md), [calculation specification](docs/LAB_CALCULATION_SPECIFICATION.md), [validation report](docs/LAB_CALCULATION_VALIDATION_REPORT.md), [reference standards](docs/LAB_REFERENCE_STANDARDS.md), [uncertainty budget](docs/UNCERTAINTY_BUDGET.md), [PDF templates](docs/LAB_PDF_TEMPLATES.md), [role matrix](docs/LAB_ROLE_PERMISSION_MATRIX.md), [certificate workflow](docs/LAB_CERTIFICATE_WORKFLOW.md), [signature workflow](docs/LAB_SIGNATURE_WORKFLOW.md) and [test plan](docs/LAB_TEST_PLAN.md)
- [QA workflow](docs/QA_WORKFLOW.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Private User Administration](docs/PRIVATE_USER_ADMINISTRATION.md)
- [Management analytics](docs/MANAGEMENT_ANALYTICS.md)
- [Release notes](docs/RELEASE_NOTES_v1.0.0_IT_HANDOVER.md)
- [Pre-server final readiness report](docs/PRE_SERVER_FINAL_READINESS_REPORT.md) and [application audit matrix](docs/PRE_SERVER_AUDIT_MATRIX.md)
- [Innovate IT server connection checklist](docs/INNOVATE_IT_SERVER_CONNECTION_CHECKLIST.md)
- [Mobile packaging readiness](docs/MOBILE_PACKAGING_READINESS.md)
- [Google Play release checklist](docs/GOOGLE_PLAY_RELEASE_CHECKLIST.md)
- [Apple App Store release checklist](docs/APPLE_APP_STORE_RELEASE_CHECKLIST.md)
- [Windows release readiness](docs/WINDOWS_APP_RELEASE_READINESS.md)
- [Release and update strategy](docs/RELEASE_AND_UPDATE_STRATEGY.md)

## Responsibility Split

Application development covers UI, workflow implementation, service integration, shared validation, application tests, documentation, bug fixes and approved feature development.

Innovate IT covers hosting, database operations, DNS, TLS, firewalls, backups, monitoring, secrets, private file storage, infrastructure incident response and production deployment controls.

Shared responsibilities include security testing, access-control review, staging validation, UAT, release planning, disaster-recovery testing and support escalation.

- Technical owner: `[To be confirmed]`
- Innovate IT contact: `[To be confirmed]`
- Security reviewer: `[To be confirmed]`
- Production approver: `[To be confirmed]`
