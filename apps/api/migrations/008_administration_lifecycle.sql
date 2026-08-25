-- Controlled Administrator lifecycle operations. No identities or business
-- records are seeded by this migration.

CREATE TABLE app.user_permission_grants (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES app.permissions(code),
  granted_by_user_id uuid NOT NULL REFERENCES app.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY(user_id, permission_code)
);

CREATE TABLE app.user_profile_images (
  user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  original_name text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image/png','image/jpeg')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 4194304),
  sha256_hex text NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES app.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.user_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_profile_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_permission_admin_scope ON app.user_permission_grants USING (app.current_context_has_permission('administer_users')) WITH CHECK (app.current_context_has_permission('administer_users'));
CREATE POLICY profile_image_authorised_scope ON app.user_profile_images USING (user_id=app.current_user_id() OR app.current_context_has_permission('administer_users')) WITH CHECK (app.current_context_has_permission('administer_users'));

CREATE FUNCTION app.administer_user(p_user_id uuid,p_operation text,p_payload jsonb,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_target app.users%ROWTYPE; v_roles text[]; v_permissions text[];
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_target FROM app.users WHERE id=p_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE='P0002'; END IF;
  IF p_user_id=v_actor AND p_operation IN ('status','archive','roles','permissions','temporary_password') THEN RAISE EXCEPTION 'self security change prohibited' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=p_user_id AND role_code='administrator' AND revoked_at IS NULL) AND p_operation IN ('status','archive','roles','permissions') THEN RAISE EXCEPTION 'protected Administrator account' USING ERRCODE='42501'; END IF;
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
      SELECT COALESCE(array_agg(value),ARRAY[]::text[]) INTO v_roles FROM jsonb_array_elements_text(COALESCE(p_payload->'roles','[]')) value;
      IF array_length(v_roles,1) IS NULL OR EXISTS(SELECT 1 FROM unnest(v_roles) role WHERE role IN ('administrator','customer')) OR EXISTS(SELECT 1 FROM unnest(v_roles) role LEFT JOIN app.roles r ON r.code=role AND r.is_internal AND r.is_active WHERE r.code IS NULL) THEN RAISE EXCEPTION 'invalid role assignment' USING ERRCODE='22023'; END IF;
      UPDATE app.user_roles SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id AND role_code<>'administrator';
      INSERT INTO app.user_roles(user_id,role_code) SELECT p_user_id,role FROM unnest(v_roles) role ON CONFLICT(user_id,role_code) DO UPDATE SET revoked_at=NULL,assigned_at=now();
    WHEN 'permissions' THEN
      SELECT COALESCE(array_agg(value),ARRAY[]::text[]) INTO v_permissions FROM jsonb_array_elements_text(COALESCE(p_payload->'permissions','[]')) value;
      IF EXISTS(SELECT 1 FROM unnest(v_permissions) requested LEFT JOIN app.permissions permission ON permission.code=requested AND permission.is_active WHERE permission.code IS NULL) THEN RAISE EXCEPTION 'invalid permission assignment' USING ERRCODE='22023'; END IF;
      UPDATE app.user_permission_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=p_user_id;
      INSERT INTO app.user_permission_grants(user_id,permission_code,granted_by_user_id) SELECT p_user_id,permission,v_actor FROM unnest(v_permissions) permission ON CONFLICT(user_id,permission_code) DO UPDATE SET revoked_at=NULL,granted_by_user_id=v_actor,granted_at=now();
    WHEN 'notification_preferences' THEN
      INSERT INTO app.notification_preferences(user_id,preferences) VALUES(p_user_id,COALESCE(p_payload->'preferences','{}')) ON CONFLICT(user_id) DO UPDATE SET preferences=EXCLUDED.preferences,updated_at=now();
    ELSE RAISE EXCEPTION 'unsupported administration operation' USING ERRCODE='22023';
  END CASE;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('administrator.user_changed',v_actor,'administrator','admin_'||p_operation,'user',p_user_id::text,'success',p_correlation_id,jsonb_build_object('operation',p_operation,'reason',COALESCE(p_payload->>'reason','')));
  RETURN jsonb_build_object('id',p_user_id,'operation',p_operation,'status',(SELECT status FROM app.users WHERE id=p_user_id));
END;
$$;
REVOKE ALL ON FUNCTION app.administer_user(uuid,text,jsonb,text) FROM PUBLIC;

CREATE FUNCTION app.administer_company(p_company_id uuid,p_operation text,p_payload jsonb,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_rep uuid;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM app.companies WHERE id=p_company_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'company not found' USING ERRCODE='P0002'; END IF;
  IF p_operation='update' THEN UPDATE app.companies SET name=COALESCE(NULLIF(trim(p_payload->>'name'),''),name),area=COALESCE(p_payload->>'area',area),industry=COALESCE(p_payload->>'industry',industry),branch_id=COALESCE(p_payload->>'branchId',branch_id),updated_at=now() WHERE id=p_company_id;
  ELSIF p_operation='representative' THEN
    v_rep=(p_payload->>'representativeId')::uuid; IF NOT EXISTS(SELECT 1 FROM app.representatives WHERE id=v_rep AND is_active) THEN RAISE EXCEPTION 'representative unavailable' USING ERRCODE='P0002'; END IF;
    UPDATE app.representative_company_assignments SET ended_at=COALESCE(ended_at,now()) WHERE company_id=p_company_id AND ended_at IS NULL;
    INSERT INTO app.representative_company_assignments(representative_id,company_id) VALUES(v_rep,p_company_id);
  ELSE RAISE EXCEPTION 'unsupported company operation' USING ERRCODE='22023'; END IF;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details) VALUES('administrator.company_changed',v_actor,'administrator',p_company_id,'admin_'||p_operation,'company',p_company_id::text,'success',p_correlation_id,jsonb_build_object('operation',p_operation,'reason',COALESCE(p_payload->>'reason','')));
  RETURN jsonb_build_object('id',p_company_id,'operation',p_operation);
END;
$$;
REVOKE ALL ON FUNCTION app.administer_company(uuid,text,jsonb,text) FROM PUBLIC;

CREATE FUNCTION app.admin_user_login_history(p_user_id uuid)
RETURNS TABLE(id uuid,created_at timestamptz,last_seen_at timestamptz,expires_at timestamptz,revoked_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
  SELECT session.id,session.created_at,session.last_seen_at,session.expires_at,session.revoked_at FROM app.sessions session
  WHERE app.current_context_has_permission('administer_users') AND session.user_id=p_user_id ORDER BY session.created_at DESC LIMIT 100
$$;
REVOKE ALL ON FUNCTION app.admin_user_login_history(uuid) FROM PUBLIC;
