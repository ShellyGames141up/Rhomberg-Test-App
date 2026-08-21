import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInternalStagingApiUrl } from './internal-staging-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-internal-staging');
const files = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else files.push(path.relative(output, absolute).replaceAll('\\', '/'));
  }
}
await walk(output);

for (const required of ['index.html', 'app.js', 'styles.css', 'runtime-config.js', 'manifest.webmanifest', 'sw.js']) {
  assert(files.includes(required), `Internal-staging artifact is missing ${required}.`);
}
assert(!files.some(file => file.endsWith('.map')), 'Internal-staging artifact must not contain source maps.');
assert(!files.some(file => /(^|\/)(preview|demo|private|private-config|test|tests)(\/|$)/i.test(file)), 'Internal-staging artifact contains a forbidden directory.');

const runtime = await fs.readFile(path.join(output, 'runtime-config.js'), 'utf8');
assert(/environmentName:\s*['"]internal-staging['"]/.test(runtime), 'Internal-staging environment label is missing.');
assert(/applicationVersion:\s*['"]5\.2\.0-internal\.1['"]/.test(runtime), 'Internal-staging version is incorrect.');
const apiMatch = runtime.match(/apiBaseUrl:\s*(['"])(.*?)\1/);
assert(apiMatch, 'Internal-staging API URL is missing.');
validateInternalStagingApiUrl(apiMatch[2]);

const executable = `${await fs.readFile(path.join(output, 'app.js'), 'utf8')}\n${runtime}\n${await fs.readFile(path.join(output, 'index.html'), 'utf8')}`;
for (const forbidden of [
  /demo\.customer@example\.invalid/i,
  /Preview Centre/i,
  /Executive Demo/i,
  /notificationTransport:\s*['"]mock['"]/i,
  /postgres(?:ql)?:\/\/[^\s'"<]+:[^\s'"<]+@/i,
  /RHOMBERG_API_(?:SESSION_PEPPER|BOOTSTRAP_PASSWORD|DATABASE_URL)/,
]) assert(!forbidden.test(executable), `Internal-staging artifact matched forbidden pattern ${forbidden}.`);

console.log(`Internal-staging artifact validated: ${files.length} files; secure public API configuration; no preview, mock, source-map or secret surface.`);
