# Rhomberg Platform Design System

## Purpose

This document defines the visual contracts shared by Rhomberg Connect, Rhomberg Operations and the Executive Workflow Demo. New components should consume these contracts rather than introducing role-specific colours, text sizes or breakpoints.

## Semantic colour tokens

The authoritative CSS tokens are declared in `styles.css`. Light and dark values must be changed as complete, tested pairs.

| Use | Light surface | Dark surface |
| --- | --- | --- |
| Primary text | `--text-primary-light-background` | `--text-primary-dark-background` |
| Secondary text | `--text-secondary-light-background` | `--text-secondary-dark-background` |
| Muted text | `--text-muted-light-background` | `--text-muted-dark-background` |
| Disabled text | `--text-disabled-light-background` | `--text-disabled-dark-background` |
| Link | `--link-light-background` | `--link-dark-background` |

Components normally consume the mode-aware aliases:

- `--background-page`
- `--background-surface`
- `--background-elevated`
- `--text-primary`
- `--text-secondary`
- `--text-muted`
- `--text-disabled`
- `--border-default`
- `--border-strong`
- `--action-primary`
- `--action-secondary`
- `--link-colour`
- `--focus-ring`

White or near-white cards must explicitly use `--background-surface` and `--text-primary`. Dark heroes, navigation areas and industrial panels must explicitly use the dark-background text tokens. A foreground must not be inherited across a component that can change its surface.

## Status colours

`src/shared/design/tokens.js` owns the status pairs and `src/components/StatusBadge.jsx` owns rendering. The supported tones are neutral, information, progress, warning, success, error and accent. Each tone defines both a background and a foreground with at least 4.5:1 contrast.

Domain states are mapped to a tone by `statusToneFor(status)`. Screens must pass a domain state and display label to `StatusBadge`; they must not build `status-*` colours inside React.

## Typography

The type scale is defined in both `src/shared/design/tokens.js` and CSS variables.

| Purpose | Token | Baseline |
| --- | --- | --- |
| Display | `--type-display` | Responsive clamp |
| Page heading | `--type-page-heading` | Responsive clamp |
| Section heading | `--type-section-heading` | Responsive clamp |
| Card heading | `--type-card-heading` | 1 rem |
| Body | `--type-body` | 1 rem |
| Secondary | `--type-secondary` | 0.9375 rem |
| Label | `--type-label` | 0.875 rem |
| Button | `--type-button` | 0.9375 rem |
| Input | `--type-input` | 1 rem |
| Helper | `--type-helper` | 0.8125 rem |
| Status | `--type-status` | 0.875 rem |
| Table | `--type-table` | 0.875 rem |
| Navigation | `--type-navigation` | 0.875 rem |

The customer Small, Medium, Large and Extra Large options apply one protected scale at the Rhomberg Connect root. Small remains at 95% of the normal scale. Text-heavy controls use `min-height`, wrapping and content-driven height instead of fixed heights.

## Breakpoints

The shared breakpoint values are exported from `src/shared/design/tokens.js`.

| Range start | Intended layout |
| --- | --- |
| 360 px | Small mobile |
| 600 px | Large mobile |
| 768 px | Tablet portrait |
| 1024 px | Tablet landscape / small laptop |
| 1280 px | Laptop |
| 1440 px | Standard desktop |
| 1920 px | Large desktop |
| 2560 px | Ultrawide |

CSS cannot currently consume JavaScript constants directly, so matching documentation variables are declared in `:root`. Any breakpoint change must update the JavaScript constants, CSS queries, tests and responsive documentation together.

## Cards, controls and forms

- Cards expand with content and use `min-width: 0`.
- Text wraps safely; fixed heights are not permitted for text-heavy cards.
- Interactive targets are at least 44 px in the primary application interface.
- Button groups wrap; mobile action groups may stack.
- Inputs use explicit surface, foreground, placeholder, border and focus-ring tokens.
- Complex tables use a controlled scroll wrapper when they cannot reflow.
- Focus uses a visible three-pixel ring and must not be removed.

## Customer theme safety

Customer colour presets may change brand accents, but they do not replace semantic text or status colours. `validateThemeColour()` rejects colours that cannot support readable foregrounds or essential-control contrast. `themeColoursFor()` also sanitises unsafe persisted custom colours back to protected defaults.

