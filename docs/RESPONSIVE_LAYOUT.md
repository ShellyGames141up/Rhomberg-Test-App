# Responsive Layout

## Normal application entry verification

The shared normal application now has explicit `/desktop/` and `/mobile/` entry documents without duplicating React code. Both rely on fluid CSS, container/media queries and the same navigation/workspace components. Automated and rendered review covers 320, 360, 375, 390, 412, 480, 600, 768, 820, 1024, 1280, 1366, 1440, 1920 and 2560 CSS pixels, plus representative portrait/landscape changes. At 320 px the normal sign-in has no page-level horizontal overflow; large displays preserve readable max-widths and operational grids.

## Product modes

The shared React application renders four product previews plus the Executive Workflow Demo.

- Customer Mobile and Internal Mobile retain a touch-first application frame.
- Customer Desktop and Internal Desktop become real two-column workspaces from 1024 px.
- Executive Full Application mode uses the same role-appropriate desktop workspace.
- Executive Device Preview mode intentionally centres a labelled phone, tablet or desktop frame.

The vertical decorative desktop caption is disabled because it consumed usable width without adding workflow value.

## Width strategy

Desktop workspaces use a bounded maximum of 1920 px with a 210-260 px navigation rail and a flexible content column. Wide operational queues, filters and tables use most of the content column. Customer desktop uses broader product grids and a moderate two-column RFQ form where space allows.

At 600-1023 px, content uses the full viewport with safe padding, two-column grids where practical and bottom navigation. Below 600 px, forms and dense action groups stack, tables use their existing card/controlled-scroll representations, and fixed navigation reserves bottom content space.

## Breakpoint behaviour

- Below 360 px: compact header and navigation safeguards.
- 360-599 px: one-column mobile content and phone-safe controls.
- 600-767 px: large-mobile/tight-tablet two-column content.
- 768-1023 px: tablet grids and two-column operational filters.
- 1024-1279 px: desktop navigation rail and wide queues.
- 1280-1439 px: multi-column forms and four-column metrics.
- 1440-1919 px: standard desktop spacing.
- 1920-2559 px: bounded large-desktop content.
- 2560 px and above: centred ultrawide workspace.

## Component rules

- Use grid tracks with `minmax(0, 1fr)`.
- Set `min-width: 0` on nested flex/grid content.
- Prefer `min-height` to rigid height.
- Wrap button groups and give mobile actions full width where needed.
- Use safe-area insets for mobile bottom navigation.
- Use `overflow: auto` only for intentional data-table containers.
- Never use viewport-width calculations that exceed the root viewport.
- Do not rely on a narrow parent to trigger media queries. Executive phone/tablet frames have explicit mode classes for their internal reflow.

## Desktop navigation

Customer Desktop, Internal Desktop and Executive Full Application mode place navigation in the left rail. The rail remains visible while the application header and content occupy the flexible right column. Mobile previews retain bottom navigation.

## Executive Demo

Presenter controls are collapsible. Full Application is the default and is persisted in the mock service. Device Preview offers Phone (390 px), Tablet (768 px) and Desktop (up to 1440 px) frames. The selected frame never causes horizontal page overflow; it contracts to the available viewport.

## Required matrix

The authoritative manual matrix is in `docs/VISUAL_TEST_CHECKLIST.md`. A viewport may only be marked verified after the actual rendered screen has been inspected at that size.

