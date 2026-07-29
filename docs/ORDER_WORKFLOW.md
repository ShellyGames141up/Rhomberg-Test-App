# Phase 21 order workflow

This document describes the controlled mock workflow and the future server contract. React never changes a status directly; every action passes through the service layer and `src/domain/workflow.js`. Production must repeat every permission, state, evidence and company-scope check on the API.

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
