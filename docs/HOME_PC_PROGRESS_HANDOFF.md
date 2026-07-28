# Rhomberg Test App progress handoff

Use this form as the checkpoint for continuing the project on another computer.

## Checkpoint details

| Field | Value |
|---|---|
| Repository | `ShellyGames141up/Rhomberg-Test-App` |
| Branch | `feature/prompt-12-pdf-sharing` |
| App version | `4.4.0` |
| Checkpoint date | 28 July 2026 |
| Completed phase | Prompt 12 PDF download and email sharing |
| Last stopping point | Branded customer-safe and internal operational PDFs, preview/download, simulated email sharing, recipient confirmation and audit events are complete in mock mode. Stop before the next approved prompt. |
| Preview mode | GitHub Pages browser mock remains enabled |
| Production connection | Not connected; API and PostgreSQL material remain proposed contracts only |

## What changed in this checkpoint

- Added real multi-page Rhomberg order-summary PDF generation using `pdf-lib`.
- Added separate allow-listed customer-safe and internal operational document models.
- Added preview, download and fresh-copy controls to Planning, Expediting, Dispatch and management order details.
- Added manual, assigned-representative and authorised-internal recipient modes.
- Added recipient email validation, explicit external confirmation and a prohibition on sending internal copies externally.
- Added simulated `email_sent` delivery without making a network email call.
- Added immutable audit events for every generation and simulated send.
- Added future private-storage, Microsoft 365/SMTP and transactional-outbox API contracts.
- Added PDF privacy, permission, email-validation, byte-stream and audit tests.

- Added one desktop-optimised Dispatch workspace with responsive mobile/tablet cards, queue KPIs, search, status/method filters and sorting.
- Added structured collection, company delivery, courier and third-party delivery methods with route-specific state-machine guards.
- Added ready, out-for-delivery, collection/delivery confirmation, completion and delivery-problem actions through the service layer.
- Added ready/collection/delivery dates, driver/courier, tracking, packages, delivery note, recipient/collector, proof metadata, public messages and separate internal notes.
- Added Dispatch workflow/audit history and customer/representative notifications for each approved customer-visible milestone.
- Added customer projections that remove internal Dispatch notes, problem details, internal actor IDs and unauthorised proof information.
- Added fabricated handed-off, collection and delivery records for demonstration; no real company/customer data was introduced.
- Added mock/API Dispatch workspace contracts, proposed PostgreSQL tables/RLS, private upload requirements and a dedicated test suite.

- Added one central notification event catalogue covering every approved RFQ/order milestone through completion/cancellation.
- Added recipient-specific messages, per-user read state, mark-all, deep links, preferences and role-gated simulated-delivery retries.
- Added exact in-app/email/push delivery statuses plus retry attempt/error/timestamp metadata without contacting a provider.
- Enforced customer-company and representative-assignment isolation before preference filtering.
- Added notification creation/read/read-all/preference/retry audit entries.
- Expanded the shared notification centre for customer/internal mobile and desktop previews without changing the visual identity.
- Added interchangeable mock/API notification services and shared validation.
- Added proposed API, PostgreSQL outbox, Microsoft 365/SMTP and APNs/FCM requirements.
- Added a dedicated notification test suite and expanded API-adapter coverage.

- Split the public experience into Connect customer desktop/mobile and Operations internal mobile/desktop routes without copying business logic.
- Added a responsive preview centre, role-filtered demo accounts and strict route-entry role gates.
- Added a ten-step customer-only personalisation wizard plus editable account settings.
- Added protected presets/custom colour validation, scalable font and density choices, appearance mode, mock identity images and notification preferences.
- Staged image removal with the settings draft so Cancel preserves saved identity images and unused mock uploads are cleaned safely.
- Added interchangeable mock/API personalisation services, account/company isolation and audit entries.
- Added four development/build commands, combined GitHub Pages staging and production-preview exclusion scans.
- Added platform, role, preview, personalisation, responsive, packaging and mock-limit documentation.
- Preserved the complete Prompt 8 Expediting workflow and existing automated coverage.

- Added one dedicated responsive Expeditor workspace for desktop and mobile without creating a separate app.
- Added new/in-progress/on-hold/due-soon/awaiting-Dispatch/priority queue views, oldest-update-first default sorting and search across customer, representative, RFQ, order, job and PO references.
- Added a central configurable Expediting step catalogue and an interchangeable `expediting.getWorkspaceOptions()` mock/API service contract.
- Added reusable Start, Progress Update, Hold, Resume and Dispatch Hand-off forms with separate customer message, internal note, estimate, delay reason and controlled document/image reference metadata.
- Added same-status `add_expediting_update` workflow events so operational progress is immutable without falsifying the top-level order stage.
- Added required-for-Dispatch completion validation plus an audited authorised-exception reason/reference path.
- Added fabricated new, active, held and handed-off Expediting orders for immediate demonstration.
- Added customer and assigned-representative timeline/notification behavior for every public update, with a separate Dispatch notification at hand-off.
- Removed Expediting internal notes, delay/reference details, internal actor IDs and exception evidence from customer projections.
- Kept handed-off orders visible read-only in the Expeditor queue while they are `awaiting_dispatch`.
- Added Expediting queue, permission, progress, hold/resume, visibility, hand-off and API-adapter tests.
- Updated API/OpenAPI, PostgreSQL, service architecture, workflow, security, deployment and implementation-plan documentation for the new Expediting contract.
- Bumped the preview to version 3.2 and refreshed the offline-cache revision.

