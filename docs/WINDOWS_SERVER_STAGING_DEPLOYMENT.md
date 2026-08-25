# Windows Server Staging Deployment

## Scope and current limitation

This guide covers a later manual transfer of the Rhomberg Connect frontend and the Node.js `/api/v1` service to Windows Server 2025. IIS serves the static site and reverse-proxies `/api/v1` to the loopback-only API at `127.0.0.1:3000`. The package is for fabricated-data internal staging only; production identity, managed document storage, malware scanning and delivery integrations still require Innovate IT approval.

Do not use real Rhomberg, customer, employee, pricing or document data during this packaging stage.

## Supported build workstation

- Node.js 22 LTS (`.nvmrc` and `.node-version` both select major version 22)
- pnpm 11.19.0, declared by `packageManager` in `package.json`
- Git, for the source commit recorded in the release manifest
- A clean dependency install from the committed `pnpm-lock.yaml`

From a clean checkout, the authorised release operator will later run:

```text
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm run check
pnpm run check:css
pnpm test
pnpm run build:production
pnpm run check:production-artifact
pnpm run release:metadata
```

The static output is `dist-production/`. The metadata command creates frontend checksums and validation records, but does not create a ZIP. An approved combined release package adds the reviewed `apps/api` runtime and deployment documentation as separate `api/` and `deployment/` folders.

## Intended server structure

```text
C:\RhombergConnect\
  releases\
  backups\
  logs\
  config\
```

Each approved release must be extracted into a new immutable folder beneath `releases`, for example `C:\RhombergConnect\releases\5.2.0-<commit>`. Never overwrite the active release in place. `config` is reserved for IT-managed public runtime configuration and future protected server configuration; secrets must not be placed in the static website root.

## IIS prerequisites for Innovate IT

Innovate IT must approve and install IIS with Static Content, Default Document, HTTP Errors and URL Rewrite support. The generated `web.config` provides:

- `index.html` as the default document;
- React single-page application fallback routing;
- an ARR reverse-proxy rule from `/api/v1/...` to `http://127.0.0.1:3000/api/v1/...` before the SPA fallback;
- disabled directory browsing and hidden configuration paths;
- MIME types for the web manifest and WebP images;
- CSP, clickjacking, MIME-sniffing, referrer and permissions headers;
- no-cache rules for `index.html` and `runtime-config.js`;
- bounded caching for other static content.

HSTS is deliberately absent until Innovate IT confirms the final HTTPS and redirect policy. The site `web.config` contains the approved ARR rewrite from `/api/v1/...` to the loopback-only Node service at `http://127.0.0.1:3000/api/v1/...`; ARR proxying must be enabled at server level, and Node must not be exposed directly to the network.

## Later manual release procedure

1. Build and validate on the approved Node 22 workstation.
2. Review `VALIDATION.txt`, `release-manifest.json`, `CHECKSUMS.sha256` and the asset allowlist.
3. Create an approved transfer package outside this phase.
4. Transfer it through the IT-approved channel.
5. Verify every SHA-256 checksum before extraction.
6. Extract into a new immutable release folder.
7. Set the IIS site root to that release folder and apply least-privilege read permissions to the application-pool identity.
8. Confirm the public `runtime-config.js` values. Do not put secrets in this file.
9. Install production API dependencies from the package using the pinned lockfile, supply protected environment values outside the site root, apply migrations with the migration identity and apply runtime grants.
10. Bootstrap the first Administrator once through the server-side command, then remove the bootstrap secret from the process environment and protected deployment mechanism.
11. Run the API as a controlled Windows service bound only to `127.0.0.1:3000`; do not expose Node directly.
12. Smoke-test the root route, a direct client-side route, static assets, manifest, service worker, security headers, API health/readiness and the signed-out startup sequence through IIS.

## Rollback

1. Stop accepting the failed release as current.
2. Point the IIS site back to the last checksum-verified immutable release folder.
3. Recycle the application pool and clear only the affected service-worker/site cache during controlled testing.
4. Verify the prior release checksum and smoke tests.
5. Record the rollback, reason, operator, times and affected release identifiers in the IT change record.

Do not delete failed or prior releases until the approved retention and incident-review period has passed.

## Approval gates

Before server-backed staging, Innovate IT must approve the hostname/TLS certificate, identity architecture, API hosting, PostgreSQL, private document storage, secrets management, logging/privacy controls, backups, monitoring, malware scanning, network restrictions, database migrations, RLS enforcement, recovery and release/rollback ownership.
