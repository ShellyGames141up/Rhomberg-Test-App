# Secure Administrator Management

## Scope

The current Administrator login opens one desktop workspace for approved application data. The public browser preview uses fabricated records; internal staging uses the server API and PostgreSQL service. Components never read or write `localStorage` directly.

The workspace separates customer identities from internal staff identities and manages customer companies and contacts, usernames, email addresses, phone numbers, branch and dedicated-representative assignments, staff roles and permissions, account status, catalogue/categories, notification preferences, archive lookup and approved RFQ/order reference corrections.

An Administrator-created customer or employee account is active immediately with the supplied temporary password. Its first authenticated session is restricted to the security screen until the account holder replaces that password; the normal flow never requires an Administrator to reset the newly created login. The original credential is not returned by the API or written to audit history.

## Capability model

Opening Administration requires `administer_users`. Mutations additionally require the narrow capability relevant to the target:

| Capability | Scope |
| --- | --- |
| `manage_customer_companies` | Company master data, branch and representative |
| `manage_customer_contacts` | Customer identities and status |
| `manage_internal_accounts` | Internal staff identities and status |
| `manage_roles_permissions` | Internal roles and explicit permissions |
| `manage_notification_preferences` | Account notification preferences |
| `manage_products` | Approved catalogue/category fields |
| `correct_approved_records` | Append-only approved reference corrections |

An Administrator may have a smaller explicit permission set. The server calculates effective authority; the interface only presents it. Mock `authorisedCompanyIds` demonstrates tenant restriction and can never expand scope.

## Audit and verification

Every mutation creates an immutable event containing action, entity, company, previous value, new value, changed fields, acting user, acting role, timestamp and reason. Corrections are appended rather than overwriting history. A reason of at least eight characters is required for every administrative change.

Mock mode asks for the fabricated current Administrator password for suspension, permission changes, role changes and approved record corrections. It never stores that confirmation in audit evidence. Production exchanges password/MFA/WebAuthn confirmation for a short-lived, single-purpose step-up token; business requests must not retain a password.

Important changes open a confirmation dialog. The backend rechecks permission, identity realm, company scope, current version and immutable-field rules regardless of interface state.

Account deletion is an audited soft delete, not destructive erasure. It is restricted to `administer_users`, requires a reason, revokes sessions and active memberships/assignments, and prevents future authentication. Historical companies, RFQs, orders, documents and audit events remain intact. An Administrator cannot delete their own account or another active Administrator account through this workflow.

## Protected boundaries

The correction service allow-lists customer contact, internal job number and customer PO number. It rejects signed certificates, audit/correction history, workflow status/history, quotation versions, internal historical notes and active-order deletion. Workflow overrides remain separate state-machine actions requiring their own permission, reason and audit evidence. Catalogue edits never rewrite historical RFQ/order snapshots.

## Production requirements

- Secure-cookie sessions, CSRF protection, company row-level policy, optimistic versions and idempotency.
- Separate customer/internal identity realms and approved staff MFA.
- Uniqueness constraints for username/email and foreign keys to branches, companies and representatives.
- Account-security notifications for sensitive changes without secrets.
- Monitoring for denied cross-company attempts, verification failures and privilege escalation.
- Rhomberg and IT approval before enabling production administrators or catalogue publishing.
