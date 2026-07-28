import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { PREVIEW_DEFINITIONS } from '../src/shared/platform/previewConfig.js';

export const root = process.cwd();
export const previewIds = PREVIEW_DEFINITIONS.map(item => item.id);

const assertChildPath = (target, expectedParent, expectedName) => {
  const resolved = path.resolve(target);
  if (path.dirname(resolved) !== path.resolve(expectedParent) || path.basename(resolved) !== expectedName) {
    throw new Error(`Refusing to prepare unexpected output path: ${resolved}`);
  }
  return resolved;
};

export async function buildPublicBundle({ sourcemap = true } = {}) {
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, 'src', 'main.jsx')],
    bundle: true,
    minify: true,
    sourcemap,
    jsx: 'automatic',
    target: ['es2020'],
    define: { __PUBLIC_PREVIEW__: 'true' },
    outfile: path.join(root, 'app.js'),
  });
}

export async function stagePreviewVariant(previewId) {
  if (!previewIds.includes(previewId)) throw new Error(`Unknown preview: ${previewId}`);
  const parent = path.join(root, 'dist-previews');
  const output = assertChildPath(path.join(parent, previewId), parent, previewId);
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });

  const routeIndex = await fs.readFile(path.join(root, 'preview', previewId, 'index.html'), 'utf8');
  await fs.writeFile(path.join(output, 'index.html'), routeIndex.replace('<base href="../../">', '<base href="./">'), 'utf8');
  for (const file of ['app.js', 'app.js.map', 'styles.css', 'runtime-config.js', 'manifest.webmanifest']) {
    await fs.copyFile(path.join(root, file), path.join(output, file));
  }
  const standaloneServiceWorker = (await fs.readFile(path.join(root, 'sw.js'), 'utf8'))
    .replace(/^\s*'\.\/preview\/.*\r?\n/gm, '');
  await fs.writeFile(path.join(output, 'sw.js'), standaloneServiceWorker, 'utf8');
  await fs.cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
  return output;
}

export async function stageGitHubPagesPreview() {
  const output = assertChildPath(path.join(root, 'dist'), root, 'dist');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  for (const file of ['index.html', 'app.js', 'app.js.map', 'styles.css', 'runtime-config.js', 'manifest.webmanifest', 'sw.js']) {
    await fs.copyFile(path.join(root, file), path.join(output, file));
  }
  await fs.cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
  await fs.cp(path.join(root, 'preview'), path.join(output, 'preview'), { recursive: true });
  return output;
}
