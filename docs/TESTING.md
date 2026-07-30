# Build and Test Record

## Automated Checks

Run from the repository root:

```text
npm run check
npm run check:css
npm test
```

The test runner covers catalogue rules, permissions, company/representative isolation, RFQ and order transitions, notifications, documents, retention, management, validation, the complete fabricated workflow, production specifications, security boundaries and platform previews.

## Build Verification

```text
npm run build
npm run build:customer-desktop
npm run build:customer-mobile
npm run build:internal-mobile
npm run build:internal-desktop
npm run build:executive-demo
npm run build:previews
npm run build:production
```

The production candidate must pass its forbidden-marker scan and contain no source maps.

## Required Manual Viewports

- 1366 x 768
- 1920 x 1080
- 2560 x 1440
- Mobile 390 x 844
- Mobile 412 x 915

Review page width, desktop orientation, typography, navigation rail, tables, filters, dialogs, buttons, Laboratory queue, Administrator dashboard, QA, Dispatch and management charts. Confirm no clipping, overlap, horizontal page overflow or enlarged-phone appearance.

## Required Manual Roles

Customer, Sales Representative, Sales Manager, Company Owner, Planning, Laboratory User, Laboratory Manager, Expeditor, Quality Assurance, Dispatch and Administrator.

For each role confirm login, correct product, navigation, dashboard, refresh, permissions, record scope, notifications, documents and sign-out.

## Release Evidence

The release report must list every command actually run, its outcome, warnings, corrections and any unresolved issue. A failed critical check blocks the handover release.
