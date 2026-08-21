# Windows application release readiness

## Recommendation

Use the installed PWA first. It is the lowest-complexity fit for this React application: one HTTPS deployment, no duplicated runtime, fast security updates and the existing responsive desktop interface. For Microsoft Store discovery, Microsoft identifies PWA as the fastest route for web applications; MSIX is the next option when managed packaging or deeper Windows integration is required: [Choose a Windows distribution path](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path) and [Microsoft Store submission](https://learn.microsoft.com/en-us/windows/apps/publish/get-started).

## Options

| Option | Security/maintenance | Size/performance | Updates | Recommendation |
| --- | --- | --- | --- | --- |
| Installed PWA | smallest native attack surface; server security still mandatory | smallest; browser engine already managed | web release/service worker | first staging and enterprise pilot |
| Store-hosted PWA | same web model plus Store discovery | small | web content plus listing lifecycle | consider after stable production URL |
| MSIX wrapper | signed package and enterprise management; added packaging work | moderate | Store/enterprise package updates | use if IT requires managed installer/capabilities |
| Tauri | smaller than Electron but adds Rust/native supply chain | relatively small | custom updater/Store package | evaluate only for approved native needs |
| Electron | mature but large runtime and patch surface | largest | separate runtime update channel | not justified currently |

## Readiness gates

- Production HTTPS URL, authentication, private documents, server-side authorisation and monitoring complete.
- Final separation and names: Rhomberg Connect customer PWA and Rhomberg Operations internal desktop profile.
- Manifest IDs/start URLs/icons verified per product; demo shortcuts excluded from production.
- Offline shell never presents stale protected data as authoritative and never caches `/api/` responses.
- Install/update/rollback, minimum supported version, forced security update and service-worker recovery tested.
- Windows keyboard, Narrator, 125–200% text/display scaling, high contrast, 1366/1920/2560/ultrawide and managed browser policy tested.
- If MSIX/native is chosen: package identity, publisher, code signing, capabilities, privacy, installer coexistence and auto-update ownership approved.

For controlled internal staging, install the PWA from the approved HTTPS endpoint once DNS/TLS are available. See [internal-test packaging](./INTERNAL_TEST_PACKAGING.md). No Windows binary or Store listing has been created.
