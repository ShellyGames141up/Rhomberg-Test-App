# Order workflow

An order can only be created when the current quotation was accepted, a PO was supplied, and an authorised representative verified it. Conversion is idempotent: an RFQ with an existing `orderId` returns the prior result and never creates a duplicate.

The created order starts at `awaiting_planning` and retains the existing Planning → Expediting → Dispatch → Delivery workflow. It carries immutable links to the source RFQ, accepted quotation version, PO version, company/customer snapshot, representative and RFQ line items.

Quotation rejection alone can never create an order.
