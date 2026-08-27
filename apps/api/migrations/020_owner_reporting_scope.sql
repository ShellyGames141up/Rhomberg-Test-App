-- Complete the existing Company Owner's read-only, company-wide reporting scope.
-- Orders join companies protected by RFQ/operational RLS: view_all_orders alone
-- does not make those joined rows visible. Do not bypass RLS or grant mutations.
-- Existing per-user denials remain authoritative. No identities/data are seeded.
INSERT INTO app.role_permissions(role_code, permission_code)
SELECT r.code, p.code FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'company_owner' AND r.is_active AND p.is_active
  AND p.code IN ('read_catalogue', 'view_all_companies', 'view_all_rfqs', 'view_reports')
ON CONFLICT DO NOTHING;
