# Production roles and access rules

## Role definitions

| Role | Intended access |
|---|---|
| Customer | Catalogue, own authorised company profile, own-company RFQs, own-company orders and documents |
| Sales representative | Catalogue plus enquiries and orders for companies explicitly assigned to that representative |
| Planning | Accepted orders awaiting internal job/PO planning and controlled handoff to Expediting |
| Expeditor | Orders submitted by Planning; create controlled fulfilment updates and hand off to Dispatch |
| Dispatch | Orders handed off by Expediting; control collection, delivery and completion actions |
| Buyer | Authenticated role shell only. Its procurement queue and actions remain inactive until an approved Buyer workflow exists |
| Manager | Cross-branch visibility, workflow oversight, audited override and approved reporting |
| Administrator | User, company, role, representative assignment, product and retention administration; audited elevated access |

The application role values are `customer`, `sales_representative`, `planning`, `expeditor`, `dispatch`, `buyer`, `manager` and `administrator`. `system` is a trusted backend actor for automatic assignment/retention actions; it is not a user-selectable role.

## Permission matrix

| Capability | Customer | Sales rep | Planning | Expeditor | Dispatch | Buyer | Manager | Administrator |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Read catalogue | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create RFQ | Own company | No | No | No | No | No | Optional policy | Yes/support |
| Read customer RFQs | Own company | Assigned | No | No | No | No (inactive) | All | All |
| Read orders | Own company | Assigned | Planning queue only | Expediting queue only | Dispatch queue only | No (inactive) | All | All |
| Representative RFQ actions | No | Assigned only | No | No | No | No | Yes | Yes |
| Planning actions | No | No | Yes | No | No | No | Yes | Yes |
| Expediting actions | No | No | No | Yes | No | No | Yes | Yes |
| Dispatch actions | No | No | No | No | Yes | No | Yes | Yes |
| Workflow override | No | No | No | No | No | No | Audited | Audited |
| Manage products/users | No | No | No | No | No | No | No by default | Yes |
| View reports | Own only | Assigned | Queue only | Queue only | Queue only | No (inactive) | Yes | Yes |

Any broader access must be an explicit approved permission, not an assumption based on a job title.

## Application permission catalogue

The reusable source of truth is `src/services/contracts.js`. `src/domain/accessControl.js` consumes it for navigation and record scopes; `src/domain/workflow.js` consumes it for transitions. React components do not compare role names to decide access.

| Role | Main granted permissions |
|---|---|
| Customer | `create_rfq`, `view_own_company_rfqs`, `view_own_company_orders`, `acknowledge_quotation`, `cancel_rfq` |
| Sales representative | `view_assigned_rfqs`, `view_assigned_orders`, `mark_rfq_under_review`, `mark_rfq_quoted`, `accept_customer_order`, `convert_rfq_to_order`, `export_order_pdf`, `email_order_summary` |
| Planning | `view_planning_queue`, `add_planning_information`, `submit_to_expediting`, `manage_order_hold`, `export_order_pdf` |
| Expeditor | `view_expediting_queue`, `update_order_progress`, `move_to_dispatch`, `manage_order_hold`, `export_order_pdf` |
| Dispatch | `view_dispatch_queue`, `confirm_delivery`, `confirm_collection`, `manage_order_hold`, `export_order_pdf` |
| Buyer | `access_internal_workspace`, `read_catalogue`; no operational permission yet |
| Manager | `view_all_rfqs`, `view_all_orders`, operational action permissions, `export_order_pdf`, `email_order_summary`, `override_workflow`, audit/report reads |
| Administrator | Every defined permission, including `archive_orders`, `restore_archived_orders` and `administer_users` |

`export_order_pdf`, `email_order_summary`, `restore_archived_orders` and `administer_users` are permission-ready but their user journeys remain future phases. A permission grant never bypasses state, assignment, company, evidence or fulfilment guards.

Exact operational queue scopes:

- Planning: `awaiting_planning`, `planning_in_progress`, `planned`, plus holds whose stored resume stage belongs to Planning.
- Expediting: `submitted_to_expediting`, `expediting_in_progress`, Expediting-owned holds, plus read-only `awaiting_dispatch` awareness after hand-off.
- Dispatch: `awaiting_dispatch`, `ready_for_collection`, `out_for_delivery`, `delivered`, `collected`, plus Dispatch-owned holds.

## Workflow enforcement

The backend must accept action codes, never arbitrary status assignments. For each action it must re-read the record in a transaction and validate current state, role, representative assignment, company scope, required fields, expected row version and any fulfilment guard. The state update, workflow event, audit event and notification outbox rows must commit atomically.

Manager/administrator override requires a separate reason and comment. It must be visible in audit reporting and cannot silently rewrite history. See `WORKFLOW_STATE_MACHINE.md`.

### Planning controls

The dedicated Planning interface does not widen access. `view_planning_queue` limits ordinary Planning users to `awaiting_planning`, `planning_in_progress`, `planned` and holds owned by those stages. `add_planning_information` and `submit_to_expediting` are separate permissions and both still require the exact state-machine transition.

The backend must:

- derive the acting Planning identity from the session and ignore any browser-supplied actor name;
- reload the assigned Planning user and production location from authorised server records;
- reject an order without its assigned representative;
- require an internal job number, Planning owner and submission date;
- require a customer PO or an explicit authorised exception with a meaningful reason;
- enforce start/completion date order and approved priorities;
- revalidate the persisted Planning record before hand-off to Expediting;
- atomically write the order version, workflow event, audit event and notification outbox;
- expose the hand-off notification to the customer without serialising internal job/PO planning fields, Planning notes, dates, location, document references or actor IDs.

The browser form and React queue are usability layers only. The service and database policies remain the security boundary.

