import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'dist');
const files = ['index.html', 'app.js', 'app.js.map', 'styles.css', 'sw.js', 'manifest.webmanifest'];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const file of files) await fs.copyFile(path.join(root, file), path.join(output, file));
await fs.cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
console.log(`Staged ${files.length} files and assets in ${output}`);
