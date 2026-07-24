-- Rhomberg Instruments proposed PostgreSQL schema
-- Design draft only: review naming, retention, ERP integration and privileges with IT.
-- No credentials or customer records belong in this file.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE SCHEMA IF NOT EXISTS app;

CREATE TYPE app.user_role AS ENUM (
  'customer',
  'sales_representative',
  'planning',
  'expeditor',
  'dispatch',
  'buyer',
  'manager',
  'administrator'
);

CREATE TYPE app.record_status AS ENUM ('pending', 'active', 'suspended', 'archived');
CREATE TYPE app.enquiry_status AS ENUM ('draft', 'submitted', 'assigned_to_rep', 'under_rep_review', 'quoted', 'awaiting_customer_acceptance', 'accepted', 'cancelled', 'expired', 'converted_to_order');
CREATE TYPE app.order_status AS ENUM ('awaiting_planning', 'planning_in_progress', 'planned', 'submitted_to_expediting', 'expediting_in_progress', 'awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected', 'completed', 'on_hold', 'cancelled', 'archived');
CREATE TYPE app.fulfilment_method AS ENUM ('delivery', 'collect');
CREATE TYPE app.acceptance_type AS ENUM ('purchase_order_received', 'payment_confirmed', 'written_acceptance_received', 'account_customer_authorisation', 'other');
CREATE TYPE app.document_kind AS ENUM ('purchase_order', 'quotation', 'order_acceptance_evidence', 'expediting_evidence', 'datasheet', 'certificate', 'customer_attachment', 'other');
CREATE TYPE app.scan_status AS ENUM ('pending', 'clean', 'rejected', 'failed');

CREATE TABLE app.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code text UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 200),
  legal_name text,
  status app.record_status NOT NULL DEFAULT 'pending',
  area text,
  industry text,
  phone text,
  billing_email citext,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE app.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text,
  phone text,
  service_areas text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  role app.user_role NOT NULL,
  status app.record_status NOT NULL DEFAULT 'pending',
  password_hash text,
  identity_provider text,
  external_subject text,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  CONSTRAINT users_password_or_external_identity CHECK (
    password_hash IS NOT NULL OR (identity_provider IS NOT NULL AND external_subject IS NOT NULL)
  )
);

CREATE TABLE app.permissions (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.role_permissions (
  role app.user_role NOT NULL,
  permission_code text NOT NULL REFERENCES app.permissions(code),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_code)
);

CREATE TABLE app.user_permission_overrides (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES app.permissions(code),
  is_granted boolean NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  approved_by uuid NOT NULL REFERENCES app.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY (user_id, permission_code, approved_at),
  CHECK (expires_at IS NULL OR expires_at > approved_at)
);

-- Populate app.permissions and app.role_permissions from the reviewed catalogue in
-- src/services/contracts.js during an approved migration. The Buyer role receives
-- no operational queue/action permission until its workflow is approved.

CREATE TABLE app.user_company_access (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES app.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE app.representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES app.users(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES app.branches(id),
  code text NOT NULL,
  display_name text NOT NULL,
  email citext,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, code)
);

CREATE TABLE app.representative_company_assignments (
  representative_id uuid NOT NULL REFERENCES app.representatives(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES app.users(id),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  PRIMARY KEY (representative_id, company_id, starts_at),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE app.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  short_name text,
  description text,
  image_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES app.product_categories(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  application text,
  measuring_range text,
  pressure_range text,
  accuracy text,
  case_material text,
  image_key text,
  specification_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  configuration_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Server-owned configurable Expediting catalogue. Production changes require
-- administrator approval, an audit event and a configuration-version rollout.
CREATE TABLE app.expediting_progress_steps (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 100),
  customer_label text NOT NULL CHECK (length(trim(customer_label)) BETWEEN 2 AND 100),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 500),
  display_order integer NOT NULL CHECK (display_order >= 0),
  required_for_dispatch boolean NOT NULL DEFAULT false,
  selectable_for_update boolean NOT NULL DEFAULT true,
  operational boolean NOT NULL DEFAULT false,
  terminal boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  configuration_version integer NOT NULL DEFAULT 1 CHECK (configuration_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  requester_user_id uuid NOT NULL REFERENCES app.users(id),
  representative_id uuid REFERENCES app.representatives(id),
  company_snapshot jsonb NOT NULL,
  requester_snapshot jsonb NOT NULL,
  status app.enquiry_status NOT NULL DEFAULT 'draft',
  priority text NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'urgent')),
  application text NOT NULL CHECK (length(trim(application)) >= 5),
  process_medium text,
  area text NOT NULL,
  emergency boolean NOT NULL DEFAULT false,
  fulfilment app.fulfilment_method NOT NULL,
  delivery_address text,
  collection_branch_id uuid REFERENCES app.branches(id),
  notes text,
  po_number text,
  submitted_at timestamptz,
  assigned_at timestamptz,
  review_started_at timestamptz,
  quoted_at timestamptz,
  awaiting_acceptance_at timestamptz,
  accepted_at timestamptz,
  converted_to_order_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT enquiry_delivery_details CHECK (
    (fulfilment = 'delivery' AND delivery_address IS NOT NULL AND length(trim(delivery_address)) >= 5)
    OR (fulfilment = 'collect' AND collection_branch_id IS NOT NULL)
  )
);

