-- Rhomberg Instruments proposed PostgreSQL schema
-- Production specification. Design draft only: review naming,
-- retention, ERP integration and privileges with IT before migration.
-- No credentials or customer records belong in this file.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE SCHEMA IF NOT EXISTS app;

CREATE TYPE app.user_role AS ENUM (
  'customer',
  'sales_representative',
  'sales_manager',
  'company_owner',
  'planning',
  'expeditor',
  'laboratory_user',
  'laboratory_manager',
  'quality_assurance',
  'quality_manager',
  'dispatch',
  'buyer',
  'manager',
  'administrator'
);

CREATE TYPE app.record_status AS ENUM ('pending', 'active', 'suspended', 'archived');
CREATE TYPE app.enquiry_status AS ENUM ('draft', 'submitted', 'assigned_to_rep', 'under_rep_review', 'quoted', 'awaiting_customer_acceptance', 'accepted', 'cancelled', 'expired', 'converted_to_order');
CREATE TYPE app.order_status AS ENUM (
  'awaiting_planning', 'planning_in_progress', 'planned',
  'submitted_to_lab', 'lab_received', 'calibration_in_progress',
  'calibration_on_hold', 'calibration_completed', 'awaiting_lab_release',
  'released_from_lab', 'awaiting_lab_receipt_expediting',
  'awaiting_lab_receipt_dispatch', 'certificate_pending',
  'submitted_to_expediting', 'expediting_in_progress',
  'awaiting_qa', 'qa_in_progress', 'qa_failed',
  'returned_to_production', 'returned_to_expediting',
  'qa_reinspection_required', 'qa_passed',
  'awaiting_dispatch', 'ready_for_collection', 'out_for_delivery',
  'delivered', 'collected', 'completed', 'on_hold', 'cancelled',
  'archived'
);
CREATE TYPE app.certificate_type AS ENUM ('sanas', 'traceable');
CREATE TYPE app.certificate_status AS ENUM ('required', 'pending', 'in_preparation', 'ready_for_upload', 'uploaded', 'correction_required', 'archived');
CREATE TYPE app.lab_unit_status AS ENUM ('awaiting_receipt', 'lab_received', 'calibration_in_progress', 'calibration_on_hold', 'calibration_completed', 'awaiting_lab_release', 'released_from_lab', 'lab_archived');
CREATE TYPE app.qa_task_status AS ENUM ('awaiting_qa', 'qa_in_progress', 'qa_failed', 'returned_to_production', 'returned_to_expediting', 'qa_reinspection_required', 'qa_passed', 'handed_to_dispatch');
CREATE TYPE app.qa_result AS ENUM ('passed', 'failed');
CREATE TYPE app.auth_realm AS ENUM ('customer', 'internal');
CREATE TYPE app.fulfilment_method AS ENUM ('delivery', 'collect');
CREATE TYPE app.order_origin AS ENUM ('customer_submitted_rfq_order', 'representative_loaded_order');
CREATE TYPE app.order_source AS ENUM ('email', 'telephone', 'in_person', 'existing_quotation', 'other_approved_source');
CREATE TYPE app.dispatch_method AS ENUM ('collection', 'company_delivery', 'courier', 'third_party_delivery');
CREATE TYPE app.dispatch_proof_type AS ENUM ('signed_delivery_note', 'collection_confirmation', 'courier_confirmation', 'photograph', 'other');
CREATE TYPE app.acceptance_type AS ENUM ('purchase_order_received', 'payment_confirmed', 'written_acceptance_received', 'account_customer_authorisation', 'other');
CREATE TYPE app.document_kind AS ENUM ('purchase_order', 'quotation', 'order_acceptance_evidence', 'expediting_evidence', 'dispatch_proof', 'order_summary_customer', 'order_summary_internal', 'datasheet', 'certificate', 'customer_attachment', 'other');
CREATE TYPE app.scan_status AS ENUM ('pending', 'clean', 'rejected', 'failed');
CREATE TYPE app.notification_channel AS ENUM ('in_app', 'email', 'push');
CREATE TYPE app.notification_delivery_status AS ENUM (
  'in_app',
  'email_pending',
  'email_sent',
  'email_failed',
  'push_pending',
  'push_sent',
  'push_failed'
);

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

ALTER TABLE app.companies
  ADD COLUMN branch_id uuid REFERENCES app.branches(id);

CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext UNIQUE,
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  phone text,
  branch_id uuid REFERENCES app.branches(id),
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
  deleted_at timestamptz,
  CONSTRAINT users_password_or_external_identity CHECK (
    password_hash IS NOT NULL OR (identity_provider IS NOT NULL AND external_subject IS NOT NULL)
  )
);

CREATE TABLE app.administration_step_up_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('password', 'totp', 'webauthn', 'identity_provider_mfa')),
  purpose text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  request_id text NOT NULL,
  CHECK (expires_at > verified_at)
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
  membership_role text NOT NULL DEFAULT 'member'
    CHECK (membership_role IN ('member', 'company_administrator')),
  is_primary boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES app.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  deleted_at timestamptz,
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
  deleted_at timestamptz,
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
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
  internal_priority text NOT NULL DEFAULT 'standard' CHECK (internal_priority IN ('standard', 'high', 'urgent')),
  application text NOT NULL CHECK (length(trim(application)) >= 5),
  process_medium text,
  area text NOT NULL,
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

CREATE TABLE app.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL,
  archive_completed_orders_after_days integer NOT NULL CHECK (archive_completed_orders_after_days BETWEEN 1 AND 3650),
  retain_archived_orders_for_days integer NOT NULL CHECK (retain_archived_orders_for_days BETWEEN 1 AND 36500),
  allow_permanent_deletion boolean NOT NULL DEFAULT false,
  deletion_requires_manager_approval boolean NOT NULL DEFAULT true,
  deletion_requires_administrator_approval boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  approved_by_business_user_id uuid REFERENCES app.users(id),
  approved_by_it_user_id uuid REFERENCES app.users(id),
  approved_at timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

CREATE TABLE app.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid UNIQUE REFERENCES app.enquiries(id),
  order_origin app.order_origin NOT NULL DEFAULT 'customer_submitted_rfq_order',
  order_source app.order_source,
  order_source_explanation text CHECK (order_source_explanation IS NULL OR length(trim(order_source_explanation)) BETWEEN 5 AND 500),
  created_by_representative boolean NOT NULL DEFAULT false,
  created_by_representative_user_id uuid REFERENCES app.users(id),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  representative_id uuid REFERENCES app.representatives(id),
  order_number text NOT NULL UNIQUE,
  erp_order_id text UNIQUE,
  status app.order_status NOT NULL DEFAULT 'awaiting_planning',
  source_rfq_status app.enquiry_status,
  accepted_at timestamptz NOT NULL,
  internal_job_number text,
  customer_po_number text,
  quotation_number text,
  purchase_order_number text,
  source_confirmation jsonb,
  duplicate_check_result jsonb,
  source_submission_key text,
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
  archive_eligible_at timestamptz,
  archive_reason text,
  archived_by_user_id uuid REFERENCES app.users(id),
  retention_policy_id uuid REFERENCES app.retention_policies(id),
  legal_hold_active boolean NOT NULL DEFAULT false,
  legal_hold_reason text,
  legal_hold_placed_at timestamptz,
  legal_hold_placed_by_user_id uuid REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT order_origin_requirements CHECK (
    (
      order_origin = 'customer_submitted_rfq_order'
      AND enquiry_id IS NOT NULL
      AND created_by_representative = false
      AND created_by_representative_user_id IS NULL
      AND order_source IS NULL
      AND source_rfq_status = 'converted_to_order'
    )
    OR
    (
      order_origin = 'representative_loaded_order'
      AND enquiry_id IS NULL
      AND created_by_representative = true
      AND created_by_representative_user_id IS NOT NULL
      AND order_source IS NOT NULL
      AND source_rfq_status IS NULL
      AND quotation_number IS NOT NULL
      AND purchase_order_number IS NOT NULL
      AND source_confirmation IS NOT NULL
      AND jsonb_typeof(source_confirmation) = 'object'
      AND source_confirmation ->> 'confirmed' = 'true'
    )
  ),
  CONSTRAINT representative_other_source_explanation CHECK (
    order_source <> 'other_approved_source'
    OR order_source_explanation IS NOT NULL
  ),
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
  source_enquiry_item_id uuid REFERENCES app.enquiry_items(id),
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
  previous_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
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
  recipient_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  representative_id uuid REFERENCES app.representatives(id),
  enquiry_id uuid REFERENCES app.enquiries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE,
  workflow_event_id uuid REFERENCES app.workflow_events(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'rfq_submitted', 'rfq_assigned', 'rfq_under_review', 'rfq_quoted',
    'customer_acknowledgement', 'order_accepted', 'order_created',
    'order_sent_to_planning', 'order_sent_to_expediting',
    'customer_progress_update', 'order_delayed', 'order_on_hold',
    'order_resumed', 'order_sent_to_dispatch', 'ready_for_collection',
    'out_for_delivery', 'delivery_problem_reported', 'delivered', 'collected', 'completed',
    'order_cancelled', 'rfq_cancelled', 'rfq_expired', 'workflow_override'
  )),
  category text NOT NULL CHECK (category IN (
    'rfqUpdates', 'quotationNotifications', 'orderProgress',
    'delayNotifications', 'fulfilmentNotifications', 'accountSecurity',
    'maintenanceNotices', 'companyAnnouncements'
  )),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  template_key text NOT NULL,
  link_target jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_visible boolean NOT NULL DEFAULT false,
  source_action text,
  created_by_user_id uuid REFERENCES app.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT notification_parent CHECK (num_nonnulls(enquiry_id, order_id) = 1),
  CHECK (jsonb_typeof(link_target) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE app.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES app.notifications(id) ON DELETE CASCADE,
  channel app.notification_channel NOT NULL,
  status app.notification_delivery_status NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  provider_message_reference text,
  last_error_code text,
  last_error_message text,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel),
  CHECK (
    (channel = 'in_app' AND status = 'in_app')
    OR (channel = 'email' AND status IN ('email_pending', 'email_sent', 'email_failed'))
    OR (channel = 'push' AND status IN ('push_pending', 'push_sent', 'push_failed'))
  )
);

