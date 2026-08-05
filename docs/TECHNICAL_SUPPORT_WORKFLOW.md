# Technical Support workflow

This phase adds a controlled, RFQ-linked Technical Support workflow in mock mode. No production database, document store, email provider or customer data is connected.

## Journey

1. The assigned Sales Representative starts an RFQ review and selects **Technical Support Required**.
2. The service validates the category, question, RFQ line item, internal priority, visibility and confirmation.
3. One active request is created and the quotation target receives a single 24-hour allowance. Repeated messages do not extend it again.
4. A Technical Manager assigns an authorised Technical user, who starts review.
5. Technical Support and Sales use the immutable correspondence thread. Technical Support routes customer questions through the assigned Representative.
6. Customer-safe requests and replies appear in the customer RFQ area; internal messages and documents never do.
7. Technical Support submits a recommendation and completes the review. The final quotation action remains blocked while an active request exists.
8. Only a Sales Manager or Administrator may override the block, with a mandatory audited reason.

## Controlled states

`technical_support_requested` -> `technical_support_assigned` -> `technical_review_in_progress` -> `technical_response_submitted` -> `technical_support_completed`

Information branches use `awaiting_representative_information` and `awaiting_customer_information`. An authorised close uses `technical_support_cancelled`. All changes pass through `src/domain/technicalSupport.js` and the Technical Support service; React does not write statuses.

## Visibility and documents

- Customers see only safe status wording, the revised target, customer-safe messages, explicit information requests and customer-visible attachments.
- Representatives see requests assigned to their RFQs.
- Technical users see requests in their authorised queue; assignment is enforced for response actions.
- Management reporting is permissions-backed and pricing-free.
- Mock attachments retain metadata only. Production must validate type, size and content, scan for malware, use private object storage and authorise every upload/download server-side.
- Messages are append-only. Corrections are new messages; ordinary users cannot edit or delete history.

## Production requirements

The API must use authenticated sessions, CSRF protection, company scoping, representative assignment checks, transactional status changes, immutable audit/outbox writes, private document storage, server timestamps and idempotency. Scheduled workers should create approaching-due and overdue notifications. The browser preview is not a production security boundary.
