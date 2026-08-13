# Role and preview access matrix

## Application surface authority

`src/shared/platform/applicationAccess.js` is the single normal-route device-access authority. Customer, Sales Representative, Expeditor and Manager are active on Desktop and Mobile. Planning, Dispatch, Laboratory roles, QA roles, Technical Advisor, Technical Director, Sales Manager, Company Owner and Administrator are active on Desktop only. Buyer is Desktop prepared/inactive. This surface matrix does not replace the permission matrix below; service permissions still decide which records and workflow actions an authenticated account may use.

Accounts may hold multiple roles; effective permissions are data-driven and never depend on an employee name. New definitions include `branch_manager`, `technical_manager`, `laboratory_manager_pressure` and `laboratory_manager_temperature`. Branch Manager reads remain constrained by authorised company and branch scope. Technical Manager receives Technical Support queue, assignment, correspondence, escalation and reporting capabilities. Discipline-specific Laboratory Manager roles receive certificate review and release only within authorised Laboratory scope.

Retention controls are internal-only. Managers and Administrators can search archive records, archive eligible completed orders, restore, export and manage legal holds. Only Administrators can alter demonstration retention settings. No browser role can permanently delete an order.

The canonical permission catalogue remains `src/services/contracts.js`. This document summarises preview access; it does not replace the code or server policy.

Management oversight requires `view_reports`. Representative reassignment, workflow-override approval, archival approval and report export use the separate permissions `reassign_representative`, `approve_workflow_override`, `approve_archival` and `export_operational_reports`. A wider management role can also carry an explicit `authorisedCompanyIds` restriction; broad role naming never bypasses that list.

| Role | Connect | Operations mobile | Operations desktop | Record scope |
| --- | :---: | :---: | :---: | --- |
| Customer | Yes | No | No | Authorised company only |
| Sales representative | No | Yes | Yes | Assigned RFQs/orders |
| Sales manager | No | Yes | Yes | Representative-focused scope authorised by management policy |
| Company owner | No | Yes | Yes | Company-wide pricing-safe operational scope |
| Planning | No | No | Yes | Planning-stage queue |
| Expeditor | No | Yes | Yes | Expediting-stage queue |
| Laboratory user | No | No | Yes | SANAS/Traceable queue and unit records only |
| Laboratory manager | No | No | Yes | Laboratory queue, archive and reporting controls |
| Quality Assurance | No | No | Yes | Non-Laboratory QA queue only |
| Quality manager | No | No | Yes | QA queue and process-trend reporting |
| Dispatch | No | No | Yes | Dispatch-stage queue |
| Buyer | No | No | Prepared/inactive | No active operational queue |
| Manager | No | Yes | Yes | Approved wider operational scope |
| Administrator | No | No | Yes | Full approved administrative scope |

## Defence in depth

1. Preview configuration filters which demo accounts are shown.
2. Sign-in rejects roles unsupported by the selected preview.
3. Navigation comes from central role profiles.
4. Service methods scope records by company, representative or queue.
5. Workflow transitions enforce role, permission, assignment, current state and evidence.
6. Production PostgreSQL row-level security provides an additional tenant boundary.

Customer projections must continue to remove internal notes, protected pricing, internal actor IDs, Planning detail, exception evidence and staff-only document metadata.

## Representative-loaded order permissions

| Capability | Customer | Sales representative | Sales manager | Generic manager | Planning / Expediting / Lab / QA / Dispatch / Buyer | Administrator |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Open **Load Customer Order** | No | Assigned scope | Authorised wider scope | No | No | Yes |
| Select another dedicated representative | No | No | Authorised scope | No | No | Yes |
| Set internal priority/urgency | No | Yes | Yes | Existing authorised internal controls | Existing authorised queue controls | Yes |
| Download current customer quotation/PO | Own company | Assigned order | Authorised scope | Authorised scope | Authorised queue/order | Yes |
| Replace quotation/PO version | No | Assigned order | No by default | No | No | Yes |

The reusable permission codes are `load_customer_order`, `download_order_source_document` and `replace_order_source_document`. Navigation, forms and service methods consume these permissions; components do not compare role names for these actions. Customer requests containing urgency fields are rejected even if UI controls are bypassed.

## Dispatch permissions

