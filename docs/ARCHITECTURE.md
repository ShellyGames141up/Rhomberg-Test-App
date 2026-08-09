# Multi-interface platform architecture

## Decision

Rhomberg Connect and Rhomberg Operations are separate interface experiences over one shared business layer. The Executive Workflow Demo is a controlled presenter profile over the same public mock services. This architecture does not create copies of workflow or persistence code. Each preview selects branding, layout constraints and allowed roles; all records, permissions, transitions, validation, notifications and audits continue through shared modules and services.

The notification phase adds `src/domain/notifications.js` as the central event/delivery model. Workflow services publish recipient-scoped events only after a successful controlled transition. React uses `services.notifications` for inbox reads, read state, preferences, deep links and authorised simulated retries; it never reads notification storage directly. Email and push remain mock statuses until the private-cloud API and worker are approved.

The Dispatch phase adds a Dispatch domain/helper module, a desktop-first responsive dashboard and reusable structured action fields. The UI still receives only service-scoped orders and cannot change a status directly. Both mock and future API implementations expose the same Dispatch reference-data method and workflow action contract.

```text
Rhomberg Connect Customer Desktop
                 |
Rhomberg Connect Customer Mobile
                 |
Rhomberg Operations Internal Mobile
                 |
Rhomberg Operations Internal Desktop
                 |
Executive Workflow Demo
                 |
                 v
        Shared Service Contracts
                 |
        Shared Secure Backend API
                 |
      Shared PostgreSQL Database
```

The API and PostgreSQL database in the lower two layers are future production components. The public preview currently selects `createMockServices()` and stores fabricated data in one browser profile.

## Repository boundaries

| Area | Responsibility |
| --- | --- |
| `src/apps/` | Preview landing, Executive Demo and platform-specific customer setup/settings presentation |
| `src/components/` | Existing reusable catalogue, RFQ, Planning, Expediting, Dispatch, workflow and account screens |
| `src/shared/platform/` | Five preview definitions, route resolution and preview-role gates |
| `src/shared/personalisation/` | Legacy-safe normalisation and customer profile-image rules; application branding remains official |
| `src/domain/` | Central workflow, access policy, queue and configuration business rules |
| `src/services/` | Shared contracts plus interchangeable mock and HTTP implementations |
| `preview/` and `demo/` | Stable GitHub Pages entry documents; no duplicated application bundles |
| `docs/` | Production and preview handover material |

## Runtime selection

The root document opens the Preview Centre. A preview document includes a non-secret preview ID and the shared `app.js`. `previewConfig.js` resolves that ID to an allowed role set. Authentication still happens through the shared auth service, then the interface rejects a session that is not supported by that preview.

Preview role gating is an additional presentation boundary, not a replacement for permissions. Service methods and workflow transitions still enforce company, assignment, queue and action access.

## Shared logical data

All five experiences use the same service boundary and storage keys in one browser origin. That lets a customer RFQ appear in the representative preview and later Planning/Expediting views in the same browser profile. Executive presenter progress uses its own mock-service record. GitHub Pages cannot synchronise separate browsers or devices. The private-cloud API will become the shared source of truth in production.

## Production direction

The production build aliases the mock service to `apiEntry.js`, replaces the Preview Centre and Executive Demo modules, defines public-preview features as disabled, excludes demo accounts/routes and scans the output for forbidden markers. Authentication must use secure server cookies, and the API—not a UI route—must enforce tenant isolation, permissions, transitions and audit creation.

## Phase 21 operational domains

The internal desktop preview now includes Laboratory and Quality Assurance workspaces without adding another application or persistence path.

```text
Planning routing decision
       |
       +-- certification --> certification domain --> Laboratory service/UI
       |                                          |
       |                              physical movement + certificate queue
       |
       +-- standard -------> Expediting --> QA domain/service/UI
                                                |
                                        pass or immutable rework cycle
                                                |
                                                v
                                  separate Dispatch receipt
```

`src/domain/certification.js` owns per-unit calibration records, certificate requirements, Laboratory queue metrics and archive eligibility. `src/domain/qualityAssurance.js` owns inspections, failures, configurable return destinations, rework cycles and monthly process metrics. `src/domain/analytics.js` derives pricing-safe quantity and operational measures.

The mock services persist those structures behind existing interfaces. The HTTP implementation exposes matching methods but production remains unconnected. Customer projections keep internal Lab/QA/Dispatch details out, and certificate file access is a separate permission from certificate status visibility.

Customer/internal sign-in uses separate preview realms. Credential changes use the service layer and a simulated one-time code; production requires a verified-email delivery worker, hashed codes, rate limits and session invalidation.
