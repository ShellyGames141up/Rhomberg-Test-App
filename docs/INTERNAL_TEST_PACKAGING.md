# Rhomberg Connect 5.2.0 internal-test packaging

Status: package preparation only. Nothing here authorises deployment, store publication, real customer data, or production secrets.

## Approved architecture

### Windows

Use the production-safe progressive web application installed from the final HTTPS site in Microsoft Edge. It preserves the desktop workspace, uses the browser's maintained security engine, launches from Start/search, can be pinned, and updates with the controlled web release. Tauri and Electron add native supply-chain and update obligations without a current business requirement.

The authoritative Windows PWA origin is `https://connect.rhomberg.co.za:8443`. Installation cannot be fully exercised until DNS, TLS and external HTTPS routing exist.

After IT enables the endpoint:

1. Open the approved HTTPS address in current Microsoft Edge.
2. Confirm the certificate, Rhomberg Connect name and icon.
3. Use **Apps → Install Rhomberg Connect**.
4. Choose Start/taskbar/Desktop options allowed by company policy.
5. Launch, sign in with an authorised staging account, and complete the Windows checklist.
6. Uninstall through Windows **Settings → Apps → Installed apps** or Edge `edge://apps`.

`deployment/windows-client/windows-app.json` records the non-secret identity placeholders. A Microsoft Store submission is not part of this phase. Managed MSIX distribution would require official Partner Center identity, publisher approval, signing and certification.

### Android

The production-safe React bundle is packaged in the generated Capacitor 8 project. The application loads local UI assets from the controlled `https://connect.rhomberg.co.za` WebView origin when the service is unavailable and calls only the build-time-approved `https://connect.rhomberg.co.za:8443/api/v1` API. The two origins differ only by port, so they are cross-origin but remain same-site under HTTPS. Exact credentialed CORS is therefore required, while `Secure`, `HttpOnly`, `SameSite=Lax` host cookies and CSRF validation remain unchanged. The application never connects to PostgreSQL and has no mock fallback.

- Application ID: `za.co.rhomberg.connect`
- Display name: `Rhomberg Connect`
- Version name: `5.2.0-internal.1`
- Version code: `5020001`
- Minimum Android API: 24
- Compile/target API: 36
- Web asset directory: `dist-internal-staging`
- Requested permissions: Internet and vibration only (for the existing optional haptic setting)
- Cleartext traffic and Android backup: disabled

`versionCode` must increase for every Play upload. Keep `versionName` aligned with the approved release and internal iteration, for example `5.2.0-internal.2` / `5020002`.

## Endpoint configuration

One public build input controls native API access: `RHOMBERG_PUBLIC_API_URL`. The build accepts only:

- `https://connect.rhomberg.co.za:8443/api/v1`

It rejects HTTP, embedded credentials, other hosts, other ports and other paths. Windows can update `runtime-config.js` during a controlled server release without recompiling React. Android bundles that file, so changing the port requires rebuilding/syncing and incrementing `versionCode`.

The API allowlist must contain exactly `https://connect.rhomberg.co.za:8443` for Windows/PWA and `https://connect.rhomberg.co.za` for the bundled Android WebView. Credentialed CORS reflects only an allowlisted origin, preflight is handled before authentication, and mutations still require both an approved Origin and the per-session CSRF token. Session cookies remain `Secure`, `HttpOnly` and `SameSite=Lax`; credentials are never stored in browser storage. Until IT enables the endpoint, the app shows its safe service-unavailable/retry state and never loads fabricated operational records.

### Single-domain Android decision

The bundled standard-HTTPS origin is the smallest secure design under IT's one-domain constraint:

| Option | Result |
| --- | --- |
| Bundled assets at `https://connect.rhomberg.co.za` | Selected. Starts without the server, stays same-site with the `:8443` API, and requires only exact credentialed CORS because the port differs. |
| Put a port in `server.hostname` | Rejected. Capacitor defines this field as a hostname, and using it as an authority is not a supported production contract. |
| `server.url` remote loading from `:8443` | Rejected. It would be exact same-origin, but Capacitor documents remote URL loading as a live-reload facility not intended for production; startup and UI availability would depend entirely on the server. |
| Custom scheme | Rejected. It would not be HTTPS same-site, complicates cookies/routing, and offers no advantage over the supported HTTPS virtual host. |
| Native HTTP/cookie plugins | Rejected. Standards-based WebView fetch works; a native override would add a second cookie/transport security boundary unnecessarily. |

