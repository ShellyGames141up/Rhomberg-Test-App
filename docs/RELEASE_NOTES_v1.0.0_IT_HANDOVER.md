# v1.0.0 IT Handover Release Notes

- Release name: Rhomberg Platform IT Handover
- Tag: `v1.0.0-it-handover`
- Date: 30 July 2026
Commit: resolved by the signed repository tag and reported in the final release verification

Functional application and workflow implementation is complete in mock mode; production infrastructure and backend integration remain subject to IT review and staging deployment.

## Application Products

- Rhomberg Connect customer desktop and mobile
- Rhomberg Operations internal mobile and desktop
- Executive Workflow Demo for fabricated internal presentations

## Implemented Workflow

RFQ submission, representative review, external quotation confirmation, customer acknowledgement, acceptance/order creation, Planning, Laboratory SANAS/Traceable routing, Expediting, QA/rework, Dispatch, notifications, documents, audit history, management analytics and retention demonstration.

## Supported Demo Roles

Customer, Sales Representative, Sales Manager, Company Owner, Planning, Laboratory User, Laboratory Manager, Expeditor, Quality Assurance, Dispatch and Administrator. Buyer and Quality Manager remain available in the Internal Desktop preview.

## Handover Additions

- Dedicated Executive Workflow Demo route and presenter controls
- Permission-controlled Administrator desktop dashboard
- Expanded Laboratory filters, urgent view, sorting and certificate register views
- Desktop-native Rhomberg Connect navigation and layout
- Fluid desktop/mobile typography
- Five-link Preview Centre and formal IT-facing README
- Deployment, Executive Demo, PDF/email, retention and testing documentation
- Production exclusion scan for executive-demo markers

## Mock-Only Functions

Fabricated logins, guided role switching, browser-local persistence, demo reset, simulated email/push, browser PDF creation and upload metadata simulation.

## Production Dependencies

Secure backend API, PostgreSQL, customer/internal identity, secrets, private document storage, malware scanning, Microsoft 365/SMTP, monitoring, logging, backups, recovery, CI/CD and approved domains/TLS.

## Security Limitations

GitHub Pages and browser storage are not production security boundaries. Front-end permissions require server enforcement. No real data may be entered.

## Known Issues

- No production infrastructure is connected.
- Mock records do not synchronise across browsers/devices.
- Buyer workflow remains inactive.
- Mobile/native packaging and store distribution remain future IT-controlled work.

## Recommended Staging Sequence

Technical review, staging provision, backend/database implementation, authentication, private storage, email integration, security testing, UAT and production approval.

## Questions for Innovate IT

See [Deployment Handover](DEPLOYMENT_HANDOVER.md) for the hosting, identity, storage, email, backup, monitoring, distribution and ownership decisions still required.
