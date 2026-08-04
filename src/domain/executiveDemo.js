import { USER_ROLES } from '../services/contracts.js';

export const EXECUTIVE_LAYOUT_MODES = Object.freeze(['full', 'device']);
export const EXECUTIVE_DEVICE_PREVIEWS = Object.freeze(['phone', 'tablet', 'desktop']);

export const EXECUTIVE_DEMO_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'standard-order',
    label: 'Standard order journey',
    summary: 'RFQ, quotation, accepted order, Planning, Expediting, QA and Dispatch.',
    steps: Object.freeze([
      'Customer submits a configured RFQ',
      'Sales representative starts review',
      'Representative records the external quotation',
      'Customer acknowledges the quotation',
      'Representative records acceptance and creates the order',
      'Planning records the job and customer PO references',
      'Expediting records production progress',
      'Quality Assurance releases the order',
      'Dispatch completes customer handover',
      'Management reviews the completed audit trail',
    ]),
  }),
  Object.freeze({
    id: 'sanas-calibration',
    label: 'Cape Town Pressure Laboratory',
    summary: 'Fabricated Pressure units follow controlled receipt, calculation, review and certificate release.',
    steps: Object.freeze([
      'Customer requests SANAS calibration on pressure instruments',
      'Sales representative confirms quotation handling',
      'Planning routes the accepted order to the Laboratory',
      'Cape Town Laboratory receives and stabilises each physical unit',
      'A Pressure technician inspects, books in and selects the method and valid standard',
      'Structured readings create a locked worksheet and versioned calculation',
      'Laboratory Management records the required formula review',
      'The technician labels and transfers the physical unit to Dispatch',
      'Management creates, reviews and externally signs one certificate per unit',
      'The signed PDF is hashed and explicitly released to authorised recipients',
    ]),
  }),
  Object.freeze({
    id: 'traceable-calibration',
    label: 'Cape Town Temperature Laboratory',
    summary: 'Temperature instruments follow the controlled Traceable laboratory route.',
    steps: Object.freeze([
      'Customer configures Traceable temperature instruments',
      'Representative reviews and records the quotation',
      'Planning records production references',
      'A Temperature technician records structured repeat observations',
      'The calculation flags the legacy reading-count discrepancy for management review',
      'Traceable certificate versions are generated and registered',
      'Laboratory releases the completed order',
      'Customer and representative receive the safe update',
    ]),
  }),
  Object.freeze({
    id: 'johannesburg-pressure-laboratory',
    label: 'Johannesburg Pressure Laboratory',
    summary: 'Branch isolation keeps Johannesburg jobs, technicians and standards within authorised scope.',
    steps: Object.freeze([
      'Planning routes a fabricated Pressure unit to Johannesburg',
      'Only an authorised Johannesburg technician can receive and book it in',
      'The service rejects Cape Town reference standards and assignments',
      'Structured raw readings and calculations create immutable versions',
      'Laboratory Management reviews warnings without editing raw data',
      'The unit and released certificate continue to Dispatch with a complete audit trail',
    ]),
  }),
  Object.freeze({
    id: 'qa-rework',
    label: 'QA failure and rework',
    summary: 'A quality finding is isolated, corrected, reinspected and released.',
    steps: Object.freeze([
      'Expediting submits completed production to Quality Assurance',
      'QA records a controlled failure',
      'Internal rework details remain hidden from the customer',
      'Expediting completes corrective work',
      'QA reinspects the order',
      'QA releases the order to Dispatch',
      'Management reviews the immutable history',
    ]),
  }),
  Object.freeze({
    id: 'quotation-amendment',
    label: 'Rejected or amended quotation',
    summary: 'A representative follows up without treating acknowledgement as acceptance.',
    steps: Object.freeze([
      'Customer submits an RFQ',
      'Representative records quotation details',
      'Customer acknowledges receipt only',
      'Customer requests an amendment outside the app',
      'Representative records the controlled follow-up',
      'No order is created until acceptance is recorded',
    ]),
  }),
  Object.freeze({
    id: 'management-overview',
    label: 'Management dashboard',
    summary: 'Company-wide operational measures, exceptions, reports and audit controls.',
    steps: Object.freeze([
      'Open executive workflow measures',
      'Review representative and department workload',
      'Inspect Laboratory and QA performance',
      'Review notification and document activity',
      'Open the immutable audit history',
    ]),
  }),
  Object.freeze({
    id: 'department-tour',
    label: 'Department dashboard tour',
    summary: 'Switch safely between each fabricated internal role and its authorised queue.',
    steps: Object.freeze([
      'Open the Sales representative inbox',
      'Open the Planning desktop queue',
      'Open the Laboratory desktop queue',
      'Open the Expediting workspace',
      'Open the Quality Assurance queue',
      'Open the Dispatch workspace',
      'Open Administration controls',
    ]),
  }),
]);

