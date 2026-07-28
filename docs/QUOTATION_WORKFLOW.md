# Quotation workflow

The application now models quotations as immutable versions. An assigned sales representative starts review, uploads a PDF-preferred quotation, enters its number/date/expiry and a customer message, then sends it through the service layer. A sent version is never overwritten.

The customer sees the current version and complete version history, can download customer-authorised demonstration documents, and must either accept with a PO number, PO attachment and confirmation or reject with a category and meaningful explanation. A rejection preserves the version and reason. An amendment creates the next integer version and supersedes—without deleting—the previous version.

Only the current `awaiting_customer_response` version can be acted on. Version creation and response operations re-check role, assignment, company, current-version and file rules in the domain/service boundary. Production must repeat these checks in the API.

Statuses are defined in `src/domain/quotationWorkflow.js`. The loop ends through acceptance and verified conversion, representative closure after rejection, expiry, cancellation, or authorised manager closure.
