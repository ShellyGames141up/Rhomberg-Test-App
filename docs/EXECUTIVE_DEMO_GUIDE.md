# Executive Workflow Demo Guide

## Purpose

The Executive Workflow Demo is an internal presentation experience for management and IT review. It uses fabricated browser-local data only. It is not a production environment and must not receive real customer or employee information.

Launch: `https://shellygames141up.github.io/Rhomberg-Test-App/demo/executive-workflow/`

Permanent warning: **Executive Demo Mode - Fabricated Data Only**

## Available Scenarios

| Scenario | Demonstrates |
| --- | --- |
| Standard order journey | Customer RFQ through Sales, Planning, Expediting, QA, Dispatch and completion |
| SANAS calibration journey | Pressure instrument routing, physical-unit work and unit certificates |
| Traceable calibration journey | Temperature instrument routing and Traceable certificates |
| QA failure and rework | QA finding, internal rework, reinspection and release |
| Rejected or amended quotation | Quotation receipt, follow-up and the acceptance boundary |
| Management dashboard | Operational measures, exceptions, reports and audit access |
| Department dashboard tour | Controlled switching between internal workspaces |

## Role Switcher

The route can switch between fabricated Customer, Sales Representative, Sales Manager, Company Owner, Planning, Laboratory User, Laboratory Manager, Expeditor, Quality Assurance, Dispatch and Administrator accounts.

Role switching:

- uses the mock service rather than changing a React role value;
- creates an immutable demonstration audit entry;
- reloads records through the same service and company-scope rules;
- opens the role's normal dashboard and navigation;
- preserves the selected scenario and step after refresh.

The active role, Customer/Internal product, workflow stage, current step and recommended next step remain visible in the presenter controls.

## Presenter Controls

1. Select a scenario.
2. Select the first role.
3. Choose **Full application** or **Device preview**.
4. In Device preview, choose Phone, Tablet or Desktop.
5. Use **Next step** while completing the action in the normal workspace.
6. Switch roles at a workflow handover.
7. Open Records/Documents, Notifications or Audit History when available.
8. Use Presentation Mode to reduce preview chrome.
9. Use Restart Scenario to return to the first guidance step.

The control progress is a presenter guide. It does not bypass the workflow state machine or complete business actions automatically.

The top control bar can be collapsed so the application receives the usable viewport. Its expanded state is presentational only. The selected scenario, step, layout mode and device frame are persisted through the mock service.

## Layout Modes

### Full Application

This is the default on tablet and desktop. The current role uses the available width. At desktop sizes Customer and Operations workspaces use a persistent left navigation rail, wide content column, horizontal filters and role-appropriate tables/queues.

### Device Preview

This intentionally centres a constrained frame:

- Phone: 390 px
- Tablet: 768 px
- Desktop: up to 1440 px

The frame contracts if the presenter viewport is smaller. Phone and tablet selections activate matching internal reflow rules rather than merely squeezing desktop content into a narrow container.

## Fabricated Accounts

| Role | Username | Password |
| --- | --- | --- |
| Customer | `customer.demo@example.invalid` | `Demo123!` |
| Sales Representative | `sales.workflow@example.invalid` | `Sales123!` |
| Sales Manager | `sales.manager@example.invalid` | `SalesManager123!` |
| Company Owner | `owner.workflow@example.invalid` | `Owner12345!` |
| Planning | `planning.workflow@example.invalid` | `Planning123!` |
| Laboratory User | `laboratory.workflow@example.invalid` | `Lab12345!` |
| Laboratory Manager | `laboratory.manager@example.invalid` | `LabManager123!` |
| Expeditor | `expeditor.workflow@example.invalid` | `Expedite123!` |
| Quality Assurance | `quality.workflow@example.invalid` | `Quality123!` |
| Dispatch | `dispatch.workflow@example.invalid` | `Dispatch123!` |
| Administrator | `administrator.workflow@example.invalid` | `Admin123!` |

The role switcher does not display passwords because it selects only pre-seeded fabricated accounts through the mock service. Normal preview login screens still document the appropriate credentials.

## Reset Behaviour

- **Restart Scenario** resets presenter progress only.
- The Administrator **Reset fabricated data** control restores seeded workflows, notifications, document registrations and audit records in the current browser.
- Refresh preserves the current scenario and signed-in fabricated role.
- Refresh preserves Full Application/Device Preview and the selected device frame.
- Clearing browser site data removes all browser-local changes.

## Mock Limitations

- No cross-browser or cross-device synchronisation.
- No real authentication, database, email, push or document storage.
- No production security boundary.
- Simulated uploads and deliveries.
- Browser-local reset and audit history are not permanent evidence.

## Production Exclusion

The production build aliases the executive-demo React module to an empty production module, omits the `/demo/` route, excludes mock services and scans the output for executive warning/scenario markers. Demo accounts, passwords, role switching and reset controls must never be enabled by a production API.
# Laboratory demonstration scenarios

The Executive Demo includes a detailed Cape Town Pressure journey, Cape Town Temperature journey and Johannesburg Pressure branch-isolation journey. Use fabricated data only. Demonstrate receipt and equilibrium, controlled booking, method/standard selection, structured readings, calculation warning, management review, physical Dispatch transfer, draft/unsigned PDFs, externally signed upload and explicit customer release. Emphasise that managers review evidence without rewriting technician readings and that customer views exclude raw data, internal notes, calculations and audit details.

# RFQ Technical Support scenario

Choose **RFQ Technical Support** to present the Representative request, one-time 24-hour extension, Technical queue, routed customer information request, in-app correspondence, recommendation, completion, quotation unblock and management measures. Use fabricated accounts only; attachment bytes are not retained in the preview.
# Sales visit scenarios

`Sales Representative Client Visit` demonstrates the Clients page, monthly coverage, appointment, fabricated geofence, customer/QR confirmation, verification score and Sales Manager update. `Missed Client Visit` demonstrates expiry, immutable missed event, warning, manager drill-down and rescheduling without overwriting the original appointment.
# Simplified Laboratory launch demonstration

Use the fabricated Laboratory Manager preview. Show a SANAS/Traceable order in Active, open the unit recipient snapshot, upload a fabricated PDF per physical unit, confirm the task remains active until every unit is complete, then open Completed Certificates. Switch to the fabricated customer to show the safe notification and company-scoped download. Do not demonstrate technician worksheets or calculations as launch functionality.
