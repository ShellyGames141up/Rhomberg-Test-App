# Mobile packaging readiness

## Decision

Use the responsive production web build as the shared application and Capacitor 8.5.0 as the Android shell. The Android project is prepared for controlled internal testing; it does not imply store approval or production readiness.

Current evidence:

- `capacitor.config.json` points to the production-derived `dist-internal-staging` client artifact and fixes the bundled origin to `https://connect.rhom.co.za`;
- responsive Customer Mobile and authorised internal mobile profiles exist;
- manifest, service worker, safe-area styling, reduced motion, sounds/haptics settings and production/demo build separation exist;
- the generated `android/` project uses API 36, only Internet and vibration permissions, disabled cleartext traffic and disabled Android backup;
- `za.co.rhomberg.connect` and “Rhomberg Connect” are the proposed internal-test identity and require Rhomberg approval before Play registration;
- exact-origin credentialed CORS preserves Secure/HttpOnly/SameSite=Lax sessions and CSRF between the bundled standard-HTTPS origin and the `:8443` API on the same host, without a native HTTP override;
- no release signing identity, push project, iOS project or store listing exists.

Official reference: [Capacitor documentation](https://capacitorjs.com/docs).

## Recommended package separation

| Product | Display name | Package/bundle placeholder | Intended users |
| --- | --- | --- | --- |
| Shared internal test | Rhomberg Connect | `za.co.rhomberg.connect` | customers and already-supported internal mobile roles |

Rhomberg/Innovate IT must approve and register the final ID. A later review may still split customer and internal binaries; this phase does not fabricate missing mobile role interfaces. See [internal-test packaging](./INTERNAL_TEST_PACKAGING.md).

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
