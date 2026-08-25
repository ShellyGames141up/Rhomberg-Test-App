\if :{?runtime_role}
\else
  \echo 'Supply the existing runtime role with -v runtime_role=<role_name>.'
  \quit
\endif

-- Run as the migration/schema owner after migrations. This script does not create
-- roles or credentials and is intentionally safe to re-run.
REVOKE ALL ON SCHEMA app FROM :"runtime_role";
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM :"runtime_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM :"runtime_role";
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM :"runtime_role";

GRANT CONNECT ON DATABASE :"DBNAME" TO :"runtime_role";
GRANT USAGE ON SCHEMA app TO :"runtime_role";

GRANT SELECT ON
  app.companies,
  app.roles,
  app.permissions,
  app.role_permissions,
  app.user_roles,
  app.company_users,
  app.products,
  app.representatives,
  app.representative_company_assignments,
  app.rfqs,
  app.rfq_items,
  app.document_metadata,
  app.notifications,
  app.audit_events,
  app.user_settings,
  app.notification_preferences,
  app.enquiry_drafts,
  app.orders,
  app.order_items,
  app.workflow_events,
  app.technical_support_requests,
  app.technical_support_messages,
  app.locations,
  app.platform_policies
  ,app.user_permission_grants
  ,app.user_profile_images
  ,app.client_appointments
  ,app.catalogue_overrides
TO :"runtime_role";

GRANT SELECT, INSERT ON app.sessions TO :"runtime_role";
GRANT UPDATE (csrf_token_hash, last_seen_at, revoked_at, selected_role) ON app.sessions TO :"runtime_role";
GRANT SELECT (id, username, email, display_name, password_hash, identity_provider, status, must_change_password,
  phone, department, branch_id, last_login_at, created_at, disabled_at, deleted_at)
  ON app.users TO :"runtime_role";
GRANT UPDATE (last_login_at) ON app.users TO :"runtime_role";

GRANT INSERT ON
  app.rfqs,
  app.rfq_items,
  app.document_metadata,
  app.audit_events,
  app.notifications,
  app.idempotency_records
TO :"runtime_role";
GRANT UPDATE (status, details, representative_id, row_version, updated_at) ON app.rfqs TO :"runtime_role";
GRANT SELECT ON app.idempotency_records TO :"runtime_role";

GRANT INSERT, UPDATE, DELETE ON
  app.user_settings,
  app.notification_preferences,
  app.enquiry_drafts
TO :"runtime_role";

GRANT INSERT, UPDATE ON
  app.orders,
  app.order_items,
  app.workflow_events,
  app.technical_support_requests,
  app.technical_support_messages,
  app.locations,
  app.platform_policies
  ,app.client_appointments
  ,app.catalogue_overrides
TO :"runtime_role";

GRANT INSERT, UPDATE, DELETE ON app.user_profile_images TO :"runtime_role";

GRANT UPDATE (read_at, deliveries) ON app.notifications TO :"runtime_role";
GRANT UPDATE (details, row_version, updated_at) ON app.orders TO :"runtime_role";

GRANT USAGE, SELECT ON SEQUENCE app.rfq_reference_sequence TO :"runtime_role";
GRANT USAGE, SELECT ON SEQUENCE app.order_reference_sequence TO :"runtime_role";
GRANT EXECUTE ON FUNCTION
  app.establish_request_context(text),
  app.current_user_id(),
  app.current_company_ids(),
  app.current_context_can_read_audit(),
  app.current_context_can_view_all_rfqs(),
  app.current_context_has_permission(text),
  app.create_internal_user(uuid, text, text, text, text, text, text),
  app.list_internal_users(),
  app.complete_internal_user_profile(uuid,text,text,text,text[],uuid,text,text),
  app.create_customer_account(uuid,uuid,text,text,text,text,text,text,text,uuid,text,text)
  ,app.administer_user(uuid,text,jsonb,text)
  ,app.administer_company(uuid,text,jsonb,text)
  ,app.admin_user_login_history(uuid)
  ,app.change_own_password(text,text)
TO :"runtime_role";
