# Client visit and location API contract

## Workspace refresh and notification acknowledgement

### QA options and Owner reporting correction

`GET /api/v1/quality-assurance/workspace-options` returns `{id,label}` objects in
`problemCategories`, `severities` and `reworkDestinations`, matching shared UI/API
definitions. QA queues use `awaiting_qa` and existing inspection/rework/pass states.
The `fail_qa` workflow validates canonical selections, required text/date and an
affected item from that order. Invalid choices/items return 422; permission/state
checks remain authoritative. Internal QA history/notes are omitted from customer
payloads; customer-safe messages populate the existing timeline/notifications.

`GET /api/v1/management/dashboard` computes authorised totals, unit quantities, QA,
available certificate information and recorded durations without normal workspace
page truncation. `records`/`ageing` omit raw JSON, documents and pricing;
`recentActivity` comes from authorised audits. No revenue is inferred.
See [definitions and limitations](QA_OWNER_REPORTING_FIX.md).

### Refresh contract

`GET /api/v1/workspace/updates` requires a valid session and returns `{data:{revision:"<opaque SHA-256>",intervalSeconds:30},meta:{requestId:"<UUID>"}}` with `Cache-Control: no-store`. The token reflects only caller-authorised data and permissions; clients fetch through existing services when it changes. It conveys no additional access.

`POST /notifications/{notificationId}/read` requires session + CSRF and returns `{data:{id,readAt}}`; clients merge the acknowledgement. Other recipients' IDs return 404, invalid UUIDs return 422. Read-all returns `{data:{updatedCount,updated}}`; both counts are equal. Changes are audited transactionally. See [implementation and operating limits](LIVE_UPDATES_AND_NOTIFICATIONS.md).

## Administrator role/permission amendment (migration 018)

Existing endpoints (prefix `/api/v1`):

- `POST /admin/users/{accountId}/roles`: `roles` is a nonempty array of active,
  permitted internal role codes.
- `PUT /administration/users/{accountId}/permissions`: `permissions` is the
  desired effective permission array (empty is permitted); the server derives
  additions/restrictions relative to assigned-role defaults.
- Both require `reason` (minimum 8 characters), private `verification` password
  confirmation, authenticated Administrator session and valid CSRF. Never log
  or persist `verification`. These routes are rate-limited.
- Success returns `data: {id, operation, status}` plus request metadata. The
  client refreshes Administration Overview after a successful change.
- Overview user records now include `permissions`, `rolePermissions`,
  `additionalPermissions` and `deniedPermissions`. Its top-level `permissions`
  lists permitted assignable codes, not a browser-invented catalogue.
- Invalid details return 422; protected targets/escalation/failed password
  confirmation return 403; missing accounts return 404; conflicts return 409.
  Errors are visible in the open confirmation dialog.

Example non-secret selection: `roles: ["planning", "dispatch"]`. Credentials are
supplied only interactively; no credential example is stored here. The next
authenticated request derives the new permissions from database state, preserving
company isolation and RLS. See [the correction](ROLE_PERMISSION_INHERITANCE_FIX.md).

This supplements the canonical `docs/api/openapi.yaml`. Production endpoints must enforce permissions and Representative/customer scope server-side.

- `GET /representatives/clients`
- `GET /representatives/client-activity`
- `POST /clients/{clientId}/appointments`
- `GET /representatives/appointments`
- `POST /appointments/{appointmentId}/start`
- `POST /appointments/{appointmentId}/location-check`
- `POST /appointments/{appointmentId}/customer-confirmation`
- `POST /appointments/{appointmentId}/qr`
- `POST /appointments/{appointmentId}/qr/verify`
- `POST /appointments/{appointmentId}/complete`
- `POST /appointments/{appointmentId}/missed-reason`
- `GET /sales-manager/visit-compliance`
- `GET /sales-manager/missed-visits`
- `GET /sales-manager/representative/{repId}/visits`
- `GET/POST /admin/locations`
- `PATCH /admin/locations/{locationId}`
- `GET/PUT /admin/visit-policy`

