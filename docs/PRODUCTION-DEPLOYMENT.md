# Private-cloud production handover

This document lists what Rhomberg IT must provide before the preview can become a production service. The current GitHub Pages build remains in mock mode and contains demo data only.

## Proposed topology

```text
Approved customer/staff device
        |
   HTTPS + WAF/reverse proxy
        |
   Static React application  ---- same-origin ----  API service
                                                  /     |      \
                                         PostgreSQL  Object   Email worker
                                                     storage
```

The browser never connects directly to PostgreSQL, SMTP or object storage. The API is the only component allowed to use those privileged services.

## IT decisions and services required

### 1. Hosting and network

IT must provide:

- development, staging and production environments with separate data and secrets;
- approved private-cloud compute for the static site, API and background email worker;
- container runtime or the company’s standard application-hosting platform;
- internal container/package registry if required;
- production DNS name and TLS certificate lifecycle;
- reverse proxy/load balancer and web application firewall policy;
- outbound rules for the approved email provider and object store;
- inbound access policy, including whether customer access is internet-facing or VPN/private-access based;
- health-check paths, resource limits and autoscaling/failover expectations;
- CORS policy if API and UI cannot share one origin. Same-origin hosting is preferred.

Recommended API health routes:

- `/health/live`: process is alive, no dependency detail;
- `/health/ready`: required dependencies are reachable, protected from public infrastructure detail;
- `/health/version`: release identifier for operations, access controlled if required.

### 2. Identity and account onboarding

IT/business must decide:

- staff SSO provider (prefer the company’s OIDC/SAML identity platform) and MFA policy;
- customer registration approval and email-verification process;
- how an existing customer is matched to an authoritative company/account code;
- who approves representative-to-company assignments;
- session lifetime, inactivity timeout and re-authentication rules;
- password hashing standard for customer-managed credentials;
- help-desk process for lockout, deactivation and company-access correction.

Staff roles should come from approved directory groups or an audited admin workflow. A client must never select its own role or company access.

### 3. PostgreSQL

IT must provide:

- supported PostgreSQL version and high-availability topology;
- a database per environment;
- TLS-enforced connections and private network access;
- separate migration-owner and restricted runtime identities;
- secret-vault references for database credentials;
- connection-pool limits and a pooler if required;
- approved extensions (`pgcrypto` and `citext`, or reviewed alternatives);
- monitoring for connections, storage, locks, replication lag and slow queries;
- migration tool and rollback/forward-fix policy.

Start from `docs/database/postgresql-schema.sql`. It is a proposal and must be reviewed by the database/security team before execution.

The API must start each transaction with verified user/role context for row-level security. The browser is never a database client.

### 4. Uploaded documents

Purchase Orders, optional quotation evidence, internal order-acceptance evidence and other files require private object storage with:

- server-side encryption;
- blocked public access;
- environment-separated buckets/containers;
- versioning or protected deletion according to retention policy;
- malware scanning/quarantine workflow;
- content-type and file-signature inspection;
- lifecycle/retention rules approved by Legal/Finance;
- short-lived signed downloads issued only after API authorisation;
- restore/export procedure linked to the database metadata backup.

The database stores object keys, hashes and metadata—not document bytes.

Quotation evidence must be internal by default. IT must support an explicit customer-visibility flag, role/company checks on every download, malware scan state, and short-lived authorised delivery. The Outlook quotation remains prepared and emailed outside this application; the app records confirmation metadata only. No quotation price values should enter the customer-facing API or browser bundle during this phase.

Order-acceptance evidence is always internal-only in this phase. It may record a Purchase Order/payment reference and safe document metadata, but must never collect card data, bank-account credentials, PINs or passwords. Payment continues outside the app.

Expediting document/image fields are metadata references only in the public preview. If production permits actual Expediting evidence uploads, they must use the same private object-storage, scanning and authorisation controls. Internal Expediting notes, delay/supplier context, references and hand-off exception evidence must never be exposed through a customer download or API projection.

### 5. Email delivery

