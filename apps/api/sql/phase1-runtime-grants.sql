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
  app.notifications
TO :"runtime_role";

GRANT SELECT, INSERT ON app.sessions TO :"runtime_role";
GRANT UPDATE (csrf_token_hash, last_seen_at, revoked_at) ON app.sessions TO :"runtime_role";
GRANT SELECT (id, email, display_name, password_hash, identity_provider, status, disabled_at, deleted_at)
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
GRANT SELECT ON app.idempotency_records TO :"runtime_role";

GRANT USAGE, SELECT ON SEQUENCE app.rfq_reference_sequence TO :"runtime_role";
GRANT EXECUTE ON FUNCTION
  app.establish_request_context(text),
  app.current_user_id(),
  app.current_company_ids(),
  app.current_context_can_read_audit(),
  app.current_context_can_view_all_rfqs()
TO :"runtime_role";
