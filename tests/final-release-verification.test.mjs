import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const verification = readFileSync('docs/FINAL_RELEASE_VERIFICATION.md', 'utf8');
for (const required of [
  'All 62 delivery steps are complete',
  'All 40 test modules pass',
  'All 96 React source files',
  'Shared mock-mode application bundle: passed',
  'Customer Desktop preview: passed',
  'Customer Mobile preview: passed',
  'Representative/Expeditor Mobile preview: passed',
  'Internal Desktop preview: passed',
  'Executive Workflow Demo preview: passed',
  'Staged GitHub Pages artifact: passed',
  'API-only production candidate',
  'Manual role and viewport review',
  'Release boundaries',
]) assert.ok(verification.includes(required), `final release evidence must include: ${required}`);

const readme = readFileSync('README.md', 'utf8');
assert.ok(readme.includes('| 62 | Consolidated release verification and final push | Complete |'));
assert.equal((readme.match(/https:\/\/shellygames141up\.github\.io\/Rhomberg-Test-App/g) || []).length, 2);

console.log('Step 62 consolidated release-verification evidence passed.');
