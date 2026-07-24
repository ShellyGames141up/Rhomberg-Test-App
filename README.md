# Rhomberg Instruments App - Public Test Preview

This repository contains a phone-first test preview of a future Rhomberg Instruments catalogue, RFQ and order-tracking app. It is intentionally suitable for public source-code review while testing. No private price values, email API keys or real customer database records are committed.

## Launch the Test App

### [🚀 Open Rhomberg Test App](https://shellygames141up.github.io/Rhomberg-Test-App/)

Opens the latest live demo in your browser.

## Preview login

- Customer email: `demo@client.co.za`
- Customer password: `Demo123!`
- Expeditor email: `expeditor.test@rhom.co.za`
- Expeditor password: `Expedite123!`

You can also create a test company account. Preview accounts, sessions, drafts, RFQs and expeditor updates are saved only in that browser on that device. Closing and reopening the site retains the data. This is not production authentication and it does not synchronise between devices.

## Included in version 2.4

- Replaceable asynchronous service layer for authentication, accounts, products, RFQs and tracking
- GitHub Pages remains on a browser-only mock service with fabricated records
- Prepared private-cloud HTTP service using secure cookies, CSRF protection, request IDs and idempotency keys
- Customer-company scoping in the mock and an explicit server-side tenant-isolation contract
- Shared validation at both the screen and service boundaries with friendly errors
- Six proposed production roles and permissions
- Proposed PostgreSQL schema with row-level-security policies
- API contract, OpenAPI definition, security model and IT deployment handover

### Architecture and IT handover

- [Service architecture](docs/SERVICE-ARCHITECTURE.md)
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
- Quick status progression plus customer-facing update notes
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
- `pnpm test` - run service, validation and company-isolation tests
- `pnpm run build` - regenerate the GitHub Pages `app.js`
- `pnpm run build:netlify` - build and stage only public static files in `dist/`
- `pnpm run build:production` - generate an API-only candidate in ignored `dist-production/`

## Important test limitations

- Use sample customer and PO data only while this repository is public.
- Mock accounts, passwords and tracked requests are local browser test records, not shared company accounts.
- An expeditor update is visible to a customer only when both roles are tested in the same browser profile.
- Price matching is an internal aid and always requires representative verification before a quotation.
- The production phase still needs domain authentication, a shared database, role-based permissions, encrypted file storage, audit logging, privacy terms and verified representative-to-client assignment.
