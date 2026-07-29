# Phase 21 notification architecture

`src/domain/notifications.js` defines events and delivery records; service implementations decide recipients only after a successful workflow transaction. React reads the notification service and cannot fabricate a workflow event.

Phase 21 adds recipient-scoped events for Laboratory receipt/progress/release, certificate upload, QA entry/failure/rework/reinspection/pass, receipt from Laboratory, and Dispatch physical receipt. Customer wording excludes technical blame and internal notes. Representatives receive their assigned records; Expediting and department users receive relevant queues; management receives only permissions-backed summaries.

Mock mode fully persists in-app notifications in the current browser and simulates `email_*` and `push_*` delivery states. It sends nothing externally.

Production delivery needs an outbox worker, Microsoft 365 or approved SMTP connection, mobile push provider, templates, suppression/preferences, retry/backoff, idempotency, bounce handling, delivery audit, monitoring and correlation IDs. Credentials belong in a secrets manager. Recipient addresses must be resolved server-side from authorised records and validated immediately before send.
