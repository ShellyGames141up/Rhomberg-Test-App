BEGIN;

DROP POLICY profile_image_authorised_scope ON app.user_profile_images;
CREATE POLICY profile_image_authorised_scope ON app.user_profile_images USING (user_id=app.current_user_id() OR app.current_context_has_permission('administer_users')) WITH CHECK (user_id=app.current_user_id() OR app.current_context_has_permission('administer_users'));

INSERT INTO app.role_permissions (role_code, permission_code) VALUES
  ('sales_representative','view_assigned_clients'),
  ('sales_representative','schedule_client_visits'),
  ('sales_representative','verify_client_visits'),
  ('sales_representative','view_own_work_location_summary'),
  ('sales_manager','view_visit_compliance')
ON CONFLICT DO NOTHING;

CREATE TABLE app.client_appointments (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES app.companies(id),
  representative_id uuid NOT NULL REFERENCES app.representatives(id),
  created_by_user_id uuid NOT NULL REFERENCES app.users(id),
  scheduled_at timestamptz NOT NULL,
  expected_duration_minutes integer NOT NULL CHECK (expected_duration_minutes BETWEEN 15 AND 480),
  purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 2 AND 500),
  contact_name text NOT NULL,
  address text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','missed_visit','cancelled')),
  verification_status text NOT NULL DEFAULT 'not_verified' CHECK (verification_status IN ('not_verified','location_matched','customer_confirmed','qr_confirmed','verified')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  qr_token_hash text CHECK (qr_token_hash IS NULL OR length(qr_token_hash)=64),
  qr_expires_at timestamptz,
  qr_consumed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_appointments_rep_status_time_idx ON app.client_appointments(representative_id,status,scheduled_at);
CREATE INDEX client_appointments_company_time_idx ON app.client_appointments(company_id,scheduled_at DESC);
ALTER TABLE app.client_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_appointments_scope ON app.client_appointments USING (
  company_id = ANY(app.current_company_ids())
  OR representative_id = (SELECT id FROM app.representatives WHERE user_id=app.current_user_id() AND is_active LIMIT 1)
  OR app.current_context_has_permission('view_visit_compliance')
  OR app.current_context_has_permission('administer_users')
) WITH CHECK (
  representative_id = (SELECT id FROM app.representatives WHERE user_id=app.current_user_id() AND is_active LIMIT 1)
  OR app.current_context_has_permission('administer_users')
);

COMMIT;
