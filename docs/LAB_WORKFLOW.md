# Laboratory calibration workflow

This local mock implements one controlled, unit-level workflow for the Cape Town and Johannesburg laboratories. It supports Pressure and Temperature work without merging their methods, templates or uncertainty models. Every customer line quantity becomes that number of physical calibration units; each unit receives its own job number, immutable worksheet revisions, certificate number and certificate versions.

## Controlled journey

1. Planning routes a qualifying unit to its authorised laboratory branch.
2. Laboratory receipt records condition, packaging, customer documents, actor and time.
3. Thermal stabilisation records its start, ambient temperature and confirmed equilibrium.
4. Inspection records the controlled outcome and routes rejected or quote-required units safely.
5. Booking captures instrument identity, range, resolution, method, certification type and urgency; the service allocates branch-aware job and certificate references.
6. A permitted technician selects a valid, in-calibration reference standard and records structured raw readings.
7. Named calculation functions create rounded derived values and a versioned uncertainty budget. Raw inputs lock after calculation; corrections create a new revision.
8. Laboratory Management records a review of unresolved formula/template warnings. The mock acknowledgement is not technical approval.
9. The technician completes calibration, labels the instrument and signs off physical transfer to Dispatch or Expediting.
10. Management generates an internal review PDF, draft certificate and final unsigned certificate, then uses the approved external signing process.
11. A permitted manager uploads the signed PDF. The service validates PDF metadata, hashes it, preserves superseded versions, and requires an explicit recipient rule before release.
12. Authorised recipients receive scoped notifications. Downloads and releases create immutable audit events.

## Separation and access

Technicians can enter raw data only for their assigned/authorised branch. Managers review but do not overwrite raw readings. Technical signatories approve certificate progression. Administrators may maintain approved configuration but cannot alter audit history or signed files. Customers see only safe progress and explicitly released certificates belonging to their own company; raw readings, internal notes, calculations, management comments and audit metadata are never included in customer projections.

The browser stores fabricated mock data only. Production requires backend transactions, row-level company and branch scope, protected object storage, malware scanning, immutable event storage, server-side reference allocation and approved identity controls.

> Software implementation completed against supplied reference templates; technical validation and formal approval remain required from authorised Rhomberg Laboratory Management and Technical Signatories.