The Dispatch desktop workspace is selected centrally by `usesDispatchWorkspace()`, not by component role comparisons. `view_dispatch_queue` scopes records to Dispatch-owned stages; `confirm_collection` permits collection release/confirmation/completion; `confirm_delivery` permits delivery release/problem/confirmation/completion; `manage_order_hold` remains independent.

Managers and Administrators may perform those actions only because the central permission catalogue grants the named capability and the state machine still accepts the exact transition. The UI cannot turn broad read access into a workflow action.

Customers receive only their own company’s customer-visible handover data. Representatives receive only assigned records/notifications unless a separately approved wider permission applies.

## Notification permissions

All signed-in roles receive only the notification rows produced for their existing record scope. Customers remain company-scoped; representatives remain assignment-scoped; Planning, Expediting and Dispatch remain queue-scoped. Managers and Administrators can inspect wider operational notification state because they already hold wider RFQ/order view permissions.

`retry_notification_delivery` is granted to Manager and Administrator only. It queues a failed email/push delivery for the background worker and never changes an RFQ/order status. Every retry is audited. Buyer has no workflow notification queue while its workflow remains inactive.

## Phase 21 specialised permissions

| Capability | Customer | Rep | Lab | QA | Dispatch | Manager/Admin |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| View Lab queue / update calibration | No | Status only | Yes | No | Status only | Yes |
| Upload unit certificate | No | No | Yes | No | No | Yes |
| Download certificate PDF | Own company | No | Yes | No | No | Yes |
| View QA queue / inspect | No | Status only | No | Yes | Status only | Yes |
| Create QA failure/rework | No | No | No | Yes | No | Yes |
| Confirm Dispatch receipt | No | No | No | No | Yes | Yes |
| Change own verified credentials | Yes | Yes | Yes | Yes | Yes | Yes |
| Reassign dedicated representative | No | No | No | No | No | Authorised manager/admin |

The table is explanatory. `src/services/contracts.js`, service scoping and workflow guards are canonical. A role never grants cross-company access by itself.

## Unit-detail and commercial-field boundaries

Sales, Planning, Expediting, Laboratory, Quality, Dispatch, Management and Administration reuse the shared expandable unit-detail view. Its protected-field policy removes private pricing, audit, staff-only and internal metadata before rendering. The internal Sales Order Number is available only in authorised Planning/management contexts and is never included in customer projections. Management commercial values additionally require the explicit protected-pricing permission.

## Administrator workspace and Executive Demo

The Administrator desktop workspace is opened by `administer_users`. Mutations then require separate capabilities for customer companies, customer contacts, internal staff, roles/permissions, notification preferences, catalogue data and approved record corrections. An Administrator account may carry only a subset; the role name alone does not grant a mutation. Components never perform browser-storage writes. See [ADMINISTRATOR_MANAGEMENT.md](ADMINISTRATOR_MANAGEMENT.md).

The Executive Workflow Demo is a mock-only presentation layer. Its switchable role perspectives reuse the canonical permission catalogue and existing workspaces. Switching a demonstration role does not grant any new permission, and all fabricated role/scenario markers are excluded from production builds.

## Technical Support permissions

| Capability | Customer | Sales representative | Sales manager | Technical Advisor | Technical Director | Manager | Administrator |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Request review | No | Assigned RFQ | Yes | No | No | Yes | Yes |
| View Technical queue | No | No | Yes | Yes | Yes | Yes | Yes |
| Assign request | No | No | No | Yes | Yes | Yes | Yes |
| Respond/message | Safe reply only | Assigned RFQ | Yes | Assigned request | Yes | Yes | Yes |
| Complete request | No | No | No | Assigned request | Yes | Yes | Yes |
| View metrics | No | No | Yes | Yes | Yes | Yes | Yes |
| Override quotation block | No | No | Reason required | No | No | No | Reason required |

The desktop Technical Support roles are `technical_support` (presented as **Technical Advisor**) and `technical_director`. Assignment, response, completion and reporting are consolidated into the Technical Advisor workspace; there is no separate Technical Manager login. Capability codes are defined centrally in `src/services/contracts.js`; customer direct URL access normalises back to the customer home view.
# Client visit permissions

- Sales Representative: assigned clients, own appointments/history, schedule and verify visits, own approximate work summary.
- Sales Manager: representative compliance, missed/overdue customers, verification evidence and authorised aggregate working-location statistics.
- Company Owner: approved aggregate operational statistics only.
- Administrator: office/customer location metadata, visit-cycle, radius and working-hour policy; no editing immutable verification history.
