import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createPhase1WorkspaceService } from '../apps/api/src/services/phase1WorkspaceService.js';

// Compile the real React component and renderer together (one React instance).
const compiled = await build({ stdin: { contents: `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { QualityDashboard } from './src/components/QualityDashboard.jsx';
  export const render = props => renderToStaticMarkup(React.createElement(QualityDashboard, props));
`, resolveDir: process.cwd() }, bundle: true, format: 'cjs', jsx: 'automatic', platform: 'node', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { render } = module.exports;
const options = createPhase1WorkspaceService({ repository: {} }).getQualityOptions();
for (const role of ['quality_assurance', 'quality_manager']) {
  const html = render({ account: { role, contact: 'Fabricated QA' }, orders: [{ id: 'order1', reference: 'FABRICATED-QA-1', company: 'Fabricated Company', trackingStatus: 'qa_in_progress', items: [{ id: 'line1', name: 'Fabricated Gauge', quantity: 1 }], allowedWorkflowActions: [{ action: 'fail_qa' }] }], onAction() {}, serviceMode: 'api', options, focusRecordId: 'order1' });
  for (const entries of Object.values(options)) for (const choice of entries) assert.ok(html.includes(`value="${choice.id}">${choice.label}</option>`), `${role}: missing labelled ${choice.id}`);
  assert.doesNotMatch(html, /<option[^>]*><\/option>/);
  assert.match(html, /value="line1"/);
}
console.log('API-supplied QA and QA Manager dropdowns render real selectable labels and affected items.');
