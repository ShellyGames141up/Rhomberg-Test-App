import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const bundledPython = path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const candidates = process.platform === 'win32'
  ? [
      ...(existsSync(bundledPython) ? [[bundledPython]] : []),
      ['py', '-3'],
      ['python'],
    ]
  : [['python3'], ['python']];

let lastError = '';
for (const [command, ...prefix] of candidates) {
  const result = spawnSync(command, [...prefix, './scripts/generate-private-credentials.py'], { stdio: 'inherit', shell: false });
  if (!result.error && result.status === 0) process.exit(0);
  if (!result.error) process.exit(result.status || 1);
  lastError = result.error?.message || `exit code ${result.status}`;
}

throw new Error(`A Python 3 runtime with reportlab and pypdf is required to create the encrypted private credential document (${lastError}).`);
