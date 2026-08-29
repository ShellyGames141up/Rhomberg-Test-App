INSERT INTO app.permissions(code,description) VALUES
  ('delete_operational_records','Soft-delete authorised operational records with a mandatory audited reason.')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description,is_active=true;

INSERT INTO app.role_permissions(role_code,permission_code) VALUES
  ('administrator','delete_operational_records'),
  ('planning','delete_operational_records')
ON CONFLICT DO NOTHING;

ALTER TABLE app.rfqs ADD COLUMN deleted_at timestamptz;
CREATE INDEX rfqs_active_updated_idx ON app.rfqs(updated_at DESC) WHERE deleted_at IS NULL;

CREATE FUNCTION app.soft_delete_operational_record(p_entity_type text,p_record_id uuid,p_reason text,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE
  v_actor uuid:=app.current_user_id(); v_is_admin boolean; v_is_planning boolean;
  v_company uuid; v_reference text; v_status text; v_deleted_at timestamptz; v_details jsonb;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('delete_operational_records') THEN
    RAISE EXCEPTION 'Record-deletion permission required' USING ERRCODE='42501';
  END IF;
  IF p_entity_type NOT IN ('rfq','order') THEN RAISE EXCEPTION 'Unsupported record type' USING ERRCODE='22023'; END IF;
  IF length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 1000 THEN RAISE EXCEPTION 'Deletion reason required' USING ERRCODE='22023'; END IF;
  SELECT EXISTS(SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.code=ur.role_code AND r.is_active WHERE ur.user_id=v_actor AND ur.role_code='administrator' AND ur.revoked_at IS NULL),
    EXISTS(SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.code=ur.role_code AND r.is_active WHERE ur.user_id=v_actor AND ur.role_code='planning' AND ur.revoked_at IS NULL)
    INTO v_is_admin,v_is_planning;
  IF p_entity_type='rfq' THEN
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Only an Administrator may remove an RFQ' USING ERRCODE='42501'; END IF;
    SELECT company_id,reference,status,deleted_at,details INTO v_company,v_reference,v_status,v_deleted_at,v_details FROM app.rfqs WHERE id=p_record_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE='P0002'; END IF;
    IF v_deleted_at IS NULL THEN UPDATE app.rfqs SET deleted_at=now(),updated_at=now(),row_version=row_version+1 WHERE id=p_record_id; END IF;
  ELSE
    SELECT company_id,reference,status,deleted_at,details INTO v_company,v_reference,v_status,v_deleted_at,v_details FROM app.orders WHERE id=p_record_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002'; END IF;
    IF NOT v_is_admin AND NOT (v_is_planning AND v_status IN ('awaiting_planning','planning_in_progress','planned')) THEN
      RAISE EXCEPTION 'Planning may remove only records still in the Planning queue' USING ERRCODE='42501';
    END IF;
    IF v_details->'legalHold'->>'active'='true' THEN RAISE EXCEPTION 'Legal hold prevents deletion' USING ERRCODE='23514'; END IF;
    IF v_deleted_at IS NULL THEN UPDATE app.orders SET deleted_at=now(),updated_at=now(),row_version=row_version+1 WHERE id=p_record_id; END IF;
  END IF;
  IF v_deleted_at IS NULL THEN
    INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES(p_entity_type||'.soft_deleted',v_actor,CASE WHEN v_is_admin THEN 'administrator' ELSE 'planning' END,v_company,'delete_'||p_entity_type,p_entity_type,p_record_id::text,'success',p_correlation_id,
      jsonb_build_object('reason',trim(p_reason),'reference',v_reference,'previousStatus',v_status,'hardDeleted',false));
  END IF;
  RETURN jsonb_build_object('id',p_record_id,'status','deleted','deletedAt',COALESCE(v_deleted_at,now()));
END;
$$;
REVOKE ALL ON FUNCTION app.soft_delete_operational_record(text,uuid,text,text) FROM PUBLIC;
