# Google Play release checklist

Status: planning only. Do not create a listing or upload a bundle yet. Recheck all official requirements at release time.

## Ownership and build

- [ ] Rhomberg-owned Play Console organisation and named Account Owner/Admins.
- [ ] Final application IDs approved separately for Connect and Operations.
- [ ] Capacitor Android project generated only after the production server/security design is approved.
- [ ] Release AAB built from the production-safe bundle; `versionCode` increments and `versionName` matches release notes.
- [ ] Play App Signing/upload-key custody, backup and recovery approved.
- [ ] Target SDK verified on release day. Google’s current schedule states new apps and updates must target Android 16/API 36 from 31 August 2026; this is time-sensitive and must be rechecked: [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-AU).

## Listing and policy

- [ ] App name, short/full descriptions, category, support contact and website.
- [ ] Final icon, phone/tablet screenshots and feature graphic generated from production-safe fabricated accounts.
- [ ] Public privacy policy accurately describing server, documents, analytics, notifications and deletion/contact process.
- [ ] Data Safety declaration reviewed against actual SDK/network behaviour. Google requires the form for closed/open/production tracks even when no data is collected; internal-only testing has limited exemptions: [Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
- [ ] Content/age rating, ads declaration, app-access review credentials, permissions declarations and account-deletion requirements reviewed.
- [ ] Camera/files/notifications/location permissions removed unless a tested feature needs them; provide purpose and in-app disclosure where required.

## Release sequence

- [ ] Internal testing first (up to 100 testers), then controlled closed testing, then production only after approval: [Google Play testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).
- [ ] Exercise sign-in, uploads, deep links, notifications, offline/session recovery and every customer-visible workflow on supported Android devices.
- [ ] Validate crash/ANR, accessibility, security scan, dependency inventory and rollback.
- [ ] Obtain business, Innovate IT, security/privacy and release-owner approval.

