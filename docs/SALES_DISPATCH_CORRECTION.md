# Sales quotation and Dispatch correction — pending release

## Confirmed causes

- The RFQ and order workflow endpoints treated multipart uploads as JSON. The action was therefore unavailable to authorization, resulting in a misleading forbidden response.
- Dispatch receipt and delivery-problem actions were missing from the server action map.
- Dispatch method/proof choices were strings while the shared UI requires labelled objects.
- Dispatch updates were saved in a different shape from the shared UI's `dispatch` receipt/handover state.
- PostgreSQL document policies did not permit a Dispatch user to insert private proof metadata, even when that user could legitimately complete the handover.

## Correction

The existing API endpoints accept one action-matched document with one structured payload. They validate extension/MIME agreement, size, non-empty content and PDF signature. Authorization, CSRF, assignment checks, row locks, status order and private storage remain enforced. A rejected action removes its newly stored attachment.

The assigned Sales Representative can mark an RFQ quoted using the real frontend adapter and a quotation PDF. Internal notes and commercial totals stay out of customer RFQ payloads. Pending Technical Review still blocks quotation; this correction does not override it.

Dispatch users retain their existing permissions. Receipt must be confirmed before release. Collection and delivery use their respective methods, required dates, package counts and recipient fields. Completion follows confirmed handover, not receipt alone. Delivery problems retain the out-for-delivery state. Customer-safe messages are added to timelines and notifications, with separate immutable audit events.

Migration `022_dispatch_proof_access.sql` adds SELECT/INSERT policies only for Dispatch proof linked to a visible order with matching company. INSERT requires the current uploader, relevant handover permission, pending scan status and private visibility. No broad document permission or RLS bypass is added. Existing grants script still applies; there are no new helper functions requiring EXECUTE grants.

Proof metadata and history persist across retrieval. Customer projections exclude receipt exceptions, private notes and proof. Existing internal document downloads remain audited; customer download is rejected for private proof. Malware scanning is not implemented by this change: uploads stay pending, and this is not approval for real confidential data.

## Validation

`apps/api/test/sales-dispatch-database.test.js` runs the actual frontend API adapter against the server and a database runtime role. It covers Sales PDF submission, unassigned Representative denial/attachment cleanup, Dispatch options, receipt, collection, delivery/problem/completion, Laboratory receipt, persisted details, notifications, audit, CSRF denial, customer/company isolation, proof download authorization, direct-SQL company mismatch rejection and log token/password exclusion.

The test passes on disposable local PostgreSQL 17.10 with all 22 migrations from empty and repeated migration execution. It also runs under PGlite in the regular backend suite. `dispatch-validation.test.js` exercises server-side field validation, receipt replay, unauthorized exceptions and injected document ownership/visibility.

## Release boundaries

This is local source/test work; RHOMAPP has not been changed. A matching tested release and migrations must be packaged and installed before live retesting. Existing orders that already skipped receipt are not silently backfilled: establish their legitimate state before correction. The broader Technical workflow, Temperature certification and departmental-parity requests are not declared complete by this report.
