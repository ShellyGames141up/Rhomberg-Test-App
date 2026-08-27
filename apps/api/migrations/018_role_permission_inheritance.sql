-- Role inheritance and explicit per-user exceptions. No identities are seeded.
-- Complete the existing approved defaults for previously empty role mappings.
-- Buyer remains prepared/inactive: no queue or workflow mutation permission.
INSERT INTO app.role_permissions(role_code,permission_code)
SELECT approved.role_code,approved.permission_code FROM (VALUES
  ('quality_manager','access_internal_workspace'),('quality_manager','read_catalogue'),
  ('quality_manager','view_qa_queue'),('quality_manager','inspect_order'),
  ('quality_manager','record_qa_failure'),('quality_manager','manage_qa_rework'),
  ('quality_manager','release_qa_order'),('quality_manager','export_order_pdf'),
  ('quality_manager','read_audit_history'),('quality_manager','change_own_username'),
  ('quality_manager','change_own_password'),
  ('buyer','access_internal_workspace'),('buyer','read_catalogue'),
  ('buyer','change_own_username'),('buyer','change_own_password')
) approved(role_code,permission_code)
JOIN app.roles r ON r.code=approved.role_code AND r.is_active
JOIN app.permissions p ON p.code=approved.permission_code AND p.is_active
ON CONFLICT DO NOTHING;

-- Historical assignments remain intact; remove only duplicate *active* entries.
WITH ranked AS (
  SELECT user_id,role_code,assigned_at,row_number() OVER(PARTITION BY user_id,role_code ORDER BY assigned_at) AS position
  FROM app.user_roles WHERE revoked_at IS NULL
)
UPDATE app.user_roles ur SET revoked_at=clock_timestamp() FROM ranked d
WHERE d.position>1 AND ur.user_id=d.user_id AND ur.role_code=d.role_code AND ur.assigned_at=d.assigned_at;
CREATE UNIQUE INDEX user_roles_one_active_idx ON app.user_roles(user_id,role_code) WHERE revoked_at IS NULL;

CREATE TABLE app.user_permission_denials (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES app.permissions(code),
  denied_by_user_id uuid NOT NULL REFERENCES app.users(id),
  denied_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY(user_id,permission_code)
);
ALTER TABLE app.user_permission_denials ENABLE ROW LEVEL SECURITY;
-- Runtime only receives SELECT; writes must go through administer_user.
CREATE POLICY permission_denials_read ON app.user_permission_denials FOR SELECT
  USING(user_id=app.current_user_id() OR app.current_context_has_permission('administer_users'));
CREATE POLICY permission_grants_self_read ON app.user_permission_grants FOR SELECT
  USING(user_id=app.current_user_id());

-- Older releases accepted any permission code into the grants table. Do not
-- activate latent Administrator/customer overrides when fixing RLS inheritance.
-- Preserve the rows and record each revoked unsafe exception in immutable audit.
WITH revoked AS (
  UPDATE app.user_permission_grants g SET revoked_at=now()
  WHERE g.revoked_at IS NULL AND (
    NOT EXISTS(SELECT 1 FROM app.role_permissions rp JOIN app.roles r ON r.code=rp.role_code
      WHERE rp.permission_code=g.permission_code AND r.is_active AND r.is_internal AND r.code<>'administrator')
    OR EXISTS(SELECT 1 FROM app.user_roles ur WHERE ur.user_id=g.user_id AND ur.role_code='customer' AND ur.revoked_at IS NULL)
  ) RETURNING g.user_id,g.permission_code
)
INSERT INTO app.audit_events(event_type,actor_role,action,entity_type,entity_id,outcome,correlation_id,details)
SELECT 'administrator.unsafe_permission_revoked','migration','revoke_unsafe_permission','user',user_id::text,
  'success','migration-018',jsonb_build_object('permission',permission_code,'reason','Protected permission exception disallowed; role defaults unchanged')
FROM revoked;

