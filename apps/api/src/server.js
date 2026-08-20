import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createPostgresRepository } from './repositories/postgresRepository.js';
import { createLocalPrivateStorage } from './storage/localPrivateStorage.js';
import { buildApp } from './app.js';

const config = loadConfig();
const pool = createPool(config);
const repository = createPostgresRepository(pool);
const storage = createLocalPrivateStorage({ root: config.localStorageRoot, maxBytes: config.maxUploadBytes });
const app = await buildApp({ config, repository, storage });

let shuttingDown = false;
const shutdown = async signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'graceful shutdown started');
  const timer = setTimeout(() => process.exit(1), config.shutdownTimeoutMs).unref();
  try {
    await app.close();
    await repository.close();
    clearTimeout(timer);
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'graceful shutdown failed');
    process.exit(1);
  }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await app.listen({ host: config.host, port: config.port });
