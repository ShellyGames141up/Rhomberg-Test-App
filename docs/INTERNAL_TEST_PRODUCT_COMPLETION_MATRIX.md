# Internal-test product completion matrix

This audit describes the repository state at commit `7ab0adb22415c5e0802157e5240462c36a4a1277` before the internal-test completion implementation. It is intentionally stricter than the public demonstration: a polished mock screen is not counted as a working staging capability.

## Baseline findings

- The React application and public demonstration contain mature workflows and reusable domain rules.
- The staging API implements the authentication/bootstrap and initial RFQ vertical slice, plus public catalogue reference routes.
- The API adapter declares 159 unique application contracts. At baseline, 25 are implemented, 130 are missing, and four `PATCH` contracts are transport-incompatible.
- `createPhase1WorkspaceService` returns truthful but non-persistent empty/default responses for orders, notifications, audit, drafts and settings. These responses are not operational implementations.
- PostgreSQL migrations 001–003 contain identities, sessions, companies, representatives, products, RFQs, RFQ items, document metadata, notifications, audit events and idempotency records. Later workflow storage is absent.
- The public GitHub Pages demonstration has extensive fabricated data and browser persistence. It is build-time separated and must never become a staging fallback.

## Module readiness before implementation

| Feature / module | UI | API contract | Backend logic | Database | Permissions | Persistence | Tests | Baseline status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sign-in/session/logout | Present | Present | Implemented | Implemented | Server enforced | PostgreSQL | Backend/security | Working |
| Initial Administrator bootstrap | CLI/server only | N/A | Implemented | Implemented | One-time authoritative bootstrap | PostgreSQL | Real PostgreSQL/security | Working |
| Administrator user creation | Present | Present | Partial | Internal users only | `administer_users` | PostgreSQL | Backend/UI | Partial |
| Administrator account lifecycle | Present | Present | Missing | Missing lifecycle fields/history | UI-only declarations | None | Mock only | Missing |
| Companies/customer contacts | Present | Present | Missing | Core company membership exists | Not fully implemented | None through UI | Mock only | Missing |
| Product catalogue | Present | Present | Implemented read-only | Approved source module, product table not authoritative | Public read | Build/runtime reference | Integrity/security | Working read-only |
| RFQ draft | Present | Present | Empty placeholder | Missing | Authentication only | None | Startup only | Missing |
| RFQ submission/retrieval | Present | Present | Implemented vertical slice | Implemented | Company/RLS enforced | PostgreSQL + private storage adapter | Real PostgreSQL/security | Working vertical slice |
| Representative RFQ inbox | Present | Present | Missing | RFQs exist | Declared only | PostgreSQL data inaccessible through route | Mock only | Missing |
| RFQ workflow/quotation | Present | Present | Missing | Status model too narrow | Domain rules exist client-side | None server-side | Domain/mock only | Missing |
| Representative-loaded order | Present | Present | Missing | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Orders and tracking | Present | Present | Empty placeholder | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Planning | Present | Present | Options placeholder only | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Expediting | Present | Present | Options placeholder only | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Laboratory/certificates | Present | Present | Options placeholder only | Missing | Detailed domain permissions exist | None | Domain/mock only | Missing |
| Quality Assurance | Present | Present | Options placeholder only | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Dispatch | Present | Present | Options placeholder only | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Technical Support | Present | Present | Missing | Missing | Domain permissions/rules exist | None | Domain/mock only | Missing |
| Notifications | Present | Present | Empty placeholder | Initial RFQ notifications only | Recipient RLS exists | PostgreSQL only for RFQ creation | Domain/mock only | Partial |
| Audit trail | Present | Present | Empty placeholder | Append-only table/trigger exists | Admin-only route | PostgreSQL writes, no real list | Security/DB | Partial |
| Archive/retention | Present | Present | Missing | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Locations/client visits | Present | Present | Missing | Missing | Domain permissions exist | None | Domain/mock only | Missing |
| Management overview/reporting | Present | Present | Missing | Derivable after operational storage | Domain permissions exist | None | Domain/mock only | Missing |
| Account settings/personalisation | Present | Present | Defaults only; mutations missing | Missing | Own-account scope intended | Browser theme only | Mock only | Missing |
| Order PDF/email | Present | Present | Missing | Missing generated-document metadata | Domain permissions exist | None | Mock only | Missing |
| Buyer | Prepared UI/role | Contracts not approved | Intentionally inactive | Not required | Sign-in only | N/A | Role tests | Intentionally unsupported |

