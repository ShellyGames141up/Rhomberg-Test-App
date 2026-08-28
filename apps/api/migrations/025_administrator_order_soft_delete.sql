-- No physical deletion: retain the order, documents, workflow and audit history.
CREATE FUNCTION app.soft_delete_order(p_order_id uuid,p_reason text,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_order app.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') OR NOT EXISTS (
    SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.code=ur.role_code AND r.is_active
    WHERE ur.user_id=v_actor AND ur.role_code='administrator' AND ur.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 1000 THEN
    RAISE EXCEPTION 'Deletion reason required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM app.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002'; END IF;
  IF v_order.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('id',p_order_id,'status','deleted','deletedAt',v_order.deleted_at); END IF;
  IF v_order.details->'legalHold'->>'active'='true' THEN
    RAISE EXCEPTION 'Legal hold prevents deletion' USING ERRCODE='23514'; END IF;
  UPDATE app.orders SET deleted_at=now(),updated_at=now(),row_version=row_version+1 WHERE id=p_order_id;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('administrator.order_soft_deleted',v_actor,'administrator',v_order.company_id,'delete_order','order',p_order_id::text,'success',p_correlation_id,
      jsonb_build_object('reason',trim(p_reason),'reference',v_order.reference,'previousStatus',v_order.status,'hardDeleted',false));
  RETURN jsonb_build_object('id',p_order_id,'status','deleted','deletedAt',now());
END;
$$;
REVOKE ALL ON FUNCTION app.soft_delete_order(uuid,text,text) FROM PUBLIC;
