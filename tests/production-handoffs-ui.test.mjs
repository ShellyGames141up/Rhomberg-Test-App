import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createPhase1WorkspaceService } from '../apps/api/src/services/phase1WorkspaceService.js';

const compiled = await build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ExpeditingFields, expeditingActionDataFor} from './src/components/ExpeditingFields.jsx';
import {QualityDashboard} from './src/components/QualityDashboard.jsx';
import {LaboratoryDashboard} from './src/components/LaboratoryDashboard.jsx';
export const renderExpediting = (record, options, action) => renderToStaticMarkup(React.createElement(ExpeditingFields,{record,options,action,data:expeditingActionDataFor(record,options,action),onChange(){}}));
export const renderQuality = props => renderToStaticMarkup(React.createElement(QualityDashboard,props));
export const renderLab = props => renderToStaticMarkup(React.createElement(LaboratoryDashboard,props));
`,resolveDir:process.cwd()},bundle:true,format:'cjs',jsx:'automatic',platform:'node',write:false});
const module={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {renderExpediting,renderQuality,renderLab}=module.exports;
const options=createPhase1WorkspaceService({repository:{}}).getExpeditingOptions();
const order={id:'fabricated-order',reference:'FABRICATED-HANDOFF',company:'FABRICATED Company',workflowType:'order',trackingStatus:'expediting_in_progress',items:[{id:'line',productId:'pbb',code:'PBB',name:'Fabricated gauge',quantity:1,configuration:{sanas:'Required'}}],expediting:{updates:[{progressStep:'planning_received'}]}};
const progress=renderExpediting(order,options,'add_expediting_update');
for(const label of ['Parts On Floor','Assembly Started','First Standard Calibration','Final Assembly','Final Standard Calibration']) assert.ok(progress.includes(label),label);
const handoff=renderExpediting(order,options,'complete_expediting');
assert.match(handoff,/Quality Control/);
assert.doesNotMatch(handoff,/controlled exception|Moving to Dispatch/);
for(const target of ['Laboratory','Dispatch']){
  const html=renderQuality({account:{role:'quality_assurance'},orders:[{...order,trackingStatus:'qa_passed',allowedWorkflowActions:[{action:'release_qa_order',label:'Send to '+target}]}],serviceMode:'api',onAction(){},focusRecordId:order.id,options:createPhase1WorkspaceService({repository:{}}).getQualityOptions()});
  assert.ok(html.includes('Send to '+target));
}
const labOrder={...order,trackingStatus:'lab_received',laboratory:{receivedAt:'2026-08-28T10:00:00Z',units:[{id:'lab-unit-fabricated-order-1-1',lineItemId:'line',unitNumber:1,certificationType:'sanas',certificateId:'fabricated-certificate'}]}};
const html=renderLab({account:{role:'laboratory_manager',roles:['laboratory_manager'],permissions:['manage_certificates','view_lab_queue']},orders:[labOrder],serviceMode:'api'});
assert.match(html,/FABRICATED-HANDOFF/,'certificate-complete order stays actionable until physical release');
assert.match(html,/Awaiting Dispatch handover/);
console.log('Production progress labels, QC routing and Laboratory handover visibility passed.');
