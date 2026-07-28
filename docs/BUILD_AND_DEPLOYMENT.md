# Build, preview and future packaging

## Commands

```text
npm run dev:customer-desktop
npm run dev:customer-mobile
npm run dev:internal-mobile
npm run dev:internal-desktop

npm run build:customer-desktop
npm run build:customer-mobile
npm run build:internal-mobile
npm run build:internal-desktop
npm run build:previews

npm run check
npm test
npm run build:production
```

Development commands serve the selected stable route on `127.0.0.1:4173` by default. `RHOMBERG_PREVIEW_PORT` may set another local port. Individual builds stage self-contained artifacts under ignored `dist-previews/`; their service-worker lists omit unavailable sibling routes so offline installation remains valid. The combined build also stages the GitHub Pages artifact under ignored `dist/`.

## GitHub Pages

Deploy the repository root or the combined staged artifact. The four route folders each contain an `index.html` with a repository-root base path. All routes load the same bundle and mock services. Cache versions must be increased whenever entry files change.

## Production-candidate safety

`build:production` swaps in the HTTP API service, disables public-preview branches, omits route pages and scans the minified bundle for demonstration passwords/accounts, FormSubmit, sample RFQ markers and preview-only features. It is a packaging check, not production approval.

## Future packaging strategy

| Product | Platform | Proposed first choice |
| --- | --- | --- |
| Rhomberg Connect | Customer desktop | Secure PWA/browser application |
| Rhomberg Connect | Android/iOS | Capacitor wrapper after mobile browser validation |
| Rhomberg Operations | Internal mobile | Managed Capacitor app if device/push integration is required |
| Rhomberg Operations | Windows desktop | Managed PWA first; evaluate Tauri/Electron only for justified offline/device integrations |

Production mobile builds require Apple/Google organisation accounts, signing certificates/keys, bundle identifiers, privacy disclosures, review assets and managed release ownership. Windows distribution requires a trusted HTTPS origin, manifest/icons, signing where packaged and an enterprise update path.

`capacitor.config.json` prepares the shared `dist-production` artifact for a future approved Capacitor phase; it does not add native projects or submit a store build. The installed PWA remains the first Windows option. See `DELIVERY_STRATEGY.md` for role-specific navigation, offline limits, push requirements, signing, store submission and updates.

The private-cloud API URL is public configuration, not a secret. Credentials, signing keys, SMTP/Microsoft 365 secrets and push-service keys must live in managed secrets. Production updates require versioned API compatibility, staged environments, database migrations, backup verification, rollback artifacts and monitoring.

Mobile push requires APNs/FCM registration tokens and a secure delivery worker. Desktop notification permission must be requested contextually and must not replace in-app notifications. See `PRODUCTION-DEPLOYMENT.md`.
