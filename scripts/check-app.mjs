import fs from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const files = (await fs.readdir(sourceRoot, { recursive: true }))
  .filter(file => /\.(?:jsx?|mjs)$/.test(file))
  .map(file => path.join(sourceRoot, file));
const importPattern = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;

for (const file of files) {
  const source = await fs.readFile(file, 'utf8');
  await transform(source, {
    loader: file.endsWith('.jsx') ? 'jsx' : 'js',
    jsx: 'automatic',
    target: 'es2020',
    sourcefile: path.relative(root, file),
  });
  for (const match of source.matchAll(importPattern)) {
    const target = path.resolve(path.dirname(file), match[1]);
    try {
      await fs.access(target);
    } catch {
      throw new Error(`${path.relative(root, file)} imports missing file ${match[1]}`);
    }
  }
}
console.log(`React source compile and relative-import check passed for ${files.length} files.`);
