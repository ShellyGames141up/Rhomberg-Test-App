# Expediting, notification acknowledgement and live refresh correction

Status: local implementation, not deployed. Preserve the separately reviewed role/permission correction (migration 018). No VM, credentials or real operational data are changed by this work.

## Confirmed defects and correction

- The API supplied Expeditor step IDs/labels but omitted `selectableForUpdate`. The interface filtered out every step. Pure step/document definitions now live in `apps/api/src/domain/expeditingOptions.js` and are re-exported by the frontend domain module. They ship inside the existing API runtime package without a frontend-source dependency. The API returns complete definitions; workflow validation rejects hold/cancellation through the ordinary progress action.
- Notifications had a recipient SELECT policy but no UPDATE policy. Migration `019_notification_read_access.sql` adds own-recipient UPDATE. Existing column grants stay restricted; no other-recipient access is granted. Runtime-grant preflight refuses to revoke/reapply privileges before this policy exists.
- Single acknowledgements return `{id,readAt}`; the UI merges this into the existing notification. Mark-all returns `updatedCount` (and existing `updated` alias). First acknowledgement and non-empty mark-all produce transactional audit events; repeated single reads preserve the timestamp without duplicate audit entries.
- Order notifications identify/open an order. Expediting history uses the existing interface shape. Customer projections omit internal Expediting notes, staff identifiers and internal document references; customer timeline messages never fall back to internal notes.

## Automatic updates

Authenticated clients check `GET /api/v1/workspace/updates` every **30 seconds**. Response: `{data:{revision:"<opaque SHA-256>",intervalSeconds:30}}`. The token reflects RLS-visible RFQs, orders, technical requests, own notifications, visible audit history and effective permissions. Another company's hidden changes do not change a customer's token. It is a change detector, not a credential or authorization proof.

Only a changed revision triggers service-layer retrieval of the authorised account, RFQs, orders, notifications and audit. Self-loading Administration, Technical, Management and Archive views receive a refresh signal. Public mock previews use the same controller with independent mock reads; staging never falls back to mock data.

Polling pauses for hidden/offline pages, retries on focus/connectivity return, never overlaps cycles and backs off to 60/120 seconds on failures. Session/access rejection signs the interface out. Disposal ignores late responses. Unsaved workflow forms, message drafts and open dialogs defer snapshot application; deferred revisions are not consumed. RFQ drafts, settings, filters and scroll are not reset. Updates are eventual, not instantaneous; editing can delay them.

## Deployment and limitations

Before separately approved deployment, apply migrations through **018 and 019**, then the reviewed runtime grants with the intended restricted runtime role. Deploy matching frontend/API code together: older APIs lack the revision endpoint. Do not grant broad privileges as a workaround.

The staging revision query aggregates visible IDs/versions each check. Measure load before wider rollout; a future indexed per-user/queue change feed can reduce cost without exposing global activity. This does not introduce WebSockets, real push or email. HTTPS, cookies, CSRF, RBAC and RLS remain in force.

## Verification

Tests cover selectable options, forbidden progress shortcuts, read/read-all audit idempotency, missing CSRF, cross-recipient denial, revision authentication/no-store, real PostgreSQL company isolation, customer-safe history and unchanged-company revisions. Timer tests cover 30-second scheduling, unchanged data, hidden/offline availability, unsaved edits, non-overlap, disposal and retry/backoff.

Local verification used Node 22.23.2, pnpm 11.19.0 and disposable PostgreSQL 17.10. The full backend suite passed 78 tests with no skips, including the new real-database case. Migrations 001–019 applied from empty and repeated safely; runtime grants applied as the migration identity. Frontend suite, JS/CSS checks, production/internal-staging builds and scanners, Android static packaging checks, all five previews and combined Pages build passed. The local browser harness displayed ten selectable progress steps and validated Materials received/Production started in light/dark themes without console errors. This harness used real components/options/validation but is not a live server acceptance test.

Post-deployment acceptance must separately verify on RHOMAPP using fabricated data: Expeditor selects/saves progress; customer/representative receive updates without reload; each marks one/all alerts read and confirms persistence; another company sees neither record nor notification; an unsaved editor survives another user's update. Local tests are not live RHOMAPP acceptance.
