-- Authoritative access for the approved manager-only certificate launch.
-- Certificate versions remain in the RLS-protected order aggregate while each
-- private file has an independently authorised document_metadata record.

DROP POLICY documents_operational_scope ON app.document_metadata;
CREATE POLICY documents_operational_scope ON app.document_metadata USING (
  company_id = ANY(app.current_company_ids())
  OR app.current_context_can_view_all_rfqs()
  OR (kind = 'certificate' AND (app.current_context_has_permission('download_certificates') OR app.current_context_has_permission('manage_certificates')))
  OR (technical_request_id IS NOT NULL AND app.current_context_has_permission('download_technical_documents'))
) WITH CHECK (
  company_id = ANY(app.current_company_ids())
  OR app.current_context_can_view_all_rfqs()
  OR (kind = 'certificate' AND app.current_context_has_permission('manage_certificates'))
  OR (technical_request_id IS NOT NULL AND app.current_context_has_permission('post_technical_message'))
);
