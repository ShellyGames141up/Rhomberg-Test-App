# Customer onboarding

After the application splash, a customer with no completed welcome record receives a one-time personalised welcome. Completion is written through `userSettings.completeWelcome()` and audited. It is not shown on every login.

The welcome opens a 13-step guided tutorial covering dashboard, catalogue, configuration, RFQ creation/review/submission, quotation and PO handling, tracking, notifications, documents, Profile, Settings and help. The staged RFQ is explicitly labelled `Tutorial Example` and exists only inside the tutorial component; it is never written to enquiry storage, notifications, analytics or reports.

Progress is persisted through `userSettings.saveTutorialProgress()`. Customers can skip, resume or replay the full tutorial and focused catalogue, RFQ, quotation/PO, tracking, notification and document tutorials from Settings → Help & Tutorials.

