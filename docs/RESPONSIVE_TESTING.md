# Responsive and accessibility review

## Target matrix

| Target | Representative viewport |
| --- | --- |
| Small Android | 360 × 640 |
| Large Android | 412 × 915 |
| Small iPhone | 375 × 667 |
| Large iPhone | 430 × 932 |
| Tablet portrait | 768 × 1024 |
| Tablet landscape | 1024 × 768 |
| Standard laptop | 1366 × 768 |
| Desktop monitor | 1920 × 1080 |
| Large desktop | 2560 × 1440 |

## Required checks

- No horizontal document overflow, clipped controls or escaped text.
- Long company/product names wrap with usable line height.
- Minimum 44 px interactive targets on touch layouts.
- Bottom navigation and forms respect safe-area insets.
- Planning/Expediting/Dispatch desktop grids collapse into cards or fewer columns.
- Wizard steps remain horizontally scrollable without shrinking labels to illegibility.
- Dialogues/screens remain usable in portrait and landscape.
- Visible keyboard focus and readable colour contrast.
- Small through Extra Large customer typography does not overlap.
- Comfortable, Standard and Compact density retain mobile touch safety.
- Light, dark and custom customer colours remain readable.
- Reduced-motion preference disables non-essential transitions.

## Automated coverage

`tests/platform-previews.test.mjs` checks route documents, safe-area styling, touch-target rules, landscape handling, font/density variables and protected colour validation. Browser review results should be dated below after each major visual change.

## Current review record

Reviewed 27 July 2026 in the in-app Chromium browser.

| Preview | Viewport reviewed | Result |
| --- | --- | --- |
| Preview centre | 1920 × 1080 | Four launch cards, correct route links and no document overflow |
| Customer Mobile | 360 × 640 and 430 × 932 | Setup wizard and dashboard fit without document overflow; wizard steps remain intentionally horizontally scrollable |
| Customer Desktop | 1366 × 768 | 1180 px centred desktop shell, readable dark-mode branding and no document overflow |
| Rep & Expeditor Mobile | 412 × 915 | Role gate, Expeditor queue, filters and cards fit; header controls are at least 44 × 44 px |
| Internal Desktop | 1440 × 900 | 1377 px operational shell, queue grid and controls fit without clipping |
| Internal Desktop tablet fallback | 768 × 1024 | Responsive card layout with no clipped buttons or document overflow |

The review also confirmed:

- incompatible saved sessions are rejected before a restricted preview opens;
- customer customisation remains company-scoped and is restored after reload;
- light customer setup surfaces remain readable when the surrounding application uses dark mode;
- the dark header wordmark uses a high-contrast treatment;
- no browser console errors were reported during the route and viewport checks.

Automated checks and this Chromium review do not replace testing on physical iOS/Android devices, browser zoom, screen readers, Windows high-contrast mode or all 2560 × 1440 combinations.

The Dispatch phase added a focused review on 27 July 2026:

| Preview | Viewport reviewed | Result |
| --- | --- | --- |
| Internal Desktop · Dispatch | 1280 × 720 | Queue, filters, desktop table, fabricated records and role-specific navigation rendered with no horizontal document overflow |
| Internal Desktop · Dispatch responsive fallback | 390 × 844 | Header row hides, order rows collapse to one-column labelled cards, the delivery detail/form remains reachable, and no horizontal document overflow was found |

The Dispatch review also opened the fabricated out-for-delivery record, confirmed its structured action form, separate customer/internal messages, proof-metadata notice, history and audit surfaces, and found no browser console warnings or errors.
