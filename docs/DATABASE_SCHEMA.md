# Phase 21 database schema guide

The reusable employee model adds `internal_staff_profiles`, `departments`, `user_branch_assignments`, `user_department_assignments`, `authentication_methods`, `account_activation_tokens`, `password_reset_requests`, `user_preferences`, `user_profile_images`, `account_status_history` and immutable `user_audit_events`. Existing `users`, `branches`, `roles`, `permissions`, `user_roles` and `role_permissions` remain the identity and authorisation core. Email is nullable only when an approved username exists. Real staff seed records are private import data and do not belong in this tracked schema or a public static artifact.

The secure Administrator extension adds usernames and branch assignments to identities, customer-company branch assignment, short-lived step-up verification sessions, generic administrative change evidence, explicit previous/new audit values and append-only approved RFQ/order correction rows. See [ADMINISTRATOR_MANAGEMENT.md](ADMINISTRATOR_MANAGEMENT.md).

The executable design proposal is [database/postgresql-schema.sql](database/postgresql-schema.sql). It is not connected to the preview and must be reviewed/migrated by IT.

Phase 21 adds `order_routing`, `lab_tasks`, `calibration_units`, `certificate_requirements`, `certificates`, `certificate_versions`, `lab_events`, `lab_monthly_metrics`, `qa_tasks`, `qa_inspections`, `qa_failures`, `qa_rework_cycles`, `qa_events`, `qa_monthly_metrics`, `department_receipts`, `verification_codes`, `credential_change_requests`, `product_statistics`, `representative_statistics` and `operational_metrics`.

The representative-loaded-order extension adds `order_origin` and `order_source` enums; nullable RFQ linkage for direct orders; source/reference/confirmation/duplicate/idempotency fields on `orders`; version controls on `uploaded_documents`; and the one-to-one `representative_loaded_orders` origin record. An RFQ-derived order requires its converted RFQ. A representative-loaded order requires no RFQ but does require its creating Representative, approved source, quotation/PO numbers, current quotation/PO document IDs and confirmation object.

Customer RFQs retain an internal `internal_priority` default controlled by the server, but expose no customer urgency input. The customer may not set or update that column. Internal queue roles continue to use approved priority controls.

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
- partial unique idempotency and current source-document indexes;
- company/reference/time indexes for duplicate detection;
- RLS on `representative_loaded_orders`, with customer access occurring only through the safe order/document projections.

The API must still enforce scope; RLS is not a substitute for application authorisation. Production migrations need transactional deployment, role grants, backup/restore rehearsal, retention approval and performance validation using fabricated volumes before any customer data is imported.

The Laboratory calibration extension adds versioned `lab_methods`, branch-controlled `lab_reference_standards`, immutable `lab_worksheet_revisions`, derived `lab_calculation_versions`, standard-usage snapshots, certificate reviews, signed-document versions and physical-unit releases. Raw input, derived output and signed files are deliberately separate. Production object storage keeps files; PostgreSQL keeps their metadata and SHA-256 digest. Server transactions must allocate job/certificate references and enforce branch, assignment, one-unit/one-certificate and release rules.

## Phase 1 implemented migration

`apps/api/migrations/001_phase1_vertical_slice.sql` is the reviewed minimum implementation extracted from the broader proposal. It creates only the entities required to prove authentication, company/role resolution, RFQ creation/retrieval, document metadata, audit events, notifications and idempotency. `002_protected_request_context.sql` adds a database-protected, active-session-derived transaction context so runtime callers cannot establish company scope by supplying arbitrary custom settings. The migrations enable PostgreSQL row-level security on company-scoped records and retain explicit application-layer predicates as defence in depth. Real PostgreSQL 17.10 results and the tested least-privilege grant model are recorded in `PHASE1B_POSTGRESQL_VALIDATION.md`.

The broad design SQL in `docs/database/postgresql-schema.sql` remains a proposal and is not executed automatically. Later migrations must reconcile the Phase 1 tables with the full workflow deliberately; they must not replace the implemented migration by running the draft wholesale.

## Technical Support additions

The proposal adds company-scoped requests, assignments, append-only messages, attachment links, immutable status events, customer information requests, quotation due-date adjustments, reasoned overrides and reporting snapshots. RFQ/company foreign keys are mandatory. `customer_visible` and `internal_only` are server-controlled. RLS combines company scope with Representative/Technical assignment and named wider permissions. Messages, statuses, adjustments, overrides and document access remain auditable and append-only.
# Client visit and location extension

The proposed backend adds `client_visit_requirements`, `client_appointments`, `client_visits`, `visit_verification_events`, `visit_geofence_checks`, `visit_customer_confirmations`, `visit_qr_tokens`, `representative_location_events`, `representative_workday_summaries`, `office_locations`, `customer_locations`, `working_hour_policies`, `visit_compliance_metrics` and `missed_visit_events`. Verification/audit rows are append-only. Location retention is configurable; routine location events outside approved working hours are rejected server-side.
# Laboratory launch schema amendment

The launch schema uses `lab_certificate_tasks`, `calibration_units`, `certificate_recipient_snapshots`, `certificates`, `certificate_versions`, `certificate_upload_events` and `certificate_download_events`. All records carry company scope; unit recipients are immutable snapshots; current certificate version is explicit; versions and events are append-only. Historical technician worksheet tables remain future/inactive and are not required for launch deployment.

## Implemented completion migrations 004–012

The executable migration chain now extends the Phase 1 baseline with:

- `004_internal_test_operational_foundation.sql`: settings, RFQ drafts, operational orders/events, notifications and policies;
- `005_approved_product_catalogue.sql`: the approved non-priced product catalogue;
- `006_account_directory_fields.sql`: account/company/Representative directory fields;
- `007_simplified_laboratory_access.sql`: the approved Laboratory Manager certificate access/versioning model;
- `008_administration_lifecycle.sql`: account status, permission override, profile-image and security-definer lifecycle operations;
- `009_document_and_governance_fields.sql`: document versioning, archive/legal-hold/retention and delivery metadata;
- `010_client_visits.sql`: company-scoped appointments and visit verification;
- `011_workspace_and_record_controls.sql`: selected workspace and audited catalogue overrides.
- `012_administration_directory_scope.sql`: qualified user-directory RLS correlations and the explicit `administer_users` scope required for authorised account administration.

`phase1-runtime-grants.sql` grants only the application operations required by this chain. Real PostgreSQL 17 validation must apply migrations as the migration identity and execute the API as the restricted runtime identity; RLS remains defence in depth and never replaces server-side authorization.

### PostgreSQL client-serialization audit

The PostgreSQL repository was audited for `Promise.all`, `Promise.allSettled`, parallel array mapping and equivalent patterns around checked-out clients. All statements inside one `inTransaction` callback are sequential. The three service-layer `Promise.all` calls operate through independent repository methods, each of which checks out its own pool connection, so those independent operations remain safely parallel. A serial-only client regression test fails immediately if a repository method again attempts concurrent queries on one transaction client.
