import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { hashPassword } from '../security/crypto.js';

const config = loadConfig();
if (config.environment !== 'development' || !config.devIdentityEnabled) throw new Error('Fabricated seeding is allowed only when RHOMBERG_API_ENV=development and RHOMBERG_API_DEV_IDENTITY_ENABLED=true.');
const password = process.env.RHOMBERG_API_DEV_SEED_PASSWORD;
if (!password || password.length < 14) throw new Error('Supply RHOMBERG_API_DEV_SEED_PASSWORD at runtime with at least 14 characters. It is never written to source control.');

const pool = createPool(config);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const companyId = randomUUID(); const customerId = randomUUID(); const representativeUserId = randomUUID(); const representativeId = randomUUID();
  const passwordHash = await hashPassword(password);
  await client.query("INSERT INTO app.companies (id,name,area,industry) VALUES ($1,'Fabricated Phase 1 Engineering','Test Region','Fabricated Manufacturing')", [companyId]);
  await client.query(`INSERT INTO app.users (id,email,display_name,password_hash) VALUES
    ($1,'customer.phase1@example.invalid','Fabricated Phase 1 Customer',$3),
    ($2,'representative.phase1@example.invalid','Fabricated Phase 1 Representative',$3)`, [customerId, representativeUserId, passwordHash]);
  await client.query("INSERT INTO app.user_roles (user_id,role_code) VALUES ($1,'customer'),($2,'sales_representative')", [customerId, representativeUserId]);
  await client.query('INSERT INTO app.company_users (company_id,user_id,is_primary) VALUES ($1,$2,true)', [companyId, customerId]);
  await client.query("INSERT INTO app.representatives (id,user_id,display_name,branch_name) VALUES ($1,$2,'Fabricated Phase 1 Representative','Fabricated Test Branch')", [representativeId, representativeUserId]);
  await client.query('INSERT INTO app.representative_company_assignments (representative_id,company_id) VALUES ($1,$2)', [representativeId, companyId]);
  await client.query(`INSERT INTO app.products (id,code,name,configuration_schema) VALUES
    ('phase1-pressure-gauge','DEMO-PG','Fabricated pressure gauge','[{"key":"dialSize","required":true}]'::jsonb),
    ('phase1-temperature-gauge','DEMO-TG','Fabricated temperature gauge','[{"key":"stemLength","required":true}]'::jsonb)`);
  await client.query('COMMIT');
  console.log(JSON.stringify({ event: 'fabricated_seed_complete', companyId, customerId, representativeId, identities: ['customer.phase1@example.invalid', 'representative.phase1@example.invalid'] }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
