import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const review = readFileSync('docs/FINAL_MANUAL_UI_REVIEW.md', 'utf8');
for (const principal of [
  'Customer Mobile', 'Customer Desktop', 'Representative Mobile', 'Expeditor Mobile',
  'Internal Desktop / Planning', 'Laboratory', 'Quality Assurance', 'Dispatch',
  'Technical Support', 'Sales Manager', 'Manager', 'Company Owner', 'Administrator',
  'Preview Centre', 'Normal application',
]) assert.ok(review.includes(`| ${principal} |`), `manual evidence must include ${principal}`);
for (const result of ['Light', 'Dark', 'Page overflow', 'Clipped buttons']) assert.ok(review.includes(result));

const landing = readFileSync('src/apps/PreviewLanding.jsx', 'utf8');
assert.ok(landing.includes('Switch Preview Centre to'));
assert.ok(landing.includes('onToggleTheme'));
const css = readFileSync('styles.css', 'utf8');
assert.ok(css.includes('.preview-landing.is-light'));

console.log('Final manual role, theme and Preview Centre review evidence passed.');
