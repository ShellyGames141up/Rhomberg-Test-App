# Document Access Matrix

Status: proposed production policy, simulated in mock mode
Last updated: 4 August 2026

All source documents are private by default. A document is accessible only when the verified user can access its parent order and the document policy permits that document kind. Production downloads must use a short-lived authorised URL or authenticated stream; permanent public object URLs are prohibited.

| Document/action | Customer | Assigned Sales Representative | Sales Manager | Planning / Expediting / Lab / QA / Dispatch | Manager | Administrator |
| --- | --- | --- | --- | --- | --- | --- |
| Current customer quotation: view/download | Own authorised company | Assigned order | Authorised scope | Authorised order/queue when operationally required | Authorised scope | Yes |
| Current customer PO: view/download | Own authorised company | Assigned order | Authorised scope | Authorised order/queue when operationally required | Authorised scope | Yes |
| Internal supporting document | No | Assigned order | Authorised scope | Authorised order/queue when operationally required | Authorised scope | Yes |
| Replace quotation or PO | No | Assigned order, reason required | No by default | No | No by default | Yes, reason required |
| View superseded versions | No by default | Assigned order | Authorised scope | No by default | Authorised scope | Yes |
| Upload direct-order quotation and PO | No | Through **Load Customer Order** | Through authorised load action | No | No | Yes |

## Mandatory safeguards

- Company scope and assignment are resolved from the authenticated server session, never a browser-supplied role or company alone.
- Customers receive only `customerVisible = true` quotation/PO projections for their authorised company.
- Every upload, replacement and download creates an append-only audit event with safe metadata; raw document bytes and sensitive contents are not copied into audit logs.
- Replacement creates a new version, marks the previous version non-current and requires a reason. Historical versions are preserved under retention policy.
- Production upload processing must verify extension, media signature, media type, byte size, non-empty content, duplicate hash and malware scan result before release.
- Object keys, storage credentials, scan-provider details and internal-only notes never appear in customer payloads.
- GitHub Pages stores fabricated metadata only and cannot provide production-secure document storage or download.
