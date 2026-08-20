ALTER TABLE app.users ADD COLUMN username text;

ALTER TABLE app.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app.users DROP CONSTRAINT external_identity_pair;
UPDATE app.users SET identity_provider = 'local_password' WHERE identity_provider = 'development_password';
ALTER TABLE app.users ALTER COLUMN identity_provider SET DEFAULT 'local_password';
ALTER TABLE app.users ADD CONSTRAINT user_login_identifier_required
  CHECK (username IS NOT NULL OR email IS NOT NULL);
ALTER TABLE app.users ADD CONSTRAINT user_username_format
  CHECK (username IS NULL OR username ~ '^[A-Za-z][A-Za-z0-9._-]{2,39}$');
ALTER TABLE app.users ADD CONSTRAINT external_identity_pair CHECK (
  (identity_provider = 'local_password' AND external_subject IS NULL)
  OR (identity_provider <> 'local_password' AND external_subject IS NOT NULL)
);
CREATE UNIQUE INDEX users_username_lower_unique
  ON app.users (lower(username)) WHERE username IS NOT NULL AND deleted_at IS NULL;

INSERT INTO app.permissions (code, description)
VALUES ('administer_users', 'Create approved internal user identities and role assignments.');
INSERT INTO app.role_permissions (role_code, permission_code)
VALUES ('administrator', 'administer_users');

CREATE TABLE app.platform_bootstrap_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  administrator_user_id uuid NOT NULL UNIQUE REFERENCES app.users(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  bootstrap_version integer NOT NULL DEFAULT 1 CHECK (bootstrap_version = 1)
);

REVOKE ALL ON app.platform_bootstrap_state FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.create_internal_user(
  p_user_id uuid,
  p_username text,
  p_email text,
  p_display_name text,
  p_password_hash text,
  p_role_code text,
  p_correlation_id text
) RETURNS TABLE (
  id uuid,
  username text,
  email text,
  display_name text,
  role_code text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
  v_username text := trim(p_username);
  v_email text := NULLIF(lower(trim(p_email)), '');
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM app.user_roles ur
    JOIN app.role_permissions rp ON rp.role_code = ur.role_code
    JOIN app.permissions permission ON permission.code = rp.permission_code AND permission.is_active
    WHERE ur.user_id = v_actor
      AND ur.revoked_at IS NULL
      AND rp.permission_code = 'administer_users'
  ) THEN
    RAISE EXCEPTION 'administrator permission required' USING ERRCODE = '42501';
  END IF;

  IF v_username !~ '^[A-Za-z][A-Za-z0-9._-]{2,39}$' THEN
    RAISE EXCEPTION 'invalid username' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_display_name)) NOT BETWEEN 2 AND 160 THEN
    RAISE EXCEPTION 'invalid display name' USING ERRCODE = '22023';
  END IF;
  IF p_password_hash !~ '^scrypt[$][0-9]+[$][0-9]+[$][0-9]+[$][A-Za-z0-9_-]+[$][A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'invalid password hash' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.roles role
    WHERE role.code = p_role_code AND role.is_internal AND role.is_active AND role.code <> 'administrator'
  ) THEN
    RAISE EXCEPTION 'invalid internal role' USING ERRCODE = '22023';
  END IF;

  INSERT INTO app.users (id, username, email, display_name, password_hash, identity_provider, status)
  VALUES (p_user_id, v_username, v_email, trim(p_display_name), p_password_hash, 'local_password', 'active');
  INSERT INTO app.user_roles (user_id, role_code) VALUES (p_user_id, p_role_code);
  INSERT INTO app.audit_events (
    event_type, actor_user_id, actor_role, company_id, action, entity_type,
    entity_id, outcome, correlation_id, details
  ) VALUES (
    'administrator.internal_user_created', v_actor, 'administrator', NULL,
    'create_internal_user', 'user', p_user_id::text, 'success', p_correlation_id,
    jsonb_build_object('role', p_role_code)
  );

  RETURN QUERY SELECT created.id, created.username, created.email, created.display_name,
    p_role_code, created.status, created.created_at
  FROM app.users created WHERE created.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION app.create_internal_user(uuid, text, text, text, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.list_internal_users()
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  display_name text,
  status text,
  last_login_at timestamptz,
  created_at timestamptz,
  role_codes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
DECLARE
  v_actor uuid := app.current_user_id();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM app.user_roles ur
    JOIN app.role_permissions rp ON rp.role_code = ur.role_code
    JOIN app.permissions permission ON permission.code = rp.permission_code AND permission.is_active
    WHERE ur.user_id = v_actor AND ur.revoked_at IS NULL AND rp.permission_code = 'administer_users'
  ) THEN
    RAISE EXCEPTION 'administrator permission required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT user_record.id, user_record.username, user_record.email,
    user_record.display_name, user_record.status, user_record.last_login_at,
    user_record.created_at, array_agg(role.role_code ORDER BY role.assigned_at)
  FROM app.users user_record
  JOIN app.user_roles role ON role.user_id = user_record.id AND role.revoked_at IS NULL
  JOIN app.roles role_definition ON role_definition.code = role.role_code AND role_definition.is_internal
  WHERE user_record.deleted_at IS NULL
  GROUP BY user_record.id
  ORDER BY user_record.display_name;
END;
$$;

REVOKE ALL ON FUNCTION app.list_internal_users() FROM PUBLIC;
