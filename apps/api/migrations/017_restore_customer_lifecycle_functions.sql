-- Repair databases that recorded migrations 014/015 before their final approved
-- customer-lifecycle function definitions were available. CREATE OR REPLACE keeps
-- this migration safe on clean databases while restoring drifted staging schemas.

CREATE OR REPLACE FUNCTION app.register_customer_account(
  p_company_id uuid, p_user_id uuid, p_company_name text, p_contact_name text,
  p_email text, p_phone text, p_area text, p_industry text, p_branch_id text,
  p_password_hash text, p_correlation_id text
) RETURNS TABLE(company_id uuid,user_id uuid,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_created_at timestamptz:=now(); v_email text:=lower(trim(p_email)); v_company_name text:=trim(p_company_name);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-registration:'||v_email,0));
  IF v_email='' OR v_company_name='' OR COALESCE(p_password_hash,'') !~ '^scrypt[$]' THEN
    RAISE EXCEPTION 'invalid registration data' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM app.users WHERE email=v_email AND deleted_at IS NULL)
     OR EXISTS(SELECT 1 FROM app.companies WHERE lower(name)=lower(v_company_name) AND deleted_at IS NULL) THEN
    RAISE unique_violation USING MESSAGE='customer account already exists';
  END IF;
  INSERT INTO app.companies(id,name,status,area,industry,branch_id)
    VALUES(p_company_id,v_company_name,'active',trim(p_area),trim(p_industry),trim(p_branch_id));
  INSERT INTO app.users(id,email,display_name,password_hash,identity_provider,status,phone,must_change_password)
    VALUES(p_user_id,v_email,trim(p_contact_name),p_password_hash,'local_password','active',trim(p_phone),false);
  INSERT INTO app.user_roles(user_id,role_code) VALUES(p_user_id,'customer');
  INSERT INTO app.company_users(company_id,user_id,is_primary) VALUES(p_company_id,p_user_id,true);
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('customer.self_registered',NULL,'customer_registration',p_company_id,'register_customer_account','company',p_company_id::text,'success',p_correlation_id,
      jsonb_build_object('customerUserId',p_user_id,'representativeAssigned',false));
  RETURN QUERY SELECT p_company_id,p_user_id,v_created_at;
END;
$$;
REVOKE ALL ON FUNCTION app.register_customer_account(uuid,uuid,text,text,text,text,text,text,text,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.resolve_rfq_representative(
  p_company_id uuid, p_selected_representative_id uuid, p_correlation_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_company app.companies%ROWTYPE; v_rep app.representatives%ROWTYPE; v_assignment_created boolean:=false;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('create_rfq') OR NOT (p_company_id=ANY(app.current_company_ids())) THEN
    RAISE EXCEPTION 'customer RFQ permission required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_company FROM app.companies WHERE id=p_company_id AND status='active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer company unavailable' USING ERRCODE='P0002'; END IF;
  SELECT representative.* INTO v_rep FROM app.representative_company_assignments assignment
    JOIN app.representatives representative ON representative.id=assignment.representative_id
    WHERE assignment.company_id=p_company_id AND assignment.ended_at IS NULL
    ORDER BY assignment.assigned_at DESC LIMIT 1;
  IF FOUND THEN
    IF NOT v_rep.is_active THEN RAISE EXCEPTION 'dedicated representative inactive' USING ERRCODE='55000'; END IF;
    IF p_selected_representative_id IS NOT NULL AND p_selected_representative_id<>v_rep.id THEN
      RAISE EXCEPTION 'dedicated representative substitution rejected' USING ERRCODE='23514';
    END IF;
  ELSE
    IF trim(COALESCE(v_company.area,''))='' OR trim(COALESCE(v_company.branch_id,''))='' THEN
      RAISE EXCEPTION 'customer area required' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_rep FROM app.representatives
      WHERE id=p_selected_representative_id AND branch_id=v_company.branch_id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'representative not eligible' USING ERRCODE='22023'; END IF;
    INSERT INTO app.representative_company_assignments(representative_id,company_id) VALUES(v_rep.id,p_company_id);
    v_assignment_created=true;
    INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
      VALUES('company.dedicated_representative_assigned',v_actor,'customer',p_company_id,'assign_dedicated_representative','company',p_company_id::text,'success',p_correlation_id,
        jsonb_build_object('representativeId',v_rep.id,'source','first_rfq'));
  END IF;
  RETURN jsonb_build_object('id',v_rep.id,'userId',v_rep.user_id,'displayName',v_rep.display_name,'branchName',v_rep.branch_name,'branchId',v_rep.branch_id,'isActive',v_rep.is_active,'assignmentCreated',v_assignment_created);
END;
$$;
REVOKE ALL ON FUNCTION app.resolve_rfq_representative(uuid,uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.soft_delete_user(p_user_id uuid,p_reason text,p_correlation_id text)
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
