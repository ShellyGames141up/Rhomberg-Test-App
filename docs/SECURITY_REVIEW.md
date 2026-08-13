# Security and Data-Leak Review

## Private-account and public-build boundary

Real staff information belongs only in ignored private configuration. The tracked account template contains owner-supplied placeholders and no credentials. Initial passwords are generated with a cryptographically secure random source, are unique per account, and exist only inside an encrypted ignored administrator PDF. `Rhom123!` protects that document only and is never a shared login password.

The public normal routes do not expose demo login shortcuts and reject public demo identities. This is a preview safeguard, not production security. Production still requires server-side authentication, role checks, tenant isolation, forced first-login password change, secure hashing, MFA and protected session handling. Artifact scans cover HTML, JavaScript, JSON, source maps and other textual outputs, plus protected filenames and approved private-roster identity markers.

Status: completed application review; production controls still required
Review date: 29 July 2026
Application checkpoint: 4.8.0
Scope: GitHub Pages mock preview, shared React/domain code, mock and API service adapters, PDF generation, Netlify test helper, build scripts, OpenAPI proposal and PostgreSQL proposal

## IT handover addendum

The final IT-handover build adds a fifth, fabricated Executive Workflow Demo and an Administrator workspace without weakening the existing security boundary:

- the Executive Demo state is accessed only through the interchangeable service layer;
- every Executive Demo account and scenario marker is rejected by the production-bundle scanner;
- the mock Administrator can inspect and reset fabricated preview data, while the production build replaces mock-only controls with an inert production module;
- administrative actions remain permission-gated, service-mediated and audited;
- the Executive Demo never represents browser storage, mock role switching or fabricated notifications as production security.

The release remains a demonstrator. Production still requires private identity, API, database, object-storage, audit and deployment controls described below.

## Important security statement

The GitHub Pages version is a fabricated product demonstration. It is **not production-secure**.

Its sign-in accounts, permissions, company isolation, audit history and persistence run in browser code that a person controlling the browser can inspect or alter. These controls are valuable for workflow testing, interface review and contract validation, but they do not replace server authentication, server authorisation, a private database, protected object storage or tamper-resistant audit retention.

Production security depends on implementing and independently testing the proposed private API, PostgreSQL row-level security, identity/session controls, document service, notification workers, secret management, monitoring and controlled retention workflow.

## Executive result

The review found no committed production credential, API key, private key, database password or embedded price-book value. The visible passwords are intentionally fabricated preview credentials using reserved `.invalid` or `.test` email domains.

The existing architecture already routes business actions through the service layer and central workflow validator. The security-hardening phase added focused controls and automated tests for the highest-risk boundaries:

- customer responses now remove newly introduced sensitive fields by default, in addition to the existing explicit Planning, Expediting, Dispatch, quotation and acceptance projections;
- the legitimate PBB `internalContacts` customer selection remains visible;
- company-restricted managers can no longer list, restore, archive, export or place a legal hold on another company’s archived order;
- audit reads and company-directory reads now respect an account’s authorised-company restriction;
- the Netlify test helper logs only a correlation reference, error type and status, and returns a generic public error;
- the production build rejects additional mock-service and private-pricing markers;
- a consolidated adversarial security suite now verifies isolation, projection, status-forgery, PDF, email, archive, credential, pricing and production-contract controls.

No visual design, route or working demo workflow was removed.

## Verification matrix

