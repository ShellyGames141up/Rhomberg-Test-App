-- Customer self-registration and one active company representative relationship.
-- RFQ representative_id remains an immutable historical assignment snapshot.

CREATE UNIQUE INDEX representative_company_one_active_idx
  ON app.representative_company_assignments(company_id)
  WHERE ended_at IS NULL;

CREATE UNIQUE INDEX companies_active_name_ci_uq
  ON app.companies(lower(name))
  WHERE deleted_at IS NULL;

CREATE FUNCTION app.register_customer_account(
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

CREATE FUNCTION app.resolve_rfq_representative(
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

CREATE OR REPLACE FUNCTION app.administer_company(p_company_id uuid,p_operation text,p_payload jsonb,p_correlation_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid:=app.current_user_id(); v_rep uuid; v_company app.companies%ROWTYPE; v_rep_branch text;
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_company FROM app.companies WHERE id=p_company_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'company not found' USING ERRCODE='P0002'; END IF;
  IF p_operation='update' THEN
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
      jsonb_build_object('operation',p_operation,'reason',COALESCE(p_payload->>'reason',''),'representativeId',CASE WHEN p_operation='representative' THEN p_payload->>'representativeId' ELSE NULL END));
  RETURN jsonb_build_object('id',p_company_id,'operation',p_operation);
END;
$$;
REVOKE ALL ON FUNCTION app.administer_company(uuid,text,jsonb,text) FROM PUBLIC;
