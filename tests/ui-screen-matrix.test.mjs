import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { USER_ROLES } from '../src/services/contracts.js';
import {
  PREVIEW_DEFINITIONS,
  previewContextForPath,
  previewNavigationAllowed,
} from '../src/shared/platform/previewConfig.js';
import { navigationItemsForRole, roleProfileFor } from '../src/domain/accessControl.js';

const read = file => readFileSync(path.resolve(file), 'utf8');
const app = read('src/App.jsx');
const css = read('styles.css');

const screenMatrix = {
  'Customer Mobile': {
    'Home': ['src/components/Home.jsx', 'home-screen'],
    'Catalogue': ['src/components/Catalogue.jsx', 'catalogue-screen'],
    'Product Detail': ['src/components/ProductDetail.jsx', 'product-detail'],
    'Product Configuration': ['src/components/Configurator.jsx', 'configurator-screen'],
    'RFQ': ['src/components/Enquiry.jsx', 'enquiry-form'],
    'RFQ Success': ['src/components/Enquiry.jsx', 'SuccessDialog'],
    'Orders': ['src/components/OrderTracking.jsx', 'tracking-screen'],
    'Settings': ['src/components/Settings.jsx', 'settings-screen'],
    'Security': ['src/components/Settings.jsx', "section === 'security'"],
    'Sounds': ['src/components/Settings.jsx', "section === 'sounds'"],
  },
  'Representative Mobile': {
    'RFQ inbox': ['src/components/SalesRepresentativeDashboard.jsx', 'sales-rfq-list'],
    'RFQ detail': ['src/components/SalesRepresentativeDashboard.jsx', 'sales-rfq-detail'],
    'Quote workflow': ['src/components/WorkflowActionPanel.jsx', 'mark_quoted'],
    'Technical Support': ['src/components/TechnicalSupport.jsx', 'technical-support'],
    'Clients': ['src/components/ClientVisitsDashboard.jsx', 'client-visits-screen'],
    'Schedule Visit': ['src/components/ClientVisitsDashboard.jsx', 'Schedule'],
    'Load Order': ['src/components/RepresentativeOrderLoader.jsx', 'representative-order-form'],
    'Settings': ['src/components/Settings.jsx', 'settings-screen'],
  },
  'Expeditor Mobile': {
    'Order': ['src/components/ExpeditorDashboard.jsx', 'expediting-order-detail'],
    'Unit details': ['src/components/ExpeditorDashboard.jsx', '<ConfiguredUnitDetails'],
    'Progress update': ['src/components/WorkflowActionPanel.jsx', 'expeditor-update-actions'],
    'History': ['src/components/ExpeditorDashboard.jsx', 'expediting-update-history'],
    'PDF': ['src/components/ExpeditorDashboard.jsx', '<OrderSummaryPanel'],
  },
  'Internal Desktop': {
    'Planning': ['src/components/PlanningDashboard.jsx', 'planning-screen'],
    'Technical': ['src/components/TechnicalSupport.jsx', 'technical-support'],
    'Dispatch': ['src/components/DispatchDashboard.jsx', 'dispatch-screen'],
    'Management': ['src/components/ManagementDashboard.jsx', 'management-screen'],
    'Owner': ['src/components/ManagementDashboard.jsx', 'Owner and Sales Manager only'],
    'Administrator': ['src/components/AdministratorDashboard.jsx', 'administrator-screen'],
    'Lab': ['src/components/LaboratoryDashboard.jsx', 'lab-control-centre'],
    'QA': ['src/components/QualityDashboard.jsx', 'quality-screen'],
  },
};

for (const [experience, screens] of Object.entries(screenMatrix)) {
  for (const [screen, [file, marker]] of Object.entries(screens)) {
    assert.ok(read(file).includes(marker), `${experience} / ${screen} must retain its tested UI marker: ${marker}`);
  }
}

for (const role of [USER_ROLES.CUSTOMER, USER_ROLES.SALES_REPRESENTATIVE, USER_ROLES.EXPEDITOR]) {
  const allowed = roleProfileFor(role).allowedViews;
  for (const item of navigationItemsForRole(role)) {
    assert.ok(allowed.includes(item.id), `${role} navigation destination ${item.id} must be authorised`);
  }
}

for (const view of ['home', 'catalogue', 'product', 'configurator', 'enquiry', 'tracking', 'settings', 'technical', 'clients', 'load-order', 'administration']) {
  assert.ok(app.includes(`view === '${view}'`), `App must render the ${view} route`);
}

for (const contract of [
  'html,body,#root{max-width:100%;overflow-x:clip}',
  'overflow-wrap:anywhere',
  'white-space:normal',
  'min-height:44px',
  '--sticky-action-bottom:calc(var(--mobile-nav-height) + env(safe-area-inset-bottom,0px) + 8px)',
  '.app-main{padding-bottom:calc(var(--mobile-nav-height)',
]) assert.ok(css.includes(contract), `layout-safety contract missing: ${contract}`);

assert.ok(app.includes("useState('light')"), 'light mode must remain the default');
for (const file of ['src/components/Auth.jsx', 'src/components/Layout.jsx']) {
  assert.ok(read(file).includes("theme === 'dark' ? 'light' : 'dark'"), `${file} must expose manual light/dark switching`);
}

for (const component of ['SalesRepresentativeDashboard.jsx', 'PlanningDashboard.jsx', 'ExpeditorDashboard.jsx', 'LaboratoryDashboard.jsx', 'QualityDashboard.jsx', 'DispatchDashboard.jsx', 'ManagementDashboard.jsx', 'AdministratorDashboard.jsx']) {
  assert.ok(read(`src/components/${component}`).includes('<ConfiguredUnitDetails'), `${component} must expose complete unit details`);
}
assert.ok(read('src/components/PlanningDashboard.jsx').includes('Sales Order Number'));
assert.ok(read('src/components/ManagementDashboard.jsx').includes('Sales Order Number'));
assert.equal(read('src/components/OrderTracking.jsx').includes('Sales Order Number'), false, 'customer UI must not expose the internal Sales Order Number');
for (const file of ['src/components/OrderSummaryPanel.jsx', 'src/components/ManagementDashboard.jsx']) {
  assert.match(read(file), /PDF|pdf/, `${file} must retain PDF export controls`);
}

const normalApplication = previewContextForPath('/Rhomberg-Test-App/app/');
assert.equal(previewNavigationAllowed({ publicPreview: true, preview: normalApplication }), false);
assert.ok(read('app/index.html').includes('<meta name="rhomberg-preview" content="application">'));
for (const preview of PREVIEW_DEFINITIONS) {
  const document = read(`${preview.sourcePath}/index.html`);
  assert.ok(document.includes(`content="${preview.id}"`), `${preview.id} login route must identify its preview context`);
  assert.equal(previewNavigationAllowed({ publicPreview: true, preview }), true, `${preview.id} must remain visibly separated from the normal application`);
}

console.log('Automated customer, representative, Expeditor and internal UI screen matrix passed.');
