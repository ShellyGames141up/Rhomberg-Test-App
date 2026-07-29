# Rhomberg Connect and Rhomberg Operations - Public Test Platform

This repository contains four focused interfaces backed by one shared React domain, permission model, workflow state machine and interchangeable service layer. The public GitHub Pages deployment is a fabricated browser-only demonstration: it contains no production database connection, private price values, API keys or real customer accounts.

# Launch a Test Preview

### [1. Rhomberg Connect — Customer Desktop](https://shellygames141up.github.io/Rhomberg-Test-App/preview/customer-desktop/)

Desktop customer experience for catalogue browsing, RFQs, quotations, tracking, documents and account settings.

### [2. Rhomberg Connect — Customer Mobile](https://shellygames141up.github.io/Rhomberg-Test-App/preview/customer-mobile/)

Mobile-first customer experience for fast RFQ creation, quotation responses, order tracking and notifications.

### [3. Rhomberg Operations — Rep & Expeditor Mobile](https://shellygames141up.github.io/Rhomberg-Test-App/preview/internal-mobile/)

Mobile workflow for representatives, managers, authorised company leadership and Expeditors. Planning and Dispatch are intentionally unavailable.

### [4. Rhomberg Operations — Internal Desktop](https://shellygames141up.github.io/Rhomberg-Test-App/preview/internal-desktop/)

Desktop operational workspace for representatives, managers, Expeditors, Planning and Dispatch.

### [Open the visual preview centre](https://shellygames141up.github.io/Rhomberg-Test-App/)

The preview centre contains the same four launch cards, intended-user details and filtered demonstration logins.

## Demonstration-only accounts

| Role | Email | Password | Supported preview |
| --- | --- | --- | --- |
| Customer | `customer.demo@example.invalid` | `Demo123!` | Connect desktop and mobile |
| Cape customer journey | `cape.demo@client.test` | `Demo123!` | Connect desktop and mobile |
| Sales representative | `sales.workflow@example.invalid` | `Sales123!` | Operations mobile and desktop |
| Expeditor | `expeditor.workflow@example.invalid` | `Expedite123!` | Operations mobile and desktop |
| Manager | `manager.workflow@example.invalid` | `Manager123!` | Operations mobile and desktop |
| Planning | `planning.workflow@example.invalid` | `Planning123!` | Operations desktop only |
| Dispatch | `dispatch.workflow@example.invalid` | `Dispatch123!` | Operations desktop only |
| Buyer (prepared/inactive) | `buyer.workflow@example.invalid` | `Buyer123!` | Operations desktop only |
| Administrator | `administrator.workflow@example.invalid` | `Admin123!` | Operations desktop only |

All credentials above are fabricated and demonstration-only. GitHub Pages runs in mock mode: no real customer accounts are synchronised, no production authentication is used, and unrelated browsers or devices do not share changes. The four interfaces use the same mock service contracts and same-browser logical data. Future production versions will use one secure backend on Rhomberg’s private infrastructure.

## Current development checkpoint

- **Checkpoint date:** 29 July 2026
- **Current version:** 5.0.0
- **Last completed step:** Phase 21 - desktop optimisation, unit-level Laboratory certificates, QA/rework control, Dispatch receipt, operational analytics and verified credential-change preview.

This checkpoint adds a complete security/data-leak review, allow-listed customer record projections that exclude unknown fields by default, full authorised-company enforcement across archive/audit/company-directory operations, safer serverless error logging, stronger production-bundle scans and adversarial tests for company/representative access, forged statuses, PDFs, recipients, secrets, pricing, documents, audit and deletion boundaries.

All automated tests, source checks, stylesheet checks, the shared build, all four static preview builds, and the scanned API-only production-candidate build passed at this checkpoint. The GitHub Pages preview remains browser-local and uses fabricated data only.

No real database, identity provider, email provider, push provider, courier integration or document-storage service has been connected. The GitHub Pages mock is explicitly not production-secure. Continue from [the security review](docs/SECURITY_REVIEW.md), [progress handoff](docs/HOME_PC_PROGRESS_HANDOFF.md), [production API/database specification](docs/PRODUCTION_API_DATABASE_SPECIFICATION.md), [end-to-end demo script](docs/END_TO_END_DEMO_SCRIPT.md), [retention policy](docs/RETENTION_POLICY.md) and [delivery strategy](docs/DELIVERY_STRATEGY.md).