Location requests carry an explicit permission status and a single timestamped coordinate sample. QR tokens are stored hashed, expire quickly, are one-time use and are bound to customer and appointment. No endpoint exposes continuous breadcrumbs.
# Laboratory launch API amendment

The production service will expose manager-scoped, company-aware endpoints:

- `GET /laboratory/certificate-tasks?status=active|completed&query=`
- `GET /laboratory/certificate-tasks/{taskId}`
- `POST /laboratory/units/{unitId}/certificate` (multipart PDF + certificate number/date/type/serial/association confirmation/note; idempotency key required)
- `POST /laboratory/certificates/{certificateId}/replace` (multipart PDF + mandatory reason; preserves superseded version)
- `GET /orders/{orderId}/certificates`
- `GET /customers/orders/{orderId}/certificates`
- `GET /certificates/{certificateId}/download` (short-lived authenticated response, audited)

Customer product payloads use `sanas: Yes — SANAS | No SANAS` or `traceability: Yes — Traceable | No Traceable Certificate`. A certified line requires `certificateRecipientType`; `My Client` additionally requires name and structured address. The server creates the immutable `certificate_recipient_snapshot`. All authorisation, discipline scope, company isolation, PDF validation, malware scanning, duplicate checks and audit writes are server-side requirements.

## Product Completion Pass 2 implemented API surface

### Management statistics and report period (local next update)

`GET /api/v1/management/dashboard` defaults to `periodMode=last_31_days`, meaning today and the preceding 30 UTC calendar dates. The response includes `period.startDate`, `period.endDate` and the calculation time. This does not delete older records. Existing `date_range` and `rolling_months` periods remain available.

`POST /api/v1/management/performance-reports` accepts `periodMode`, optional historical date/month bounds, representative/branch filters and selected report sections. It returns an authenticated JSON envelope containing `bytesBase64`, `mimeType: application/pdf`, `fileName` and `period`. The Owner/Sales Manager must have the database-authoritative export/commercial-report permissions; session, CSRF and record scope remain enforced. Each successful export records the selected period and record count in the audit history. No public PDF URL or invented commercial values are returned. See [MANAGEMENT_REPORTING_WINDOW.md](MANAGEMENT_REPORTING_WINDOW.md).

The generated authority is [API_MODE_CONTRACT_AUDIT.md](API_MODE_CONTRACT_AUDIT.md): 130 active adapter contracts match 138 registered `/api/v1` routes. The server implements the approved simplified Laboratory routes under `/laboratory/orders`, authenticated binary downloads, Administrator lifecycle/company/catalogue mutations, governance and retention actions, client visits, persisted personalisation, management projections/exports, Technical Support, notification retry and workspace selection. Public registration and browser-local credential recovery are deliberately absent; identity provisioning/recovery remain server/identity-provider responsibilities.

The API must continue to enforce authentication, exact-origin CORS, CSRF on mutations, permission checks, company/assignment scope, idempotency where declared and append-only audit evidence. The local private-storage adapter is suitable only for controlled development. Production file content requires managed private object storage and an approved malware-scanning integration.

## Local production handover and deletion extension

See [the implementation contract](PRODUCTION_HANDOFF_AND_DELETION_FIX.md) for Administrator order deletion, server-derived QC routing, Laboratory receipt/release actions and additive company/department visibility. The new `DELETE /api/v1/admin/orders/{orderId}` requires an Administrator session, CSRF and a reason, preserves historical records, and rejects legal hold. The generic order workflow endpoint handles `receive_lab_order` and `release_from_lab`; the caller cannot choose the resulting status.

`DELETE /api/v1/records/{entityType}/{recordId}` is the shared controlled-record endpoint used by the Records work dock. `entityType` is `rfq` or `order`; the JSON body requires an 8–1000 character `reason`. Administrators may soft-delete active RFQs and orders. Planning may soft-delete only orders whose authoritative server status remains `awaiting_planning`, `planning_in_progress` or `planned`; Planning cannot delete RFQs or later departmental work. Successful removal ends active visibility while preserving documents and immutable audit evidence. Legal hold, CSRF, permission and role checks remain server-enforced.
