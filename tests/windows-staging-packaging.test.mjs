import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { validateProductionArtifact } from '../scripts/check-production-artifact.mjs';
import { PRODUCTION_ASSETS, PRODUCTION_PRECACHE_FILES, PUBLIC_CATALOGUE_PDFS } from '../scripts/production-assets.mjs';

const packageMetadata = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(packageMetadata.version, '5.2.0', 'Windows staging uses the approved 5.2.0 baseline');
assert.equal(packageMetadata.packageManager, 'pnpm@11.19.0');
assert.equal(packageMetadata.engines.node, '>=22.0.0 <23');
assert.equal(readFileSync('.nvmrc', 'utf8').trim(), '22');
assert.equal(readFileSync('.node-version', 'utf8').trim(), '22');
assert.deepEqual(PUBLIC_CATALOGUE_PDFS.map(item => path.basename(item.path)).sort(), [
  'PBB-product-sheet.pdf',
  'Pressure-gauge-ordering-guide.pdf',
  'RPT106-product-sheet.pdf',
  'Temperature-ordering-guide.pdf',
  'Utility-gauge-overview.pdf',
].sort(), 'the five staging-approved catalogue PDFs must remain in the production allowlist');

execFileSync(process.execPath, ['scripts/build-production.mjs'], { stdio: 'pipe' });
const result = await validateProductionArtifact();
assert.equal(result.assetsApproved, PRODUCTION_ASSETS.length);
assert.equal(result.precacheTargets, PRODUCTION_PRECACHE_FILES.length);

const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});
const outputAssets = walk('dist-production/assets')
  .filter(file => statSync(file).isFile())
  .map(file => file.replaceAll('\\', '/'))
  .map(file => file.slice('dist-production/'.length))
  .sort();
assert.deepEqual(outputAssets, [...PRODUCTION_ASSETS].sort(), 'production assets must exactly match the explicit allowlist');

const httpClient = readFileSync('src/services/api/HttpClient.js', 'utf8');
assert.doesNotMatch(httpClient, /https?:\/\/(?:localhost|127\.0\.0\.1|\[?::1\]?)/i);

const webConfig = readFileSync('dist-production/web.config', 'utf8');
assert.match(webConfig, /Rhomberg Connect SPA fallback/);
assert.match(webConfig, /Content-Security-Policy/);
assert.doesNotMatch(webConfig, /Strict-Transport-Security/i);
assert.doesNotMatch(webConfig, /reverseProxy|localhost:\d+|127\.0\.0\.1:\d+/i);

execFileSync(process.execPath, ['scripts/generate-release-metadata.mjs'], { stdio: 'pipe' });
const releaseManifest = JSON.parse(readFileSync('dist-production/release-manifest.json', 'utf8'));
assert.equal(releaseManifest.applicationVersion, packageMetadata.version);
assert.equal(releaseManifest.buildCommand, 'pnpm run build:production');
assert.equal(releaseManifest.backendCompatibility.status, 'not-included');
assert.equal(releaseManifest.artifactCount, 96);
assert.equal(releaseManifest.artifacts.length, 96);
assert.deepEqual(
  releaseManifest.artifacts.map(entry => entry.path),
  [...releaseManifest.artifacts.map(entry => entry.path)].sort((left, right) => left.localeCompare(right)),
  'release manifest files must be deterministically ordered',
);
assert.equal(readFileSync('dist-production/CHECKSUMS.sha256', 'utf8').trim().split('\n').length, 96);
assert.match(readFileSync('dist-production/VALIDATION.txt', 'utf8'), /PASS: service-worker precache existence/);

console.log('Windows static staging packaging, allowlist, metadata and IIS safeguards passed.');
