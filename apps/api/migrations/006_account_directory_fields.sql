ALTER TABLE app.users ADD COLUMN phone text;
ALTER TABLE app.users ADD COLUMN department text;
ALTER TABLE app.users ADD COLUMN branch_id text;
ALTER TABLE app.users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app.companies ADD COLUMN branch_id text;
ALTER TABLE app.representatives ADD COLUMN branch_id text;
ALTER TABLE app.representatives ADD COLUMN code text UNIQUE;

CREATE INDEX users_branch_department_idx ON app.users(branch_id,department) WHERE deleted_at IS NULL;
CREATE INDEX companies_branch_idx ON app.companies(branch_id) WHERE deleted_at IS NULL;

DROP FUNCTION app.list_internal_users();
CREATE FUNCTION app.list_internal_users()
RETURNS TABLE (
  id uuid, username text, email text, display_name text, phone text,
  department text, branch_id text, status text, last_login_at timestamptz,
  created_at timestamptz, role_codes text[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid := app.current_user_id();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM app.user_roles ur JOIN app.role_permissions rp ON rp.role_code=ur.role_code
    JOIN app.permissions permission ON permission.code=rp.permission_code AND permission.is_active
    WHERE ur.user_id=v_actor AND ur.revoked_at IS NULL AND rp.permission_code='administer_users'
  ) THEN RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT user_record.id,user_record.username,user_record.email,user_record.display_name,
    user_record.phone,user_record.department,user_record.branch_id,user_record.status,user_record.last_login_at,
    user_record.created_at,array_agg(role.role_code ORDER BY role.assigned_at)
  FROM app.users user_record JOIN app.user_roles role ON role.user_id=user_record.id AND role.revoked_at IS NULL
  JOIN app.roles definition ON definition.code=role.role_code AND definition.is_internal
  WHERE user_record.deleted_at IS NULL GROUP BY user_record.id ORDER BY user_record.display_name;
END;
$$;
REVOKE ALL ON FUNCTION app.list_internal_users() FROM PUBLIC;

CREATE FUNCTION app.complete_internal_user_profile(
  p_user_id uuid, p_phone text, p_department text, p_branch_id text,
  p_additional_roles text[], p_representative_id uuid, p_representative_branch_name text,
  p_representative_code text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid := app.current_user_id();
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN
    RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_additional_roles, ARRAY[]::text[])) AS requested(role_code) WHERE requested.role_code IN ('administrator','customer')) THEN
    RAISE EXCEPTION 'protected roles cannot be assigned' USING ERRCODE='42501';
  END IF;
  UPDATE app.users SET phone=NULLIF(p_phone,''),department=NULLIF(p_department,''),branch_id=NULLIF(p_branch_id,''),must_change_password=true
    WHERE id=p_user_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO app.user_roles(user_id,role_code)
    SELECT p_user_id,role.code FROM unnest(COALESCE(p_additional_roles, ARRAY[]::text[])) AS requested(role_code)
    JOIN app.roles role ON role.code=requested.role_code AND role.is_internal AND role.is_active
    ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM app.user_roles WHERE user_id=p_user_id AND role_code='sales_representative' AND revoked_at IS NULL) THEN
    INSERT INTO app.representatives(id,user_id,display_name,branch_name,branch_id,code)
      SELECT p_representative_id,user_record.id,user_record.display_name,COALESCE(NULLIF(p_representative_branch_name,''),'Unassigned'),NULLIF(p_branch_id,''),p_representative_code
      FROM app.users user_record WHERE user_record.id=p_user_id
      ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,branch_name=EXCLUDED.branch_name,
        branch_id=EXCLUDED.branch_id,code=EXCLUDED.code,is_active=true;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION app.complete_internal_user_profile(uuid,text,text,text,text[],uuid,text,text) FROM PUBLIC;

CREATE FUNCTION app.create_customer_account(
  p_company_id uuid, p_user_id uuid, p_company_name text, p_contact_name text,
  p_email text, p_phone text, p_area text, p_industry text, p_branch_id text,
  p_representative_id uuid, p_password_hash text, p_correlation_id text
) RETURNS TABLE(company_id uuid,user_id uuid,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE v_actor uuid := app.current_user_id(); v_created_at timestamptz := now();
BEGIN
  IF v_actor IS NULL OR NOT app.current_context_has_permission('administer_users') THEN
    RAISE EXCEPTION 'administrator permission required' USING ERRCODE='42501';
  END IF;
  IF p_representative_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.representatives WHERE id=p_representative_id AND is_active) THEN
    RAISE EXCEPTION 'representative unavailable' USING ERRCODE='P0002';
  END IF;
  INSERT INTO app.companies(id,name,status,area,industry,branch_id) VALUES(p_company_id,p_company_name,'active',p_area,p_industry,p_branch_id);
  INSERT INTO app.users(id,email,display_name,password_hash,identity_provider,status,phone,must_change_password)
    VALUES(p_user_id,p_email,p_contact_name,p_password_hash,'local_password','active',p_phone,true);
  INSERT INTO app.user_roles(user_id,role_code) VALUES(p_user_id,'customer');
  INSERT INTO app.company_users(company_id,user_id,is_primary) VALUES(p_company_id,p_user_id,true);
  IF p_representative_id IS NOT NULL THEN
    INSERT INTO app.representative_company_assignments(representative_id,company_id) VALUES(p_representative_id,p_company_id);
  END IF;
  INSERT INTO app.audit_events(event_type,actor_user_id,actor_role,company_id,action,entity_type,entity_id,outcome,correlation_id,details)
    VALUES('administrator.customer_account_created',v_actor,'administrator',p_company_id,'create_customer_account','company',p_company_id::text,'success',p_correlation_id,
      jsonb_build_object('customerUserId',p_user_id,'representativeId',p_representative_id));
  RETURN QUERY SELECT p_company_id,p_user_id,v_created_at;
END;
$$;
REVOKE ALL ON FUNCTION app.create_customer_account(uuid,uuid,text,text,text,text,text,text,text,uuid,text,text) FROM PUBLIC;
