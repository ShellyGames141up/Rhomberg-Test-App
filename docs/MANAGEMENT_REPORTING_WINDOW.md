# Management reporting window

The real Company Owner and Sales Manager dashboards default to the latest **31 inclusive UTC calendar dates**: today and the preceding 30 dates. Operational totals count authorised RFQs/orders created in that window; quotation conversion statistics use the quotation date. Converting an RFQ later does not replace its original quotation date.

This is a reporting filter, **not a retention/deletion policy**. No scheduled cleanup, record deletion, certificate alteration or audit pruning is introduced. Existing archive/retention controls continue to apply. A PDF is generated on request from the persisted, authorised records; it is not an immutable daily snapshot of what a dashboard looked like in the past.

Use **Download Operational PDF**, leave **Latest 31 days** selected, choose report sections, and download. The PDF records the reporting dates and generation time. Date-to-date and rolling-month exports remain available for historical records. Every successful export adds an audit event. Commercial amounts are restricted to the Company Owner/Sales Manager with the required database-authoritative permissions; missing verified totals are not estimated.

The 15-minute background check refreshes changed data. It does not deploy a new application release, retain a historical dashboard snapshot, or overwrite unsaved form edits. The current user's successful mutations still refresh immediately.
