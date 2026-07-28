# Quotation, PO, rejection and document workflow gap review

Reviewed 28 July 2026 against the attached 26-section workflow prompt.

## Result

The attached prompt is **not complete** in the current repository.

The app has a smaller earlier flow: assigned representatives can record a quotation confirmation, customers can acknowledge receipt, and an authorised representative can record externally verified acceptance and convert an RFQ into one order. It also has permission, notification and audit foundations.

Major outstanding requirements include:

- removing all Purchase Order entry/upload controls from initial RFQ submission;
- making a valid quotation attachment mandatory before sending;
- immutable quotation versions and superseding;
- customer quotation download, accept-with-PO and reject-with-required-reason actions;
- corrected-PO verification and an accepted-quotation verification queue;
- rejection, amended quotation, close and reopen loops;
- the expanded RFQ/quotation state machines;
- complete document categories, customer/internal Document Centres and audited downloads;
- the proposed quotation/PO/document database and API endpoints;
- the fabricated full reject/amend/accept/PO/convert scenario and its required tests;
- the requested workflow/security/permission documentation set.

Prompts 13 and 14 are implemented independently of these missing quotation features. The quotation workflow should be completed as its own controlled phase before describing the RFQ-to-order product as finished.
