import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  filterDemoLoginsForPreview,
  PREVIEW_BY_ID,
  PREVIEW_DEFINITIONS,
  PREVIEW_IDS,
  previewAllowsRole,
  previewContextForPath,
  previewIdFromPath,
} from '../src/shared/platform/previewConfig.js';
import {
  createDefaultCustomerPersonalisation,
  customerPersonalisationCss,
  foregroundForColour,
  normaliseCustomerPersonalisation,
  validateCustomerImage,
  validateCustomerPersonalisation,
} from '../src/shared/personalisation/personalisation.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { DEMO_ACCOUNT, EXPEDITOR_ACCOUNT, STORE_KEYS } from '../src/services/mock/seedData.js';
import { ServiceError, USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

assert.equal(PREVIEW_DEFINITIONS.length, 5);
assert.deepEqual(PREVIEW_DEFINITIONS.map(item => item.displayName), [
  'Rhomberg Connect — Customer Desktop',
  'Rhomberg Connect — Customer Mobile',
  'Rhomberg Operations — Rep & Expeditor Mobile',
  'Rhomberg Operations — Internal Desktop',
  'Rhomberg Platform — Executive Workflow Demo',
]);
for (const definition of PREVIEW_DEFINITIONS) {
  assert.equal(previewIdFromPath(`/Rhomberg-Test-App${definition.route}`), definition.id);
  assert.equal(previewIdFromPath(`/Rhomberg-Test-App${definition.route}index.html`), definition.id);
  assert.equal(previewContextForPath(definition.route).displayName, definition.displayName);
  const page = readFileSync(path.resolve(definition.sourcePath, 'index.html'), 'utf8');
  assert.match(page, new RegExp(`<meta name="rhomberg-preview" content="${definition.id}">`));
  assert.ok(page.includes('<base href="../../">'), `${definition.id} must preserve the GitHub Pages base path`);
  assert.ok(page.includes('app.js?v=40'), `${definition.id} must request the current application bundle`);
}
const rootPage = readFileSync(path.resolve('index.html'), 'utf8');
const serviceWorker = readFileSync(path.resolve('sw.js'), 'utf8');
assert.ok(rootPage.includes('app.js?v=40'), 'Preview Centre must request the current application bundle');
assert.ok(serviceWorker.includes("'./app.js?v=40'"), 'service worker must cache the same application bundle version');
const readme = readFileSync(path.resolve('README.md'), 'utf8');
for (const definition of PREVIEW_DEFINITIONS) {
  assert.ok(readme.includes(`https://shellygames141up.github.io/Rhomberg-Test-App${definition.route}`), `README must launch ${definition.id}`);
}
const packageScripts = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')).scripts;
for (const previewId of ['customer-desktop', 'customer-mobile', 'internal-mobile', 'internal-desktop', 'executive-demo']) {
  assert.ok(packageScripts[`dev:${previewId}`], `development command missing for ${previewId}`);
  assert.ok(packageScripts[`build:${previewId}`], `build command missing for ${previewId}`);
}
assert.ok(packageScripts['build:previews']);
const manifest = JSON.parse(readFileSync(path.resolve('manifest.webmanifest'), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.display_override.includes('standalone'));
assert.equal(manifest.start_url, './');
assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === './preview/customer-mobile/'));
assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === './preview/internal-desktop/'));
const capacitorConfig = JSON.parse(readFileSync(path.resolve('capacitor.config.json'), 'utf8'));
assert.equal(capacitorConfig.webDir, 'dist-production');
assert.match(capacitorConfig.appId, /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/);
const deliveryStrategy = readFileSync(path.resolve('docs', 'DELIVERY_STRATEGY.md'), 'utf8');
for (const requirement of ['Capacitor', 'Offline', 'APNs/FCM', 'Windows', 'signing', 'GitHub Pages']) {
  assert.ok(deliveryStrategy.toLowerCase().includes(requirement.toLowerCase()), `delivery strategy must document ${requirement}`);
}
assert.equal(previewIdFromPath('/preview/unsupported-interface/'), 'unsupported');
assert.equal(previewContextForPath('/preview/unsupported-interface/').unsupported, true);
assert.equal(previewContextForPath('/Rhomberg-Test-App/').landing, true);

