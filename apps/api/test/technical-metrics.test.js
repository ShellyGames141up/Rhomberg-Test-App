import assert from 'node:assert/strict';
import test from 'node:test';
import {technicalMetrics} from '../src/services/technicalMetrics.js';
test('Technical metrics reflect recorded completion and due dates, not placeholder zeroes',()=>{
  const result=technicalMetrics([
    {status:'technical_support_completed',category:'pressure_range',createdAt:'2026-01-01T00:00:00Z',completedAt:'2026-01-02T00:00:00Z'},
    {status:'awaiting_customer_information',category:'pressure_range',revisedQuotationTarget:'2026-01-02T00:00:00Z'},
  ],Date.parse('2026-01-03T00:00:00Z'));
  assert.equal(result.overdue,1);assert.equal(result.averageResponseHours,24);
  assert.deepEqual(result.byCategory,[{category:'pressure_range',count:2}]);
});