CREATE TABLE app.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  in_app_enabled boolean NOT NULL DEFAULT true CHECK (in_app_enabled),
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  category_preferences jsonb NOT NULL DEFAULT '{
    "rfqUpdates": true,
    "quotationNotifications": true,
    "orderProgress": true,
    "delayNotifications": true,
    "fulfilmentNotifications": true,
    "accountSecurity": true,
    "maintenanceNotices": true,
    "companyAnnouncements": true
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(category_preferences) = 'object'),
  CHECK (category_preferences ->> 'accountSecurity' = 'true'),
  CHECK (category_preferences ->> 'maintenanceNotices' = 'true')
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
  parent_document_id uuid REFERENCES app.uploaded_documents(id),
  version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0),
  is_current_version boolean NOT NULL DEFAULT true,
  replacement_reason text CHECK (replacement_reason IS NULL OR length(trim(replacement_reason)) BETWEEN 8 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT document_parent CHECK (num_nonnulls(product_id, enquiry_id, order_id) = 1),
  CONSTRAINT document_customer_visibility_authorisation CHECK (
    (NOT customer_visible AND customer_visibility_authorised_by IS NULL AND customer_visibility_authorised_at IS NULL)
    OR
    (customer_visible AND customer_visibility_authorised_by IS NOT NULL AND customer_visibility_authorised_at IS NOT NULL)
  )
);

ALTER TABLE app.orders
  ADD COLUMN quotation_document_id uuid REFERENCES app.uploaded_documents(id),
  ADD COLUMN purchase_order_document_id uuid REFERENCES app.uploaded_documents(id),
  ADD CONSTRAINT representative_source_documents_required CHECK (
    order_origin <> 'representative_loaded_order'
    OR (quotation_document_id IS NOT NULL AND purchase_order_document_id IS NOT NULL)
  );

CREATE TABLE app.representative_loaded_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES app.orders(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  customer_contact_user_id uuid NOT NULL REFERENCES app.users(id),
  branch_id uuid NOT NULL REFERENCES app.branches(id),
  representative_id uuid NOT NULL REFERENCES app.representatives(id),
  created_by_representative_user_id uuid NOT NULL REFERENCES app.users(id),
  order_source app.order_source NOT NULL,
  order_source_explanation text,
  quotation_number text NOT NULL CHECK (length(trim(quotation_number)) BETWEEN 1 AND 100),
  quotation_date date NOT NULL,
  quotation_revision text CHECK (quotation_revision IS NULL OR length(quotation_revision) <= 60),
  quotation_document_id uuid NOT NULL REFERENCES app.uploaded_documents(id),
  purchase_order_number text NOT NULL CHECK (length(trim(purchase_order_number)) BETWEEN 1 AND 100),
  purchase_order_date date NOT NULL,
  purchase_order_document_id uuid NOT NULL REFERENCES app.uploaded_documents(id),
  source_confirmation jsonb NOT NULL CHECK (jsonb_typeof(source_confirmation) = 'object' AND source_confirmation ->> 'confirmed' = 'true'),
  duplicate_check_result jsonb NOT NULL CHECK (jsonb_typeof(duplicate_check_result) = 'object'),
  idempotency_key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT representative_loaded_order_source_explanation CHECK (
    order_source <> 'other_approved_source'
    OR (order_source_explanation IS NOT NULL AND length(trim(order_source_explanation)) >= 5)
  )
);

-- Current Dispatch summary plus append-only updates. Internal and customer text
-- remain separate so API projections cannot accidentally reuse internal notes.
CREATE TABLE app.order_dispatch_records (
  order_id uuid PRIMARY KEY REFERENCES app.orders(id) ON DELETE CASCADE,
  method app.dispatch_method,
  ready_date date,
  collection_date date,
  delivery_date date,
  courier_or_driver text CHECK (courier_or_driver IS NULL OR length(courier_or_driver) <= 160),
  tracking_reference text CHECK (tracking_reference IS NULL OR length(tracking_reference) <= 160),
  number_of_packages integer CHECK (number_of_packages BETWEEN 1 AND 999),
  delivery_note_number text CHECK (delivery_note_number IS NULL OR length(delivery_note_number) <= 160),
  recipient_name text CHECK (recipient_name IS NULL OR length(recipient_name) <= 160),
  proof_document_id uuid REFERENCES app.uploaded_documents(id),
  proof_type app.dispatch_proof_type,
  proof_reference text CHECK (proof_reference IS NULL OR length(proof_reference) <= 240),
  current_problem_reason text CHECK (current_problem_reason IS NULL OR length(current_problem_reason) <= 1000),
  customer_message text CHECK (customer_message IS NULL OR length(customer_message) <= 1000),
  internal_notes text CHECK (internal_notes IS NULL OR length(internal_notes) <= 2000),
  received_at timestamptz NOT NULL,
  last_updated_by_user_id uuid REFERENCES app.users(id),
  last_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_summary_date_order CHECK (
    (collection_date IS NULL OR ready_date IS NULL OR collection_date >= ready_date)
    AND
    (delivery_date IS NULL OR ready_date IS NULL OR delivery_date >= ready_date)
  ),
  CONSTRAINT dispatch_summary_proof_pair CHECK (
    (proof_type IS NULL AND proof_reference IS NULL AND proof_document_id IS NULL)
    OR
    (proof_type IS NOT NULL AND (proof_reference IS NOT NULL OR proof_document_id IS NOT NULL))
  )
);

CREATE TABLE app.order_dispatch_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.order_dispatch_records(order_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'mark_ready_for_collection', 'start_delivery', 'confirm_collection',
    'confirm_delivery', 'complete_collection', 'complete_delivery',
    'report_delivery_problem'
  )),
  method app.dispatch_method NOT NULL,
  ready_date date,
  collection_date date,
  delivery_date date,
  courier_or_driver text CHECK (courier_or_driver IS NULL OR length(courier_or_driver) <= 160),
  tracking_reference text CHECK (tracking_reference IS NULL OR length(tracking_reference) <= 160),
  number_of_packages integer CHECK (number_of_packages BETWEEN 1 AND 999),
  delivery_note_number text CHECK (delivery_note_number IS NULL OR length(delivery_note_number) <= 160),
  recipient_name text CHECK (recipient_name IS NULL OR length(recipient_name) <= 160),
  proof_document_id uuid REFERENCES app.uploaded_documents(id),
  proof_type app.dispatch_proof_type,
  proof_reference text CHECK (proof_reference IS NULL OR length(proof_reference) <= 240),
  problem_reason text CHECK (problem_reason IS NULL OR length(problem_reason) <= 1000),
  customer_message text NOT NULL CHECK (length(trim(customer_message)) BETWEEN 5 AND 1000),
  internal_notes text CHECK (internal_notes IS NULL OR length(internal_notes) <= 2000),
  customer_visible boolean NOT NULL DEFAULT true,
  updated_by_user_id uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_update_date_order CHECK (
    (collection_date IS NULL OR ready_date IS NULL OR collection_date >= ready_date)
    AND
    (delivery_date IS NULL OR ready_date IS NULL OR delivery_date >= ready_date)
  ),
  CONSTRAINT dispatch_update_proof_pair CHECK (
    (proof_type IS NULL AND proof_reference IS NULL AND proof_document_id IS NULL)
    OR
    (proof_type IS NOT NULL AND (proof_reference IS NOT NULL OR proof_document_id IS NOT NULL))
  )
);

