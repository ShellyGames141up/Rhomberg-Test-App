import fs from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await fs.readFile('styles.css', 'utf8');
await transform(source, { loader: 'css', minify: true, sourcefile: 'styles.css' });
console.log('Stylesheet syntax check passed.');
