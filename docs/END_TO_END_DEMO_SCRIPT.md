# End-to-end demonstration

Use fabricated test accounts and documents only.

1. Sign in as the Cape customer and submit an RFQ; confirm no PO control exists.
2. Sign in as Sales, start review and try to send without a quotation file; confirm the action is blocked.
3. Upload fabricated `Q-DEMO-V1.pdf`, enter the required metadata/message and send Version 1.
4. As the customer, download Version 1 and reject it with category plus explanation.
5. As Sales, open Rejected Quotations and submit fabricated Version 2.
6. As the customer, download Version 2, accept it, attach fabricated `PO-DEMO.pdf`, confirm and submit.
7. As Sales, open Accepted Quotations Awaiting Verification, review both files, confirm verification and create the order.
8. Confirm the order appears in Planning as `awaiting_planning`.
9. Confirm internal users can access only stage-relevant documents.
10. Confirm the customer Document Centre contains quotation, own PO and authorised delivery/courier documents only.

Automated coverage: `tests/quotation-document-workflow.test.mjs` and `tests/mock-services.test.mjs`.