CREATE TABLE app.customer_personalisations (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  setup_completed boolean NOT NULL DEFAULT false,
  theme_preset text NOT NULL DEFAULT 'rhomberg-default'
    CHECK (theme_preset IN ('rhomberg-default', 'industrial-professional', 'modern', 'funky', 'dark', 'high-contrast', 'custom')),
  custom_colours jsonb NOT NULL DEFAULT '{}'::jsonb,
  font_size text NOT NULL DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'extra-large')),
  display_density text NOT NULL DEFAULT 'standard' CHECK (display_density IN ('comfortable', 'standard', 'compact')),
  appearance_mode text NOT NULL DEFAULT 'system' CHECK (appearance_mode IN ('light', 'dark', 'system')),
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_image_id uuid,
  company_logo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(custom_colours) = 'object'),
  CHECK (jsonb_typeof(notification_preferences) = 'object')
);

CREATE TABLE app.customer_identity_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('profileImage', 'companyLogo')),
  original_name text NOT NULL,
  object_key text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 1048576),
  sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  scan_status app.scan_status NOT NULL DEFAULT 'pending',
  position_x smallint NOT NULL DEFAULT 50 CHECK (position_x BETWEEN 0 AND 100),
  position_y smallint NOT NULL DEFAULT 50 CHECK (position_y BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE app.customer_personalisations
  ADD CONSTRAINT customer_personalisation_profile_image_fk
  FOREIGN KEY (profile_image_id) REFERENCES app.customer_identity_images(id);
ALTER TABLE app.customer_personalisations
  ADD CONSTRAINT customer_personalisation_company_logo_fk
  FOREIGN KEY (company_logo_id) REFERENCES app.customer_identity_images(id);

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
  document_id uuid REFERENCES app.uploaded_documents(id),
  template_key text NOT NULL,
  recipient_type text CHECK (recipient_type IS NULL OR recipient_type IN ('manual', 'representative', 'internal')),
  recipient_reference text NOT NULL,
  recipient_email citext,
  external_recipient boolean NOT NULL DEFAULT false,
  external_recipient_confirmed_at timestamptz,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT email_parent CHECK (num_nonnulls(enquiry_id, order_id) >= 1),
  CONSTRAINT email_external_confirmation CHECK (
    NOT external_recipient OR external_recipient_confirmed_at IS NOT NULL
  )
);

CREATE TABLE app.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES app.users(id),
  actor_role text NOT NULL CHECK (actor_role IN ('customer', 'sales_representative', 'planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator', 'system')),
  company_id uuid REFERENCES app.companies(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_reference text,
  from_status text,
  to_status text,
  comment text,
  fields_changed jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_override boolean NOT NULL DEFAULT false,
  override_reason text,
  request_id text,
  correlation_id text NOT NULL,
  ip_address inet,
  user_agent_hash text,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failed', 'denied', 'idempotent_replay')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app.reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only; record a correction event instead';
END;
$$;

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON app.audit_events
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

CREATE TABLE app.administration_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type text NOT NULL,
  target_entity_type text NOT NULL,
  target_entity_id text NOT NULL,
  company_id uuid REFERENCES app.companies(id),
  requested_by_user_id uuid NOT NULL REFERENCES app.users(id),
  requested_by_role app.user_role NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  previous_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_permission text NOT NULL REFERENCES app.permissions(code),
  step_up_session_id uuid REFERENCES app.administration_step_up_sessions(id),
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'applied', 'failed')),
  audit_event_id bigint NOT NULL REFERENCES app.audit_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE app.approved_record_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid REFERENCES app.enquiries(id),
  order_id uuid REFERENCES app.orders(id),
  expected_row_version integer NOT NULL CHECK (expected_row_version > 0),
  fields_changed jsonb NOT NULL CHECK (jsonb_typeof(fields_changed) = 'array'),
  previous_value jsonb NOT NULL,
  corrected_value jsonb NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 8),
  corrected_by_user_id uuid NOT NULL REFERENCES app.users(id),
  step_up_session_id uuid NOT NULL REFERENCES app.administration_step_up_sessions(id),
  audit_event_id bigint NOT NULL REFERENCES app.audit_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approved_record_correction_parent CHECK (num_nonnulls(enquiry_id, order_id) = 1)
);

CREATE OR REPLACE FUNCTION app.reject_approved_correction_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'approved_record_corrections are append-only';
END;
$$;

CREATE TRIGGER approved_record_corrections_immutable
BEFORE UPDATE OR DELETE ON app.approved_record_corrections
FOR EACH ROW EXECUTE FUNCTION app.reject_approved_correction_mutation();

CREATE TABLE app.order_retention_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  document_id uuid NOT NULL REFERENCES app.uploaded_documents(id),
  policy_id uuid NOT NULL REFERENCES app.retention_policies(id),
  content_sha256 text NOT NULL,
  generated_by_user_id uuid NOT NULL REFERENCES app.users(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  protected_until timestamptz NOT NULL
);

CREATE TABLE app.order_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  retention_export_id uuid NOT NULL REFERENCES app.order_retention_exports(id),
  policy_id uuid NOT NULL REFERENCES app.retention_policies(id),
  requested_by_user_id uuid NOT NULL REFERENCES app.users(id),
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  manager_approved_by_user_id uuid REFERENCES app.users(id),
  manager_approved_at timestamptz,
  administrator_approved_by_user_id uuid REFERENCES app.users(id),
  administrator_approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'blocked_legal_hold')),
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE app.order_deletion_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deletion_request_id uuid NOT NULL UNIQUE REFERENCES app.order_deletion_requests(id),
  former_order_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  order_reference text NOT NULL,
  rfq_reference text,
  retention_export_id uuid NOT NULL REFERENCES app.order_retention_exports(id),
  policy_id uuid NOT NULL REFERENCES app.retention_policies(id),
  approval_evidence jsonb NOT NULL,
  deleted_document_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('completed', 'failed', 'partially_completed')),
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  executed_by_service text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Browser/application roles never receive DELETE on app.orders. A dedicated
-- backend retention function must lock/re-read the order, verify policy age,
-- legal hold, export and approvals, then write order_deletion_log atomically.

CREATE INDEX user_company_access_company_idx ON app.user_company_access (company_id, user_id)
  WHERE revoked_at IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX users_external_identity_unique ON app.users (identity_provider, external_subject) WHERE identity_provider IS NOT NULL AND external_subject IS NOT NULL;
CREATE INDEX representative_assignment_company_idx ON app.representative_company_assignments (company_id, representative_id) WHERE ends_at IS NULL;
CREATE INDEX products_category_active_idx ON app.products (category_id, is_active, code);
CREATE INDEX enquiries_company_updated_idx ON app.enquiries (company_id, updated_at DESC);
CREATE INDEX enquiries_rep_updated_idx ON app.enquiries (representative_id, updated_at DESC);
CREATE INDEX enquiries_rep_inbox_idx ON app.enquiries (representative_id, status, submitted_at, updated_at DESC);
CREATE INDEX enquiries_status_updated_idx ON app.enquiries (status, updated_at DESC);
CREATE INDEX orders_archive_eligibility_idx ON app.orders (archive_eligible_at, completed_at) WHERE archived_at IS NULL AND status = 'completed';
CREATE INDEX orders_archive_search_idx ON app.orders (archived_at DESC, company_id) WHERE archived_at IS NOT NULL;
CREATE INDEX orders_legal_hold_idx ON app.orders (company_id, legal_hold_placed_at) WHERE legal_hold_active;
CREATE INDEX enquiry_items_enquiry_idx ON app.enquiry_items (enquiry_id, line_number);
CREATE UNIQUE INDEX quotations_number_idx ON app.quotations (quotation_number);
CREATE INDEX quotations_acknowledgement_idx ON app.quotations (enquiry_id, acknowledged_at);
CREATE INDEX rfq_acceptances_verified_idx ON app.rfq_acceptances (verified_by_user_id, verified_at DESC);
CREATE INDEX orders_company_updated_idx ON app.orders (company_id, updated_at DESC);
CREATE INDEX orders_rep_updated_idx ON app.orders (representative_id, updated_at DESC);
CREATE INDEX orders_status_updated_idx ON app.orders (status, updated_at DESC);
CREATE UNIQUE INDEX orders_source_submission_key_idx ON app.orders (source_submission_key)
  WHERE source_submission_key IS NOT NULL;
