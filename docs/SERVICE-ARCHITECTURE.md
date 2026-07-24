# Service architecture

## Purpose

The React interface is now separated from persistence, authentication and delivery concerns. A screen never reads browser storage or calls a backend URL directly. It calls one of the service contracts exposed by `src/services/index.js`.

```text
React screens and App orchestration
              |
              v
 central role profiles + permission catalogue
              |
              v
 auth | accounts | products | enquiries | orders | planning | expediting | workflow | audit | notifications
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
| `enquiries` | Customer-scoped RFQ drafts/submission plus the assigned representative inbox |
| `orders` | Separate authorised order retrieval; order records are never returned by `enquiries` |
| `planning` | Authorised Planning users, approved production locations and controlled priority reference data |
| `expediting` | Configured progress steps, Dispatch requirements, controlled metadata types and approaching-completion policy |
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
enquiries.list(filters) | listRepresentativeInbox(filters) | getById(id) | getDraft() | saveDraft(items) | submit(details, items)
orders.list(filters) | getById(id)
planning.getWorkspaceOptions()
expediting.getWorkspaceOptions()
workflow.list(filters) | getAllowedActions(recordId) | performAction(recordId, actionRequest)
audit.list(filters)
notifications.list(filters) | markRead(notificationId)
preferences.getTheme() | setTheme(theme)
```

No service accepts an arbitrary target status. `performAction` accepts a stable action code, comment, structured action data and expected record version. The central validator in `src/domain/workflow.js` owns transitions, role checks, required fields, visibility, notifications and audit metadata. See `WORKFLOW_STATE_MACHINE.md`.

RFQ draft writes are serialised in API mode so rapid quantity/configuration changes cannot finish out of order.

`src/services/contracts.js` is the single permission catalogue and role-to-permission matrix. `src/domain/accessControl.js` is the single UI/record-scope policy module: it supplies role profiles, default routes, navigation items, representative/company checks and Planning/Expediting/Dispatch queue predicates. React components consume these helpers rather than comparing role names.

`src/domain/rfqInbox.js` owns the representative inbox groups, priority normalisation, age calculation, search filtering and sort order. `src/components/SalesRepresentativeDashboard.jsx` consumes those helpers and the service-returned assigned RFQs; it never reads browser storage or broadens the representative scope itself.

`src/domain/planningQueue.js` owns the Planning queue stages, priority normalisation, order age/last-activity calculations, search, filtering, counts and sorting. `src/components/PlanningDashboard.jsx` is a desktop-optimised responsive consumer of those pure helpers. `src/components/PlanningFields.jsx` is shared with the generic management workflow panel, so management actions and the dedicated Planning workspace submit the same validated form structure.

`src/domain/expediting.js` is the single configurable Expediting progress catalogue for mock mode. It defines the proposed steps, required-for-Dispatch subset, queue filters, sort choices, priority rules, estimated-completion warning window and pure search/count helpers. `expediting.getWorkspaceOptions()` exposes the same contract from both service implementations, allowing the production API to provide reviewed configuration without changing React.

`src/components/ExpeditorDashboard.jsx` consumes only service-scoped orders and the returned workspace options. It provides one responsive mobile/desktop queue with oldest-update-first ordering, search across customer/representative/RFQ/order/job/PO references, due-soon/hold/priority views and read-only visibility after hand-off. `src/components/ExpeditingFields.jsx` is shared with the generic management workflow panel. It separates customer messages from internal notes and converts all Expediting interactions into the same validated workflow request.

## Implementations

### Mock implementation

`src/services/mock/createMockServices.js` is used by GitHub Pages. It preserves the existing same-browser demo accounts, drafts, RFQs, orders and controlled workflow history. The only direct browser-storage adapter is `src/services/browserStore.js`; API mode uses it only for the non-sensitive theme preference.

RFQs and orders are separate service resources and separate arrays inside one versioned mock workflow aggregate. One aggregate write is used for `accept_order`: the acceptance is verified, the RFQ moves through the transient `accepted` state to `converted_to_order`, and a distinct `awaiting_planning` order is created together. This avoids the partial mock state that would be possible with unrelated browser-storage writes. Existing combined version-2 records are migrated into the aggregate by `workflowType` when the preview first opens.

RFQ submission validates the signed-in customer/company, reloads the selected representative from the approved area directory and then stores a permanent sequence-based reference, submission/assignment timestamps, configured lines, customer notes, priority, company/customer snapshots and safe uploaded-document metadata. The raw file object is never written to mock storage. Customer submission creates the first workflow/audit entry; the immediate assignment creates one representative notification and places the RFQ in `listRepresentativeInbox()`.

Quotation confirmation follows the same boundary. The representative screen submits flat form values to `workflow.performAction`; the mock service validates and normalises those values into a nested quotation record before invoking the state machine. Internal and customer-facing notes remain separate. Any selected file is reduced to name, MIME type, size and upload-time metadata, while the raw file is discarded. Customer projection code removes the internal note and withholds the document/reference unless customer visibility was explicitly authorised.

The customer receipt action also travels through `workflow.performAction`. It is exposed only to an authorised company customer while the RFQ is `quoted`, and the state machine records `quotationAcknowledgedAt` and `quotationAcknowledgedBy`. No component mutates the status or storage directly, and the action does not create an order.

Order acceptance follows the same service boundary. Flat representative form values are validated and normalised into an internal acceptance record. The service requires a date, internal verification note and verification checkbox, plus a PO number or external transaction reference when its acceptance type requires one. It rejects pricing fields and card/banking/password data. Any supporting file is reduced to private metadata; raw bytes are discarded in mock mode.

