# Rhomberg Connect customer personalisation

## Experience

Customers with incomplete setup see a ten-step wizard after sign-in. It covers welcome, theme, protected custom colours, profile/company images, font size, density, appearance, in-app notification preferences, live review and completion. Internal roles never receive this wizard.

Settings are available later from the customer Account screen. Changes remain local until one complete valid preference object is saved. Customers can preview, cancel, reset one section or restore all Rhomberg defaults.

## Shared preference model

```json
{
  "schemaVersion": 1,
  "setupCompleted": true,
  "themePreset": "rhomberg-default",
  "customColours": {
    "primary": "#073b53",
    "secondary": "#075e7b",
    "accent": "#08788d",
    "success": "#217a55",
    "warning": "#b77812"
  },
  "fontSize": "medium",
  "density": "standard",
  "appearanceMode": "system",
  "notificationPreferences": {
    "rfqUpdates": true,
    "accountSecurity": true
  },
  "profileImage": null,
  "companyLogo": null
}
```

Critical account/security and maintenance categories remain enabled. Error styling is protected and not replaced by customer colours. Foreground text is calculated from contrast; invalid custom values are rejected at the shared validation and service boundaries.

## Images

Mock mode accepts JPG, PNG or WebP files up to 1 MB, stores bytes behind a mock image service and keeps only metadata in the preference record. Image removal is staged with the settings draft: **Cancel changes** preserves the previously saved image, while Save removes superseded account-owned mock bytes and records an audit event. Unsaved uploads are cleaned when the customer cancels or defers setup. React components never access browser storage. Production must use private object storage, malware scanning, image re-encoding, authorised download URLs, retention and deletion controls.

## Service contract

```text
personalisation.get()
personalisation.save(completePreferenceSet)
personalisation.complete(completePreferenceSet)
personalisation.reset({ reopenSetup })
personalisation.uploadImage(file, kind, position)
personalisation.removeImage(imageId)
```

Every saved preference or image mutation records an audit event in mock mode. Production must derive user/company ownership from the server session and reject cross-company access.
