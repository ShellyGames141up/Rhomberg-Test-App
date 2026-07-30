# Build and Deployment

## Development Servers

```text
npm run dev:customer-desktop
npm run dev:customer-mobile
npm run dev:internal-mobile
npm run dev:internal-desktop
npm run dev:executive-demo
```

The development script serves one controlled route on `127.0.0.1:4173` unless a different approved preview port is supplied.

## Checks and Tests

```text
npm run check
npm run check:css
npm test
```

See [Testing](TESTING.md) for the manual role and viewport matrix.

## Public Mock Builds

```text
npm run build
npm run build:customer-desktop
npm run build:customer-mobile
npm run build:internal-mobile
npm run build:internal-desktop
npm run build:executive-demo
npm run build:previews
```

Individual outputs are staged under ignored `dist-previews/`. The combined GitHub Pages build is staged under ignored `dist/` and includes `preview/` plus `demo/executive-workflow/`.

All entry pages load the same React bundle and mock services. Routes use repository-relative base paths and must survive direct refresh on GitHub Pages.

## API-Only Production Candidate

```text
npm run build:production
```

The production build:

- swaps the mock service entry for the HTTP API service;
- replaces the Preview Centre and Executive Demo modules with production-safe empty modules;
- uses the private-cloud platform context;
- omits preview and demo route pages;
- omits source maps;
- scans for mock passwords/accounts, public-preview markers, private pricing code and executive-demo markers.

Passing this build is a packaging safety check, not production approval.

## GitHub Pages

GitHub Pages hosts fabricated demonstrations only. It cannot provide private access, production identity, trusted company isolation, protected document storage or a permanent audit record.

## Production Deployment

Do not deploy the static mock bundle. Production requires a reviewed backend, PostgreSQL, private storage, identity integration, secrets, email/push workers, monitoring, backups, recovery and staged release controls. See [Deployment Handover](DEPLOYMENT_HANDOVER.md).

## Future Packaging

| Product | Platform | Proposed approach |
| --- | --- | --- |
| Rhomberg Connect | Desktop | Secure browser/PWA |
| Rhomberg Connect | Android/iOS | Capacitor after approved browser and API validation |
| Rhomberg Operations | Mobile | Managed Capacitor application if required |
| Rhomberg Operations | Windows | Managed PWA first; packaged shell only for justified integrations |

IT must own signing, organisation store accounts, privacy declarations, release approvals, update channels and emergency rollback.
