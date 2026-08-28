import test from 'node:test';
import assert from 'node:assert/strict';
import { orderScope, hasDepartmentActionScope } from '../src/authorization/orderScope.js';

test('multi-role departmental actions require both queue and action permission', () => {
  const actor={permissions:['view_assigned_orders','view_planning_queue','add_planning_information']};
  assert.equal(hasDepartmentActionScope(actor,'start_planning','add_planning_information'),true);
  assert.equal(hasDepartmentActionScope(actor,'start_delivery','confirm_delivery'),false);
  assert.equal(hasDepartmentActionScope(actor,'cancel_order','add_planning_information'),false);
  assert.equal(hasDepartmentActionScope({permissions:['add_planning_information']},'start_planning','add_planning_information'),false);
});

test('department queues and representative assignment are additive and parameterized', () => {
  const result = orderScope({ permissions: ['view_planning_queue','view_dispatch_queue','view_assigned_orders'], representativeId: 'fabricated-rep', companyIds: [] });
  assert.match(result.predicate, / OR /);
  assert.ok(result.values[1].includes('awaiting_planning'));
  assert.ok(result.values[1].includes('awaiting_dispatch'));
  assert.equal(result.values[0], 'fabricated-rep');
  assert.doesNotMatch(result.predicate, /fabricated-rep/);
});
test('Sales-only scope does not inherit company-wide access or require a department queue', () => {
  assert.deepEqual(orderScope({ permissions: ['view_assigned_orders'], representativeId: 'rep', companyIds: ['company'] }),
    { predicate: '(o.representative_id = $1::uuid)', values: ['rep'] });
  assert.equal(orderScope({ permissions: ['view_assigned_orders'], companyIds: ['company'] }).predicate, 'FALSE');
});
test('no permission fails closed and customer membership stays scoped', () => {
  assert.equal(orderScope({ permissions: [], companyIds: ['company'] }).predicate, 'FALSE');
  const result = orderScope({ permissions: ['view_own_company_orders'], companyIds: ['company'] });
  assert.deepEqual(result.values, [['company']]);
  assert.equal(result.predicate, '(o.company_id = ANY($1::uuid[]))');
});
test('explicit laboratory queue keeps certificate filter and requires lab permission', () => {
  assert.equal(orderScope({ permissions: ['view_all_orders'] }, {forLaboratory:true}).predicate, 'FALSE');
  const result = orderScope({ permissions: ['view_lab_queue','view_planning_queue'] }, {forLaboratory:true});
  assert.match(result.predicate, /order_items/);
  assert.doesNotMatch(result.predicate, /OR o.status/);
  assert.deepEqual(result.values, []);
});
