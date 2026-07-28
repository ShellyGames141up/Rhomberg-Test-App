# Dispatch workspace

Status: implemented for the GitHub Pages mock preview and future API adapter. No production backend, real delivery provider or production document store is connected.

## Purpose and scope

The same React application now provides a desktop-optimised Dispatch workspace for the `dispatch` role. The primary queue contains:

- `awaiting_dispatch`;
- `ready_for_collection`;
- `out_for_delivery`.

`delivered` and `collected` remain in a small handover-confirmed completion queue so Dispatch can perform the mandatory final `Mark completed` step. A Dispatch-owned `on_hold` record is scoped through its stored resume status. Completed orders leave the active Dispatch queue.

The dashboard shows order/RFQ/job/PO references, customer and contact, assigned representative, authorised delivery address or collection branch, fulfilment method, package count, priority/emergency state, Dispatch received time, latest activity, search, filters and sorting.

## Controlled actions

| Action | Exact transition | Required operational detail |
| --- | --- | --- |
| `mark_ready_for_collection` | `awaiting_dispatch` → `ready_for_collection` | `collection`, ready date, packages, customer message |
| `start_delivery` | `awaiting_dispatch` → `out_for_delivery` | delivery method, ready date, packages, courier/driver, customer message |
| `confirm_collection` | `ready_for_collection` → `collected` | collection date, collector, customer message |
| `confirm_delivery` | `out_for_delivery` → `delivered` | delivery date, recipient, courier/driver, customer message |
| `complete_collection` | `collected` → `completed` | final customer message |
| `complete_delivery` | `delivered` → `completed` | final customer message |
| `report_delivery_problem` | `out_for_delivery` → same status | delivery-problem reason and customer message |

The approved methods are `collection`, `company_delivery`, `courier` and `third_party_delivery`. A method must match the order’s original fulfilment choice. Collection and delivery paths cannot be interchanged.

Every action passes through shared form validation, the service layer and the central workflow state machine. React cannot set a status. Optimistic record versions prevent a stale browser action from overwriting a newer update.

## Stored Dispatch record

The mock service stores one current summary plus append-only updates:

```json
{
  "method": "courier",
  "readyDate": "2026-07-25",
  "collectionDate": "",
  "deliveryDate": "",
  "courierOrDriver": "Fabricated Preview Courier",
  "trackingReference": "TRACK-TEST-001",
  "numberOfPackages": 2,
  "deliveryNoteNumber": "DN-TEST-001",
  "recipientName": "",
  "proofOfDelivery": null,
  "customerMessage": "Your order is out for delivery.",
  "internalNotes": "Internal-only preview note.",
  "receivedAt": "2026-07-24T10:30:00.000Z",
  "lastUpdatedAt": "2026-07-25T11:20:00.000Z",
  "updates": []
}
```

`receivedAt`, updater identity, timestamps and audit IDs are service-derived. The browser cannot supply an actor or company scope.

## Proof metadata

Collection/delivery confirmation may include a controlled proof type, reference and optional PDF/image selection. In mock mode:

- only safe metadata is retained;
- file bytes are never written to browser storage;
- the maximum accepted file size is 4 MB;
- no public download URL is invented.

Production must use private object storage, content-type/signature validation, malware scanning, encryption, retention rules, authorised downloads and audit logging. The document record must remain company/order scoped.

## Customer and representative visibility

The service creates separate customer and assigned-representative notifications for release, handover confirmation, completion and a delivery problem. Every successful action also creates workflow and audit events.

Customer projections may contain the public method, dates, courier/tracking detail, package count, delivery-note reference, recipient/collector, explicitly customer-visible proof metadata and customer messages. They must never contain:

- internal Dispatch notes;
- raw delivery-problem or escalation detail;
- internal actor IDs;
- storage keys, provider errors or unscanned document URLs;
- records belonging to another company.

Representatives receive notifications only for assigned records unless wider management permissions apply. Dispatch receives only its queue scope.

## Future API

The mock and API adapters share:

- `dispatch.getWorkspaceOptions()` → `GET /dispatch/workspace-options`;
- `workflow.performAction()` → `POST /orders/{orderId}/workflow-actions`.

JSON is used when no proof file is selected. With a proof file, use multipart:

- `payload`: JSON-encoded workflow request;
- `dispatchProof`: PDF or image.

The private-cloud API must lock and re-read the order, derive actor/role/company from the session, verify permission and exact status, validate the structured Dispatch update, write the update/event/audit/notifications atomically, increment `row_version`, then return the authorised projection.

## Verification

`tests/dispatch.test.mjs`, `tests/workflow.test.mjs`, `tests/mock-services.test.mjs`, `tests/notifications.test.mjs` and `tests/permissions.test.mjs` cover queue scope, search/filter/sort, field validation, fulfilment guards, valid transitions, delivery problems, proof metadata, audit history, customer redaction, notifications and API multipart adaptation.