CREATE INDEX orders_representative_source_duplicate_idx ON app.orders (
  company_id, purchase_order_number, quotation_number, created_at DESC
) WHERE order_origin = 'representative_loaded_order';
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
CREATE INDEX orders_dispatch_queue_idx ON app.orders (status, submitted_to_dispatch_at, updated_at)
  WHERE status IN ('awaiting_dispatch', 'ready_for_collection', 'out_for_delivery', 'delivered', 'collected', 'on_hold');
CREATE INDEX dispatch_updates_order_time_idx ON app.order_dispatch_updates (order_id, created_at DESC);
CREATE INDEX dispatch_records_received_idx ON app.order_dispatch_records (received_at, last_updated_at);
CREATE INDEX workflow_events_enquiry_idx ON app.workflow_events (enquiry_id, created_at);
CREATE INDEX workflow_events_order_idx ON app.workflow_events (order_id, created_at);
CREATE INDEX notifications_recipient_unread_idx ON app.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_company_idx ON app.notifications (company_id, created_at DESC);
CREATE INDEX notifications_entity_event_idx ON app.notifications (order_id, enquiry_id, event_type, created_at DESC);
CREATE INDEX notification_deliveries_work_idx ON app.notification_deliveries (status, next_attempt_at)
  WHERE status IN ('email_pending', 'email_failed', 'push_pending', 'push_failed');
