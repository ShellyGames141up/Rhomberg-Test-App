# Production API and PostgreSQL Specification

Status: design proposal only
Specification version: 0.6
Last updated: 29 July 2026

This document reconciles the completed mock RFQ-to-order workflow with the proposed private-cloud API and PostgreSQL model. It does not connect the preview to a database, identity provider, mail server, file store, or production infrastructure. Every example in the OpenAPI file is fabricated.

The executable design artefacts are:

- `docs/database/postgresql-schema.sql`
- `docs/api/openapi.yaml`

## Design boundaries

- The browser never receives database credentials and never connects directly to PostgreSQL.
- A private backend API validates identity, company scope, permission, workflow state, expected row version, and request idempotency.
- The API continues to expose `/enquiries` for compatibility with the current service adapter. Its canonical database entity is `app.rfqs`.
- Product, RFQ, and order line configurations are stored as immutable snapshots. Later catalogue changes do not rewrite historical requests.
- Quotation pricing remains outside the customer-facing application.
- Document bytes belong in private object storage. PostgreSQL stores metadata, hashes, scan status, and authorisation only.
- Important actions write an append-only audit event in the same transaction as the business change.

## Canonical entity catalogue

“Direct” scope means the table owns a `company_id`. “Derived” means its company is resolved through a mandatory parent foreign key and must be checked by row-level security or a security-definer authorisation function.

| Entity | Primary key | Important foreign keys and uniqueness | Company scope | Lifecycle |
| --- | --- | --- | --- | --- |
| `users` | `id` UUID | unique case-insensitive `email`; optional external identity pair is unique | memberships through `company_users` | `status`, `disabled_at`, `deleted_at` |
| `roles` | `code` enum | unique `name` | global controlled catalogue | `is_active` |
| `permissions` | `code` text | permission code is unique by PK | global controlled catalogue | `is_active` |
| `user_roles` | `(user_id, role_code, assigned_at)` | FK user, role, assigning user | through user | `expires_at`, `revoked_at` |
| `role_permissions` | `(role, permission_code)` | FK role and permission | global controlled catalogue | append or revoke through audited administration |
| `companies` | `id` UUID | unique optional `account_code` | direct root | `status`, `archived_at` |
| `company_users` | `(user_id, company_id)` | FK user/company; membership is unique per pair | direct | `revoked_at`, `deleted_at` |
| `representatives` | `id` UUID | unique optional `user_id`; unique `(branch_id, code)` | assignment through `representative_company_assignments` | `is_active`, `deleted_at` |
| `products` | `id` UUID | unique `code`; FK category | global catalogue | `is_active`, `deleted_at`, `row_version` |
| `product_configurations` | `id` UUID | unique `(product_id, schema_version)` | global catalogue | effective dates, `deleted_at` |
| `rfqs` | `id` UUID | unique permanent `reference`; FK company, requester, representative | direct | RFQ status timestamps, `row_version` |
| `rfq_items` | `id` UUID | unique `(rfq_id, line_number)`; FK RFQ/product | derived from RFQ | immutable commercial snapshot |
| `quotations` | `id` UUID | one-to-one unique `rfq_id`; unique quotation number index | derived from RFQ | quote, expiry, acknowledgement timestamps, `row_version` |
| `rfq_acceptances` | `id` UUID | one-to-one unique `rfq_id`; FK verifier | derived from RFQ | immutable verified acceptance evidence |
| `orders` | `id` UUID | unique permanent `order_number`; one-to-one source RFQ; optional unique ERP ID | direct | order status timestamps, hold/archive fields, `row_version` |
| `order_items` | `id` UUID | unique `(order_id, line_number)` and `(order_id, source_rfq_item_id)` | derived from order | immutable accepted snapshot |
| `planning_records` | `id` UUID | one-to-one unique `order_id`; unique job number; FK assigned planner/branch | direct | `started_at`, `submitted_at`, `row_version` |
| `expediting_updates` | `id` UUID | FK order, progress step, updating user | derived from order | append-only |
| `dispatch_records` | `order_id` UUID | one-to-one FK order; optional proof document | derived from order | current Dispatch summary timestamps |
| `order_dispatch_updates` | `id` UUID | FK Dispatch record/order, actor, proof document | derived from order | append-only |
| `tracking_events` | `id` UUID | exactly one RFQ or order FK | derived from parent | append-only |
| `notifications` | `id` UUID | FK company, recipient and exactly one RFQ/order | direct | `read_at`; content is recipient-safe |
| `notification_deliveries` | `id` UUID | unique `(notification_id, channel)` | derived from notification | retry state and delivery timestamps |
| `notification_preferences` | `user_id` UUID | FK user/company | direct | versioned settings timestamps |
| `uploaded_documents` | `id` UUID | unique private `object_key`; exactly one product/RFQ/order parent | direct | scan state, visibility approval, `deleted_at` |
| `audit_events` | identity `id` bigint | actor/company and logical entity references | direct when entity has a company | append-only |
| `archive_records` | `id` UUID | FK order/company/policy; unique event instance | direct | append-only eligibility/archive/restore/hold history |
| `retention_policies` | `id` UUID | business and IT approver FKs | global policy | active/superseded timestamps |
| `workflow_overrides` | `id` UUID | exactly one RFQ/order parent; requester/decider/executor FKs | direct | requested, decided, executed timestamps |

