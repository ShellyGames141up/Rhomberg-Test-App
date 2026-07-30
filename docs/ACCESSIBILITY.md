# Accessibility

## Current target

The mock platform targets WCAG 2.1/2.2 AA contrast and interaction guidance where it can be validated in this front-end preview:

- 4.5:1 for normal text;
- 3:1 for large text and essential controls;
- visible keyboard focus;
- readable disabled and placeholder text;
- 44 px primary touch targets;
- safe wrapping at customer text-size settings;
- no status communicated by low-contrast colour alone.

This is not a formal accessibility certification. Production still requires assistive-technology testing, a supported-browser matrix, content review and an independent accessibility audit.

## Contrast utilities

`src/shared/design/contrast.js` provides:

- six-digit colour validation and normalisation;
- sRGB relative luminance;
- contrast-ratio calculation;
- minimum-ratio checks;
- protected light/dark foreground selection;
- reports for token-pair validation;
- custom-theme rejection and safe fallback.

`tests/accessibility-responsive.test.mjs` checks all shared status pairs, every built-in customer preset, unsafe custom-theme rejection, the minimum customer font scale, semantic tokens and responsive contracts.

## Surface rules

Light cards use explicit near-black primary text, dark charcoal secondary text and medium-dark muted text. Dark cards use explicit near-white primary text and accessible light secondary/muted text. Product configuration headings, choices, toggles, inputs and supporting copy declare their foregrounds explicitly.

Personalisation samples are isolated from the saved application appearance. A light sample remains dark-on-light even when the surrounding application is in dark mode, and vice versa.

## Statuses and messages

`StatusBadge` is required for workflow, order, certificate, QA and account-history states. Each rendered badge declares a background and foreground through its semantic tone. Warning, error, success and information panels must also declare both surface and foreground rather than depending on page inheritance.

## Keyboard and controls

Buttons, links, inputs, selects, text areas and focusable custom elements receive a visible `:focus-visible` ring. Native labels remain associated through existing form markup. Controls must not be disabled solely by opacity; disabled text uses a protected token and opacity remains high enough to read.

## Motion

The existing `prefers-reduced-motion: reduce` rule suppresses decorative transitions and animations. Essential workflow state is never conveyed only by animation.

## Development review

Before handover:

1. Run `npm run check`, `npm run check:css` and `npm test`.
2. Run the preview and production builds.
3. Follow `docs/VISUAL_TEST_CHECKLIST.md`.
4. Confirm keyboard navigation through authentication, navigation, forms, dialogs and Executive Demo controls.
5. Confirm screen-reader names and reading order in the supported production browsers.

## Known production work

- automated axe-core or equivalent testing in CI;
- NVDA/JAWS testing on Windows and VoiceOver testing on supported Apple devices;
- 200%/400% browser reflow testing on the production shell;
- PDF accessibility tagging;
- captions or transcripts for any future media;
- formal accessibility statement and issue-reporting route.

