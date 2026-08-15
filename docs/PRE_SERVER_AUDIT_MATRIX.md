# Pre-server application audit matrix

Audit date: 15 August 2026. All records and credentials used were fabricated. “Pass” means the current mock/service implementation and automated contract tests behaved as designed; it is not a production-security claim.

| Area | Result | Evidence and limitation |
| --- | --- | --- |
| Signup/login/logout/account separation | Pass in mock; server blocked | Authentication, realm separation, employee/customer activation, first-login and account tests pass. Recovery, verification, MFA and authoritative sessions require Innovate IT identity services. |
| Customer onboarding/tutorial | Pass | First-use tutorial, replay, fabricated isolation, branding, settings and feedback tests pass; customer desktop/mobile browser smoke passed. |
| Customer RFQ | Pass in mock | Catalogue/configuration, quantity, multi-line, validation, company/rep routing, idempotency, notification and audit integration tests pass. Customer urgency inputs are absent and rejected by shared validation. |
| Representative RFQ/quotation | Pass in mock | Assigned inbox, review, quotation metadata/version visibility, acknowledgement and transition tests pass. Real Outlook/email and private file bytes remain server work. |
| Technical Support | Pass in mock | Request, assignment, correspondence visibility, information request, single 24-hour extension, quotation block/override, notifications and audit tests pass. |
| Quotation response | Pass in mock | Acceptance/acknowledgement, rejection/amendment/version preservation and conversion contracts are covered. Payment remains outside the app by design. |
| Representative-loaded order | Pass in mock | Required quotation/PO metadata, company/rep scope, confirmation, duplicate/idempotency, Planning/customer notification and audit tests pass. Private bytes require server storage/scanning. |
| Planning | Pass in mock | Queue, start/save/required references, routing and Expediting/Lab hand-off tests pass. Internal urgency remains authorised. |
| Laboratory routing | Pass for approved launch scope | Cape Town/Johannesburg and role/discipline rules are tested through the service permission model. |
| Laboratory launch certificate workflow | Pass | Browser verified inline batch uploader below the order; multi-unit upload, replacement, recipient isolation and completion tests pass. |
| Full technician calibration lifecycle | Deferred/High | The latest approved launch intentionally disables unfinished receipt/stabilisation/worksheet/calculation/sign-off/draft/method-selection navigation. Domain calculations and specifications are tested, but the complete physical UI workflow is not launch-ready and was not re-enabled. |
| Pressure/temperature calculations | Pass at domain/spec level | 6/5/5 Pressure, dynamic Temperature, methods, standards, uncertainty separation and locked calculated fields pass automated tests. Approved golden datasets and accredited Laboratory sign-off are still required. |
| Expediting | Pass in mock | Configurable progress, hold/resume/delay, required steps, customer-safe timeline, notifications and Dispatch hand-off tests pass. |
| QA | Pass in mock | Non-Lab routing, pass/fail, mandatory failure evidence, rework and reinspection history tests pass. |
| Dispatch | Pass in mock | Collection/delivery/courier fields, ready/dispatched/collected/delivered/completed transitions, permissions, notifications and internal-note isolation pass. |
| Documents/PDFs | Pass for mock metadata/generated samples | Company/role projection, version metadata, audit and customer-safe/internal PDFs pass. Private storage, malware scanning, immutable signed bytes and secure download are server blockers. |
| Notifications | Pass in mock | Recipient routing, read/unread, preferences, duplicate rules and simulated email/push delivery states pass. Real provider delivery is absent by design. |
| Administrator/management | Pass in mock | User/company/branch/role/permission/audit, Sales Manager and Owner metrics tests pass. Every sensitive production mutation still requires server authorisation. |
| Executive Demo | Pass | Route, role/scenario controls, snapshots/reset and scenario tests pass. Browser smoke confirmed Laboratory scenario/role switching and zero page overflow. |
| Error handling/network | Pass in frontend contract | Human-readable validation, safe GET retry, mutation no-auto-retry, timeout and public error tests pass. Real outage/upload recovery requires server integration tests. |
| Production/demo separation | Pass static gates | Production build excludes mock services, fabricated credentials, role switching, Executive controls and pricing. Runtime server security remains absent. |

## Responsive and accessibility evidence

Browser checks covered customer desktop at 360×800, 390×844, 412×915, 600×960, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900, 1920×1080 and 2560×1440; representative desktop at mobile through 2560 widths; Customer Mobile at 390×844; and Executive Demo at 360 through 2560. No page-level horizontal overflow or inspected text clipping was found.

Dark-mode desktop produced readable light body text and no overflow. Existing contrast/token, keyboard/focus, reduced-motion, font-scale, safe-area, responsive-table/form and semantic-status automated checks pass. The audit found undersized preview/navigation/clear-search controls; CSS now guarantees 44px utility targets and the browser retest reports no sub-40px visible buttons/links in the tested representative view.

Browser zoom was not programmatically changed by the in-app test surface. Equivalent 80/100/125/150% resilience is covered by responsive widths, rem/clamp typography contracts and existing font-scaling tests; physical-browser zoom remains a manual UAT item.

## Fabricated volume benchmark

The added non-bundled test generated 10,000 RFQs, 10,000 Planning orders, 10,000 Expediting orders and 50,000 notification scope checks. In the last full-suite run on this workstation: RFQ search/filter/sort 22.3 ms; Planning 40.6 ms; Expediting 108.7 ms; notification isolation 29.8 ms. Repeated runs remained below the deliberately generous two-second readiness ceiling. These numbers are indicative only.

The future API contract already requires pagination. Before real large datasets, server-side pagination, indexed search/filter/sort, bounded timelines, document metadata pagination and measured dashboard queries are mandatory. React list virtualisation should be added only after staging measurements show a remaining client-side bottleneck; rendering 10,000 DOM cards is not an approved production design.

## Risk register

### Critical

- No production backend, identity, database, private document store, mail/push worker, monitoring or tested restore path. Real data is prohibited.

### High

- Full technician Laboratory lifecycle is intentionally not active in the launch interface; accredited workflow/business approval is required.
- Production tenant isolation, immutable audit and document access exist as contracts/tests, not an enforceable server boundary.
- Large-data UI must consume server pagination; the mock browser store is not a production database.

### Medium

- Physical Android/iOS tests, native file/camera flows, push, deep links and background/resume tests await native projects and server identity.
- Manual browser zoom, screen-reader and ultrawide UAT remain required on company hardware.
- Store privacy, signing, IDs and support ownership are undecided.

### Low

- Final store screenshots, feature graphics, marketing copy and listing metadata are not prepared, appropriately deferred until the product and privacy design stabilise.
