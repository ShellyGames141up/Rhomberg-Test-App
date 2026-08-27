-- Restricted totals are available only through authorised management reporting.
-- No operational records or commercial values are seeded.
INSERT INTO app.role_permissions(role_code, permission_code)
VALUES ('company_owner', 'view_commercial_analytics'),
       ('sales_manager', 'view_commercial_analytics'),
       ('company_owner', 'export_management_pdf'),
       ('sales_manager', 'export_management_pdf')
ON CONFLICT DO NOTHING;
