# Mobile experience

Customer, Representative, Expeditor and other supported mobile profiles share the same codebase, authentication, API, notifications and user-settings service.

Mobile uses the compact logo, horizontally scrollable Settings categories, stacked cards and bottom-safe save controls. Optional haptics are capability checked and fail silently. The PWA manifest provides 192px and 512px Rhomberg Connect icons; Capacitor packaging can reuse these after production signing and native splash generation.

Offline mock data is same-device demonstration storage, not a production offline guarantee. Production push requires APNs/FCM credentials, device-token lifecycle, consent, quiet-hour policy and backend delivery receipts. Store submissions require Rhomberg/IT approval, privacy declarations, signed builds, certificates and platform screenshots.

