# Desktop and mobile delivery strategy

## One shared product

Rhomberg Connect and Rhomberg Operations remain one React codebase with one domain model, workflow service, authentication boundary, notification service, API contract and design system. The four product preview routes plus the Executive Workflow Demo are delivery profiles, not unrelated applications.

Shared components include authentication, catalogue/configuration, RFQ/order records, workflow panels, notifications, audit models, order-summary PDFs, personalisation, archive/retention services, layouts and validation. Role profiles and permissions decide which navigation and workspace components are available.

## Role-specific surfaces

| Surface | Supported roles and screens |
| --- | --- |
| Customer mobile/desktop | Catalogue, RFQ creation, customer-safe quotation/tracking, notifications, account/settings |
| Operations mobile | Assigned representative RFQs, Expeditor queues/updates, Manager read/oversight where authorised |
| Operations desktop | Representative, Sales Manager, Company Owner, Planning, Laboratory, Expeditor, QA, Dispatch, Manager, Administrator, Audit and Archive workspaces |
| Manager desktop | Cross-record oversight, audit, archive/restore/export and legal hold |
| Administrator desktop | Permission-controlled account/company overview, representative assignments, roles, configuration, retention, management and audit access |

Planning and Dispatch stay desktop-only until physical-device workflow testing and business approval show a supported mobile use case.

## Responsive PWA first

The current manifest, service worker, safe-area CSS and responsive layouts support installable PWA delivery. Mobile uses a bottom navigation with role-specific destinations and touch targets. Desktop uses the same navigation model inside a wider operational shell with search, filters, multi-column summaries and responsive card fallbacks.

The service worker caches public application shell assets only. It bypasses `/api/` and fetches runtime configuration network-first. Offline mode can reopen cached screens and static catalogue assets, but it cannot authenticate a new session, synchronise records, submit workflow commands, send notifications, generate authoritative audit events or safely access private documents. Do not represent cached mock data as authoritative offline production data.

## Native mobile preparation

Capacitor is the Android wrapper because it packages the production-derived internal-staging web artifact without duplicating application workflows. `capacitor.config.json` identifies `dist-internal-staging` and the controlled single-domain `https://connect.rhomberg.co.za` WebView origin; the build validates the `https://connect.rhomberg.co.za:8443/api/v1` endpoint and never enables mock fallback, remote web loading or native HTTP transport. The differing ports require exact-origin credentialed CORS, while the common HTTPS host keeps the session same-site and preserves the existing cookie/CSRF protections. See [INTERNAL_TEST_PACKAGING.md](INTERNAL_TEST_PACKAGING.md).

Production mobile delivery requires:

- Rhomberg-owned Apple Developer and Google Play Console organisations;
- approved bundle/application identifiers and app display names;
- Apple distribution certificates/profiles and protected Android upload/app-signing keys;
- privacy policy, data-safety/privacy declarations, screenshots, icons, support contact and review credentials;
- APNs/FCM registration, token rotation, user consent and a secure backend delivery worker;
- universal/app links, secure session handoff, device revocation and managed secrets;
- physical iOS/Android accessibility, background/resume, camera/file-picker and poor-network testing.

No store submission is included in this phase.

## Windows options

Use an Edge/Chrome installed PWA first: it has the smallest operational footprint and uses the same HTTPS deployment/update channel. For managed enterprise distribution, IT may package the PWA policy or publish an MSIX shortcut/install profile.

Evaluate Tauri only if signed native packaging, device integration or managed local capabilities justify it. Electron has a larger runtime and patching surface and should be selected only when its ecosystem is specifically required. Any packaged Windows binary needs Rhomberg-controlled code-signing, installer signing, vulnerability patching and an enterprise update/rollback channel.

## Environments and updates

`runtime-config.js` contains public environment settings such as API base URL, environment name and notification transport. Credentials, SMTP/Microsoft 365 secrets, signing keys and push-provider credentials must remain in managed server/build secrets.

Web/PWA releases use versioned static assets and service-worker cache revisions. Native shells use semantic native versions while loading the bundled, tested web artifact; app-store changes follow staged TestFlight/internal-track releases. API changes must remain backward compatible across supported client versions. Every channel needs staged environments, rollback artifacts, database migration/backup checks, monitoring and a minimum-supported-client policy.

GitHub Pages remains a browser-local mock demonstration. It does not contain production credentials, private documents, push tokens or a production API.
