import assert from 'node:assert/strict';
import { customerRecords } from '../src/domain/customerRecords.js';

const records = [
  { id: 'primary', companyId: 'company-a' },
  { id: 'secondary', companyId: 'company-b', origin: 'representative_loaded_order' },
  { id: 'foreign', companyId: 'company-c', accountId: 'customer' },
  { id: 'legacy', accountId: 'customer' },
  { id: 'unscoped' },
];
assert.deepEqual(customerRecords({ id: 'customer', companyId: 'company-a', companyIds: ['company-a', 'company-b'] }, records).map(row => row.id), ['primary', 'secondary', 'legacy']);
assert.deepEqual(customerRecords({ id: 'customer', companyId: 'company-a' }, records).map(row => row.id), ['primary', 'legacy']);
assert.deepEqual(customerRecords(null, records), []);
assert.deepEqual(customerRecords({ id: 'customer' }, records).map(row => row.id), ['legacy']);
console.log('Customer record membership regression passed');
