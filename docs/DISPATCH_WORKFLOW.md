# Dispatch workflow

Dispatch is a desktop workspace and a separate physical custody boundary.

## Receipt control

Every order entering Dispatch must use `Confirm Received in Dispatch`, including orders from Laboratory, QA, Expediting or an authorised Planning exception. Receipt records the receiving user, source department, time, package count, an optional internal note, a customer-safe message and an exception reason where needed.

Collection/delivery preparation is blocked until receipt exists. This prevents a status-only upstream handoff from being mistaken for physical custody.

## Handover actions

- Collection: mark ready, notify customer/representative, record collector, date and optional proof, then complete.
- Delivery: mark out for delivery, record courier/driver and tracking reference, confirm recipient and optional proof, then complete.
- Delivery problems and holds retain internal detail while exposing only approved customer wording.

Internal dispatch notes and proof-document metadata are withheld from customers unless a document is explicitly classified and authorised for customer use. All receipt, readiness, delivery, collection and completion actions are audited and notify only record-scoped recipients.

## Responsive operating surface

Dispatch remains desktop-optimised. Its queue shows order/job/PO references, customer, contact, representative, fulfilment choice, authorised address, packages, notes, receipt date and status with search and filters. The queue changes to labelled cards before columns can clip. Complete configured-unit, certificate and handover details remain expandable, and the active confirmation action uses the shared safe-area action contract on narrower devices.