CREATE INDEX notification_preferences_company_idx ON app.notification_preferences (company_id, updated_at DESC);
CREATE INDEX documents_company_idx ON app.uploaded_documents (company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX documents_current_order_source_kind_idx ON app.uploaded_documents (order_id, kind)
  WHERE deleted_at IS NULL AND is_current_version AND kind IN ('purchase_order', 'quotation');
CREATE INDEX representative_loaded_orders_company_created_idx
  ON app.representative_loaded_orders (company_id, created_at DESC);
CREATE INDEX representative_loaded_orders_rep_created_idx
  ON app.representative_loaded_orders (representative_id, created_at DESC);
CREATE INDEX representative_loaded_orders_references_idx
  ON app.representative_loaded_orders (company_id, purchase_order_number, quotation_number, created_at DESC);
CREATE UNIQUE INDEX customer_identity_images_active_kind_idx
  ON app.customer_identity_images (user_id, kind) WHERE deleted_at IS NULL;
CREATE INDEX customer_personalisations_company_idx ON app.customer_personalisations (company_id, updated_at DESC);
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

-- POST /representatives/orders is a separate atomic transaction and never
-- creates an RFQ. The API must verify load_customer_order, the selected company,
-- contact, branch and representative; reserve the idempotency key; lock and
-- evaluate possible duplicate references/product signatures; quarantine and
-- scan both mandatory source files; allocate the permanent order reference;
-- insert orders/order_items/representative_loaded_orders/uploaded_documents;
-- append immutable document/order audit events; and enqueue customer, Planning
-- and representative notifications. A duplicate override is itself audited and
-- may additionally require manager approval under the deployed policy. The
-- transaction commits only when both current source-document IDs are present.

-- Every Expediting action must also be one transaction: lock the authorised
-- order, verify its current state/expected row version and the active progress
-- configuration, insert expediting_updates, update the order summary fields,
-- append workflow/audit events and enqueue independent recipient notifications.
-- Dispatch hand-off additionally verifies the required step set or records the
-- authorised exception fields. The API derives actors/recipients from server
-- records and never trusts browser-supplied identity, company or target status.

-- Every Dispatch action follows the same atomic pattern: lock the authorised
-- order and current dispatch record, validate the exact stage, fulfilment method,
-- expected version, dates and evidence, append order_dispatch_updates, update the
-- summary/order status, append workflow/audit events and enqueue customer and
-- assigned-representative notifications. Proof bytes are private
-- uploaded_documents(kind = dispatch_proof) and cannot be served before scanning.

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
        AND access.deleted_at IS NULL
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
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.rfq_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.expediting_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_dispatch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_dispatch_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.representative_loaded_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.customer_personalisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.customer_identity_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_authorised_scope ON app.companies
  USING (app.can_access_company(id));

CREATE POLICY users_own_or_administrative_scope ON app.users
  USING (
    id = app.current_user_id()
    OR app.current_user_has_permission('administer_users')
  )
  WITH CHECK (app.current_user_has_permission('administer_users'));

CREATE POLICY company_users_authorised_scope ON app.user_company_access
  USING (
    deleted_at IS NULL
    AND (
      user_id = app.current_user_id()
      OR (
        app.can_access_company(company_id)
        AND app.current_user_has_permission('administer_users')
      )
    )
  )
  WITH CHECK (
    app.can_access_company(company_id)
    AND app.current_user_has_permission('administer_users')
  );

CREATE POLICY representatives_authenticated_directory ON app.representatives
  FOR SELECT
  USING (
    app.current_user_id() IS NOT NULL
    AND is_active
    AND deleted_at IS NULL
  );

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

CREATE POLICY representative_loaded_orders_internal_scope ON app.representative_loaded_orders
  USING (
    app.current_user_role() <> 'customer'
    AND app.can_access_order(order_id)
  )
  WITH CHECK (
    app.current_user_has_permission('load_customer_order')
    AND app.can_access_order(order_id)
    AND app.can_access_company(company_id)
  );

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

CREATE POLICY dispatch_records_authorised_scope ON app.order_dispatch_records
  USING (app.can_access_order(order_id))
  WITH CHECK (
    (
      app.current_user_has_permission('confirm_delivery')
      OR app.current_user_has_permission('confirm_collection')
    )
    AND app.can_access_order(order_id)
  );

CREATE POLICY dispatch_updates_authorised_scope ON app.order_dispatch_updates
  USING (
    app.can_access_order(order_id)
    AND (
      app.current_user_role() <> 'customer'
      OR customer_visible
    )
  )
  WITH CHECK (
    (
      app.current_user_has_permission('confirm_delivery')
      OR app.current_user_has_permission('confirm_collection')
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
    app.can_access_company(company_id)
    AND (
      (enquiry_id IS NOT NULL AND app.can_access_enquiry(enquiry_id))
      OR
      (order_id IS NOT NULL AND app.can_access_order(order_id))
    )
    AND (
      recipient_user_id = app.current_user_id()
      OR app.current_user_has_permission('view_all_orders')
      OR app.current_user_has_permission('view_all_rfqs')
    )
    AND (app.current_user_role() <> 'customer' OR customer_visible)
  );

CREATE POLICY audit_events_management_read ON app.audit_events
  FOR SELECT
  USING (app.current_user_has_permission('read_audit_history'));

-- The ordinary application role receives SELECT (subject to RLS) and INSERT
-- through the audited service function only. It must never receive UPDATE or
-- DELETE on app.audit_events.

CREATE POLICY notification_deliveries_authorised_scope ON app.notification_deliveries
  USING (EXISTS (
    SELECT 1
    FROM app.notifications notification
    WHERE notification.id = notification_id
  ));

CREATE POLICY notification_preferences_own_scope ON app.notification_preferences
  USING (
    user_id = app.current_user_id()
    OR app.current_user_has_permission('administer_users')
  )
  WITH CHECK (
    user_id = app.current_user_id()
    OR app.current_user_has_permission('administer_users')
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

CREATE POLICY customer_personalisations_own_scope ON app.customer_personalisations
  USING (user_id = app.current_user_id() AND app.can_access_company(company_id))
  WITH CHECK (
    user_id = app.current_user_id()
    AND app.current_user_role() = 'customer'
    AND app.can_access_company(company_id)
  );

CREATE POLICY customer_identity_images_own_scope ON app.customer_identity_images
  USING (
    deleted_at IS NULL
    AND user_id = app.current_user_id()
    AND app.can_access_company(company_id)
  )
  WITH CHECK (
    user_id = app.current_user_id()
    AND app.current_user_role() = 'customer'
    AND app.can_access_company(company_id)
  );

-- RLS limits row scope; database grants must separately limit operations by the API role.
-- In particular, customers must not receive UPDATE/DELETE rights on workflow events,
-- quotations, pricing snapshots, representative assignments, users, products or
-- audit events. The API must return a customer quotation projection that omits
-- internal_note, marked_by_user_id and unauthorised document/reference fields;
-- it must likewise project expediting_updates without internal_note, delay_reason,
-- document metadata, internal actor IDs or hand-off exception fields. Dispatch
-- projections must omit internal_notes, problem_reason/current_problem_reason and
-- internal actor IDs, and expose proof metadata only when customer visibility and
-- parent order/company checks pass. Row-level security does not provide
-- column-level redaction.

-- Management, approval and idempotency proposal.
CREATE TABLE IF NOT EXISTS app.management_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  enquiry_id uuid REFERENCES app.enquiries(id),
  order_id uuid REFERENCES app.orders(id),
  approval_type text NOT NULL CHECK (approval_type IN ('representative_reassignment', 'workflow_override', 'archival')),
  previous_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL CHECK (char_length(reason) >= 5),
  approved_by_user_id uuid NOT NULL REFERENCES app.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  CHECK ((enquiry_id IS NOT NULL)::integer + (order_id IS NOT NULL)::integer = 1)
);

CREATE TABLE IF NOT EXISTS app.operational_report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_by_user_id uuid NOT NULL REFERENCES app.users(id),
  filter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  authorised_company_ids uuid[] NOT NULL DEFAULT '{}',
  row_count integer NOT NULL CHECK (row_count >= 0),
  classification text NOT NULL DEFAULT 'INTERNAL OPERATIONAL REPORT',
  storage_object_key text,
  sha256 text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  audit_event_id bigint REFERENCES app.audit_events(id)
);

CREATE INDEX IF NOT EXISTS management_approvals_company_time_idx
  ON app.management_approvals (company_id, approved_at DESC);
CREATE INDEX IF NOT EXISTS operational_report_exports_actor_time_idx
  ON app.operational_report_exports (generated_by_user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idempotency_records_expiry_idx
  ON app.idempotency_records (expires_at);

ALTER TABLE app.management_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.operational_report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY management_approvals_authorised_scope ON app.management_approvals
  USING (
    app.current_user_has_permission('view_reports')
    AND app.can_access_company(company_id)
  )
  WITH CHECK (
    app.can_access_company(company_id)
    AND (
      app.current_user_has_permission('reassign_representative')
      OR app.current_user_has_permission('approve_workflow_override')
      OR app.current_user_has_permission('approve_archival')
    )
  );

CREATE POLICY operational_report_exports_own_scope ON app.operational_report_exports
  USING (
    generated_by_user_id = app.current_user_id()
    OR app.current_user_has_permission('administer_users')
  )
  WITH CHECK (
    generated_by_user_id = app.current_user_id()
    AND app.current_user_has_permission('export_operational_reports')
  );

-- Idempotency reads/writes belong to narrowly scoped security-definer service
-- functions. The ordinary API role receives no direct SELECT of response bodies.
-- Management aggregates must apply app.can_access_company before grouping, and
-- the API projection must omit all protected pricing columns/JSON keys.

-- ---------------------------------------------------------------------------
-- Canonical production entities
-- ---------------------------------------------------------------------------
-- Earlier browser-preview phases used "enquiry" names in the API and proposal.
-- The physical production tables below are canonical RFQ entities. Compatibility
-- views preserve the current /enquiries API adapter while IT migrates clients.

CREATE TABLE app.roles (
  code app.user_role PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 2 AND 100),
  description text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.roles (code, name, description, is_internal) VALUES
  ('customer', 'Customer', 'Authorised customer-company contact.', false),
  ('sales_representative', 'Sales representative', 'Assigned commercial representative.', true),
  ('planning', 'Planning', 'Production planning workspace user.', true),
  ('expeditor', 'Expeditor', 'Production and fulfilment progress user.', true),
  ('dispatch', 'Dispatch', 'Collection and delivery workspace user.', true),
  ('buyer', 'Buyer', 'Prepared role; workflow remains inactive.', true),
  ('manager', 'Manager', 'Operational oversight and controlled approvals.', true),
  ('administrator', 'Administrator', 'User, policy and platform administration.', true);

ALTER TABLE app.role_permissions
  ADD CONSTRAINT role_permissions_role_fk
  FOREIGN KEY (role) REFERENCES app.roles(code);

CREATE TABLE app.user_roles (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_code app.user_role NOT NULL REFERENCES app.roles(code),
  assigned_by_user_id uuid REFERENCES app.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY (user_id, role_code, assigned_at),
  CHECK (expires_at IS NULL OR expires_at > assigned_at)
);

-- Backfill the earlier single-role proposal before removing its duplicated
-- source of truth. Production authorisation reads app.user_roles only.
INSERT INTO app.user_roles (user_id, role_code, assigned_at)
SELECT id, role, created_at FROM app.users;
ALTER TABLE app.users DROP COLUMN role;

CREATE TABLE app.product_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  configuration_schema jsonb NOT NULL,
  business_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (product_id, schema_version),
  CHECK (jsonb_typeof(configuration_schema) = 'array'),
  CHECK (jsonb_typeof(business_rules) = 'object'),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Authoritative one-to-one Planning record. The queue columns currently present
-- on app.orders are a denormalised read model and must be updated only in the
-- same transaction as this record.
CREATE TABLE app.planning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES app.orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  internal_job_number text NOT NULL UNIQUE,
  customer_purchase_order_number text,
  purchase_order_exception_authorised boolean NOT NULL DEFAULT false,
  purchase_order_exception_reason text,
  planning_notes text,
  planned_start_date date,
  estimated_completion_date date,
  assigned_planning_user_id uuid NOT NULL REFERENCES app.users(id),
  production_location_branch_id uuid REFERENCES app.branches(id),
  priority text NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'high', 'urgent')),
  document_references text[] NOT NULL DEFAULT '{}',
  started_at timestamptz,
  submitted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (
    customer_purchase_order_number IS NOT NULL
    OR (
      purchase_order_exception_authorised
      AND purchase_order_exception_reason IS NOT NULL
      AND length(trim(purchase_order_exception_reason)) >= 8
    )
  ),
  CHECK (
    planned_start_date IS NULL
    OR estimated_completion_date IS NULL
    OR estimated_completion_date >= planned_start_date
  )
);

CREATE TYPE app.archive_action AS ENUM (
  'eligible',
  'archived',
  'restored',
  'legal_hold_applied',
  'legal_hold_released',
  'deletion_requested',
  'deletion_cancelled'
);

CREATE TABLE app.archive_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.orders(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  retention_policy_id uuid NOT NULL REFERENCES app.retention_policies(id),
  action app.archive_action NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 5),
  legal_hold_active boolean NOT NULL DEFAULT false,
  performed_by_user_id uuid REFERENCES app.users(id),
  eligible_at timestamptz,
  archived_at timestamptz,
  restored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  UNIQUE (order_id, action, created_at)
);

CREATE TYPE app.workflow_override_status AS ENUM (
  'requested',
  'approved',
  'rejected',
  'executed',
  'cancelled'
);

CREATE TABLE app.workflow_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  enquiry_id uuid REFERENCES app.enquiries(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES app.orders(id) ON DELETE RESTRICT,
  requested_from_status text NOT NULL,
  requested_to_status text NOT NULL,
  expected_row_version integer NOT NULL CHECK (expected_row_version >= 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 10),
  status app.workflow_override_status NOT NULL DEFAULT 'requested',
  requested_by_user_id uuid NOT NULL REFERENCES app.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by_user_id uuid REFERENCES app.users(id),
  decided_at timestamptz,
  decision_comment text,
  executed_by_user_id uuid REFERENCES app.users(id),
  executed_at timestamptz,
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(enquiry_id, order_id) = 1),
  CHECK (
    status = 'requested'
    OR (
      decided_by_user_id IS NOT NULL
      AND decided_at IS NOT NULL
      AND decision_comment IS NOT NULL
      AND length(trim(decision_comment)) >= 10
    )
  ),
  CHECK (
    status <> 'executed'
    OR (executed_by_user_id IS NOT NULL AND executed_at IS NOT NULL)
  )
);

