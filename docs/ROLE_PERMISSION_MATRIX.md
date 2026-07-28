# Role and preview access matrix

Retention controls are internal-only. Managers and Administrators can search archive records, archive eligible completed orders, restore, export and manage legal holds. Only Administrators can alter demonstration retention settings. No browser role can permanently delete an order.

The canonical permission catalogue remains `src/services/contracts.js`. This document summarises preview access; it does not replace the code or server policy.

| Role | Connect | Operations mobile | Operations desktop | Record scope |
| --- | :---: | :---: | :---: | --- |
| Customer | Yes | No | No | Authorised company only |
| Sales representative | No | Yes | Yes | Assigned RFQs/orders |
| Planning | No | No | Yes | Planning-stage queue |
| Expeditor | No | Yes | Yes | Expediting-stage queue |
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

## Dispatch permissions

The Dispatch desktop workspace is selected centrally by `usesDispatchWorkspace()`, not by component role comparisons. `view_dispatch_queue` scopes records to Dispatch-owned stages; `confirm_collection` permits collection release/confirmation/completion; `confirm_delivery` permits delivery release/problem/confirmation/completion; `manage_order_hold` remains independent.

Managers and Administrators may perform those actions only because the central permission catalogue grants the named capability and the state machine still accepts the exact transition. The UI cannot turn broad read access into a workflow action.

Customers receive only their own company’s customer-visible handover data. Representatives receive only assigned records/notifications unless a separately approved wider permission applies.

## Notification permissions

All signed-in roles receive only the notification rows produced for their existing record scope. Customers remain company-scoped; representatives remain assignment-scoped; Planning, Expediting and Dispatch remain queue-scoped. Managers and Administrators can inspect wider operational notification state because they already hold wider RFQ/order view permissions.

`retry_notification_delivery` is granted to Manager and Administrator only. It queues a failed email/push delivery for the background worker and never changes an RFQ/order status. Every retry is audited. Buyer has no workflow notification queue while its workflow remains inactive.
