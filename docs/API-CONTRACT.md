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
  "permissions": ["catalogue:read", "enquiry:create", "enquiry:read:own-company"]
}
```

Passwords and password hashes are never returned.

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

The order response may carry customer-safe display fields copied at conversion time, but it must not expose internal pricing, margin, supplier terms or hidden catalogue rules.

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
- buyer: approved read-only operational scope;
- manager/administrator: approved broad scope.

Planning, Expediting and Dispatch consume the separate `/orders` resource. Expediting no longer receives RFQs merely because the earlier browser preview stored RFQs and orders in one array.

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

The server must ignore company/contact/product display snapshots supplied by the browser. It reloads account, representative, product and configuration rules from authoritative records, validates every option, stores the RFQ and clears the submitted user draft in one transaction, then queues email delivery.

Response `201`:

```json
{
  "data": {
    "enquiry": { "id": "uuid", "reference": "RQ-2026-000123", "workflowType": "rfq", "trackingStatus": "submitted", "version": 1 },
    "delivery": { "ok": true, "deliveryMode": "queued", "pricedPdfAttached": true }
  }
}
```

Email should be queued through an outbox/job worker; a temporary SMTP problem should not roll back a successfully stored RFQ.

#### `GET /enquiries/{enquiryId}/workflow-actions`

Returns only the action descriptors permitted for the signed-in actor at the RFQ's current state. The server derives role, company and representative identity from the session.

#### `POST /enquiries/{enquiryId}/workflow-actions`

Request example:

```json
{
  "action": "mark_quoted",
  "comment": "Quotation sent using the approved external channel.",
  "data": {
    "quotationSentAt": "2026-07-22T10:00:00.000Z",
    "quotationReference": "QUOTE-REFERENCE"
  },
  "expectedVersion": 4
}
```

The browser never sends actor, role, company ID, from-status or target status. The server locks/re-reads the record, validates the action through the central workflow rules and atomically writes the new state, workflow event, audit event and notification outbox record. Response `201` is the updated authorised enquiry with a new version and refreshed `allowedWorkflowActions`.

For `action: "convert_to_order"`, the browser does not supply an order ID or order number. The server generates both and performs all of the following in one PostgreSQL transaction:

1. lock and re-read the accepted RFQ;
2. reject an existing conversion or stale version;
3. create the order and immutable `order_items` snapshots;
4. move the RFQ to `converted_to_order` and link the order;
5. create RFQ and order workflow/audit events;
6. queue the customer, assigned-representative and Planning notifications.

Conversion response:

```json
{
  "data": {
    "id": "rfq-uuid",
    "reference": "RQ-2026-000123",
    "workflowType": "rfq",
    "trackingStatus": "converted_to_order",
    "orderId": "order-uuid",
    "version": 8,
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

### Orders and tracking

#### `GET /orders?page=1&pageSize=50&status=&search=&repId=&companyId=`

Returns authorised orders. Customer-supplied `companyId` may narrow a result only within the companies already authorised by the session.

#### `GET /orders/{orderId}`

Returns order, enquiry reference, line summary, representative, dates and latest tracking state.

#### `GET /orders/{orderId}/tracking-events`

Returns the authorised chronological timeline.

#### `GET /orders/{orderId}/workflow-actions`

Returns only actions available to the signed-in role for the exact current order stage.

#### `POST /orders/{orderId}/workflow-actions`

Uses the same action envelope and idempotency/version rules as the enquiry route. Example:

```json
{
  "action": "complete_expediting",
  "comment": "Completion checks passed; sent to Dispatch.",
  "data": { "completionCheckConfirmed": true },
  "expectedVersion": 8
}
```

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
