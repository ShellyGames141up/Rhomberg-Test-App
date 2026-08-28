BEGIN;

-- Sales may see only its assigned referrals; customer correspondence is limited
-- to explicitly customer-safe messages. These policies do not read RFQs, avoiding
-- a circular RLS dependency with the referral SELECT policy below.
DROP POLICY technical_requests_operational_scope ON app.technical_support_requests;
CREATE POLICY technical_requests_operational_scope ON app.technical_support_requests USING (
  app.current_context_has_permission('view_technical_queue')
  OR app.current_context_can_view_all_rfqs()
  OR (company_id=ANY(app.current_company_ids()) AND (
    app.current_context_has_permission('access_customer_workspace')
    OR representative_id IN (SELECT id FROM app.representatives WHERE user_id=app.current_user_id() AND is_active)
  ))
);
DROP POLICY technical_messages_operational_scope ON app.technical_support_messages;
CREATE POLICY technical_messages_operational_scope ON app.technical_support_messages USING (
  EXISTS (SELECT 1 FROM app.technical_support_requests r WHERE r.id=request_id)
  AND (classification='customer_safe'
    OR app.current_context_has_permission('post_technical_message')
    OR app.current_context_can_view_all_rfqs())
) WITH CHECK (
  sender_user_id=app.current_user_id()
  AND EXISTS (SELECT 1 FROM app.technical_support_requests r WHERE r.id=request_id AND r.company_id=technical_support_messages.company_id)
  AND (app.current_context_has_permission('post_technical_message')
    OR (classification='customer_safe' AND app.current_context_has_permission('respond_customer_technical_request')))
);
INSERT INTO app.role_permissions(role_code,permission_code) VALUES
  ('customer','respond_customer_technical_request'),
  ('technical_support','download_technical_documents')
ON CONFLICT DO NOTHING;
CREATE POLICY workflow_events_technical_referral_insert ON app.workflow_events
FOR INSERT WITH CHECK (
  actor_user_id=app.current_user_id() AND entity_type='technical_support'
  AND app.current_context_has_permission('post_technical_message')
  AND EXISTS (SELECT 1 FROM app.technical_support_requests r WHERE r.id=entity_id AND r.company_id=workflow_events.company_id)
);

-- Technical may read only RFQs actually referred to the department. This is a
-- SELECT policy, not permission to create RFQs, amend Sales data or bypass RLS.
CREATE POLICY rfqs_technical_referral_read ON app.rfqs FOR SELECT USING (
  app.current_context_has_permission('view_technical_queue')
  AND EXISTS (SELECT 1 FROM app.technical_support_requests request WHERE request.rfq_id=rfqs.id)
);
CREATE POLICY companies_technical_referral_read ON app.companies FOR SELECT USING (
  app.current_context_has_permission('view_technical_queue')
  AND EXISTS (SELECT 1 FROM app.technical_support_requests request WHERE request.company_id=companies.id)
);

-- The assignment selector needs public internal display names, not unrestricted
-- SELECT of employee rows (which also contain authentication fields).
CREATE FUNCTION app.list_technical_advisors()
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
BEGIN
  IF NOT (app.current_context_has_permission('view_technical_queue')
    OR app.current_context_has_permission('request_technical_support')) THEN
    RAISE EXCEPTION 'Technical directory access denied' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT DISTINCT u.id,u.display_name::text,r.role_code::text
    FROM app.users u JOIN app.user_roles r ON r.user_id=u.id
    WHERE r.revoked_at IS NULL AND r.role_code IN ('technical_support','technical_manager','technical_director')
      AND u.status='active' AND u.deleted_at IS NULL
    ORDER BY 2,3;
END;
$$;
REVOKE ALL ON FUNCTION app.list_technical_advisors() FROM PUBLIC;
COMMIT;
