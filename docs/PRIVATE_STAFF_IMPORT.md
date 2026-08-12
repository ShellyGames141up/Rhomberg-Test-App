# Private Staff Account Import Contract

Real Rhomberg employee identifiers are maintained only in the ignored local file `private/internal-staff.local.json`. That file is not a public application seed, source-code module, test fixture, GitHub Pages asset or production-build input.

Each local staff record contains:

- `firstName`, `surname` and `displayName`
- either `email` or `username` as the login identifier
- approved `branchId` and `department`
- one or more authorised `roles`

It must never contain passwords, password hashes, temporary credentials, secrets or invitation codes. The local roster can be checked with `npm run check:private-staff`; the validator reports counts and validation failures without printing identifiers.

Before production import, Rhomberg and IT must verify employment status, spelling, branch scope, role combinations, identity-provider ownership and activation method. Import must use an authenticated backend administration endpoint, create immutable audit evidence and issue a time-limited activation or administrator-generated temporary credential that requires a password change. Browser code must not import or read the local roster.

The GitHub Pages mock continues to use fabricated `.invalid` and `.test` accounts only.