## Contract classification

### Required for internal testing

The missing contracts backing visible, authorised staging screens are required: account/company administration, RFQ inbox and workflow, drafts, orders, representative-loaded orders, Planning, Expediting, Laboratory, QA, Dispatch, Technical Support, notifications, audit reads, archive/retention, locations/client visits, management views and user settings. The four `PATCH` calls are also required and need a real `HttpClient.patch` transport plus explicit CORS support.

### Intentionally unsupported for this release

- Buyer procurement actions: the role remains prepared but inactive because no approved procurement workflow exists.
- Real outbound email/push delivery: in-app records may be persisted, while external delivery remains simulated/pending until IT supplies approved infrastructure.
- Production malware scanning and signed cloud download URLs: metadata and access control can be exercised with the private local-storage adapter, but production scanning/storage remains an IT deployment dependency.
- Real commercial pricing: explicitly excluded from the customer-facing application.

### Duplicate/obsolete contracts

- `/admin/overview` and `/administration/overview` are compatibility aliases for one administration overview service.
- Legacy granular Laboratory action aliases may remain as compatibility routes only when they call the same authoritative unit-transition service; they must not create separate state paths.
- `personalisation` appearance data and `user settings` appearance data must share one server-authoritative settings record instead of diverging browser stores.

## Implementation order

1. Expand authoritative roles, permissions and PostgreSQL schema with RLS-protected settings, drafts, operational orders, events, documents, technical requests, locations and retention records.
2. Replace Phase-1 placeholders with repository-backed workspace services and add PUT/PATCH/DELETE transport support.
3. Implement account/company administration, notification/audit/settings persistence and truthful empty states.
4. Implement RFQ transitions and representative-loaded orders, then route accepted work through Planning, Laboratory/QA, Expediting and Dispatch.
5. Implement Technical Support correspondence, client visits, archive/retention and management projections.
6. Add real-PostgreSQL integration and browser E2E coverage, then run every production, staging, packaging and preview boundary check.

No release may be classified as ready while a visible authorised screen still depends on a missing route, mock fallback or browser-only operational record.

## Completion Pass 2 checkpoint (uncommitted)

The current working tree closes every active API-mode contract and adds migrations 004–011. It remains uncommitted pending final regression and review.

### Current release-gate evidence

| Gate | Result |
| --- | --- |
| API adapter/backend parity | 130 implemented, 0 missing, 0 incompatible |
| Simplified Laboratory | Manager queue, PDF upload/batch/replacement/archive, private retrieval, scan-state gate, company/order authorization, notifications and audit implemented |
| Document handling | Authenticated private-content retrieval, safe response headers, company/workflow authorization, versioning and audited downloads implemented; production malware scanner remains an external IT dependency |
| Administration | Employee/customer-company creation plus profile, status, archive, roles, branch, permission overrides, preferences, temporary-password action, company representative, login/audit history and catalogue overrides implemented |
| Governance | Archive approval, archive, restore, legal hold, deletion request, retention export, generated PDFs and simulated delivery records implemented and audited |
| Client visits | Assigned-client directory, scheduling, start, location/customer/QR verification, completion, missed-visit detection, compliance and work summary persisted |
| Management | Search/filter projections, operational counts, quantity breakdowns, authorised CSV/PDF export, reassignment and override approval derive from persisted authorised records |
| Settings | Settings, notification preferences and personalisation use the repository/service layer and persist in PostgreSQL |
| Real PostgreSQL 17 | PostgreSQL 17.10 disposable instance: migrations 001–011 empty/repeat PASS; runtime grants, RLS, auth/session, RFQ transaction, advisory-lock idempotency, audit immutability, settings and visits PASS |
| Automated route/view checks | Active customer and internal screen matrix, role navigation, responsive/overflow and meaningful-state tests PASS |
| Real Chrome acceptance | Not executed: the Chrome-control connector reports `Browser is not available: chrome`; manual staging acceptance remains required and must not be represented as completed |

