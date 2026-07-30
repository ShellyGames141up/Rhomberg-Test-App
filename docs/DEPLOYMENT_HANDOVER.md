# Deployment Handover

## Handover Status

The application and workflow implementation is functionally complete in mock mode. No production deployment, database connection or infrastructure configuration has been performed.

The GitHub Pages version is suitable only for fabricated demonstrations. Innovate IT must review the proposed architecture, security controls and deployment sequence before a staging environment is created.

## Intended Runtime Topology

```text
Customer domain                 Internal domain
Rhomberg Connect                Rhomberg Operations
        \                            /
         \                          /
          ---- Secure API domain ---
                       |
                 PostgreSQL
                       |
            Private document storage
```

Customer and internal identities must use separate authentication realms while sharing centrally enforced roles, permissions, company scope and workflow rules.

## Information and Infrastructure Required from Innovate IT

Values below are deliberately unanswered. IT must confirm them through an approved, private channel.

| Area | IT decision or provision required |
| --- | --- |
| Staging | Host, access model, deployment owner and UAT availability |
| Production | Host, operating-system standard, support owner and release window |
| Compute | Approved container platform or virtual-machine standard |
| PostgreSQL | Managed service/host, version, HA approach, maintenance owner and connection policy |
| Database secrets | Credentials issued through secrets management; never source control |
| Customer domain | Approved Rhomberg Connect domain |
| Internal domain | Approved Rhomberg Operations domain and network-access policy |
| API domain | Approved API origin and CORS policy |
| DNS and TLS | Record owner, certificate issuer, renewal and expiry monitoring |
| Firewall | Inbound/outbound allow-list, database isolation and administration paths |
| File storage | Private object/file storage, encryption, access model and lifecycle policy |
| Malware scanning | Upload quarantine, scanner and failure/escalation process |
| Backups | Database/document frequency, retention, off-site copy and encryption |
| Recovery | RPO, RTO, restore owner, test schedule and evidence |
| Monitoring | Availability, performance, job queues, database and storage monitoring |
| Central logging | Platform, retention, access, redaction and alerting |
| Email | Microsoft 365 Graph or approved SMTP service, sender domain and mailbox ownership |
| Push | APNs/FCM plan, token storage and delivery worker ownership |
| Internal identity | Entra ID or other approved provider, group mapping and MFA |
| Customer identity | Registration approval, MFA/password policy and account recovery |
| Secrets | Approved vault, rotation, access reviews and emergency revocation |
| Releases | CI/CD tool, protected environments, approvers, rollback and artefact retention |
| Mobile ownership | Apple Developer and Google Play organisation owners |
| Windows distribution | Managed PWA, enterprise store or packaged application standard |
| Contacts | Named technical owner, security reviewer, UAT owner and production approver |
| UAT | Environment, fabricated test dataset, acceptance criteria and sign-off owner |

Do not place the answers, credentials, internal addresses or private infrastructure diagrams in the public repository.

## Required Server-Side Controls

- Secure session cookies with `HttpOnly`, `Secure` and appropriate `SameSite`.
- CSRF protection for every state-changing browser request.
- MFA and rate limiting appropriate to the identity realm.
- Server-side roles, permissions and workflow transitions.
- Company and representative scope on every query and mutation.
- PostgreSQL row-level security as defence in depth.
- Append-only audit events and controlled workflow evidence.
- Private document access using short-lived authorised downloads.
- File type/size validation, malware scanning and quarantine.
- Email allow-lists and recipient validation.
- Idempotency for important mutations.
- Background jobs with retry/dead-letter handling.
- Structured logging without passwords, tokens, document bytes or unnecessary personal data.
- Encrypted backups and regularly tested restores.

## Environment Configuration

`.env.example` contains names and non-secret placeholders only. Real values belong in IT secrets management. The public `runtime-config.js` may contain an API URL, timeout and environment name, but never a credential or trust decision.

## Staging Sequence

1. Review this repository, OpenAPI and PostgreSQL proposal.
2. Confirm responsibility owners and unresolved design decisions.
3. Provision isolated staging compute, PostgreSQL and private storage.
4. Implement and review the backend API.
5. Apply schema migrations in staging.
6. Integrate internal and customer authentication.
7. Configure file scanning and authorised document downloads.
8. Configure Microsoft 365/SMTP and notification workers.
9. Import fabricated UAT data only.
10. Run application, API, access-control, security and restore tests.
11. Complete business UAT and obtain sign-off.
12. Prepare a separate production release plan.

## Deployment and Rollback

IT must define:

- immutable versioned artefacts;
- protected CI/CD environments and approvals;
- pre-deployment backup checks;
- forward and backward database migration compatibility;
- health and smoke checks;
- rollback triggers and authority;
- database rollback/restore limits;
- post-release monitoring period;
- incident escalation.

This repository does not prescribe private infrastructure values.

## Responsibility Matrix

| Responsibility | Application Developer | Innovate IT | Shared |
| --- | :---: | :---: | :---: |
| User interface and responsive behaviour | X |  |  |
| Workflow and service-layer integration | X |  |  |
| Shared validation and application tests | X |  |  |
| Application documentation and approved features | X |  |  |
| Servers, containers/VMs and operating systems |  | X |  |
| PostgreSQL hosting and operations |  | X |  |
| DNS, TLS, firewalls and network security |  | X |  |
| Backups, monitoring and central logging |  | X |  |
| Secrets and private file storage |  | X |  |
| Production deployment controls and infrastructure incidents |  | X |  |
| Security testing and access-control review |  |  | X |
| Staging validation and UAT |  |  | X |
| Production approval and release planning |  |  | X |
| Disaster-recovery testing |  |  | X |
| Support escalation |  |  | X |

## Required Contacts

- Application technical owner: `[To be confirmed]`
- Innovate IT technical owner: `[To be confirmed]`
- Database owner: `[To be confirmed]`
- Security reviewer: `[To be confirmed]`
- UAT owner: `[To be confirmed]`
- Production approver: `[To be confirmed]`
- Incident escalation contact: `[To be confirmed]`

## Production Gate

Do not approve production until:

- API and database implementations have been reviewed;
- identity and company isolation have server-side evidence;
- document and email controls pass security tests;
- backup restoration is demonstrated;
- monitoring and incident processes are active;
- UAT is signed;
- a rollback plan is approved.
