# Multi-interface platform architecture

## Decision

Rhomberg Connect and Rhomberg Operations are separate interface experiences over one shared business layer. This phase does not create four copies of workflow or persistence code. Each preview selects branding, layout constraints and allowed roles; all records, permissions, transitions, validation, notifications and audits continue through shared modules and services.

Prompt 9 adds `src/domain/notifications.js` as the central event/delivery model. Workflow services publish recipient-scoped events only after a successful controlled transition. React uses `services.notifications` for inbox reads, read state, preferences, deep links and authorised simulated retries; it never reads notification storage directly. Email and push remain mock statuses until the private-cloud API and worker are approved.

Prompt 10 adds a Dispatch domain/helper module, a desktop-first responsive dashboard and reusable structured action fields. The UI still receives only service-scoped orders and cannot change a status directly. Both mock and future API implementations expose the same Dispatch reference-data method and workflow action contract.

```text
Rhomberg Connect Customer Desktop
                 |
Rhomberg Connect Customer Mobile
                 |
Rhomberg Operations Internal Mobile
                 |
Rhomberg Operations Internal Desktop
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
| `src/apps/` | Preview landing and platform-specific customer setup/settings presentation |
| `src/components/` | Existing reusable catalogue, RFQ, Planning, Expediting, Dispatch, workflow and account screens |
| `src/shared/platform/` | Four preview definitions, route resolution and preview-role gates |
| `src/shared/personalisation/` | Themes, scalable typography/density values, colour protection and image rules |
| `src/domain/` | Central workflow, access policy, queue and configuration business rules |
| `src/services/` | Shared contracts plus interchangeable mock and HTTP implementations |
| `preview/` | Stable GitHub Pages entry documents; no duplicated application bundles |
| `docs/` | Production and preview handover material |

## Runtime selection

The root document opens the Preview Centre. A preview document includes a non-secret preview ID and the shared `app.js`. `previewConfig.js` resolves that ID to an allowed role set. Authentication still happens through the shared auth service, then the interface rejects a session that is not supported by that preview.

Preview role gating is an additional presentation boundary, not a replacement for permissions. Service methods and workflow transitions still enforce company, assignment, queue and action access.

## Shared logical data

All four routes use the same storage keys in one browser origin. That lets a customer RFQ appear in the representative preview and later Planning/Expediting views in the same browser profile. GitHub Pages cannot synchronise separate browsers or devices. The private-cloud API will become the shared source of truth in production.

## Production direction

The production build aliases the mock service to `apiEntry.js`, defines public-preview features as disabled, excludes demo accounts/routes and scans the output for forbidden markers. Authentication must use secure server cookies, and the API—not a UI route—must enforce tenant isolation, permissions, transitions and audit creation.
