# Rhomberg Test App progress handoff

Use this form as the checkpoint for continuing the project on another computer.

## Checkpoint details

| Field | Value |
|---|---|
| Repository | `ShellyGames141up/Rhomberg-Test-App` |
| Branch | `agent/improve-theme-readability-and-reps` |
| App version | `4.0.0` |
| Checkpoint date | 27 July 2026 |
| Completed phase | Rhomberg Connect/Operations platform split and customer personalisation |
| Last stopping point | Four public preview interfaces share the existing Prompt 8 workflow. Customer onboarding/settings are complete; the next numbered RFQ-to-order phase has not been started. |
| Preview mode | GitHub Pages browser mock remains enabled |
| Production connection | Not connected; API and PostgreSQL material remain proposed contracts only |

## What changed in this checkpoint

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
| Shared operational fallback | `src/components/OperationalDashboard.jsx` |
| Automated tests | `tests/catalogue-rules.test.mjs`, `tests/rfq-inbox.test.mjs`, `tests/planning-queue.test.mjs`, `tests/expediting.test.mjs`, `tests/permissions.test.mjs`, `tests/workflow.test.mjs`, `tests/mock-services.test.mjs`, `tests/platform-previews.test.mjs`, `tests/run-tests.mjs` |
| Workflow documentation | `docs/WORKFLOW_STATE_MACHINE.md`, `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md` |
| Platform and deployment documentation | `docs/ARCHITECTURE.md`, `docs/PREVIEW_GUIDE.md`, `docs/PLATFORM_MATRIX.md`, `docs/ROLE_PERMISSION_MATRIX.md`, `docs/CUSTOMER_PERSONALISATION.md`, `docs/RESPONSIVE_TESTING.md`, `docs/BUILD_AND_DEPLOYMENT.md`, `docs/MOCK_MODE_LIMITATIONS.md` |
| Production proposals | `docs/API-CONTRACT.md`, `docs/api/openapi.yaml`, `docs/database/postgresql-schema.sql`, `docs/SECURITY-AND-ROLES.md`, `docs/PRODUCTION-DEPLOYMENT.md` |

## Validation completed at this checkpoint

| Check | Result |
|---|---|
| `npm test` | Passed for version 4.0: eight suites covering the existing workflow through Expediting plus preview routing, role separation, customer personalisation, validation and responsive guards |
| `npm run check` | Passed for 50 React/source modules and relative imports |
| `npm run check:css` | Passed |
| `npm run build:previews` | Passed; four standalone preview artifacts and the combined GitHub Pages artifact were generated |
| `npm run build:netlify` | Passed; the backward-compatible static preview was staged in `dist/` |
| `npm run build:production` | Passed; the API-only candidate was built without source maps and scanned for forbidden demo accounts, passwords and preview-only markers |
| Repository checks | `git diff --check` passed; React/App source contains no direct `localStorage` or `sessionStorage` calls |
| Browser interaction QA | Passed representative customer mobile/desktop, internal mobile/desktop, tablet and preview-centre checks; no console errors or document overflow were found. Full results are in `docs/RESPONSIVE_TESTING.md` |

## Known limitations and risks

- Browser mock data belongs to one device/browser and is not production authentication, concurrency or durability.
- The backend does not exist yet; the API, PostgreSQL, notification and audit structures are implementation proposals.
- Customer email/in-app notification delivery remains a mock queue until IT supplies the approved backend and email service.
- Outlook remains external. The preview records only fabricated confirmation/acceptance metadata and does not prove that an email, PO or payment was received.
- Quotation and acceptance uploads retain metadata only in mock mode. Production requires private object storage, malware scanning and an authorised download endpoint.
- Customer receipt acknowledgement is intentionally not commercial acceptance; the assigned representative must still record verified external evidence with `Accept Order`.
- Mock atomic/idempotent behavior is a same-browser demonstration. Production requires an RFQ row lock, unique source-RFQ order constraint, idempotency record and one database transaction.
- The proposed Expediting steps now work in mock mode, but the owner must approve the production step list, required-for-Dispatch subset and whether steps vary by product/location.
- Expediting document/image fields store metadata references only. Real uploads require private object storage, malware scanning and approved visibility/download rules.
- Generated order-summary PDFs, delivery retries and retention/archive jobs are not implemented yet.
- PO-exception authority is modelled and audited, but the owner/IT must still define which staff permissions or approval records authorise that exception in production.
- Planning reference options use fabricated mock accounts/branches; production must resolve active staff and location scope from authoritative directories.

## Recommended next phase

After owner review of the four previews and customer setup, continue the next approved RFQ-to-order prompt. Do not start another numbered workflow phase automatically. Dispatch, PDF/email delivery and retention remain later controlled phases.

## Continue on the home PC

After cloning the private repository or opening the existing clone:

```powershell
git fetch origin
git switch agent/improve-theme-readability-and-reps
git pull --ff-only
npm install
npm test
```

Then read this file, `docs/WORKFLOW_STATE_MACHINE.md` and the Expediting/next-phase sections of `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md`.
