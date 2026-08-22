import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');
const manifest = await fs.readFile(path.join(androidRoot, 'app/src/main/AndroidManifest.xml'), 'utf8');
const build = await fs.readFile(path.join(androidRoot, 'app/build.gradle'), 'utf8');
const variables = await fs.readFile(path.join(androidRoot, 'variables.gradle'), 'utf8');
const strings = await fs.readFile(path.join(androidRoot, 'app/src/main/res/values/strings.xml'), 'utf8');
const network = await fs.readFile(path.join(androidRoot, 'app/src/main/res/xml/network_security_config.xml'), 'utf8');
const capacitor = JSON.parse(await fs.readFile(path.join(androidRoot, 'app/src/main/assets/capacitor.config.json'), 'utf8'));

assert(manifest.includes('android:usesCleartextTraffic="false"'), 'Android cleartext traffic must be disabled.');
assert(manifest.includes('android:allowBackup="false"'), 'Android application backup must be disabled.');
assert.equal((manifest.match(/<uses-permission/g) || []).length, 2, 'Android must request only the reviewed permissions.');
assert(manifest.includes('android.permission.INTERNET'), 'Android Internet permission is required.');
assert(manifest.includes('android.permission.VIBRATE'), 'Android vibration permission is required for the existing haptic setting.');
assert(network.includes('cleartextTrafficPermitted="false"'), 'Android network security must deny cleartext traffic.');
assert(build.includes('applicationId "za.co.rhomberg.connect"'), 'Android application ID is incorrect.');
assert(build.includes('versionCode 5020001') && build.includes('versionName "5.2.0-internal.1"'), 'Android internal-test version is incorrect.');
assert(variables.includes('compileSdkVersion = 36') && variables.includes('targetSdkVersion = 36'), 'Android must compile and target API 36.');
assert(strings.includes('<string name="app_name">Rhomberg Connect</string>'), 'Android display name is incorrect.');
assert.equal(`${capacitor.server.androidScheme}://${capacitor.server.hostname}`, 'https://connect.rhomberg.co.za', 'Android WebView origin is not the approved single-domain same-site origin.');
assert.equal(capacitor.server.url, undefined, 'Android must keep bundled web assets and must not remotely load the staging site.');
assert.equal(capacitor.plugins?.CapacitorHttp?.enabled, undefined, 'Native HTTP override must remain disabled for standards-based authentication.');

const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const approvedIcon = hash(await fs.readFile(path.join(root, 'assets/images/rhomberg-connect-icon-512.png')));
const nativeIcon = hash(await fs.readFile(path.join(androidRoot, 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')));
assert.equal(nativeIcon, approvedIcon, 'Android launcher icon must use the approved Rhomberg Connect source.');

const nativeWeb = path.join(androidRoot, 'app/src/main/assets/public');
const forbiddenNames = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (/^(preview|demo|private|private-config|test|tests)$/i.test(entry.name)) forbiddenNames.push(path.relative(nativeWeb, absolute));
      await walk(absolute);
    } else if (entry.name.endsWith('.map')) forbiddenNames.push(path.relative(nativeWeb, absolute));
  }
}
await walk(nativeWeb);
assert.deepEqual(forbiddenNames, [], `Android web assets contain forbidden files: ${forbiddenNames.join(', ')}`);
const nativeRuntime = await fs.readFile(path.join(nativeWeb, 'runtime-config.js'), 'utf8');
assert(nativeRuntime.includes("environmentName: 'internal-staging'"), 'Android web assets must identify Internal Staging.');
assert(nativeRuntime.includes('https://connect.rhomberg.co.za:8443/api/v1'), 'Android web assets must use the approved HTTPS API endpoint.');

console.log('Android project validated: identity, API 36, HTTPS-only networking, Internet/Vibrate permissions, official icon and production-safe web assets.');
