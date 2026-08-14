# Phase 21 order workflow

This document describes the controlled mock workflow and the future server contract. React never changes a status directly; every action passes through the service layer and `src/domain/workflow.js`. Production must repeat every permission, state, evidence and company-scope check on the API.

## Order origins

The platform now supports two separately traceable paths into the existing order workflow:

```text
customer_submitted_rfq_order
Customer RFQ -> quotation -> external acceptance verified -> order -> awaiting_planning

representative_loaded_order
Approved offline instruction -> representative validates quotation + PO -> order -> awaiting_planning
```

A representative-loaded order does not create a synthetic RFQ. It records the authorised company and contact, assigned branch and representative, approved source, immutable item/configuration snapshots, mandatory current quotation and PO documents, confirmation evidence, duplicate result and creating user. From `awaiting_planning` onward it uses the same controlled state machine, queues, notifications and audit history as an RFQ-derived order.

Customers cannot set urgency on an RFQ or order. Customer forms omit those controls and customer submissions containing `emergency`, `urgent`, `priority` or `internalPriority` are rejected. Internal priority remains available only through permission-controlled internal workflows.

Repeated representative submissions use an idempotency key. Likely duplicates are compared by company, PO number, quotation number, product/configuration signature and recent submission time. A separately authorised confirmation is required before a likely duplicate is created and that decision is audited.

```text
Customer RFQ
     |
Representative
     |
Planning
     |
     +-- SANAS or Traceable required
     |        |
     |        v
     |      Laboratory
     |        |
     |        +-- physical release --> Expediting or Dispatch receipt
     |        +-- certificate queue remains open until every unit PDF exists
     |
     +-- No Laboratory requirement
              |
              v
          Expediting
              |
              v
              QA
        +-----+------+
        |            |
      Passed       Failed
        |            |
        v            v
     Dispatch    Production / Expediting
                         |
                         v
                    QA reinspection
```

## Routing invariants

- Planning decides the route from persisted order-item configuration.
- A SANAS or Traceable unit creates one calibration unit and one certificate requirement per physical quantity.
- Laboratory orders bypass ordinary QA because the Laboratory owns their calibration-quality control.
- Non-Laboratory orders cannot bypass QA without an authorised, reasoned and audited override.
- QA failure creates a new rework cycle. A later pass never overwrites an earlier failure.
- Dispatch readiness or delivery actions require a separate physical receipt.
- Physical Laboratory release and certificate completion are independent. A certificate may be uploaded after the unit leaves the Laboratory.

## Status ownership

| Department | Owned states |
| --- | --- |
| Planning | `awaiting_planning`, `planning_in_progress`, `planned` |
| Laboratory | `submitted_to_lab`, `lab_received`, `calibration_in_progress`, `calibration_on_hold`, `calibration_completed`, `awaiting_lab_release` |
| Expediting | `submitted_to_expediting`, `expediting_in_progress`, `returned_to_expediting`, rework |
| QA | `awaiting_qa`, `qa_in_progress`, `qa_failed`, `qa_reinspection_required`, `qa_passed` |
| Dispatch | `awaiting_dispatch`, `ready_for_collection`, `out_for_delivery`, `delivered`, `collected` |

Every important action creates an immutable audit entry and, when customer-visible, a simplified tracking entry. Internal notes are excluded from customer projections.

RFQ Technical Support is completed before quotation/order conversion and does not change order statuses. See [TECHNICAL_SUPPORT_WORKFLOW.md](TECHNICAL_SUPPORT_WORKFLOW.md). Customer RFQ urgency controls remain removed; existing authorised internal order priority remains unchanged.
# Laboratory launch routing amendment

Orders containing unit-level **Yes — SANAS** or **Yes — Traceable** requirements create Laboratory certificate tasks. Each physical quantity creates one calibration-unit certificate requirement and carries the immutable recipient snapshot from the RFQ. Certificate completion updates status/reporting but does not silently alter the separate physical fulfilment state.
