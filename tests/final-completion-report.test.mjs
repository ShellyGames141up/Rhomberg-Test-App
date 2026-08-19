import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const report = readFileSync('docs/FINAL_COMPLETION_REPORT.md', 'utf8');
for (const required of [
  'UI issues fixed', 'Responsive components changed', 'Overlap bugs fixed', 'Navigation changes',
  'Customer changes', 'Representative changes', 'Client Visit changes', 'Load Order changes',
  'Expeditor changes', 'Planning changes', 'Dispatch changes', 'Management and Executive changes',
  'Laboratory login changes', 'Unit-detail component changes', 'Authentication and login changes',
  'Preview Centre changes', 'README and staff-account documentation', 'Tests added and passed',
  'Build results', 'Screens requiring further human review', 'Remaining production dependencies',
]) assert.ok(report.includes(`## ${required}`), `completion report must include ${required}`);
assert.ok(report.includes('No production deployment or app-store submission'));

const readme = readFileSync('README.md', 'utf8');
assert.ok(readme.includes('All 62 steps are implemented, tested, documented, committed and pushed'));
assert.ok(readme.includes('| 61 | Final report | Complete |'));
assert.ok(readme.includes('| 62 | Consolidated release verification and final push | Complete |'));

console.log('Detailed final completion report coverage passed.');
