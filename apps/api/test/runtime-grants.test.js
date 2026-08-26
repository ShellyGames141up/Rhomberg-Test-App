import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const grantScriptUrl = new URL('../sql/phase1-runtime-grants.sql', import.meta.url);

test('runtime grants validate approved functions before revoking existing access', async () => {
  const sql = await fs.readFile(grantScriptUrl, 'utf8');
  const preflightIndex = sql.indexOf("RAISE EXCEPTION 'Approved application functions are missing: %'");
  const firstRevokeIndex = sql.indexOf('REVOKE ALL ON SCHEMA app');
  assert.ok(preflightIndex >= 0, 'missing approved-function preflight');
  assert.ok(firstRevokeIndex > preflightIndex, 'runtime privileges must not be revoked before preflight');
});

test('runtime grants use the explicit catalogue allowlist and verify every execute permission', async () => {
  const sql = await fs.readFile(grantScriptUrl, 'utf8');
  for (const functionName of ['register_customer_account', 'resolve_rfq_representative', 'soft_delete_user', 'current_user_id']) {
    assert.match(sql, new RegExp(`app\\.${functionName}\\(`));
  }
  assert.match(sql, /to_regprocedure\(required_signature\)/);
  assert.match(sql, /to_regprocedure\(signature\)/);
  assert.match(sql, /has_function_privilege\(:'runtime_role',to_regprocedure\(signature\),'EXECUTE'\)/);
  assert.match(sql, /app\.register_customer_account\(uuid,uuid,text,text,text,text,text,text,text,text,text\)/);
  assert.match(sql, /\\quit 3/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON ALL FUNCTIONS/);
});
