# Innovate IT server connection checklist

This is the information Rhomberg and Innovate IT must agree before the current frontend is connected to a server. The GitHub Pages previews remain fabricated, browser-local demonstrations until every production gate below is complete.

## 1. Monday discovery record

Record, do not guess:

- hosting owner, operating system, CPU/memory limits and supported Node/runtime or container standard;
- development, staging and production environments, URLs, DNS owner and TLS termination;
- reverse proxy/WAF, allowed inbound networks, outbound firewall rules and health-check expectations;
- approved PostgreSQL version, host method, TLS policy, database names, extensions, migration identity, restricted runtime identity, connection limits and backup owner;
- staff identity provider (prefer Microsoft Entra ID/OIDC), customer identity solution, MFA, verification, recovery, session lifetime and account-approval process;
- private document/object store, malware scanning, encryption, versioning, retention and short-lived authorised download method;
- Microsoft 365/SMTP delivery route, approved sender, non-production sink, rate/size limits and retry/dead-letter owner;
- monitoring, audit-log destination, alert owners, support escalation, RPO/RTO and last successful restore test;
- deployment mechanism, artifact registry, secrets manager, change approval, rollback and maintenance window.

## 2. Frontend connection boundary

The production build uses `src/services/api/createApiServices.js`; the public demo uses `src/services/mock/createMockServices.js`. React components must continue to use the shared service contracts and must not access browser storage or determine authorisation.

Public runtime configuration may contain only:

```text
apiBaseUrl
requestTimeoutMs
environmentName
notificationTransport
```

Expected public API prefix: `/api/v1`. Same-origin UI and API hosting is preferred. If origins differ, CORS must allow only exact approved origins, support credentialed requests deliberately and reject wildcard credential access.

## 3. Authentication and sessions

The server must:

- derive the user, active roles, company access, branch and representative assignment from an authenticated server session;
- use Secure, HttpOnly, SameSite cookies, CSRF protection for mutations, rotation after authentication/privilege change and server-side revocation;
- provide staff SSO and the approved external customer identity flow without exposing provider tokens to application JavaScript;
- enforce disabled/archived accounts, email verification, password recovery where applicable, rate limits and audited security events;
- return `401` for expired/invalid sessions and `403` or scope-safe `404` for denied resources.

Minimum session endpoints: login/provider start and callback, current user, logout, session refresh/revocation, customer activation/verification and password-recovery endpoints chosen by IT.

## 4. Required server capabilities

Implement the canonical contract in `docs/api/openapi.yaml` incrementally. The first integration slice should prove:

1. health/version;
2. authenticated current user and permissions;
3. company-scoped catalogue/RFQ create/list/detail;
4. private document upload metadata and authorised download;
5. append-only audit event;
6. recipient-scoped in-app notification.

Then migrate quotation, Technical Support, Representative-loaded orders, Planning, Laboratory, Expediting, QA, Dispatch, management, administration, retention and reporting in controlled slices. Every mutation requires validation, permission, company/assignment scope, allowed workflow transition, expected record version and idempotency.

## 5. Database and documents

Review `docs/database/postgresql-schema.sql` before running it. Production requires migrations under version control, separate schema/runtime identities, enforced row-level security, immutable audit protection, soft deletion/retention rules and indexes verified with fabricated volumes.

Files never belong in the public bundle or database rows. The API stores private bytes in approved object storage and records metadata, hash, owner company, entity, visibility, version, scan status and retention. Uploads need signature/type/size checks and malware quarantine. Downloads need a fresh authorisation decision and short-lived response; upload, replacement and download are audited.

## 6. Configuration names

Final names may follow Innovate IT standards. At minimum map these server-side concepts in the managed secrets/configuration system:

```text
APP_ENV
APP_PUBLIC_ORIGIN
API_PUBLIC_ORIGIN
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
EMAIL_FROM_ADDRESS
EMAIL_CREDENTIAL_REFERENCE
RFQ_ROUTING_ADDRESS
AUDIT_LOG_DESTINATION
MONITORING_CONNECTION_REFERENCE
```

No values belong in Git, browser runtime configuration, logs or screenshots.

## 7. Operational acceptance

Before fabricated staging testing: deploy health checks, migrations, identity, private storage, logging/redaction, backups and a non-production mail sink. Run contract, tenant-isolation, workflow-forgery, document-access, CSRF/session, idempotency and restore tests.

Before real data: Rhomberg owner, Innovate IT, security/privacy, Laboratory/quality owners and business workflow owners must approve UAT, access matrix, retention, incident response, backup restore evidence, penetration findings and support ownership.

## Immediate action when server information arrives

Hold a 60–90 minute architecture handover, complete section 1, compare the approved platform with `docs/PRODUCTION-DEPLOYMENT.md`, and implement only the smallest authenticated RFQ vertical slice in a separate reviewed branch. Do not import customer data or package native apps during that step.

