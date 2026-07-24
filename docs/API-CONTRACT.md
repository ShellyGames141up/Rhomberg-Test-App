# Private-cloud API contract

Status: proposed contract for IT implementation. No live endpoint or database is connected.

Base path: `/api/v1`

## Transport and authentication

- HTTPS only; reject plaintext HTTP outside a local developer environment.
- Use an opaque server session in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.
- Do not return bearer or refresh tokens for storage in the browser.
- `GET /auth/csrf-token` supplies a CSRF token. State-changing requests send it as `X-CSRF-Token`.
- Authenticated, CSRF and customer-record responses send `Cache-Control: no-store`.
- Clients send `X-Request-ID`; the API returns a correlation ID in errors and logs.
- RFQ submission and workflow actions accept `Idempotency-Key` to prevent duplicates after a retry.
- Default JSON limit: 1 MB. Upload limit: 4 MB for the current PO workflow, adjustable through an approved server policy.

## Envelopes

Successful JSON response:

```json
{
  "data": {},
  "meta": { "requestId": "b8bff7ac-..." }
}
```

List response:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 50, "total": 0, "requestId": "b8bff7ac-..." }
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the RFQ details.",
    "fieldErrors": { "application": "Describe the application." },
    "correlationId": "b8bff7ac-..."
  }
}
```

Never return stack traces, SQL text, secrets, price-book internals or internal hostnames.

## Core resources

### User

```json
{
  "id": "uuid",
  "companyId": "uuid-or-null-for-internal-users",
  "company": "Example Engineering (Demo)",
  "contact": "Demo User",
  "email": "user@example.invalid",
  "phone": "+27 00 000 0000",
  "area": "Gauteng",
  "industry": "Manufacturing",
  "role": "customer",
  "permissions": ["read_catalogue", "create_rfq", "view_own_company_rfqs", "view_own_company_orders"]
}
```

Passwords and password hashes are never returned.

`permissions` contains the server-calculated effective permission codes for display/navigation only. The browser must never be trusted to grant a permission by sending this array back. The API re-derives permissions from the authenticated user, role and approved overrides on every request.

### Enquiry summary

```json
{
  "id": "uuid",
  "reference": "RQ-2026-000123",
  "companyId": "uuid",
  "company": "Example Engineering (Demo)",
  "contact": "Demo User",
  "selectedRep": { "id": "uuid", "code": "20", "name": "Assigned Representative", "branchId": "uuid", "branchName": "Johannesburg" },
  "application": "Pump discharge pressure monitoring",
  "area": "Gauteng",
  "emergency": "no",
  "fulfilment": "delivery",
  "poNumber": "PO-DEMO-1001",
  "poFileName": "",
  "workflowType": "rfq",
  "trackingStatus": "submitted",
  "status": "RFQ submitted",
  "version": 1,
  "allowedWorkflowActions": [],
  "items": [],
  "trackingHistory": [],
  "createdAt": "2026-07-21T10:00:00.000Z",
  "updatedAt": "2026-07-21T10:00:00.000Z"
}
```

The API may include display snapshots such as company, product and representative names, while IDs remain the authoritative relationships.

### Order summary

An order is a separate resource. It is created only from an accepted RFQ and keeps immutable item/configuration snapshots:

```json
{
  "id": "uuid",
  "reference": "OR-2026-000123",
  "sourceEnquiryId": "uuid",
  "sourceRfqReference": "RQ-2026-000123",
  "companyId": "uuid",
  "selectedRep": { "id": "uuid", "name": "Assigned Representative" },
  "workflowType": "order",
  "trackingStatus": "awaiting_planning",
  "sourceRfqStatus": "converted_to_order",
  "acceptedAt": "2026-07-22T10:00:00.000Z",
  "version": 0,
  "items": [
    {
      "id": "uuid",
      "sourceEnquiryItemId": "uuid",
      "productId": "uuid",
      "productCodeSnapshot": "PBB",
      "productNameSnapshot": "Process gauge",
      "quantity": 2,
      "configurationSnapshot": { "dialSize": "100 mm", "range": "0 to 10 bar" }
    }
  ],
  "trackingHistory": [],
  "createdAt": "2026-07-22T10:05:00.000Z",
  "updatedAt": "2026-07-22T10:05:00.000Z"
}
```

The order response may carry customer-safe display fields copied at conversion time, but it must not expose internal pricing, margin, supplier terms, hidden catalogue rules or the internal Planning record. Authorised Planning/internal responses may include `planning`; customer responses must omit it entirely.

## Endpoints

### Authentication

#### `GET /auth/csrf-token`

Response `200`:

```json
{ "data": { "token": "opaque-csrf-value" } }
```

#### `POST /auth/login`

Request:

```json
{ "email": "user@example.invalid", "password": "user-supplied-password" }
```

Response `200`:

```json
{ "data": { "user": { "id": "uuid", "companyId": "uuid", "role": "customer" }, "csrfToken": "rotated-opaque-value" } }
```

Errors: `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`, `429 RATE_LIMITED`.

#### `POST /auth/register`

Request:

```json
{
  "company": "Example Engineering (Demo)",
  "contact": "Demo User",
  "email": "user@example.invalid",
  "phone": "+27 00 000 0000",
  "area": "Gauteng",
  "industry": "Manufacturing",
  "password": "user-supplied-password"
}
```

Response `201`: `{ "data": { "user": { ... }, "csrfToken": "...", "onboardingStatus": "pending_verification" } }`.

Production policy should normally require email verification and company approval before records are visible.

#### `GET /auth/me`

Response `200`: `{ "data": { ...User } }`. Response `401` when no valid session exists.

#### `POST /auth/refresh`

Rotates the session identifier. Response `200`: `{ "data": { "expiresAt": "ISO-8601", "csrfToken": "..." } }`.

#### `POST /auth/logout`

Revokes the session and clears cookies. Response `204`.

### Reference data and accounts

#### `GET /reference-data/registration`

Response `200`:

```json
{
  "data": {
    "areas": ["Western Cape", "Gauteng"],
    "industries": ["Mining", "Manufacturing"],
    "branches": [{ "id": "uuid", "name": "Johannesburg", "phone": "...", "address": "..." }],
    "areaDirectory": {
      "Gauteng": {
        "branch": { "id": "uuid", "name": "Johannesburg", "phone": "...", "address": "..." },
        "representatives": [{ "id": "uuid", "code": "20", "name": "Assigned Representative", "branchId": "uuid" }]
      }
    }
  }
}
```

#### `GET /companies/me`

Returns the caller’s current company context. Customer response is limited to an authorised company. Internal users receive their Rhomberg staff context.

#### `GET /companies?page=1&pageSize=50&search=`

Manager/administrator only unless a narrower assigned-company route is implemented. Returns company summaries without credentials.

#### `GET /representatives?area=Gauteng`

Returns active representatives eligible for the selected area/branch. The server validates that the selected representative remains valid when the RFQ is submitted.

### Products

#### `GET /products/categories`

Returns category objects: `id`, `number`, `name`, `short`, `icon`, `image`, `description`.

#### `GET /products?categoryId=pressure&query=PBB&page=1&pageSize=50`

Returns product summaries or full product objects. Configuration fields must contain stable keys, input types, allowed options, required flags, dependency rules and help text.

#### `GET /products/{productId}`

Returns the full product, including specifications, configurations and authorised datasheet metadata. `404` for inactive or unknown products.

#### `GET /products/recommendations`

Returns a map of industry name to category IDs, for example `{ "Mining": ["pressure", "level"] }`.

### RFQ drafts and enquiries

#### `GET /enquiry-drafts/current`

Customer only. Returns `{ "data": { "items": [...] } }` for the current user/account.

#### `PUT /enquiry-drafts/current`

Request: `{ "items": [ConfiguredEnquiryItem] }`. The server derives owner and company from the session. Response returns the saved items and `updatedAt`.

#### `GET /enquiries?page=1&pageSize=50&status=&search=`

Scope is mandatory on the server:

- customer: authorised company IDs only;
- sales representative: actively assigned companies only;
- buyer: no RFQ scope until an approved Buyer workflow is implemented;
- manager/administrator: approved broad scope.

Planning, Expediting and Dispatch consume the separate `/orders` resource. Expediting no longer receives RFQs merely because the earlier browser preview stored RFQs and orders in one array.

#### `GET /enquiries/inbox?group=&priority=&search=&page=1&pageSize=50`

Sales Representative only. The server derives the representative identity from the verified session and returns only RFQs whose active `representative_id` matches that identity. A caller cannot request another representative’s inbox by supplying an ID.

Supported inbox groups:

- `new`: `submitted`, `assigned_to_rep`;
- `under_review`: `under_rep_review`;
- `quoted`: `quoted`;
- `awaiting_acceptance`: `awaiting_customer_acceptance`;
- `accepted`: `accepted`, `converted_to_order`;
- `closed`: `cancelled`, `expired`.

`priority` accepts `urgent` or `standard`. Results expose authorised company/customer contact information, submitted time, last activity, priority/emergency state and the workflow actions currently allowed for that representative.

#### `GET /enquiries/{enquiryId}`

Returns a full authorised enquiry. Return `404`, not `403`, when the record is outside the caller’s scope.

#### `POST /enquiries`

Content type: `multipart/form-data`.

- `payload`: JSON string containing `details` and `items`.
- `purchaseOrder`: optional PDF, DOC, DOCX or approved image.

Example `payload` value:

```json
{
  "details": {
    "application": "Pump discharge pressure monitoring",
    "medium": "Process water",
    "area": "Gauteng",
    "selectedRep": { "id": "uuid" },
    "emergency": "no",
    "fulfilment": "delivery",
    "deliveryAddress": "Demo address",
    "collectionBranch": "",
    "notes": "",
    "poMode": "number",
    "poNumber": "PO-DEMO-1001",
    "poFileName": ""
  },
  "items": [
    {
      "lineId": "client-generated-id",
      "productId": "uuid-or-stable-product-key",
      "quantity": 5,
      "configuration": {
        "dialSize": "100 mm",
        "range": "0 to 10 bar",
        "connectionPosition": "Bottom entry (A)"
      }
    }
  ]
}
```

The server must ignore company/contact/representative/product display snapshots supplied by the browser. It reloads the signed-in customer, authorised company, selected representative, product and configuration rules from authoritative records.

One database transaction must:

1. verify the customer account is active and authorised for the company;
2. verify and load the selected representative from the approved area/branch assignment;
3. generate an immutable permanent RFQ reference;
4. insert the RFQ with company, submitting customer, representative, submission time, notes, priority and fulfilment details;
5. insert every configured line item;
6. insert uploaded-document metadata while the file is queued for malware scanning/encrypted object storage;
7. append the customer submission workflow event and first audit event;
8. perform the immediate `assigned_to_rep` transition;
9. create one representative inbox notification/outbox item;
10. clear the submitted customer draft.

Only after the transaction commits may background email delivery be queued. A delivery failure must never remove the saved RFQ or representative inbox item.

Response `201`:

```json
{
  "data": {
    "enquiry": {
      "id": "uuid",
      "reference": "RQ-2026-000123",
      "workflowType": "rfq",
      "trackingStatus": "submitted",
      "submittedAt": "2026-07-23T10:15:00.000Z",
      "selectedRep": { "id": "uuid", "name": "Assigned Representative" },
      "version": 2
    },
    "delivery": { "ok": true, "deliveryMode": "queued", "pricedPdfAttached": true }
  }
}
```

The customer response uses the customer-visible `submitted` projection even though the internal record is already `assigned_to_rep`. Email should be queued through an outbox/job worker; a temporary SMTP problem must not roll back a successfully stored RFQ.

#### `GET /enquiries/{enquiryId}/workflow-actions`

Returns only the action descriptors permitted for the signed-in actor at the RFQ's current state. The server derives effective permission, role, company and representative identity from the session.

#### `POST /enquiries/{enquiryId}/workflow-actions`

Representative quotation-confirmation example:

```json
{
  "action": "mark_quoted",
  "data": {
    "quotation": {
      "number": "Q-DEMO-2026-001",
      "date": "2026-07-23",
      "expiryMode": "dated",
      "expiryDate": "2026-08-23",
      "internalNote": "Fabricated test note for the assigned representative.",
      "customerNote": "Your quotation was emailed separately.",
      "emailed": true,
      "documentReference": "OUTLOOK-DEMO-REFERENCE",
      "documentCustomerVisible": false
    }
  },
  "expectedVersion": 4
}
```

The quotation request contains no price, total, line-price or payment field. The backend must reject those fields if supplied. `expiryMode` is `dated` or `not_applicable`; an expiry date is required only for `dated` and cannot precede the quotation date.

When no quotation file is supplied, the adapter sends JSON. When a representative intentionally includes a file, the same endpoint accepts multipart form data:

- `payload`: JSON-encoded `WorkflowActionRequest`;
- `quotationDocument`: optional PDF, DOC, DOCX or image, maximum 4 MB.

The backend must validate, malware-scan and store the file privately. `documentCustomerVisible` records the representative's explicit authorisation; it is not inferred merely because a file or reference exists.

Customer receipt-acknowledgement example:

```json
{
  "action": "acknowledge_quotation",
  "data": {},
  "expectedVersion": 5
}
```

This customer action is permitted only for a `quoted` RFQ belonging to the caller's authorised company. It records receipt and moves the RFQ to `awaiting_customer_acceptance`; it does not accept a price, confirm payment or a Purchase Order, or create an order.

The browser never sends actor, role, company ID, from-status or target status. The server locks/re-reads the record, validates the action through the central workflow rules and atomically writes the new state, quotation metadata, workflow event, audit event and recipient-specific notification outbox records. It records the representative and `quotedAt` for `mark_quoted`, or the customer and `quotationAcknowledgedAt` for acknowledgement. Response `201` is the updated authorised enquiry with a new version and refreshed `allowedWorkflowActions`.

Customer responses must omit `quotation.internalNote`, internal user IDs and any quotation document/reference that was not explicitly customer-authorised. A document may be shown as downloadable only after the document API has performed the company/record/visibility check and returned an authorised download URL. Customer notifications state that the quotation was emailed separately; representative confirmations and acknowledgement notifications may use separate internal wording.

Representative order-acceptance example:

```json
{
  "action": "accept_order",
  "data": {
    "acceptance": {
      "type": "purchase_order_received",
      "purchaseOrderNumber": "PO-DEMO-001",
      "paymentReference": "",
      "date": "2026-07-23",
      "internalNote": "Fabricated test Purchase Order checked against the external email.",
      "documentReference": "OUTLOOK-DEMO-PO-REFERENCE",
      "verified": true
    }
  },
  "expectedVersion": 6
}
```

Allowed acceptance types are `purchase_order_received`, `payment_confirmed`, `written_acceptance_received`, `account_customer_authorisation` and `other`. `purchaseOrderNumber` is required for Purchase Order acceptance; `paymentReference` is required for an externally confirmed payment. The internal note, valid acceptance date and explicit verification are always required.

This action does not process payment. Requests containing pricing, card, bank-account, routing, PIN, CVV or password fields must be rejected. When supporting evidence is selected, the endpoint accepts multipart form data:

- `payload`: JSON-encoded `WorkflowActionRequest`;
- `acceptanceDocument`: optional PDF, DOC, DOCX or image, maximum 4 MB.

Acceptance evidence is internal by default and must be stored in protected object storage after malware scanning. No permanent public file URL may be returned.

`accept_order` is a compound command. The browser cannot invoke the internal `convert_to_order` transition or supply an order ID/reference. The server performs all of the following in one PostgreSQL transaction:

1. lock and re-read the `awaiting_customer_acceptance` RFQ;
2. derive the actor, role, company scope and representative identity from the verified session;
3. reject a stale version, unassigned representative or invalid/missing acceptance evidence;
4. persist the verified acceptance and move the RFQ through the transient `accepted` state;
5. allocate the permanent order reference and create the order plus immutable `order_items` snapshots;
6. move the RFQ to `converted_to_order` and link the order;
7. create linked RFQ acceptance/conversion and order-creation workflow/audit events;
8. queue role-specific customer, assigned-representative and Planning notifications.

The database must enforce one order per source RFQ. The endpoint also requires `Idempotency-Key`; a retry with the same command or an already converted RFQ returns the existing linked order and cannot create a duplicate.

Conversion response:

```json
{
  "data": {
    "id": "rfq-uuid",
    "reference": "RQ-2026-000123",
    "workflowType": "rfq",
    "trackingStatus": "converted_to_order",
    "orderId": "order-uuid",
    "orderReference": "OR-2026-000123",
    "version": 8,
    "idempotent": false,
    "createdOrder": {
      "id": "order-uuid",
      "reference": "OR-2026-000123",
      "sourceEnquiryId": "rfq-uuid",
      "workflowType": "order",
      "trackingStatus": "awaiting_planning",
      "version": 0
    }
  }
}
```

Customer projections keep the original RFQ as a historical record and return the linked order through `/orders`, but omit `acceptance`, `acceptedBy`, internal notes and private supporting-document metadata.

### Orders and tracking

#### `GET /planning/workspace-options`

Requires `add_planning_information`. Returns service-owned reference data used by the Planning form:

```json
{
  "data": {
    "users": [{ "id": "planner-user-id", "name": "Planning User" }],
    "locations": [{ "id": "cape-town", "name": "Cape Town", "role": "Manufacturing & Head Office" }],
    "priorities": [
      { "id": "standard", "label": "Standard" },
      { "id": "high", "label": "High" },
      { "id": "urgent", "label": "Urgent" }
    ]
  }
}
```

The browser must not be allowed to create arbitrary Planning users or production locations. The API reloads these identifiers before saving the plan.

#### `GET /expediting/workspace-options`

Requires `view_expediting_queue` or an authorised Expediting action permission such as `update_order_progress`/`move_to_dispatch`. Returns the server-owned Expediting progress configuration used by both mobile and desktop clients:

```json
{
  "data": {
    "progressSteps": [
      {
        "id": "materials_checked",
        "label": "Materials checked",
        "customerLabel": "Materials checked",
        "description": "Material availability and requirements have been checked.",
        "sequence": 20,
        "requiredForDispatch": true,
        "selectableForUpdate": true,
        "operational": false,
        "terminal": false
      }
    ],
    "requiredStepIds": [
      "planning_received",
      "materials_checked",
      "production_started",
      "calibration_or_testing",
      "quality_check",
      "paperwork_preparation",
      "ready_for_dispatch"
    ],
    "documentTypes": [
      { "id": "document", "label": "Document reference" },
      { "id": "image", "label": "Image reference" }
    ],
    "approachingCompletionDays": 3
  }
}
```

The backend owns the active step catalogue, ordering and required-for-Dispatch flags. A client-supplied label, sequence or required flag is never authoritative.

#### `GET /orders?page=1&pageSize=50&status=&search=&repId=&companyId=`

Returns authorised orders. Customer-supplied `companyId` may narrow a result only within the companies already authorised by the session.

Mandatory server scopes:

- customer: authorised company IDs only;
- sales representative: orders assigned to the authenticated representative identity;
- Planning: `awaiting_planning`, `planning_in_progress`, `planned`, and holds whose stored resume stage belongs to Planning;
- Expediting: `submitted_to_expediting`, `expediting_in_progress`, `awaiting_dispatch`, and Expediting-owned holds; `awaiting_dispatch` is read-only awareness after hand-off;
- Dispatch: `awaiting_dispatch`, collection/delivery handover stages, and Dispatch-owned holds;
- Buyer: no order scope until its workflow is approved;
- Manager/Administrator: approved all-order oversight.

#### `GET /orders/{orderId}`

Returns order, enquiry reference, line summary, representative, dates and latest tracking state.

#### `GET /orders/{orderId}/tracking-events`

Returns the authorised chronological timeline.

#### `GET /orders/{orderId}/workflow-actions`

Returns only actions available to the signed-in account's effective permission set and role for the exact current order stage.

#### `POST /orders/{orderId}/workflow-actions`

Uses the same action envelope and idempotency/version rules as the enquiry route. Example:

```json
{
  "action": "complete_expediting",
  "comment": "",
  "data": {
    "expeditingUpdate": {
      "progressStep": "ready_for_dispatch",
      "customerMessage": "Your order has completed Expediting and is moving to Dispatch.",
      "internalNote": "Internal hand-off checks complete.",
      "estimatedCompletionDate": "2026-08-05",
      "delayReason": "",
      "document": null,
      "customerVisible": true
    },
    "completionCheckConfirmed": true,
    "expeditingHandoff": {
      "authorisedException": false,
      "exceptionReason": "",
      "exceptionAuthorisationReference": ""
    }
  },
  "expectedVersion": 8
}
```

Planning completion uses the same endpoint with the business action `complete_planning`:

```json
{
  "action": "complete_planning",
  "comment": "",
  "data": {
    "planning": {
      "internalJobNumber": "JOB-TEST-1024",
      "customerPoNumber": "PO-TEST-2048",
      "customerPoException": null,
      "notes": "Fabricated internal Planning note.",
      "plannedStartDate": "2026-07-27",
      "estimatedCompletionDate": "2026-08-05",
      "assignedPlanningUserId": "planner-user-id",
      "productionLocationId": "cape-town",
      "priority": "high",
      "documentReferences": ["DOC-TEST-1024"],
      "submissionDate": "2026-07-24"
    }
  },
  "expectedVersion": 4
}
```

Required controls:

- the order must be `planning_in_progress`;
- the source RFQ must already have been accepted and converted;
- the assigned representative must still exist;
- internal job number, assigned Planning user and submission date are mandatory;
- a customer PO number is mandatory unless `customerPoException` contains an authorised flag and meaningful reason;
- the selected Planning user and location are reloaded from server-owned reference data;
- completion records `plannedAt` and `plannedBy`, plus workflow and audit events;
- `submit_to_expediting` is accepted only from `planned` after the persisted Planning record passes the same validation;
- hand-off records `submittedToExpeditingAt` and `submittedToExpeditingBy` and queues separate customer, assigned-representative and Expeditor notifications.

Customer order responses must omit the complete `planning` object, compatibility job/PO fields, Planning actors, notes, schedule, location and document references. The customer receives only the approved customer-visible workflow event.

Expediting actions use this same endpoint:

- `start_expediting` requires `planning_received`, a customer-facing message and the `update_order_progress` permission;
- `add_expediting_update` records a configured normal progress step while the top-level order remains `expediting_in_progress`;
- `place_on_hold` requires the controlled `on_hold` step and a delay reason;
- `resume_order` requires a normal progress step and returns to the stored Expediting status;
- `complete_expediting` requires `ready_for_dispatch`, the hand-off confirmation and every required step, unless a controlled authorised-exception reason and authorisation reference are recorded;
- every successful Expediting action records the session-derived actor and time, one workflow event, one append-only audit event and recipient-scoped notifications;
- raw actors, company IDs, status targets, step labels and completion flags supplied outside the validated action payload are ignored or rejected.

Customer order projections may include only `expediting.currentStep`, the current estimated completion date and customer-visible updates containing the progress step, customer message, public updater name and timestamp. They must omit internal notes, delay/supplier context, document/image references, internal actor IDs and hand-off exception evidence. The assigned representative and authorised internal roles may receive the appropriate fuller projection.

An arbitrary `{ "status": "..." }` update is not supported. See `WORKFLOW_STATE_MACHINE.md` for the authoritative transition list.

### Notifications and audit

#### `GET /notifications?unreadOnly=true&page=1&pageSize=50`

Returns notifications within the caller's authorised company/role scope. Internal-only notification payloads are never returned to customers. A representative receives only notifications addressed to their authoritative representative identity. Each recipient has independent read state; one user marking a message read must not mark it read for another recipient.

#### `POST /notifications/{notificationId}/read`

Marks one authorised notification as read. Response `200` returns the updated notification.

#### `GET /audit-events?entityId=&entityType=&page=1&pageSize=50`

Manager/administrator only unless a narrower audited support permission is approved. Audit records are append-only and include successful and denied workflow attempts.

### Documents

#### `POST /enquiries/{enquiryId}/documents`

Multipart upload for authorised supplementary documents. The backend scans and stores the file privately, returning metadata only.

#### `GET /documents/{documentId}`

Returns metadata after a record-scope check.

#### `GET /documents/{documentId}/download`

After authorisation, either streams the file or returns a very short-lived signed URL. Never exposes a permanent public object URL.

### Administration

The administrator UI is a later phase, but the backend should reserve:

- `GET/POST/PATCH /admin/users`
- `GET/POST/PATCH /admin/companies`
- `GET/POST/PATCH /admin/representatives`
- `PUT /admin/representatives/{id}/company-assignments`
- `GET/POST/PATCH /admin/products`
- `GET /admin/audit-events`

All administrative mutations require elevated role checks, MFA-backed staff sessions and audit records.

Reserved permission codes include `administer_users`, `archive_orders` and `restore_archived_orders`. Defining the codes does not activate those interfaces; only approved Administrator endpoints may use them.

## Status codes

| Code | Use |
|---|---|
| `200` | Successful read/update |
| `201` | Created RFQ, event, document or account |
| `204` | Successful no-content operation |
| `400` | Malformed request |
| `401` | Missing/expired session |
| `403` | Authenticated role lacks a general capability |
| `404` | Unknown resource or resource outside caller scope |
| `409` | Duplicate account, invalid transition, stale version or idempotency conflict |
| `413` | Upload too large |
| `415` | Unsupported upload type |
| `422` | Field or business-rule validation failure |
| `429` | Rate limit |
| `503` | Temporary dependency outage |

## Versioning and compatibility

Breaking changes use a new base version such as `/api/v2`. Additive fields may be introduced in v1. Product configuration keys and status IDs are stable identifiers and must not be renamed without a migration.
