import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build, transform } from 'esbuild';
import { validateProductionArtifact } from './check-production-artifact.mjs';
import {
  PRODUCTION_ASSETS,
  PRODUCTION_PRECACHE_FILES,
} from './production-assets.mjs';
import { validateCatalogueAssetFiles } from './catalogue-assets.mjs';

const root = process.cwd();
const output = path.resolve(root, 'dist-production');
const expectedOutput = path.resolve(root, 'dist-production');
if (output !== expectedOutput || path.dirname(output) !== root) throw new Error('Refusing to prepare an unexpected production output path.');

const packageMetadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const commitSha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const cacheName = `rhomberg-connect-staging-v${packageMetadata.version}-${commitSha}`;

validateCatalogueAssetFiles(root);

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true,
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  target: ['es2020'],
  define: { __PUBLIC_PREVIEW__: 'false' },
  plugins: [{
    name: 'select-private-cloud-services',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/services\/index\.js$/ }, () => ({ path: path.join(root, 'src/services/apiEntry.js') }));
      buildContext.onResolve({ filter: /^\.\/apps\/PreviewLanding\.jsx$/ }, () => ({ path: path.join(root, 'src/apps/ProductionPreviewLanding.jsx') }));
      buildContext.onResolve({ filter: /^\.\/apps\/ExecutiveWorkflowDemo\.jsx$/ }, () => ({ path: path.join(root, 'src/apps/ProductionExecutiveWorkflowDemo.jsx') }));
      buildContext.onResolve({ filter: /^\.\/MockAdministrationControls\.jsx$/ }, () => ({ path: path.join(root, 'src/components/ProductionAdministrationControls.jsx') }));
      buildContext.onResolve({ filter: /(?:^|\/)shared\/platform\/previewConfig\.js$/ }, () => ({ path: path.join(root, 'src/shared/platform/productionPlatformConfig.js') }));
    },
  }],
  outfile: path.join(output, 'app.js'),
});

for (const [source, destination] of [
  ['deployment/windows/index.html', 'index.html'],
  ['deployment/windows/runtime-config.js', 'runtime-config.js'],
  ['deployment/windows/web.config', 'web.config'],
]) {
  await fs.copyFile(path.join(root, source), path.join(output, destination));
}

const productionStyles = await transform(await fs.readFile(path.join(root, 'styles.css'), 'utf8'), {
  loader: 'css',
  minify: true,
  target: 'es2020',
});
await fs.writeFile(path.join(output, 'styles.css'), productionStyles.code, 'utf8');

const productionManifest = {
  name: 'Rhomberg Connect',
  short_name: 'Rhomberg',
  description: 'Rhomberg Connect customer, sales and operations application.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
  orientation: 'any',
  background_color: '#f4f7f8',
  theme_color: '#073b53',
  categories: ['business', 'productivity'],
  launch_handler: { client_mode: ['navigate-existing', 'auto'] },
  icons: [
    { src: 'assets/images/rhomberg-connect-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    { src: 'assets/images/rhomberg-connect-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  ],
};
await fs.writeFile(path.join(output, 'manifest.webmanifest'), `${JSON.stringify(productionManifest, null, 2)}\n`, 'utf8');

const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_FILES = ${JSON.stringify(PRODUCTION_PRECACHE_FILES, null, 2)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    APP_FILES.map(file => new Request(file, { cache: 'reload' }))
  )));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name.startsWith('rhomberg-connect-') && name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.includes('/api/')) return;
  if (requestUrl.pathname.endsWith('/runtime-config.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  const acceptsHtml = event.request.headers.get('accept')?.includes('text/html');
  if (event.request.mode === 'navigate' && acceptsHtml) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('./index.html')));
    return;
  }
  const cacheable = requestUrl.pathname.includes('/assets/')
    || ['script', 'style', 'image', 'font', 'manifest'].includes(event.request.destination);
  if (!cacheable) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (!response.ok) return response;
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
`;
await fs.writeFile(path.join(output, 'sw.js'), serviceWorker, 'utf8');

for (const relative of PRODUCTION_ASSETS) {
  const source = path.join(root, relative);
  const destination = path.join(output, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

const result = await validateProductionArtifact(output);
console.log(`Prepared API-only Windows staging frontend in ${output}`);
console.log(`Validated ${result.filesScanned} files, ${result.assetsApproved} approved assets and ${result.precacheTargets} precache targets.`);
