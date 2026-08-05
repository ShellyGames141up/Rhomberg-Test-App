# Rhomberg Platform - IT Handover Repository

Functional application and workflow implementation is complete in mock mode. Production infrastructure and backend integration remain subject to IT review and staging deployment.

This repository contains the shared React implementation for Rhomberg Connect and Rhomberg Operations. The GitHub Pages site is a demonstration environment that uses fabricated browser-local records. It is not a production system and must not receive real customer, employee, pricing, credential or infrastructure data.

## Application Previews

1. [Rhomberg Connect - Customer Desktop](https://shellygames141up.github.io/Rhomberg-Test-App/preview/customer-desktop/)
   Desktop customer workspace for the product catalogue, RFQs, quotation acknowledgement, order tracking, certificates, notifications and account settings.

2. [Rhomberg Connect - Customer Mobile](https://shellygames141up.github.io/Rhomberg-Test-App/preview/customer-mobile/)
   Touch-first customer interface using the same company-isolated workflows and service contracts.

3. [Rhomberg Operations - Rep & Expeditor Mobile](https://shellygames141up.github.io/Rhomberg-Test-App/preview/internal-mobile/)
   Mobile access for Sales Representatives, including safe document upload for **Load Customer Order**, authorised managers and Expeditors. Planning, Laboratory, QA, Dispatch and Administration are desktop-only.

4. [Rhomberg Operations - Internal Desktop](https://shellygames141up.github.io/Rhomberg-Test-App/preview/internal-desktop/)
   Internal workspace for Sales Representatives, Sales Managers, Company Owner or authorised management, Planning, Laboratory, Expediting, Quality Assurance, Dispatch, Buyer and Administrator roles.

5. [Executive Workflow Demo](https://shellygames141up.github.io/Rhomberg-Test-App/demo/executive-workflow/)
   Internal presentation route using fabricated data, guided scenarios and controlled role switching. It is not a production environment. Role-switching and executive-demo controls are excluded from production builds.

[Open the Preview Centre](https://shellygames141up.github.io/Rhomberg-Test-App/)

## Project Status

- Version: `5.0.0`
- Handover scope: executive demonstration and Innovate IT technical review
- Front end: React 19 and shared CSS
- Current public service: browser-local mock adapter
- Future service: private backend API through the interchangeable API adapter
- Database: proposed PostgreSQL schema only; no database is connected
- Authentication: fabricated mock identities only; production identity is not connected
- Documents: generated or simulated in the browser; production private storage is not connected
- Email and push: simulated only
- Production deployment: not started

## Current Workflow Update

- Customer RFQ forms no longer contain emergency, urgent or priority controls. The service rejects those fields even if a request is forged; authorised internal users retain controlled priority management.
- Sales Representatives can use **Load Customer Order** on Operations desktop and mobile for approved offline orders received by email, telephone, in person, from an existing quotation or another explained source.
- A representative-loaded order requires an authorised company/contact/branch/representative, at least one configured product with quantity, a customer quotation and Purchase Order, both references/dates, and the five-part representative confirmation.
- Successful submissions create a permanent order directly in `awaiting_planning` with origin `representative_loaded_order`; no placeholder RFQ is created.
- Duplicate matching and idempotency protect repeat submissions. Customer, Planning and internal notifications are generated, and source-document uploads, replacements and downloads are audited.
- The GitHub Pages mock stores document metadata only. Production file bytes require private storage, backend validation and malware scanning.

GitHub Pages is demonstration-only. Browser storage, browser-side permissions and fabricated passwords are not production security controls.

## Application Products

### Rhomberg Connect

Customer-facing desktop, mobile and future PWA interfaces. A customer account is limited to records associated with its authorised company. Customer projections exclude internal notes, protected document data, workflow overrides and operational-only details.

### Rhomberg Operations

Role-aware internal interfaces for Sales, Planning, Laboratory, Expediting, Quality Assurance, Dispatch, management and Administration. Navigation and record queues are driven by the central permission model and controlled workflow state machine.

Both products use the same domain rules, validation, notifications, audit model, product data and replaceable service contracts.

### Controlled Laboratory calibration workspace (local development)

The current local branch adds the complete unit-level Laboratory journey for Cape Town and Johannesburg: receipt, stabilisation, inspection, booking, branch/technician assignment, separate Pressure and Temperature methods, structured readings, uncertainty calculation, management review, labelling, Dispatch transfer, internal review PDFs, draft/final certificate versions, external-signature re-upload, explicit certificate release, audit history and notifications. Reference registers and test records are fabricated. Supplied customer workbooks and certificates are excluded from the repository.

This feature is an implementation for review, not a metrology or accreditation approval. Legacy external workbook links and a Temperature repeatability-count discrepancy require formal resolution before production.

## Fabricated Demo Accounts

These accounts exist only in public mock builds. They use reserved `.invalid` or `.test` domains and are excluded from the production candidate.

| Role | Username | Password | Supported preview |
| --- | --- | --- | --- |
| Customer | `customer.demo@example.invalid` | `Demo123!` | Connect desktop/mobile; Executive Demo |
| Sales Representative | `sales.workflow@example.invalid` | `Sales123!` | Operations mobile/desktop; Executive Demo |
| Planning | `planning.workflow@example.invalid` | `Planning123!` | Operations desktop; Executive Demo |
| Expeditor | `expeditor.workflow@example.invalid` | `Expedite123!` | Operations mobile/desktop; Executive Demo |
| Laboratory User | `laboratory.workflow@example.invalid` | `Lab12345!` | Operations desktop; Executive Demo |
| Laboratory Manager | `laboratory.manager@example.invalid` | `LabManager123!` | Operations desktop; Executive Demo |
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

The shared UI now uses protected light/dark foreground tokens, contrast-checked status pairs, a central rem-based typography scale and shared breakpoint definitions. Customer theme colours are validated and unsafe persisted custom colours fall back to protected defaults. Customer Desktop, Internal Desktop and Executive Full Application mode use real wide workspaces with a navigation rail from 1024 px; mobile and tablet views reflow controls and reserve space for bottom navigation.

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
- Mobile native packaging, signing, store submission and Windows distribution require IT-owned processes.
- Retention, archive and permanent deletion require approved server-side jobs.
- GitHub Pages cannot enforce private access to the demonstration.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Order workflow](docs/ORDER_WORKFLOW.md)
- [Representative workflow](docs/REPRESENTATIVE_WORKFLOW.md)
- [Document access matrix](docs/DOCUMENT_ACCESS_MATRIX.md)
- [Role and permission matrix](docs/ROLE_PERMISSION_MATRIX.md)
- [API contract](docs/API_CONTRACT.md) and [OpenAPI](docs/api/openapi.yaml)
- [Database schema](docs/DATABASE_SCHEMA.md) and [PostgreSQL proposal](docs/database/postgresql-schema.sql)
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
- [Laboratory workflow](docs/LAB_WORKFLOW.md), [template analysis](docs/LAB_TEMPLATE_ANALYSIS.md), [calculation specification](docs/LAB_CALCULATION_SPECIFICATION.md), [validation report](docs/LAB_CALCULATION_VALIDATION_REPORT.md), [role matrix](docs/LAB_ROLE_PERMISSION_MATRIX.md), [certificate workflow](docs/LAB_CERTIFICATE_WORKFLOW.md) and [test plan](docs/LAB_TEST_PLAN.md)
- [QA workflow](docs/QA_WORKFLOW.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Management analytics](docs/MANAGEMENT_ANALYTICS.md)
- [Release notes](docs/RELEASE_NOTES_v1.0.0_IT_HANDOVER.md)

## Responsibility Split

Application development covers UI, workflow implementation, service integration, shared validation, application tests, documentation, bug fixes and approved feature development.

Innovate IT covers hosting, database operations, DNS, TLS, firewalls, backups, monitoring, secrets, private file storage, infrastructure incident response and production deployment controls.

Shared responsibilities include security testing, access-control review, staging validation, UAT, release planning, disaster-recovery testing and support escalation.

- Technical owner: `[To be confirmed]`
- Innovate IT contact: `[To be confirmed]`
- Security reviewer: `[To be confirmed]`
- Production approver: `[To be confirmed]`
