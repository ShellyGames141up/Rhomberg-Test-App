import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPublicArtifactSafe } from './assert-public-artifact-safe.mjs';
import {
  PRODUCTION_ASSETS,
  PRODUCTION_PRECACHE_FILES,
  PRODUCTION_ROOT_FILES,
} from './production-assets.mjs';
import { validateCatalogueAssetFiles } from './catalogue-assets.mjs';

const root = process.cwd();
const defaultOutput = path.resolve(root, 'dist-production');
const textExtensions = new Set(['.config', '.css', '.html', '.js', '.json', '.svg', '.txt', '.webmanifest']);
const releaseMetadataFiles = new Set(['CHECKSUMS.sha256', 'VALIDATION.txt', 'release-manifest.json']);

const collectFiles = async directory => {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(target));
    else files.push(target);
  }
  return files;
};

const normalise = value => value.replaceAll('\\', '/');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const parsePrecache = source => {
  const match = source.match(/const APP_FILES\s*=\s*(\[[\s\S]*?\]);/);
  assert(match, 'Production service worker must declare APP_FILES.');
  return JSON.parse(match[1]);
};

export const validateServiceWorkerReleaseIdentity = (source, { version, commitSha }) => {
  const match = source.match(/const CACHE_NAME\s*=\s*["']([^"']+)["'];/);
  assert(match, 'Production service worker must declare a release-specific CACHE_NAME.');
  const expected = `rhomberg-connect-staging-v${version}-${String(commitSha).slice(0, 12)}`;
  assert(
    match[1] === expected,
    `Production service worker release identity is stale. Expected ${expected}, received ${match[1]}. Rebuild from the current commit before packaging.`,
  );
  return match[1];
};

