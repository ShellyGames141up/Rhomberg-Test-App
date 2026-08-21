import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateInternalStagingApiUrl } from './internal-staging-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist-production');
const output = path.join(root, 'dist-internal-staging');
const apiBaseUrl = validateInternalStagingApiUrl(process.env.RHOMBERG_PUBLIC_API_URL);

execFileSync(process.execPath, [path.join(root, 'scripts/build-production.mjs')], { cwd: root, stdio: 'inherit' });
await fs.rm(output, { recursive: true, force: true });
await fs.cp(source, output, { recursive: true });

const runtimeConfig = `// Public internal-staging settings only. Never place credentials, tokens or private endpoints in this file.\nwindow.__RHOMBERG_APP_CONFIG__ = Object.freeze({\n  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},\n  requestTimeoutMs: 15000,\n  environmentName: 'internal-staging',\n  applicationVersion: '5.2.0-internal.1',\n  notificationTransport: 'api',\n});\n`;
await fs.writeFile(path.join(output, 'runtime-config.js'), runtimeConfig, 'utf8');

const manifestPath = path.join(output, 'manifest.webmanifest');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
manifest.description = 'Rhomberg Connect internal staging application.';
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

execFileSync(process.execPath, [path.join(root, 'scripts/check-internal-staging-artifact.mjs')], { cwd: root, stdio: 'inherit' });
console.log(`Prepared internal-staging client in ${output}`);
console.log(`Public API endpoint: ${apiBaseUrl}`);