`accept_order` is the only representative-facing command. The internal `convert_to_order` transition cannot be invoked by a React component or ordinary API caller. The mock service generates the order ID/reference and applies both state transitions plus order creation in one aggregate update. Replaying the command after conversion returns the same linked order, so rapid repeated clicks cannot create duplicates.

The new order stores an item snapshot with a generated order-line ID, source RFQ line ID and configuration snapshot. Later edits to catalogue metadata or RFQ display data therefore do not redefine what was converted. The RFQ remains in history and carries the linked order reference; the order appears immediately in the authorised customer's account. This is a browser-demo approximation of the transaction and immutable `order_items` rows required in PostgreSQL.

Planning uses the same boundary. `planning.getWorkspaceOptions()` returns only fabricated authorised Planning users, recognised branch/location records and approved priority values. `complete_planning` accepts flat screen values, runs shared validation, resolves the selected Planning user/location from service-owned reference data and normalises them into one `planning` object. It also retains top-level job/PO fields only as a temporary compatibility aid for older preview consumers.

The state machine independently revalidates the normalised Planning object. It requires an internal job number, assigned representative, authorised Planning user, Planning submission date and either a customer PO number or an explicit authorised exception with a reason. Dates, lengths, priorities and document-reference counts are constrained. The hand-off to Expediting revalidates the persisted record, records the actor and timestamp, appends audit/history events and creates distinct customer, representative and Expeditor messages.

Customer projections remove the entire Planning object, compatibility job/PO fields and internal Planning actor metadata. Customers receive only the customer-visible stage description after submission to Expediting.

Expediting follows the same boundary. `start_expediting`, `add_expediting_update`, Expediting-owned hold/resume and `complete_expediting` are normalised by `validateExpeditingAction()` before the central state machine runs. Each update stores a configured step, customer-facing message, optional internal note, estimate, delay reason and optional document/image reference metadata. Actor and timestamp come from the signed-in service session.

The state machine keeps ordinary progress updates inside `expediting_in_progress`, appends structured progress and audit history, and creates notifications for the customer and assigned representative. Dispatch hand-off additionally notifies Dispatch and requires all configured required steps, or a recorded authorised exception with a meaningful reason and authorisation reference. Customer projections remove internal notes, delay/supplier context, controlled document references, internal actor IDs and exception evidence while preserving the customer message, step, public updater name and time.

Legacy preview sessions are migrated only once and their old key is retired. Sign-out removes both the current and legacy session keys so an older browser profile cannot silently restore a staff session.

The mock is not production security. It does, however, model important rules:

- the password field is removed before an account enters React state;
- a customer receives only RFQs whose `companyId` matches the signed-in account;
- the separate order service applies the same company boundary and never returns another company's order;
- sales representatives receive only records assigned to their authoritative `representativeId`;
- the representative inbox contains assigned RFQs only and exposes `Start Review` only while the RFQ is `assigned_to_rep`;
- Planning receives only `awaiting_planning`, `planning_in_progress`, `planned` and Planning-owned holds;
- Expediting receives `submitted_to_expediting`, `expediting_in_progress`, Expediting-owned holds and read-only `awaiting_dispatch` awareness;
- Dispatch receives only its handover, delivery/collection and Dispatch-owned hold stages;
- Buyer has an authenticated but deliberately empty operational scope until its workflow is approved;
- Manager and Administrator receive wider operational reads; only Administrator receives user/retention administration permissions;
- status changes require an action allowed for the exact state, signed-in role and named action permission;
- representatives are checked against the RFQ assignment before representative-only actions;
- Planning, Expediting and Dispatch handoffs cannot be skipped;
- Expediting operational states cannot be selected through an ordinary progress update, and Dispatch hand-off cannot bypass the required-step or authorised-exception guard;
- Expediting internal notes and controlled document/image references are removed from every customer projection;
- every successful or denied workflow attempt creates a mock audit entry;
- notifiable actions queue mock notification records;
- notification inbox results are filtered by company, recipient role and representative assignment, with per-user read state;
- `accept_order` creates exactly one linked order, acceptance/conversion/order audit records and role-specific notifications; a repeated request returns the existing order;
- customer projections hide representative-only acceptance evidence and supporting-document metadata;
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
- JSON quotation confirmation requests, or multipart requests containing a JSON `payload` plus optional `quotationDocument`;
- JSON order-acceptance requests, or multipart requests containing a JSON `payload` plus optional private `acceptanceDocument`;
- JSON Planning action requests containing a validated nested `planning` object;
- request timeouts and friendly network errors.

Production access tokens must not be placed in Web Storage. The browser must never connect directly to PostgreSQL, SMTP or object storage with privileged credentials.

When the representative includes a quotation file, the API adapter sends multipart data so the future backend can scan and store it in protected object storage. Without a file, it sends the same normalised action as JSON. The backend must independently revalidate the assignment, quotation metadata, file type/size and customer-visibility authorisation. Pricing is intentionally absent from both request variants.

The acceptance adapter uses the same pattern. The backend must lock the RFQ, validate assignment/state/version and evidence, allocate the permanent order reference, insert the order and immutable items, update the RFQ, append audits/events and enqueue notifications in one database transaction. The unique `orders.enquiry_id` constraint and idempotency record provide duplicate protection even when different network retries carry different request IDs.

The Planning adapter loads `/planning/workspace-options` and posts controlled `complete_planning` or `submit_to_expediting` actions through the existing order workflow endpoint. The backend must derive actor identity, validate staff scope, reload users/locations, reject customer access, and commit the order update, workflow/audit records and notification outbox in one transaction.

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
