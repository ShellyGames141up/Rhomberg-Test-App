# PDF and Email Export

## Current Behaviour

Authorised internal users can generate:

- an internal operational order summary; or
- a customer-safe order summary.

The two documents use separate projections. The customer-safe document excludes internal notes, workflow overrides, protected evidence, private document metadata and operational-only details. Pricing is not included unless a later approved server-side capability explicitly supplies it.

Mock mode generates PDFs in the browser and records simulated email delivery. It does not contact Microsoft 365, SMTP or a customer mailbox.

## Permissions

- `export_order_pdf` controls generation and download.
- `email_order_summary` controls sharing requests.
- Customer document access is separately projected and limited to the authorised company.
- Certificate downloads use Laboratory/certificate permissions.
- Every generation and sharing action creates an audit event.

The future API must repeat all authorisation. A visible button is not permission evidence.

## Proposed API Operations

- `GET /orders/{orderId}/summary-sharing-options`
- `POST /orders/{orderId}/summary-pdfs`
- `POST /orders/{orderId}/summary-emails`
- `GET /documents/{documentId}`

Important mutations require idempotency keys. Downloads should use short-lived authorised responses or streams, never predictable public URLs.

## Production Email Requirements

Innovate IT must decide:

- Microsoft 365 Graph or approved SMTP provider;
- service identity and sender mailbox;
- allowed sender and recipient domains;
- external recipient confirmation rules;
- template and branding approval;
- attachment size and malware policies;
- delivery-status webhooks or polling;
- retry schedule and dead-letter process;
- retention and audit requirements.

Credentials belong in secrets management. Delivery workers must validate recipients, avoid header injection, record correlation IDs and keep personal data out of logs.

## Production Document Requirements

- Private encrypted object storage.
- Malware-scanned uploads and quarantine.
- Company and document-classification metadata.
- Server-side PDF creation from an authorised projection.
- Content hashes and immutable version records.
- Download authorisation at request time.
- Configurable retention and legal holds.
- Backup and restore coverage.

## Known Limitations

Browser-generated mock PDFs and simulated delivery are demonstration aids. They are not permanent records, legally controlled correspondence or proof of successful delivery.
