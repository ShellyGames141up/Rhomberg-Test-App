import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../src/components/Settings.jsx', import.meta.url), 'utf8');
const apiServices = fs.readFileSync(new URL('../src/services/api/createApiServices.js', import.meta.url), 'utf8');
const apiApp = fs.readFileSync(new URL('../apps/api/src/app.js', import.meta.url), 'utf8');
const repository = fs.readFileSync(new URL('../apps/api/src/repositories/postgresRepository.js', import.meta.url), 'utf8');

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

console.log('Forced first-login password onboarding checks passed.');