CREATE INDEX user_roles_active_idx
  ON app.user_roles (user_id, role_code) WHERE revoked_at IS NULL;
CREATE INDEX product_configurations_active_idx
  ON app.product_configurations (product_id, effective_from DESC)
  WHERE deleted_at IS NULL AND effective_to IS NULL;
CREATE INDEX planning_records_queue_idx
  ON app.planning_records (company_id, priority, submitted_at DESC);
CREATE INDEX archive_records_order_time_idx
  ON app.archive_records (order_id, created_at DESC);
CREATE INDEX archive_records_company_time_idx
  ON app.archive_records (company_id, created_at DESC);
CREATE INDEX workflow_overrides_company_status_idx
  ON app.workflow_overrides (company_id, status, requested_at DESC);

ALTER TABLE app.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.product_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.planning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.archive_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_authorised_scope ON app.user_roles
  USING (
    user_id = app.current_user_id()
    OR app.current_user_has_permission('administer_users')
  )
  WITH CHECK (app.current_user_has_permission('administer_users'));

CREATE POLICY product_configurations_catalogue_scope ON app.product_configurations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      app.current_user_has_permission('read_catalogue')
      OR app.current_user_has_permission('manage_products')
    )
  );

CREATE POLICY planning_records_internal_scope ON app.planning_records
  USING (
    app.can_access_company(company_id)
    AND app.can_access_order(order_id)
    AND app.current_user_role() <> 'customer'
  )
  WITH CHECK (
    app.can_access_company(company_id)
    AND app.current_user_has_permission('add_planning_information')
  );

CREATE POLICY archive_records_management_scope ON app.archive_records
  USING (
    app.can_access_company(company_id)
    AND (
      app.current_user_has_permission('archive_orders')
      OR app.current_user_has_permission('restore_archived_orders')
      OR app.current_user_has_permission('read_audit_history')
    )
  )
  WITH CHECK (
    app.can_access_company(company_id)
    AND app.current_user_has_permission('archive_orders')
  );

CREATE POLICY workflow_overrides_management_scope ON app.workflow_overrides
  USING (
    app.can_access_company(company_id)
    AND app.current_user_has_permission('read_audit_history')
  )
  WITH CHECK (
    app.can_access_company(company_id)
    AND app.current_user_has_permission('override_workflow')
  );

-- Append-only operational evidence. Corrections are additional audit/tracking
-- events; production roles receive no UPDATE or DELETE grant on these tables.
CREATE TRIGGER tracking_events_immutable
BEFORE UPDATE OR DELETE ON app.workflow_events
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

CREATE TRIGGER expediting_updates_immutable
BEFORE UPDATE OR DELETE ON app.expediting_updates
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

CREATE TRIGGER dispatch_updates_immutable
BEFORE UPDATE OR DELETE ON app.order_dispatch_updates
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

CREATE TRIGGER archive_records_immutable
BEFORE UPDATE OR DELETE ON app.archive_records
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

-- Canonical physical names required by the production model.
ALTER TABLE app.user_company_access RENAME TO company_users;
ALTER TABLE app.enquiries RENAME TO rfqs;
ALTER TABLE app.enquiry_items RENAME TO rfq_items;
ALTER TABLE app.order_dispatch_records RENAME TO dispatch_records;
ALTER TABLE app.workflow_events RENAME TO tracking_events;

-- Temporary read-only compatibility views for the existing API adapter. New
-- backend code and migrations must use the canonical table names above.
CREATE VIEW app.user_company_access AS SELECT * FROM app.company_users;
CREATE VIEW app.enquiries AS SELECT * FROM app.rfqs;
CREATE VIEW app.enquiry_items AS SELECT * FROM app.rfq_items;
CREATE VIEW app.order_dispatch_records AS SELECT * FROM app.dispatch_records;
CREATE VIEW app.workflow_events AS SELECT * FROM app.tracking_events;

-- Phase 21 Laboratory, certification, QA, department receipt, credential and
-- operational-reporting model. This remains a design specification only.
CREATE TABLE app.order_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  order_id uuid NOT NULL UNIQUE REFERENCES app.orders(id),
  requires_laboratory boolean NOT NULL DEFAULT false,
  requires_quality_assurance boolean NOT NULL DEFAULT true,
  certificate_types app.certificate_type[] NOT NULL DEFAULT '{}',
  decided_by uuid REFERENCES app.users(id),
  decision_reason text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_routing_valid_path CHECK (
    (requires_laboratory AND NOT requires_quality_assurance)
    OR (NOT requires_laboratory AND requires_quality_assurance)
  )
);

CREATE TABLE app.lab_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  order_id uuid NOT NULL UNIQUE REFERENCES app.orders(id),
  status app.lab_unit_status NOT NULL DEFAULT 'awaiting_receipt',
  assigned_lab_user_id uuid REFERENCES app.users(id),
  received_by uuid REFERENCES app.users(id),
  received_at timestamptz,
  calibration_started_at timestamptz,
  calibration_completed_at timestamptz,
  physically_released_by uuid REFERENCES app.users(id),
  physically_released_at timestamptz,
  receiving_department text,
  archived_by uuid REFERENCES app.users(id),
  archived_at timestamptz,
  archive_reason text,
  legal_hold boolean NOT NULL DEFAULT false,
  investigation_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE app.calibration_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  lab_task_id uuid NOT NULL REFERENCES app.lab_tasks(id),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  order_item_id uuid NOT NULL REFERENCES app.order_items(id),
  unit_sequence integer NOT NULL CHECK (unit_sequence > 0),
  product_id uuid REFERENCES app.products(id),
  product_model text NOT NULL,
  product_description text NOT NULL,
  serial_number text,
  internal_job_number text,
  calibration_type app.certificate_type NOT NULL,
  urgent boolean NOT NULL DEFAULT false,
  status app.lab_unit_status NOT NULL DEFAULT 'awaiting_receipt',
  certificate_status app.certificate_status NOT NULL DEFAULT 'required',
  received_at timestamptz,
  completed_at timestamptz,
  released_at timestamptz,
  acting_lab_user_id uuid REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (order_item_id, unit_sequence)
);

CREATE TABLE app.certificate_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  calibration_unit_id uuid NOT NULL UNIQUE REFERENCES app.calibration_units(id),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  order_item_id uuid NOT NULL REFERENCES app.order_items(id),
  certificate_type app.certificate_type NOT NULL,
  status app.certificate_status NOT NULL DEFAULT 'required',
  required_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived_at timestamptz
);

CREATE TABLE app.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  requirement_id uuid NOT NULL UNIQUE REFERENCES app.certificate_requirements(id),
  calibration_unit_id uuid NOT NULL UNIQUE REFERENCES app.calibration_units(id),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  order_item_id uuid NOT NULL REFERENCES app.order_items(id),
  document_id uuid NOT NULL UNIQUE REFERENCES app.uploaded_documents(id),
  certificate_number text NOT NULL UNIQUE,
  certificate_type app.certificate_type NOT NULL,
  certificate_date date NOT NULL,
  expiry_date date,
  result_summary text,
  serial_number text,
  internal_note text,
  uploaded_by uuid NOT NULL REFERENCES app.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES app.users(id),
  verified_at timestamptz,
  customer_notified_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE app.certificate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  certificate_id uuid NOT NULL REFERENCES app.certificates(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  document_id uuid NOT NULL REFERENCES app.uploaded_documents(id),
  change_reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certificate_id, version_number)
);

CREATE TABLE app.lab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  lab_task_id uuid NOT NULL REFERENCES app.lab_tasks(id),
  calibration_unit_id uuid REFERENCES app.calibration_units(id),
  event_type text NOT NULL,
  customer_visible boolean NOT NULL DEFAULT false,
  customer_message text,
  internal_note text,
  actor_user_id uuid NOT NULL REFERENCES app.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE app.lab_monthly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  period_start date NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric(18,4) NOT NULL DEFAULT 0,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, metric_key, dimensions)
);

