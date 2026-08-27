# Phase 21 notification architecture

## Server-backed acknowledgement and refresh

See [live updates and notifications](LIVE_UPDATES_AND_NOTIFICATIONS.md) for migration 019's recipient-only UPDATE policy, transactional read audit events, order-aware links and five-minute authenticated revision checks. Partial acknowledgement responses preserve notification content in the UI. Cross-recipient updates remain denied; polling does not supply authorization or create notifications.

`src/domain/notifications.js` defines events and delivery records; service implementations decide recipients only after a successful workflow transaction. React reads the notification service and cannot fabricate a workflow event.

Phase 21 adds recipient-scoped events for Laboratory receipt/progress/release, certificate upload, QA entry/failure/rework/reinspection/pass, receipt from Laboratory, and Dispatch physical receipt. Customer wording excludes technical blame and internal notes. Representatives receive their assigned records; Expediting and department users receive relevant queues; management receives only permissions-backed summaries.

Mock mode fully persists in-app notifications in the current browser and simulates `email_*` and `push_*` delivery states. It sends nothing externally.

Production delivery needs an outbox worker, Microsoft 365 or approved SMTP connection, mobile push provider, templates, suppression/preferences, retry/backoff, idempotency, bounce handling, delivery audit, monitoring and correlation IDs. Credentials belong in a secrets manager. Recipient addresses must be resolved server-side from authorised records and validated immediately before send.

## Technical Support events

The central catalogue includes request submitted, assignment, information required/received, response submitted, review completed, quotation deadline extended and override-used events. Customers receive safe wording only. Technical roles receive queue notifications, the assigned Representative receives RFQ-linked updates, and Sales Management receives deadline and override oversight. Mock mode persists in-app delivery and simulates email/push; production approaching-due and overdue events require a scheduled outbox producer.
