# Preview Centre

Normal application links are intentionally not shown inside the Preview Centre. The Preview Centre cannot provision or authenticate private operational accounts. Fabricated `.invalid` and `.test` identities remain confined to dedicated preview routes, while `/desktop/` and `/mobile/` reject them in the public build.

The Preview Centre is a separate, public demonstration environment for authorised project reviewers. It is intended for presentations, development review, showcase events, management demonstrations and IT testing. It is not the normal Rhomberg Connect application entry and must never receive real data.

## Experiences

| Experience | Best use |
| --- | --- |
| Customer Mobile | Customer catalogue, RFQ, order and notification journeys at phone width |
| Customer Desktop | The same customer workflow in a wide desktop layout |
| Rep/Expeditor Mobile | Field-friendly Sales Representative and Expeditor workflows |
| Internal Desktop | Sales, Technical, Planning, Laboratory, QA, Dispatch, management and Administration workspaces |
| Executive Workflow Demo | Guided cross-department presentation with controlled fabricated role switching |

## Presentation sequence

1. Open the single Preview Centre link in README.
2. State that the environment contains fabricated data and provides no production access.
3. Choose **Executive Workflow Demo** for an end-to-end presentation or a role preview for a focused department review.
4. Use the appropriate fabricated account from README's **Preview Centre Demo Logins** section.
5. For the executive journey, select a scenario, follow its recommended step and change role only at the displayed workflow hand-off.
6. Use device preview when demonstrating responsive behaviour; use Full Application for detailed desktop operation.
7. Reset the fabricated scenario before presenting to a new audience.

Normal users open the Desktop or Mobile Application link in README. Those routes present the Rhomberg Connect splash and sign-in screen directly and contain no navigation back to the Preview Centre.

Preview builds retain a small **DEMO PREVIEW** badge and an explicit return path. The normal application splash, sign-in and authenticated shell render no preview badge, banner, caption or Preview Centre link. Build and routing tests enforce this separation.

## Safety boundary

- Use fabricated credentials and records only.
- Do not upload real Purchase Orders, quotations, certificates or customer documents.
- Browser-local changes do not synchronise across devices.
- Mock email, push, files and audit persistence are demonstrations only.
- Production identity, API, database and private document storage are not connected.
- Preview screenshots are reviewed at the supported responsive widths, but the Preview Centre is never a substitute for production acceptance testing.