Automated API tests prove login, secure cookie issuance, repeated `/auth/me`, CSRF-protected mutation and logout from the Android origin. The standard WebView cookie store is expected to retain the session while the app is backgrounded; final persistence across background/resume and process recreation must still be verified on the physical test phone after Dylan enables routing and Ashmah binds the trusted certificate.

## Build commands

Use Node.js 22.23.2, pnpm 11.19.0 and JDK 21 LTS. The Android SDK requires API 36, Build Tools 36.0.0 and the project Gradle wrapper; JDK 17 is insufficient for Capacitor 8's Java 21 source level.

```powershell
pnpm install --frozen-lockfile
$env:RHOMBERG_PUBLIC_API_URL = 'https://connect.rhomberg.co.za:8443/api/v1'
pnpm run build:internal-staging
pnpm exec cap sync android
```

For an unsigned local verification build, use Android Studio or run `android\gradlew.bat assembleDebug`. For a signed internal-test AAB, authorised release staff configure signing outside the repository and run `pnpm run android:bundle`. Expected output: `android/app/build/outputs/bundle/release/app-release.aab`.

## Signing custody

Never commit an upload keystore, passwords, `keystore.properties`, private certificates, Google service credentials or Windows signing keys. Store the Android upload key and recovery material in an approved secrets vault with named custodians, MFA, access logging and a tested backup. Use Google Play App Signing; retain the upload key separately. Windows Store identity/signing remains a future Partner Center decision.

## Google Play Internal Testing

Human-owned prerequisites:

- Rhomberg-owned Play Console organisation and release owners.
- Play App Signing decision and protected upload key.
- Approved tester Google accounts or Google Group (currently up to 100 internal testers).
- Support contact, website and approved privacy-policy URL.
- Phone/tablet screenshots from fabricated records, icon and approved feature graphic.
- Truthful Data Safety, app access, content rating, ads, account deletion, permissions and privacy declarations based on final behaviour.

Procedure:

1. Create the app with ID `za.co.rhomberg.connect`; it cannot be changed after registration.
2. Complete only declarations approved by Rhomberg.
3. Enable Play App Signing and protect the upload key.
4. Create **Testing → Internal testing**, add approved testers, and upload the signed AAB.
5. Add factual internal release notes and roll out only to the internal track.
6. Share the opt-in link; first availability may take several hours.
7. Record device/OS, installation, login, workflow and defect evidence. Do not promote without approval.

Google requires new apps and updates to target API 36 from 31 August 2026. This project targets API 36; recheck at upload time. Official references: [target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB_ALL) and [testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

## Validation checklists

Windows: install/uninstall, icon/name, launch/splash, deep routes, login and lockout, catalogue/details/PDF downloads, resizing, light/dark/system, keyboard/Narrator/scaling, service unavailable, upgrade, no preview/demo data and no secret leakage.

Android physical-phone checklist:

1. Record phone model, Android version, WebView version and APK checksum; install the approved debug/internal build.
2. Confirm the official icon, launch screen and login screen; verify no preview, demonstration or fabricated account controls exist.
3. With staging unavailable, confirm the safe service-unavailable message and retry action without mock fallback.
4. After IT enables HTTPS, verify certificate trust and complete login, `/auth/me`, session persistence, application background/resume and explicit logout.
5. Verify catalogue browsing, product details and approved datasheet opening/download.
6. Exercise navigation, keyboard, validation and representative/customer forms in portrait and landscape.
7. Verify optional sounds/haptics, TalkBack, large text, reduced motion and light/dark/system themes.
8. Install the next higher `versionCode` over the existing build, verify data/session behaviour, then test uninstall/reinstall.
9. Record screenshots, failures and network conditions; do not enter real company/customer data during technical validation.

Physical-device checks remain mandatory; emulator success does not replace them.
