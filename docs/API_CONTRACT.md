# Phase 21 API contract

The canonical machine-readable proposal is [api/openapi.yaml](api/openapi.yaml). The historical detailed narrative remains in [API-CONTRACT.md](API-CONTRACT.md).

Phase 21 adds contracts for Laboratory queues/receipt/unit updates/release, receipt from Laboratory, one-PDF-per-unit certificate upload and audited download, Laboratory archive, QA queue/actions/rework, Dispatch receipt, credential-change challenge/confirmation, dedicated representative assignment, and pricing-safe operational analytics.

The IT handover adds Administrator contracts for a sanitised system overview, audited account activation/suspension and audited customer-company representative assignment:

- `GET /administration/overview`
- `PUT /administration/users/{userId}/status`
- `PUT /administration/companies/{companyId}/representative`

The secure Administrator extension additionally defines realm-scoped user/company updates, explicit internal permission assignments, notification-preference administration, catalogue/category updates and append-only RFQ/order corrections. High-risk production requests use a short-lived step-up verification token rather than submitting a password as business data. Canonical definitions are in `docs/api/openapi.yaml`; audit evidence records previous and new values.

Executive Demo role switching and fabricated-data reset are intentionally not production API operations.

## Representative-loaded orders

The current extension adds these future private API contracts:

- `GET /representatives/orders/options` returns only companies, contacts, branches, representatives and products within the caller's authorised load-order scope.
- `POST /representatives/orders/duplicate-check` compares company, PO/quotation references, product/configuration signatures and the recent-submission window.
- `POST /representatives/orders` accepts a JSON payload plus mandatory quotation and PO files and creates an `awaiting_planning` order without an RFQ.
- `GET /orders/{orderId}/source-documents` returns an actor-safe list of versioned source documents.
- `GET /orders/{orderId}/source-documents/{documentId}/download` authorises and audits a short-lived private download.
- `POST /orders/{orderId}/source-documents/{documentId}/versions` creates a corrected version with a mandatory reason.

The create endpoint requires `load_customer_order`, CSRF protection and `Idempotency-Key`. It derives the actor and company scope from the verified session, validates the selected customer/contact/branch/representative, requires both source documents and their reference/date metadata, checks every product quantity/configuration, evaluates duplicates, and commits the order, item snapshots, source record, document metadata, audit events and notifications atomically.

Customer `POST /enquiries` payloads do not contain urgency or priority. `emergency`, `urgent`, `priority` and `internalPriority` are rejected when sent by a customer. Internal priority remains part of protected internal contracts only.

The OpenAPI examples use fabricated data and the GitHub Pages adapter retains metadata only. A production endpoint must validate actual bytes, signatures and hashes, run malware scanning and keep documents in private storage.

Restricted commercial reporting adds these future contracts:

- `GET /management/performance-report-options` returns authorised representative, branch and rolling-period choices.
- `POST /management/performance-reports` accepts period mode, dates/month count, representative, branch and selected section IDs, then returns audited private PDF metadata and a short-lived download URL.

Future quotation upload processing must return verified extraction metadata (`quoteNumber`, quotation/expiry dates, currency, subtotal, VAT, commercial total, confidence, parser version and source-file hash). Parsing belongs in the backend; uncertain fields require human confirmation. The customer-safe record API must never return these commercial fields.

All write endpoints require a secure session, CSRF defence, permission, company/assignment/queue scope, optimistic `expectedVersion`, shared validation, idempotency where retries are possible, immutable audit creation and public-safe error envelopes. Upload endpoints additionally require private object storage, allow-listed file types, size limits, malware scanning and short-lived download URLs.

Examples use fabricated UUIDs and names. No endpoint in this proposal is connected to a production server.
# Laboratory calibration API extension

The future `/api/v1/laboratory` contract exposes branch-scoped queues and command endpoints for receipt, stabilisation, inspection, booking, assignment, worksheet revision, calculation, management review, calibration completion, labelling, physical release, PDF generation, certificate review, unsigned generation, signed upload and certificate release. Every mutation requires CSRF/session authentication, permission and company/branch checks, an idempotency key for retry-safe commands and a correlation ID.

Worksheet requests contain structured points/readings, method version, standard IDs, environment and uncertainty sources; they never contain spreadsheet formula strings. Responses separate `rawInput`, `derivedResults`, `validationWarnings` and immutable version metadata. Customer responses omit all four internal structures and expose only safe progress plus explicitly released certificate metadata.

Signed upload uses multipart PDF plus certificate number, issue date and replacement reason. Production responds with digest and `signatureValidation` (`pending`, `valid`, `invalid`); release is blocked until validation is valid. Errors use the common friendly envelope and never disclose storage keys, SQL, stack traces or security rules.

## Technical Support additions

The proposed API adds `POST/GET /rfqs/{rfqId}/technical-support`, plus assignment, start-review, messages, request-information, response, completion, override, attachment download, queue and metrics operations under `/technical-support`. Multipart request bodies separate JSON payloads from optional files. The backend must enforce session, CSRF, company and assignment scope, controlled transitions, the one-time deadline adjustment, document access, idempotency and transactional audit/outbox writes.
