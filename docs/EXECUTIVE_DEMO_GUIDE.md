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
3. Use **Next step** while completing the action in the normal workspace.
4. Switch roles at a workflow handover.
5. Open Records/Documents, Notifications or Audit History when available.
6. Use Presentation Mode to reduce preview chrome.
7. Use Restart Scenario to return to the first guidance step.

The control progress is a presenter guide. It does not bypass the workflow state machine or complete business actions automatically.

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
- Clearing browser site data removes all browser-local changes.

## Mock Limitations

- No cross-browser or cross-device synchronisation.
- No real authentication, database, email, push or document storage.
- No production security boundary.
- Simulated uploads and deliveries.
- Browser-local reset and audit history are not permanent evidence.

## Production Exclusion

The production build aliases the executive-demo React module to an empty production module, omits the `/demo/` route, excludes mock services and scans the output for executive warning/scenario markers. Demo accounts, passwords, role switching and reset controls must never be enabled by a production API.
