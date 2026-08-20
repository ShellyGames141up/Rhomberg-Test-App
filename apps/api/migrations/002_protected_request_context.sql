CREATE TABLE app.request_security_contexts (
  backend_pid integer PRIMARY KEY,
  transaction_id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  company_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  can_read_audit boolean NOT NULL DEFAULT false,
  can_view_all_rfqs boolean NOT NULL DEFAULT false,
  established_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON app.request_security_contexts FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.establish_request_context(p_session_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
DECLARE
  v_user_id uuid;
  v_company_ids uuid[];
  v_can_read_audit boolean;
  v_can_view_all_rfqs boolean;
BEGIN
  SELECT s.user_id
    INTO v_user_id
  FROM app.sessions s
  JOIN app.users u ON u.id = s.user_id
  WHERE s.token_hash = p_session_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND u.status = 'active'
    AND u.disabled_at IS NULL
    AND u.deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'active session required' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT scoped.company_id), ARRAY[]::uuid[])
    INTO v_company_ids
  FROM (
    SELECT cu.company_id
    FROM app.company_users cu
    JOIN app.companies c ON c.id = cu.company_id
    WHERE cu.user_id = v_user_id
      AND cu.revoked_at IS NULL
      AND c.status = 'active'
      AND c.deleted_at IS NULL
    UNION
    SELECT assignment.company_id
    FROM app.representatives representative
    JOIN app.representative_company_assignments assignment
      ON assignment.representative_id = representative.id
      AND assignment.ended_at IS NULL
    JOIN app.companies c ON c.id = assignment.company_id
    WHERE representative.user_id = v_user_id
      AND representative.is_active
      AND c.status = 'active'
      AND c.deleted_at IS NULL
  ) scoped;

  SELECT
    COALESCE(bool_or(rp.permission_code = 'read_audit_history'), false),
    COALESCE(bool_or(rp.permission_code = 'view_all_rfqs'), false)
    INTO v_can_read_audit, v_can_view_all_rfqs
  FROM app.user_roles ur
  JOIN app.role_permissions rp ON rp.role_code = ur.role_code
  JOIN app.permissions permission
    ON permission.code = rp.permission_code
    AND permission.is_active
  WHERE ur.user_id = v_user_id
    AND ur.revoked_at IS NULL;

  DELETE FROM app.request_security_contexts WHERE backend_pid = pg_backend_pid();
  INSERT INTO app.request_security_contexts
    (backend_pid, transaction_id, user_id, company_ids, can_read_audit, can_view_all_rfqs)
  VALUES
    (pg_backend_pid(), txid_current(), v_user_id, v_company_ids, v_can_read_audit, v_can_view_all_rfqs);

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
  SELECT context.user_id
  FROM app.request_security_contexts context
  WHERE context.backend_pid = pg_backend_pid()
    AND context.transaction_id = txid_current()
$$;

CREATE OR REPLACE FUNCTION app.current_company_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
  SELECT COALESCE((
    SELECT context.company_ids
    FROM app.request_security_contexts context
    WHERE context.backend_pid = pg_backend_pid()
      AND context.transaction_id = txid_current()
  ), ARRAY[]::uuid[])
$$;

CREATE OR REPLACE FUNCTION app.current_context_can_read_audit() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
  SELECT COALESCE((
    SELECT context.can_read_audit
    FROM app.request_security_contexts context
    WHERE context.backend_pid = pg_backend_pid()
      AND context.transaction_id = txid_current()
  ), false)
$$;

CREATE OR REPLACE FUNCTION app.current_context_can_view_all_rfqs() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
  SELECT COALESCE((
    SELECT context.can_view_all_rfqs
    FROM app.request_security_contexts context
    WHERE context.backend_pid = pg_backend_pid()
      AND context.transaction_id = txid_current()
  ), false)
$$;

DROP POLICY companies_authorised_scope ON app.companies;
CREATE POLICY companies_authorised_scope ON app.companies
  USING (id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());

DROP POLICY users_self_or_auth_lookup ON app.users;
CREATE POLICY users_authorised_scope ON app.users
  USING (
    id = app.current_user_id()
    OR current_setting('app.authentication_lookup', true) = 'enabled'
    OR EXISTS (
      SELECT 1 FROM app.company_users cu
      WHERE cu.user_id = id AND cu.company_id = ANY(app.current_company_ids()) AND cu.revoked_at IS NULL
    )
  );

DROP POLICY rfqs_authorised_company_scope ON app.rfqs;
CREATE POLICY rfqs_authorised_company_scope ON app.rfqs
  USING (company_id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());

DROP POLICY documents_authorised_company_scope ON app.document_metadata;
CREATE POLICY documents_authorised_company_scope ON app.document_metadata
  USING (company_id = ANY(app.current_company_ids()) OR app.current_context_can_view_all_rfqs());

DROP POLICY audit_management_read_scope ON app.audit_events;
CREATE POLICY audit_management_read_scope ON app.audit_events
  FOR SELECT USING (
    company_id = ANY(app.current_company_ids())
    AND app.current_context_can_read_audit()
  );

REVOKE ALL ON FUNCTION app.establish_request_context(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_company_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_context_can_read_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_context_can_view_all_rfqs() FROM PUBLIC;
