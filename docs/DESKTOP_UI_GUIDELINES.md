# Desktop UI Guidelines

Internal operational screens use one responsive codebase with genuine desktop workspaces, not enlarged mobile cards.

## Workspace

- Use the shared left navigation rail at 1024 px and above.
- Bound the complete workspace to 1920 px on large and ultrawide displays.
- Let queues, reporting grids and tables consume the flexible content column.
- Use a moderate readable width for prose/forms, but do not constrain dashboards to phone width.
- Keep search and filters in horizontal grids while space permits.
- Keep content-driven height and avoid clipping cards.

## Typography and controls

- Body and input text use approximately 16 px.
- Operational labels, tables and statuses use 14 px or larger.
- Helper text uses 13 px or larger.
- Buttons are at least 44 px tall and wrap safely.
- Keyboard focus must be visible.
- Light/dark surfaces must use their matching semantic foreground tokens.

## Data-heavy views

Planning, Laboratory, Expediting, Quality Assurance, Dispatch, Administration and Management use wide queues or tables on desktop. Long references may wrap. Horizontal scrolling is limited to an explicit table container when all essential columns cannot fit. Actions remain visible and status badges use the shared contrast-safe component.

## Responsive fallback

At tablet widths, toolbar fields reflow into two columns. On mobile, filters stack and complex queues use cards or controlled scrolling. Desktop bottom navigation is replaced by the persistent rail; mobile bottom navigation remains available with safe-area padding.

## Review sizes

Use the full matrix in `docs/VISUAL_TEST_CHECKLIST.md`, including 1024x768, 1280x800, 1366x768, 1440x900, 1920x1080 and 2560x1440.
