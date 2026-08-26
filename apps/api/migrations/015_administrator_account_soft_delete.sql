-- Administrator-only account deletion is a soft deletion. Operational and audit
-- history remains intact, while authentication, assignments and memberships end.

CREATE FUNCTION app.soft_delete_user(p_user_id uuid,p_reason text,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_target app.users%ROWTYPE; v_company_id uuid; v_deleted_at timestamptz:=now();
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN
    RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501';
  END IF;
  IF length(trim(COALESCE(p_reason,'')))<8 THEN RAISE EXCEPTION 'deletion reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_target FROM app.users WHERE id=p_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE='P0002'; END IF;
  IF p_user_id=v_actor OR EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=p_user_id AND role_code='administrator' AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'protected Administrator account' USING ERRCODE='42501';
  END IF;
  SELECT company_id INTO v_company_id FROM app.company_users WHERE user_id=p_user_id AND revoked_at IS NULL ORDER BY granted_at LIMIT 1;
  UPDATE app.users SET status='archived',disabled_at=v_deleted_at,deleted_at=v_deleted_at WHERE id=p_user_id;
  UPDATE app.sessions SET revoked_at=COALESCE(revoked_at,v_deleted_at) WHERE user_id=p_user_id;
  UPDATE app.company_users SET revoked_at=COALESCE(revoked_at,v_deleted_at) WHERE user_id=p_user_id;
  UPDATE app.user_roles SET revoked_at=COALESCE(revoked_at,v_deleted_at) WHERE user_id=p_user_id;
  UPDATE app.representative_company_assignments assignment SET ended_at=COALESCE(assignment.ended_at,v_deleted_at)
    FROM app.representatives representative WHERE representative.user_id=p_user_id AND assignment.representative_id=representative.id AND assignment.ended_at IS NULL;
  UPDATE app.representatives SET is_active=false WHERE user_id=p_user_id;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('administrator.user_soft_deleted',v_actor,'administrator',v_company_id,'delete_user_account','user',p_user_id::text,'success',p_correlation_id,
      jsonb_build_object('reason',trim(p_reason),'hardDeleted',false));
  RETURN jsonb_build_object('id',p_user_id,'status','deleted','deletedAt',v_deleted_at);
END;
$$;
REVOKE ALL ON FUNCTION app.soft_delete_user(uuid,text,text) FROM PUBLIC;
