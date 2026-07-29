# Quality Assurance workflow

QA is a desktop-only final gate for non-Laboratory orders. Roles are `quality_assurance` and `quality_manager`.

## Normal path

Expediting completes required production steps and submits to `awaiting_qa`. QA starts an inspection, recording the inspector, date and checklist reference. A pass requires checklist confirmation and confirmation that the units meet requirements. The service preserves an inspection attempt, notifies authorised recipients, moves to `awaiting_dispatch`, and requires Dispatch to confirm physical receipt.

## Failure and rework

`Report Quality Problem` requires:

- category and detailed description;
- affected line item/unit;
- severity and date found;
- return destination;
- customer-safe message and internal note;
- an explanation when category or destination is `Other`.

Initial destinations are Planning, Materials, Stores, Assembly, Production, Calibration/Testing, Expediting, Documentation, Packaging and Other.

A failure creates an immutable failed inspection and a numbered rework cycle. Expediting regains active control, records correction progress and resubmits to QA. Reinspection creates a new inspection attempt. Previous failures remain visible internally; customers receive a simplified, blame-free timeline.

## Reporting and privacy

Monthly metrics include orders/units inspected, first-pass count, first-inspection failures, reinspections, final passes, current rework and timing measures. Trends focus on product and process—not individual employee blame. Internal notes, staff identifiers and diagnostic detail never enter customer payloads.
