# Management oversight and validation

## Scope

Version 4.6 implements Prompts 15 and 16 in the shared application. GitHub Pages remains a fabricated browser-only mock; the API and PostgreSQL material describe the future private service.

## Management workspace

Manager and Administrator accounts with `view_reports` receive one responsive oversight workspace. It contains open/awaiting/quoted RFQ totals; Planning, Expediting, hold, delay, Dispatch, completed, emergency and archive totals; average recorded stage time; order breakdowns; ageing; recent audited activity; and authorised record search.

Separate permissions control representative reassignment, workflow-override approval, archival approval and CSV report export. Every mutation requires a reason, expected record version where applicable and an immutable audit event.

The projection recursively removes protected pricing and price-engine fields. A manager may optionally be restricted by `authorisedCompanyIds`; all metrics, results, activity and exports are calculated after that scope is applied.

## Validation and errors

The existing RFQ-to-delivery validation remains authoritative and now additionally covers:

- stable RFQ submission idempotency and duplicate replay;
- normal reference characters for quotation, job and Purchase Order numbers;
- verified filename, extension, MIME type, non-zero size and maximum size for document metadata;
- quotation/acceptance dates not in the future;
- Planning and Expediting estimates not in the past;
- Planning submission dates not in the future;
- chronological quotation, Planning and Dispatch dates;
- stale record versions, invalid transitions and role/company/assignment failures;
- session expiry, transient network failure and safe retry boundaries.

Expected validation errors retain friendly field messages. Unexpected, server and dependency failures use public fallback text. Stack traces, SQL/database detail, connection strings, provider bodies and internal security predicates are not rendered.

## Retry and idempotency

The API client retries a transient read-only `GET`/`HEAD` once. It does not automatically retry state-changing requests. RFQ and important future mutations carry an idempotency key so the backend can safely return the original result when the exact request is replayed.

Production should store idempotency records with actor, route, canonical request hash, status, response reference and expiry. A reused key with a different request hash must return `409`.

## Production requirements

- Calculate management aggregates in the backend after row/company authorisation.
- Use indexed materialised/reporting views only if their refresh preserves tenant scope.
- Keep report files private, short-lived and audited.
- Enforce optimistic concurrency and append-only approval/audit records.
- Add central structured logging with correlation IDs while keeping logs out of public responses.
- Monitor validation, conflict, retry and idempotent-replay rates without logging sensitive payloads.
