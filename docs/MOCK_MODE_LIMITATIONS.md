# Mock-mode limitations

The GitHub Pages deployment is a product demonstration, not a hosted business system.

- Authentication is fabricated and browser-local; it provides no real identity assurance.
- Storage is limited to one browser profile and can be cleared by the user.
- Separate computers, phones, browser profiles and private windows do not synchronise.
- Company isolation is modelled by the service but cannot protect against a person controlling the browser developer tools.
- Image bytes are stored locally for preview only; there is no malware scan or server retention.
- Purchase Order and quotation documents are metadata-only in mock workflows unless an existing test fallback explicitly handles a sample file.
- In-app notifications are local. Email and push delivery are not connected by this phase.
- No production pricing, payment processing or confidential customer data belongs in the preview.
- Audit entries demonstrate the required structure but are not tamper-resistant.
- GitHub Pages cannot enforce private access, server sessions, rate limiting, antivirus checks or shared background jobs.

Production requires the prepared API contracts, secure session identity, PostgreSQL tenant policies, private document storage, notification workers, immutable audit retention, monitored backups and approved data-retention rules.
