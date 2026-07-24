import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  canAccessNotification,
  canAccessRecord,
  defaultViewForRole,
  navigationItemsForRole,
  normaliseViewForRole,
  ORDER_QUEUE_SCOPES,
  roleProfileFor,
} from '../src/domain/accessControl.js';
import { SYSTEM_ACTOR_ROLE, WORKFLOW_TRANSITIONS } from '../src/domain/workflow.js';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleCan,
  USER_ROLES,
  WORKFLOW_ACTION_PERMISSIONS,
} from '../src/services/contracts.js';

const allRoles = Object.values(USER_ROLES);
assert.deepEqual(Object.keys(ROLE_PERMISSIONS), allRoles, 'every production role must have one central permission set');
assert.equal(new Set(Object.values(PERMISSIONS)).size, Object.values(PERMISSIONS).length, 'permission values must be unique');

for (const requiredPermission of [
  'create_rfq',
  'view_own_company_rfqs',
  'view_assigned_rfqs',
  'mark_rfq_under_review',
  'mark_rfq_quoted',
  'acknowledge_quotation',
  'accept_customer_order',
  'view_planning_queue',
  'add_planning_information',
  'submit_to_expediting',
  'view_expediting_queue',
  'update_order_progress',
  'move_to_dispatch',
  'view_dispatch_queue',
  'confirm_delivery',
  'confirm_collection',
  'view_all_orders',
  'export_order_pdf',
  'email_order_summary',
  'archive_orders',
  'restore_archived_orders',
  'administer_users',
  'override_workflow',
]) {
  assert.ok(Object.values(PERMISSIONS).includes(requiredPermission), `permission catalogue must include ${requiredPermission}`);
}

assert.ok(roleCan(USER_ROLES.CUSTOMER, PERMISSIONS.CREATE_RFQ));
assert.ok(roleCan(USER_ROLES.CUSTOMER, PERMISSIONS.VIEW_OWN_COMPANY_RFQS));
assert.ok(roleCan(USER_ROLES.CUSTOMER, PERMISSIONS.ACKNOWLEDGE_QUOTATION));
assert.equal(roleCan(USER_ROLES.CUSTOMER, PERMISSIONS.ACCESS_INTERNAL_WORKSPACE), false);
assert.equal(roleCan(USER_ROLES.CUSTOMER, PERMISSIONS.VIEW_ALL_ORDERS), false);

assert.ok(roleCan(USER_ROLES.SALES_REPRESENTATIVE, PERMISSIONS.VIEW_ASSIGNED_RFQS));
assert.ok(roleCan(USER_ROLES.SALES_REPRESENTATIVE, PERMISSIONS.MARK_RFQ_QUOTED));
assert.equal(roleCan(USER_ROLES.SALES_REPRESENTATIVE, PERMISSIONS.VIEW_ALL_RFQS), false);

assert.ok(roleCan(USER_ROLES.PLANNING, PERMISSIONS.VIEW_PLANNING_QUEUE));
assert.ok(roleCan(USER_ROLES.PLANNING, PERMISSIONS.SUBMIT_TO_EXPEDITING));
assert.equal(roleCan(USER_ROLES.PLANNING, PERMISSIONS.VIEW_EXPEDITING_QUEUE), false);

assert.ok(roleCan(USER_ROLES.EXPEDITOR, PERMISSIONS.VIEW_EXPEDITING_QUEUE));
assert.ok(roleCan(USER_ROLES.EXPEDITOR, PERMISSIONS.MOVE_TO_DISPATCH));
assert.equal(roleCan(USER_ROLES.EXPEDITOR, PERMISSIONS.VIEW_DISPATCH_QUEUE), false);

assert.ok(roleCan(USER_ROLES.DISPATCH, PERMISSIONS.VIEW_DISPATCH_QUEUE));
assert.ok(roleCan(USER_ROLES.DISPATCH, PERMISSIONS.CONFIRM_DELIVERY));
assert.equal(roleCan(USER_ROLES.DISPATCH, PERMISSIONS.UPDATE_ORDER_PROGRESS), false);

assert.deepEqual(
  ROLE_PERMISSIONS[USER_ROLES.BUYER],
  [PERMISSIONS.ACCESS_INTERNAL_WORKSPACE, PERMISSIONS.READ_CATALOGUE],
  'Buyer must remain prepared but operationally inactive',
);
assert.ok(roleCan(USER_ROLES.MANAGER, PERMISSIONS.VIEW_ALL_ORDERS));
assert.ok(roleCan(USER_ROLES.MANAGER, PERMISSIONS.OVERRIDE_WORKFLOW));
assert.equal(roleCan(USER_ROLES.MANAGER, PERMISSIONS.ADMINISTER_USERS), false);
for (const permission of Object.values(PERMISSIONS)) {
  assert.ok(roleCan(USER_ROLES.ADMINISTRATOR, permission), `administrator must receive ${permission}`);
}

for (const role of allRoles) {
  const currentProfile = roleProfileFor(role);
  assert.equal(currentProfile.role, role);
  assert.ok(currentProfile.label);
  assert.ok(navigationItemsForRole(role).length > 0);
  assert.ok(currentProfile.allowedViews.includes(defaultViewForRole(role)));
}
assert.equal(defaultViewForRole(USER_ROLES.CUSTOMER), 'home');
assert.equal(defaultViewForRole(USER_ROLES.PLANNING), 'expeditor');
assert.equal(normaliseViewForRole(USER_ROLES.CUSTOMER, 'expeditor'), 'home');
assert.equal(normaliseViewForRole(USER_ROLES.DISPATCH, 'catalogue'), 'expeditor');
assert.equal(roleProfileFor(USER_ROLES.BUYER).dashboard.queue, 'Buyer workflow inactive');

