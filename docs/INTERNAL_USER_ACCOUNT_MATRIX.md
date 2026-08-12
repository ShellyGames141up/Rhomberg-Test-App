# Internal User Account Matrix

The public repository does not contain Rhomberg employee names, work email addresses or usernames. The authoritative account matrix is a controlled pre-production artefact owned jointly by Rhomberg and IT.

Its columns are:

| Field | Purpose |
| --- | --- |
| User name | Approved employee display name |
| Login email / username | Identity-provider or approved local identifier |
| Branch | Authorised operational branch |
| Role(s) | One or more approved permission roles |
| Workspace | Role-specific application destination |
| Activation status | Pending review, pending activation, active, suspended or archived |

Authorised reviewers with the ignored `private/internal-staff.local.json` roster can run `npm run check:private-staff` followed by `npm run docs:private-staff`. This creates `docs/private/INTERNAL_USER_ACCOUNT_MATRIX.md` locally. Both source and generated files are excluded from Git and public deployment.

The generated matrix is a review aid, not an account-provisioning mechanism. Production creation and activation must use the authenticated backend or approved identity provider, require authorised role and branch approval, and create immutable audit events. Passwords and temporary credentials are prohibited from every account matrix.

## Final access review

The public Preview Centre contains fabricated accounts only. Real internal identifiers remain in the ignored private matrix. The normal application sign-in does not publish credentials or link to Preview Centre. Temporary passwords are produced only with secure Web Crypto, displayed once, hashed before persistence and excluded from audit evidence. Rhomberg and IT must approve the real roster, branch assignments, roles, activation state and identity-provider mapping before production provisioning.
