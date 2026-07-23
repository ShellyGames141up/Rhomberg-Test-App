# Production roles and access rules

## Role definitions

| Role | Intended access |
|---|---|
| Customer | Catalogue, own authorised company profile, own-company RFQs, own-company orders and documents |
| Sales representative | Catalogue plus enquiries and orders for companies explicitly assigned to that representative |
| Planning | Accepted orders awaiting internal job/PO planning and controlled handoff to Expediting |
| Expeditor | Orders submitted by Planning; create controlled fulfilment updates and hand off to Dispatch |
| Dispatch | Orders handed off by Expediting; control collection, delivery and completion actions |
| Buyer | Read approved order requirements and supplier/procurement information needed for fulfilment; no customer-account administration |
| Manager | Cross-branch visibility, workflow oversight, audited override and approved reporting |
| Administrator | User, company, role, representative assignment, product and retention administration; audited elevated access |

The application role values are `customer`, `sales_representative`, `planning`, `expeditor`, `dispatch`, `buyer`, `manager` and `administrator`. `system` is a trusted backend actor for automatic assignment/retention actions; it is not a user-selectable role.

## Permission matrix

| Capability | Customer | Sales rep | Planning | Expeditor | Dispatch | Buyer | Manager | Administrator |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Read catalogue | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Create RFQ | Own company | No | No | No | No | No | Optional policy | Yes/support |
| Read customer RFQs | Own company | Assigned | No by default | No | No by default | Approved read-only scope | All | All |
| Read orders | Own company | Assigned | Approved scope | Approved scope | Approved scope | Approved scope | All | All |
| Representative RFQ actions | No | Assigned only | No | No | No | No | Yes | Yes |
| Planning actions | No | No | Yes | No | No | No | Yes | Yes |
| Expediting actions | No | No | No | Yes | No | No | Yes | Yes |
| Dispatch actions | No | No | No | No | Yes | No | Yes | Yes |
| Workflow override | No | No | No | No | No | No | Audited | Audited |
| Manage products/users | No | No | No | No | No | No | No by default | Yes |
| View reports | Own only | Assigned | Operational | Operational | Operational | Procurement | Yes | Yes |

Any broader access must be an explicit approved permission, not an assumption based on a job title.

## Workflow enforcement

The backend must accept action codes, never arbitrary status assignments. For each action it must re-read the record in a transaction and validate current state, role, representative assignment, company scope, required fields, expected row version and any fulfilment guard. The state update, workflow event, audit event and notification outbox rows must commit atomically.

Manager/administrator override requires a separate reason and comment. It must be visible in audit reporting and cannot silently rewrite history. See `WORKFLOW_STATE_MACHINE.md`.

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

## Audit events

At minimum, record successful/failed sign-ins, session revocation, account creation, role changes, company/rep assignment changes, every successful or denied workflow action, overrides, RFQ submission, PO upload/download, notification/email delivery/retry, retention/archive actions and administrative product edits. Audit records should be append-only for ordinary application roles.