## Latest development changes

The current release includes the completed Prompt 11-19 work plus Phase 21:

- **Prompt 11:** Separate customer-visible order timelines and immutable internal audit history, with management viewing permissions and customer-data leakage tests.
- **Prompt 12:** Customer-safe and internal operational order-summary PDFs, preview/download controls, simulated email sharing, recipient validation and audited document actions.
- **Prompt 13:** Configurable archiving and retention management, archive eligibility, Archived Orders search, restore/export controls, legal holds and deletion safeguards.
- **Prompt 14:** One responsive Progressive Web App codebase, role-specific mobile and desktop navigation, Capacitor preparation and documented Windows/mobile delivery requirements.
- **Prompt 15:** Management oversight metrics, ageing, activity, authorised search, reassignments, override/archive approvals and operational CSV reporting.
- **Prompt 16:** Stronger end-to-end validation, public-safe errors, idempotency, safe read retries and expanded failure/isolation tests.
- **Prompt 17:** Canonical PostgreSQL production model, role/company scoping, row-level-security approach, audit rules and reconciled OpenAPI contract with fabricated examples.
- **Prompt 18:** Automated complete mock RFQ/order lifecycle, customer/representative notifications, Planning/Expediting/Dispatch hand-offs, internal/customer PDFs, archive eligibility and manual presenter checklist.
- **Prompt 19:** Security/data-leak review, fail-closed customer projection, archive/audit/company scope hardening, safe logging, stronger production scans and adversarial access-control tests.
- **Phase 21:** Proper Laboratory and QA desktop workspaces; SANAS/Traceable per-unit routing and certificates; physical movement independent of certificate upload; QA failure, rework and reinspection history; separate Dispatch receipt; pricing-safe management/product analytics; customer/internal sign-in realms; simulated verified credential changes; and dedicated branch-based representative assignment.

The public GitHub Pages build remains a fabricated mock demonstration. Email and push delivery are simulated, browser code cannot permanently delete orders, and no production credentials or customer data were added.

## Phase 21 desktop demonstration accounts

| Role | Email | Password | Preview |
| --- | --- | --- | --- |
| Laboratory user | `laboratory.workflow@example.invalid` | `Lab12345!` | Operations desktop |
| Laboratory manager | `laboratory.manager@example.invalid` | `LabManager123!` | Operations desktop |
| Quality Assurance | `quality.workflow@example.invalid` | `Quality123!` | Operations desktop |
| Quality manager | `quality.manager@example.invalid` | `QualityManager123!` | Operations desktop |
| Sales manager | `sales.manager@example.invalid` | `SalesManager123!` | Operations mobile/desktop |
| Company owner | `owner.workflow@example.invalid` | `Owner12345!` | Operations mobile/desktop |

These are fabricated public-preview identities. Production builds exclude mock accounts and development verification codes.

## Phase 21 documentation

- [Order routing](docs/ORDER_WORKFLOW.md)
- [Laboratory workflow](docs/LAB_WORKFLOW.md) and [certificate workflow](docs/CERTIFICATE_WORKFLOW.md)
- [Quality Assurance](docs/QA_WORKFLOW.md) and [Dispatch receipt](docs/DISPATCH_WORKFLOW.md)
- [Authentication](docs/AUTHENTICATION.md), [database proposal](docs/DATABASE_SCHEMA.md) and [API contract](docs/API_CONTRACT.md)
- [Management analytics](docs/MANAGEMENT_ANALYTICS.md), [product analytics](docs/PRODUCT_ANALYTICS.md) and [desktop UI guidance](docs/DESKTOP_UI_GUIDELINES.md)

## Included in version 4.8

- Complete findings, evidence and unresolved production requirements in [Security and Data-Leak Review](docs/SECURITY_REVIEW.md)
- Explicit warning that browser-local GitHub Pages authentication, isolation and audit history are not production security boundaries
- Allow-listed customer record/document/representative/item projections plus recursive configuration redaction for internal/private/protected/audit/credential/token/pricing/cost/margin/supplier fields
- Preservation of the legitimate customer-selected PBB `internalContacts` configuration
- Authorised-company enforcement for company lists, archive lists/actions/exports/legal holds and direct audit reads
- Generic serverless failure responses and correlation-only logging without raw exceptions or RFQ/customer payloads
- Expanded API-only build rejection markers for mock services, demo data and private pricing code
- Adversarial tests for customer/representative isolation, forged statuses, internal notes, protected documents, PDF content, email header injection, archive scope, secrets and pricing
- Static verification of secure-cookie/CSRF contracts, document RLS, append-only audit and controlled permanent-deletion design

