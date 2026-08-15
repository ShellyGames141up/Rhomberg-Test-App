# Apple App Store release checklist

Status: planning only. A Mac with the current supported Xcode and a Rhomberg-owned Apple Developer organisation will be required. Recheck official rules at release time.

## Identity and signing

- [ ] Approve explicit Connect and Operations bundle IDs and register them with the required capabilities. Apple requires the explicit ID to match the Xcode target: [Register an App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id).
- [ ] Name Account Holder/Admin/App Manager/Developer roles and document certificate/profile recovery.
- [ ] Generate the Capacitor iOS project only after server/authentication decisions are approved.
- [ ] Configure version/build numbers, distribution certificate, provisioning, Associated Domains and push entitlement only where approved.
- [ ] Verify the current submission SDK/Xcode requirement. Apple states uploads from 28 April 2026 require the iOS/iPadOS 26 SDK or later: [Submitting to the App Store](https://developer.apple.com/app-store/submitting/).

## Privacy and product page

- [ ] Provide the privacy policy and accurate App Privacy disclosures for every collected/linked/shared data type: [User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/).
- [ ] Add and validate `PrivacyInfo.xcprivacy`, including required-reason APIs and covered third-party SDK manifests: [Privacy manifests](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk).
- [ ] Add only necessary usage descriptions for camera, photo/files, notifications or other protected resources.
- [ ] Prepare app name, subtitle, description, keywords, category, support/marketing URLs, review notes and fabricated review account.
- [ ] Supply one to ten accepted screenshots without transparency per required device class and recheck dimensions: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Test and release

- [ ] Build/archive/validate with supported Xcode and upload through an approved method; bundle ID, version and build associate the upload: [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).
- [ ] Use TestFlight internal testing before external testing; builds are testable for up to 90 days: [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).
- [ ] Test VoiceOver, Dynamic Type, rotation, keyboard, file picker/camera, background/resume, deep links, push, session expiry and poor connectivity on physical supported devices.
- [ ] Review encryption/export compliance, App Review Guidelines, account deletion, support and incident response.
- [ ] Obtain business, Innovate IT, security/privacy and release-owner approval before review submission.

