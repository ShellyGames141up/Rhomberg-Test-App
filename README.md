# Rhomberg Client Portal — Mobile Preview

This is an interactive internal preview of a future Rhomberg Instruments client app. It is designed for phone screens and can also be installed from a supported browser after it is hosted online.

## Preview login

- Email: `demo@client.co.za`
- Password: `Demo123!`

You can also create a test company account. Preview accounts, sessions and enquiries are saved only in that browser on that device.

## Included in this preview

- Animated Rhomberg opening sequence
- Company sign-in and account creation
- Personalised category suggestions based on the client's industry
- Eight catalogue categories and 83 product families/models
- Category overview, blue unit cards and dedicated product-detail pages
- Product images, descriptions, grouped technical specifications, configuration information and available PDF sheets
- Guided, product-specific enquiry configuration with a separate quantity for every line item
- SANAS shown only for pressure instruments and Traceability shown only for temperature units
- Chemical-seal request hand-off for pressure gauges without exposing seal-model configuration
- Lead-time guidance throughout the quote flow
- Application, area, process-medium, required-date and notes fields
- Purchase-order number or PDF, DOCX and image attachment selector
- Locally saved enquiry reference and account history
- Direct phone, email and website contact options
- Installable mobile web-app setup and offline asset cache

## Important preview limitation

This version does not yet use a secure server. It does not send email, upload purchase orders or create real online accounts. Those actions are deliberately simulated with local browser storage for internal testing. The selected PO filename is recorded, but the file itself remains on the device. The production phase will need secure authentication, a hosted database, encrypted file storage, email delivery and representative/client assignment rules.

## Viewing it

Open `index.html` for a quick desktop preview. For installation and offline behaviour, host the complete folder on a secure web address such as GitHub Pages or the future Rhomberg domain.

## Rebuilding after source changes

The interface is built from reusable React components in `src/`. Install the listed packages and run `pnpm run build` to regenerate the browser-ready `app.js` file.
