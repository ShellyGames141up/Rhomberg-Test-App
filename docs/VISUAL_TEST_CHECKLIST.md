# Visual Test Checklist

Use fabricated data only. Record the browser, operating system, commit and date with any screenshot evidence. Do not mark a row passed from source inspection alone.

## Viewports

| Viewport | Orientation | Checked | Notes / evidence |
| --- | --- | --- | --- |
| 360x800 | Portrait phone | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 390x844 | Portrait phone | [x] | Customer catalogue/configuration/profile/personalisation and role dashboards checked. |
| 412x915 | Portrait phone | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 600x960 | Large mobile | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 768x1024 | Tablet portrait | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 1024x768 | Tablet landscape | [x] | Presenter controls and credential actions were repaired and rechecked after overflow was found. |
| 1280x800 | Small laptop | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 1366x768 | Laptop | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 1440x900 | Desktop | [x] | All role dashboards plus full/device Executive Demo modes checked. |
| 1920x1080 | Large desktop | [x] | Role dashboards, PBG configuration and Account Security rendered without page overflow. |
| 2560x1440 | Ultrawide | [x] | Wide dashboard, configuration and Account Security containment checked. |

At every size confirm: no page-level horizontal overflow; usable navigation; no text clipping; no overlapping fixed controls; readable labels/statuses; safe dialog bounds; and bottom content not hidden by navigation.

## Required screens

Capture representative phone, tablet and desktop states for:

- [x] Customer dashboard
- [x] Customer catalogue and product detail
- [x] Customer product configuration, including pale option cards
- [ ] RFQ builder and submit confirmation
- [ ] Customer tracking and notifications
- [x] Customer profile and Account Security
- [x] Customer personalisation preview
- [x] Sales Representative dashboard
- [x] Planning
- [x] Laboratory
- [x] Expediting
- [x] Quality Assurance
- [x] Dispatch
- [x] Administrator
- [x] Sales Manager
- [x] Company Owner
- [x] Executive Demo Full Application
- [x] Executive Demo phone, tablet and desktop Device Preview

## Appearance and scale

- [x] Rhomberg Default
- [x] Industrial Professional
- [x] Modern
- [x] Funky
- [x] Dark
- [x] High Contrast
- [x] Valid Custom theme
- [x] Rejected unsafe Custom theme (automated safety test)
- [x] Light appearance
- [x] Dark appearance
- [x] Small text
- [x] Medium text
- [x] Large text
- [x] Extra Large text
- [ ] Browser zoom 80%
- [ ] Browser zoom 100%
- [ ] Browser zoom 125%
- [ ] Browser zoom 150%

For each relevant state review white cards, dark cards, inputs, disabled values, placeholders, buttons, badges, navigation, tables, dialogs, notifications, warnings, errors and success messages.

## Interaction and keyboard

- [ ] Visible focus through header and navigation
- [ ] Authentication fields and tabs
- [x] Catalogue/product/configuration path
- [ ] Checkbox, radio/toggle, select and date controls
- [ ] File-upload control
- [ ] RFQ actions and validation errors
- [x] Account Security buttons and challenge form
- [ ] Operational queue filters and actions
- [x] Executive controls expand/collapse, role, view and device selectors
- [ ] Reduced-motion operating-system preference

## Recorded verification — 30 July 2026

The Codex in-app Chromium browser rendered the complete 11-size matrix against the local Executive Demo. Every size was checked for page-level overflow for Customer, Sales Representative, Sales Manager, Company Owner, Planning, Laboratory User, Laboratory Manager, Expeditor, Quality Assurance, Dispatch and Administrator dashboards.

The PBG product configuration and Account Security screens were separately rendered at all 11 sizes. The 1024x768 pass exposed two contained-overflow defects in credential actions and presenter controls; both were corrected and the matrix was rerun with zero failures.

Official Rhomberg Connect Light and Dark modes were rendered at 390x844 with explicit foreground/background values. Increased-text and default-text previews were checked for readable controls and no horizontal overflow. Customer-specific application themes and logos are no longer supported.

Executive Full Application mode and intentional 390 px phone, 768 px tablet and wide desktop device frames were checked. Presenter controls collapsed from 323 px to 96 px without overlap. The browser console reported no warnings or errors during the final Executive check.

Browser-level zoom shortcuts were attempted, but this embedded browser retained the same device-pixel ratio and layout metrics. The four zoom rows therefore remain deliberately unchecked and require a final pass in normal Chrome or Edge. The RFQ submission confirmation, tracking/notification detail screens, file upload, full keyboard traversal, reduced-motion preference and operational mutations also remain on the final human visual checklist.

## Screenshot naming

Use `product-role_screen_viewport_theme_font_zoom.png`, for example:

`connect-customer_configuration_390x844_dark_extra-large_100.png`

Screenshots must contain fabricated demonstration data only and must not include real names, customer records, pricing, credentials or infrastructure details.
