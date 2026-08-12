# Sales Representative Workflow

Status: mock implementation with proposed production contract
Last updated: 4 August 2026

## Supported entry paths

Sales Representatives continue to receive, review and mark customer RFQs as quoted. They may also select **Load Customer Order** when an accepted customer order arrived through an approved offline channel and no RFQ exists in Rhomberg Connect.

The action is available to `sales_representative`, `sales_manager` and `administrator`. A Sales Representative can use only assigned customer companies and their own representative identity. Sales Managers and Administrators may act within their wider authorised company scope and select a dedicated representative. Customer, Planning, Expediting, Laboratory, QA, Dispatch, Buyer and generic Manager roles cannot open or submit this workflow.

## Required direct-order information

The form requires:

- an existing authorised company and customer contact;
- an assigned Rhomberg branch and dedicated representative;
- source `email`, `telephone`, `in_person`, `existing_quotation` or `other_approved_source`;
- an explanation when the other source is chosen;
- at least one catalogue product, its valid configuration and per-line quantity;
- customer application/requirement and delivery or collection choice;
- delivery address when delivery is selected;
- quotation number, date and mandatory quotation document;
- Purchase Order number, date and mandatory PO document;
- the five-part representative confirmation;
- a client-generated idempotency key.

Required date, quotation revision, customer note, internal representative note, internal priority and approved supporting documents are optional. Internal notes, priority, origin details and duplicate evidence are removed from customer projections.

PDF is preferred. The current approved preview formats are PDF, DOC, DOCX and supported images, with a 4 MB limit per file and at most eight supporting documents. The mock validates metadata and persists metadata only. Production must revalidate the file signature, extension, media type and size; calculate a cryptographic hash; quarantine and malware-scan the bytes; and store them privately before authorising access.

## Confirmation and creation

Before submission, the Representative confirms that:

1. the quotation was sent to and accepted by the customer;
2. the PO belongs to the selected customer;
3. the quotation and PO relate to the same order;
4. product details and quantities were checked; and
5. the Representative is authorised to load the order.

A successful transaction creates a permanent order reference with `orderOrigin = representative_loaded_order`, source evidence and `awaiting_planning` status. It does not create an RFQ. The service writes immutable order/document audit entries and creates recipient-scoped notifications for the customer, creating Representative and Planning queue. Internal wording identifies **Order loaded by Sales Representative**; customer wording simply says that their order is available and has moved to Planning.

## Duplicate and retry protection

Before creation, the service checks the same company for matching PO number, quotation number, matching product/configuration lines within the recent-submission window, and previous use of the idempotency key. A repeated key returns the existing order. A likely duplicate returns a warning and does not create an order until an explicit authorised confirmation is submitted. The duplicate decision and any confirmation are audited; production policy may require Manager approval for higher-risk matches.

## Source-document correction

Customers can view and download only the current customer-visible quotation and their PO. They cannot replace either document. An assigned Representative or Administrator may upload a new version with a mandatory reason. The previous version remains stored, the order points to the new current version, and upload/replacement/download actions create immutable audit entries.

## Production enforcement

`POST /representatives/orders` must perform permission, company, contact, representative, product, document, duplicate and idempotency validation on the server in one transaction. Browser navigation and validation are usability controls only. See [API_CONTRACT.md](API_CONTRACT.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and [DOCUMENT_ACCESS_MATRIX.md](DOCUMENT_ACCESS_MATRIX.md).

## Responsive Representative experience

Representative Mobile includes the assigned RFQ inbox and detail, quotation workflow, Technical Support hand-off, assigned Clients, visit scheduling, Load Customer Order and user Settings. RFQ and order records expose complete authorised configured-unit detail through the common internal component. Customer urgency controls remain absent, while internal priority stays permission-controlled. Forms stack on compact screens and their primary action remains clear of bottom navigation.
