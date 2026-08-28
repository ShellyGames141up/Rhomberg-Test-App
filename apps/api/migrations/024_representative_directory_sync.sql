-- Keep the assignment directory aligned with authoritative employee profiles.
-- Never change representative IDs, company relationships or historical RFQs.
CREATE FUNCTION app.sync_representative_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
  UPDATE app.representatives rep SET
    display_name=NEW.display_name,
    branch_id=NULLIF(NULLIF(trim(NEW.branch_id),''),'unassigned'),
    branch_name=COALESCE(NULLIF(NULLIF(trim(NEW.branch_id),''),'unassigned'),'Unassigned'),
    is_active=NEW.status='active' AND NEW.disabled_at IS NULL AND NEW.deleted_at IS NULL
      AND EXISTS(SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.code=ur.role_code
        WHERE ur.user_id=NEW.id AND ur.role_code='sales_representative' AND ur.revoked_at IS NULL AND r.is_active)
  WHERE rep.user_id=NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.sync_representative_profile() FROM PUBLIC;
CREATE TRIGGER sync_representative_profile
AFTER UPDATE OF display_name,branch_id,status,disabled_at,deleted_at ON app.users
FOR EACH ROW EXECUTE FUNCTION app.sync_representative_profile();

-- Repair missing/stale directory entries, not operational seed data. Identity
-- creation remains behind the existing authorised Administrator functions.
INSERT INTO app.representatives(id,user_id,display_name,branch_id,branch_name,code,is_active)
SELECT gen_random_uuid(),u.id,u.display_name,NULLIF(NULLIF(trim(u.branch_id),''),'unassigned'),
  COALESCE(NULLIF(NULLIF(trim(u.branch_id),''),'unassigned'),'Unassigned'),
  'ROLE-'||replace(u.id::text,'-',''),u.status='active' AND u.disabled_at IS NULL AND u.deleted_at IS NULL
FROM app.users u WHERE EXISTS(SELECT 1 FROM app.user_roles ur JOIN app.roles r ON r.code=ur.role_code
  WHERE ur.user_id=u.id AND ur.role_code='sales_representative' AND ur.revoked_at IS NULL AND r.is_active)
ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,
  branch_id=EXCLUDED.branch_id,branch_name=EXCLUDED.branch_name,is_active=EXCLUDED.is_active;
UPDATE app.representatives rep SET is_active=false WHERE NOT EXISTS(
  SELECT 1 FROM app.users u JOIN app.user_roles ur ON ur.user_id=u.id
  JOIN app.roles r ON r.code=ur.role_code
  WHERE u.id=rep.user_id AND u.status='active' AND u.disabled_at IS NULL AND u.deleted_at IS NULL
    AND ur.role_code='sales_representative' AND ur.revoked_at IS NULL AND r.is_active
);