## Included in version 4.7

- Canonical proposed PostgreSQL entities for users, roles, permissions, memberships, catalogue configuration, RFQs, quotations, acceptance, orders, operational records, notification/audit evidence, archive history and workflow overrides
- Primary/foreign keys, uniqueness, enums, timestamps, soft deletion/archive fields, targeted indexes and row-level-security policies
- Append-only audit, tracking, Expediting, Dispatch-update and archive evidence
- Explicit v0.6 OpenAPI endpoints for identity administration, memberships, product configurations, RFQ subresources, Planning, Expediting, Dispatch, archive history and controlled workflow overrides
- Backward-compatible `/enquiries` API naming mapped to canonical `app.rfqs`
- Fabricated requests/responses and safe error-envelope examples
- Automated two-product end-to-end scenario covering RFQ submission through completed collection
- Customer and assigned-representative notification and visibility assertions
- Valid internal operational and customer-safe PDF generation assertions
- Retention-clock test proving the completed order becomes archive eligible
- Manual presenter checklist in [End-to-End Demonstration Script](docs/END_TO_END_DEMO_SCRIPT.md)
- Static specification tests for canonical entities, endpoints, component references and required security markers

## Included in version 4.6

- Management dashboard covering RFQ, Planning, Expediting, hold/delay, Dispatch, completion, emergency and archive totals
- Average stage time plus orders by representative, branch and status
- Authorised cross-record search, ageing list and recent immutable activity
- Controlled representative reassignment with version checks, reason and audit event
- Controlled workflow-override approval and separate archival approval
- Pricing-safe management projections and internal operational CSV export
- Optional authorised-company restrictions for wider management accounts
- Stable RFQ idempotency keys and duplicate-submission replay protection
- Safe retry of transient read-only API requests without automatically replaying mutations
- Stronger reference, upload metadata, date-order and past-estimate validation
- Friendly session, permission, network and unexpected-error messages without stack or infrastructure leakage
- Expanded permission, company-isolation, management, validation, retry and duplicate-submission tests
- Proposed private API, database and security contracts documented in [Management Oversight and Validation](docs/MANAGEMENT_OVERSIGHT_AND_VALIDATION.md)

## Included in version 4.5

- Configurable safe demonstration retention settings with explicit production-approval warning
- Automatic `archive_eligible` marking based only on completed date and policy threshold
- Manager/Administrator Archived Orders workspace with search and filters
- Explicit archive and restore actions that preserve records, references, PDFs, timeline and audit evidence
- Legal/investigation holds with audited apply/release events
- Internal PDF retention export before any future deletion workflow
- Permanent deletion disabled in mock/browser code and reserved for an approved backend workflow
- API/OpenAPI and PostgreSQL proposals for policy versions, exports, approvals and deletion logs
- Shared responsive PWA delivery across customer, representative, Expeditor, Planning, Dispatch and management roles
- Capacitor packaging configuration for future Android/iOS work and PWA-first Windows strategy
- Environment-specific public runtime configuration, offline limitations, push, signing, store and update requirements
- Automated archive, permission, legal-hold, export, policy and deletion-boundary tests

## Included in version 4.4

- Professional multi-page Rhomberg order-summary PDF generation with classification, dates and page numbering
- Customer-safe and internal operational copies built from separate projections
- Product configuration, requirements, Planning, Expediting, Dispatch and customer-visible timeline sections
- Browser preview, download and fresh-copy generation for authorised internal roles
- Manual, assigned-representative and allow-listed internal email recipients
- External-recipient validation and explicit confirmation
- Simulated mock email delivery only; no real email or credentials
- Immutable PDF-generation and email-delivery audit events
- Future secure Microsoft 365/SMTP, private-storage and outbox API contracts
- Automated privacy, permission, validation, PDF-byte and audit tests

## Included in version 4.3