### Disposition of the 88 previously missing contracts

**Implemented (58):**

- Administration (12): `POST /admin/users/:accountId/archive`, `GET /admin/users/:accountId/audit`, `POST /admin/users/:accountId/branch`, `GET /admin/users/:accountId/login-history`, `POST /admin/users/:accountId/profile-image`, `POST /admin/users/:accountId/roles`, `POST /admin/users/:accountId/temporary-password`, `PUT /administration/companies/:companyId/representative`, `PUT /administration/users/:accountId/notification-preferences`, `PUT /administration/users/:accountId/permissions`, `PUT /administration/users/:accountId/status`, `POST /administration/workflow-records/:recordId/corrections`.
- Client visits/workspace (10): all seven `/appointments/:appointmentId/...` actions, `POST /clients/:clientId/appointments`, `POST /auth/workspace`, and `GET /representatives/appointments`.
- Simplified Laboratory (6): `GET /laboratory/dashboard`, `GET /laboratory/orders`, certificate archive, batch upload, single upload and controlled replacement.
- Management/notifications (6): report options, CSV/PDF reports, representative reassignment, workflow-override approval and notification delivery retry.
- Governance/documents (12): archive approval/archive/restore/legal hold/deletion/retention export, source-document listing/versioning, summary email/PDF/options, and authenticated technical RFQ PDF.
- QA and visit reporting (7): QA dashboard/queue, representative clients/activity/work summary, missed-visit detection and visit compliance.
- Personalisation (5): read/save/reset personalisation plus private image upload/delete.

**Reconciled or obsolete under approved scope (30):**

- Public self-registration and browser credential-change challenges (3) were removed from the staging adapter. Administrator-provisioned accounts remain server authoritative; future identity recovery belongs to the approved identity-provider integration.
- Four download declarations were reconciled to the shared authenticated binary-download transport rather than duplicate JSON contracts: generic certificate download, Laboratory document download, order source-document download and Technical Support attachment download.
- Twenty-three granular technician/calibration/certificate-authoring Laboratory contracts were removed from the active adapter because the approved launch workflow is explicitly the simplified Laboratory Manager certificate workflow. These are: generic unit action, technician assignment, book-in, calculate, calculation approval, calibration hold/start, certificate approval/release/return/signed-PDF/review/unsigned-PDF, complete calibration/labelling, draft/review PDF generation, inspection, receive, release to Dispatch, stabilisation start/complete and worksheet save. They are deferred—not represented as implemented.

### Disposition of the three previously incompatible contracts

`PATCH /administration/catalogue/:kinds/:itemId`, `PATCH /administration/companies/:companyId`, and `PATCH /administration/users/:accountId` now use the shared credentialed, CSRF-protected `HttpClient.patch` transport and matching server routes.

### Remaining external/manual acceptance

Before real company data or a staging release is approved, IT must provide/approve malware scanning and managed private-object storage, external identity/recovery, email/push delivery, secrets and backups. A human must execute the Chrome checklist against the deployed staging artifact, covering every active role, refresh/re-login persistence, the RFQ-to-archive lifecycle, file downloads, unexpected console errors and unexpected HTTP failures. These are staging acceptance dependencies rather than locally unresolved API contracts.
