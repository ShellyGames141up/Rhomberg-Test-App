# Rhomberg Instruments App - Public Test Preview

This repository contains a phone-first test preview of a future Rhomberg Instruments catalogue, RFQ and order-tracking app. It is intentionally suitable for public source-code review while testing. No private price values, email API keys or real customer database records are committed.

## Preview login

- Customer email: `demo@client.co.za`
- Customer password: `Demo123!`
- Cape journey customer: `cape.demo@client.test` / `Demo123!`
- Sales email: `sales.workflow@example.invalid`
- Sales password: `Sales123!`
- Planning email: `planning.workflow@example.invalid`
- Planning password: `Planning123!`
- Expeditor email: `expeditor.test@rhom.co.za`
- Expeditor password: `Expedite123!`
- Dispatch email: `dispatch.workflow@example.invalid`
- Dispatch password: `Dispatch123!`

You can also create a test company account. Preview accounts, sessions, drafts, RFQs, orders, notifications and workflow updates are saved only in that browser on that device. Closing and reopening the site retains the data. This is not production authentication and it does not synchronise between devices.

## Included in version 2.6

- Separate RFQ and order service resources while preserving the existing customer tracking design
- Versioned aggregate mock storage with automatic migration of legacy combined records
- Atomic same-browser RFQ conversion that creates exactly one linked order and immutable order-line/configuration snapshots
- Service-generated order IDs/references and duplicate-conversion protection
- Dedicated Sales, Planning, Expediting and Dispatch test workspaces using role- and stage-allowed actions
- Role-, company- and representative-scoped notification inbox with per-user read state
- Complete tested mock path from quotation through acceptance, Planning, Expediting, Dispatch and completion
- Separate API adapter methods for `/enquiries` and `/orders`
- Updated API/OpenAPI/PostgreSQL proposals, including immutable `order_items`

## Included in version 2.5

- Central RFQ and order state machine with controlled action codes instead of arbitrary status selection
- Exact role, assignment, required-field, comment, fulfilment and sequence guards for every transition
- Planning and Dispatch roles added alongside the existing customer, sales, expeditor, buyer, manager and administrator roles
- Optimistic record-version checks to stop stale workflow updates
- Customer-visible timeline projection that omits internal-only events
- Mock audit history and notification queue for successful and denied workflow actions
- API adapter routes prepared for enquiry/order workflow actions, notifications and audit history
- Valid/invalid transition tests plus updated OpenAPI, database and security documentation

### Included in version 2.4

- Replaceable asynchronous service layer for authentication, accounts, products, RFQs and tracking
- GitHub Pages remains on a browser-only mock service with fabricated records
- Prepared private-cloud HTTP service using secure cookies, CSRF protection, request IDs and idempotency keys
- Customer-company scoping in the mock and an explicit server-side tenant-isolation contract
- Shared validation at both the screen and service boundaries with friendly errors
- Initial proposed production roles and permissions
- Proposed PostgreSQL schema with row-level-security policies
- API contract, OpenAPI definition, security model and IT deployment handover

### Architecture and IT handover

- [Service architecture](docs/SERVICE-ARCHITECTURE.md)
- [Workflow state machine and transition flow](docs/WORKFLOW_STATE_MACHINE.md)
- [Order workflow phased implementation plan](docs/ORDER_WORKFLOW_IMPLEMENTATION_PLAN.md)
- [API endpoints and payloads](docs/API-CONTRACT.md)
- [OpenAPI specification](docs/api/openapi.yaml)
- [Production roles and company isolation](docs/SECURITY-AND-ROLES.md)
- [Proposed PostgreSQL schema](docs/database/postgresql-schema.sql)
- [Private-cloud requirements and deployment checklist](docs/PRODUCTION-DEPLOYMENT.md)

The normal `build` command creates the mock-only GitHub Pages preview. `build:production` creates a separate API-only candidate in ignored `dist-production/`; esbuild removes the mock service, demo accounts and public email fallback from that bundle. `runtime-config.js` contains only the public API URL and timeout—not a security mode or secret.

