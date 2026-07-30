# Preview Guide

Base URL: `https://shellygames141up.github.io/Rhomberg-Test-App/`

All records and credentials are fabricated. Do not upload real Purchase Orders, customer documents, credentials, pricing or confidential information.

| Preview | Route | Roles |
| --- | --- | --- |
| Rhomberg Connect - Customer Desktop | `/preview/customer-desktop/` | Customer |
| Rhomberg Connect - Customer Mobile | `/preview/customer-mobile/` | Customer |
| Rhomberg Operations - Rep & Expeditor Mobile | `/preview/internal-mobile/` | Sales Representative, Manager, Expeditor |
| Rhomberg Operations - Internal Desktop | `/preview/internal-desktop/` | Sales, Planning, Laboratory, Expediting, QA, Dispatch, management, Buyer, Administrator |
| Executive Workflow Demo | `/demo/executive-workflow/` | Guided switching between supported fabricated Customer and internal roles |

## Primary Accounts

| Role | Username | Password |
| --- | --- | --- |
| Customer | `customer.demo@example.invalid` | `Demo123!` |
| Sales Representative | `sales.workflow@example.invalid` | `Sales123!` |
| Planning | `planning.workflow@example.invalid` | `Planning123!` |
| Expeditor | `expeditor.workflow@example.invalid` | `Expedite123!` |
| Laboratory User | `laboratory.workflow@example.invalid` | `Lab12345!` |
| Laboratory Manager | `laboratory.manager@example.invalid` | `LabManager123!` |
| Quality Assurance | `quality.workflow@example.invalid` | `Quality123!` |
| Dispatch | `dispatch.workflow@example.invalid` | `Dispatch123!` |
| Sales Manager | `sales.manager@example.invalid` | `SalesManager123!` |
| Company Owner | `owner.workflow@example.invalid` | `Owner12345!` |
| Administrator | `administrator.workflow@example.invalid` | `Admin123!` |

Additional Quality Manager, Buyer and Manager logins are shown by the Internal Desktop login selector.

## Access Behaviour

- Connect rejects internal roles.
- Operations Mobile accepts only its supported Sales, Manager and Expeditor roles.
- Planning, Laboratory, QA, Dispatch, Buyer and Administration are desktop-only.
- Operations Desktop rejects Customer sessions.
- The Executive Demo uses a mock-service role switch and preserves normal permissions.
- Changing a URL does not grant access; service and workflow checks remain authoritative.
- Administrator actions require `administer_users`.
- Customer records remain company-scoped.
- Representative records remain assignment-scoped unless wider management permission exists.

## Laboratory Demonstration

Use the Laboratory User for unit work and the Laboratory Manager for controlled release. The queue provides SANAS/Traceable, urgent, active, certificate-pending and completed views; search, sort and monthly metrics; unit results; and one PDF certificate per physical unit.

## Administrator Demonstration

The Administrator opens the Administration workspace by default. Review user and customer-company accounts, representative assignment, central roles/permissions, Lab/QA/Dispatch configuration, integration placeholders, notifications, retention, management, audit and archive controls.

## Executive Demonstration

See [Executive Demo Guide](EXECUTIVE_DEMO_GUIDE.md). The route contains a permanent fabricated-data banner, scenario guidance, role switching, presenter progress, notification/document/audit shortcuts, reset and presentation mode.

## Persistence

Same-browser changes survive refresh and browser restart. Unrelated browsers, profiles, computers and phones do not synchronise. The Executive Demo scenario also resumes in the same browser.

## Limitations

No production authentication, API, database, email, push, malware scanning, shared object storage, backups or permanent audit retention is connected. GitHub Pages is not private or production-secure.
