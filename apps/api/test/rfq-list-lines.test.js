import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresRepository } from '../src/repositories/postgresRepository.js';

test('PostgreSQL RFQ list batches persisted selectable lines using only scoped parent IDs', async()=>{
  const actor={id:'a',role:'sales_representative',permissions:['view_assigned_rfqs'],companyIds:['company-a'],representativeId:'rep-a',databaseSessionTokenHash:'fabricated'};
  const statements=[];
  const repository=createPostgresRepository({connect:async()=>({
    release(){},
    async query(sql,values){
      statements.push({sql,values});
      if(sql.includes('establish_request_context'))return {rows:[{user_id:'a'}]};
      if(sql.includes('FROM app.rfqs r')) {
        assert.match(sql,/r.company_id = ANY/);
        assert.match(sql,/r.representative_id = \$2/);
        return {rows:[{id:'rfq-a',company_id:'company-a',representative_id:'rep-a'}]};
      }
      if(sql.includes('FROM app.rfq_items')) {
        assert.deepEqual(values,[['rfq-a']]);
        return {rows:[{id:'line-a',rfq_id:'rfq-a',product_code_snapshot:'PBB',product_name_snapshot:'Fabricated gauge',quantity:2,configuration:{range:'0-10'}}]};
      }
      return {rows:[]};
    },
  })});
  const [rfq]=await repository.listEnquiries(actor);
  assert.deepEqual(rfq.items.map(item=>[item.lineId,item.code,item.quantity]),[['line-a','PBB',2]]);
  assert.equal(statements.filter(item=>item.sql.includes('FROM app.rfq_items')).length,1);
  assert.equal(statements.at(-1).sql,'COMMIT');
});