CREATE TABLE app.enquiry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES app.enquiries(id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number > 0),
  product_id uuid NOT NULL REFERENCES app.products(id),
  product_code_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration_schema_version integer NOT NULL DEFAULT 1,
  internal_pricing_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enquiry_id, line_number)
);

-- External Outlook quotation confirmation only. Pricing is deliberately absent.
-- The API, not a direct database client, decides which projection each role receives.
CREATE TABLE app.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL UNIQUE REFERENCES app.enquiries(id) ON DELETE CASCADE,
  quotation_number text NOT NULL CHECK (length(trim(quotation_number)) BETWEEN 1 AND 100),
  quotation_date date NOT NULL,
  expiry_mode text NOT NULL CHECK (expiry_mode IN ('dated', 'not_applicable')),
  expiry_date date,
  emailed_confirmed boolean NOT NULL DEFAULT false,
  internal_note text CHECK (internal_note IS NULL OR length(internal_note) <= 1000),
  customer_note text CHECK (customer_note IS NULL OR length(customer_note) <= 1000),
  document_reference text CHECK (document_reference IS NULL OR length(document_reference) <= 255),
  document_customer_visible boolean NOT NULL DEFAULT false,
  marked_by_user_id uuid NOT NULL REFERENCES app.users(id),
  marked_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by_user_id uuid REFERENCES app.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT quotation_expiry_rule CHECK (
    (expiry_mode = 'not_applicable' AND expiry_date IS NULL)
    OR
    (expiry_mode = 'dated' AND expiry_date IS NOT NULL AND expiry_date >= quotation_date)
  ),
  CONSTRAINT quotation_acknowledgement_pair CHECK (
    (acknowledged_by_user_id IS NULL AND acknowledged_at IS NULL)
    OR
    (acknowledged_by_user_id IS NOT NULL AND acknowledged_at IS NOT NULL)
  )
);

-- Internal evidence verified by the assigned representative before atomic
-- RFQ-to-order conversion. This table intentionally contains no pricing,
-- payment-card details, banking credentials or password fields.
CREATE TABLE app.rfq_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL UNIQUE REFERENCES app.enquiries(id) ON DELETE RESTRICT,
  acceptance_type app.acceptance_type NOT NULL,
  purchase_order_number text CHECK (purchase_order_number IS NULL OR length(trim(purchase_order_number)) BETWEEN 1 AND 100),
  payment_reference text CHECK (payment_reference IS NULL OR length(trim(payment_reference)) BETWEEN 1 AND 160),
  acceptance_date date NOT NULL,
  internal_note text NOT NULL CHECK (length(trim(internal_note)) BETWEEN 1 AND 2000),
  document_reference text CHECK (document_reference IS NULL OR length(document_reference) <= 240),
  verified_by_user_id uuid NOT NULL REFERENCES app.users(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT acceptance_conditional_reference CHECK (
    (acceptance_type <> 'purchase_order_received' OR purchase_order_number IS NOT NULL)
    AND
    (acceptance_type <> 'payment_confirmed' OR payment_reference IS NOT NULL)
  )
);