Supporting production tables in the SQL proposal include branches, representative-company assignments, progress-step definitions, drafts, sessions, idempotency records, notification deliveries, an email outbox, personalisation, protected exports, deletion requests, and management approvals. They support the required entities but are not substitutes for them.

## Controlled status values

### RFQ

`draft`, `submitted`, `assigned_to_rep`, `under_rep_review`, `quoted`, `awaiting_customer_acceptance`, `accepted`, `cancelled`, `expired`, `converted_to_order`

### Order

`awaiting_planning`, `planning_in_progress`, `planned`, `submitted_to_expediting`, `expediting_in_progress`, `awaiting_dispatch`, `ready_for_collection`, `out_for_delivery`, `delivered`, `collected`, `completed`, `on_hold`, `cancelled`, `archived`

### Supporting enums

- User/company record: `pending`, `active`, `suspended`, `archived`
- Fulfilment: `delivery`, `collect`
- Dispatch: `collection`, `company_delivery`, `courier`, `third_party_delivery`
- Acceptance: `purchase_order_received`, `payment_confirmed`, `written_acceptance_received`, `account_customer_authorisation`, `other`
- Notification delivery: `in_app`, `email_pending`, `email_sent`, `email_failed`, `push_pending`, `push_sent`, `push_failed`
- Workflow override: `requested`, `approved`, `rejected`, `executed`, `cancelled`
- Archive action: `eligible`, `archived`, `restored`, `legal_hold_applied`, `legal_hold_released`, `deletion_requested`, `deletion_cancelled`

Only the workflow module and service layer may choose a target RFQ or order status. Direct status update endpoints are intentionally absent.

## Constraints and consistency rules

1. Permanent RFQ, order, job, quotation, and approved external-reference identifiers are unique.
2. RFQ and order line numbers are unique within their parent.
3. A quotation and acceptance can exist at most once for an RFQ.
4. Order creation and RFQ conversion are one transaction and are protected by an idempotency key.
5. Planning requires a job number, assigned planner, submission date, and either a customer PO number or an authorised exception.
6. Dispatch and Expediting dates cannot move backwards relative to required earlier dates.
7. Notification and tracking records identify exactly one RFQ or order.
8. Document metadata identifies exactly one product, RFQ, or order parent.
9. Raw passwords, API keys, payment-card data, bank credentials, real pricing, and object-storage secrets are prohibited.
10. Optimistic concurrency uses `row_version`/`expectedVersion`; stale changes return HTTP 409.

## Index strategy

The SQL proposal includes:

- company and updated-time indexes for RFQs and orders;
- representative/status/time indexes for inboxes;
- status, priority, and age indexes for Planning, Expediting, and Dispatch queues;
- parent/time indexes for line items, progress updates, Dispatch updates, tracking events, and archive records;
- recipient/unread and company/time notification indexes;
- work indexes for email and notification retry workers;
- company/time and entity/time audit indexes;
- partial indexes for active memberships, active role assignments, active product configurations, non-deleted documents, archive eligibility, legal holds, and current representative assignments.

Production query plans must be reviewed with representative volumes before go-live. Search across company/contact/reference fields may later justify approved trigram or full-text indexes.

## Row-level security

### Session context

After validating the secure server-side session, the backend starts each transaction with verified values:

```sql
SET LOCAL app.user_id = '<verified-user-uuid>';
SET LOCAL app.user_role = '<verified-active-role>';
```

The browser cannot set these values. The API must also confirm the selected role is an active `user_roles` assignment.

### Scope rules

- Customer access requires an active, non-deleted `company_users` membership and is limited to that company.
- Representatives see only records assigned to their representative identity unless a wider permission is present.
- Planning, Expediting, and Dispatch receive only their relevant status queues.
- Managers and administrators require explicit permissions; role name alone is not enough.
- Child rows inherit scope only through mandatory parent joins.
- Customer projections exclude Planning notes, internal Expediting/Dispatch notes, acceptance evidence, audit data, override data, internal actor IDs, pricing, and internal documents.
- All covered business tables have RLS enabled. Production database grants must deny direct table access by default and expose only the narrowly scoped API role and approved worker roles.
- The database owner used for migrations must not be reused by the API runtime.

