# Technical workspace, management navigation and registration refresh

## Scope

Controlled internal staging correction following 5.2.19. No demo identities or operational fixtures are added to staging. No server, IIS, database or network changes are performed by building this package.

- RFQ list responses include saved line IDs, product snapshots, quantities and configurations. Technical referrals select a real line, not an empty list.
- Technical queue records match the existing departmental UI. The assigned RFQ and company become readable to Technical through SELECT-only referral policies.
- The advisor selector uses a restricted display-only directory function, not unrestricted employee-table access.
- Selecting an advisor creates an assigned request; department assignment and start-review remain controlled actions. Customer and representative information replies resume review.
- Internal recommendations remain private even when a separate customer-safe note is provided. Customer payloads exclude raw message metadata. Assignment, messages and completion notify the relevant recipients.
- Duplicate active referrals do not repeatedly add 24 hours. Technical metrics derive from saved timestamps rather than hard-coded zeroes.
- Owner and Sales Manager navigation is not captured by a representative permission inherited through another role. Management auxiliary data is loaded only with the corresponding permission.
- The complete management layout retains workflow KPIs, charts, 31-day reporting and authorised exports. Missing financial evidence is not fabricated.
- The legacy Temperature Laboratory Manager certificate filter includes SANAS, retaining access to historical Traceable certificates. It does not give non-Laboratory roles access to certificates.
- Data polling runs every 15 minutes. New public customer registration changes the Administrator's revision and is included in its customer directory. Hidden/offline pages or unsaved forms can defer refresh; a focused, online, idle view refreshes on its next check.

## Deployment boundary

Apply migrations through `023_technical_workspace_read_contract.sql`, then the exact packaged `phase1-runtime-grants.sql`. Its preflight requires `app.list_technical_advisors()`; do not work around failures with broad grants. Deploy matching API and frontend together, preserving the existing protected session pepper, document store and rollback release.

The 15-minute timer retrieves data. It does not install this ZIP or replace an already loaded JavaScript bundle. Follow the established side-by-side server update and reload clients to obtain the new application.

## Verification / acceptance

Automated tests use fabricated local data: referral line selection, advisor directory, queue shape, assignment, information exchange, completion, safe projections, notifications, duplicate referral, company/representative isolation, new customer visibility and revision change. Separate Laboratory tests exercise certificate batches, private downloads and version history. Browser component inspection checks Technical selectors, Laboratory physical-unit selection and Owner/Sales Manager layout.

These are local checks, not proof of the deployed RHOMAPP state. After deployment, verify Technical on an existing RFQ with saved lines; send, assign, answer and complete a referral; verify customer-safe messages and notifications; register a fabricated customer and observe Administration; inspect both management workspaces and Laboratory certificate selections.

Private document malware scanning remains a deployment requirement: pending documents are not made public to make a test pass. Technical queue detail currently uses one scoped RFQ read per visible request; measure queue size/load before wider rollout.