CREATE TABLE app.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid UNIQUE REFERENCES app.enquiries(id),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  representative_id uuid REFERENCES app.representatives(id),
  order_number text NOT NULL UNIQUE,
  erp_order_id text UNIQUE,
  status app.order_status NOT NULL DEFAULT 'awaiting_planning',
  source_rfq_status app.enquiry_status NOT NULL DEFAULT 'converted_to_order',
  accepted_at timestamptz NOT NULL,
  internal_job_number text,
  customer_po_number text,
  customer_po_exception_authorised boolean NOT NULL DEFAULT false,
  customer_po_exception_reason text,
  planning_notes text,
  planned_start_date date,
  estimated_completion_date date,
  assigned_planning_user_id uuid REFERENCES app.users(id),
  production_location_branch_id uuid REFERENCES app.branches(id),
  planning_priority text NOT NULL DEFAULT 'standard' CHECK (planning_priority IN ('standard', 'high', 'urgent')),
  planning_document_references text[] NOT NULL DEFAULT '{}',
  planning_submission_date date,
  fulfilment app.fulfilment_method NOT NULL,
  workflow_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  promised_date date,
  planning_started_by_user_id uuid REFERENCES app.users(id),
  planning_started_at timestamptz,
  planned_by_user_id uuid REFERENCES app.users(id),
  planned_at timestamptz,
  submitted_to_expediting_by_user_id uuid REFERENCES app.users(id),
  submitted_to_expediting_at timestamptz,
  current_expediting_step_code text REFERENCES app.expediting_progress_steps(code),
  expediting_estimated_completion_date date,
  expediting_current_delay_reason text CHECK (expediting_current_delay_reason IS NULL OR length(expediting_current_delay_reason) <= 1000),
  expediting_started_by_user_id uuid REFERENCES app.users(id),
  expediting_started_at timestamptz,
  last_expediting_updated_by_user_id uuid REFERENCES app.users(id),
  last_expediting_updated_at timestamptz,
  expediting_handoff_exception_reason text,
  expediting_handoff_authorisation_reference text,
  expediting_handoff_authorised_by_user_id uuid REFERENCES app.users(id),
  expediting_handoff_authorised_at timestamptz,
  submitted_to_dispatch_by_user_id uuid REFERENCES app.users(id),
  submitted_to_dispatch_at timestamptz,
  ready_for_collection_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  collected_at timestamptz,
  held_at timestamptz,
  resumed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT planning_po_exception_reason CHECK (
    NOT customer_po_exception_authorised
    OR (
      customer_po_number IS NULL
      AND customer_po_exception_reason IS NOT NULL
      AND length(trim(customer_po_exception_reason)) >= 8
    )
  ),
  CONSTRAINT planning_schedule_order CHECK (
    planned_start_date IS NULL
    OR estimated_completion_date IS NULL
    OR estimated_completion_date >= planned_start_date
  ),
  CONSTRAINT planning_document_reference_limit CHECK (cardinality(planning_document_references) <= 10),
  CONSTRAINT expediting_handoff_exception_pair CHECK (
    (
      expediting_handoff_exception_reason IS NULL
      AND expediting_handoff_authorisation_reference IS NULL
      AND expediting_handoff_authorised_by_user_id IS NULL
      AND expediting_handoff_authorised_at IS NULL
    )
    OR
    (
      length(trim(expediting_handoff_exception_reason)) >= 10
      AND length(trim(expediting_handoff_authorisation_reference)) >= 3
      AND expediting_handoff_authorised_by_user_id IS NOT NULL
      AND expediting_handoff_authorised_at IS NOT NULL
    )
  )
);

-- Immutable commercial/product snapshot created in the same transaction as
-- enquiries.status = 'converted_to_order'. Later catalogue changes do not
-- redefine what the customer accepted.
CREATE TABLE app.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  source_enquiry_item_id uuid NOT NULL REFERENCES app.enquiry_items(id),
  line_number integer NOT NULL CHECK (line_number > 0),
  product_id uuid NOT NULL REFERENCES app.products(id),
  product_code_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
  configuration_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration_schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, line_number),
  UNIQUE (order_id, source_enquiry_item_id)
);

-- Append-only operational updates. Customer-facing and internal text are kept
-- in separate columns so the API can enforce explicit role projections.
CREATE TABLE app.expediting_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  progress_step_code text NOT NULL REFERENCES app.expediting_progress_steps(code),
  customer_message text NOT NULL CHECK (length(trim(customer_message)) BETWEEN 5 AND 1000),
  internal_note text CHECK (internal_note IS NULL OR length(internal_note) <= 2000),
  estimated_completion_date date,
  delay_reason text CHECK (delay_reason IS NULL OR length(delay_reason) <= 1000),
  document_type text CHECK (document_type IS NULL OR document_type IN ('document', 'image', 'quality_record', 'other')),
  document_reference text CHECK (document_reference IS NULL OR length(document_reference) <= 240),
  customer_visible boolean NOT NULL DEFAULT true,
  updated_by_user_id uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expediting_document_reference_pair CHECK (
    (document_type IS NULL AND document_reference IS NULL)
    OR
    (document_type IS NOT NULL AND document_reference IS NOT NULL)
  )
);

