# Rhomberg Test App progress handoff

Use this form as the checkpoint for continuing the project on another computer.

## Checkpoint details

| Field | Value |
|---|---|
| Repository | `ShellyGames141up/Rhomberg-Test-App` |
| Branch | `agent/improve-theme-readability-and-reps` |
| App version | `2.6.0` |
| Checkpoint date | 23 July 2026 |
| Completed phase | Separate mock RFQ/order workflow and role-workspace integration |
| Last stopping point | The mock happy path now runs from assigned RFQ through Planning, Expediting, Dispatch and completion. Production PDFs, durable notification delivery and retention are next. |
| Preview mode | GitHub Pages browser mock remains enabled |
| Production connection | Not connected; API and PostgreSQL material remain proposed contracts only |

## What changed in this checkpoint

- Separated RFQs and orders behind distinct `enquiries` and `orders` service contracts.
- Replaced the legacy combined mock array with one versioned workflow aggregate containing separate RFQ/order collections.
- Added automatic migration of existing version-2 combined browser records without clearing the user's demo data.
- Implemented atomic mock conversion: the accepted RFQ is linked and completed while one separate `awaiting_planning` order is created in the same aggregate write.
- Added immutable order-line and configuration snapshots plus a separate `order.created_from_rfq` audit event.
- Removed the user-entered order identifier; the service generates the order ID/reference and rejects repeat conversion.
- Added fabricated Sales, Planning and Dispatch test logins alongside Customer and Expeditor.
- Reused the established internal-card design for role-specific Sales, Planning, Expediting and Dispatch workspace copy/actions.
- Added a notification inbox accessed only through the service layer, including company/role/representative scoping and independent per-user read state.
- Retired migrated legacy session keys and added a regression check so sign-out cannot restore an older staff session.
- Kept customer tracking visually unchanged while feeding it separate RFQ and order records.
- Removed Expeditor access to RFQs because Expediting now works only on orders handed over by Planning.
- Expanded integration tests through quotation, acceptance, conversion, planning, expediting, collection dispatch and completion.
- Updated the service, workflow, API, OpenAPI and proposed PostgreSQL documentation, including immutable `order_items`.

## Main files to review

| Area | Files |
|---|---|
| Workflow source of truth | `src/domain/workflow.js` |
| Presentation helpers | `src/domain/tracking.js` |
| Mock service and persistence | `src/services/mock/createMockServices.js`, `src/services/mock/seedData.js` |
| Future API adapter | `src/services/api/createApiServices.js` |
| Roles and validation | `src/services/contracts.js`, `src/services/validation.js` |
| React integration | `src/App.jsx`, `src/components/ExpeditorDashboard.jsx`, `src/components/Notifications.jsx`, `src/components/OrderTracking.jsx`, `src/components/Layout.jsx` |
| Automated tests | `tests/workflow.test.mjs`, `tests/mock-services.test.mjs`, `tests/run-tests.mjs` |
| Workflow documentation | `docs/WORKFLOW_STATE_MACHINE.md`, `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md` |
| Production proposals | `docs/API-CONTRACT.md`, `docs/api/openapi.yaml`, `docs/database/postgresql-schema.sql`, `docs/SECURITY-AND-ROLES.md` |

## Validation completed at this checkpoint

| Check | Result |
|---|---|
| `npm test` | Passed: controlled transition, mock persistence, audit, notification, company-isolation and API-adapter tests |
| `npm run check` | Passed: React source compiled |
| `npm run check:css` | Passed: stylesheet compiled |
| `npm run build` | Passed: GitHub Pages mock bundle rebuilt |
| `npm run build:netlify` | Passed: public static deployment package staged successfully |
| `npm run build:production` | Passed: API-only candidate built and secret-marker scan passed |
| Mobile browser QA | Passed: Sales workflow action, customer notification/read state and sign-out migration verified at 390 × 844 with no console warnings or errors |

## Known limitations and risks

- The browser mock still stores demo data on one device and is not production authentication or security.
- The backend does not exist yet; the API, PostgreSQL, notification and audit structures are implementation proposals.
- The single browser aggregate makes conversion atomic for a same-device demo only; the backend must reproduce it as one database transaction with locking and idempotency.
- The test workspaces demonstrate roles and transitions but are not production identity, authorisation or multi-device collaboration.
- Customer email/in-app notification delivery remains a mock queue until IT supplies the approved backend and email service.
- The current order stages are high-level; detailed production milestones still require owner approval before being added.
- Generated order-summary PDFs, delivery retries and retention/archive jobs are not implemented yet.

## Recommended next phase

Begin the controlled Phase 6 mock/API contract work from `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md`:

1. Agree the unpriced order-summary PDF fields and authorised internal recipients.
2. Add PDF download/email actions through the service layer, with audit events.
3. Model notification delivery attempts and retry states without connecting real email.
4. Agree configurable retention periods, archive eligibility and legal-hold rules.
5. Keep all implementation in mock mode until the owner and IT approve the contracts.

## Continue on the home PC

After cloning the private repository or opening the existing clone:

```powershell
git fetch origin
git switch agent/improve-theme-readability-and-reps
git pull --ff-only
npm install
npm test
```

Then read this file, `docs/WORKFLOW_STATE_MACHINE.md` and the Phase 6 section of `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md`.
