import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const output = path.resolve(root, 'dist-production');
const expectedOutput = path.resolve(root, 'dist-production');
if (output !== expectedOutput || path.dirname(output) !== root) throw new Error('Refusing to prepare an unexpected production output path.');

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true,
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  target: ['es2020'],
  plugins: [{
    name: 'select-private-cloud-services',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/services\/index\.js$/ }, () => ({
        path: path.join(root, 'src/services/apiEntry.js'),
      }));
    },
  }],
  outfile: path.join(output, 'app.js'),
});

const apiBundle = await fs.readFile(path.join(output, 'app.js'), 'utf8');
const forbiddenMockMarkers = [
  'Demo123',
  'Expedite123',
  'formsubmit.co',
  'RQ-TEST',
  'company-demo-mining',
  'rhombergPreviewAccounts',
  'Ericuv@Rhom.co.za',
];
const leakedMarker = forbiddenMockMarkers.find(marker => apiBundle.toLowerCase().includes(marker.toLowerCase()));
if (leakedMarker) throw new Error(`Production build contains mock-only marker: ${leakedMarker}`);
if ((await fs.readdir(output)).some(file => file.endsWith('.map'))) throw new Error('Production source maps must not be placed in the public artifact.');

for (const file of ['styles.css', 'runtime-config.js']) {
  await fs.copyFile(path.join(root, file), path.join(output, file));
}
const productionServiceWorker = (await fs.readFile(path.join(root, 'sw.js'), 'utf8'))
  .replace('rhomberg-app-preview-v8', 'rhomberg-app-production-v8');
await fs.writeFile(path.join(output, 'sw.js'), productionServiceWorker, 'utf8');
const productionIndex = (await fs.readFile(path.join(root, 'index.html'), 'utf8'))
  .replace('Public test preview of the Rhomberg Instruments mobile product catalogue and quote-request app.', 'Rhomberg Instruments private-cloud product catalogue, RFQ and order-tracking application.')
  .replace('Rhomberg Instruments App | Test Preview', 'Rhomberg Instruments Private Cloud App');
await fs.writeFile(path.join(output, 'index.html'), productionIndex, 'utf8');

const productionManifest = (await fs.readFile(path.join(root, 'manifest.webmanifest'), 'utf8'))
  .replace('A mobile catalogue, RFQ and order-tracking preview for Rhomberg Instruments.', 'Rhomberg Instruments private-cloud catalogue, RFQ and order-tracking application.');
await fs.writeFile(path.join(output, 'manifest.webmanifest'), productionManifest, 'utf8');
await fs.cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });

console.log(`Prepared and scanned API-only production candidate in ${output}`);
