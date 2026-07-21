# Rhomberg Client Portal - Public Test Preview

This repository contains a phone-first test preview of a future Rhomberg Instruments catalogue and RFQ app. It is intentionally suitable for public source-code review while testing. No private price values, passwords, email API keys or customer database records are committed.

## Preview login

- Email: `demo@client.co.za`
- Password: `Demo123!`

You can also create a test company account. Preview accounts, sessions, drafts and enquiry history are saved only in that browser on that device. This is not production authentication.

## Included in version 2.2

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
- `pnpm run build` - regenerate the GitHub Pages `app.js`
- `pnpm run build:netlify` - build and stage only public static files in `dist/`

## Important test limitations

- Use sample customer and PO data only while this repository is public.
- Accounts are local browser records, not shared company accounts.
- Price matching is an internal aid and always requires representative verification before a quotation.
- The production phase still needs domain authentication, a database, encrypted file storage, audit logging, privacy terms and representative-to-client assignment.
