# Phase 21 database schema guide

The secure Administrator extension adds usernames and branch assignments to identities, customer-company branch assignment, short-lived step-up verification sessions, generic administrative change evidence, explicit previous/new audit values and append-only approved RFQ/order correction rows. See [ADMINISTRATOR_MANAGEMENT.md](ADMINISTRATOR_MANAGEMENT.md).

The executable design proposal is [database/postgresql-schema.sql](database/postgresql-schema.sql). It is not connected to the preview and must be reviewed/migrated by IT.

Phase 21 adds `order_routing`, `lab_tasks`, `calibration_units`, `certificate_requirements`, `certificates`, `certificate_versions`, `lab_events`, `lab_monthly_metrics`, `qa_tasks`, `qa_inspections`, `qa_failures`, `qa_rework_cycles`, `qa_events`, `qa_monthly_metrics`, `department_receipts`, `verification_codes`, `credential_change_requests`, `product_statistics`, `representative_statistics` and `operational_metrics`.

Important constraints include:

- one physical calibration row per `(order_item_id, unit_sequence)`;
- one certificate requirement and one active certificate per calibration unit;
- one non-archived QA task per order;
- numbered, immutable inspection and certificate-version history;
- company ID on all customer-related operational records;
- foreign keys to order, line item, user and uploaded document;
- indexes for company/status/age queues and reporting periods;
- legal-hold/archive fields;
- append-only Lab/QA/certificate event triggers;
- row-level security as defence in depth.

The API must still enforce scope; RLS is not a substitute for application authorisation. Production migrations need transactional deployment, role grants, backup/restore rehearsal, retention approval and performance validation using fabricated volumes before any customer data is imported.
