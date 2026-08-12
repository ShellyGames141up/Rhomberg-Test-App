import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  contrastRatio,
  foregroundForColour,
  meetsContrast,
  validateThemeColour,
} from '../src/shared/design/contrast.js';
import {
  BREAKPOINTS,
  RESPONSIVE_AUDIT_WIDTHS,
  STATUS_COLOURS,
  TYPOGRAPHY_SCALE,
} from '../src/shared/design/tokens.js';
import {
  CUSTOMER_FONT_SIZES,
  CUSTOMER_THEME_PRESETS,
  DEFAULT_CUSTOM_COLOURS,
  themeColoursFor,
} from '../src/shared/personalisation/personalisation.js';
import {
  EXECUTIVE_DEVICE_PREVIEWS,
  EXECUTIVE_LAYOUT_MODES,
  normaliseExecutiveDemoState,
} from '../src/domain/executiveDemo.js';

assert.equal(contrastRatio('#000000', '#ffffff'), 21);
assert.equal(meetsContrast('#10252f', '#ffffff'), true);

for (const [tone, pair] of Object.entries(STATUS_COLOURS)) {
  assert.ok(
    contrastRatio(pair.background, pair.foreground) >= 4.5,
    `${tone} status text must meet 4.5:1 contrast`,
  );
}

for (const preset of CUSTOMER_THEME_PRESETS.filter(item => item.colours)) {
  for (const [name, colour] of Object.entries(preset.colours)) {
    const foreground = foregroundForColour(colour);
    assert.ok(
      contrastRatio(colour, foreground) >= 4.5,
      `${preset.id} ${name} must provide a readable automatic foreground`,
    );
  }
}

assert.ok(validateThemeColour('accent', '#ffffff'));
assert.equal(
  themeColoursFor({
    themePreset: 'custom',
    customColours: { ...DEFAULT_CUSTOM_COLOURS, accent: '#ffffff' },
  }).accent,
  DEFAULT_CUSTOM_COLOURS.accent,
  'unsupported legacy colour input must resolve to the protected official palette',
);

assert.ok(CUSTOMER_FONT_SIZES.find(item => item.id === 'small').scale >= 0.95);
for (const key of ['body', 'secondary', 'label', 'button', 'input', 'helper', 'status', 'table', 'navigation']) {
  assert.ok(TYPOGRAPHY_SCALE[key], `${key} must exist in the shared typography scale`);
}

assert.deepEqual(Object.values(BREAKPOINTS), [360, 600, 768, 1024, 1280, 1440, 1920, 2560]);
assert.deepEqual(RESPONSIVE_AUDIT_WIDTHS, [320, 360, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440, 1920]);
assert.deepEqual(EXECUTIVE_LAYOUT_MODES, ['full', 'device']);
assert.deepEqual(EXECUTIVE_DEVICE_PREVIEWS, ['phone', 'tablet', 'desktop']);
assert.equal(normaliseExecutiveDemoState({ layoutMode: 'device', devicePreview: 'tablet' }).layoutMode, 'device');
assert.equal(normaliseExecutiveDemoState({ layoutMode: 'unknown', devicePreview: 'watch' }).layoutMode, 'full');
assert.equal(normaliseExecutiveDemoState({ layoutMode: 'unknown', devicePreview: 'watch' }).devicePreview, 'desktop');

const css = readFileSync('styles.css', 'utf8');
for (const token of [
  '--text-primary-light-background',
  '--text-secondary-light-background',
  '--text-muted-light-background',
  '--text-disabled-light-background',
  '--text-primary-dark-background',
  '--text-secondary-dark-background',
  '--text-muted-dark-background',
  '--text-disabled-dark-background',
  '--text-on-action-primary',
  '--text-on-action-secondary',
  '--link-light-background',
  '--link-dark-background',
  '--background-page',
  '--background-surface',
  '--focus-ring',
]) assert.ok(css.includes(token), `${token} must be declared in the semantic CSS contract`);

