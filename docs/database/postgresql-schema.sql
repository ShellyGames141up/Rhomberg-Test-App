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
CREATE TYPE app.document_kind AS ENUM ('purchase_order', 'quotation', 'datasheet', 'certificate', 'customer_attachment', 'other');
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

CREATE TABLE app.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  requester_user_id uuid NOT NULL REFERENCES app.users(id),
  representative_id uuid REFERENCES app.representatives(id),
  status app.enquiry_status NOT NULL DEFAULT 'draft',
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
  fulfilment app.fulfilment_method NOT NULL,
  workflow_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  promised_date date,
  planning_started_at timestamptz,
  planned_at timestamptz,
  submitted_to_expediting_at timestamptz,
  expediting_started_at timestamptz,
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
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0)
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
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT document_parent CHECK (num_nonnulls(product_id, enquiry_id, order_id) = 1)
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
  outcome text NOT NULL CHECK (outcome IN ('success', 'failed', 'denied')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_company_access_company_idx ON app.user_company_access (company_id, user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX users_external_identity_unique ON app.users (identity_provider, external_subject) WHERE identity_provider IS NOT NULL AND external_subject IS NOT NULL;
CREATE INDEX representative_assignment_company_idx ON app.representative_company_assignments (company_id, representative_id) WHERE ends_at IS NULL;
CREATE INDEX products_category_active_idx ON app.products (category_id, is_active, code);
CREATE INDEX enquiries_company_updated_idx ON app.enquiries (company_id, updated_at DESC);
CREATE INDEX enquiries_rep_updated_idx ON app.enquiries (representative_id, updated_at DESC);
CREATE INDEX enquiries_status_updated_idx ON app.enquiries (status, updated_at DESC);
CREATE INDEX enquiry_items_enquiry_idx ON app.enquiry_items (enquiry_id, line_number);
CREATE INDEX orders_company_updated_idx ON app.orders (company_id, updated_at DESC);
CREATE INDEX orders_rep_updated_idx ON app.orders (representative_id, updated_at DESC);
CREATE INDEX orders_status_updated_idx ON app.orders (status, updated_at DESC);
CREATE INDEX workflow_events_enquiry_idx ON app.workflow_events (enquiry_id, created_at);
CREATE INDEX workflow_events_order_idx ON app.workflow_events (order_id, created_at);
CREATE INDEX notifications_recipient_unread_idx ON app.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_company_idx ON app.notifications (company_id, created_at DESC);
CREATE INDEX documents_company_idx ON app.uploaded_documents (company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX email_outbox_work_idx ON app.email_outbox (status, next_attempt_at) WHERE status IN ('pending', 'failed');
CREATE INDEX audit_events_actor_time_idx ON app.audit_events (actor_user_id, created_at DESC);
CREATE INDEX audit_events_entity_idx ON app.audit_events (entity_type, entity_id, created_at DESC);

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

CREATE FUNCTION app.can_access_company(target_company_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT CASE
    WHEN app.current_user_role() IN ('planning', 'expeditor', 'dispatch', 'buyer', 'manager', 'administrator') THEN true
    WHEN app.current_user_role() = 'customer' THEN EXISTS (
      SELECT 1 FROM app.user_company_access access
      WHERE access.user_id = app.current_user_id()
        AND access.company_id = target_company_id
        AND access.revoked_at IS NULL
    )
    WHEN app.current_user_role() = 'sales_representative' THEN EXISTS (
      SELECT 1
      FROM app.representatives representative
      JOIN app.representative_company_assignments assignment
        ON assignment.representative_id = representative.id
      WHERE representative.user_id = app.current_user_id()
        AND assignment.company_id = target_company_id
        AND assignment.starts_at <= now()
        AND (assignment.ends_at IS NULL OR assignment.ends_at > now())
    )
    ELSE false
  END
$$;

ALTER TABLE app.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_authorised_scope ON app.companies
  USING (app.can_access_company(id));

CREATE POLICY enquiries_authorised_scope ON app.enquiries
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));

CREATE POLICY enquiry_items_authorised_scope ON app.enquiry_items
  USING (EXISTS (
    SELECT 1 FROM app.enquiries enquiry
    WHERE enquiry.id = enquiry_id AND app.can_access_company(enquiry.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.enquiries enquiry
    WHERE enquiry.id = enquiry_id AND app.can_access_company(enquiry.company_id)
  ));

CREATE POLICY enquiry_drafts_authorised_scope ON app.enquiry_drafts
  USING (user_id = app.current_user_id() AND app.can_access_company(company_id))
  WITH CHECK (user_id = app.current_user_id() AND app.can_access_company(company_id));

CREATE POLICY orders_authorised_scope ON app.orders
  USING (app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));

CREATE POLICY workflow_events_authorised_scope ON app.workflow_events
  USING (
    (enquiry_id IS NOT NULL AND EXISTS (SELECT 1 FROM app.enquiries enquiry WHERE enquiry.id = enquiry_id AND app.can_access_company(enquiry.company_id)))
    OR
    (order_id IS NOT NULL AND EXISTS (SELECT 1 FROM app.orders customer_order WHERE customer_order.id = order_id AND app.can_access_company(customer_order.company_id)))
  );

CREATE POLICY notifications_authorised_scope ON app.notifications
  USING (
    app.can_access_company(company_id)
    AND (recipient_user_id IS NULL OR recipient_user_id = app.current_user_id() OR app.current_user_role() IN ('manager', 'administrator'))
  );

CREATE POLICY documents_authorised_scope ON app.uploaded_documents
  USING (deleted_at IS NULL AND app.can_access_company(company_id))
  WITH CHECK (app.can_access_company(company_id));

-- RLS limits row scope; database grants must separately limit operations by the API role.
-- In particular, customers must not receive UPDATE/DELETE rights on workflow events,
-- pricing snapshots, representative assignments, users, products or audit events.

COMMIT;
