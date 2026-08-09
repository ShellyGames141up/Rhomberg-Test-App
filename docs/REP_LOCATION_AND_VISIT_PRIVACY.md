# Representative location and visit privacy

Production status: disabled pending formal Rhomberg, IT, HR/legal and privacy approval.

- Purpose: verify scheduled customer visits and optionally summarise approved working-hours activity.
- Data: appointment, customer/office coordinates, consent status, one-off distance result, timestamps, confirmation/QR evidence and approximate category totals.
- Collection: explicit visit checks only in mock mode. No continuous background collection and no breadcrumb map.
- Notice: Representatives must see why/when location is used and when collection stops. Customer permission is explicit and never continuous.
- Fallback: customer confirmation or short-lived, one-time, customer-bound QR token.
- Access: Representative sees own records/summary; Sales Manager sees compliance and authorised evidence; Owner sees approved aggregates; Administrator configures locations/policies.
- Retention: configurable. Mock default is 90 days for location events; appointments and immutable audit evidence follow approved record policy.
- Security: server-side permissions, encrypted transport/storage, least privilege, token hashing, replay prevention, audit logging, rate limits and incident monitoring are required.
- Working hours: routine analytics are restricted to configured working hours. A specific scheduled after-hours appointment may request a one-off verification check.
- Decisions: GPS alone must never create an automatic employment or disciplinary outcome.

Public demo data is clearly fabricated. The public build does not request real GPS automatically and cannot enable routine employee tracking.

