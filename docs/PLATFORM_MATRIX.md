# Product and platform matrix

| Capability | Connect desktop | Connect mobile | Operations mobile | Operations desktop |
| --- | :---: | :---: | :---: | :---: |
| Customer registration/login | Yes | Yes | No | No |
| Customer personalisation/settings | Yes | Yes | No | No |
| Catalogue/configuration/RFQ | Yes | Yes | No | No |
| Customer-safe quotation/tracking | Yes | Yes | No | No |
| Sales representative inbox | No | No | Yes | Yes |
| Manager/authorised management oversight | No | No | Yes | Yes |
| Expediting updates | No | No | Yes | Yes |
| Planning queue | No | No | No | Yes |
| Dispatch queue | No | No | No | Yes |
| Buyer role | No | No | No | Prepared/inactive |
| Administrator role | No | No | No | Yes |
| Archive/retention workspace | No | No | Manager responsive fallback | Manager/Administrator |
| Touch-first navigation | Responsive | Primary | Primary | Responsive fallback |
| Tables/search/sorting | Customer-safe | Simplified cards | Simplified cards | Desktop-optimised |
| Current delivery format | Browser/PWA preview | Browser/PWA preview | Browser/PWA preview | Browser/PWA preview |

All columns use the same application bundle, services and API contracts. Delivery profiles control routes, responsive navigation and permitted roles; they are not separate codebases. See `DELIVERY_STRATEGY.md`.

## Product naming

- **Rhomberg Connect** is customer-facing.
- **Rhomberg Operations** is internal.
- Planning and Dispatch are deliberately absent from Operations Mobile.
- The current `manager` role represents authorised management in the demonstration. A future governance decision may split representative manager and company owner into distinct roles without changing the permission mechanism.