CREATE TABLE app.qa_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  status app.qa_task_status NOT NULL DEFAULT 'awaiting_qa',
  current_inspection_number integer NOT NULL DEFAULT 0,
  assigned_qa_user_id uuid REFERENCES app.users(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  handed_to_dispatch_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE UNIQUE INDEX qa_tasks_one_active_order_idx
  ON app.qa_tasks (order_id)
  WHERE archived_at IS NULL;

CREATE TABLE app.qa_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  qa_task_id uuid NOT NULL REFERENCES app.qa_tasks(id),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  inspection_number integer NOT NULL CHECK (inspection_number > 0),
  result app.qa_result,
  inspector_user_id uuid NOT NULL REFERENCES app.users(id),
  inspection_date date NOT NULL,
  checklist_reference text,
  checklist_confirmed boolean NOT NULL DEFAULT false,
  meets_requirements boolean NOT NULL DEFAULT false,
  internal_note text,
  document_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (qa_task_id, inspection_number)
);

CREATE TABLE app.qa_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  qa_inspection_id uuid NOT NULL UNIQUE REFERENCES app.qa_inspections(id),
  order_item_id uuid NOT NULL REFERENCES app.order_items(id),
  problem_category text NOT NULL,
  problem_description text NOT NULL,
  other_explanation text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  found_at date NOT NULL,
  found_by uuid NOT NULL REFERENCES app.users(id),
  return_destination text NOT NULL,
  customer_message text NOT NULL,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.qa_rework_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  qa_task_id uuid NOT NULL REFERENCES app.qa_tasks(id),
  qa_failure_id uuid NOT NULL REFERENCES app.qa_failures(id),
  cycle_number integer NOT NULL CHECK (cycle_number > 0),
  responsible_department text NOT NULL,
  current_correction_stage text,
  estimated_correction_date date,
  status text NOT NULL CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES app.users(id),
  UNIQUE (qa_task_id, cycle_number)
);

CREATE TABLE app.qa_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  qa_task_id uuid NOT NULL REFERENCES app.qa_tasks(id),
  qa_inspection_id uuid REFERENCES app.qa_inspections(id),
  rework_cycle_id uuid REFERENCES app.qa_rework_cycles(id),
  event_type text NOT NULL,
  customer_visible boolean NOT NULL DEFAULT false,
  customer_message text,
  internal_note text,
  actor_user_id uuid NOT NULL REFERENCES app.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE app.qa_monthly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  period_start date NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric(18,4) NOT NULL DEFAULT 0,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, metric_key, dimensions)
);

CREATE TABLE app.department_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  order_id uuid NOT NULL REFERENCES app.orders(id),
  receiving_department text NOT NULL,
  source_department text NOT NULL,
  number_of_packages integer CHECK (number_of_packages BETWEEN 1 AND 999),
  exception_reason text,
  internal_note text,
  customer_message text,
  received_by uuid NOT NULL REFERENCES app.users(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, receiving_department, received_at)
);

CREATE TABLE app.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  realm app.auth_realm NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('change_username', 'change_password', 'change_credentials')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts_remaining integer NOT NULL CHECK (attempts_remaining BETWEEN 0 AND 10),
  used_at timestamptz,
  invalidated_at timestamptz,
  requested_ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.credential_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id),
  verification_code_id uuid NOT NULL REFERENCES app.verification_codes(id),
  realm app.auth_realm NOT NULL,
  requested_username citext,
  requested_password_hash text,
  status text NOT NULL CHECK (status IN ('pending_verification', 'verified', 'applied', 'expired', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  applied_at timestamptz,
  session_invalidated_at timestamptz
);

CREATE TABLE app.product_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  product_id uuid REFERENCES app.products(id),
  period_start date NOT NULL,
  period_granularity text NOT NULL CHECK (period_granularity IN ('month', 'year')),
  units_ordered integer NOT NULL DEFAULT 0,
  sanas_units integer NOT NULL DEFAULT 0,
  traceable_units integer NOT NULL DEFAULT 0,
  qa_failures integer NOT NULL DEFAULT 0,
  average_turnaround_hours numeric(12,2),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id, period_start, period_granularity)
);

CREATE TABLE app.representative_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id uuid NOT NULL REFERENCES app.representatives(id),
  branch_id uuid REFERENCES app.branches(id),
  period_start date NOT NULL,
  rfq_count integer NOT NULL DEFAULT 0,
  quotation_count integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  conversion_rate numeric(7,4),
  average_quotation_hours numeric(12,2),
  average_customer_response_hours numeric(12,2),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (representative_id, period_start)
);

CREATE TABLE app.operational_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES app.companies(id),
  branch_id uuid REFERENCES app.branches(id),
  period_start date NOT NULL,
  period_granularity text NOT NULL CHECK (period_granularity IN ('day', 'month', 'year')),
  metric_key text NOT NULL,
  metric_value numeric(18,4) NOT NULL DEFAULT 0,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (company_id, branch_id, period_start, period_granularity, metric_key, dimensions)
);

CREATE INDEX calibration_units_company_status_idx ON app.calibration_units (company_id, status, created_at);
CREATE INDEX certificate_requirements_company_status_idx ON app.certificate_requirements (company_id, status, required_at);
CREATE INDEX certificates_company_order_idx ON app.certificates (company_id, order_id, uploaded_at DESC);
CREATE INDEX lab_events_task_time_idx ON app.lab_events (lab_task_id, occurred_at DESC);
CREATE INDEX qa_tasks_company_status_idx ON app.qa_tasks (company_id, status, received_at);
CREATE INDEX qa_failures_company_category_idx ON app.qa_failures (company_id, problem_category, created_at DESC);
CREATE INDEX qa_events_task_time_idx ON app.qa_events (qa_task_id, occurred_at DESC);
CREATE INDEX department_receipts_order_time_idx ON app.department_receipts (order_id, received_at DESC);
CREATE INDEX verification_codes_user_expiry_idx ON app.verification_codes (user_id, expires_at DESC);
CREATE INDEX product_statistics_period_idx ON app.product_statistics (period_start, product_id);
CREATE INDEX representative_statistics_period_idx ON app.representative_statistics (period_start, representative_id);
CREATE INDEX operational_metrics_period_key_idx ON app.operational_metrics (period_start, metric_key);

ALTER TABLE app.order_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lab_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.calibration_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.certificate_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.certificate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lab_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qa_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qa_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qa_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qa_rework_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.qa_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.department_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_tasks_company_scope ON app.lab_tasks
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY calibration_units_company_scope ON app.calibration_units
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY certificate_requirements_company_scope ON app.certificate_requirements
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY certificates_company_scope ON app.certificates
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY qa_tasks_company_scope ON app.qa_tasks
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY qa_inspections_company_scope ON app.qa_inspections
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY qa_failures_company_scope ON app.qa_failures
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY qa_rework_cycles_company_scope ON app.qa_rework_cycles
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));
CREATE POLICY department_receipts_company_scope ON app.department_receipts
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));

CREATE TRIGGER certificate_versions_immutable
BEFORE UPDATE OR DELETE ON app.certificate_versions
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER lab_events_immutable
BEFORE UPDATE OR DELETE ON app.lab_events
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER qa_events_immutable
BEFORE UPDATE OR DELETE ON app.qa_events
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

