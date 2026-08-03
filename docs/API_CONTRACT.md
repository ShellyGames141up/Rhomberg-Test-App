# Phase 21 API contract

The canonical machine-readable proposal is [api/openapi.yaml](api/openapi.yaml). The historical detailed narrative remains in [API-CONTRACT.md](API-CONTRACT.md).

Phase 21 adds contracts for Laboratory queues/receipt/unit updates/release, receipt from Laboratory, one-PDF-per-unit certificate upload and audited download, Laboratory archive, QA queue/actions/rework, Dispatch receipt, credential-change challenge/confirmation, dedicated representative assignment, and pricing-safe operational analytics.

The IT handover adds Administrator contracts for a sanitised system overview, audited account activation/suspension and audited customer-company representative assignment:

- `GET /administration/overview`
- `PUT /administration/users/{userId}/status`
- `PUT /administration/companies/{companyId}/representative`

The secure Administrator extension additionally defines realm-scoped user/company updates, explicit internal permission assignments, notification-preference administration, catalogue/category updates and append-only RFQ/order corrections. High-risk production requests use a short-lived step-up verification token rather than submitting a password as business data. Canonical definitions are in `docs/api/openapi.yaml`; audit evidence records previous and new values.

Executive Demo role switching and fabricated-data reset are intentionally not production API operations.

Restricted commercial reporting adds these future contracts:

- `GET /management/performance-report-options` returns authorised representative, branch and rolling-period choices.
- `POST /management/performance-reports` accepts period mode, dates/month count, representative, branch and selected section IDs, then returns audited private PDF metadata and a short-lived download URL.

Future quotation upload processing must return verified extraction metadata (`quoteNumber`, quotation/expiry dates, currency, subtotal, VAT, commercial total, confidence, parser version and source-file hash). Parsing belongs in the backend; uncertain fields require human confirmation. The customer-safe record API must never return these commercial fields.

All write endpoints require a secure session, CSRF defence, permission, company/assignment/queue scope, optimistic `expectedVersion`, shared validation, idempotency where retries are possible, immutable audit creation and public-safe error envelopes. Upload endpoints additionally require private object storage, allow-listed file types, size limits, malware scanning and short-lived download URLs.

Examples use fabricated UUIDs and names. No endpoint in this proposal is connected to a production server.
