-- Internal-test operational foundation. This migration contains schema and
-- authorisation metadata only; it intentionally seeds no users, companies or
-- business records.

INSERT INTO app.roles (code, name, is_internal) VALUES
  ('technical_support', 'Technical Advisor', true),
  ('technical_manager', 'Technical Manager', true),
  ('technical_director', 'Technical Director', true),
  ('planning', 'Planning', true),
  ('expeditor', 'Expeditor', true),
  ('laboratory_user', 'Laboratory User', true),
  ('laboratory_technician', 'Laboratory Technician', true),
  ('laboratory_temperature_technician', 'Laboratory Temperature Technician', true),
  ('laboratory_manager', 'Laboratory Manager', true),
  ('laboratory_manager_pressure', 'Pressure Laboratory Manager', true),
  ('laboratory_manager_temperature', 'Temperature Laboratory Manager', true),
  ('technical_signatory', 'Technical Signatory', true),
  ('laboratory_administrator', 'Laboratory Administrator', true),
  ('quality_assurance', 'Quality Assurance', true),
  ('quality_manager', 'Quality Manager', true),
  ('dispatch', 'Dispatch', true),
  ('buyer', 'Buyer', true),
  ('sales_manager', 'Sales Manager', true),
  ('branch_manager', 'Branch Manager', true),
  ('company_owner', 'Company Owner', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_internal = EXCLUDED.is_internal;

INSERT INTO app.permissions (code, description) VALUES
  ('access_customer_workspace', 'Access the customer application.'),
  ('access_internal_workspace', 'Access an internal operational workspace.'),
  ('read_catalogue', 'Read approved catalogue data.'),
  ('view_own_company_account', 'View an authorised customer company.'),
  ('view_all_companies', 'View all customer companies.'),
  ('load_customer_order', 'Load an accepted offline customer order.'),
  ('replace_order_source_document', 'Replace a controlled order source document.'),
  ('download_order_source_document', 'Download an authorised order source document.'),
  ('view_assigned_orders', 'View orders assigned to the representative.'),
  ('assign_rfq', 'Assign an RFQ.'),
  ('reassign_representative', 'Reassign an authorised record.'),
  ('mark_rfq_under_review', 'Start representative RFQ review.'),
  ('mark_rfq_quoted', 'Record an externally issued quotation.'),
  ('acknowledge_quotation', 'Acknowledge quotation receipt.'),
  ('accept_customer_order', 'Record accepted customer evidence.'),
  ('convert_rfq_to_order', 'Convert an accepted RFQ into an order.'),
  ('cancel_rfq', 'Cancel an RFQ.'),
  ('expire_rfq', 'Expire an RFQ.'),
  ('request_technical_support', 'Request Technical Support.'),
  ('view_technical_queue', 'View the Technical Support queue.'),
  ('assign_technical_support', 'Assign Technical Support work.'),
  ('respond_technical_support', 'Respond to Technical Support work.'),
  ('complete_technical_support', 'Complete Technical Support work.'),
  ('manage_technical_support', 'Manage Technical Support work.'),
  ('post_technical_message', 'Post a Technical Support message.'),
  ('respond_customer_technical_request', 'Respond to a customer-safe technical request.'),
  ('download_technical_documents', 'Download an authorised technical document.'),
  ('view_technical_metrics', 'View Technical Support metrics.'),
  ('override_technical_quotation_block', 'Override a technical quotation block.'),
  ('view_own_company_orders', 'View orders for an authorised customer company.'),
  ('view_planning_queue', 'View the Planning queue.'),
  ('add_planning_information', 'Add Planning information.'),
  ('submit_to_expediting', 'Submit an order to Expediting.'),
  ('view_expediting_queue', 'View the Expediting queue.'),
  ('update_order_progress', 'Update order progress.'),
  ('view_lab_queue', 'View the Laboratory queue.'),
  ('update_lab_work', 'Update Laboratory work.'),
  ('manage_certificates', 'Manage certificates.'),
  ('download_certificates', 'Download authorised certificates.'),
  ('view_qa_queue', 'View the QA queue.'),
  ('inspect_order', 'Inspect an order.'),
  ('record_qa_failure', 'Record a QA failure.'),
  ('manage_qa_rework', 'Manage QA rework.'),
  ('release_qa_order', 'Release a QA order.'),
  ('move_to_dispatch', 'Move an order to Dispatch.'),
  ('view_dispatch_queue', 'View the Dispatch queue.'),
  ('confirm_delivery', 'Confirm delivery.'),
  ('confirm_collection', 'Confirm collection.'),
  ('manage_order_hold', 'Place or resume an order hold.'),
  ('cancel_order', 'Cancel an order.'),
  ('view_all_orders', 'View all operational orders.'),
  ('export_order_pdf', 'Export an authorised order summary.'),
  ('email_order_summary', 'Queue an authorised order summary email.'),
  ('archive_orders', 'Archive eligible orders.'),
  ('restore_archived_orders', 'Restore an archived order.'),
  ('export_archived_orders', 'Export archived order records.'),
  ('manage_legal_hold', 'Manage legal holds.'),
  ('manage_retention_policy', 'Manage the retention policy.'),
  ('manage_customer_companies', 'Manage customer companies.'),
  ('manage_customer_contacts', 'Manage customer contacts.'),
  ('manage_internal_accounts', 'Manage internal accounts.'),
  ('manage_roles_permissions', 'Manage role permissions.'),
  ('manage_notification_preferences', 'Manage notification preferences.'),
  ('correct_approved_records', 'Correct approved records with audit history.'),
  ('override_workflow', 'Perform an authorised workflow override.'),
  ('approve_workflow_override', 'Approve a workflow override.'),
  ('approve_archival', 'Approve archival.'),
  ('read_audit_history', 'Read authorised audit history.'),
  ('retry_notification_delivery', 'Retry a notification delivery.'),
  ('manage_products', 'Manage approved catalogue metadata.'),
  ('view_reports', 'View operational reports.'),
  ('export_operational_reports', 'Export operational reports.'),
  ('view_executive_reports', 'View executive reports.'),
  ('view_sales_analytics', 'View sales analytics.'),
  ('view_commercial_analytics', 'View commercial analytics.'),
  ('export_management_pdf', 'Export management reporting.'),
  ('change_own_username', 'Change the current username.'),
  ('change_own_password', 'Change the current password.'),
  ('view_login_history', 'View authorised login history.'),
  ('reset_user_login', 'Reset a user login.'),
  ('manage_user_profile_images', 'Manage authorised profile images.'),
  ('view_assigned_clients', 'View assigned clients.'),
  ('schedule_client_visits', 'Schedule client visits.'),
  ('verify_client_visits', 'Verify client visits.'),
  ('view_visit_compliance', 'View visit compliance.'),
  ('view_own_work_location_summary', 'View own work-location summary.'),
  ('manage_location_settings', 'Manage location settings.')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, is_active = true;

-- The Administrator is an operational super-user but remains subject to the
-- same server-side route guards, CSRF protection and append-only audit rules.
INSERT INTO app.role_permissions (role_code, permission_code)
SELECT 'administrator', code FROM app.permissions
ON CONFLICT DO NOTHING;

-- Keep the server-authoritative Manager role aligned with the approved shared
-- permission matrix for oversight, governed records and report exports.
INSERT INTO app.role_permissions(role_code,permission_code)
SELECT 'manager',permission.code FROM app.permissions permission
WHERE permission.code IN (
  'read_catalogue','view_all_companies','view_all_rfqs','view_all_orders','reassign_representative',
  'export_order_pdf','email_order_summary','archive_orders','restore_archived_orders','export_archived_orders',
  'manage_legal_hold','approve_archival','approve_workflow_override','retry_notification_delivery',
  'view_reports','export_operational_reports','export_management_pdf','view_executive_reports','view_sales_analytics'
)
ON CONFLICT DO NOTHING;

INSERT INTO app.role_permissions (role_code, permission_code) VALUES
  ('customer','access_customer_workspace'),('customer','read_catalogue'),('customer','view_own_company_account'),
  ('customer','view_own_company_orders'),('customer','acknowledge_quotation'),('customer','download_order_source_document'),
  ('sales_representative','access_internal_workspace'),('sales_representative','read_catalogue'),
  ('sales_representative','view_assigned_orders'),('sales_representative','load_customer_order'),
  ('sales_representative','mark_rfq_under_review'),('sales_representative','mark_rfq_quoted'),
  ('sales_representative','accept_customer_order'),('sales_representative','convert_rfq_to_order'),
  ('sales_representative','request_technical_support'),('sales_representative','post_technical_message'),
  ('technical_support','access_internal_workspace'),('technical_support','read_catalogue'),
  ('technical_support','view_technical_queue'),('technical_support','assign_technical_support'),
  ('technical_support','respond_technical_support'),('technical_support','complete_technical_support'),
  ('technical_support','post_technical_message'),('technical_support','view_technical_metrics'),
  ('planning','access_internal_workspace'),('planning','read_catalogue'),('planning','view_planning_queue'),
  ('planning','add_planning_information'),('planning','submit_to_expediting'),
  ('expeditor','access_internal_workspace'),('expeditor','read_catalogue'),('expeditor','view_expediting_queue'),
  ('expeditor','update_order_progress'),('expeditor','move_to_dispatch'),
  ('quality_assurance','access_internal_workspace'),('quality_assurance','read_catalogue'),
  ('quality_assurance','view_qa_queue'),('quality_assurance','inspect_order'),
  ('quality_assurance','record_qa_failure'),('quality_assurance','release_qa_order'),
  ('dispatch','access_internal_workspace'),('dispatch','read_catalogue'),('dispatch','view_dispatch_queue'),
  ('dispatch','confirm_delivery'),('dispatch','confirm_collection'),
  ('manager','access_internal_workspace'),('manager','view_all_orders'),('manager','read_audit_history'),
  ('manager','view_reports'),('manager','override_workflow'),
  ('sales_manager','access_internal_workspace'),('sales_manager','view_all_rfqs'),
  ('sales_manager','view_all_orders'),('sales_manager','view_sales_analytics'),('sales_manager','read_audit_history'),('sales_manager','load_customer_order'),
  ('branch_manager','access_internal_workspace'),('branch_manager','view_all_orders'),('branch_manager','read_audit_history'),
  ('company_owner','access_internal_workspace'),('company_owner','view_all_orders'),
  ('company_owner','view_executive_reports'),('company_owner','read_audit_history')
ON CONFLICT DO NOTHING;

INSERT INTO app.role_permissions (role_code, permission_code)
SELECT role.code, permission.code
FROM app.roles role CROSS JOIN app.permissions permission
WHERE role.code IN ('technical_manager','technical_director')
  AND permission.code IN ('access_internal_workspace','read_catalogue','view_technical_queue','assign_technical_support','respond_technical_support','complete_technical_support','manage_technical_support','post_technical_message','download_technical_documents','view_technical_metrics','read_audit_history')
ON CONFLICT DO NOTHING;

INSERT INTO app.role_permissions (role_code, permission_code)
SELECT role.code, permission.code
FROM app.roles role CROSS JOIN app.permissions permission
WHERE role.code IN ('laboratory_user','laboratory_technician','laboratory_temperature_technician','laboratory_manager','laboratory_manager_pressure','laboratory_manager_temperature','technical_signatory','laboratory_administrator')
  AND permission.code IN ('access_internal_workspace','read_catalogue','view_lab_queue','update_lab_work','manage_certificates','download_certificates','read_audit_history')
ON CONFLICT DO NOTHING;

CREATE TABLE app.user_settings (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  row_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.rfqs DROP CONSTRAINT rfqs_status_check;
ALTER TABLE app.rfqs ADD CONSTRAINT rfqs_status_check CHECK (status IN (
  'draft','submitted','assigned_to_rep','under_rep_review','quoted','awaiting_customer_acceptance','accepted','cancelled','expired','converted_to_order'
));
ALTER TABLE app.rfqs ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object');

CREATE TABLE app.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.enquiry_drafts (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES app.companies(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE app.order_reference_sequence START WITH 1;
CREATE TABLE app.orders (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  source_rfq_id uuid UNIQUE REFERENCES app.rfqs(id),
  company_id uuid NOT NULL REFERENCES app.companies(id),
  customer_user_id uuid REFERENCES app.users(id),
  representative_id uuid REFERENCES app.representatives(id),
  origin text NOT NULL CHECK (origin IN ('customer_submitted_rfq_order','representative_loaded_order')),
  source text NOT NULL DEFAULT 'application' CHECK (source IN ('application','email','telephone','in_person','existing_quotation','other_approved_source')),
  status text NOT NULL DEFAULT 'awaiting_planning',
  internal_priority text NOT NULL DEFAULT 'standard' CHECK (internal_priority IN ('standard','high','urgent')),
  application text NOT NULL,
  fulfilment text NOT NULL CHECK (fulfilment IN ('delivery','collect')),
  delivery_address text,
  collection_branch text,
  customer_notes text,
  internal_notes text,
  quotation_number text,
  purchase_order_number text,
  required_date date,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  row_version integer NOT NULL DEFAULT 1,
  created_by_user_id uuid NOT NULL REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE app.order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  product_id text NOT NULL REFERENCES app.products(id),
  product_code_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  unit_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(unit_state) = 'object'),
  UNIQUE(order_id, line_number)
);

CREATE TABLE app.workflow_events (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  entity_type text NOT NULL CHECK (entity_type IN ('rfq','order','technical_support','appointment')),
  entity_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  action text NOT NULL,
  customer_note text,
  internal_note text,
  customer_visible boolean NOT NULL DEFAULT false,
  actor_user_id uuid NOT NULL REFERENCES app.users(id),
  actor_role text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.document_metadata ALTER COLUMN rfq_id DROP NOT NULL;
ALTER TABLE app.document_metadata ADD COLUMN order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE;
ALTER TABLE app.document_metadata DROP CONSTRAINT document_metadata_kind_check;
ALTER TABLE app.document_metadata ADD CONSTRAINT document_metadata_kind_check CHECK (kind IN ('purchase_order','supporting_document','quotation','technical_attachment','certificate','dispatch_proof','order_summary'));
ALTER TABLE app.document_metadata ADD CONSTRAINT document_metadata_parent_required CHECK (rfq_id IS NOT NULL OR order_id IS NOT NULL);

ALTER TABLE app.notifications ALTER COLUMN rfq_id DROP NOT NULL;
ALTER TABLE app.notifications ADD COLUMN order_id uuid REFERENCES app.orders(id) ON DELETE CASCADE;
ALTER TABLE app.notifications ADD COLUMN link_path text;
ALTER TABLE app.notifications ADD COLUMN deliveries jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(deliveries) = 'array');
ALTER TABLE app.notifications DROP CONSTRAINT notifications_event_type_check;

CREATE TABLE app.technical_support_requests (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  rfq_id uuid NOT NULL REFERENCES app.rfqs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  representative_id uuid NOT NULL REFERENCES app.representatives(id),
  requested_by_user_id uuid NOT NULL REFERENCES app.users(id),
  assigned_user_id uuid REFERENCES app.users(id),
  category text NOT NULL,
  question text NOT NULL,
  line_item_id uuid REFERENCES app.rfq_items(id),
  priority text NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard','high','urgent')),
  classification text NOT NULL CHECK (classification IN ('internal_only','customer_safe')),
  status text NOT NULL DEFAULT 'technical_support_requested',
  original_due_at timestamptz,
  revised_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE app.technical_support_messages (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES app.technical_support_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  sender_user_id uuid NOT NULL REFERENCES app.users(id),
  sender_role text NOT NULL,
  message text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('internal_only','customer_safe')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.document_metadata ADD COLUMN technical_request_id uuid REFERENCES app.technical_support_requests(id) ON DELETE CASCADE;

CREATE TABLE app.locations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  branch_code text NOT NULL UNIQUE,
  address text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  radius_metres integer NOT NULL DEFAULT 250 CHECK (radius_metres BETWEEN 25 AND 100000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.platform_policies (
  code text PRIMARY KEY,
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  updated_by_user_id uuid NOT NULL REFERENCES app.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_company_created_idx ON app.orders(company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX orders_rep_status_idx ON app.orders(representative_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX workflow_events_entity_idx ON app.workflow_events(entity_type, entity_id, created_at DESC);
CREATE INDEX technical_queue_idx ON app.technical_support_requests(status, priority, updated_at);
CREATE INDEX technical_messages_request_idx ON app.technical_support_messages(request_id, created_at);

ALTER TABLE app.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.enquiry_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.technical_support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_settings_own_scope ON app.user_settings USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY notification_preferences_own_scope ON app.notification_preferences USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY enquiry_drafts_own_scope ON app.enquiry_drafts USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
CREATE POLICY orders_company_scope ON app.orders USING (company_id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());
CREATE POLICY order_items_parent_scope ON app.order_items USING (EXISTS (SELECT 1 FROM app.orders parent WHERE parent.id = order_id));
CREATE POLICY workflow_events_company_scope ON app.workflow_events USING (company_id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());
CREATE POLICY technical_requests_company_scope ON app.technical_support_requests USING (company_id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());
CREATE POLICY technical_messages_company_scope ON app.technical_support_messages USING (company_id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());

-- Queue permissions are carried into the transaction-bound request context so
-- RLS remains authoritative for internal users who are not customer-company
-- members (Planning, Expediting, Laboratory, QA and Dispatch).
ALTER TABLE app.request_security_contexts ADD COLUMN permission_codes text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE OR REPLACE FUNCTION app.establish_request_context(p_session_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
DECLARE
  v_user_id uuid;
  v_company_ids uuid[];
  v_permission_codes text[];
  v_can_read_audit boolean;
  v_can_view_all_rfqs boolean;
BEGIN
  SELECT s.user_id INTO v_user_id
  FROM app.sessions s JOIN app.users u ON u.id=s.user_id
  WHERE s.token_hash=p_session_token_hash AND s.revoked_at IS NULL AND s.expires_at>now()
    AND u.status='active' AND u.disabled_at IS NULL AND u.deleted_at IS NULL;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'active session required' USING ERRCODE='28000'; END IF;

  SELECT COALESCE(array_agg(DISTINCT scoped.company_id),ARRAY[]::uuid[]) INTO v_company_ids
  FROM (
    SELECT cu.company_id FROM app.company_users cu JOIN app.companies c ON c.id=cu.company_id
      WHERE cu.user_id=v_user_id AND cu.revoked_at IS NULL AND c.status='active' AND c.deleted_at IS NULL
    UNION
    SELECT assignment.company_id FROM app.representatives representative
      JOIN app.representative_company_assignments assignment ON assignment.representative_id=representative.id AND assignment.ended_at IS NULL
      JOIN app.companies c ON c.id=assignment.company_id
      WHERE representative.user_id=v_user_id AND representative.is_active AND c.status='active' AND c.deleted_at IS NULL
  ) scoped;

  SELECT COALESCE(array_agg(DISTINCT rp.permission_code),ARRAY[]::text[]) INTO v_permission_codes
  FROM app.user_roles ur JOIN app.role_permissions rp ON rp.role_code=ur.role_code
  JOIN app.permissions permission ON permission.code=rp.permission_code AND permission.is_active
  WHERE ur.user_id=v_user_id AND ur.revoked_at IS NULL;
  v_can_read_audit := 'read_audit_history'=ANY(v_permission_codes) OR 'administer_users'=ANY(v_permission_codes);
  v_can_view_all_rfqs := 'view_all_rfqs'=ANY(v_permission_codes) OR 'administer_users'=ANY(v_permission_codes);

  DELETE FROM app.request_security_contexts WHERE backend_pid=pg_backend_pid();
  INSERT INTO app.request_security_contexts
    (backend_pid,transaction_id,user_id,company_ids,can_read_audit,can_view_all_rfqs,permission_codes)
  VALUES (pg_backend_pid(),txid_current(),v_user_id,v_company_ids,v_can_read_audit,v_can_view_all_rfqs,v_permission_codes);
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_context_has_permission(p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.request_security_contexts context,
      unnest(context.permission_codes) AS granted(permission_code)
    WHERE context.backend_pid=pg_backend_pid() AND context.transaction_id=txid_current()
      AND granted.permission_code=p_permission
  )
$$;
REVOKE ALL ON FUNCTION app.current_context_has_permission(text) FROM PUBLIC;

DROP POLICY companies_authorised_scope ON app.companies;
CREATE POLICY companies_authorised_scope ON app.companies USING (
  id=ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs()
  OR app.current_context_has_permission('view_planning_queue') OR app.current_context_has_permission('view_expediting_queue')
  OR app.current_context_has_permission('view_lab_queue') OR app.current_context_has_permission('view_qa_queue')
  OR app.current_context_has_permission('view_dispatch_queue')
);

DROP POLICY users_authorised_scope ON app.users;
CREATE POLICY users_authorised_scope ON app.users USING (
  id=app.current_user_id() OR current_setting('app.authentication_lookup',true)='enabled'
  OR EXISTS (SELECT 1 FROM app.company_users membership WHERE membership.user_id=id AND membership.company_id=ANY(app.current_company_ids()) AND membership.revoked_at IS NULL)
  OR EXISTS (SELECT 1 FROM app.rfqs authorised_rfq WHERE authorised_rfq.requester_user_id=id)
  OR EXISTS (SELECT 1 FROM app.orders authorised_order WHERE authorised_order.customer_user_id=id AND authorised_order.deleted_at IS NULL)
);

DROP POLICY orders_company_scope ON app.orders;
CREATE POLICY orders_operational_scope ON app.orders USING (
  company_id=ANY(app.current_company_ids())
  OR app.current_context_has_permission('view_all_orders')
  OR app.current_context_has_permission('view_planning_queue')
  OR app.current_context_has_permission('view_expediting_queue')
  OR app.current_context_has_permission('view_lab_queue')
  OR app.current_context_has_permission('view_qa_queue')
  OR app.current_context_has_permission('view_dispatch_queue')
);

DROP POLICY workflow_events_company_scope ON app.workflow_events;
CREATE POLICY workflow_events_operational_scope ON app.workflow_events USING (
  company_id=ANY(app.current_company_ids()) OR app.current_context_has_permission('view_all_orders')
  OR app.current_context_has_permission('view_planning_queue') OR app.current_context_has_permission('view_expediting_queue')
  OR app.current_context_has_permission('view_lab_queue') OR app.current_context_has_permission('view_qa_queue')
  OR app.current_context_has_permission('view_dispatch_queue')
);

DROP POLICY technical_requests_company_scope ON app.technical_support_requests;
CREATE POLICY technical_requests_operational_scope ON app.technical_support_requests USING (
  company_id=ANY(app.current_company_ids()) OR app.current_context_has_permission('view_technical_queue')
  OR app.current_context_has_permission('request_technical_support')
);
DROP POLICY technical_messages_company_scope ON app.technical_support_messages;
CREATE POLICY technical_messages_operational_scope ON app.technical_support_messages USING (
  company_id=ANY(app.current_company_ids()) OR app.current_context_has_permission('view_technical_queue')
  OR app.current_context_has_permission('post_technical_message')
);
DROP POLICY documents_authorised_company_scope ON app.document_metadata;
CREATE POLICY documents_operational_scope ON app.document_metadata USING (
  company_id=ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs()
  OR (technical_request_id IS NOT NULL AND app.current_context_has_permission('download_technical_documents'))
) WITH CHECK (
  company_id=ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs()
  OR (technical_request_id IS NOT NULL AND app.current_context_has_permission('post_technical_message'))
);

DROP POLICY audit_management_read_scope ON app.audit_events;
CREATE POLICY audit_management_read_scope ON app.audit_events FOR SELECT USING (
  app.current_context_can_read_audit()
  AND (company_id IS NULL OR company_id=ANY(app.current_company_ids()) OR app.current_context_has_permission('view_all_orders') OR app.current_context_has_permission('administer_users'))
);

DROP POLICY notifications_authorised_insert ON app.notifications;
DROP POLICY notifications_recipient_scope ON app.notifications;
CREATE POLICY notifications_recipient_scope ON app.notifications FOR SELECT USING (
  recipient_user_id=app.current_user_id()
);
CREATE POLICY notifications_operational_insert ON app.notifications FOR INSERT WITH CHECK (
  company_id=ANY(app.current_company_ids())
  OR (rfq_id IS NOT NULL AND EXISTS (SELECT 1 FROM app.rfqs authorised_rfq WHERE authorised_rfq.id=rfq_id))
  OR (order_id IS NOT NULL AND EXISTS (SELECT 1 FROM app.orders authorised_order WHERE authorised_order.id=order_id AND authorised_order.deleted_at IS NULL))
  OR app.current_context_has_permission('view_all_orders') OR app.current_context_has_permission('administer_users')
);
