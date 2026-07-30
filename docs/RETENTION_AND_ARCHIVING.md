# Retention and Archiving

## Current Mock Capability

The mock service demonstrates:

- configurable retention policy values;
- archive eligibility after completion;
- authorised archive approval;
- archive and restore;
- legal/investigation hold;
- pre-deletion export;
- immutable audit history;
- a deliberate block on permanent browser-side deletion.

All records remain browser-local and can be lost when site data is cleared. Mock retention is not legal retention.

## Permission Boundary

Archive, restore, retention policy, legal-hold and deletion-request actions use named permissions and the service layer. Customers remain limited to their own company projections. Ordinary users cannot edit audit or archive evidence.

## Proposed Production Model

The PostgreSQL proposal includes `archive_records`, `retention_policies`, `workflow_overrides`, soft-deletion timestamps, archive timestamps and append-only audit controls.

Production archiving requires:

- approved retention periods per record/document class;
- a scheduled server-side eligibility job;
- legal-hold checks before archive or deletion;
- immutable archive evidence;
- private document lifecycle rules;
- backup coverage;
- dual approval for permanent deletion where required;
- a recoverability window;
- auditable restore and deletion results.

## Permanent Deletion

Permanent deletion must never be initiated only by front-end code. It requires an authenticated server operation, approved policy, authority check, hold check, reason, approval evidence and audit event.

## Decisions Required

- Legal and operational retention periods
- Definition of completed and archive-eligible
- Hold authority
- Archive storage tier
- Restore service level
- Export format
- Permanent deletion approvers
- Backup retention interaction
- Personal-information minimisation policy
