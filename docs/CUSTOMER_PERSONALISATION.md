# Rhomberg Connect customer profile preferences

Rhomberg Connect now uses one protected company identity. Customers cannot replace the application logo, colours or typography with company-specific themes. Light, Dark and System modes remain available through the shared Settings service and always use the approved Rhomberg Connect design tokens.

Customer-specific personalisation is intentionally limited to an optional profile photograph. The application shell, splash screen, PWA icons, PDFs and email branding remain official Rhomberg Connect assets.

## Profile image service

```text
personalisation.get()
personalisation.save(profilePreference)
personalisation.uploadImage(file, "profileImage", position)
personalisation.removeImage(imageId)
```

Mock mode accepts JPG, PNG or WebP files up to 1 MB and stores them behind the mock image service. Components never access browser storage directly. Production must use private object storage, malware scanning, re-encoding, authorised short-lived download URLs, retention controls and company/user ownership checks.

Legacy `companyLogo`, custom-colour and theme-preset values are ignored during normalisation and must be rejected by the production API. Existing customer records should be migrated to the official `rhomberg-default` theme before release.

All profile image mutations create an immutable account-scoped audit event.
