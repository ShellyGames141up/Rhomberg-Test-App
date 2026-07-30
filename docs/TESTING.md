# Build and Test Record

## Automated Checks

Run from the repository root:

```text
npm run check
npm run check:css
npm test
```

The test runner covers catalogue rules, permissions, company/representative isolation, RFQ and order transitions, notifications, documents, retention, management, validation, the complete fabricated workflow, production specifications, security boundaries, platform previews, colour contrast, customer-theme safety, typography tokens, status-badge contracts and responsive-layout contracts.

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

The complete matrix is maintained in `docs/VISUAL_TEST_CHECKLIST.md`:

- 360 x 800
- 390 x 844
- 412 x 915
- 600 x 960
- 768 x 1024
- 1024 x 768
- 1280 x 800
- 1366 x 768
- 1440 x 900
- 1920 x 1080
- 2560 x 1440

Also check browser zoom at 80%, 100%, 125% and 150%; all four customer text sizes; light, dark, High Contrast and valid/invalid Custom themes. Confirm no clipping, overlap, horizontal page overflow, hidden final content or enlarged-phone desktop appearance.

## Required Manual Roles

Customer, Sales Representative, Sales Manager, Company Owner, Planning, Laboratory User, Laboratory Manager, Expeditor, Quality Assurance, Dispatch and Administrator.

For each role confirm login, correct product, navigation, dashboard, refresh, permissions, record scope, notifications, documents and sign-out.

## Release Evidence

The release report must list every command actually run, its outcome, warnings, corrections and any unresolved issue. A failed critical check blocks the handover release.
