import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInternalStagingApiUrl } from '../scripts/internal-staging-config.mjs';

test('internal staging accepts only the approved HTTPS API origins', () => {
  assert.equal(validateInternalStagingApiUrl(), 'https://connect.rhom.co.za:8443/api/v1');
  assert.equal(validateInternalStagingApiUrl('https://connect.rhom.co.za:8443/api/v1'), 'https://connect.rhom.co.za:8443/api/v1');
  for (const unsafe of [
    'http://connect.rhom.co.za/api/v1',
    'https://connect.rhom.co.za/api/v1',
    'https://connect.rhomberg.co.za:8443/api/v1',
    'https://example.invalid/api/v1',
    'https://connect.rhom.co.za:9443/api/v1',
    'https://user:secret@connect.rhom.co.za/api/v1',
  ]) assert.throws(() => validateInternalStagingApiUrl(unsafe));
});

test('Capacitor configuration is production-branded and cleartext-disabled', () => {
  const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(config.appId, 'za.co.rhomberg.connect');
  assert.equal(config.appName, 'Rhomberg Connect');
  assert.equal(config.webDir, 'dist-internal-staging');
  assert.equal(config.server.cleartext, false);
  assert.equal(config.server.androidScheme, 'https');
  assert.equal(config.server.hostname, 'connect.rhom.co.za');
  assert.equal(config.server.url, undefined);
  assert.equal(config.plugins?.CapacitorHttp?.enabled, undefined);
});

test('native signing material is ignored', () => {
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  for (const pattern of ['*.jks', '*.keystore', 'android/keystore.properties']) assert(ignore.includes(pattern));
});

test('Windows PWA identity keeps signing and publisher values external', () => {
  const identity = JSON.parse(fs.readFileSync('deployment/windows-client/windows-app.json', 'utf8'));
  assert.equal(identity.name, 'Rhomberg Connect');
  assert.equal(identity.version, '5.2.0-internal.1');
  assert.equal(identity.delivery, 'installed-pwa');
  assert.equal(identity.publisher, 'REQUIRES_RHOMBERG_APPROVAL');
  assert.equal(identity.startUrl, 'https://connect.rhom.co.za:8443/');
});

test('internal staging uses the approved version baseline', () => {
  const source = fs.readFileSync('scripts/build-internal-staging.mjs', 'utf8');
  assert(source.includes("applicationVersion: '5.2.0-internal.1'"));
});
