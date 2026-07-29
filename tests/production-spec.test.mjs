import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('docs/database/postgresql-schema.sql', 'utf8');
const openapi = readFileSync('docs/api/openapi.yaml', 'utf8');
const databaseSpec = readFileSync('docs/PRODUCTION_API_DATABASE_SPECIFICATION.md', 'utf8');
const demoScript = readFileSync('docs/END_TO_END_DEMO_SCRIPT.md', 'utf8');

const canonicalEntities = {
  users: 'CREATE TABLE app.users',
  roles: 'CREATE TABLE app.roles',
  permissions: 'CREATE TABLE app.permissions',
  user_roles: 'CREATE TABLE app.user_roles',
  companies: 'CREATE TABLE app.companies',
  company_users: 'RENAME TO company_users',
  representatives: 'CREATE TABLE app.representatives',
  products: 'CREATE TABLE app.products',
  product_configurations: 'CREATE TABLE app.product_configurations',
  rfqs: 'RENAME TO rfqs',
  rfq_items: 'RENAME TO rfq_items',
  quotations: 'CREATE TABLE app.quotations',
  rfq_acceptances: 'CREATE TABLE app.rfq_acceptances',
  orders: 'CREATE TABLE app.orders',
  order_items: 'CREATE TABLE app.order_items',
  planning_records: 'CREATE TABLE app.planning_records',
  expediting_updates: 'CREATE TABLE app.expediting_updates',
  dispatch_records: 'RENAME TO dispatch_records',
  tracking_events: 'RENAME TO tracking_events',
  notifications: 'CREATE TABLE app.notifications',
  notification_preferences: 'CREATE TABLE app.notification_preferences',
  uploaded_documents: 'CREATE TABLE app.uploaded_documents',
  audit_events: 'CREATE TABLE app.audit_events',
  archive_records: 'CREATE TABLE app.archive_records',
  retention_policies: 'CREATE TABLE app.retention_policies',
  workflow_overrides: 'CREATE TABLE app.workflow_overrides',
};

for (const [entity, marker] of Object.entries(canonicalEntities)) {
  assert.ok(sql.includes(marker), `PostgreSQL proposal must define canonical entity ${entity}`);
  assert.ok(databaseSpec.includes(`\`${entity}\``), `production specification must explain ${entity}`);
}

for (const marker of [
  'PRIMARY KEY',
  'REFERENCES app.',
  'UNIQUE',
  'deleted_at',
  'archived_at',
  'row_version',
  'ENABLE ROW LEVEL SECURITY',
  'CREATE POLICY',
  'CREATE INDEX',
  'current_user_has_permission',
  'can_access_company',
  'can_access_enquiry',
  'can_access_order',
  'audit_events_immutable',
  'tracking_events_immutable',
  'expediting_updates_immutable',
  'dispatch_updates_immutable',
  'archive_records_immutable',
]) {
  assert.ok(sql.includes(marker), `PostgreSQL proposal must include ${marker}`);
}

for (const status of [
  'assigned_to_rep',
  'awaiting_customer_acceptance',
  'converted_to_order',
  'awaiting_planning',
  'submitted_to_expediting',
  'expediting_in_progress',
  'awaiting_dispatch',
  'ready_for_collection',
  'out_for_delivery',
  'completed',
  'archived',
]) {
  assert.ok(sql.includes(`'${status}'`), `PostgreSQL proposal must define status ${status}`);
  assert.ok(openapi.includes(status), `OpenAPI proposal must define status ${status}`);
}

const requiredPaths = [
  '/auth/login:',
  '/roles:',
  '/permissions:',
  '/users:',
  '/users/{userId}/roles:',
  '/companies/{companyId}/users:',
  '/representatives:',
  '/products:',
  '/products/{productId}/configurations:',
  '/enquiries:',
  '/enquiries/inbox:',
  '/enquiries/{enquiryId}/items:',
  '/enquiries/{enquiryId}/quotation:',
  '/enquiries/{enquiryId}/acceptance:',
  '/enquiries/{enquiryId}/tracking-events:',
  '/enquiries/{enquiryId}/workflow-actions:',
  '/orders:',
  '/orders/{orderId}/planning-record:',
  '/orders/{orderId}/expediting-updates:',
  '/orders/{orderId}/dispatch-record:',
  '/orders/{orderId}/tracking-events:',
  '/orders/{orderId}/workflow-actions:',
  '/orders/{orderId}/archive-records:',
  '/notifications:',
  '/users/me/notification-preferences:',
  '/documents/{documentId}:',
  '/audit-events:',
  '/admin/retention-policy:',
  '/workflow-overrides:',
  '/workflow-overrides/{overrideId}:',
];
for (const path of requiredPaths) {
  assert.ok(openapi.includes(`  ${path}`), `OpenAPI proposal must define ${path.slice(0, -1)}`);
}

assert.ok(openapi.includes('version: 0.6.0-proposed'));
assert.ok(openapi.includes('All examples are fabricated.'));
assert.equal(openapi.includes('cookieSession'), false, 'OpenAPI must not reference the retired cookieSession security name');
assert.equal(openapi.includes('csrfToken: []'), false, 'OpenAPI must not reference the retired csrfToken security name');

const componentDefinitions = new Map();
let currentComponentType = null;
for (const line of openapi.split(/\r?\n/).slice(openapi.split(/\r?\n/).findIndex(line => line === 'components:') + 1)) {
  const typeMatch = line.match(/^  (securitySchemes|parameters|responses|schemas):$/);
  if (typeMatch) {
    currentComponentType = typeMatch[1];
    componentDefinitions.set(currentComponentType, new Set());
    continue;
  }
  const definitionMatch = line.match(/^    ([A-Za-z0-9_]+):/);
  if (currentComponentType && definitionMatch) componentDefinitions.get(currentComponentType).add(definitionMatch[1]);
}

for (const reference of openapi.matchAll(/#\/components\/(securitySchemes|parameters|responses|schemas)\/([A-Za-z0-9_]+)/g)) {
  const [, type, name] = reference;
  assert.ok(componentDefinitions.get(type)?.has(name), `OpenAPI reference ${type}/${name} must resolve`);
}

for (const requiredPhrase of [
  'Which account to use',
  'Expected status',
  'Expected notification',
  'Expected audit event',
  'Expected customer visibility',
  'order_summary_pdf_generated',
  'retention.archive_eligible',
]) {
  assert.ok(
    demoScript.toLowerCase().includes(requiredPhrase.toLowerCase()),
    `manual demonstration checklist must include ${requiredPhrase}`,
  );
}

console.log('Production PostgreSQL, OpenAPI and manual demonstration specifications passed static validation.');
