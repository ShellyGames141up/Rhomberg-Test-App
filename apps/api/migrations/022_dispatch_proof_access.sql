-- Supplement existing policies only for private Dispatch proof on visible orders.
-- No table-wide document grant, customer publication, UPDATE or DELETE policy.
CREATE POLICY dispatch_proof_read ON app.document_metadata FOR SELECT USING (
  kind = 'dispatch_proof' AND deleted_at IS NULL
  AND app.current_context_has_permission('view_dispatch_queue')
  AND EXISTS (SELECT 1 FROM app.orders o WHERE o.id = document_metadata.order_id
    AND o.company_id = document_metadata.company_id AND o.deleted_at IS NULL)
);
CREATE POLICY dispatch_proof_insert ON app.document_metadata FOR INSERT WITH CHECK (
  kind = 'dispatch_proof' AND rfq_id IS NULL AND technical_request_id IS NULL
  AND NOT customer_visible AND scan_status = 'pending'
  AND uploaded_by_user_id = app.current_user_id()
  AND app.current_context_has_permission('view_dispatch_queue')
  AND EXISTS (SELECT 1 FROM app.orders o WHERE o.id = document_metadata.order_id
    AND o.company_id = document_metadata.company_id AND o.deleted_at IS NULL
    AND ((o.fulfilment = 'collect' AND app.current_context_has_permission('confirm_collection'))
      OR (o.fulfilment = 'delivery' AND app.current_context_has_permission('confirm_delivery')))
    AND o.status IN ('awaiting_dispatch','ready_for_collection','out_for_delivery','collected','delivered'))
);
