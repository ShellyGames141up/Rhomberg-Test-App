# Client visit and location API contract

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