CREATE TABLE app.workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid REFERENCES app.enquiries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES app.users(id),
  actor_role text NOT NULL CHECK (actor_role IN ('customer', 'sales_representative', 'planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator', 'system')),
  comment text,
  customer_description text NOT NULL,
  internal_description text NOT NULL,
  customer_visible boolean NOT NULL DEFAULT false,
  is_override boolean NOT NULL DEFAULT false,
  override_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_event_parent CHECK (num_nonnulls(enquiry_id, order_id) = 1),
  CONSTRAINT workflow_override_reason CHECK (NOT is_override OR (override_reason IS NOT NULL AND length(trim(override_reason)) > 0))
);

CREATE TABLE app.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  recipient_user_id uuid REFERENCES app.users(id),
  enquiry_id uuid REFERENCES app.enquiries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE,
  workflow_event_id uuid NOT NULL REFERENCES app.workflow_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email')),
  template_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  read_at timestamptz,
  CONSTRAINT notification_parent CHECK (num_nonnulls(enquiry_id, order_id) = 1)
);

CREATE TABLE app.uploaded_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  product_id uuid REFERENCES app.products(id),
  enquiry_id uuid REFERENCES app.enquiries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES app.users(id),
  kind app.document_kind NOT NULL,
  original_name text NOT NULL,
  object_key text NOT NULL UNIQUE,
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 4194304),
  sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  scan_status app.scan_status NOT NULL DEFAULT 'pending',
  customer_visible boolean NOT NULL DEFAULT false,
  customer_visibility_authorised_by uuid REFERENCES app.users(id),
  customer_visibility_authorised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT document_parent CHECK (num_nonnulls(product_id, enquiry_id, order_id) = 1),
  CONSTRAINT document_customer_visibility_authorisation CHECK (
    (NOT customer_visible AND customer_visibility_authorised_by IS NULL AND customer_visibility_authorised_at IS NULL)
    OR
    (customer_visible AND customer_visibility_authorised_by IS NOT NULL AND customer_visibility_authorised_at IS NOT NULL)
  )
);

CREATE TABLE app.enquiry_drafts (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_secret_hash text NOT NULL,
  user_agent_hash text,
  ip_prefix inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE TABLE app.idempotency_records (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, operation, idempotency_key)
);

CREATE TABLE app.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid REFERENCES app.enquiries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  recipient_reference text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT email_parent CHECK (num_nonnulls(enquiry_id, order_id) >= 1)
);

