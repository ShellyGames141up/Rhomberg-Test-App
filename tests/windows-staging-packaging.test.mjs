import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { validateProductionArtifact } from '../scripts/check-production-artifact.mjs';
import { CATALOGUE_ASSET_MANIFEST, PRODUCTION_ASSETS, PRODUCTION_PRECACHE_FILES, PRODUCTION_ROOT_FILES, PUBLIC_CATALOGUE_PDFS } from '../scripts/production-assets.mjs';

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
].sort(), 'the complete repository-backed customer PDF set must remain in the catalogue manifest');
assert.equal(CATALOGUE_ASSET_MANIFEST.length, 68, 'all product images, catalogue support images and documents currently referenced by the application must be approved');

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
assert.match(webConfig, /<rule name="Rhomberg Connect API reverse proxy" stopProcessing="true">/);
assert.match(webConfig, /<match url="\^api\/v1\(\.\*\)\$" \/>/);
assert.match(webConfig, /<action type="Rewrite" url="http:\/\/127\.0\.0\.1:3000\/api\/v1\{R:1\}" appendQueryString="true" \/>/);
assert.doesNotMatch(webConfig, /API unavailable until backend approval|type="CustomResponse"[^>]+statusCode="503"/i);
assert.ok(webConfig.indexOf('Rhomberg Connect API reverse proxy') < webConfig.indexOf('Rhomberg Connect SPA fallback'));

execFileSync(process.execPath, ['scripts/generate-release-metadata.mjs'], { stdio: 'pipe' });
const releaseManifest = JSON.parse(readFileSync('dist-production/release-manifest.json', 'utf8'));
assert.equal(releaseManifest.applicationVersion, packageMetadata.version);
assert.equal(releaseManifest.buildCommand, 'pnpm run build:production');
assert.equal(releaseManifest.backendCompatibility.status, 'not-included');
const expectedPayloadFiles = PRODUCTION_ROOT_FILES.length + PRODUCTION_ASSETS.length;
assert.equal(releaseManifest.artifactCount, expectedPayloadFiles);
assert.equal(releaseManifest.artifacts.length, expectedPayloadFiles);
assert.deepEqual(
  releaseManifest.artifacts.map(entry => entry.path),
  [...releaseManifest.artifacts.map(entry => entry.path)].sort((left, right) => left.localeCompare(right)),
  'release manifest files must be deterministically ordered',
);
assert.equal(readFileSync('dist-production/CHECKSUMS.sha256', 'utf8').trim().split('\n').length, expectedPayloadFiles);
assert.match(readFileSync('dist-production/VALIDATION.txt', 'utf8'), /PASS: service-worker precache existence/);

console.log('Windows static staging packaging, allowlist, metadata and IIS safeguards passed.');
