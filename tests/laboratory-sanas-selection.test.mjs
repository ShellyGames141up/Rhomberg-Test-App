import assert from 'node:assert/strict';
import {laboratoryManagerCanHandle} from '../src/domain/laboratoryLaunch.js';

for (const role of ['laboratory_manager','laboratory_manager_temperature']) {
  assert.equal(laboratoryManagerCanHandle({role},'sanas'),true);
  assert.equal(laboratoryManagerCanHandle({role},'traceable'),true);
}
assert.equal(laboratoryManagerCanHandle({role:'laboratory_manager_pressure'},'sanas'),true);
for (const role of ['customer','sales_representative','dispatch','laboratory_technician']) {
  assert.equal(laboratoryManagerCanHandle({role},'sanas'),false);
}
