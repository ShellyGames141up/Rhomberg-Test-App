# Accessibility and Responsive Repair Completion Report

Date: 30 July 2026

Scope: Rhomberg Connect, Rhomberg Operations, all public mock previews and the Executive Workflow Demo. No production database, credentials, protected pricing or real customer information were introduced.

## Outcome

The platform now has a shared semantic design foundation, contrast-protected themes, a central responsive typography scale, accessible status badges and true mobile/tablet/desktop layouts. Existing workflows, permissions, routes, mock data and service adapters remain in place.

## Files and architecture changed

- `src/shared/design/contrast.js` provides luminance, ratio, foreground selection and unsafe-pair reporting.
- `src/shared/design/tokens.js` provides shared breakpoints, typography, semantic colours and status tones.
- `src/components/StatusBadge.jsx` centralises status presentation.
- Customer, Account, Sales, Planning, Laboratory, Expediting, QA, Dispatch, Administration and tracking components now use the shared status badge.
- `src/shared/personalisation/personalisation.js` validates presets and custom colours and supplies protected foregrounds.
- Executive Demo domain, mock service, API contract placeholder, application state and controls now support Full Application and intentional phone/tablet/desktop device modes.
- `styles.css` contains the semantic light/dark tokens, protected surface rules, responsive layouts, scalable controls, wide desktop workspaces and focused breakpoint repairs.
- Automated accessibility/responsive contracts were added to `tests/accessibility-responsive.test.mjs`.
- Design, accessibility, responsive, desktop, Executive Demo, testing and visual-verification documentation was added or updated.

## Contrast and theme fixes

- Explicit light- and dark-background text, muted, disabled and link tokens replace unsafe inheritance.
- White configuration cards use near-black headings, charcoal body text and readable form values.
- Dark cards use protected near-white/light-grey foregrounds.
- Status tones define both background and foreground and meet the 4.5:1 normal-text target in automated checks.
- Every built-in theme calculates a protected primary/accent foreground.
- Unsafe persisted Custom-theme colours fall back to protected defaults.
- High Contrast adds stronger borders and focus visibility without changing workflow behaviour.

## Typography and control fixes

- The shared rem-based scale covers display, page, section, card, body, secondary, label, button, input, helper, status, table and navigation text.
- Operational labels, table headings and helper copy have larger minimum sizes.
- Small remains readable; Large and Extra Large expand cards and controls safely.
- Buttons use minimum heights, wrapping and flexible widths instead of unsafe rigid dimensions.
- Account Security actions stack on narrow screens and fit side-by-side without contained overflow at desktop widths.
- Focus, placeholder, disabled, validation and forced-colour states use explicit readable styling.

## Responsive and desktop fixes

- Shared breakpoints cover 360, 600, 768, 1024, 1280, 1440, 1920 and 2560 px layout ranges.
- Customer Desktop, Internal Desktop and Executive Full Application use a true wide workspace and navigation rail from 1024 px.
- Mobile layouts retain safe padding, bottom-navigation clearance and non-wrapping navigation labels.
- Tables use controlled local scrolling where necessary while preventing page-level horizontal overflow.
- Operational queues, cards, filters and forms reflow across phone, tablet, laptop and ultrawide sizes.
- The PBG configuration stage uses available desktop width while retaining a readable content hierarchy.
- A 1024 px contained-overflow defect in Account Security was found during rendered testing and fixed.

## Executive Demo fixes

- Full Application is the default presentation layout on tablet/desktop.
- Device Preview intentionally frames 390 px phone, 768 px tablet and wide desktop layouts.
- Presenter controls are collapsible and reflow from one to three to six columns.
- A 1024 px presenter-panel overflow found during rendered testing was fixed and retested.
- The vertical preview label no longer consumes application width.
- Phone mode explicitly reflows the application header, navigation, forms, configuration actions and operational grids.

## Manual browser verification

The following viewports were actually rendered:

- 360x800
- 390x844
- 412x915
- 600x960
- 768x1024
- 1024x768
- 1280x800
- 1366x768
- 1440x900
- 1920x1080
- 2560x1440

At every size, page-level overflow was measured for Customer, Sales Representative, Sales Manager, Company Owner, Planning, Laboratory User, Laboratory Manager, Expeditor, Quality Assurance, Dispatch and Administrator dashboards. The PBG product configuration and Account Security screens were also measured at every size.

Additional rendered checks covered:

- Customer catalogue → Pressure → PBG product → configuration path
- White configuration-card foregrounds
- Account Security action containment and challenge form
- All seven customer theme presets
- Light and dark isolated previews
- Small, Medium, Large and Extra Large text previews
- Executive Full Application
- Executive phone, tablet and desktop Device Preview
- Presenter controls expanded and collapsed
- Planning status badges
- Browser console warnings/errors

The detailed record is in `docs/VISUAL_TEST_CHECKLIST.md`.

## Automated verification

Passed:

```text
npm run check
npm run check:css
npm test
npm run build
npm run build:previews
npm run build:production
```

`build:previews` produced the four application previews plus Executive Demo. The production candidate completed its forbidden-marker scan and remains API-only.

## Remaining limitations and final human review

- The embedded test browser ignored browser-level zoom shortcuts; 80%, 100%, 125% and 150% must be checked in normal Chrome or Edge before formal handover.
- The final human screenshot pass should still cover RFQ submission confirmation, tracking/notification details, file upload, full keyboard traversal, reduced-motion mode and operational workflow mutations.
- Automated tests validate source contracts and colour ratios; they do not replace assistive-technology testing with NVDA, JAWS, VoiceOver or TalkBack.
- Mock GitHub Pages remains a fabricated-data demonstration and is not production-secure.
