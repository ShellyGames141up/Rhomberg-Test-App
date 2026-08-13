import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const requiredDocuments = [
  'README.md',
  'docs/UI_RESPONSIVE_GUIDELINES.md',
  'docs/INTERNAL_USER_ACCOUNT_MATRIX.md',
  'docs/PREVIEW_CENTRE.md',
  'docs/AUTHENTICATION.md',
  'docs/ROLE_PERMISSION_MATRIX.md',
  'docs/UNIT_DETAIL_ACCESS.md',
  'docs/PLANNING_WORKFLOW.md',
  'docs/DISPATCH_WORKFLOW.md',
  'docs/REPRESENTATIVE_WORKFLOW.md',
  'docs/EXECUTIVE_DASHBOARD.md',
];
for (const file of requiredDocuments) {
  assert.ok(existsSync(file), `${file} must exist`);
  assert.ok(readFileSync(file, 'utf8').trim().length > 200, `${file} must contain substantive guidance`);
}

const readme = readFileSync('README.md', 'utf8');
for (let step = 1; step <= 62; step += 1) {
  assert.match(readme, new RegExp(`\\| ${step} \\|`), `README delivery ledger must include Step ${step}`);
}
assert.equal((readme.match(/https:\/\/shellygames141up\.github\.io\/Rhomberg-Test-App/g) || []).length, 3, 'README must contain only the Desktop, Mobile and Preview Centre deployment links');
assert.ok(readme.includes('Steps 1–61 are implemented and committed individually'));

console.log('Required documentation and README Steps 1–62 delivery ledger passed.');
