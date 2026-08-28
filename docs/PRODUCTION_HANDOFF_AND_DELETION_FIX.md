# Production handovers, representative directory and deletion

Staging release 5.2.21 preparation, following 5.2.20. This is not a deployment or real-data approval. The existing 15-minute background refresh interval is unchanged. The source package baseline stays 5.2.0; the release manifest carries the staging version and exact source commit.

## Physical workflow (API mode)

1. Planning receives either an accepted RFQ-derived order or a representative-loaded order. Both persist as orders in `awaiting_planning`; a representative-loaded order does not need a synthetic RFQ.
2. Planning records the job/Sales Order details and submits to Expediting.
3. Expediting confirms receipt, then records Parts On Floor, Assembly Started, First Standard Calibration, Final Assembly and Final Standard Calibration in that order.
4. The **QC — Send to Quality Control** action requires all those steps and confirmation of the handover checks. QC inspects every order, including SANAS units.
5. QC passes the inspection and releases to the appropriate destination:
   - No certification required: Dispatch.
   - SANAS units (and retained historical Traceable units): Laboratory.
6. Laboratory confirms physical receipt before initial certificate uploads. Every configured certified unit requires its own certificate. Completing uploads does not silently complete the physical handover: **Send Certified Units to Dispatch** is an explicit action.
7. Dispatch confirms receipt from QC or Laboratory, then performs collection/delivery and completion using the existing controlled workflow.

Transitions are checked against the persisted status under a database row lock. Skipping production steps, duplicate physical receipt and release with missing/rejected certificates fail. Customer and assigned representative notifications and immutable workflow/audit events record the handovers. Internal notes remain excluded from customer payloads. Certificate download still requires the existing document-authorisation/scan checks.

In-flight historical records are not given fabricated receipt timestamps, progress steps or certificates. Already-received legacy Expediting records without the recorded receipt must confirm the physical receipt once. Existing Laboratory records are not moved backwards through QC. Operators must record truthful progress for old orders; there is no automatic backfill of completion.

The separate public mock/Executive Demo retains its existing historical workflow. This change does not import demonstration records or services into staging.

## Visibility and directory corrections

- Order queue scopes combine independently granted permissions instead of intersecting a Sales assignment with a Planning queue.
- Additional department actions require their queue and action permissions; a Sales-only account cannot act on another representative's orders.
- Customer projections include authoritative primary/secondary company membership. Customer UI uses those memberships, never matching two missing account IDs. Revoked membership stops visibility.
- Migration **024_representative_directory_sync.sql** synchronises active Sales role holders' directory profiles and keeps name, branch and active state current. Existing profiles retain their IDs. Existing RFQ/order representative snapshots and customer relationships are not rewritten.
- Representatives with no assigned branch are shown as unassigned in Administration; assign a valid branch before selecting them for a branch-restricted customer relationship.

## Administrator deletion

User deletion remains the existing server-side operation: a reason is required; access, sessions, roles and assignments are revoked. Deleted users cannot log in or reuse an existing session. Self/Administrator account deletion remains protected. Records and audit history are retained.

Administration → Records now provides **Delete order** for Administrator accounts. This is an audited soft deletion:

- Requires an active authoritative Administrator role, the existing administration permission, valid session, CSRF and an 8–1,000 character reason.
- Removes the order from active queues/customer lists; normal order detail and workflow actions return not found.
- Preserves the order's original status, documents, historical workflow and audit rows.
- Refuses deletion when the order is on legal hold.
- Repeated deletion is idempotent and does not append duplicate deletion events.
- Runtime SQL cannot directly change `orders.deleted_at`; only the restricted database function can perform the audited operation.

The Records panel shows the most recent 80 of the backend's 200 active order summaries. This is not a bulk-deletion or permanent-purge feature. Existing authorised document-history access is preserved; deleting an order does not erase its documents.

## Database/API handover

Apply all migrations through **025_administrator_order_soft_delete.sql**, then the matching `apps/api/sql/phase1-runtime-grants.sql`. Use the established migration identity, not the runtime account. Migration 025 adds `app.soft_delete_order(uuid,text,text)`, revokes public execution and grants the runtime identity only the exact approved function signature. Runtime order updates are narrowed to required columns.

New route: `DELETE /api/v1/admin/orders/{orderId}`.

Fabricated request: `{"reason":"FABRICATED duplicate order created during testing"}`.

Success returns `data: {id,status:"deleted",deletedAt}` plus request metadata. Responses include 400 invalid input, 401 unauthenticated, 403 forbidden/CSRF, 404 inaccessible or missing order, and 409 legal hold.

The existing generic order workflow endpoint now supports `receive_lab_order` and `release_from_lab`. The QC release destination is determined server-side from persisted product configurations, never a client-supplied status.

## Regression coverage and acceptance boundary

- Real disposable local PostgreSQL 17.10: full migration chain/repeat, deployed grant script, runtime roles/RLS, representative creation/assignment, customer and Planning visibility, both physical handover routes, user/session revocation and order deletion/legal hold.
- API adapter tests: multipart documents, standard and SANAS orders, customer-safe notifications, permissions, persistence and rejected transitions.
- React rendering tests: labelled production steps, QC destination and certificate-complete orders remain actionable until Laboratory handover.
- Completed local validation: Node 22.23.2 / pnpm 11.19.0 frozen install, JavaScript and CSS checks, complete frontend suite, 109 backend tests (109 passed, none failed or skipped), production and internal-staging builds/security scans, Android packaging checks, catalogue/document checks, all five preview builds and the combined GitHub Pages artifact. `git diff --check` passed. The API contract audit reports 136 frontend contracts and 144 backend routes with no missing routes or transport incompatibilities.
- UI regression checks render React components locally; they are not a substitute for interactive RHOMAPP browser acceptance or physical device testing. No Android APK/AAB or Windows release ZIP was created for this change.

No VM, IIS or staging database was modified by these local tests. RHOMAPP acceptance must repeat account deletion on a disposable test user, order deletion on an unheld fabricated order, and both physical workflows after the next approved deployment.
