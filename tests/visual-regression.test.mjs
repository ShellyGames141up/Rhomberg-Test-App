import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APPROVED_HORIZONTAL_SCROLL_SELECTORS,
  VISUAL_ROUTES,
  VISUAL_WIDTHS,
} from '../src/shared/testing/visualRegression.js';

assert.deepEqual(VISUAL_WIDTHS, [360, 390, 412, 768, 1024, 1366, 1920]);
assert.deepEqual(VISUAL_ROUTES.map(([, route]) => route), [
  '/app/',
  '/preview/customer-mobile/',
  '/preview/internal-mobile/',
  '/preview/internal-desktop/',
]);
for (const selector of ['.planning-table', '.dispatch-table', '.lab-register-table', '.compliance-table']) {
  assert.ok(APPROVED_HORIZONTAL_SCROLL_SELECTORS.includes(selector), `${selector} must be an explicitly approved scroll region`);
}

const runner = readFileSync('scripts/capture-visual-regression.mjs', 'utf8');
assert.ok(runner.includes('document.documentElement.scrollWidth - document.documentElement.clientWidth'));
assert.ok(runner.includes('fullPage: true'));
assert.ok(runner.includes("colorScheme: 'light'"));
assert.ok(runner.includes("await import('playwright')"), 'screenshots must run through Playwright where supported');

const css = readFileSync('styles.css', 'utf8');
assert.ok(css.includes('html,body,#root{max-width:100%;overflow-x:clip}'), 'page-level overflow must remain prohibited');
assert.ok(css.includes('overflow-x:auto;overscroll-behavior-inline:contain'), 'approved data regions must provide contained horizontal scrolling');

console.log('Visual regression widths, routes, screenshots and overflow guard contracts passed.');
