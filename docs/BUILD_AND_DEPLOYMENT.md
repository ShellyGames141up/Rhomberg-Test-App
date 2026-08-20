# Build and Deployment

## Entry points and private exclusions

The GitHub Pages build stages `/desktop/`, `/mobile/`, legacy `/app/`, dedicated `/preview/` routes and the executive demo. Desktop and Mobile are normal splash-to-sign-in entry points; only the repository root opens the Preview Centre. `build:production` uses the normal Desktop document and the API adapter, excludes mock services and demo modules, and scans generated artifacts.

Ignored `private/`, the encrypted credential PDF and `private/internal-staff.local.json` are never deployment inputs. Public and production artifact scanners fail if a protected filename, approved private identity marker, owner-supplied placeholder or prohibited demo credential appears. Source maps are not produced by the production build.

## Supported tooling

The authoritative release environment is Node.js 22 LTS with pnpm 11.19.0. Use Corepack and the committed lockfile; do not regenerate or replace the lockfile during release preparation.

## Development Servers

```text
pnpm run dev:customer-desktop
pnpm run dev:customer-mobile
pnpm run dev:internal-mobile
pnpm run dev:internal-desktop
pnpm run dev:executive-demo
```

The development script serves one controlled route on `127.0.0.1:4173` unless a different approved preview port is supplied.

## Checks and Tests

```text
pnpm run check
pnpm run check:css
pnpm test
```

See [Testing](TESTING.md) for the manual role and viewport matrix.

## Public Mock Builds

```text
pnpm run build
pnpm run build:customer-desktop
pnpm run build:customer-mobile
pnpm run build:internal-mobile
pnpm run build:internal-desktop
pnpm run build:executive-demo
pnpm run build:previews
```

Individual outputs are staged under ignored `dist-previews/`. The combined GitHub Pages build is staged under ignored `dist/` and includes `preview/` plus `demo/executive-workflow/`.

All entry pages load the same React bundle and mock services. Routes use repository-relative base paths and must survive direct refresh on GitHub Pages.

## API-Only Production Candidate

```text
pnpm run build:production
pnpm run check:production-artifact
pnpm run release:metadata
```

The production build:

- swaps the mock service entry for the HTTP API service;
- replaces the Preview Centre and Executive Demo modules with production-safe empty modules;
- uses the private-cloud platform context;
- omits preview and demo route pages;
- omits source maps;
- copies only explicitly approved production assets;
- generates a root-scoped production manifest and safe versioned service worker;
- includes a static IIS `web.config` without a pretend API proxy;
- scans for mock passwords/accounts, public-preview controls, private data, local paths, unsafe runtime endpoints and unapproved files;
- can generate `release-manifest.json`, `CHECKSUMS.sha256` and `VALIDATION.txt` without creating a deployment ZIP.

Passing this build is a packaging safety check, not production approval.

## GitHub Pages

GitHub Pages hosts fabricated demonstrations only. It cannot provide private access, production identity, trusted company isolation, protected document storage or a permanent audit record.

## Windows staging deployment

See [Windows Server staging deployment](WINDOWS_SERVER_STAGING_DEPLOYMENT.md) and the [production asset allowlist](PRODUCTION_ASSET_ALLOWLIST.md). The generated `dist-production/` is a static frontend candidate only. Its same-origin `/api/v1` dependency is intentionally not redirected or simulated by IIS.

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
