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
- RFQ and tracking creation accept `Idempotency-Key` to prevent duplicates after a retry.
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
  "trackingStatus": "rfq-submitted",
  "status": "RFQ submitted",
  "items": [],
  "trackingHistory": [],
  "createdAt": "2026-07-21T10:00:00.000Z",
  "updatedAt": "2026-07-21T10:00:00.000Z"
}
```

The API may include display snapshots such as company, product and representative names, while IDs remain the authoritative relationships.

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
- expeditor/buyer: approved operational scope;
- manager/administrator: approved broad scope.

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
    "enquiry": { "id": "uuid", "reference": "RQ-2026-000123", "trackingStatus": "rfq-submitted" },
    "delivery": { "ok": true, "deliveryMode": "queued", "pricedPdfAttached": true }
  }
}
```

Email should be queued through an outbox/job worker; a temporary SMTP problem should not roll back a successfully stored RFQ.

#### `POST /enquiries/{enquiryId}/tracking-events`

Expeditor, manager or administrator according to policy.

Request:

```json
{ "status": "in-production", "note": "Assembly is in progress.", "actor": "display value ignored when server identity is available" }
```

Response `201`: the updated enquiry with appended history. The server derives the actor from the session.

### Orders and tracking

#### `GET /orders?page=1&pageSize=50&status=&search=&repId=&companyId=`

Returns authorised orders. Customer-supplied `companyId` may narrow a result only within the companies already authorised by the session.

#### `GET /orders/{orderId}`

Returns order, enquiry reference, line summary, representative, dates and latest tracking state.

#### `GET /orders/{orderId}/tracking-events`

Returns the authorised chronological timeline.

#### `POST /orders/{orderId}/tracking-events`

Same validation, role and idempotency rules as the enquiry tracking route. Use once an RFQ has become an order.

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
| `409` | Duplicate account, version conflict or idempotency conflict |
| `413` | Upload too large |
| `415` | Unsupported upload type |
| `422` | Field or business-rule validation failure |
| `429` | Rate limit |
| `503` | Temporary dependency outage |

## Versioning and compatibility

Breaking changes use a new base version such as `/api/v2`. Additive fields may be introduced in v1. Product configuration keys and status IDs are stable identifiers and must not be renamed without a migration.
