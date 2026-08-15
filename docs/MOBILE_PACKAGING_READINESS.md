# Mobile packaging readiness

## Decision

Use the responsive production web build as the shared application and evaluate Capacitor as the Android/iOS shell. Capacitor is appropriate for a web-first React application and can add approved native file, camera, haptic, deep-link and push capabilities without duplicating workflows. Native packages and platform projects are intentionally not installed yet.

Current evidence:

- `capacitor.config.json` exists and points to `dist-production`;
- responsive Customer Mobile and authorised internal mobile profiles exist;
- manifest, service worker, safe-area styling, reduced motion, sounds/haptics settings and production/demo build separation exist;
- no `android/` or `ios/` native project, native dependency, signing identity, push project or registered package ID exists;
- the current single `za.co.rhomberg.platform` ID and “Rhomberg Platform” name are placeholders and must not be registered as final.

Official reference: [Capacitor documentation](https://capacitorjs.com/docs).

## Recommended package separation

| Product | Display name | Package/bundle placeholder | Intended users |
| --- | --- | --- | --- |
| Customer | Rhomberg Connect | `za.co.rhomberg.connect` | authorised customer-company contacts |
| Internal | Rhomberg Operations | `za.co.rhomberg.operations` | Sales, Expediting and other approved internal mobile roles |

Rhomberg/Innovate IT must approve and register final IDs. Customer and internal binaries should be separate even though they share source, because identity, store audience, permissions, support and release cadence differ.

## Packaging gates

- Approved HTTPS API URL and native-compatible secure-cookie/OIDC flow.
- No demo accounts, role switching, snapshots, protected prices, secrets or real fixtures in the production bundle.
- Environment-specific public configuration only; no private API or signing keys in JavaScript/native resources.
- Rhomberg-owned Apple Developer and Google Play organisations, signing custody, release owners and recovery procedure.
- Final 1024/512/192 icons, adaptive/maskable Android artwork, iOS icon set, splash assets and light/dark launch treatment.
- Deliberate permissions for camera/document picker, notifications and biometrics only if actually used; clear denial/recovery UX.
- Private file uploads streamed to the API, with retry/idempotency and no unrestricted device-path persistence.
- APNs/FCM token registration, consent, revocation, logout/device removal and customer-safe push payloads.
- Universal Links/App Links domains, association files and safe deep-link routing after authentication.
- Physical-device tests for keyboard, picker/camera, rotation, safe areas, resume/background, session expiry, slow/offline networks, screen readers, large text, reduced motion and low-memory behaviour.

## Current blockers

The server, production authentication, private storage, push services, registered IDs, signing ownership, privacy policy/disclosures and physical-device UAT do not exist. Therefore the repository is ready for packaging design, not for a native release.

