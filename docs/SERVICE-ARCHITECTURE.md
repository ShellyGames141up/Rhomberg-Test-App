# Service architecture

## Purpose

The React interface is now separated from persistence, authentication and delivery concerns. A screen never reads browser storage or calls a backend URL directly. It calls one of the service contracts exposed by `src/services/index.js`.

```text
React screens and App orchestration
              |
              v
 auth | accounts | products | enquiries | orders | workflow | audit | notifications
              |
       service implementation
          /             \
 mock browser demo     private-cloud API
 (active on Pages)     (prepared, inactive)
```

This boundary lets the company replace the demo implementation without redesigning the catalogue or RFQ experience.

## Service contracts

| Service | Responsibility |
|---|---|
| `auth` | Session lookup, sign-in, registration and sign-out |
| `accounts` | Current company context, registration reference data and authorised company access |
| `products` | Categories, product catalogue, product detail and recommendations |
| `enquiries` | Customer-scoped RFQ drafts, RFQ submission and RFQ retrieval |
| `orders` | Separate authorised order retrieval; order records are never returned by `enquiries` |
| `workflow` | Authorised RFQ/order timelines, permitted actions and controlled transitions |
| `tracking` | Compatibility alias for `workflow` while existing tracking views are retained |
| `audit` | Append-only workflow/security history within an authorised internal scope |
| `notifications` | Customer/staff notification inbox operations; mock mode queues local test records |
| `preferences` | Non-sensitive display preferences such as theme |

Every method is asynchronous, including the browser mock. This is intentional: moving to the API implementation will not require UI event handlers to change from synchronous to asynchronous later.

Current contract surface:

```text
initialize()
auth.getSession() | signIn(credentials) | register(account) | signOut()
accounts.getCurrent() | getRegistrationOptions() | listCompanies()
products.getCatalogue() | list(filters) | getById(productId)
enquiries.list(filters) | getById(id) | getDraft() | saveDraft(items) | submit(details, items)
orders.list(filters) | getById(id)
workflow.list(filters) | getAllowedActions(recordId) | performAction(recordId, actionRequest)
audit.list(filters)
notifications.list(filters) | markRead(notificationId)
preferences.getTheme() | setTheme(theme)
```

No service accepts an arbitrary target status. `performAction` accepts a stable action code, comment, structured action data and expected record version. The central validator in `src/domain/workflow.js` owns transitions, role checks, required fields, visibility, notifications and audit metadata. See `WORKFLOW_STATE_MACHINE.md`.

RFQ draft writes are serialised in API mode so rapid quantity/configuration changes cannot finish out of order.

## Implementations

### Mock implementation

`src/services/mock/createMockServices.js` is used by GitHub Pages. It preserves the existing same-browser demo accounts, drafts, RFQs, orders and controlled workflow history. The only direct browser-storage adapter is `src/services/browserStore.js`; API mode uses it only for the non-sensitive theme preference.

RFQs and orders are separate service resources and separate arrays inside one versioned mock workflow aggregate. One aggregate write is used when an accepted RFQ is converted: the RFQ becomes `converted_to_order` and a distinct `awaiting_planning` order is created together. This avoids the partial mock state that would be possible with two unrelated browser-storage writes. Existing combined version-2 records are migrated into the aggregate by `workflowType` when the preview first opens.

The new order stores an item snapshot with a generated order-line ID, source RFQ line ID and configuration snapshot. Later edits to catalogue metadata or RFQ display data therefore do not redefine what was converted. This is a browser-demo approximation of the transaction and immutable `order_items` rows required in PostgreSQL.

Legacy preview sessions are migrated only once and their old key is retired. Sign-out removes both the current and legacy session keys so an older browser profile cannot silently restore a staff session.

The mock is not production security. It does, however, model important rules:

- the password field is removed before an account enters React state;
- a customer receives only RFQs whose `companyId` matches the signed-in account;
- the separate order service applies the same company boundary and never returns another company's order;
- sales representatives receive only records assigned to their authoritative `representativeId`;
- Planning, Expediting and Dispatch receive order resources rather than the old combined RFQ/order list;
- status changes require an action allowed for the exact state and signed-in role;
- representatives are checked against the RFQ assignment before representative-only actions;
- Planning, Expediting and Dispatch handoffs cannot be skipped;
- every successful or denied workflow attempt creates a mock audit entry;
- notifiable actions queue mock notification records;
- notification inbox results are filtered by company, recipient role and representative assignment, with per-user read state;
- RFQ-to-order conversion creates one linked order and a separate order-creation audit record, and a repeated conversion is rejected;
- validation runs inside the service boundary, even when the UI has already validated the form;
- an RFQ is persisted before the test email is attempted, so an email failure does not lose the request.

All seeded companies and orders are fabricated test records.

### API implementation

`src/services/api/createApiServices.js` implements the same contracts against `/api/v1`. It is deliberately inactive until IT supplies a backend.

The API client is designed for:

- `Secure`, `HttpOnly`, `SameSite` session cookies;
- CSRF tokens for state-changing requests;
- request correlation IDs;
- idempotency keys for RFQ submission and workflow actions;
- structured validation errors;
- multipart Purchase Order uploads;
- request timeouts and friendly network errors.

Production access tokens must not be placed in Web Storage. The browser must never connect directly to PostgreSQL, SMTP or object storage with privileged credentials.

The service worker bypasses `/api/` requests entirely, so authenticated responses cannot be written to the public offline cache. It fetches `runtime-config.js` network-first so a controlled mode or endpoint change is not hidden by an old cache entry.

## Build selection and runtime configuration

Service mode is selected at build time so production JavaScript cannot contain dormant demo accounts or fallback email code:

```text
pnpm run build             -> mock-only GitHub Pages bundle
pnpm run build:production  -> API-only bundle in dist-production/
```

The production build is separate and ignored by Git until the company deployment pipeline collects it. It does not generate a public source map. A post-build scan must confirm that demo passwords, `formsubmit.co` and `RQ-TEST` do not exist in its JavaScript.

`runtime-config.js` supplies safe environment-specific connection settings to the API-only bundle:

```js
window.__RHOMBERG_APP_CONFIG__ = Object.freeze({
  apiBaseUrl: '/api/v1',
  requestTimeoutMs: 15000,
});
```

This file must contain URLs and feature settings only—never credentials, secrets or customer data.

## Error contract

Service failures use `ServiceError` with:

- `code`: stable machine-readable code;
- `status`: HTTP-compatible status;
- `message`: safe, user-friendly summary;
- `fieldErrors`: optional map of form-field names to messages.

The API must follow the error envelope in `API-CONTRACT.md`. Detailed stack traces, SQL errors and internal hostnames belong in server logs and must never be returned to the browser.

## Migration sequence

1. Implement and test the API contract in a non-production environment.
2. Provision PostgreSQL, object storage, email and secret management.
3. Add customer onboarding and staff identity integration.
4. Import approved company/representative/product master data through a controlled migration—not through browser seed data.
5. Run tenant-isolation, role, upload, email and restore tests.
6. Generate and deploy the API-only build to staging with its approved public API URL.
7. Obtain business and IT security approval.
8. Deploy the same reviewed API-only artifact to production with the production API URL.

GitHub Pages should remain a mock-only preview. It must not be used as the authenticated production host.