### Expediting controls

The responsive Expeditor workspace does not widen access. `view_expediting_queue` grants only the stages listed above. `update_order_progress`, `move_to_dispatch` and `manage_order_hold` remain separate capabilities, and every action must also satisfy the exact central workflow rule.

The backend must:

- derive the acting Expeditor identity from the authenticated session and ignore browser-supplied actor, company and role fields;
- load the active progress-step definition and required-for-Dispatch policy from server-owned configuration;
- accept only recognised selectable steps for ordinary progress updates;
- require a customer-facing message for every Expediting update;
- keep the optional internal note, delay/supplier context, controlled document/image reference and exception evidence out of all customer projections;
- append the customer-visible workflow event to both the customer and assigned representative timelines and create independent in-app notification records for both;
- require a delay reason when an Expediting order is placed on hold and retain the prior controlled stage/step for resume;
- prevent hand-off unless all required Expediting steps are complete, or an authorised exception contains both a meaningful reason and a controlled authorisation reference;
- notify Dispatch, the customer and the assigned representative atomically with the `awaiting_dispatch` transition;
- retain `awaiting_dispatch` in the Expeditor read queue for awareness while exposing no further Expeditor mutation at that stage;
- reject stale updates by comparing the expected row version inside the same database transaction.

The public preview stores only fabricated metadata references. A production document or image upload still requires private object storage, malware scanning and a separately authorised download route.

## Company isolation requirement

Customer isolation is a server responsibility. The backend must:

1. derive the authenticated `userId`, role and authorised company IDs from the server session;
2. ignore a customer-supplied `companyId` when deciding access;
3. add an authorised-company predicate to every enquiry, item, order, event, notification and document query;
4. return `404` for a record outside the caller’s scope, avoiding confirmation that it exists;
5. enforce the same rule on document download and email retry endpoints;
6. use PostgreSQL row-level security as defence in depth;
7. test attempts to access another company by changing URL IDs, request bodies and upload metadata.

The React filter is only a display safeguard. It is not an authorisation control.

## Representative access

A sales representative may see a company only through an active `representative_company_assignments` record. Branch membership alone must not grant access to every company in that branch unless management approves that rule.

The customer may submit only a representative identifier. The server must reload that representative, verify the area/branch eligibility and ignore client-supplied representative name, code, branch or email values. `GET /enquiries/inbox` derives the representative identity from the verified session and never accepts a caller-selected representative ID. `Start Review` then rechecks the RFQ assignment and current `assigned_to_rep` state before committing the transition and audit event.

`Mark as Quoted` must likewise recheck that the RFQ is `under_rep_review` and assigned to the authenticated representative. Manager/Administrator access remains an explicit permission plus state-rule decision, not an assignment bypass hidden in the UI.

An authorised customer may acknowledge receipt only for a `quoted` RFQ belonging to that customer's company. The acknowledgement must never be treated as price acceptance, payment, Purchase Order confirmation or authority to create an order. The later representative acceptance action still requires the approved external evidence.

`accept_order` must recheck that the RFQ is `awaiting_customer_acceptance`, the authenticated representative is assigned, the expected row version matches and the acceptance evidence is complete. The browser may provide evidence metadata only; it may not provide actor identity, company identity, target status, order ID or order reference. Conversion is an internal server step and must commit the acceptance, order, immutable items, RFQ link, audit history and notification outbox atomically.

The API must reject price payloads and any card number, CVV, PIN, password, bank-account, routing or banking-credential field. Payment confirmation means a reference to evidence received and approved outside the app; this application does not collect or process payment. Acceptance data and supporting documents are internal-only and must not appear in customer projections.

## Authentication controls

- Prefer company SSO (OIDC/SAML through the approved identity provider) and MFA for staff.
- Customer passwords must be hashed server-side with the IT-approved adaptive algorithm, never encrypted or stored as plain text.
- Use short server sessions with rotated refresh/session identifiers stored only in secure cookies.
- Revoke sessions after password reset, role change, deactivation or suspected compromise.
- Rate-limit login, registration, RFQ submission, document upload and email-triggering routes.
- Require verified company email/onboarding approval before a new customer account gains access to company records.

## Upload and document controls

- Store document bytes in private object storage, not PostgreSQL and not the public web root.
- Generate opaque object keys; never trust the original filename as a path.
- Validate extension, MIME type, signature and size; scan uploads for malware.
- Encrypt at rest and in transit.
- Authorise every download; use short-lived signed URLs only after permission checks.
- Record uploader, hash, retention state and audit events.
- Treat quotation evidence as internal by default. Expose its metadata/reference to a customer only after explicit representative authorisation and a fresh company/record visibility check.
- Treat order-acceptance evidence as internal-only. Its upload metadata, PO/payment reference, verification note and accepting-user identity must not be serialised to customers.
- Treat the complete Planning record as internal-only. Customer projections must omit internal job numbers, Planning PO/exception fields, notes, schedules, ownership, production location, document references and Planning actor metadata.
- Treat Expediting internal notes, delay/supplier context, internal actor IDs, document/image references and hand-off exception evidence as internal-only. Customers receive only approved customer messages, public progress labels, dates and the safe updater display name.
- Never return quotation internal notes to customer responses. Row-level security restricts rows, but the API must also apply role-specific field projection.
- Keep quotation pricing outside this customer-facing application until a separately approved phase defines its source, visibility and controls.

## Audit events

At minimum, record successful/failed sign-ins, session revocation, account creation, role changes, company/rep assignment changes, every successful or denied workflow action, overrides, RFQ submission, PO upload/download, notification/email delivery/retry, retention/archive actions and administrative product edits. Audit records should be append-only for ordinary application roles.