export const validateServiceWorkerFreshInstall = source => {
  assert(
    /APP_FILES\.map\(file\s*=>\s*new Request\(file,\s*\{\s*cache:\s*['"]reload['"]\s*\}\)\)/.test(source),
    'Production service worker must bypass the HTTP cache while installing release assets.',
  );
  return true;
};

export async function validateProductionArtifact(output = defaultOutput) {
  const resolvedOutput = path.resolve(output);
  assert(resolvedOutput === defaultOutput, `Refusing to inspect unexpected production path: ${resolvedOutput}`);
  validateCatalogueAssetFiles(root);
  const files = await collectFiles(resolvedOutput);
  const relativeFiles = files.map(file => normalise(path.relative(resolvedOutput, file))).sort();
  const allowedFiles = new Set([...PRODUCTION_ROOT_FILES, ...PRODUCTION_ASSETS, ...releaseMetadataFiles]);

  for (const required of [...PRODUCTION_ROOT_FILES, ...PRODUCTION_ASSETS]) {
    assert(relativeFiles.includes(required), `Production artifact is missing approved file: ${required}`);
  }
  for (const relative of relativeFiles) {
    assert(allowedFiles.has(relative), `Production artifact contains an unapproved file: ${relative}`);
  }

  await assertPublicArtifactSafe(resolvedOutput, { root, allowDemoAccounts: false });

  const textFiles = files.filter(file => textExtensions.has(path.extname(file).toLowerCase()));
  const combined = (await Promise.all(textFiles.map(file => fs.readFile(file, 'utf8')))).join('\n');
  const appBundle = await fs.readFile(path.join(resolvedOutput, 'app.js'), 'utf8');
  const forbidden = [
    ['demo password', /\b(?:Demo123|Sales123|Planning123|Expedite123|Dispatch123|Buyer123|Manager123|Admin123|Lab12345|Quality123|Owner12345)!?\b/i],
    ['fabricated login identity', /\b[A-Z0-9._%+-]+@(?:example\.invalid|client\.test)\b/i],
    ['Preview Centre control', /\bPreview Centre\b|Demo Preview|DEMO PREVIEW|View Demo Login|Back to all test previews|All previews|preview-landing/i],
    ['Executive Demo role switching', /Executive Demo Mode|services\.executiveDemo\.switchRole|\.switchRole\(/i],
    ['mock service implementation', /createMockServices|DEMO_LOGINS|rhombergPreviewSeed/i],
    ['protected pricing marker', /RHOMBERG_PRICEBOOK|REP-ONLY PRICED RFQ|\bunitPrice\b/i],
    ['browser-local operational storage', /rhombergWorkflowState|rhombergPreviewSession|rhombergPreviewAccounts|STORE_KEYS\.workflowState/i],
    ['private configuration', /internal-staff\.local\.json|OWNER_TO_SUPPLY_|pending_owner_configuration/i],
    ['credential PDF password name', /RHOMBERG_CREDENTIAL_PDF_PASSWORD/i],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
    ['API key or client secret assignment', /\b(?:api[_-]?key|client[_-]?secret|signing[_-]?key)\s*[:=]\s*['"][^'"]+['"]/i],
    ['credential-bearing database URL', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/]+:[^@\s/]+@/i],
    ['absolute local path', /\b[A-Z]:\\Users\\/i],
  ];
  const executableSurface = `${appBundle}\n${await fs.readFile(path.join(resolvedOutput, 'index.html'), 'utf8')}\n${await fs.readFile(path.join(resolvedOutput, 'runtime-config.js'), 'utf8')}`;
  const executableOnlyLabels = new Set([
    'Preview Centre control',
    'Executive Demo role switching',
    'mock service implementation',
    'browser-local operational storage',
  ]);
  for (const [label, pattern] of forbidden) {
    assert(!pattern.test(executableOnlyLabels.has(label) ? executableSurface : combined), `Production artifact contains ${label}.`);
  }
  assert(!/sourceMappingURL/i.test(appBundle), 'Production JavaScript contains a source-map reference.');
  assert(!relativeFiles.some(file => file.endsWith('.map')), 'Production artifact contains a source map.');

  const runtime = await fs.readFile(path.join(resolvedOutput, 'runtime-config.js'), 'utf8');
  assert(/apiBaseUrl:\s*['"]\/api\/v1['"]/.test(runtime), 'Production runtime config must use same-origin /api/v1.');
  assert(/environmentName:\s*['"]staging['"]/.test(runtime), 'Production runtime config must identify staging.');
  assert(/notificationTransport:\s*['"]api['"]/.test(runtime), 'Production runtime config must use the API notification transport.');
  assert(!/environmentName:\s*['"]preview['"]|notificationTransport:\s*['"]mock['"]/.test(runtime), 'Production runtime config must not use preview/mock mode.');

  const manifest = JSON.parse(await fs.readFile(path.join(resolvedOutput, 'manifest.webmanifest'), 'utf8'));
  assert(manifest.name === 'Rhomberg Connect', 'Production manifest must use the Rhomberg Connect name.');
  assert(manifest.start_url === '/', 'Production manifest start_url must target the IIS site root.');
  assert(manifest.scope === '/', 'Production manifest scope must target the IIS site root.');
  assert(!JSON.stringify(manifest).match(/preview|demo|\/app\/|\/desktop\/|\/mobile\//i), 'Production manifest contains a preview/demo or missing route.');

  const serviceWorker = await fs.readFile(path.join(resolvedOutput, 'sw.js'), 'utf8');
  const packageMetadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  validateServiceWorkerReleaseIdentity(serviceWorker, { version: packageMetadata.version, commitSha });
  validateServiceWorkerFreshInstall(serviceWorker);
  const precache = parsePrecache(serviceWorker);
  assert(JSON.stringify(precache) === JSON.stringify(PRODUCTION_PRECACHE_FILES), 'Production service-worker precache list differs from the approved list.');
  for (const entry of precache) {
    const relative = entry.replace(/^\.\//, '').replace(/^\//, '').replace(/[?#].*$/, '');
    const expected = relative ? path.join(resolvedOutput, relative) : path.join(resolvedOutput, 'index.html');
    assert(await fs.stat(expected).then(() => true, () => false), `Service-worker precache target does not exist: ${entry}`);
  }

  const index = await fs.readFile(path.join(resolvedOutput, 'index.html'), 'utf8');
  assert(!/rhomberg-preview|desktop application|preview|demo/i.test(index), 'Production index contains preview/demo metadata.');
  assert(index.includes('<base href="/">'), 'Production index must be rooted at the IIS site root.');

  const webConfig = await fs.readFile(path.join(resolvedOutput, 'web.config'), 'utf8');
  for (const marker of ['Rhomberg Connect SPA fallback', 'Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options', 'directoryBrowse enabled="false"']) {
    assert(webConfig.includes(marker), `IIS web.config is missing ${marker}.`);
  }
  assert(!/Strict-Transport-Security/i.test(webConfig), 'HSTS must not be enabled until Innovate IT confirms HTTPS for the staging hostname.');
  assert(!/https?:\/\/(?:localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?/i.test(executableSurface), 'Production browser code contains a loopback endpoint.');
  assert(webConfig.includes('<rule name="Rhomberg Connect API reverse proxy" stopProcessing="true">'), 'IIS web.config is missing the approved API reverse proxy rule.');
  assert(webConfig.includes('<match url="^api/v1(.*)$" />'), 'IIS reverse proxy must match only the approved /api/v1 path.');
  assert(webConfig.includes('<action type="Rewrite" url="http://127.0.0.1:3000/api/v1{R:1}" appendQueryString="true" />'), 'IIS reverse proxy must preserve the API path and query string while targeting the loopback-only Node service.');
  assert(!/API unavailable until backend approval|type="CustomResponse"[^>]+statusCode="503"/i.test(webConfig), 'IIS web.config still contains the obsolete API-unavailable response.');
  assert(webConfig.indexOf('Rhomberg Connect API reverse proxy') < webConfig.indexOf('Rhomberg Connect SPA fallback'), 'IIS API routing must run before the SPA fallback.');

  return {
    filesScanned: relativeFiles.length,
    assetsApproved: PRODUCTION_ASSETS.length,
    precacheTargets: precache.length,
    validations: [
      'approved-file allowlist',
      'catalogue reference integrity',
      'public artifact privacy scan',
      'demo/mock/secret/path scan',
      'runtime configuration',
      'manifest routes',
      'service-worker release identity',
      'service-worker precache existence',
      'IIS static/security configuration',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateProductionArtifact();
  console.log(`Production artifact passed ${result.validations.length} validation groups across ${result.filesScanned} files.`);
}