CREATE TABLE app.lab_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), method_code text NOT NULL, version text NOT NULL,
  discipline text NOT NULL CHECK (discipline IN ('pressure','temperature')), approval_status text NOT NULL,
  formula_definition jsonb NOT NULL, effective_from date, retired_at timestamptz,
  UNIQUE (method_code, version)
);
CREATE TABLE app.lab_reference_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), branch_id uuid NOT NULL REFERENCES app.branches(id),
  standard_code text NOT NULL, discipline text NOT NULL, range_min numeric, range_max numeric, unit text,
  resolution numeric, certificate_reference text, valid_from date, expires_on date, status text NOT NULL,
  approved_method_versions jsonb NOT NULL DEFAULT '[]'::jsonb, UNIQUE (branch_id, standard_code)
);
CREATE TABLE app.lab_worksheet_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), calibration_unit_id uuid NOT NULL REFERENCES app.calibration_units(id),
  method_id uuid REFERENCES app.lab_methods(id), revision integer NOT NULL, raw_input jsonb NOT NULL,
  locked_at timestamptz, created_by uuid NOT NULL REFERENCES app.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calibration_unit_id, revision)
);
CREATE TABLE app.lab_calculation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), worksheet_revision_id uuid NOT NULL REFERENCES app.lab_worksheet_revisions(id),
  calculation_version integer NOT NULL, derived_results jsonb NOT NULL, uncertainty_budget jsonb NOT NULL,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb, calculated_by uuid NOT NULL REFERENCES app.users(id),
  calculated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (worksheet_revision_id, calculation_version)
);
CREATE TABLE app.lab_reference_usage (
  calculation_version_id uuid NOT NULL REFERENCES app.lab_calculation_versions(id),
  reference_standard_id uuid NOT NULL REFERENCES app.lab_reference_standards(id),
  certificate_snapshot jsonb NOT NULL, PRIMARY KEY (calculation_version_id, reference_standard_id)
);
CREATE TABLE app.lab_certificate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), calibration_unit_id uuid NOT NULL REFERENCES app.calibration_units(id),
  action text NOT NULL, reason text, checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid NOT NULL REFERENCES app.users(id), actor_role text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.lab_signed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), certificate_id uuid NOT NULL REFERENCES app.certificates(id),
  version integer NOT NULL, storage_key text NOT NULL, sha256 text NOT NULL, signature_validation jsonb NOT NULL,
  status text NOT NULL, uploaded_by uuid NOT NULL REFERENCES app.users(id), uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certificate_id, version), UNIQUE (storage_key)
);
CREATE TABLE app.lab_unit_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), calibration_unit_id uuid NOT NULL REFERENCES app.calibration_units(id),
  destination text NOT NULL CHECK (destination IN ('dispatch','expediting')), package_count integer NOT NULL CHECK (package_count > 0),
  bom_signed_off boolean NOT NULL, internal_note text, released_by uuid NOT NULL REFERENCES app.users(id),
  released_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER lab_worksheet_revisions_immutable BEFORE UPDATE OR DELETE ON app.lab_worksheet_revisions FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER lab_calculation_versions_immutable BEFORE UPDATE OR DELETE ON app.lab_calculation_versions FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER lab_certificate_reviews_immutable BEFORE UPDATE OR DELETE ON app.lab_certificate_reviews FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER lab_signed_documents_immutable BEFORE UPDATE OR DELETE ON app.lab_signed_documents FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

-- Proposed RFQ Technical Support extension. No migration has been applied.
CREATE TABLE app.technical_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text NOT NULL UNIQUE,
  rfq_id uuid NOT NULL REFERENCES app.rfqs(id), company_id uuid NOT NULL REFERENCES app.companies(id),
  representative_id uuid NOT NULL REFERENCES app.representatives(id), requested_by uuid NOT NULL REFERENCES app.users(id),
  category text NOT NULL, other_explanation text, question text NOT NULL, rfq_item_id uuid NOT NULL REFERENCES app.rfq_items(id),
  priority text NOT NULL CHECK (priority IN ('standard','high','urgent')), requested_department text,
  requested_technical_user_id uuid REFERENCES app.users(id), classification text NOT NULL CHECK (classification IN ('internal_only','customer_safe')),
  status text NOT NULL CHECK (status IN ('technical_support_requested','technical_support_assigned','technical_review_in_progress','awaiting_representative_information','awaiting_customer_information','technical_response_submitted','technical_support_completed','technical_support_cancelled')),
  original_quotation_target_at timestamptz NOT NULL, revised_quotation_target_at timestamptz NOT NULL,
  allowance_hours integer NOT NULL DEFAULT 24 CHECK (allowance_hours = 24), active_cycle integer NOT NULL DEFAULT 1,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(), requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, cancelled_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE (rfq_id, active_cycle)
);
CREATE UNIQUE INDEX technical_support_one_active_cycle ON app.technical_support_requests(rfq_id)
  WHERE completed_at IS NULL AND cancelled_at IS NULL AND deleted_at IS NULL;
CREATE INDEX technical_support_queue_idx ON app.technical_support_requests(status, priority, revised_quotation_target_at);
CREATE INDEX technical_support_company_idx ON app.technical_support_requests(company_id, requested_at DESC);

CREATE TABLE app.technical_support_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES app.technical_support_requests(id),
  company_id uuid NOT NULL REFERENCES app.companies(id), technical_user_id uuid NOT NULL REFERENCES app.users(id),
  assigned_by uuid NOT NULL REFERENCES app.users(id), assigned_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz
);
CREATE INDEX technical_support_assignment_user_idx ON app.technical_support_assignments(technical_user_id, ended_at);

CREATE TABLE app.technical_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES app.technical_support_requests(id),
  rfq_id uuid NOT NULL REFERENCES app.rfqs(id), company_id uuid NOT NULL REFERENCES app.companies(id),
  sender_id uuid NOT NULL REFERENCES app.users(id), sender_role text NOT NULL, message_text text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('internal_only','customer_safe')),
  customer_visible boolean NOT NULL DEFAULT false, correction_of_message_id uuid REFERENCES app.technical_support_messages(id),
  created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE INDEX technical_support_messages_thread_idx ON app.technical_support_messages(request_id, created_at);

CREATE TABLE app.technical_support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES app.technical_support_requests(id),
  message_id uuid REFERENCES app.technical_support_messages(id), company_id uuid NOT NULL REFERENCES app.companies(id),
  uploaded_document_id uuid NOT NULL REFERENCES app.uploaded_documents(id), customer_visible boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES app.users(id), uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.technical_support_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES app.technical_support_requests(id),
  company_id uuid NOT NULL REFERENCES app.companies(id), previous_status text, new_status text NOT NULL,
  actor_id uuid NOT NULL REFERENCES app.users(id), actor_role text NOT NULL, reason text,
  correlation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.customer_information_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), technical_request_id uuid NOT NULL REFERENCES app.technical_support_requests(id),
  company_id uuid NOT NULL REFERENCES app.companies(id), requested_via_representative_id uuid NOT NULL REFERENCES app.representatives(id),
  customer_safe_message text NOT NULL, requested_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz, closed_at timestamptz
);
CREATE TABLE app.quotation_due_date_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rfq_id uuid NOT NULL REFERENCES app.rfqs(id),
  technical_request_id uuid NOT NULL REFERENCES app.technical_support_requests(id), company_id uuid NOT NULL REFERENCES app.companies(id),
  original_target_at timestamptz NOT NULL, allowance_hours integer NOT NULL CHECK (allowance_hours > 0), revised_target_at timestamptz NOT NULL,
  reason text NOT NULL, acted_by uuid NOT NULL REFERENCES app.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technical_request_id)
);
CREATE TABLE app.technical_support_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES app.technical_support_requests(id),
  company_id uuid NOT NULL REFERENCES app.companies(id), reason text NOT NULL, approved_by uuid NOT NULL REFERENCES app.users(id),
  approved_role text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE TABLE app.technical_support_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES app.companies(id),
  period_start date NOT NULL, period_end date NOT NULL, dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  measures jsonb NOT NULL DEFAULT '{}'::jsonb, generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, period_end, dimensions)
);

ALTER TABLE app.technical_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.customer_information_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quotation_due_date_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_support_requests_company_scope ON app.technical_support_requests USING (app.can_access_company(company_id)) WITH CHECK (app.can_access_company(company_id));
CREATE POLICY technical_support_messages_company_scope ON app.technical_support_messages USING (app.can_access_company(company_id)) WITH CHECK (app.can_access_company(company_id));
CREATE POLICY technical_support_attachments_company_scope ON app.technical_support_attachments USING (app.can_access_company(company_id)) WITH CHECK (app.can_access_company(company_id));
CREATE POLICY customer_information_requests_company_scope ON app.customer_information_requests USING (app.can_access_company(company_id)) WITH CHECK (app.can_access_company(company_id));

CREATE TRIGGER technical_support_messages_immutable BEFORE UPDATE OR DELETE ON app.technical_support_messages FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER technical_support_status_events_immutable BEFORE UPDATE OR DELETE ON app.technical_support_status_events FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER quotation_due_adjustments_immutable BEFORE UPDATE OR DELETE ON app.quotation_due_date_adjustments FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();
CREATE TRIGGER technical_support_overrides_immutable BEFORE UPDATE OR DELETE ON app.technical_support_overrides FOR EACH ROW EXECUTE FUNCTION app.reject_audit_event_mutation();

COMMIT;