| Requirement | Result | Evidence and limitation |
| --- | --- | --- |
| No real credentials in the repository | Verified for committed/source text by automated high-confidence secret patterns. | No private keys, common provider tokens or credential-bearing database URLs were found. Preview passwords are explicitly fabricated. A production secret scanner must still run in CI and repository history. |
| No protected pricing in the public bundle | Verified for price values; strengthened production scan. | Catalogue and mock seed data contain no protected numeric pricing fields. The serverless pricing helper loads its price book only from `RHOMBERG_PRICEBOOK_GZIP_BASE64*`; no price book is committed. The production build rejects price-engine markers. |
| Mock accounts excluded from production builds | Verified by architecture and build scan. | `build-production.mjs` replaces the mock service entry with `apiEntry.js`, removes preview landing/configuration, omits source maps and scans for every fabricated login plus mock/pricing markers. The production build must remain a required CI gate. |
| Customers cannot access another company | Verified in mock service tests and proposed RLS design. | List, fetch, workflow, notification, document and archive paths use service-level company checks. Adversarial ID-changing tests return 404. Browser-local controls remain tamperable; production must derive company scope from the session and enforce RLS. |
| Representatives cannot access unassigned records | Verified in service tests. | Inbox, fetch and workflow action tests reject a different representative’s RFQ. Production must derive representative identity from the session and active assignment table. |
| Internal notes never appear in customer payloads | Strengthened and verified. | The customer record is constructed from an explicit top-level allow-list. Quotation, document, representative, item, Expediting and Dispatch objects have purpose-built public projections, with additional restricted-field filtering for customer configurations. Unknown staff fields and adversarial values are tested. |
| Audit logs cannot be modified by ordinary users | Verified as a mock/API contract; not tamper-resistant in GitHub Pages. | The service exposes audit list only. PostgreSQL proposes a mutation-rejection trigger and no ordinary UPDATE/DELETE grant. Browser storage can still be edited through developer tools. |
| Uploaded documents have proposed access controls | Design verified; implementation open. | Schema requires private object keys, scan status, company/parent scope, deletion state and explicit customer-visibility authorisation. RLS checks parent record access. No real storage, scanning or download service exists yet. |
| Important actions require server-side production authorisation | Contract verified; backend open. | API uses secure-cookie sessions, CSRF on mutations, idempotency keys and action endpoints. The production server must re-read actor, permission, company, assignment, state and row version in one transaction. |
| Status transitions cannot be forged through the UI | Verified in mock/domain tests. | Components do not receive a raw status setter. Extra `status`, `trackingStatus` or `targetStatus` fields cannot change a normal transition. Customer override attempts are rejected. Production must repeat these checks server-side. |
| PDFs exclude unauthorised information | Verified. | Customer PDF models omit internal sections, audit values, protected configuration keys, cost/pricing fields and internal operational notes. Internal copies cannot be emailed to external recipients. |
| Email recipients are validated | Verified for the order-summary workflow. | Syntax, header-injection, allow-listed internal recipients, representative resolution, external confirmation and internal-copy restrictions are tested. Actual delivery remains simulated in the app. |
| Production secrets are environment variables | Design verified. | Database, session, CSRF, OIDC, object storage, email and push secret names are documented for a vault/environment. Browser runtime configuration contains only public settings. |
| Session and CSRF requirements remain documented | Verified. | API requests use secure-cookie credentials and `X-CSRF-Token` on mutations. OpenAPI defines both schemes. Production still needs HttpOnly/Secure/SameSite policy, rotation, expiry and revocation implementation. |
| Logging does not expose sensitive personal data | Source logging hardened; production pipeline open. | The React error boundary logs a generic message. The test email helper no longer logs raw exceptions or returns their messages. Production structured-log redaction and access/retention controls still require implementation. |
| Archived records remain protected | Strengthened and verified. | Archive lists and actions now reapply company scope. Customers cannot open the archive workspace. Proposed RLS, legal hold and retention rules remain required in production. |
| Permanent deletion is controlled and auditable | Contract verified; worker open. | Browser deletion is disabled. The proposal requires policy enablement, protected export, manager/admin approvals, legal-hold check and an append-only deletion log executed by a dedicated backend service. |

## Security-hardening changes

### 1. Fail-closed customer projection

Previously, the customer projection began with the full internal record and then removed known internal properties. That protected current fields but was fragile: a future internal field could be added without also being added to the removal list.

The mock service now constructs customer records from an explicit top-level allow-list, so an unknown field is excluded by default even when its name does not look sensitive. Product items, assigned representatives, quotation documents and uploaded-document metadata also use explicit public shapes. Customer configurations receive an additional recursive filter for internal, private, protected, audit, credential, secret, token, pricing, cost, margin, supplier and raw fields. Objects explicitly marked `customerVisible: false` are removed.

The PBB catalogue’s customer-selectable `internalContacts` option is deliberately allow-listed because “internal” describes the instrument contact mechanism, not internal company data.

Production must implement equivalent allow-listed response DTOs on the server. The browser sanitiser is defence for the mock, not the production security boundary.

### 2. Restricted management and archive scope

The existing record access helper correctly honoured `authorisedCompanyIds`, but some archive methods and direct audit/company lists did not consistently call it.

The security-hardening phase applies company scope to:

- company-directory results;
- archive search/list;
- archive execution;
- archive restoration;
- legal-hold updates;
- retention exports;
- direct audit-history reads.

Out-of-scope records return 404 so the caller is not told that another company’s record exists.

### 3. Safe error logging

The Netlify test RFQ helper previously logged the raw exception and returned its message. Provider responses can contain implementation details and should not be treated as public-safe.

It now:

- generates a request reference;
- logs only request reference, error type and numeric status;
- returns a generic message and request reference;
- never logs the RFQ body, customer contact data, uploaded file content, provider response or secret.

The Netlify helper remains a test integration and is not the proposed production API.

### 4. Production bundle guard

The API-only build now also fails if it finds:

- mock service or demo-login identifiers;
- mock seed markers;
- private price-book loader/environment markers;
- rep-only priced-RFQ labels;
- protected price-engine field names.

Actual CI must retain bundle scanning and add an approved history-aware secret scanner and dependency/container scanning.

## Highest-risk automated tests

`tests/security-review.test.mjs` adds adversarial coverage for:

- common committed-secret signatures;
- ignored `.env`, private data and production artifact paths;
- reserved-domain fabricated mock identities;
- absence of numeric price fields in catalogue/mock data;
- environment-only private price-book loading;
- production service-entry and marker scanning;
- secure-cookie and CSRF client requirements;
- absence of raw status endpoints;
- audit immutability, document RLS and controlled deletion schema evidence;
- generic, non-payload serverless logging;
- cross-company order-ID access;
- unknown staff-field, internal/future-field, representative-metadata, object-storage-key and protected-document customer leakage;
- legitimate PBB internal-contact visibility;
- customer-forged statuses and overrides;
- unassigned representative inbox/fetch/action access;
- restricted manager company, archive and audit scope;
- customer PDF redaction;
- external-recipient confirmation and email-header injection rejection.

The test complements, rather than replaces:

- `permissions.test.mjs`;
- `workflow.test.mjs`;
- `mock-services.test.mjs`;
- `notifications.test.mjs`;
- `order-documents.test.mjs`;
- `retention.test.mjs`;
- `management.test.mjs`;
- `production-spec.test.mjs`;
- `end-to-end-demo.test.mjs`.

## Findings requiring production work

### Critical: GitHub Pages identity and storage are not security controls

The preview stores fabricated accounts, plain demonstration passwords, sessions, workflow records and audit entries in the browser. Anyone controlling that browser can change them.

Required before production:

- approved OIDC/SAML or managed customer identity;
- MFA for internal users;
- adaptive password hashing if customer passwords are retained;
- verified company onboarding;
- secure server sessions and revocation;
- server-side permission/company/assignment checks;
- PostgreSQL RLS and integration tests.

### High: the proposed backend and RLS have not been executed

The OpenAPI and PostgreSQL files are design proposals. Static tests verify their structure, but there is no running API or database and no live transaction/RLS test.

Required:

- IT/database/security review;
- migrations in an isolated development database;
- least-privilege runtime and migration roles;
- company/representative/action integration tests;
- race, stale-version and idempotency tests;
- independent penetration test before external production use.

### High: the Netlify RFQ helper is preview-only

`netlify/functions/submit-rfq.mjs` uses origin filtering and rate limiting but is not the authenticated, company-scoped workflow API. A non-browser caller can forge an Origin header. It must not become the production RFQ endpoint.

It also contains a configured test-routing business email address. That address is not a credential or customer record, but it is public contact data. Use a dedicated non-production sink mailbox before wider external testing.

Required:

- retire or isolate this route when the private API is available;
- authenticate the caller and derive company/representative server-side;
- allow-list test destinations by environment;
- scan documents before delivery;
- use a durable outbox rather than sending in the request transaction;
- keep private price-book values only in protected backend storage.

### High: document bytes are not securely implemented

Mock mode stores metadata only for workflow documents. Personalisation images remain in the browser for demonstration.

Required:

- private encrypted object storage;
- opaque object keys;
- file signature/MIME/size checks;
- malware quarantine and scan result;
- hash, uploader, parent/company and retention metadata;
- short-lived download URLs issued only after fresh authorisation;
- customer visibility approval and audit;
- coordinated database/object backup and restore.

### High: audit evidence is not durable in mock mode

The browser audit service is append-only through normal application calls, but developer tools can edit its storage.

Required:

- append-only database trigger and restricted grants;
- security log export to an approved immutable/WORM destination if required;
- correction events rather than mutation;
- monitored retention and access;
- clock and actor identity supplied by the server.

### Medium: production logging and privacy operations are not implemented

Required:

- structured logs with request/correlation IDs;
- field allow-listing and PII/token redaction;
- no request bodies, cookies, CSRF tokens, document contents or price-book values;
- restricted log access and approved retention;
- incident response, access review, data-subject and breach procedures;
- alerts that do not include sensitive payloads.

### Medium: retention and deletion policy needs formal approval

The workflow is controlled in the proposal, but Legal, Finance, Quality and IT must approve:

- retention periods by document and record type;
- legal-hold ownership;
- manager/administrator separation of duties;
- backup expiration versus deletion;
- deletion evidence retention;
- restore/export and exception procedures.

## Production acceptance gates

Do not call the platform production-secure until all of the following are complete:

1. Private API and PostgreSQL are deployed in development and staging.
2. Identity, MFA, session, CSRF, rate-limit and onboarding controls are implemented.
3. Every query/action is tested for company, representative, queue, role and document scope.
4. RLS is executed and tested with least-privilege database roles.
5. Object storage, malware scanning and authorised downloads are working.
6. SMTP/Microsoft 365 and push credentials are vault-managed; test environments cannot contact real customers accidentally.
7. Audit, logs, backups, restore tests, retention and deletion are approved and monitored.
8. CI performs tests, production build, dependency/container scans, secret/history scans and artifact signing.
9. A privacy review and independent security assessment are complete.
10. The exact approved artifact is promoted to production with rollback/forward-fix readiness.

## Review conclusion

The current implementation is suitable for fabricated workflow demonstration and continued backend design. These changes reduce accidental leakage inside mock-service projections and close restricted-management scope gaps.

They do not make GitHub Pages, browser storage, fabricated passwords or the Netlify test helper suitable for real customer orders, credentials, pricing, Purchase Orders or operational records.
