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

Purchase Orders and other files require private object storage with:

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
- dashboards for error rate, latency, login failures, RFQ volume, email queue, document-scan failures and database health;
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
- Expeditor can update tracking but cannot administer users.
- Buyer cannot update tracking unless an explicit approved permission is added.
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
