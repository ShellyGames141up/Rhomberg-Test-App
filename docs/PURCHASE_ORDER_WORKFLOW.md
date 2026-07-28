# Purchase Order workflow

Purchase Orders are not accepted during RFQ creation. They enter the workflow only after a customer accepts the current quotation version.

Acceptance requires a PO number, PDF/DOCX/XLSX attachment, and an explicit confirmation that the PO relates to the current version. Submission records immutable PO and document metadata and moves the RFQ to `customer_accepted_pending_rep_verification`; it does not create an order.

The assigned representative or authorised manager verifies the PO. The idempotent conversion creates exactly one order in `awaiting_planning`, snapshots the RFQ lines, customer/company, assigned representative, accepted quotation version and PO metadata, then links all preserved documents. Corrected PO support is represented by `corrected_purchase_order` and `po_correction_required`; production storage must keep every PO version.