- Added a dedicated desktop-optimised Planning dashboard in the same responsive app, with a wide operational queue and phone/tablet card layouts.
- Added queue search, stage/priority filters, five sort modes, age/last-activity calculations and visible order/RFQ/customer/rep/PO/emergency/line-item context.
- Added fabricated orders in `awaiting_planning`, `planning_in_progress` and `planned` for immediate demonstration.
- Added `planning.getWorkspaceOptions()` to both mock and future API services for authorised Planning users, recognised branch/locations and controlled priorities.
- Added a reusable structured Planning form for job number, customer PO or authorised exception, notes, schedule, Planning owner, location, priority, document references and submission date.
- Added shared validation plus independent state-machine guards, including assigned-representative, date, priority, PO-exception and hand-off checks.
- Added Planning actor/timestamp fields, audit history and separate customer, representative and Expeditor notification wording.
- Removed the internal Planning record, compatibility job/PO fields and Planning actor metadata from customer projections.
- Added Planning queue, state-machine, service, API adapter, audit, notification and projection tests.
- Updated API/OpenAPI, PostgreSQL, service architecture, workflow, security, deployment and implementation-plan documentation.
- Bumped the preview to version 3.1 and prepared a new offline-cache revision.

- Corrected catalogue configuration rules from the supplied product notes, including gauge materials, sizes, ranges, connections, feature availability, removal of PBT and addition of the verified `RPTKZ` model.
- Added `No optional feature required` and mutually exclusive optional-feature behavior, and limited chemical-seal requests to applicable process gauges.
- Added the assigned-only `Accept Order` form with approved acceptance type, conditional Purchase Order/payment reference, date, required internal note, verification and optional private supporting evidence.
- Explicitly reject pricing plus payment-card, banking, PIN and password fields; no payments are processed in the app.
- Made acceptance/conversion one compound service operation. The direct `convert_to_order` step is internal-only.
- Generate a permanent order reference and immutable configured-line snapshots, link both records, keep the RFQ in history and place the order in `awaiting_planning`.
- Return the same linked order on a repeated acceptance request so duplicate clicks cannot create duplicate orders.
- Added linked acceptance/conversion/order audit entries and role-specific customer, assigned-representative and Planning notifications.
- Hide acceptance evidence, internal notes and accepting-user details from customer projections.
- Added fabricated `RQ-TEST-0006`, already awaiting customer acceptance, so the Sales-to-Planning conversion can be demonstrated immediately.
- Hardened native quotation and acceptance date inputs for mobile date pickers and normal browser input events.
- Added catalogue-rule, conditional-field, sensitive-data, assignment, company-isolation, idempotency, audit, notification and API multipart tests.
- Updated the service, workflow, API/OpenAPI, PostgreSQL, role/security and private-cloud deployment documentation.
- Bumped the preview to version 3.0 and refreshed the offline cache.

## Main files to review

