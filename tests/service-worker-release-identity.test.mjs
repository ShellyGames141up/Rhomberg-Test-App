import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateServiceWorkerFreshInstall, validateServiceWorkerReleaseIdentity } from '../scripts/check-production-artifact.mjs';

const current = '99c8517c80aa2af6e7d61441c91bbed4181bb039';
const valid = 'const CACHE_NAME = "rhomberg-connect-staging-v5.2.0-99c8517c80aa";';
const stale = 'const CACHE_NAME = "rhomberg-connect-staging-v5.2.0-7b0b22f82d4d";';

assert.equal(
  validateServiceWorkerReleaseIdentity(valid, { version: '5.2.0', commitSha: current }),
  'rhomberg-connect-staging-v5.2.0-99c8517c80aa',
);
assert.throws(
  () => validateServiceWorkerReleaseIdentity(stale, { version: '5.2.0', commitSha: current }),
  /release identity is stale/i,
  'a package built from an earlier commit must fail closed',
);

assert.equal(
  validateServiceWorkerFreshInstall("cache.addAll(APP_FILES.map(file => new Request(file, { cache: 'reload' })))"),
  true,
);
assert.throws(
  () => validateServiceWorkerFreshInstall('cache.addAll(APP_FILES)'),
  /bypass the HTTP cache/i,
  'a new worker must not repopulate its release cache from a stale HTTP response',
);
assert.match(
  readFileSync('src/main.jsx', 'utf8'),
  /serviceWorker\.register\(['"]\.\/sw\.js['"],\s*\{\s*updateViaCache:\s*['"]none['"]\s*\}\)/,
  'the browser must revalidate the service-worker script without the HTTP cache',
);
assert.throws(
  () => validateServiceWorkerReleaseIdentity('const APP_FILES = [];', { version: '5.2.0', commitSha: current }),
  /release-specific CACHE_NAME/i,
);

console.log('Service-worker release identity checks passed.');
