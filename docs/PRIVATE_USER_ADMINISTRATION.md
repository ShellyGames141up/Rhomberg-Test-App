# Private User Administration

## Purpose and current limitation

Rhomberg Connect now defines a production-oriented private-account handover process without pretending that GitHub Pages provides production authentication. Real operational identities must be approved by the owner and Innovate IT, provisioned by a secure backend or identity provider, and never added to public source, browser storage, bundles, source maps or documentation.

## Owner-approved roster

The tracked `private-config/internal-staff.example.json` is a schema/example containing only explicit `OWNER TO SUPPLY` placeholders. An authorised administrator copies it to ignored `private/internal-staff.local.json`, then supplies the approved full name, login identifier, branch, department, role assignment and activation status. Passwords, hashes, recovery codes and other credentials are prohibited in both roster files.

The roster covers Administrator, Company Owner, Manager, Sales Manager, Sales Representative, Expeditor, Planning, Dispatch, Laboratory User, Laboratory Manager, Quality Assurance, Quality Manager, Technical Advisor and Technical Director. Buyer remains prepared/inactive because that is the existing application status.

## Encrypted initial-credential document

On a controlled administrator device, run:

```text
npm run docs:private-credentials
```

This creates the ignored file `private/RHOMBERG_CONNECT_INITIAL_USER_CREDENTIALS.pdf`. It contains a unique 20-character cryptographically random initial password for each configured account and the Sales Representative-to-test-client matrix. The generator requires uppercase, lowercase, digits and symbols, and removes its plaintext intermediate file before returning.

Before generation, the administrator must set `RHOMBERG_CREDENTIAL_PDF_PASSWORD` through an approved private environment or secrets mechanism. The generator rejects missing or short values. The password must be delivered separately through an IT-approved channel and must never be committed, printed inside the PDF or copied into documentation/browser configuration.

The PDF must be transferred only through an IT-approved private mechanism. It must not be committed, attached to a public release, uploaded to GitHub Pages or copied into any build output. Generated initial passwords are not stored in the roster and cannot be regenerated identically.

## First-login and production controls

Every initial password is temporary. Production authentication must enforce a password change on first successful login, server-side password hashing, MFA policy, expiry, lockout, secure recovery, revocation and server-managed sessions. Password values must never appear in localStorage, sessionStorage, runtime configuration, logs, audits, analytics or client bundles. Audit events record only safe metadata such as `PASSWORD_INITIALISED`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED` and `PASSWORD_RESET_COMPLETED`.

## Application access

The authoritative device-access matrix is `src/shared/platform/applicationAccess.js`. Workflow permissions remain in the established service permission model. Customer, Sales Representative, Expeditor and Manager support Desktop and Mobile. Controlled Planning, Dispatch, Laboratory, QA, Technical, Sales Manager, Owner and Administrator workflows remain Desktop-only. Buyer remains prepared/inactive.

## Test clients

Each configured Sales Representative requires exactly one fabricated, company-isolated test client before activation. Public fixtures use `.invalid` or `.test` contact data and must never be replaced with real customer information. Automated tests verify that an ordinary Representative sees only clients assigned to that Representative.

## Required Innovate IT work

Before activation, Innovate IT must provide the identity provider or authentication API, password/MFA policies, secure secrets management, protected account-provisioning channel, server-side role and company enforcement, immutable authentication audit storage, monitoring, incident response and approved credential delivery process.
