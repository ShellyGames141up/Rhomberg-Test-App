BEGIN;

ALTER TABLE app.sessions ADD COLUMN selected_role text REFERENCES app.roles(code);

CREATE TABLE app.catalogue_overrides (
  kind text NOT NULL CHECK(kind IN ('category','product')),
  item_id text NOT NULL,
  values jsonb NOT NULL CHECK(jsonb_typeof(values)='object'),
  updated_by_user_id uuid NOT NULL REFERENCES app.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,item_id)
);
ALTER TABLE app.catalogue_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogue_override_admin_scope ON app.catalogue_overrides USING (app.current_context_has_permission('manage_products')) WITH CHECK (app.current_context_has_permission('manage_products'));

COMMIT;
