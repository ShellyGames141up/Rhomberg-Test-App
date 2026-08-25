BEGIN;

-- Complete a local-password account's first-login security step without
-- granting the runtime identity direct UPDATE access to the user directory.
CREATE FUNCTION app.change_own_password(p_password_hash text, p_correlation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,app
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_role text;
  v_company uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authenticated account required' USING ERRCODE='42501';
  END IF;
  IF COALESCE(p_password_hash,'') !~ '^scrypt[$][0-9]+[$][0-9]+[$][0-9]+[$][A-Za-z0-9_-]+[$][A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid password hash' USING ERRCODE='22023';
  END IF;

  SELECT role_code INTO v_role
  FROM app.user_roles
  WHERE user_id=v_actor AND revoked_at IS NULL
  ORDER BY assigned_at
  LIMIT 1;
  SELECT company_id INTO v_company
  FROM app.company_users
  WHERE user_id=v_actor AND revoked_at IS NULL
  ORDER BY is_primary DESC, granted_at
  LIMIT 1;

  UPDATE app.users
  SET password_hash=p_password_hash, must_change_password=false
  WHERE id=v_actor AND deleted_at IS NULL AND status='active' AND identity_provider='local_password';
  IF NOT FOUND THEN RAISE EXCEPTION 'active local account not found' USING ERRCODE='P0002'; END IF;

  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
  VALUES('authentication.password_changed',v_actor,v_role,v_company,'change_password','user',v_actor::text,'success',p_correlation_id,
    jsonb_build_object('sessionsRevoked',true,'firstLoginCompleted',true));

  UPDATE app.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=v_actor;
END;
$$;

REVOKE ALL ON FUNCTION app.change_own_password(text,text) FROM PUBLIC;

COMMIT;