const customerDesktop = PREVIEW_BY_ID[PREVIEW_IDS.CUSTOMER_DESKTOP];
const customerMobile = PREVIEW_BY_ID[PREVIEW_IDS.CUSTOMER_MOBILE];
const internalMobile = PREVIEW_BY_ID[PREVIEW_IDS.INTERNAL_MOBILE];
const internalDesktop = PREVIEW_BY_ID[PREVIEW_IDS.INTERNAL_DESKTOP];
const executiveDemo = PREVIEW_BY_ID[PREVIEW_IDS.EXECUTIVE_DEMO];
assert.ok(previewAllowsRole(customerDesktop, USER_ROLES.CUSTOMER));
assert.ok(previewAllowsRole(customerMobile, USER_ROLES.CUSTOMER));
assert.equal(previewAllowsRole(customerMobile, USER_ROLES.SALES_REPRESENTATIVE), false);
for (const role of [USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.MANAGER, USER_ROLES.EXPEDITOR]) {
  assert.ok(previewAllowsRole(internalMobile, role));
}
for (const role of [USER_ROLES.PLANNING, USER_ROLES.DISPATCH, USER_ROLES.BUYER, USER_ROLES.ADMINISTRATOR, USER_ROLES.CUSTOMER]) {
  assert.equal(previewAllowsRole(internalMobile, role), false);
}
for (const role of [USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.TECHNICAL_SUPPORT, USER_ROLES.TECHNICAL_DIRECTOR, USER_ROLES.MANAGER, USER_ROLES.EXPEDITOR, USER_ROLES.PLANNING, USER_ROLES.DISPATCH, USER_ROLES.BUYER, USER_ROLES.ADMINISTRATOR]) {
  assert.ok(previewAllowsRole(internalDesktop, role));
}
assert.equal(previewAllowsRole(internalDesktop, USER_ROLES.CUSTOMER), false);
for (const role of Object.values(USER_ROLES)) assert.ok(previewAllowsRole(executiveDemo, role));
assert.equal(previewIdFromPath('/Rhomberg-Test-App/demo/executive-workflow/'), PREVIEW_IDS.EXECUTIVE_DEMO);

const storage = new TestStorage();
const services = createMockServices({ storage, now: () => new Date('2026-07-27T09:00:00.000Z') });
await services.initialize();
const demoLogins = await services.auth.getDemoLogins();
assert.ok(filterDemoLoginsForPreview(demoLogins, customerMobile).every(login => login.role === USER_ROLES.CUSTOMER));
assert.deepEqual(
  new Set(filterDemoLoginsForPreview(demoLogins, internalMobile).map(login => login.role)),
  new Set([USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.MANAGER, USER_ROLES.EXPEDITOR]),
);
assert.equal(filterDemoLoginsForPreview(demoLogins, internalDesktop).some(login => login.role === USER_ROLES.CUSTOMER), false);
assert.ok(filterDemoLoginsForPreview(demoLogins, internalDesktop).some(login => login.role === USER_ROLES.TECHNICAL_SUPPORT && login.label === 'Use Technical Advisor login'));
assert.equal(filterDemoLoginsForPreview(demoLogins, internalDesktop).some(login => login.role === 'technical_manager'), false);