export const EXECUTIVE_DEMO_ROLES = Object.freeze([
  Object.freeze({ role: USER_ROLES.CUSTOMER, label: 'Customer', stage: 'RFQ and tracking', device: 'Rhomberg Connect' }),
  Object.freeze({ role: USER_ROLES.SALES_REPRESENTATIVE, label: 'Sales representative', stage: 'Quotation review', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.SALES_MANAGER, label: 'Sales manager', stage: 'Sales analytics', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.COMPANY_OWNER, label: 'Company owner', stage: 'Executive oversight', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.PLANNING, label: 'Planning', stage: 'Job planning', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.LABORATORY_USER, label: 'Laboratory user', stage: 'Calibration', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.LABORATORY_TECHNICIAN, label: 'Laboratory technician', stage: 'Raw data and unit work', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.LABORATORY_MANAGER, label: 'Laboratory manager', stage: 'Laboratory release', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.TECHNICAL_SIGNATORY, label: 'Technical signatory', stage: 'Certificate approval', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.LABORATORY_ADMINISTRATOR, label: 'Laboratory administrator', stage: 'Controlled Laboratory configuration', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.EXPEDITOR, label: 'Expeditor', stage: 'Production progress', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.QUALITY_ASSURANCE, label: 'Quality Assurance', stage: 'Inspection', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.DISPATCH, label: 'Dispatch', stage: 'Customer handover', device: 'Operations' }),
  Object.freeze({ role: USER_ROLES.ADMINISTRATOR, label: 'Administrator', stage: 'System control', device: 'Operations' }),
]);

export const DEFAULT_EXECUTIVE_DEMO_STATE = Object.freeze({
  scenarioId: EXECUTIVE_DEMO_SCENARIOS[0].id,
  stepIndex: 0,
  presentationMode: false,
  layoutMode: 'full',
  devicePreview: 'desktop',
  startedAt: '',
  updatedAt: '',
});

export const executiveScenarioById = scenarioId => (
  EXECUTIVE_DEMO_SCENARIOS.find(scenario => scenario.id === scenarioId)
  || EXECUTIVE_DEMO_SCENARIOS[0]
);

export const normaliseExecutiveDemoState = candidate => {
  const scenario = executiveScenarioById(candidate?.scenarioId);
  const maximum = Math.max(0, scenario.steps.length - 1);
  return {
    ...DEFAULT_EXECUTIVE_DEMO_STATE,
    ...candidate,
    scenarioId: scenario.id,
    stepIndex: Math.min(maximum, Math.max(0, Math.trunc(Number(candidate?.stepIndex) || 0))),
    presentationMode: candidate?.presentationMode === true,
    layoutMode: EXECUTIVE_LAYOUT_MODES.includes(candidate?.layoutMode) ? candidate.layoutMode : DEFAULT_EXECUTIVE_DEMO_STATE.layoutMode,
    devicePreview: EXECUTIVE_DEVICE_PREVIEWS.includes(candidate?.devicePreview) ? candidate.devicePreview : DEFAULT_EXECUTIVE_DEMO_STATE.devicePreview,
  };
};

export const executiveDemoProgress = state => {
  const safeState = normaliseExecutiveDemoState(state);
  const scenario = executiveScenarioById(safeState.scenarioId);
  return {
    state: safeState,
    scenario,
    currentStep: scenario.steps[safeState.stepIndex],
    nextStep: scenario.steps[safeState.stepIndex + 1] || 'Scenario complete',
    progressPercent: Math.round(((safeState.stepIndex + 1) / scenario.steps.length) * 100),
  };
};
