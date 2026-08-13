import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PREVIEW_DEFINITIONS,
  PREVIEW_IDS,
  previewContextForPath,
  previewNavigationAllowed,
} from '../src/shared/platform/previewConfig.js';

const appSource = readFileSync('src/App.jsx', 'utf8');
const desktopDocument = readFileSync('desktop/index.html', 'utf8');
const mobileDocument = readFileSync('mobile/index.html', 'utf8');
const previewCentreDocument = readFileSync('index.html', 'utf8');
const stageScript = readFileSync('scripts/build-tools.mjs', 'utf8');

const introBranch = appSource.indexOf("if (!PREVIEW_CONTEXT.executiveDemo && !introComplete) return <Intro");
const authBranch = appSource.indexOf('if (!account) return <Auth');
assert.ok(introBranch >= 0 && authBranch > introBranch, 'normal customer and staff entries must show splash before sign in');

for (const [route, document, id] of [['/Rhomberg-Test-App/desktop/', desktopDocument, PREVIEW_IDS.APPLICATION_DESKTOP], ['/Rhomberg-Test-App/mobile/', mobileDocument, PREVIEW_IDS.APPLICATION_MOBILE]]) {
  const application = previewContextForPath(route);
  assert.equal(application.id, id);
  assert.equal(application.unified, true);
  assert.equal(previewNavigationAllowed({ publicPreview: true, preview: application }), false, 'normal application users must not be routed through Preview Centre');
  assert.ok(document.includes(`content="${id}"`));
  assert.ok(document.includes('<base href="../">'));
  assert.ok(document.includes('initial-scale=1.0'), 'normal application entry points must start at 100% viewport scale');
}

for (const forbiddenRedirect of [/http-equiv=["']refresh/i, /location\.(?:assign|replace)\s*\(/, /window\.location\s*=/]) {
  assert.doesNotMatch(desktopDocument, forbiddenRedirect, 'normal desktop document must not redirect to Preview Centre');
  assert.doesNotMatch(mobileDocument, forbiddenRedirect, 'normal mobile document must not redirect to Preview Centre');
  assert.doesNotMatch(appSource, forbiddenRedirect, 'application shell must not force users through Preview Centre');
}

assert.ok(previewCentreDocument.includes('content="Rhomberg Connect preview centre'));
assert.equal(previewContextForPath('/Rhomberg-Test-App/').landing, true, 'Preview Centre must remain an explicit root route');
for (const definition of PREVIEW_DEFINITIONS) {
  assert.ok(definition.route.startsWith('/preview/') || definition.route.startsWith('/demo/'), `${definition.id} must have an explicit demonstration route`);
  const routeDocument = readFileSync(`${definition.sourcePath}/index.html`, 'utf8');
  assert.ok(routeDocument.includes(`content="${definition.id}"`));
}

for (const stagedPath of ["path.join(root, 'desktop')", "path.join(root, 'mobile')", "path.join(root, 'app')", "path.join(root, 'preview')", "path.join(root, 'demo')"]) {
  assert.ok(stageScript.includes(stagedPath), `GitHub Pages build must stage ${stagedPath}`);
}

console.log('Splash-to-sign-in application routing and explicit Preview Centre separation passed.');