const customerA = { id: 'customer-a', role: USER_ROLES.CUSTOMER, companyId: 'company-a' };
const customerB = { id: 'customer-b', role: USER_ROLES.CUSTOMER, companyId: 'company-b' };
const salesA = { id: 'sales-a', role: USER_ROLES.SALES_REPRESENTATIVE, companyId: 'company-rhomberg', representativeId: 'REP-A' };
const planning = { id: 'planning', role: USER_ROLES.PLANNING, companyId: 'company-rhomberg' };
const expeditor = { id: 'expeditor', role: USER_ROLES.EXPEDITOR, companyId: 'company-rhomberg' };
const dispatch = { id: 'dispatch', role: USER_ROLES.DISPATCH, companyId: 'company-rhomberg' };
const buyer = { id: 'buyer', role: USER_ROLES.BUYER, companyId: 'company-rhomberg' };
const manager = { id: 'manager', role: USER_ROLES.MANAGER, companyId: 'company-rhomberg' };

const rfqA = { id: 'rfq-a', workflowType: 'rfq', companyId: 'company-a', trackingStatus: 'under_rep_review', selectedRep: { id: 'REP-A' } };
const rfqB = { ...rfqA, id: 'rfq-b', companyId: 'company-b', selectedRep: { id: 'REP-B' } };
assert.ok(canAccessRecord(customerA, rfqA));
assert.equal(canAccessRecord(customerA, rfqB), false);
assert.ok(canAccessRecord(salesA, rfqA));
assert.equal(canAccessRecord(salesA, rfqB), false);
assert.ok(canAccessRecord(manager, rfqA) && canAccessRecord(manager, rfqB));
assert.equal(canAccessRecord(planning, rfqA), false);

const orderAt = (status, overrides = {}) => ({
  id: `order-${status}`,
  workflowType: 'order',
  companyId: 'company-a',
  trackingStatus: status,
  selectedRep: { id: 'REP-A' },
  ...overrides,
});

assert.ok(canAccessRecord(customerA, orderAt('completed')));
assert.equal(canAccessRecord(customerB, orderAt('completed')), false);
assert.ok(canAccessRecord(salesA, orderAt('completed')));
assert.ok(canAccessRecord(planning, orderAt('awaiting_planning')));
assert.equal(canAccessRecord(planning, orderAt('submitted_to_expediting')), false);
assert.ok(canAccessRecord(expeditor, orderAt('submitted_to_expediting')));
assert.ok(canAccessRecord(expeditor, orderAt('awaiting_dispatch')), 'the Expeditor queue must retain handed-off orders while they await Dispatch');
assert.ok(canAccessRecord(dispatch, orderAt('awaiting_dispatch')));
assert.equal(canAccessRecord(dispatch, orderAt('planning_in_progress')), false);
assert.ok(canAccessRecord(planning, orderAt('on_hold', { workflowContext: { resumeStatus: 'planning_in_progress' } })));
assert.ok(canAccessRecord(expeditor, orderAt('on_hold', { workflowContext: { resumeStatus: 'expediting_in_progress' } })));
assert.ok(canAccessRecord(dispatch, orderAt('on_hold', { workflowContext: { resumeStatus: 'out_for_delivery' } })));
assert.equal(canAccessRecord(buyer, orderAt('awaiting_planning')), false);
assert.ok(canAccessRecord(manager, orderAt('archived')));
assert.deepEqual(Object.keys(ORDER_QUEUE_SCOPES).sort(), [
  PERMISSIONS.VIEW_DISPATCH_QUEUE,
  PERMISSIONS.VIEW_EXPEDITING_QUEUE,
  PERMISSIONS.VIEW_PLANNING_QUEUE,
].sort());

const customerNotification = {
  companyId: 'company-a',
  representativeId: 'REP-A',
  customerVisible: true,
  recipients: ['customer', 'assigned_representative'],
};
assert.ok(canAccessNotification(customerA, customerNotification));
assert.equal(canAccessNotification(customerB, customerNotification), false);
assert.ok(canAccessNotification(salesA, customerNotification));
assert.equal(canAccessNotification(buyer, customerNotification), false);
assert.ok(canAccessNotification(manager, customerNotification));

for (const definition of WORKFLOW_TRANSITIONS) {
  assert.equal(definition.permission, WORKFLOW_ACTION_PERMISSIONS[definition.action], `${definition.action} must use the central action permission`);
  for (const role of definition.roles.filter(role => role !== SYSTEM_ACTOR_ROLE)) {
    assert.ok(roleCan(role, definition.permission), `${role} must hold ${definition.permission} for ${definition.action}`);
  }
}

const componentFiles = [
  path.resolve('src/App.jsx'),
  ...readdirSync(path.resolve('src/components'), { recursive: true })
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.resolve('src/components', file)),
];
for (const file of componentFiles) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /\.role\s*(?:===|!==|==|!=)/, `${path.basename(file)} must not make direct role equality decisions`);
}

console.log('Central role permissions, navigation and queue-isolation tests passed.');