- Dedicated customer-safe `customerTimeline` projection used by the order-tracking interface
- Internal actor IDs, roles, notes, override data and audit metadata removed from customer timeline events
- Manager/Administrator Audit navigation and responsive read-only audit workspace
- Search and filters by record type, outcome, company, reference, user, request ID and correlation ID
- Complete audit projection with event/status transition, actor, timestamp, company/reference, changed fields, reason, notification results, override usage and safe document metadata
- Append-only mock behaviour with no ordinary audit update/delete service
- Proposed PostgreSQL mutation-rejection trigger and management-only audit RLS
- Expanded API/OpenAPI contracts and tests for immutability and customer-data leakage prevention

## Included in version 4.2

- Dedicated desktop-optimised Dispatch workspace in the existing responsive Operations application
- Controlled queue for `awaiting_dispatch`, `ready_for_collection` and `out_for_delivery`, plus handover-confirmed records awaiting final completion
- Search across order, RFQ, job, Purchase Order, customer, representative, courier and tracking references, with queue filters and sorting
- Structured collection, company delivery, courier and third-party delivery methods that must match the customer’s fulfilment choice
- Validated ready/collection/delivery dates, courier or driver, tracking reference, package count, delivery note, recipient or collector and separate customer/internal messages
- Controlled optional proof-of-delivery metadata and PDF/image selection; mock mode stores metadata only and never retains file bytes
- `Mark Ready for Collection`, `Mark Out for Delivery`, `Confirm Collected`, `Confirm Delivered`, `Mark Completed` and same-stage `Report Delivery Problem` actions
- Customer and assigned-representative notifications plus audit history for every important Dispatch action
- Customer-safe Dispatch projection that excludes internal notes, problem/escalation detail and internal actor IDs
- Fabricated collection and delivery records for immediate demonstration
- Interchangeable `dispatch.getWorkspaceOptions()` mock/API service contract, proposed OpenAPI/PostgreSQL structures and dedicated automated tests

## Included in version 4.1

- Central notification event and delivery model for the approved RFQ/order milestones
- Recipient-scoped in-app notification centre with unread count, mark-read, mark-all and direct RFQ/order links
- Customer-company and assigned-representative isolation before preference filtering
- Central channel/category preferences with mandatory in-app/security updates
- Exact in-app/email/push delivery states plus retry-ready attempt metadata
- Deterministic email and push simulations; no external provider is contacted
- Manager/Administrator simulated delivery retry through a named permission and audit history
- Interchangeable mock/API service methods and shared validation
- Proposed PostgreSQL notification, delivery and preference tables plus OpenAPI contracts
- Microsoft 365/SMTP, APNs/FCM, worker, retry and dead-letter deployment requirements
- Automated event, isolation, read-state, preference, retry and API-adapter coverage

## Included in version 4.0

- Separate Rhomberg Connect customer desktop/mobile and Rhomberg Operations internal mobile/desktop routes
- Responsive preview centre and role-filtered demonstration logins
- Strict preview-entry role controls in addition to the existing shared permission service
- Customer-only ten-step welcome and personalisation setup
- Validated theme presets, protected custom colours, font scaling, display density and light/dark/system appearance
- Mock profile/company image storage with file validation, repositioning and removal
- Customer notification preferences with protected transactional/security categories
- Reusable customer Settings screen with preview, cancellation, section reset and full default restoration
- Shared mock/API personalisation contracts, company/account isolation and audit events
- Separate development/build commands for every preview plus one combined GitHub Pages build
- Production-candidate safety scan that rejects demonstration accounts and public-preview features

## Included in version 3.2

- Shared Expeditor workspace designed for both desktop and mobile in the same React application
- New, in-progress, on-hold, due-soon, awaiting-Dispatch and priority/emergency queue views
- Oldest-update-first default sorting plus search by customer, representative, RFQ, order, internal job and Purchase Order reference
- Configurable Expediting progress catalogue delivered through interchangeable mock/API services
- Controlled Start, Progress Update, Hold, Resume and Dispatch Hand-off actions
- Separate customer-facing message and internal note, with optional completion estimate, delay reason and document/image reference metadata
- Immutable same-status progress events, audit entries and independent customer/representative notifications
- Required-for-Dispatch completion rules with a controlled authorised-exception reason/reference
- Customer-safe projections that retain public progress while omitting internal notes, delay/reference context, actor IDs and exception evidence
- Read-only Expeditor awareness after an order has moved to `awaiting_dispatch`
- Fabricated Expediting queue records and automated queue, workflow, permission, visibility, notification and API-adapter tests
- Updated API/OpenAPI, PostgreSQL, security and private-cloud handover proposals

