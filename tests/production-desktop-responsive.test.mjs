import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.jsx', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const productionConfig = readFileSync('src/shared/platform/productionPlatformConfig.js', 'utf8');

assert.ok(
  app.includes("!__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.desktop ? 'production-desktop-surface' : ''"),
  'the real private-cloud desktop surface must receive a production-specific responsive class',
);
assert.ok(
  app.includes("!__PUBLIC_PREVIEW__ && PREVIEW_CONTEXT.mobile ? 'production-mobile-surface' : ''"),
  'the real mobile surface must remain explicitly distinguishable from desktop',
);
assert.ok(productionConfig.includes('desktop: surface === APPLICATION_SURFACES.DESKTOP'));
assert.ok(productionConfig.includes('mobile: surface === APPLICATION_SURFACES.MOBILE'));

const desktopBlockStart = css.indexOf('/* Real private-cloud desktop surface. Preview selectors above remain isolated to demo builds. */');
assert.ok(desktopBlockStart >= 0, 'production desktop CSS contract must be present');
const desktopCss = css.slice(desktopBlockStart);

for (const requiredRule of [
  '@media(min-width:1024px)',
  '.production-desktop-surface .app-shell',
  'width:min(100%,1920px)!important',
  'grid-template-columns:clamp(210px,17vw,260px) minmax(0,1fr)',
  '.production-desktop-surface .bottom-nav',
  'position:sticky!important',
  'flex-direction:column',
  '.production-desktop-surface .app-main',
  '.production-desktop-surface .administrator-tabs',
  'flex-wrap:wrap',
]) assert.ok(desktopCss.includes(requiredRule), `production desktop CSS must include ${requiredRule}`);

assert.equal(
  /\.production-desktop-surface\s+\.app-shell\s*\{[^}]*540px/s.test(desktopCss),
  false,
  'the production desktop shell must never inherit the mobile 540px cap',
);
assert.equal(
  /\.production-mobile-surface[^}]*min-width:\s*1024px/s.test(css),
  false,
  'the mobile surface must not be promoted to the desktop layout',
);

for (const viewport of [1024, 1280, 1366, 1440, 1920]) {
  assert.ok(viewport >= 1024, `${viewport}px must use the production desktop breakpoint`);
}
for (const viewport of [360, 390, 600, 768]) {
  assert.ok(viewport < 1024, `${viewport}px must preserve the existing mobile/tablet shell`);
}

console.log('Production desktop shell and navigation responsive contract passed.');
