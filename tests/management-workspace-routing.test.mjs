import assert from 'node:assert/strict';
import { usesSalesWorkspace } from '../src/domain/accessControl.js';
import { accountCan, PERMISSIONS } from '../src/services/contracts.js';
const permissions = [PERMISSIONS.VIEW_ASSIGNED_RFQS, PERMISSIONS.VIEW_ALL_RFQS, PERMISSIONS.VIEW_REPORTS];
for (const role of ['company_owner', 'sales_manager', 'manager', 'administrator']) {
  const account = { role, permissions, authoritativePermissions: true };
  assert.equal(usesSalesWorkspace(account), false, role + ' must not land in the representative inbox');
  assert.equal(accountCan(account, PERMISSIONS.VIEW_REPORTS), true);
}
assert.equal(usesSalesWorkspace({ role: 'sales_representative', permissions, authoritativePermissions: true }), true);
assert.equal(usesSalesWorkspace({ role: 'customer', permissions: [], authoritativePermissions: true }), false);
