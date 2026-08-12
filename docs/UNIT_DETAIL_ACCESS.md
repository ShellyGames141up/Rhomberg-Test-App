# Unit-detail access

Rhomberg Connect uses one `ConfiguredUnitDetails` component for Sales, Planning, Expediting, Laboratory, Quality Assurance, Dispatch, Management and Administration. This prevents departments from receiving different or incomplete interpretations of the same configured product.

Authorised internal views may show product identity, quantity, selected configuration, customer-approved requirements, certificate requirement, handover type, packages, delivery-note reference, tracking reference and approved document references. The component applies the central protected-field policy and does not render private pricing, audit metadata, staff-only notes, sensitive internal calculations or unapproved technical information.

Customers use a separately projected order view. They see only their company records and customer-approved configuration/progress. They never receive the internal Sales Order Number, internal notes, audit detail, override evidence or staff-only document metadata. Permission and company-isolation tests protect these boundaries; UI hiding is not the security boundary.

Long values wrap, desktop details remain aligned, and narrow screens use expandable labelled cards without page-level horizontal overflow.
