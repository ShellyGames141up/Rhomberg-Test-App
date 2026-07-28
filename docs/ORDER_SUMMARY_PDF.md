# Order-summary PDF and email sharing

Prompt 12 adds a controlled internal export surface to every operational order workspace.

## Copy types

- **Customer-safe copy:** Rhomberg branding, order/RFQ references, authorised customer contact, representative, PO/job references, approved configuration, requirements, operational progress, Dispatch detail, relevant dates and customer-visible timeline.
- **Internal operational copy:** all customer-safe content plus authorised Planning, Expediting and Dispatch notes and document references.

Both copies exclude private price-engine output. The customer copy additionally excludes all internal notes, staff-only comments, audit/provider metadata and unapproved technical fields. The safe copy is constructed from an allow-list projection rather than by redacting an internal document.

## Mock behaviour

- PDFs are generated with `pdf-lib` and can be previewed or downloaded.
- Every generation appends `order_summary.pdf_generated`.
- Email sharing validates the recipient and records a simulated `email_sent` result.
- No network email call is made.
- External manual recipients require explicit confirmation.
- Internal operational copies cannot be sent externally.
- Every simulated send appends `order_summary.email_sent`.

## Production integration

The future API generates documents server-side, stores them in encrypted private object storage and returns only short-lived authorised URLs. Email requests enter a transactional outbox and are delivered asynchronously through an approved Microsoft 365 mailbox/application or TLS SMTP relay.

Required controls include least-privilege permissions, secret/certificate rotation, controlled sender identity, domain and recipient policy, attachment scanning/DLP, size limits, idempotency keys, retry limits, dead-letter monitoring, correlation IDs and immutable audit events. No provider credential belongs in the browser bundle, repository or PDF metadata.