CREATE OR REPLACE FUNCTION app.administer_user(p_user_id uuid,p_operation text,p_payload jsonb,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_target app.users%ROWTYPE; v_roles text[]; v_permissions text[]; v_defaults text[]; v_before jsonb; v_after jsonb;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_target FROM app.users WHERE id=p_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE='P0002'; END IF;
  IF p_user_id=v_actor AND p_operation IN ('status','archive','roles','permissions','temporary_password') THEN RAISE EXCEPTION 'self security change prohibited' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=p_user_id AND role_code='administrator' AND revoked_at IS NULL) AND p_operation IN ('status','archive','roles','permissions') THEN RAISE EXCEPTION 'protected Administrator account' USING ERRCODE='42501'; END IF;
  IF p_operation IN ('roles','permissions') THEN
    IF length(trim(COALESCE(p_payload->>'reason',''))) < 8 THEN RAISE EXCEPTION 'Record a reason of at least eight characters.' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=p_user_id AND role_code='customer' AND revoked_at IS NULL) THEN
      RAISE EXCEPTION 'Customer roles cannot be changed through internal account management.' USING ERRCODE='42501';
    END IF;
    SELECT jsonb_build_object(
      'roles',(SELECT COALESCE(jsonb_agg(role_code ORDER BY role_code),'[]') FROM app.user_roles WHERE user_id=p_user_id AND revoked_at IS NULL),
      'additionalPermissions',(SELECT COALESCE(jsonb_agg(permission_code ORDER BY permission_code),'[]') FROM app.user_permission_grants WHERE user_id=p_user_id AND revoked_at IS NULL),
      'deniedPermissions',(SELECT COALESCE(jsonb_agg(permission_code ORDER BY permission_code),'[]') FROM app.user_permission_denials WHERE user_id=p_user_id AND revoked_at IS NULL)
    ) INTO v_before;
  END IF;
  CASE p_operation
    WHEN 'update' THEN
      UPDATE app.users SET display_name=COALESCE(NULLIF(trim(p_payload->>'displayName'),''),display_name),
        username=COALESCE(NULLIF(trim(p_payload->>'username'),''),username), email=COALESCE(NULLIF(lower(trim(p_payload->>'email')),''),email),
        phone=COALESCE(p_payload->>'phone',phone),department=COALESCE(p_payload->>'department',department),branch_id=COALESCE(p_payload->>'branchId',branch_id)
        WHERE id=p_user_id;
    WHEN 'status' THEN
      IF p_payload->>'status' NOT IN ('active','disabled') THEN RAISE EXCEPTION 'invalid account status' USING ERRCODE='22023'; END IF;
      UPDATE app.users SET status=p_payload->>'status',disabled_at=CASE WHEN p_payload->>'status'='disabled' THEN now() ELSE NULL END WHERE id=p_user_id;
      IF p_payload->>'status'='disabled' THEN UPDATE app.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id; END IF;
    WHEN 'archive' THEN
      UPDATE app.users SET status='archived',disabled_at=now() WHERE id=p_user_id;
      UPDATE app.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id;
    WHEN 'branch' THEN UPDATE app.users SET branch_id=NULLIF(trim(p_payload->>'branchId'),'') WHERE id=p_user_id;
    WHEN 'temporary_password' THEN
      IF COALESCE(p_payload->>'passwordHash','') !~ '^scrypt[$]' THEN RAISE EXCEPTION 'invalid password hash' USING ERRCODE='22023'; END IF;
      UPDATE app.users SET password_hash=p_payload->>'passwordHash',must_change_password=true,status='active',disabled_at=NULL WHERE id=p_user_id;
      UPDATE app.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id;
    WHEN 'roles' THEN
      SELECT COALESCE(array_agg(DISTINCT value),ARRAY[]::text[]) INTO v_roles FROM jsonb_array_elements_text(COALESCE(p_payload->'roles','[]')) value;
      IF array_length(v_roles,1) IS NULL OR EXISTS(SELECT 1 FROM unnest(v_roles) role WHERE role IN ('administrator','customer')) OR EXISTS(SELECT 1 FROM unnest(v_roles) role LEFT JOIN app.roles r ON r.code=role AND r.is_internal AND r.is_active WHERE r.code IS NULL) THEN RAISE EXCEPTION 'invalid role assignment' USING ERRCODE='22023'; END IF;
      -- Keep unchanged roles and historical assignments. The target user row is
      -- locked above, serialising concurrent role/permission edits for this user.
      UPDATE app.user_roles SET revoked_at=clock_timestamp()
        WHERE user_id=p_user_id AND revoked_at IS NULL AND NOT role_code=ANY(v_roles);
      INSERT INTO app.user_roles(user_id,role_code,assigned_at)
        SELECT p_user_id,role,clock_timestamp() FROM unnest(v_roles) role
        WHERE NOT EXISTS(SELECT 1 FROM app.user_roles active WHERE active.user_id=p_user_id AND active.role_code=role AND active.revoked_at IS NULL);
      UPDATE app.sessions SET selected_role=NULL WHERE user_id=p_user_id AND NOT selected_role=ANY(v_roles);
      -- A newly assigned Sales workspace needs the same representative identity
      -- as a new Sales employee. Never regenerate its identity or historical links.
      IF 'sales_representative'=ANY(v_roles) THEN
        INSERT INTO app.representatives(id,user_id,display_name,branch_name,branch_id,code,is_active)
          VALUES(gen_random_uuid(),p_user_id,v_target.display_name,COALESCE(NULLIF(v_target.branch_id,''),'Unassigned'),
            v_target.branch_id,'ROLE-'||replace(p_user_id::text,'-',''),v_target.status='active')
          ON CONFLICT(user_id) DO UPDATE SET is_active=EXCLUDED.is_active;
      ELSE
        UPDATE app.representatives SET is_active=false WHERE user_id=p_user_id;
      END IF;
    WHEN 'permissions' THEN
      SELECT COALESCE(array_agg(value),ARRAY[]::text[]) INTO v_permissions FROM jsonb_array_elements_text(COALESCE(p_payload->'permissions','[]')) value;
      IF EXISTS(SELECT 1 FROM unnest(v_permissions) requested LEFT JOIN app.permissions permission ON permission.code=requested AND permission.is_active WHERE permission.code IS NULL) THEN RAISE EXCEPTION 'invalid permission assignment' USING ERRCODE='22023'; END IF;
      -- Do not permit an employee permission override to manufacture an
      -- Administrator. Only permissions belonging to active non-admin internal
      -- roles are available for individual assignment.
      IF EXISTS(SELECT 1 FROM unnest(v_permissions) requested WHERE NOT EXISTS(
        SELECT 1 FROM app.role_permissions rp JOIN app.roles r ON r.code=rp.role_code
        WHERE rp.permission_code=requested AND r.is_active AND r.is_internal AND r.code<>'administrator'
      )) THEN RAISE EXCEPTION 'Protected permissions cannot be assigned to an employee.' USING ERRCODE='42501'; END IF;
      SELECT COALESCE(array_agg(DISTINCT rp.permission_code),ARRAY[]::text[]) INTO v_defaults
        FROM app.user_roles ur JOIN app.roles r ON r.code=ur.role_code AND r.is_active
        JOIN app.role_permissions rp ON rp.role_code=ur.role_code JOIN app.permissions p ON p.code=rp.permission_code AND p.is_active
        WHERE ur.user_id=p_user_id AND ur.revoked_at IS NULL;
      -- Store exceptions, not a frozen copy of inherited permissions.
      UPDATE app.user_permission_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id;
      INSERT INTO app.user_permission_grants(user_id,permission_code,granted_by_user_id)
        SELECT p_user_id,permission,v_actor FROM unnest(v_permissions) permission WHERE NOT permission=ANY(v_defaults)
        ON CONFLICT(user_id,permission_code) DO UPDATE SET revoked_at=NULL,granted_by_user_id=v_actor,granted_at=now();
      UPDATE app.user_permission_denials SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id;
      INSERT INTO app.user_permission_denials(user_id,permission_code,denied_by_user_id)
        SELECT p_user_id,permission,v_actor FROM unnest(v_defaults) permission WHERE NOT permission=ANY(v_permissions)
        ON CONFLICT(user_id,permission_code) DO UPDATE SET revoked_at=NULL,denied_by_user_id=v_actor,denied_at=now();
    WHEN 'notification_preferences' THEN
      INSERT INTO app.notification_preferences(user_id,preferences) VALUES(p_user_id,COALESCE(p_payload->'preferences','{}')) ON CONFLICT(user_id) DO UPDATE SET preferences=EXCLUDED.preferences,updated_at=now();
    ELSE RAISE EXCEPTION 'unsupported administration operation' USING ERRCODE='22023';
  END CASE;
  IF p_operation IN ('roles','permissions') THEN
    SELECT jsonb_build_object(
      'roles',(SELECT COALESCE(jsonb_agg(role_code ORDER BY role_code),'[]') FROM app.user_roles WHERE user_id=p_user_id AND revoked_at IS NULL),
      'additionalPermissions',(SELECT COALESCE(jsonb_agg(permission_code ORDER BY permission_code),'[]') FROM app.user_permission_grants WHERE user_id=p_user_id AND revoked_at IS NULL),
      'deniedPermissions',(SELECT COALESCE(jsonb_agg(permission_code ORDER BY permission_code),'[]') FROM app.user_permission_denials WHERE user_id=p_user_id AND revoked_at IS NULL)
    ) INTO v_after;
  END IF;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('administrator.user_changed',v_actor,'administrator','admin_'||p_operation,'user',p_user_id::text,'success',p_correlation_id,jsonb_build_object('operation',p_operation,'reason',COALESCE(p_payload->>'reason',''),'previousValue',v_before,'newValue',v_after));
  RETURN jsonb_build_object('id',p_user_id,'operation',p_operation,'status',(SELECT status FROM app.users WHERE id=p_user_id));
