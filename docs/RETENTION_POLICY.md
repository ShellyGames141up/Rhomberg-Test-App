# Archive and retention policy

## Demonstration defaults

| Setting | Safe mock default |
| --- | ---: |
| `archive_completed_orders_after_days` | 90 |
| `retain_archived_orders_for_days` | 2555 (approximately seven years) |
| `allow_permanent_deletion` | `false` |
| `deletion_requires_manager_approval` | `true` |
| `deletion_requires_administrator_approval` | `true` |

These values are demonstration settings, not an approved records policy. Rhomberg, IT, Legal, Finance and the relevant quality owner must approve the production periods, document classes, tax/warranty obligations, legal-hold process, deletion authorities and evidence requirements.

## Lifecycle

1. A completed order remains in the normal completed-order history.
2. When its completion date passes the archive threshold, the retention service marks it `archive_eligible`.
3. A Manager or Administrator may archive the eligible record. This is a deliberate action, never a consequence of the record not being opened.
4. The archived order is removed from active operational queues and remains searchable in the Archived Orders workspace.
5. Restore returns the record to completed-order history without erasing its archive or audit evidence.

Archiving preserves the complete order aggregate, original RFQ/order/PO/job references, generated-document metadata, PDFs, customer timeline, internal audit references, Dispatch/Planning/Expediting data and any legal-hold or investigation flag.

## Legal hold

A Manager or Administrator may apply a legal or investigation hold with a meaningful reason. A hold survives archiving and blocks permanent deletion. Releasing a hold is a separate audited event; existing hold history is not overwritten.

## Permanent deletion

The browser implementation cannot permanently delete an order. A future backend-only deletion workflow must:

- confirm the approved policy permits deletion and that the archived retention period has elapsed;
- reject the request if any legal hold is active;
- create and protect a retention export first;
- collect the configured Manager and Administrator approvals from different authorised sessions where required;
- re-check all conditions inside one server transaction;
- delete or cryptographically dispose of private objects using the approved storage lifecycle;
- append a tamper-evident deletion-log record containing identifiers, approvals, export hash, policy version, request/correlation IDs and completion outcome;
- retain the deletion record and audit evidence for the separately approved audit-retention period.

No scheduled task may use “last opened” or ordinary user inactivity as a deletion trigger.

## Production jobs and monitoring

The production backend needs a scheduled eligibility job, dry-run reports, idempotent archive commands, protected retention exports, legal-hold administration, deletion approval workflow, failure/retry monitoring, backup/restore verification and policy-version history. Browser local storage is demonstration-only and is not a production retention store.