IT must provide:

- approved SMTP relay or transactional email service;
- verified sender domain/address;
- destination/routing policy for test, staging and production;
- DNS records required by the provider (SPF, DKIM and DMARC as applicable);
- bounce, rejection and complaint handling;
- rate and message-size limits;
- approved attachment policy;
- service credentials through the secret vault;
- non-production mailbox or sink that cannot accidentally contact real customers.

RFQ creation and email delivery must be decoupled with a durable outbox/worker. A temporary email failure leaves the RFQ stored and retries safely. Internal pricing must be generated only in the protected backend and never returned to a customer response.

### 6. Backups and recovery

IT must approve concrete RPO/RTO targets. A reasonable starting proposal for review is:

- PostgreSQL point-in-time recovery with encrypted backups;
- daily full/base backups plus continuous write-ahead-log archival;
- object-storage versioning and/or scheduled protected copies;
- at least one backup copy isolated from the primary environment/account;
- documented retention tiers matching legal and operational needs;
- quarterly restore tests to a clean environment;
- annual full disaster-recovery exercise;
- backup failure alerts owned by a named operations team.

A backup is not accepted until a restore is successfully demonstrated. Database and object-store restores must preserve the relationship between document metadata and file objects.

### 7. Secrets and configuration

Use the company secret manager. Never commit values to Git, build output, issue text or runtime configuration served to browsers.

Expected server-side variable names (names only):

```text
APP_ENV
APP_PUBLIC_ORIGIN
DATABASE_URL
DATABASE_CA_CERT_PATH
SESSION_SIGNING_KEY
CSRF_SIGNING_KEY
OIDC_ISSUER_URL
OIDC_CLIENT_ID
OIDC_CLIENT_SECRET
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM_ADDRESS
RFQ_ROUTING_ADDRESS
AUDIT_LOG_DESTINATION
```

The browser `runtime-config.js` may contain only a public API base URL and non-sensitive timing/feature settings. Service mode is fixed at build time so production does not ship the mock service.

### 8. Logging, monitoring and support

Provide:

- central structured logs with request/correlation IDs;
- security/audit log retention separate from ordinary application logs;
- dashboards for error rate, latency, login failures, RFQ volume, Expediting queue age, overdue estimates, orders on hold, email queue, document-scan failures and database health;
- alerts with named owners and escalation paths;
- application performance monitoring approved for customer-data handling;
- a support runbook for sign-in, failed email, stuck order status, upload and restore incidents.

Do not log passwords, session cookies, CSRF tokens, full PO content, price-book values or unnecessary personal information.

## Deployment pipeline

The recommended pipeline is:

1. Restore dependencies from a locked package file.
2. Run service tests, API contract validation, lint/static checks and the production build.
3. Scan dependencies, source, container and generated bundle for vulnerabilities and secrets.
4. Sign/version the artifact and publish it to the approved registry.
5. Apply reviewed database migrations with the migration identity.
6. Deploy API and worker to staging, then the static UI.
7. Run health, authentication, tenant-isolation, RFQ, upload, email and tracking smoke tests.
8. Require IT/security and business approval.
9. Promote the exact reviewed artifact to production.
10. Verify monitoring, backups and rollback/forward-fix readiness.

The default production candidate omits browser source maps. If IT generates maps for error monitoring, upload them privately to the approved monitoring service and do not publish them with the static site.

Use zero-downtime migrations where practical. Destructive schema changes require a tested backup/restore and an explicit change record.

## Required production tests

