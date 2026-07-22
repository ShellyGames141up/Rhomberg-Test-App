# Rhomberg Test App progress handoff

Use this form as the checkpoint for continuing the project on another computer.

## Checkpoint details

| Field | Value |
|---|---|
| Repository | `ShellyGames141up/Rhomberg-Test-App` |
| Branch | `agent/improve-theme-readability-and-reps` |
| App version | `2.5.0` |
| Checkpoint date | 22 July 2026 |
| Completed phase | Central RFQ and order workflow state machine |
| Last stopping point | Phase 1 is complete. Phase 2 has not been started. |
| Preview mode | GitHub Pages browser mock remains enabled |
| Production connection | Not connected; API and PostgreSQL material remain proposed contracts only |

## What changed in this checkpoint

- Added one authoritative workflow module for RFQs and orders.
- Added the required RFQ and order statuses, labels, customer/internal descriptions and visibility rules.
- Defined each allowed action with its permitted roles, required fields, comment rule, notification rule and timestamp.
- Prevented raw status selection in React; the interface now submits a named workflow action through the service layer.
- Enforced representative assignment, accepted-order, Planning handoff, Expediting handoff, Dispatch and fulfilment rules.
- Added optimistic version checking so an old screen cannot overwrite a newer workflow state.
- Added manager/administrator override rules with mandatory reason and audit comment. The override is intentionally not exposed in the current UI.
- Added mock audit-history and notification records for workflow actions.
- Added a customer-safe timeline projection that hides internal-only workflow events.
- Migrated old mock status values into the new controlled status model when the preview starts.
- Added `planning` and `dispatch` to the production role model.
- Updated the API adapter to use `/workflow-actions` endpoints instead of arbitrary status updates.
- Updated the OpenAPI proposal, PostgreSQL proposal, role/security model, service architecture and deployment checklist.
- Rebuilt the tracked GitHub Pages JavaScript bundle.

## Main files to review

| Area | Files |
|---|---|
| Workflow source of truth | `src/domain/workflow.js` |
| Presentation helpers | `src/domain/tracking.js` |
| Mock service and persistence | `src/services/mock/createMockServices.js`, `src/services/mock/seedData.js` |
| Future API adapter | `src/services/api/createApiServices.js` |
| Roles and validation | `src/services/contracts.js`, `src/services/validation.js` |
| React integration | `src/App.jsx`, `src/components/ExpeditorDashboard.jsx`, `src/components/OrderTracking.jsx` |
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

## Known limitations and risks

- The browser mock still stores demo data on one device and is not production authentication or security.
- Legacy preview data still uses one combined enquiry/order-shaped record internally. The controlled `workflowType` now distinguishes the workflow, but separate RFQ and order aggregates are a future phase.
- The backend does not exist yet; the API, PostgreSQL, notification and audit structures are implementation proposals.
- Sales, Planning and Dispatch do not yet have dedicated production workspaces or complete demo login journeys.
- RFQ-to-order conversion is defined and guarded, but the future backend must create the order and convert the RFQ atomically.
- Customer email/in-app notification delivery remains a mock queue until IT supplies the approved backend and email service.
- A full browser-based visual regression pass should be repeated when role-specific screens are introduced.

## Recommended next phase

Begin Phase 2 from `docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md`:

1. Separate RFQs and orders into distinct mock service records and contracts.
2. Implement atomic mock RFQ-to-order conversion through the workflow service.
3. Add role-specific Sales, Planning and Dispatch mock workspaces without changing the existing customer design.
4. Add notification-inbox presentation through the notification service.
5. Expand company/representative assignment and cross-role integration tests.

Do not connect a production database during that phase.

## Continue on the home PC

After cloning the private repository or opening the existing clone:

```powershell
git fetch origin
git switch agent/improve-theme-readability-and-reps
git pull --ff-only
npm install
npm test
```

Then read this file and `docs/WORKFLOW_STATE_MACHINE.md` before starting Phase 2.
