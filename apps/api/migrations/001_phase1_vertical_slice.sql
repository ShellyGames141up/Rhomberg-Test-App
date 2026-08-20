CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_company_ids() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_to_array(NULLIF(current_setting('app.company_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[])
$$;

CREATE TABLE app.companies (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 200),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'disabled', 'archived')),
  area text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE app.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 160),
  password_hash text NOT NULL,
  identity_provider text NOT NULL DEFAULT 'development_password',
  external_subject text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'disabled', 'archived')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT external_identity_pair CHECK (
    (identity_provider = 'development_password' AND external_subject IS NULL)
    OR (identity_provider <> 'development_password' AND external_subject IS NOT NULL)
  )
);

CREATE TABLE app.roles (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  name text NOT NULL UNIQUE,
  is_internal boolean NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE app.permissions (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE app.role_permissions (
  role_code text NOT NULL REFERENCES app.roles(code),
  permission_code text NOT NULL REFERENCES app.permissions(code),
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE app.user_roles (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES app.roles(code),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, role_code, assigned_at)
);

CREATE TABLE app.company_users (
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE app.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  csrf_token_hash text NOT NULL CHECK (length(csrf_token_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  CHECK (expires_at > created_at)
);

CREATE TABLE app.products (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  configuration_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(configuration_schema) = 'array')
);

CREATE TABLE app.representatives (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES app.users(id),
  display_name text NOT NULL,
  branch_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE app.representative_company_assignments (
  representative_id uuid NOT NULL REFERENCES app.representatives(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  PRIMARY KEY (representative_id, company_id, assigned_at),
  CHECK (ended_at IS NULL OR ended_at > assigned_at)
);

CREATE SEQUENCE app.rfq_reference_sequence START WITH 1;

CREATE TABLE app.rfqs (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  requester_user_id uuid NOT NULL REFERENCES app.users(id),
  representative_id uuid NOT NULL REFERENCES app.representatives(id),
  status text NOT NULL DEFAULT 'assigned_to_rep' CHECK (status IN ('submitted', 'assigned_to_rep')),
  internal_priority text NOT NULL DEFAULT 'standard' CHECK (internal_priority IN ('standard', 'high', 'urgent')),
  application text NOT NULL CHECK (length(trim(application)) BETWEEN 5 AND 2000),
  process_medium text CHECK (process_medium IS NULL OR length(process_medium) <= 500),
  area text NOT NULL CHECK (length(trim(area)) BETWEEN 2 AND 120),
  fulfilment text NOT NULL CHECK (fulfilment IN ('delivery', 'collect')),
  delivery_address text,
  collection_branch text,
  customer_notes text CHECK (customer_notes IS NULL OR length(customer_notes) <= 2000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CONSTRAINT rfq_fulfilment_details CHECK (
    (fulfilment = 'delivery' AND delivery_address IS NOT NULL AND length(trim(delivery_address)) >= 5)
    OR (fulfilment = 'collect' AND collection_branch IS NOT NULL AND length(trim(collection_branch)) >= 2)
  )
);

CREATE TABLE app.rfq_items (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES app.rfqs(id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number > 0),
  product_id text NOT NULL REFERENCES app.products(id),
  product_code_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, line_number),
  CHECK (jsonb_typeof(configuration) = 'object')
);

CREATE TABLE app.document_metadata (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  rfq_id uuid NOT NULL REFERENCES app.rfqs(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES app.users(id),
  kind text NOT NULL CHECK (kind IN ('purchase_order', 'supporting_document')),
  original_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 4194304),
  sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'rejected', 'failed')),
  customer_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE app.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES app.users(id),
  actor_role text,
  company_id uuid REFERENCES app.companies(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failed', 'denied', 'idempotent_replay')),
  correlation_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(details) = 'object')
);

CREATE OR REPLACE FUNCTION app.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON app.audit_events
FOR EACH ROW EXECUTE FUNCTION app.reject_audit_mutation();

CREATE TABLE app.notifications (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  recipient_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES app.rfqs(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('rfq_submitted', 'rfq_assigned')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  customer_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE TABLE app.idempotency_records (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (length(request_hash) = 64),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, operation, idempotency_key),
  CHECK (expires_at > created_at)
);

CREATE INDEX sessions_active_token_idx ON app.sessions (token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX rfqs_company_created_idx ON app.rfqs (company_id, created_at DESC);
CREATE INDEX rfqs_representative_status_idx ON app.rfqs (representative_id, status, created_at DESC);
CREATE INDEX rfq_items_rfq_idx ON app.rfq_items (rfq_id, line_number);
CREATE INDEX documents_company_rfq_idx ON app.document_metadata (company_id, rfq_id) WHERE deleted_at IS NULL;
CREATE INDEX notifications_recipient_unread_idx ON app.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX audit_entity_idx ON app.audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idempotency_expiry_idx ON app.idempotency_records (expires_at);

INSERT INTO app.roles (code, name, is_internal) VALUES
  ('customer', 'Customer', false),
  ('sales_representative', 'Sales representative', true),
  ('manager', 'Manager', true),
  ('administrator', 'Administrator', true);

INSERT INTO app.permissions (code, description) VALUES
  ('create_rfq', 'Create an RFQ for an authorised company.'),
  ('view_own_company_rfqs', 'View RFQs belonging to an authorised company.'),
  ('view_assigned_rfqs', 'View RFQs assigned to the representative.'),
  ('view_all_rfqs', 'View all RFQs in approved operational scope.'),
  ('read_document_metadata', 'Read authorised private document metadata.');

INSERT INTO app.role_permissions (role_code, permission_code) VALUES
  ('customer', 'create_rfq'),
  ('customer', 'view_own_company_rfqs'),
  ('customer', 'read_document_metadata'),
  ('sales_representative', 'view_assigned_rfqs'),
  ('sales_representative', 'read_document_metadata'),
  ('manager', 'view_all_rfqs'),
  ('manager', 'read_document_metadata'),
  ('administrator', 'view_all_rfqs'),
  ('administrator', 'read_document_metadata');

ALTER TABLE app.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.document_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_authorised_scope ON app.companies
  USING (id = ANY(app.current_company_ids()) OR current_setting('app.can_view_all_rfqs', true) = 'enabled');
CREATE POLICY users_self_or_auth_lookup ON app.users
  USING (
    id = app.current_user_id()
    OR current_setting('app.authentication_lookup', true) = 'enabled'
    OR EXISTS (
      SELECT 1 FROM app.company_users cu
      WHERE cu.user_id = id AND cu.company_id = ANY(app.current_company_ids()) AND cu.revoked_at IS NULL
    )
  );
CREATE POLICY company_users_authorised_scope ON app.company_users
  USING (user_id = app.current_user_id() OR company_id = ANY(app.current_company_ids()));
CREATE POLICY sessions_own_scope ON app.sessions
  USING (user_id = app.current_user_id() OR current_setting('app.authentication_lookup', true) = 'enabled');
CREATE POLICY rfqs_authorised_company_scope ON app.rfqs
  USING (company_id = ANY(app.current_company_ids()) OR current_setting('app.can_view_all_rfqs', true) = 'enabled');
CREATE POLICY rfq_items_authorised_company_scope ON app.rfq_items
  USING (EXISTS (SELECT 1 FROM app.rfqs r WHERE r.id = rfq_id));
CREATE POLICY documents_authorised_company_scope ON app.document_metadata
  USING (company_id = ANY(app.current_company_ids()) OR current_setting('app.can_view_all_rfqs', true) = 'enabled');
CREATE POLICY notifications_recipient_scope ON app.notifications
  FOR SELECT USING (recipient_user_id = app.current_user_id() AND company_id = ANY(app.current_company_ids()));
CREATE POLICY notifications_authorised_insert ON app.notifications
  FOR INSERT WITH CHECK (company_id = ANY(app.current_company_ids()));
CREATE POLICY audit_management_read_scope ON app.audit_events
  FOR SELECT USING (
    company_id = ANY(app.current_company_ids())
    AND current_setting('app.can_read_audit', true) = 'enabled'
  );
CREATE POLICY audit_actor_insert_scope ON app.audit_events
  FOR INSERT WITH CHECK (
    actor_user_id = app.current_user_id()
    OR current_setting('app.authentication_lookup', true) = 'enabled'
  );
CREATE POLICY idempotency_own_scope ON app.idempotency_records
  USING (user_id = app.current_user_id());