## Existing version 2.3 functionality

- Persistent same-browser RFQ and order history for each customer account
- Customer order tracking with progress, requested instruments and a full update timeline
- Expeditor test login with an oldest-update-first daily work queue
- Expeditor search by customer, representative, RFQ reference or PO number
- Role- and stage-controlled workflow actions plus customer-facing update notes
- Representative selection filtered to the nearest Rhomberg branch
- Branch representative codes sourced from the supplied salesperson export
- Light and dark themes retained on the device
- Softer, larger typography and refreshed mobile layouts
- Three clearly labelled, fabricated demonstration orders for workflow testing

## Existing catalogue and RFQ functionality

- Animated opening sequence and mobile app-style sign-in
- Eight catalogue categories and 82 product families/models
- Product images, specifications, datasheets and product-specific configuration paths
- PBB internal contacts limited to 100 mm, with Single/Dual and cable-length selection
- Quantity stored separately for every configured product line
- SANAS only for pressure instruments and Traceability only for temperature units
- Chemical-seal consultation hand-off instead of customer seal configuration
- Emergency, delivery/collection, nearest branch, application and Purchase Order workflow
- Branded multi-page RFQ PDF with complete configuration details
- Protected rep-only pricing engine based on `Pricelist 1 MARCH 2026.xlsx`
- Emergency, delivery, chemical-seal and unpriced special requirements flagged for representative assessment
- Public FormSubmit fallback that sends an unpriced RFQ PDF when the protected service is not connected
- Installable web-app manifest and offline static-asset cache

## Customer-data protection

The supplied historical customer exports were used only for private structure analysis. No exported customer record, contact detail, address or account information is copied into this public repository or browser bundle. Only the requested branch representative names and codes are included for the test selector.

## Pricing and email security

The public browser bundle never contains the price list. The secure `/api/submit-rfq` function loads the compressed price book from private host environment variables, produces a rep-only priced PDF, emails it to the fixed Rhomberg test recipient and returns only a delivery confirmation. It never returns prices to the client.

The private local price-book exports live in `private/`, which is ignored by Git. Do not remove that ignore rule and do not paste price values into `src/`, `app.js`, a public issue or a commit.

If the app is hosted only on GitHub Pages, it remains a static site and uses the unpriced FormSubmit test fallback. The first FormSubmit test requires one-time activation from the recipient inbox. The protected priced-PDF path requires a server-capable deployment such as Netlify.

## Protected test deployment variables

Configure these values in the deployment host, never in this repository:

- `RESEND_API_KEY`
- `RFQ_FROM_EMAIL` - a sender on a verified email domain
- `RFQ_TO_EMAIL` - currently `Ericuv@Rhom.co.za`
- `RFQ_ALLOWED_ORIGINS` - the deployed app URL
- `RHOMBERG_PRICEBOOK_GZIP_BASE64_1`
- `RHOMBERG_PRICEBOOK_GZIP_BASE64_2`

The two local price-book parts are generated from the supplied March 2026 workbook and stored in the ignored `private/` folder. The function joins and decompresses them at runtime. Email submission is restricted to five requests per IP/domain per minute.

## Build commands

- `pnpm run check` - compile-check the React source
- `pnpm test` - run state-machine, service, validation, audit and company-isolation tests
- `pnpm run build` - regenerate the GitHub Pages `app.js`
- `pnpm run build:netlify` - build and stage only public static files in `dist/`
- `pnpm run build:production` - generate an API-only candidate in ignored `dist-production/`

## Important test limitations

- Use sample customer and PO data only while this repository is public.
- Mock accounts, passwords and tracked requests are local browser test records, not shared company accounts.
- An expeditor update is visible to a customer only when both roles are tested in the same browser profile.
- Price matching is an internal aid and always requires representative verification before a quotation.
- The production phase still needs domain authentication, a shared database, server-enforced workflow rules, encrypted file storage, durable audit/notification delivery, privacy terms and verified representative-to-client assignment.
