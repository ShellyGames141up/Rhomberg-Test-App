# RFQ quotation and document API contract

All IDs are opaque. Every endpoint requires authentication, server-side company/role/assignment checks, audit logging, optimistic version checks, and idempotency where applicable.

| Method and path | Purpose |
|---|---|
| `POST /rfqs` | Create RFQ without PO/payment fields |
| `GET /rfqs/{rfqId}` | Read authorised RFQ |
| `POST /rfqs/{rfqId}/start-review` | Assigned rep starts review |
| `POST /rfqs/{rfqId}/quotations` | Create immutable draft/version metadata |
| `GET /rfqs/{rfqId}/quotations` | List authorised versions |
| `GET /quotations/{quotationId}` | Read customer-safe or internal projection |
| `GET /quotations/{quotationId}/document` | Authorised short-lived download |
| `POST /quotations/{quotationId}/send` | Send current version |
| `POST /quotations/{quotationId}/accept` | Accept current version |
| `POST /quotations/{quotationId}/reject` | Reject with category/explanation |
| `POST /quotations/{quotationId}/amend` | Create next immutable version |
| `POST /quotations/{quotationId}/purchase-orders` | Upload PO after acceptance |
| `POST /purchase-orders/{id}/request-correction` | Require corrected PO |
| `POST /purchase-orders/{id}/verify` | Rep verifies PO |
| `POST /rfqs/{rfqId}/convert-to-order` | Idempotent conversion |
| `POST /rfqs/{rfqId}/close-rejected` | Close rejected RFQ |
| `POST /rfqs/{rfqId}/reopen` | Manager/admin reopen |
| `GET /rfqs/{rfqId}/documents` | Authorised RFQ Document Centre |
| `GET /orders/{orderId}/documents` | Authorised order Document Centre |
| `POST /documents` | Multipart upload to private quarantine |
| `GET /documents/{documentId}/download` | Audited, time-limited download |

Example send payload (multipart metadata):

```json
{"quotationNumber":"Q-DEMO-001","quotationDate":"2026-07-28","quotationExpiryDate":"2026-08-28","customerMessage":"Fabricated quotation available.","expectedRfqVersion":4}
```

Example acceptance:

```json
{"quotationVersionId":"qv_demo_2","purchaseOrderNumber":"PO-DEMO-14","confirmed":true,"customerMessage":"Please proceed.","idempotencyKey":"demo-accept-001"}
```

Example rejection:

```json
{"quotationVersionId":"qv_demo_1","category":"incorrect_configuration","explanation":"Fabricated connection size should be 1/2 BSP."}
```

Responses return safe document metadata, never a permanent storage URL. Error codes include `FORBIDDEN`, `VERSION_CONFLICT`, `STALE_QUOTATION`, `INVALID_DOCUMENT`, `DUPLICATE_PO`, and `ORDER_ALREADY_CREATED`.
