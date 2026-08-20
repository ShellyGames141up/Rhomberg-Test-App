import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('staging API exposes no fabricated seed command or development identity switch', () => {
  const apiPackage = JSON.parse(read('apps/api/package.json'));
  assert.equal(apiPackage.scripts['seed:fabricated'], undefined);
  assert.equal(fs.existsSync(new URL('../apps/api/src/db/seed-fabricated.js', import.meta.url)), false);
  const environment = read('.env.example');
  assert.doesNotMatch(environment, /DEV_SEED_PASSWORD|DEV_IDENTITY_ENABLED/);
  assert.match(environment, /RHOMBERG_API_BOOTSTRAP_USERNAME=\r?\n/);
  assert.match(environment, /RHOMBERG_API_BOOTSTRAP_PASSWORD=\r?\n/);
});

test('production build retains compile-time demo exclusion and API-only service binding', () => {
  const build = read('scripts/build-production.mjs');
  assert.match(build, /__PUBLIC_PREVIEW__:\s*'false'/);
  assert.match(build, /services\/apiEntry\.js/);
  assert.match(build, /ProductionPreviewLanding\.jsx/);
  assert.match(build, /ProductionExecutiveWorkflowDemo\.jsx/);
  const apiServices = read('src/services/api/createApiServices.js');
  assert.match(apiServices, /getDemoLogins\(\)\s*\{\s*return \[\]/);
});

test('bootstrap is CLI-only and does not expose a browser-local Administrator fallback', () => {
  const app = read('apps/api/src/app.js');
  assert.doesNotMatch(app, /(?:get|post|put|patch)\(['"]\/api\/v1\/(?:auth\/)?bootstrap/);
  const bootstrap = read('apps/api/src/db/bootstrapAdministrator.js');
  assert.match(bootstrap, /createPostgresBootstrapRepository/);
  assert.doesNotMatch(bootstrap, /localStorage|sessionStorage|document\.|window\./);
  assert.doesNotMatch(bootstrap, /JSON\.stringify\([^\n]*(?:username|password|passwordHash)/);
  assert.doesNotMatch(bootstrap, /console\.(?:log|error|warn)/);
});
