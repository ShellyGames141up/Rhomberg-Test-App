import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';

const { Client } = pg;

for (const fabricatedPassword of ['12345678', 'A1b2C3d4']) {
  test(`database URL preserves a ${/^\d+$/.test(fabricatedPassword) ? 'numeric' : 'mixed alphanumeric'} password as a string at the pg client boundary`, async () => {
    const databaseUrl = `postgresql://rhomberg_test_migrator:${fabricatedPassword}@localhost:5432/rhomberg_connect_test`;
    const config = loadConfig({
      RHOMBERG_API_ENV: 'test',
      RHOMBERG_API_DATABASE_URL: databaseUrl,
      RHOMBERG_API_DATABASE_POOL_MAX: '2',
    });
    const pool = createPool(config);
    try {
      assert.equal(typeof config.databaseUrl, 'string');
      assert.equal(pool.options.connectionString, databaseUrl);

      const client = new Client(pool.options);
      assert.equal(typeof client.connectionParameters.password, 'string');
      assert.equal(client.connectionParameters.password.length, fabricatedPassword.length);
      assert.equal(client.connectionParameters.user, 'rhomberg_test_migrator');
      assert.equal(client.connectionParameters.host, 'localhost');
      assert.equal(client.connectionParameters.port, 5432);
      assert.equal(client.connectionParameters.database, 'rhomberg_connect_test');
    } finally {
      await pool.end();
    }
  });
}