| Area | Files |
|---|---|
| Preview split and routes | `src/shared/platform/previewConfig.js`, `src/apps/PreviewLanding.jsx`, `preview/*/index.html` |
| Customer personalisation | `src/apps/customer/CustomerPersonalisation.jsx`, `src/shared/personalisation/personalisation.js` |
| Notification domain and UI | `src/domain/notifications.js`, `src/components/Notifications.jsx` |
| Notification implementation | `src/services/mock/createMockServices.js`, `src/services/api/createApiServices.js`, `src/services/validation.js` |
| Preview build tooling | `scripts/build-tools.mjs`, `scripts/build-preview.mjs`, `scripts/build-previews.mjs`, `scripts/dev-preview.mjs`, `scripts/build-production.mjs` |
| Catalogue rules | `src/data/catalogue.js`, `src/domain/productConfiguration.js`, `src/components/Configurator.jsx` |
| Workflow source of truth | `src/domain/workflow.js` |
| Mock service and persistence | `src/services/mock/createMockServices.js`, `src/services/mock/seedData.js` |
| Future API adapter | `src/services/api/createApiServices.js` |
| Roles, navigation and scope | `src/services/contracts.js`, `src/domain/accessControl.js` |
| Shared validation | `src/services/validation.js` |
| React integration | `src/App.jsx`, `src/components/SalesRepresentativeDashboard.jsx`, `src/components/WorkflowActionPanel.jsx`, `src/components/OrderTracking.jsx` |
| Planning workspace | `src/components/PlanningDashboard.jsx`, `src/components/PlanningFields.jsx`, `src/domain/planningQueue.js` |
| Expeditor workspace | `src/components/ExpeditorDashboard.jsx`, `src/components/ExpeditingFields.jsx`, `src/domain/expediting.js` |
| Dispatch workspace | `src/components/DispatchDashboard.jsx`, `src/components/DispatchFields.jsx`, `src/domain/dispatch.js` |
| Shared operational fallback | `src/components/OperationalDashboard.jsx` |
| Automated tests | `tests/dispatch.test.mjs`, `tests/notifications.test.mjs` plus the existing catalogue, permissions, RFQ inbox, Planning, Expediting, workflow, mock service and preview suites |
| Workflow documentation | `docs/WORKFLOW_STATE_MACHINE.md`, `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md` |
| Platform and deployment documentation | `docs/ARCHITECTURE.md`, `docs/PREVIEW_GUIDE.md`, `docs/PLATFORM_MATRIX.md`, `docs/ROLE_PERMISSION_MATRIX.md`, `docs/CUSTOMER_PERSONALISATION.md`, `docs/RESPONSIVE_TESTING.md`, `docs/BUILD_AND_DEPLOYMENT.md`, `docs/MOCK_MODE_LIMITATIONS.md` |
| Production proposals | `docs/NOTIFICATION_SYSTEM.md`, `docs/API-CONTRACT.md`, `docs/api/openapi.yaml`, `docs/database/postgresql-schema.sql`, `docs/SECURITY-AND-ROLES.md`, `docs/PRODUCTION-DEPLOYMENT.md` |

## Validation completed at this checkpoint

| Check | Result |
|---|---|
| `npm test` | Passed for version 4.4: PDF privacy/generation/sharing/audit plus Dispatch, customer timeline, notification and all existing suites |
| In-app browser QA | Passed: manager audit navigation and event rendering, customer-only company records, sanitised customer timeline, and desktop preview watermark placement |
| `npm run check` | Passed for 54 React/source modules and relative imports |
| `npm run check:css` | Passed |
| `npm run build:previews` | Passed; four standalone preview artifacts and the combined GitHub Pages artifact were generated |
| `npm run build:netlify` | Passed; the backward-compatible static preview was staged in `dist/` |
| `npm run build:production` | Passed; the API-only candidate was built without source maps and scanned for forbidden demo accounts, passwords and preview-only markers |
| Repository checks | `git diff --check` passed; React/App source contains no direct `localStorage` or `sessionStorage` calls |
| Browser interaction QA | Passed the Dispatch queue/detail workflow at 1280 × 720 and its single-column responsive layout at 390 × 844; no console errors or horizontal document overflow were found |

## Known limitations and risks

- Browser mock data belongs to one device/browser and is not production authentication, concurrency or durability.
- The backend does not exist yet; the API, PostgreSQL, notification and audit structures are implementation proposals.
- In-app delivery is functional only in this browser. Email and push statuses/retries are simulations until IT supplies the approved backend, worker and providers.
- Outlook remains external. The preview records only fabricated confirmation/acceptance metadata and does not prove that an email, PO or payment was received.
- Quotation and acceptance uploads retain metadata only in mock mode. Production requires private object storage, malware scanning and an authorised download endpoint.
- Customer receipt acknowledgement is intentionally not commercial acceptance; the assigned representative must still record verified external evidence with `Accept Order`.
- Mock atomic/idempotent behavior is a same-browser demonstration. Production requires an RFQ row lock, unique source-RFQ order constraint, idempotency record and one database transaction.
- The proposed Expediting steps now work in mock mode, but the owner must approve the production step list, required-for-Dispatch subset and whether steps vary by product/location.
- Expediting document/image fields store metadata references only. Real uploads require private object storage, malware scanning and approved visibility/download rules.
- Dispatch proof fields store safe metadata only in mock mode. No file bytes, courier integration, mapping, signature capture or legal proof-of-delivery process is connected.
- The production owner must approve Dispatch methods, branch/address access, mandatory completion evidence and proof-retention periods.
- Generated order-summary PDFs, delivery retries and retention/archive jobs are not implemented yet.
- PO-exception authority is modelled and audited, but the owner/IT must still define which staff permissions or approval records authorise that exception in production.
- Planning reference options use fabricated mock accounts/branches; production must resolve active staff and location scope from authoritative directories.

## Recommended next phase

Continue only with the next approved prompt. Do not connect Microsoft 365/SMTP, APNs/FCM or a production database without an approved IT phase. PDF generation, real delivery workers and retention remain later controlled work.

## Continue on the home PC

After cloning the private repository or opening the existing clone:

```powershell
git fetch origin
git switch agent/improve-theme-readability-and-reps
git pull --ff-only
npm install
npm test
```

Then read this file, `docs/DISPATCH_WORKSPACE.md`, `docs/WORKFLOW_STATE_MACHINE.md` and the next-phase sections of `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md`.
