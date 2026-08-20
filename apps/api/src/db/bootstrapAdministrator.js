import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { createPostgresBootstrapRepository } from '../repositories/postgresBootstrapRepository.js';
import { createBootstrapService, loadBootstrapInput } from '../services/bootstrapService.js';

export async function runAdministratorBootstrap(env = process.env) {
  const config = loadConfig(env);
  const input = loadBootstrapInput(env);
  const pool = createPool(config);
  try {
    return await createBootstrapService({ repository: createPostgresBootstrapRepository(pool) }).initialise(input);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAdministratorBootstrap().then(result => {
    process.stdout.write(`${JSON.stringify({ event: 'administrator_bootstrap', status: result.status })}\n`);
  }).catch(error => {
    process.stderr.write(`${JSON.stringify({ event: 'administrator_bootstrap_failed', code: error.code || 'BOOTSTRAP_FAILED' })}\n`);
    process.exitCode = 1;
  });
}