END;
$$;
REVOKE ALL ON FUNCTION app.administer_user(uuid,text,jsonb,text) FROM PUBLIC;

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

  SELECT COALESCE(array_agg(permission_code),ARRAY[]::text[]) INTO v_permission_codes
  FROM (SELECT DISTINCT permission_code FROM (
      SELECT rp.permission_code FROM app.user_roles ur
      JOIN app.roles r ON r.code=ur.role_code AND r.is_active
      JOIN app.role_permissions rp ON rp.role_code=ur.role_code
      WHERE ur.user_id=v_user_id AND ur.revoked_at IS NULL
      UNION
      SELECT permission_code FROM app.user_permission_grants WHERE user_id=v_user_id AND revoked_at IS NULL
    ) candidate JOIN app.permissions p ON p.code=candidate.permission_code AND p.is_active
    WHERE NOT EXISTS(SELECT 1 FROM app.user_permission_denials d
      WHERE d.user_id=v_user_id AND d.permission_code=candidate.permission_code AND d.revoked_at IS NULL)) effective;
  v_can_read_audit := 'read_audit_history'=ANY(v_permission_codes) OR 'administer_users'=ANY(v_permission_codes);
  v_can_view_all_rfqs := 'view_all_rfqs'=ANY(v_permission_codes) OR 'administer_users'=ANY(v_permission_codes);

  DELETE FROM app.request_security_contexts WHERE backend_pid=pg_backend_pid();
  INSERT INTO app.request_security_contexts
    (backend_pid,transaction_id,user_id,company_ids,can_read_audit,can_view_all_rfqs,permission_codes)
  VALUES (pg_backend_pid(),txid_current(),v_user_id,v_company_ids,v_can_read_audit,v_can_view_all_rfqs,v_permission_codes);
  RETURN v_user_id;
END;
$$;
