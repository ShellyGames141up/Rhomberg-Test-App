# Planning workflow

Planning receives accepted customer orders and representative-loaded orders in `awaiting_planning`. Its desktop queue supports search, status/priority filters, readable ageing and labelled responsive cards before desktop columns can clip.

Planning records the internal job number, Sales Order Number, Purchase Order reference, planned dates, route, required operational details and customer-safe message. The Sales Order Number is internal-only and excluded from customer responses. Complete configured-unit detail is available through the common protected component.

The form presents only required operational fields, groups related inputs, removes repeated internal-record banners and uses one column on mobile. Invalid date order, past estimates, duplicates and incomplete required evidence produce friendly errors. A successful controlled action sends the order to the correct next queue, creates an immutable audit event and produces scoped notifications.
