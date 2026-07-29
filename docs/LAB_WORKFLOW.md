# Laboratory workflow

The Laboratory workspace is desktop-only and available to `laboratory_user` and `laboratory_manager`. Its queue contains only orders routed by Planning because at least one physical unit requires SANAS calibration or a Traceable certificate.

## Unit-level model

For a line quantity of five, the service creates five calibration units and five certificate requirements. Each unit retains its order, line item, model, description, configuration, job number, calibration type, urgent flag, status, optional serial number, acting Laboratory user and timestamps.

One certificate can satisfy only one unit. The mock service and proposed database both reject a second certificate for the same unit.

## Actions

1. `Confirm Received in Lab` records the actor/time, moves all routed units to `lab_received`, creates timelines, audit history and scoped notifications.
2. Unit updates record calibration start, progress, hold, completion and serial metadata.
3. `Ready to leave Lab` is allowed only after the physical calibration work is complete.
4. Physical release selects Expediting or Dispatch. The receiving department must confirm receipt separately.
5. Certificate work remains in the permanent certificate queue even after physical release.
6. `Archive Lab task` requires physical release, every required unit certificate, no correction requirement, no active work, and no legal-hold or investigation flag.

## Visibility

Customers receive concise progress wording and only their own company records. Representatives see status/number/upload date but do not receive permanent certificate-file access. Planning, Expediting, QA and Dispatch see status only. Laboratory, Manager, Administrator and the authorised customer may create an audited download.

## Monthly tracker

Month filtering reports SANAS/Traceable orders and units, certificate counts per unit, pending certificates, average Laboratory turnaround, average certificate-upload delay, urgent completions and outstanding work. These browser-calculated metrics are fabricated preview data; production should calculate from immutable events or approved materialised aggregates.
