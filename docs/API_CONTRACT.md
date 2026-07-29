# Phase 21 API contract

The canonical machine-readable proposal is [api/openapi.yaml](api/openapi.yaml). The historical detailed narrative remains in [API-CONTRACT.md](API-CONTRACT.md).

Phase 21 adds contracts for Laboratory queues/receipt/unit updates/release, receipt from Laboratory, one-PDF-per-unit certificate upload and audited download, Laboratory archive, QA queue/actions/rework, Dispatch receipt, credential-change challenge/confirmation, dedicated representative assignment, and pricing-safe operational analytics.

All write endpoints require a secure session, CSRF defence, permission, company/assignment/queue scope, optimistic `expectedVersion`, shared validation, idempotency where retries are possible, immutable audit creation and public-safe error envelopes. Upload endpoints additionally require private object storage, allow-listed file types, size limits, malware scanning and short-lived download URLs.

Examples use fabricated UUIDs and names. No endpoint in this proposal is connected to a production server.