## Included in version 3.1

- Dedicated desktop-optimised Planning workspace in the same responsive React application
- Planning queue for `awaiting_planning`, `planning_in_progress`, `planned` and Planning-owned holds, with stage/priority filters, full-text search and five sort modes
- Order/RFQ references, customer and representative details, age, priority, emergency flag, line-item count, PO state and last activity in every queue row
- Controlled `Start planning`, `Save planning details` and `Submit to expediting` actions through the existing service and workflow boundary
- Structured Planning record with job number, customer PO or authorised exception, notes, schedule, assigned Planning user, location, priority and document references
- Server-style validation of the Planning owner, recognised branch/location, dates, PO exception, assigned representative and required hand-off fields
- Planning actor/timestamp metadata, immutable workflow/audit entries and recipient-specific customer, representative and Expeditor notifications
- Customer-safe projection that removes job numbers, PO planning fields, schedules, notes, document references and internal Planning actors
- Fabricated orders in all three Planning stages for immediate dashboard demonstration
- Planning queue, state-machine, service, API-adapter, audit, notification and customer-projection tests

## Included in version 3.0

- Catalogue configuration corrections from the approved product notes, including gauge material/size/range/connection/feature restrictions, removal of PBT and addition of verified `RPTKZ`
- Explicit `No optional feature required` choice on configurable gauge families, with mutually exclusive optional-feature selection
- Utility/process-gauge separation so chemical-seal requests appear only where applicable
- Assigned-representative `Accept Order` form for approved external acceptance types, conditional PO/payment references, acceptance date, internal verification note and optional private evidence metadata
- Explicit rejection of pricing, payment-card, banking, PIN and password information; the app does not process payments
- One atomic mock-service action that records acceptance, generates a permanent order reference, preserves immutable line snapshots, links the historical RFQ and routes the order to Planning
- Idempotent duplicate protection so repeated acceptance cannot create a second order
- Separate customer, assigned-representative and Planning notifications plus linked RFQ/order audit entries
- Customer-safe projections that retain the converted RFQ and new order while hiding internal acceptance evidence
- Fabricated `RQ-TEST-0006` seed record, already awaiting customer acceptance, for a quick Sales-to-Planning demonstration
- Updated API, OpenAPI, PostgreSQL, security and private-cloud handover proposals

## Included in version 2.9

- Assigned-representative `Mark as Quoted` workflow with quotation number, quotation date, optional expiry, Outlook email confirmation and separate internal/customer-facing notes
- Explicit rejection of quotation pricing fields in the customer-facing workflow
- Optional quotation document reference or upload metadata, with a separate customer-visibility authorisation; the mock preview never stores file bytes or invents a download link
- Recipient-specific in-app notifications for the customer and representative plus immutable workflow and audit-history entries
- Customer-only `I received the quotation` acknowledgement, changing the RFQ to `awaiting_customer_acceptance` without confirming price, payment, Purchase Order acceptance or creating an order
- Customer projections that omit internal notes and any quotation evidence not intentionally authorised for customer access
- Mock-service, workflow, permission and future-API adapter tests for valid and invalid quotation actions

## Included in version 2.8

- Validated RFQ submission context using the signed-in customer and authorised company
- Server-style representative validation that replaces client-supplied display details with the approved representative directory record
- Persistent mock RFQ sequence, permanent RFQ references, submission/assignment timestamps and customer/company snapshots
- Safe uploaded-document metadata, configured-line snapshots, customer notes, priority and submission audit history
- Single representative assignment notification with a dedicated assigned-RFQ inbox service
- Dedicated Sales Representative inbox with required status groups, search, priority filtering, RFQ age, emergency indicators and last activity
- Reusable workflow action panel plus a prominent `Start Review` action for newly assigned RFQs
- Clear customer success confirmation showing the permanent reference and assigned representative
- Representative-inbox, submission, isolation, notification and Start Review tests

## Included in version 2.7

