import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../src/components/Settings.jsx', import.meta.url), 'utf8');
const apiServices = fs.readFileSync(new URL('../src/services/api/createApiServices.js', import.meta.url), 'utf8');
const apiApp = fs.readFileSync(new URL('../apps/api/src/app.js', import.meta.url), 'utf8');
const repository = fs.readFileSync(new URL('../apps/api/src/repositories/postgresRepository.js', import.meta.url), 'utf8');
const administration = fs.readFileSync(new URL('../src/components/AdministratorDashboard.jsx', import.meta.url), 'utf8');
const deletionMigration = fs.readFileSync(new URL('../apps/api/migrations/015_administrator_account_soft_delete.sql', import.meta.url), 'utf8');

assert.match(app, /session && !session\.forcePasswordChange/, 'startup must not load operational services before first-login password replacement');
assert.match(app, /if \(signedInAccount\.forcePasswordChange\)/, 'sign-in must route temporary-password accounts to the security step');
assert.match(app, /account\?\.forcePasswordChange && target !== 'settings'/, 'temporary-password users must not navigate into operational screens');
assert.match(settings, /Replace temporary password/);
assert.match(settings, /Change password and sign out/);
assert.match(settings, /minLength="16"/);
assert.match(apiServices, /client\.post\('\/auth\/change-password'/);
assert.match(apiApp, /PASSWORD_CHANGE_REQUIRED/);
assert.match(apiApp, /body\.currentPassword/);
assert.match(apiApp, /body\.newPassword/);
assert.match(repository, /u\.must_change_password/);
assert.match(administration, /Delete account/);
assert.match(administration, /Historical records and audit evidence were preserved/);
assert.match(apiServices, /client\.delete\(`\/admin\/users\/\$\{encodeURIComponent\(accountId\)\}`/);
assert.match(apiApp, /app\.delete\('\/api\/v1\/admin\/users\/:accountId'/);
assert.match(deletionMigration, /Administrator-only account deletion is a soft deletion/);
assert.match(deletionMigration, /UPDATE app\.sessions SET revoked_at/);
assert.match(deletionMigration, /administrator\.user_soft_deleted/);

console.log('Forced first-login password onboarding and Administrator account deletion checks passed.');
