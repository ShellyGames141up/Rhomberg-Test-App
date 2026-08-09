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
