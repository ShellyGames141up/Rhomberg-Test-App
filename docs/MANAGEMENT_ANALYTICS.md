# Management analytics

The Company Owner/Manager view is an operational information dashboard. It includes stage averages, open/completed/delayed/cancelled/urgent totals, Laboratory and certificate counts, QA first-pass/rework rates, Dispatch completion, order/unit totals, branch, representative, customer and product breakdowns.

The Sales Manager view remains representative-focused: RFQs, quotations, conversions, response/quotation time, queue ageing, customer assignments, branch totals and exceptions. Reassignment actions require a dedicated permission and audit event.

All quantity metrics sum line-item quantities, not order rows. A ten-unit PBB line counts as ten units. Timing uses immutable workflow timestamps. Browser results are fabricated demo calculations; production should calculate in authorised API queries or approved aggregates.

Protected pricing, margin and revenue are excluded. A disabled revenue placeholder documents future intent but returns no value unless a later approved phase adds a protected data source and explicit permission.
