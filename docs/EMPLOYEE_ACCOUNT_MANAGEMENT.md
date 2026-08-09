# Employee Account Management

`Administrator → User Management` is the reusable internal staff directory. It supports search by name, email or username and filters for branch, department, role and account status. The directory displays profile image, login identifier, branch, department, all assigned roles, last login and current status.

Administrators with the required capability can add and edit employees, assign multiple roles, record a branch transfer and effective date, change notification preferences, upload a validated private profile image, generate a one-time temporary password, force a password change, inspect login/audit history, disable an account or begin safe offboarding. High-risk actions require step-up confirmation. Role, permission, reset, disable and archive actions require a reason.

An account needs either a work email or an approved username, not both. Email is preferred where available. Username-only employees use an Administrator-generated temporary credential displayed once. The mock hashes credentials before storage for newly created staff; production must use an IT-approved slow password hash, breached-password screening, lockout controls, MFA and server-side sessions.

One identity may contain several role assignments. `Switch Workspace` changes the active role for navigation and acting-role records without creating another login. Server-side record scope remains mandatory.

Components never edit browser storage. All changes call the service contract and append immutable before/after evidence. Passwords, reset tokens and activation secrets are never returned by the directory or written to audit history.