await services.auth.signIn({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
const initial = await services.personalisation.get();
assert.equal(initial.setupCompleted, false, 'customer-only onboarding must open until a complete preference set is saved');

const completeSettings = {
  ...createDefaultCustomerPersonalisation(),
  setupCompleted: true,
  themePreset: 'modern',
  fontSize: 'extra-large',
  density: 'comfortable',
  appearanceMode: 'dark',
  notificationPreferences: {
    ...createDefaultCustomerPersonalisation().notificationPreferences,
    companyAnnouncements: false,
  },
};
const saved = await services.personalisation.complete(completeSettings);
assert.equal(saved.setupCompleted, true);
assert.equal(saved.themePreset, 'modern');
assert.equal(saved.fontSize, 'extra-large');
assert.equal(saved.density, 'comfortable');
assert.equal(saved.appearanceMode, 'dark');
assert.equal(saved.notificationPreferences.companyAnnouncements, false);

const reopened = createMockServices({ storage, now: () => new Date('2026-07-27T09:05:00.000Z') });
await reopened.initialize();
assert.equal((await reopened.personalisation.get()).themePreset, 'modern', 'theme must survive mock-service reinitialisation');
assert.equal((await reopened.personalisation.get()).fontSize, 'extra-large', 'font size must persist');
assert.equal((await reopened.personalisation.get()).density, 'comfortable', 'display density must persist');
assert.equal((await reopened.personalisation.get()).appearanceMode, 'dark', 'appearance mode must persist');
assert.equal((await reopened.personalisation.get()).notificationPreferences.companyAnnouncements, false, 'notification preferences must persist');

const css = customerPersonalisationCss(saved);
assert.equal(css['--customer-font-scale'], '1.25');
assert.equal(css['--customer-density-scale'], '1.14');
assert.match(css['--customer-primary'], /^#[0-9a-f]{6}$/i);
assert.ok(['#ffffff', '#10252f'].includes(foregroundForColour('#777777')));

const invalidContrast = normaliseCustomerPersonalisation({
  ...completeSettings,
  themePreset: 'custom',
  customColours: {
    primary: '#777777',
    secondary: '#777777',
    accent: '#777777',
    success: '#777777',
    warning: '#777777',
  },
});
assert.ok(Object.keys(validateCustomerPersonalisation(invalidContrast)).some(key => key.startsWith('customColours.')), 'unsafe custom colours must be rejected');
const invalidCriticalPreference = normaliseCustomerPersonalisation({
  ...completeSettings,
  notificationPreferences: { ...completeSettings.notificationPreferences, accountSecurity: false },
});
assert.ok(validateCustomerPersonalisation(invalidCriticalPreference)['notificationPreferences.accountSecurity']);

assert.equal(validateCustomerImage({ type: 'image/svg+xml', size: 200 }), 'Choose a JPG, PNG or WebP image.');
assert.equal(validateCustomerImage({ type: 'image/png', size: 2 * 1024 * 1024 }), 'The image must be 1 MB or smaller.');
const testImage = new File([new Uint8Array([1, 2, 3, 4])], 'company-logo.png', { type: 'image/png' });
const uploaded = await reopened.personalisation.uploadImage(testImage, 'companyLogo', { x: 42, y: 58 });
assert.match(uploaded.previewUrl, /^data:image\/png;base64,/);
await reopened.personalisation.save({ ...(await reopened.personalisation.get()), companyLogo: uploaded });
assert.equal((await reopened.personalisation.get()).companyLogo.position.x, 42);
await reopened.personalisation.save({ ...(await reopened.personalisation.get()), companyLogo: null });
await assert.rejects(
  () => reopened.personalisation.removeImage(uploaded.id),
  error => error instanceof ServiceError && error.status === 404,
  'saving a removed image must clean the account-owned mock image without changing settings before Save',
);

await reopened.auth.signOut();
await reopened.auth.signIn({ email: EXPEDITOR_ACCOUNT.email, password: EXPEDITOR_ACCOUNT.password });
await assert.rejects(
  () => reopened.personalisation.get(),
  error => error instanceof ServiceError && error.status === 403,
  'internal accounts must not access customer personalisation',
);

await reopened.auth.signOut();
await reopened.auth.signIn({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
await reopened.personalisation.reset({ reopenSetup: true });
const reset = await reopened.personalisation.get();
assert.equal(reset.setupCompleted, false);
assert.equal(reset.themePreset, 'rhomberg-default');
assert.equal(reset.fontSize, 'medium');
assert.equal(reset.density, 'standard');
assert.equal(reset.appearanceMode, 'system');

const personalisationRecords = JSON.parse(storage.getItem(STORE_KEYS.personalisation));
assert.deepEqual(Object.keys(personalisationRecords), [DEMO_ACCOUNT.id], 'preferences must remain isolated by authorised account');

const uiFiles = [
  path.resolve('src', 'App.jsx'),
  ...['components', 'apps'].flatMap(folder => readdirSync(path.resolve('src', folder), { recursive: true })
    .filter(file => file.endsWith('.jsx'))
    .map(file => path.resolve('src', folder, file))),
];
for (const file of uiFiles) {
  const source = readFileSync(file, 'utf8');
  assert.equal(source.includes('localStorage'), false, `${path.basename(file)} must use the service layer instead of browser storage`);
}

const stylesheet = readFileSync(path.resolve('styles.css'), 'utf8');
for (const marker of ['env(safe-area-inset-bottom)', '@media(orientation:landscape)', 'min-height:44px', '--customer-font-scale', '--customer-density-scale']) {
  assert.ok(stylesheet.includes(marker), `responsive styling must include ${marker}`);
}
const productionScript = readFileSync(path.resolve('scripts', 'build-production.mjs'), 'utf8');
for (const marker of ['Demo123', 'Sales123', 'Planning123', 'Dispatch123', 'Buyer123', 'Manager123', 'Admin123', 'Demo Preview', 'DEMO PREVIEW', 'View Demo Login', 'customer.demo@example.invalid', 'sales.workflow@example.invalid', 'administrator.workflow@example.invalid', 'preview-landing']) {
  assert.ok(productionScript.includes(`'${marker}'`), `production safety scan must reject ${marker}`);
}
const buildToolsSource = readFileSync(path.resolve('scripts', 'build-tools.mjs'), 'utf8');
assert.ok(buildToolsSource.includes(".replace(/^\\s*'\\.\\/(?:preview|demo)\\/.*\\r?\\n/gm, '')"), 'standalone previews must remove unavailable multi-route entries from their service-worker cache list');

console.log('Preview routing, branding, role separation, personalisation persistence, validation and responsive guard tests passed.');
