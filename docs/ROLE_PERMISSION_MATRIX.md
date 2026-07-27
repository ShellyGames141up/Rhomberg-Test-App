# Role and preview access matrix

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