- Customer A cannot list, fetch, alter or download anything owned by Customer B.
- Changing a company, enquiry, order or document ID in a URL does not cross the authorised scope.
- A sales representative sees only actively assigned companies.
- Client-supplied representative names/codes are ignored; an invalid representative/area pairing is rejected.
- RFQ creation atomically stores the permanent reference, company/customer, line items, metadata, first audit event and one representative notification.
- The representative inbox derives identity from the session and exposes Start Review only for an assigned `assigned_to_rep` RFQ.
- Only the assigned representative (or explicitly authorised management role) can mark an under-review RFQ as quoted.
- Quotation number/date/expiry rules are validated; pricing fields are rejected.
- Marking an RFQ quoted atomically stores the representative/timestamp, separate internal/customer notes, workflow/audit entries and distinct customer/representative notifications.
- Quotation file bytes are scanned and stored privately; unauthorised evidence and internal notes never appear in a customer response.
- Only an authorised company customer can acknowledge receipt of its quoted RFQ, and doing so does not create an order or confirm payment, Purchase Order or price acceptance.
- The assigned representative receives the customer acknowledgement notification.
- Only the assigned representative or an explicitly authorised management role can run `accept_order`.
- Acceptance type/date/internal note/verification and conditional PO/payment references are validated; card, banking, password and pricing fields are rejected.
- Order acceptance and conversion are one transaction: one permanent order/reference, immutable line snapshots, the RFQ link, all workflow/audit events and notification-outbox records either commit together or all roll back.
- Concurrent or repeated acceptance requests return the same linked order and cannot create a second order for one RFQ.
- Customer responses retain the historical converted RFQ and linked order while omitting internal acceptance evidence and accepting-user details.
- Planning sees only Planning stages (including Planning-owned holds).
- Expediting sees only orders submitted by Planning, Expediting-owned holds and read-only awaiting-Dispatch hand-offs.
- Dispatch sees only orders handed over by Expediting and Dispatch-owned holds.
- A customer cannot invoke internal RFQ or order workflow actions.
- An unassigned representative cannot review, quote, accept or convert another representative's RFQ.
- Planning cannot start an order without accepted/conversion evidence and cannot skip its required references.
- Planning completion requires a job number, Planning owner, submission date, assigned representative, and either a customer PO or an audited authorised exception.
- Planning dates, priority, location and document-reference limits are validated server-side; browser display choices are not trusted.
- Submitting to Expediting atomically records the Planning actor/time, workflow/audit entries and customer/representative/Expeditor notification-outbox records.
- Customer API responses expose only the approved hand-off status and never the internal Planning record.
- Expeditor cannot act until Planning submits the order and cannot administer users.
- The Expediting step list, ordering and required-for-Dispatch subset come from approved server configuration; browser-supplied labels and flags are ignored.
- Start, progress, hold, resume and Dispatch hand-off actions enforce the exact state, named permission and expected record version.
- Every customer-visible Expediting update creates independent customer and assigned-representative timeline/notification records in the same transaction as the audit event.
- Customer projections omit Expediting internal notes, delay/supplier context, controlled references, actor IDs and hand-off exception evidence.
- Dispatch hand-off is rejected while required Expediting steps are incomplete unless the authorised exception reason and authorisation reference are complete and audited.
- Dispatch cannot complete an order until the required collection or delivery stages occur.
- Buyer receives no operational RFQ/order queue and cannot perform workflow actions until an approved procurement workflow and permission migration are deployed.
- Only manager/administrator can override a mandatory step, and the reason/comment are audited.
- Manager/admin actions are audited.
- Session and CSRF attacks are rejected.
- Duplicate RFQ retries with one idempotency key create one RFQ.
- Invalid product options and quantities are rejected server-side.
- PO type, size, signature and malware controls work.
- Email outage does not lose an RFQ and recovery retries once.
- Database plus object documents can be restored together.
- The public/static bundle contains no credentials, price book or real customer exports.

## Go-live information IT must hand back

- approved production and staging URLs;
- identity/onboarding decision;
- database platform/version and migration process;
- object-storage and malware-scanning design;
- email delivery/routing design;
- secret-vault integration method;
- backup RPO/RTO, retention and latest restore-test result;
- monitoring dashboards, alert owners and support contacts;
- deployment/release owner and change-control process;
- security and privacy approval.

Only after those items and the API tests are complete should IT deploy the API-only artifact created by `pnpm run build:production`. The GitHub Pages artifact must remain the separate mock build.
