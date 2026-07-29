# Authentication and credential-change design

The preview uses fabricated browser-only accounts and is not production authentication.

## Separate realms

Customer and internal staff authentication are distinct realms with different login screens, route sets and role populations. A valid account from one realm cannot sign in through the other. Shared implementation is acceptable only when the session retains a server-verified realm and every route enforces it.

## Credential change

1. An authenticated user requests a username or password change.
2. The server rate-limits the request and creates a hashed, six-digit, short-lived one-time challenge.
3. Delivery is sent only to the already verified account email.
4. Attempts decrement on failure. Expired, consumed or invalidated codes cannot be reused.
5. A valid code applies the change in one transaction, audits it, invalidates the challenge and revokes sessions after a password change.
6. A confirmation notification is queued without echoing the new credential.

Mock mode simulates delivery and may show a clearly labelled development code. Production builds must exclude demo accounts and development codes. Passwords require an approved modern hash, strength controls, breach screening, reset safeguards, suspicious-activity monitoring and secure cookies. Logs must never contain credentials or verification codes.