- One reusable permission catalogue for Customer, Sales Representative, Planning, Expeditor, Dispatch, Buyer, Manager and Administrator
- Named workflow-action permissions enforced alongside the existing state, assignment, evidence and fulfilment guards
- Central role profiles for dashboard wording, default destinations and mobile navigation
- Strict service-level queues: Planning sees Planning stages, Expediting sees handed-over fulfilment stages, and Dispatch sees only handover stages
- Assigned-record scoping for representatives, own-company scoping for customers and wider operational visibility for Manager/Administrator
- Prepared but deliberately inactive Buyer workspace pending an approved procurement workflow
- Fabricated Buyer, Manager and Administrator test identities
- Permission, navigation, queue-isolation and denied-action audit tests

## Included in version 2.6

- Separate RFQ and order service resources while preserving the existing customer tracking design
- Versioned aggregate mock storage with automatic migration of legacy combined records
- Atomic same-browser RFQ conversion that creates exactly one linked order and immutable order-line/configuration snapshots
- Service-generated order IDs/references and duplicate-conversion protection
- Dedicated Sales, Planning, Expediting and Dispatch test workspaces using role- and stage-allowed actions
- Role-, company- and representative-scoped notification inbox with per-user read state
- Complete tested mock path from quotation through acceptance, Planning, Expediting, Dispatch and completion
- Separate API adapter methods for `/enquiries` and `/orders`
- Updated API/OpenAPI/PostgreSQL proposals, including immutable `order_items`

## Included in version 2.5

- Central RFQ and order state machine with controlled action codes instead of arbitrary status selection
- Exact role, assignment, required-field, comment, fulfilment and sequence guards for every transition
- Planning and Dispatch roles added alongside the existing customer, sales, expeditor, buyer, manager and administrator roles
- Optimistic record-version checks to stop stale workflow updates
- Customer-visible timeline projection that omits internal-only events
- Mock audit history and notification queue for successful and denied workflow actions
- API adapter routes prepared for enquiry/order workflow actions, notifications and audit history
- Valid/invalid transition tests plus updated OpenAPI, database and security documentation

### Included in version 2.4

- Replaceable asynchronous service layer for authentication, accounts, products, RFQs and tracking
- GitHub Pages remains on a browser-only mock service with fabricated records
- Prepared private-cloud HTTP service using secure cookies, CSRF protection, request IDs and idempotency keys
- Customer-company scoping in the mock and an explicit server-side tenant-isolation contract
- Shared validation at both the screen and service boundaries with friendly errors
- Initial proposed production roles and permissions
- Proposed PostgreSQL schema with row-level-security policies
- API contract, OpenAPI definition, security model and IT deployment handover

### Architecture and IT handover

- [Multi-interface architecture](docs/ARCHITECTURE.md)
- [Preview guide and demo accounts](docs/PREVIEW_GUIDE.md)
- [Product/platform matrix](docs/PLATFORM_MATRIX.md)
- [Role and preview permission matrix](docs/ROLE_PERMISSION_MATRIX.md)
- [Customer personalisation model](docs/CUSTOMER_PERSONALISATION.md)
- [Responsive testing checklist](docs/RESPONSIVE_TESTING.md)
- [Build, deployment and future packaging](docs/BUILD_AND_DEPLOYMENT.md)
- [Mock-mode limitations](docs/MOCK_MODE_LIMITATIONS.md)
- [Service architecture](docs/SERVICE-ARCHITECTURE.md)
- [Workflow state machine and transition flow](docs/WORKFLOW_STATE_MACHINE.md)
- [Order workflow phased implementation plan](docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md)
- [API endpoints and payloads](docs/API-CONTRACT.md)
- [OpenAPI specification](docs/api/openapi.yaml)
- [Production roles and company isolation](docs/SECURITY-AND-ROLES.md)
- [Proposed PostgreSQL schema](docs/database/postgresql-schema.sql)
- [Private-cloud requirements and deployment checklist](docs/PRODUCTION-DEPLOYMENT.md)

The normal `build` command creates the mock-only GitHub Pages preview. `build:production` creates a separate API-only candidate in ignored `dist-production/`; esbuild removes the mock service, demo accounts and public email fallback from that bundle. `runtime-config.js` contains only the public API URL and timeout—not a security mode or secret.

## Existing version 2.3 functionality