CREATE TABLE app.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid REFERENCES app.users(id),
  actor_role text NOT NULL CHECK (actor_role IN ('customer', 'sales_representative', 'planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator', 'system')),
  company_id uuid REFERENCES app.companies(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  from_status text,
  to_status text,
  comment text,
  is_override boolean NOT NULL DEFAULT false,
  request_id text,
  ip_address inet,
  user_agent_hash text,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failed', 'denied', 'idempotent_replay')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_company_access_company_idx ON app.user_company_access (company_id, user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX users_external_identity_unique ON app.users (identity_provider, external_subject) WHERE identity_provider IS NOT NULL AND external_subject IS NOT NULL;
CREATE INDEX representative_assignment_company_idx ON app.representative_company_assignments (company_id, representative_id) WHERE ends_at IS NULL;
CREATE INDEX products_category_active_idx ON app.products (category_id, is_active, code);
CREATE INDEX enquiries_company_updated_idx ON app.enquiries (company_id, updated_at DESC);
CREATE INDEX enquiries_rep_updated_idx ON app.enquiries (representative_id, updated_at DESC);
CREATE INDEX enquiries_rep_inbox_idx ON app.enquiries (representative_id, status, submitted_at, updated_at DESC);
CREATE INDEX enquiries_status_updated_idx ON app.enquiries (status, updated_at DESC);
CREATE INDEX enquiry_items_enquiry_idx ON app.enquiry_items (enquiry_id, line_number);
CREATE UNIQUE INDEX quotations_number_idx ON app.quotations (quotation_number);
CREATE INDEX quotations_acknowledgement_idx ON app.quotations (enquiry_id, acknowledged_at);
CREATE INDEX rfq_acceptances_verified_idx ON app.rfq_acceptances (verified_by_user_id, verified_at DESC);
CREATE INDEX orders_company_updated_idx ON app.orders (company_id, updated_at DESC);
CREATE INDEX orders_rep_updated_idx ON app.orders (representative_id, updated_at DESC);
CREATE INDEX orders_status_updated_idx ON app.orders (status, updated_at DESC);
CREATE INDEX orders_planning_queue_idx ON app.orders (status, planning_priority, created_at)
  WHERE status IN ('awaiting_planning', 'planning_in_progress', 'planned');
CREATE INDEX orders_planning_user_idx ON app.orders (assigned_planning_user_id, status, updated_at DESC)
  WHERE assigned_planning_user_id IS NOT NULL;
CREATE INDEX orders_expediting_queue_idx ON app.orders (
  status,
  expediting_estimated_completion_date,
  last_expediting_updated_at,
  updated_at
) WHERE status IN ('submitted_to_expediting', 'expediting_in_progress', 'awaiting_dispatch', 'on_hold');
CREATE INDEX order_items_order_idx ON app.order_items (order_id, line_number);
CREATE INDEX expediting_progress_steps_active_idx ON app.expediting_progress_steps (is_active, display_order);
CREATE INDEX expediting_updates_order_time_idx ON app.expediting_updates (order_id, created_at);
CREATE INDEX expediting_updates_step_time_idx ON app.expediting_updates (progress_step_code, created_at);
CREATE INDEX workflow_events_enquiry_idx ON app.workflow_events (enquiry_id, created_at);
CREATE INDEX workflow_events_order_idx ON app.workflow_events (order_id, created_at);
CREATE INDEX notifications_recipient_unread_idx ON app.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_company_idx ON app.notifications (company_id, created_at DESC);
CREATE INDEX documents_company_idx ON app.uploaded_documents (company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX email_outbox_work_idx ON app.email_outbox (status, next_attempt_at) WHERE status IN ('pending', 'failed');
CREATE INDEX audit_events_actor_time_idx ON app.audit_events (actor_user_id, created_at DESC);
CREATE INDEX audit_events_entity_idx ON app.audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX user_permission_overrides_active_idx ON app.user_permission_overrides (user_id, permission_code)
  WHERE revoked_at IS NULL;

-- POST /enquiries must use one transaction to allocate the permanent reference,
-- insert the enquiry/items/document metadata, append submission and assignment
-- workflow/audit events, enqueue the assigned-representative notification and
-- clear the submitting user's draft. File bytes move separately to encrypted
-- object storage and are unavailable until malware scanning succeeds.

-- mark_quoted must also be one transaction: lock the assigned under-review RFQ,
-- validate the representative and record version, insert the quotation metadata,
-- update the RFQ to quoted, append workflow/audit events, enqueue distinct customer
-- and representative notifications, and link any scanned quotation document
-- metadata. acknowledge_quotation must lock the quoted RFQ, verify the customer's
-- authorised company, record the acknowledgement, update the state, append audit/
-- workflow events and notify the assigned representative. Neither transaction
-- stores pricing or creates an order.

-- accept_order must be one transaction: lock the awaiting-customer-acceptance
-- RFQ, verify the assigned actor and row version, insert rfq_acceptances, allocate
-- the permanent order number, insert orders/order_items, link and convert the RFQ,
-- append accepted/converted/order-created workflow and audit events, and enqueue
-- customer/representative/Planning notifications. orders.enquiry_id UNIQUE is the
-- final duplicate-conversion guard. An idempotent replay returns that existing
-- order. Supporting files are private uploaded_documents rows with the enquiry
-- parent and kind = order_acceptance_evidence.

-- Every Expediting action must also be one transaction: lock the authorised
-- order, verify its current state/expected row version and the active progress
-- configuration, insert expediting_updates, update the order summary fields,
-- append workflow/audit events and enqueue independent recipient notifications.
-- Dispatch hand-off additionally verifies the required step set or records the
-- authorised exception fields. The API derives actors/recipients from server
-- records and never trusts browser-supplied identity, company or target status.

-- The API starts every transaction by setting these from a verified server session:
-- SET LOCAL app.user_id = '<verified uuid>';
-- SET LOCAL app.user_role = '<verified role>';
-- The browser must never be allowed to set database session variables directly.

CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app.current_user_role() RETURNS app.user_role
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.user_role', true), '')::app.user_role $$;

CREATE FUNCTION app.current_user_has_permission(target_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT permission_override.is_granted
      FROM app.user_permission_overrides permission_override
      WHERE permission_override.user_id = app.current_user_id()
        AND permission_override.permission_code = target_permission
        AND permission_override.revoked_at IS NULL
        AND (permission_override.expires_at IS NULL OR permission_override.expires_at > now())
      ORDER BY permission_override.approved_at DESC
      LIMIT 1
    ),
    EXISTS (
      SELECT 1
      FROM app.role_permissions role_permission
      WHERE role_permission.role = app.current_user_role()
        AND role_permission.permission_code = target_permission
    ),
    false
  )
$$;

CREATE FUNCTION app.current_representative_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT representative.id
  FROM app.representatives representative
  WHERE representative.user_id = app.current_user_id()
    AND representative.is_active
  LIMIT 1
$$;

CREATE FUNCTION app.can_access_company(target_company_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT CASE
    WHEN app.current_user_has_permission('view_all_companies') THEN true
    WHEN app.current_user_has_permission('view_own_company_account') THEN EXISTS (
      SELECT 1 FROM app.user_company_access access
      WHERE access.user_id = app.current_user_id()
        AND access.company_id = target_company_id
        AND access.revoked_at IS NULL
    )
    WHEN app.current_user_has_permission('view_assigned_rfqs')
      OR app.current_user_has_permission('view_assigned_orders') THEN EXISTS (
      SELECT 1
      FROM app.representative_company_assignments assignment
      WHERE assignment.representative_id = app.current_representative_id()
        AND assignment.company_id = target_company_id
        AND assignment.starts_at <= now()
        AND (assignment.ends_at IS NULL OR assignment.ends_at > now())
    )
    ELSE false
  END
$$;

CREATE FUNCTION app.can_access_enquiry(target_enquiry_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.enquiries enquiry
    WHERE enquiry.id = target_enquiry_id
      AND (
        app.current_user_has_permission('view_all_rfqs')
        OR (
          app.current_user_has_permission('view_own_company_rfqs')
          AND app.can_access_company(enquiry.company_id)
        )
        OR (
          app.current_user_has_permission('view_assigned_rfqs')
          AND enquiry.representative_id = app.current_representative_id()
        )
      )
  )
$$;

CREATE FUNCTION app.can_access_order(target_order_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.orders customer_order
    WHERE customer_order.id = target_order_id
      AND (
        app.current_user_has_permission('view_all_orders')
        OR (
          app.current_user_has_permission('view_own_company_orders')
          AND app.can_access_company(customer_order.company_id)
        )
        OR (
          app.current_user_has_permission('view_assigned_orders')
          AND customer_order.representative_id = app.current_representative_id()
        )
        OR (
          app.current_user_has_permission('view_planning_queue')
          AND (
            customer_order.status IN ('awaiting_planning', 'planning_in_progress', 'planned')
            OR (
              customer_order.status = 'on_hold'
              AND customer_order.workflow_context ->> 'resumeStatus' IN ('awaiting_planning', 'planning_in_progress', 'planned')
            )
          )
        )
        OR (
          app.current_user_has_permission('view_expediting_queue')
          AND (
            customer_order.status IN ('submitted_to_expediting', 'expediting_in_progress', 'awaiting_dispatch')
            OR (
              customer_order.status = 'on_hold'
              AND customer_order.workflow_context ->> 'resumeStatus' IN ('submitted_to_expediting', 'expediting_in_progress')
            )
          )
        )
        OR (
          app.current_user_has_permission('view_dispatch_queue')
          AND (
            customer_order.status IN ('awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected')
            OR (
              customer_order.status = 'on_hold'
              AND customer_order.workflow_context ->> 'resumeStatus' IN ('awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected')
            )
          )
        )
      )
  )
$$;

ALTER TABLE app.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.rfq_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.expediting_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_authorised_scope ON app.companies
  USING (app.can_access_company(id));

CREATE POLICY enquiries_authorised_scope ON app.enquiries
  USING (app.can_access_enquiry(id))
  WITH CHECK (app.can_access_company(company_id));

CREATE POLICY enquiry_items_authorised_scope ON app.enquiry_items
  USING (EXISTS (
    SELECT 1 FROM app.enquiries enquiry
    WHERE enquiry.id = enquiry_id AND app.can_access_enquiry(enquiry.id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.enquiries enquiry
    WHERE enquiry.id = enquiry_id AND app.can_access_enquiry(enquiry.id)
  ));

CREATE POLICY quotations_authorised_scope ON app.quotations
  USING (app.can_access_enquiry(enquiry_id))
  WITH CHECK (app.can_access_enquiry(enquiry_id));

CREATE POLICY rfq_acceptances_internal_scope ON app.rfq_acceptances
  USING (
    app.current_user_role() IN ('sales_representative', 'manager', 'administrator')
    AND app.can_access_enquiry(enquiry_id)
  )
  WITH CHECK (
    app.current_user_role() IN ('sales_representative', 'manager', 'administrator')
    AND app.can_access_enquiry(enquiry_id)
  );

CREATE POLICY enquiry_drafts_authorised_scope ON app.enquiry_drafts
  USING (user_id = app.current_user_id() AND app.can_access_company(company_id))
  WITH CHECK (user_id = app.current_user_id() AND app.can_access_company(company_id));

CREATE POLICY orders_authorised_scope ON app.orders
  USING (app.can_access_order(id))
  WITH CHECK (app.can_access_order(id));

CREATE POLICY order_items_authorised_scope ON app.order_items
  USING (EXISTS (
    SELECT 1 FROM app.orders customer_order
    WHERE customer_order.id = order_id AND app.can_access_order(customer_order.id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.orders customer_order
    WHERE customer_order.id = order_id AND app.can_access_order(customer_order.id)
  ));

CREATE POLICY expediting_updates_authorised_scope ON app.expediting_updates
  USING (
    app.current_user_role() <> 'customer'
    AND app.can_access_order(order_id)
  )
  WITH CHECK (
    (
      app.current_user_has_permission('update_order_progress')
      OR app.current_user_has_permission('move_to_dispatch')
      OR app.current_user_has_permission('manage_order_hold')
    )
    AND app.can_access_order(order_id)
  );

CREATE POLICY workflow_events_authorised_scope ON app.workflow_events
  USING (
    (
      (enquiry_id IS NOT NULL AND app.can_access_enquiry(enquiry_id))
      OR
      (order_id IS NOT NULL AND app.can_access_order(order_id))
    )
    AND (
      app.current_user_role() <> 'customer'
      OR customer_visible
    )
  );

CREATE POLICY notifications_authorised_scope ON app.notifications
  USING (
    recipient_user_id = app.current_user_id()
    OR app.current_user_has_permission('view_all_orders')
    OR app.current_user_has_permission('view_all_rfqs')
    OR (
      recipient_user_id IS NULL
      AND app.current_user_has_permission('view_own_company_orders')
      AND app.can_access_company(company_id)
    )
    OR (
      recipient_user_id IS NULL
      AND app.current_user_has_permission('view_own_company_rfqs')
      AND app.can_access_company(company_id)
    )
  );

CREATE POLICY documents_authorised_scope ON app.uploaded_documents
  USING (
    deleted_at IS NULL
    AND (
      (product_id IS NOT NULL AND app.current_user_has_permission('read_catalogue'))
      OR (
        enquiry_id IS NOT NULL
        AND app.can_access_enquiry(enquiry_id)
        AND (
          app.current_user_role() <> 'customer'
          OR customer_visible
        )
      )
      OR (
        order_id IS NOT NULL
        AND app.can_access_order(order_id)
        AND (
          app.current_user_role() <> 'customer'
          OR customer_visible
        )
      )
    )
  )
  WITH CHECK (
    (enquiry_id IS NOT NULL AND app.can_access_enquiry(enquiry_id))
    OR (order_id IS NOT NULL AND app.can_access_order(order_id))
    OR app.current_user_has_permission('manage_products')
  );

-- RLS limits row scope; database grants must separately limit operations by the API role.
-- In particular, customers must not receive UPDATE/DELETE rights on workflow events,
-- quotations, pricing snapshots, representative assignments, users, products or
-- audit events. The API must return a customer quotation projection that omits
-- internal_note, marked_by_user_id and unauthorised document/reference fields;
-- it must likewise project expediting_updates without internal_note, delay_reason,
-- document metadata, internal actor IDs or hand-off exception fields. Row-level
-- security does not provide column-level redaction.

COMMIT;
