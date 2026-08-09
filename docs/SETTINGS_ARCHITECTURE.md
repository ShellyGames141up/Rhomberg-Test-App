# Settings architecture

Every authenticated role can open Profile → Settings. The dedicated routed view uses desktop category navigation and mobile stacked/scrollable navigation.

The `userSettings` service owns App, Sounds & Vibration, Appearance, Accessibility, onboarding and role-notification choices. React components never access browser storage. Mock mode stores an account-scoped record through the browser-store adapter; production uses `/users/me/settings` and onboarding subresources. Every save appends immutable audit evidence.

Customers additionally see Privacy and Data plus customer journey tutorials. Internal users receive notification topics relevant to their role. Security actions reuse the existing verification-code credential service and preserve separate customer/internal authentication realms. Settings never grant permissions or bypass workflow validation.

Production synchronisation should version settings, resolve concurrent edits by account and device timestamp, retain audit evidence and expose only the signed-in user’s record.

