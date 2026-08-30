CREATE OR REPLACE FUNCTION app.administer_company(p_company_id uuid,p_operation text,p_payload jsonb,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_rep uuid; v_company app.companies%ROWTYPE; v_rep_branch text; v_reason text;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_company FROM app.companies WHERE id=p_company_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'company not found' USING ERRCODE='P0002'; END IF;
  v_reason:=trim(COALESCE(p_payload->>'reason',''));
  IF p_operation='delete' THEN
    IF length(v_reason) NOT BETWEEN 8 AND 1000 THEN RAISE EXCEPTION 'company deletion reason required' USING ERRCODE='22023'; END IF;
    UPDATE app.companies SET deleted_at=now(),status='archived',updated_at=now() WHERE id=p_company_id;
    UPDATE app.company_users SET revoked_at=now() WHERE company_id=p_company_id AND revoked_at IS NULL;
    UPDATE app.representative_company_assignments SET ended_at=now() WHERE company_id=p_company_id AND ended_at IS NULL;
  ELSIF p_operation='update' THEN
    UPDATE app.companies SET name=COALESCE(NULLIF(trim(p_payload->>'name'),''),name),area=COALESCE(p_payload->>'area',area),industry=COALESCE(p_payload->>'industry',industry),branch_id=COALESCE(p_payload->>'branchId',branch_id),updated_at=now() WHERE id=p_company_id;
  ELSIF p_operation='representative' THEN
    v_rep=(p_payload->>'representativeId')::uuid;
    SELECT branch_id INTO v_rep_branch FROM app.representatives WHERE id=v_rep AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'representative unavailable' USING ERRCODE='P0002'; END IF;
    IF v_company.branch_id IS NULL OR v_rep_branch IS DISTINCT FROM v_company.branch_id THEN RAISE EXCEPTION 'representative is not eligible for the customer area' USING ERRCODE='22023'; END IF;
    UPDATE app.representative_company_assignments SET ended_at=COALESCE(ended_at,now()) WHERE company_id=p_company_id AND ended_at IS NULL;
    INSERT INTO app.representative_company_assignments(representative_id,company_id) VALUES(v_rep,p_company_id);
  ELSE RAISE EXCEPTION 'unsupported company operation' USING ERRCODE='22023'; END IF;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('administrator.company_changed',v_actor,'administrator',p_company_id,'admin_'||p_operation,'company',p_company_id::text,'success',p_correlation_id,
      jsonb_build_object('operation',p_operation,'reason',v_reason,'representativeId',CASE WHEN p_operation='representative' THEN p_payload->>'representativeId' ELSE NULL END));
  RETURN jsonb_build_object('id',p_company_id,'operation',p_operation,'status',CASE WHEN p_operation='delete' THEN 'deleted' ELSE 'active' END);
END;
$$;
REVOKE ALL ON FUNCTION app.administer_company(uuid,text,jsonb,text) FROM PUBLIC;
