-- Recipients can acknowledge only their own notifications. No broad UPDATE policy.
-- Existing SELECT, INSERT policies and column-level runtime grants are preserved.
CREATE POLICY notifications_recipient_update ON app.notifications FOR UPDATE
  USING (recipient_user_id = app.current_user_id())
  WITH CHECK (recipient_user_id = app.current_user_id());
