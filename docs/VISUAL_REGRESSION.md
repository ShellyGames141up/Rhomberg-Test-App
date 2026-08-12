# Visual regression checks

The optional visual runner captures light-mode full-page screenshots at 360, 390, 412, 768, 1024, 1366 and 1920 px. It checks the normal application login plus Customer Mobile, Representative/Expeditor Mobile and Internal Desktop preview routes.

Run a local built application on port 4173, install Playwright in the review environment, then run `npm run test:visual`. Use `VISUAL_BASE_URL` when the application is served elsewhere. Images are written to `tmp/visual-regression`, which is intentionally not committed.

Page-level horizontal overflow fails the run. Only the approved data-table, Laboratory reading/progress and compliance regions may scroll horizontally. New exceptions must be narrow, documented and added to the explicit selector list rather than disabling the overflow audit.