for (const marker of [
  ':focus-visible',
  '.status-badge--success',
  '.config-stage',
  '.credential-change-actions>*',
  '.preview-internal-desktop .app-shell',
  '.technical-message{background:var(--surface-muted);color:var(--ink)',
  '.technical-message.is-customer-safe{background:var(--status-information-background);color:var(--status-information-foreground)',
  '.technical-rfq-details',
  'max-height:calc(100dvh - 36px)',
  '.executive-layout-full',
  '.executive-layout-device',
  '@media(min-width:1024px)',
  '@media(min-width:1920px)',
  '@media(min-width:2560px)',
  '@media(forced-colors:active)',
  '/* Final responsive foundation */',
  'overflow-wrap:anywhere',
  '/* Mobile navigation safe-area contract */',
  '--mobile-nav-height:76px',
  'env(safe-area-inset-bottom)',
  '/* Product details use surface-safe text colours */',
  ':root:not([data-theme="dark"]) .product-detail',
]) assert.ok(css.includes(marker), `responsive/accessibility CSS must include ${marker}`);

for (const component of [
  'Account.jsx',
  'AdministratorDashboard.jsx',
  'DispatchDashboard.jsx',
  'ExpeditorDashboard.jsx',
  'LaboratoryDashboard.jsx',
  'OperationalDashboard.jsx',
  'OrderTracking.jsx',
  'PlanningDashboard.jsx',
  'QualityDashboard.jsx',
  'SalesRepresentativeDashboard.jsx',
]) {
  const source = readFileSync(`src/components/${component}`, 'utf8');
  assert.ok(source.includes('StatusBadge'), `${component} must use the shared StatusBadge`);
  assert.equal(/tracking-status status-|status-pill is-/.test(source), false);
}

const expeditorSource = readFileSync('src/components/ExpeditorDashboard.jsx', 'utf8');
assert.ok(expeditorSource.includes("from './ConfiguredUnitDetails.jsx'"), 'Expeditor must reuse the immutable configured-unit detail component');
assert.ok(expeditorSource.includes('<ConfiguredUnitDetails'), 'Expeditor must expose complete expandable unit details');
const planningSource = readFileSync('src/components/PlanningDashboard.jsx', 'utf8');
assert.ok(planningSource.includes("from './ConfiguredUnitDetails.jsx'"));
assert.ok(planningSource.includes('<ConfiguredUnitDetails'), 'Planning must expose the complete immutable unit configuration');
assert.equal(expeditorSource.includes("'Handed to Dispatch.'"), false, 'Expeditor must not retain a redundant Dispatch hand-off banner');
assert.ok(expeditorSource.includes("order.trackingStatus !== 'awaiting_dispatch'"), 'Dispatch hand-off status must rely on the workflow status, history and brief global confirmation');
assert.ok(expeditorSource.includes('expediting-history-notes'), 'Expeditor history must use a flat, readable note structure');
assert.ok(expeditorSource.includes('Customer-safe update'));
assert.equal(expeditorSource.includes('expediting-history-marker'), false, 'decorative nested timeline markers must not compete with update content');
const expeditingFieldsSource = readFileSync('src/components/ExpeditingFields.jsx', 'utf8');
for (const fieldGroup of ['expediting-communication-grid', 'expediting-schedule-grid', 'expediting-reference-grid']) assert.ok(expeditingFieldsSource.includes(fieldGroup));
assert.ok(css.includes('.expediting-communication-grid,.expediting-schedule-grid,.expediting-reference-grid{grid-template-columns:1fr}'), 'Expeditor progress fields must stack cleanly on mobile');
assert.ok(css.includes('bottom:calc(var(--mobile-nav-height) + env(safe-area-inset-bottom,0px) + 6px)'), 'Expeditor save action must clear bottom navigation and device safe areas');
const technicalSource = readFileSync('src/components/TechnicalSupport.jsx', 'utf8');
assert.ok(technicalSource.includes('technical-filterbar'));
assert.ok(css.includes('.technical-filterbar label>span{display:block;white-space:nowrap;word-break:normal;writing-mode:horizontal-tb'), 'Technical filter labels must never break vertically');
assert.ok(css.includes('.planning-order-row{grid-template-columns:repeat(2,minmax(0,1fr))}.planning-order-reference,.planning-open-cell{grid-column:1/-1}'), 'Planning must use a readable tablet card/table hybrid');
assert.ok(css.includes('.planning-table{border:0;border-radius:0;background:transparent'), 'Planning must use individual cards on narrow screens');

console.log('Accessibility contrast, semantic tokens, typography, status badges and responsive contracts passed.');
