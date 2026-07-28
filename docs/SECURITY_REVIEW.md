# Document and workflow security review

The GitHub Pages build is demonstration-only. It stores fabricated metadata, generates no permanent private URL, and must contain no real quotation, PO, price-book, credential, key or secret.

Production requirements:

- private object storage with encryption at rest and backup/recovery;
- authenticated download endpoints returning short-lived signed access;
- server-side role, assignment, branch, workflow-stage and company checks;
- strict size limits, extension/MIME agreement, safe filenames and empty-file rejection;
- malware scanning and quarantine before a document becomes active;
- TLS in transit, integrity hashes, immutable versions, retention and archival rules;
- append-only upload/download/denial/supersede/archive/delete-request audit events;
- idempotency keys and database uniqueness constraints for PO submission and order conversion.

Client validation is usability only. The API is authoritative.
