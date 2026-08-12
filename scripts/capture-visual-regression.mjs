import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  APPROVED_HORIZONTAL_SCROLL_SELECTORS,
  VISUAL_ROUTES,
  VISUAL_WIDTHS,
} from '../src/shared/testing/visualRegression.js';

const baseUrl = String(process.env.VISUAL_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const outputDirectory = path.resolve(process.env.VISUAL_OUTPUT_DIR || 'tmp/visual-regression');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('Visual screenshots skipped: install Playwright in the review environment, then run with VISUAL_BASE_URL pointing to the built application.');
  process.exit(0);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const width of VISUAL_WIDTHS) {
    for (const [name, route] of VISUAL_ROUTES) {
      const page = await browser.newPage({ viewport: { width, height: width <= 412 ? 844 : 1000 }, colorScheme: 'light' });
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3400);
      const audit = await page.evaluate(approvedSelectors => {
        const rootOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll('body *')].filter(element => {
          const rect = element.getBoundingClientRect();
          if (rect.right <= document.documentElement.clientWidth + 1 && rect.left >= -1) return false;
          return !element.closest(approvedSelectors.join(','));
        }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className, text: element.textContent?.trim().slice(0, 60) }));
        return { rootOverflow, offenders };
      }, APPROVED_HORIZONTAL_SCROLL_SELECTORS);
      await page.screenshot({ path: path.join(outputDirectory, `${name}-${width}-light.png`), fullPage: true });
      if (audit.rootOverflow > 1 || audit.offenders.length) failures.push({ name, width, ...audit });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} visual viewport check(s) found page-level horizontal overflow.`);
}

console.log(`Visual regression screenshots and overflow checks passed at ${VISUAL_WIDTHS.join(', ')} px.`);
