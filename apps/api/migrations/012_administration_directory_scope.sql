BEGIN;

-- Administrators need an authoritative directory view to manage internal and
-- customer accounts. Keep ordinary users on the existing self/company scopes.
-- Qualify the outer users.id explicitly so the correlated RFQ/order checks do
-- not accidentally compare two columns from the inner table.
DROP POLICY IF EXISTS users_authorised_scope ON app.users;
CREATE POLICY users_authorised_scope ON app.users USING (
  id = app.current_user_id()
  OR current_setting('app.authentication_lookup', true) = 'enabled'
  OR app.current_context_has_permission('administer_users')
  OR EXISTS (
    SELECT 1 FROM app.company_users membership
    WHERE membership.user_id = users.id
      AND membership.company_id = ANY(app.current_company_ids())
      AND membership.revoked_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM app.rfqs authorised_rfq
    WHERE authorised_rfq.requester_user_id = users.id
  )
  OR EXISTS (
    SELECT 1 FROM app.orders authorised_order
    WHERE authorised_order.customer_user_id = users.id
      AND authorised_order.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS company_users_authorised_scope ON app.company_users;
CREATE POLICY company_users_authorised_scope ON app.company_users USING (
  user_id = app.current_user_id()
  OR company_id = ANY(app.current_company_ids())
  OR app.current_context_has_permission('administer_users')
);

COMMIT;
