import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { context } from 'esbuild';
import { previewIds, root } from './build-tools.mjs';

const previewId = process.argv[2];
if (!previewIds.includes(previewId)) throw new Error(`Choose one preview: ${previewIds.join(', ')}`);
const port = Math.max(1024, Number(process.env.RHOMBERG_PREVIEW_PORT) || 4173);
const buildContext = await context({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'src', 'main.jsx')],
  bundle: true,
  sourcemap: true,
  jsx: 'automatic',
  target: ['es2020'],
  define: { __PUBLIC_PREVIEW__: 'true' },
  outfile: path.join(root, 'app.js'),
});
await buildContext.watch();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const allowedRootFiles = new Set(['index.html', 'app.js', 'app.js.map', 'styles.css', 'runtime-config.js', 'manifest.webmanifest', 'sw.js']);

const server = http.createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    let relative = requestPath.replace(/^\/+/, '');
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const permitted = allowedRootFiles.has(relative) || relative.startsWith('assets/') || relative.startsWith('preview/');
    if (!permitted) {
      response.writeHead(404).end('Not found');
      return;
    }
    const resolved = path.resolve(root, relative);
    if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await fs.readFile(resolved);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(resolved)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Rhomberg preview server: http://127.0.0.1:${port}/preview/${previewId}/`);
});

const close = async () => {
  server.close();
  await buildContext.dispose();
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
