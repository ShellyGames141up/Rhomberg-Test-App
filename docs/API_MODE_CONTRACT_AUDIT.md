# API-mode frontend/backend contract audit

Generated from `src/services/api/createApiServices.js` and `apps/api/src/app.js`.

- Unique frontend API contracts: **135**
- Registered backend API routes: **143**
- Registered backend routes including health endpoints: **146**
- Frontend contracts currently implemented: **135**
- Frontend contracts still missing: **0**
- Frontend contracts currently incompatible: **0**

Every active API-mode adapter contract has a matching backend route. Contract parity does not replace workflow, authorization, persistence or browser acceptance testing.

| Frontend route | Method | Authentication | CSRF | Backend status | Priority |
| --- | --- | --- | --- | --- | --- |
| /admin/customer-accounts | POST | authenticated session | required | implemented | P2 |
| /admin/locations | GET | authenticated session | not required | implemented | P1 |
| /admin/locations | POST | authenticated session | required | implemented | P2 |
| /admin/locations/:id | PATCH | authenticated session | required | implemented | P2 |
| /admin/retention-policy | GET | authenticated session | not required | implemented | P1 |
| /admin/retention-policy | PUT | authenticated session | required | implemented | P2 |
| /admin/users | POST | authenticated session | required | implemented | P2 |
| /admin/users/:accountId | DELETE | authenticated session | required | implemented | P2 |
| /admin/users/:accountId/archive | POST | authenticated session | required | implemented | P2 |
| /admin/users/:accountId/audit | GET | authenticated session | not required | implemented | P1 |
| /admin/users/:accountId/branch | POST | authenticated session | required | implemented | P2 |
| /admin/users/:accountId/login-history | GET | authenticated session | not required | implemented | P1 |
| /admin/users/:accountId/profile-image | POST | authenticated session | required | implemented | P2 |
| /admin/users/:accountId/roles | POST | authenticated session | required | implemented | P2 |
| /admin/users/:accountId/temporary-password | POST | authenticated session | required | implemented | P2 |
| /admin/visit-policy | GET | authenticated session | not required | implemented | P1 |
| /admin/visit-policy | PUT | authenticated session | required | implemented | P2 |
| /administration/catalogue/:kinds/:itemId | PATCH | authenticated session | required | implemented | P2 |
| /administration/companies/:companyId | PATCH | authenticated session | required | implemented | P2 |
| /administration/companies/:companyId/representative | PUT | authenticated session | required | implemented | P2 |
| /administration/overview | GET | authenticated session | not required | implemented | P0 |
| /administration/users/:accountId | PATCH | authenticated session | required | implemented | P2 |
| /administration/users/:accountId/notification-preferences | PUT | authenticated session | required | implemented | P2 |
| /administration/users/:accountId/permissions | PUT | authenticated session | required | implemented | P2 |
| /administration/users/:accountId/status | PUT | authenticated session | required | implemented | P2 |
| /administration/workflow-records/:recordId/corrections | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/complete | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/customer-confirmation | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/location-check | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/missed-reason | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/qr | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/qr/verify | POST | authenticated session | required | implemented | P2 |
| /appointments/:appointmentId/start | POST | authenticated session | required | implemented | P2 |
| /archived-orders | GET | authenticated session | not required | implemented | P1 |
| /audit-events | GET | authenticated session | not required | implemented | P1 |
| /auth/change-password | POST | authenticated session | required | implemented | P2 |
| /auth/csrf-token | GET | public approved reference/auth route | not required | implemented | P0 |
| /auth/login | POST | public approved reference/auth route | not required | implemented | P0 |
| /auth/logout | POST | authenticated session | required | implemented | P2 |
| /auth/me | GET | authenticated session | not required | implemented | P0 |
| /auth/register | POST | public approved reference/auth route | not required | implemented | P0 |
| /auth/workspace | POST | authenticated session | required | implemented | P2 |
| /clients/:clientId/appointments | POST | authenticated session | required | implemented | P2 |
| /companies | GET | authenticated session | not required | implemented | P1 |
| /companies/me | GET | authenticated session | not required | implemented | P1 |
| /dispatch/workspace-options | GET | authenticated session | not required | implemented | P1 |
| /enquiries | GET | authenticated session | not required | implemented | P0 |
| /enquiries | POST | authenticated session | required | implemented | P2 |
| /enquiries/:enquiryId | GET | authenticated session | not required | implemented | P1 |
| /enquiries/:recordId/workflow-actions | GET | authenticated session | not required | implemented | P1 |
| /enquiries/:recordId/workflow-actions | POST | authenticated session | required | implemented | P2 |
| /enquiries/inbox | GET | authenticated session | not required | implemented | P1 |
| /enquiries/options | GET | authenticated session | not required | implemented | P1 |
| /enquiry-drafts/current | GET | authenticated session | not required | implemented | P1 |
| /enquiry-drafts/current | PUT | authenticated session | required | implemented | P2 |
| /expediting/workspace-options | GET | authenticated session | not required | implemented | P1 |
| /laboratory/dashboard | GET | authenticated session | not required | implemented | P1 |
| /laboratory/orders | GET | authenticated session | not required | implemented | P1 |
| /laboratory/orders/:orderId/certificates/archive | POST | authenticated session | required | implemented | P2 |
| /laboratory/orders/:orderId/certificates/batch | POST | authenticated session | required | implemented | P2 |
| /laboratory/orders/:orderId/units/:unitId/certificate | POST | authenticated session | required | implemented | P2 |
| /laboratory/orders/:orderId/units/:unitId/certificate/replace | POST | authenticated session | required | implemented | P2 |
| /laboratory/workspace-options | GET | authenticated session | not required | implemented | P1 |
| /management/dashboard | GET | authenticated session | not required | implemented | P1 |
| /management/performance-report-options | GET | authenticated session | not required | implemented | P1 |
| /management/performance-reports | POST | authenticated session | required | implemented | P2 |
| /management/records/:recordId/representative | POST | authenticated session | required | implemented | P2 |
| /management/records/:recordId/workflow-override-approval | POST | authenticated session | required | implemented | P2 |
| /management/reports | POST | authenticated session | required | implemented | P2 |
| /management/representatives | GET | authenticated session | not required | implemented | P1 |
| /notifications | GET | authenticated session | not required | implemented | P0 |
| /notifications/:notificationId/deliveries/:deliveryId/retry | POST | authenticated session | required | implemented | P2 |
| /notifications/:notificationId/read | POST | authenticated session | required | implemented | P2 |
| /notifications/read-all | POST | authenticated session | required | implemented | P2 |
| /orders | GET | authenticated session | not required | implemented | P0 |
| /orders/:orderId | GET | authenticated session | not required | implemented | P1 |
| /orders/:orderId/archive | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/archive-approval | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/deletion-requests | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/legal-hold | PUT | authenticated session | required | implemented | P2 |
| /orders/:orderId/restore | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/retention-exports | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/source-documents | GET | authenticated session | not required | implemented | P1 |
| /orders/:orderId/source-documents/:documentId/versions | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/summary-emails | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/summary-pdfs | POST | authenticated session | required | implemented | P2 |
| /orders/:orderId/summary-sharing-options | GET | authenticated session | not required | implemented | P1 |
| /orders/:recordId/workflow-actions | GET | authenticated session | not required | implemented | P1 |
| /orders/:recordId/workflow-actions | POST | authenticated session | required | implemented | P2 |
| /planning/workspace-options | GET | authenticated session | not required | implemented | P1 |
| /products | GET | public approved reference/auth route | not required | implemented | P0 |
| /products/:productId | GET | public approved reference/auth route | not required | implemented | P1 |
| /products/categories | GET | public approved reference/auth route | not required | implemented | P0 |
| /products/recommendations | GET | public approved reference/auth route | not required | implemented | P0 |
| /quality-assurance/dashboard | GET | authenticated session | not required | implemented | P1 |
| /quality-assurance/orders | GET | authenticated session | not required | implemented | P1 |
| /quality-assurance/workspace-options | GET | authenticated session | not required | implemented | P1 |
| /reference-data/registration | GET | public approved reference/auth route | not required | implemented | P0 |
| /representatives/appointments | GET | authenticated session | not required | implemented | P1 |
| /representatives/client-activity | GET | authenticated session | not required | implemented | P1 |
| /representatives/clients | GET | authenticated session | not required | implemented | P1 |
| /representatives/orders | POST | authenticated session | required | implemented | P2 |
| /representatives/orders/duplicate-check | POST | authenticated session | required | implemented | P2 |
| /representatives/orders/options | GET | authenticated session | not required | implemented | P1 |
| /representatives/work-location-summary | GET | authenticated session | not required | implemented | P1 |
| /rfqs/:rfqId/technical-support | GET | authenticated session | not required | implemented | P1 |
| /rfqs/:rfqId/technical-support | POST | authenticated session | required | implemented | P2 |
| /sales-manager/missed-visits/detect | POST | authenticated session | required | implemented | P2 |
| /sales-manager/visit-compliance | GET | authenticated session | not required | implemented | P1 |
| /technical-support/:requestId/assign | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/complete | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/messages | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/override | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/request-information | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/request-information/customer | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/respond | POST | authenticated session | required | implemented | P2 |
| /technical-support/:requestId/rfq/download | GET | authenticated session | not required | implemented | P1 |
| /technical-support/:requestId/start-review | POST | authenticated session | required | implemented | P2 |
| /technical-support/metrics | GET | authenticated session | not required | implemented | P1 |
| /technical-support/options | GET | authenticated session | not required | implemented | P1 |
| /technical-support/queue | GET | authenticated session | not required | implemented | P1 |
| /users/me/notification-preferences | GET | authenticated session | not required | implemented | P0 |
| /users/me/notification-preferences | PUT | authenticated session | required | implemented | P2 |
| /users/me/personalisation | GET | authenticated session | not required | implemented | P1 |
| /users/me/personalisation | PUT | authenticated session | required | implemented | P2 |
| /users/me/personalisation/images | POST | authenticated session | required | implemented | P2 |
| /users/me/personalisation/images/:imageId | DELETE | authenticated session | required | implemented | P2 |
| /users/me/personalisation/reset | POST | authenticated session | required | implemented | P2 |
| /users/me/settings | GET | authenticated session | not required | implemented | P0 |
| /users/me/settings | PUT | authenticated session | required | implemented | P2 |
| /users/me/settings/onboarding/tutorial | PUT | authenticated session | required | implemented | P2 |
| /users/me/settings/onboarding/tutorial/reset | POST | authenticated session | required | implemented | P2 |
| /users/me/settings/onboarding/welcome | POST | authenticated session | required | implemented | P2 |
| /users/me/settings/reset | POST | authenticated session | required | implemented | P2 |
| /workspace/updates | GET | authenticated session | not required | implemented | P1 |

## Transport findings

- `HttpClient` supports GET, POST, PUT, PATCH and DELETE with the shared credential, CSRF, timeout and error-handling policy.
- Credentialed CORS permits the minimal frontend method set only for exact configured HTTPS origins; wildcard and unapproved origins remain rejected.
- Missing later-workflow routes must not be replaced with client-side mock fallbacks in staging.
