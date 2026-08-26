# RFQ workflow

The canonical RFQ state machine remains in `src/domain/workflow.js`. Customer RFQs contain no emergency, urgent or internal-priority input. Forged urgency fields are rejected at the validation/service boundary, while authorised internal departments retain their existing priority controls.

Customer registration creates no sales assignment. On the first RFQ, the customer selects only from active representatives eligible for the company's stored area. Submission atomically establishes the company's Dedicated Representative and snapshots that representative onto the RFQ. Subsequent RFQs use the relationship automatically and the customer cannot substitute another representative. An authorised Administrator may later reassign the company relationship with a reason; existing RFQs retain their original representative snapshot and audit history.

RFQ quotation flow: `draft` -> `submitted` -> `assigned_to_rep` -> `under_rep_review` -> `quoted` -> `awaiting_customer_acceptance` -> `accepted` -> `converted_to_order`. Cancellation and expiry remain controlled alternatives.

During `assigned_to_rep` or `under_rep_review`, an authorised representative or manager may open a linked Technical Support cycle. The RFQ status does not become a technical status; the linked request has its own controlled state machine. While that request is active, `mark_quoted` is rejected with `TECHNICAL_REVIEW_PENDING`, unless a Sales Manager or Administrator recorded a reasoned override. Completion clears the block without skipping RFQ stages.

Customer wording states only that a technical review is required, information is needed, the review completed, or the quotation timeline was revised. Internal questions, calculations, risks, notes, assignments and override reasons remain outside customer projections.
