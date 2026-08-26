# Administrator Guide

Open **Administration → User Management** to search and filter staff, add an employee, edit identity details, assign roles, transfer branch, manage notifications, upload a profile picture, reset login, inspect immutable history, disable access, archive an employee or soft-delete a non-Administrator account.

Newly created customer and employee accounts can sign in immediately with the temporary password entered during creation. Their first session opens the mandatory password-change screen; do not reset a newly created login as part of normal onboarding. After the password is changed, the original session is revoked and the user signs in with their new password.

**Delete account** immediately revokes access but deliberately preserves historical RFQs, orders, documents and audit history. Record a clear reason. Self-deletion and deletion of Administrator identities are blocked.

Every mutation uses the service layer. Use a meaningful reason and complete step-up verification when requested. Administrators cannot view current passwords, edit signed certificates or historical quotation versions, alter audit history, delete active orders or bypass workflow without separate authority.

Real staff are not loaded into the public GitHub Pages demo. Production provisioning uses the protected API and private reviewed import file only after IT approval.
