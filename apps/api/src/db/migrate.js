import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function runMigrations(client, directory = migrationsDirectory) {
  await client.query(`CREATE TABLE IF NOT EXISTS public.rhomberg_schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set((await client.query('SELECT version FROM public.rhomberg_schema_migrations')).rows.map(row => row.version));
  const migrations = (await fs.readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const migration of migrations) {
    if (applied.has(migration)) continue;
    const sql = await fs.readFile(path.join(directory, migration), 'utf8');
    await client.query('BEGIN');
    try {
      if (typeof client.exec === 'function') await client.exec(sql);
      else await client.query(sql);
      await client.query('INSERT INTO public.rhomberg_schema_migrations (version) VALUES ($1)', [migration]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return migrations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const pool = createPool(config);
  try {
    const migrations = await runMigrations(pool);
    console.log(JSON.stringify({ event: 'migrations_complete', count: migrations.length }));
  } finally {
    await pool.end();
  }
}