The SQL functions `app.can_access_company`, `app.can_access_enquiry`, and `app.can_access_order` are the proposed reusable policy boundary. IT must security-review every `SECURITY DEFINER` function and fix its `search_path`.

## Audit requirements

Every important success, denial, validation failure, idempotent replay, workflow override, notification creation/delivery result, document generation, archive action, and administration change records:

- event type and action;
- outcome;
- verified actor, active role, and company;
- entity type, identifier, and permanent reference;
- previous and new status;
- changed field names, never secret values;
- internal reason/comment where authorised;
- notification results;
- safe document metadata;
- override evidence;
- request and correlation identifiers;
- timestamp and safe request metadata.

`audit_events`, `tracking_events`, `expediting_updates`, Dispatch updates, and `archive_records` are append-only. Corrections are new events. Ordinary API roles receive no update or delete grants on these tables.

## Transaction boundaries

The following operations are atomic:

- RFQ submission, permanent reference allocation, assignment, first tracking/audit events, and recipient notifications.
- Start review and every controlled workflow transition.
- Quotation confirmation plus notifications and audit.
- Acceptance verification, RFQ conversion, order/item creation, Planning notification, and audit.
- Planning save/submission plus queue hand-off.
- Each Expediting update plus timeline, notification, audit, and order summary update.
- Dispatch status/evidence update plus timeline, notifications, and audit.
- Archive eligibility/archive/restore/hold actions plus audit.

Email, push, malware scanning, and PDF storage are asynchronous outbox/worker operations. Their queue records are committed with the business transaction; provider calls are not.

## API surface

The full proposed contract is in `docs/api/openapi.yaml`. Resource groups include:

- Authentication and current session: `/auth/*`
- Users, roles, permissions, and memberships: `/users`, `/roles`, `/permissions`, `/users/{userId}/roles`, `/companies/{companyId}/users`
- Companies and representatives: `/companies`, `/companies/me`, `/representatives`
- Products and versioned configurations: `/products/*`, `/products/{productId}/configurations`
- RFQs: `/enquiries`, `/enquiries/inbox`, `/enquiries/{enquiryId}`, line items, quotation, acceptance, documents, timeline, and controlled workflow actions
- Orders: `/orders`, `/orders/{orderId}`, Planning, Expediting, Dispatch, timeline, documents, archive, and workflow actions
- Notifications and preferences: `/notifications/*`, `/users/me/notification-preferences`
- Audit and management: `/audit-events`, `/management/*`, `/workflow-overrides`
- Retention: `/admin/retention-policy`, `/archived-orders`, per-order archive/restore/hold/export endpoints

### Error contract

Errors use one safe envelope:

```json
{
  "error": {
    "code": "WORKFLOW_TRANSITION_INVALID",
    "message": "This order is not ready to be submitted to Dispatch.",
    "fieldErrors": {
      "expeditingCompletionCheckConfirmed": "Confirm the required checks before continuing."
    },
    "correlationId": "corr-demo-422"
  }
}
```

No stack trace, SQL text, provider payload, secret, or unauthorised record identifier may be returned.

### Fabricated workflow-action example

```json
{
  "action": "complete_planning",
  "expectedVersion": 4,
  "comment": "",
  "data": {
    "planning": {
      "internalJobNumber": "JOB-DEMO-2401",
      "customerPoNumber": "PO-DEMO-8001",
      "assignedPlanningUserId": "00000000-0000-4000-8000-000000000103",
      "productionLocationId": "cape-town",
      "priority": "high",
      "submissionDate": "2026-07-29"
    }
  }
}
```

The server derives the actor, company, representative assignment, allowed transition, recipients, and timestamps.

## Deployment review gates

Before implementation, IT and business owners must approve:

1. Identity provider and multi-factor authentication.
2. Company membership provisioning and offboarding.
3. Reference-number allocation and any ERP integration.
4. Private object storage, malware scanning, file limits, and document retention.
5. SMTP/Microsoft 365 and mobile-push providers.
6. Backup, restore, point-in-time recovery, encryption, monitoring, and alerting.
7. Retention periods, legal holds, deletion approvals, and POPIA responsibilities.
8. Database roles, migration ownership, RLS tests, and penetration testing.
9. Production product-configuration governance.

Until those gates are approved, the GitHub Pages preview remains on interchangeable mock services only.
