# Preview guide

Base URL: `https://shellygames141up.github.io/Rhomberg-Test-App/`

| Preview | URL | Demonstration login | Intended exercise |
| --- | --- | --- | --- |
| Rhomberg Connect — Customer Desktop | `/preview/customer-desktop/` | `customer.demo@example.invalid` / `Demo123!` | Complete setup, browse/configure a product, submit an RFQ and review tracking |
| Rhomberg Connect — Customer Mobile | `/preview/customer-mobile/` | `cape.demo@client.test` / `Demo123!` | Touch-first customer journey, notifications, profile and settings |
| Rhomberg Operations — Rep & Expeditor Mobile | `/preview/internal-mobile/` | `sales.workflow@example.invalid` / `Sales123!`, `expeditor.workflow@example.invalid` / `Expedite123!`, or manager demo | Review assigned RFQs or update Expediting from a phone-sized layout |
| Rhomberg Operations — Internal Desktop | `/preview/internal-desktop/` | Role-specific account shown below | Review Sales, Planning, Expediting, the structured Dispatch workspace or management queues |

Additional desktop-only accounts:

- Planning: `planning.workflow@example.invalid` / `Planning123!`
- Dispatch: `dispatch.workflow@example.invalid` / `Dispatch123!`
- Buyer, prepared but inactive: `buyer.workflow@example.invalid` / `Buyer123!`
- Administrator: `administrator.workflow@example.invalid` / `Admin123!`

All credentials and records are fabricated. Do not upload real Purchase Orders, customer documents or confidential content.

## Access behaviour

- Connect rejects every internal role.
- Operations Mobile accepts Sales Representative, Manager and Expeditor only.
- Planning, Dispatch, Buyer and Administrator are desktop-only.
- Operations Desktop rejects Customer.
- Changing a URL never grants a permission; service and workflow checks remain authoritative.
- A visible **Demo Preview** marker and link back to the Preview Centre remain available.

## Persistence

Closing and reopening the browser retains mock accounts, RFQs, orders and customer settings on that device. Different browsers, profiles, computers and phones do not synchronise. Clear site data only when deliberately resetting the demonstration.

## Known preview limitations

No real authentication, server database, SMTP, push service, malware scanning, shared object storage, cross-device updates or production audit retention is connected. See `MOCK_MODE_LIMITATIONS.md`.