- Persistent same-browser RFQ and order history for each customer account
- Customer order tracking with progress, requested instruments and a full update timeline
- Expeditor test login with an oldest-update-first daily work queue
- Expeditor search by customer, representative, RFQ reference or PO number
- Role- and stage-controlled workflow actions plus customer-facing update notes
- Representative selection filtered to the nearest Rhomberg branch
- Branch representative codes sourced from the supplied salesperson export
- Light and dark themes retained on the device
- Softer, larger typography and refreshed mobile layouts
- Three clearly labelled, fabricated demonstration orders for workflow testing

## Existing catalogue and RFQ functionality

- Animated opening sequence and mobile app-style sign-in
- Eight catalogue categories and 82 product families/models
- Product images, specifications, datasheets and product-specific configuration paths
- PBB internal contacts limited to 100 mm, with Single/Dual and cable-length selection
- Quantity stored separately for every configured product line
- SANAS only for pressure instruments and Traceability only for temperature units
- Chemical-seal consultation hand-off instead of customer seal configuration
- Emergency, delivery/collection, nearest branch, application and Purchase Order workflow
- Branded multi-page RFQ PDF with complete configuration details
- Protected rep-only pricing engine based on `Pricelist 1 MARCH 2026.xlsx`
- Emergency, delivery, chemical-seal and unpriced special requirements flagged for representative assessment
- Public FormSubmit fallback that sends an unpriced RFQ PDF when the protected service is not connected
- Installable web-app manifest and offline static-asset cache

## Customer-data protection

The supplied historical customer exports were used only for private structure analysis. No exported customer record, contact detail, address or account information is copied into this public repository or browser bundle. Only the requested branch representative names and codes are included for the test selector.

## Pricing and email security

The public browser bundle never contains the price list. The secure `/api/submit-rfq` function loads the compressed price book from private host environment variables, produces a rep-only priced PDF, emails it to the fixed Rhomberg test recipient and returns only a delivery confirmation. It never returns prices to the client.

The private local price-book exports live in `private/`, which is ignored by Git. Do not remove that ignore rule and do not paste price values into `src/`, `app.js`, a public issue or a commit.

If the app is hosted only on GitHub Pages, it remains a static site and uses the unpriced FormSubmit test fallback. The first FormSubmit test requires one-time activation from the recipient inbox. The protected priced-PDF path requires a server-capable deployment such as Netlify.

## Protected test deployment variables

Configure these values in the deployment host, never in this repository:

- `RESEND_API_KEY`
- `RFQ_FROM_EMAIL` - a sender on a verified email domain
- `RFQ_TO_EMAIL` - currently `Ericuv@Rhom.co.za`
- `RFQ_ALLOWED_ORIGINS` - the deployed app URL
- `RHOMBERG_PRICEBOOK_GZIP_BASE64_1`
- `RHOMBERG_PRICEBOOK_GZIP_BASE64_2`

The two local price-book parts are generated from the supplied March 2026 workbook and stored in the ignored `private/` folder. The function joins and decompresses them at runtime. Email submission is restricted to five requests per IP/domain per minute.

## Build commands

- `npm run dev:customer-desktop` - serve the Connect desktop route with source watching
- `npm run dev:customer-mobile` - serve the Connect touch-first route with source watching
- `npm run dev:internal-mobile` - serve the supported Operations mobile roles
- `npm run dev:internal-desktop` - serve the full Operations desktop role set
- `npm run build:customer-desktop`, `build:customer-mobile`, `build:internal-mobile`, or `build:internal-desktop` - build one self-contained preview artifact
- `npm run build:previews` - build all four variants and stage the complete GitHub Pages artifact
- `npm run check` - compile-check the shared React source
- `npm test` - run existing and platform-split tests
- `npm run build:production` - generate and scan an API-only candidate in ignored `dist-production/`

## Important test limitations

- Use sample customer and PO data only while this repository is public.
- Mock accounts, passwords and tracked requests are local browser test records, not shared company accounts.
- An expeditor update is visible to a customer only when both roles are tested in the same browser profile.
- Price matching is an internal aid and always requires representative verification before a quotation.
- The production phase still needs domain authentication, a shared database, server-enforced workflow rules, encrypted file storage, durable audit/notification delivery, privacy terms and verified representative-to-client assignment.
