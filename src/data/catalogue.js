const image = name => `assets/images/${name}`;
const productImage = name => `products/${name}.webp`;
const datasheet = name => `assets/datasheets/${name}`;

export const categories = [
  { id: 'pressure', number: '01', name: 'Pressure', short: 'Pressure instruments', icon: 'P', image: image(productImage('pbg')), description: 'Mechanical gauges, digital gauges and transmitters for pressure, vacuum and differential pressure.' },
  { id: 'temperature', number: '02', name: 'Temperature', short: 'Temperature instruments', icon: 'T', image: image(productImage('tps')), description: 'Dial thermometers, digital instruments, transmitters, sensors and protective thermowells.' },
  { id: 'flow', number: '03', name: 'Flow', short: 'Flow instruments', icon: 'F', image: image('switches.png'), description: 'Electronic flow monitoring and switching for liquid and air applications.' },
  { id: 'level', number: '04', name: 'Level', short: 'Level instruments', icon: 'L', image: image(productImage('rpt200-level')), description: 'Submersible, radar, guided-wave and switching solutions for liquids and bulk solids.' },
  { id: 'switches', number: '05', name: 'Switches', short: 'Industrial switches', icon: 'S', image: image(productImage('switch-family')), description: 'Pressure, temperature, flow and level switches for control and alarm duties.' },
  { id: 'protection', number: '06', name: 'Process Protection', short: 'Chemical seal support', icon: 'D', image: image(productImage('seal-family')), description: 'Chemical and diaphragm seal information with application review by a Rhomberg representative.' },
  { id: 'analysis', number: '07', name: 'Gas Analysis', short: 'Gas analysers', icon: 'G', image: image(productImage('analysis-family')), description: 'Oxygen, moisture and specialist gas-analysis instruments for continuous monitoring.' },
  { id: 'calibration', number: '08', name: 'Calibration', short: 'Calibration & accessories', icon: 'C', image: image(productImage('comparator')), description: 'Reference gauges, comparators, certificates and instrument-protection accessories.' },
];

const commonPressureRanges = [
  'Vacuum: -100 to 0 kPa',
  '0 to 100 kPa',
  '0 to 250 kPa',
  '0 to 600 kPa',
  '0 to 1 bar',
  '0 to 2.5 bar',
  '0 to 6 bar',
  '0 to 10 bar',
  '0 to 16 bar',
  '0 to 25 bar',
  '0 to 40 bar',
  '0 to 60 bar',
  '0 to 100 bar',
  '0 to 160 bar',
  '0 to 250 bar',
  '0 to 400 bar',
  '0 to 600 bar',
  '0 to 1 000 bar',
  'Custom range - sales review',
];

const highPressureRanges = [...commonPressureRanges.slice(0, -1), '0 to 1 600 bar', '0 to 2 500 bar', 'Custom range - sales review'];
const lowPressureRanges = ['-1 to 0 kPa', '-2.5 to 0 kPa', '-6 to 0 kPa', '-10 to 0 kPa', '0 to 1 kPa', '0 to 2.5 kPa', '0 to 6 kPa', '0 to 10 kPa', '0 to 25 kPa', '0 to 40 kPa', 'Custom range - sales review'];
const temperatureRanges = ['-50 to 50 °C', '-40 to 40 °C', '-20 to 120 °C', '0 to 60 °C', '0 to 100 °C', '0 to 160 °C', '0 to 250 °C', '0 to 400 °C', '0 to 600 °C', 'Custom range - sales review'];

const choice = (key, label, options, required = true, help = '') => ({ key, label, type: 'choice', options, required, help });
const select = (key, label, options, required = true, help = '') => ({ key, label, type: 'select', options, required, help });
const multiChoice = (key, label, options, required = false, help = '') => ({ key, label, type: 'multiChoice', options, required, help });
const text = (key, label, placeholder, required = false, help = '') => ({ key, label, type: 'text', placeholder, required, help });
const textarea = (key, label, placeholder, required = false, help = '', showWhen) => ({ key, label, type: 'textarea', placeholder, required, help, showWhen });
const toggle = (key, label, help = '', showWhen) => ({ key, label, type: 'toggle', required: false, help, showWhen });

const gaugeThreadSizes = ['1/8 inch', '1/4 inch', '3/8 inch', '1/2 inch'];
const gaugeSystemMaterials = ['Brass system', '316L stainless steel system', 'Monel system - sales review'];
const gaugeOptionalFeatures = [
  'Oil free / oxygen clean',
  'Secondary scale - psi',
  'Secondary scale - bar',
  'Secondary scale - kPa',
  'Refrigeration scale',
  'Retarded scale',
  'Internal overload stop',
  'Studs and bracket',
  'Nickel-plated block',
  'Snubber',
  'Female thread',
  'Stainless-steel movement in brass system',
  'No aluminium parts',
  'Maximum drag pointer',
  'Blow-out back with baffle',
  'Red set pointer',
  'Safety glass',
  'Zero adjuster',
  'Special option - describe in notes',
];

const rptRanges = ['-1 bar', '0 to 1 bar', '0 to 1.6 bar', '0 to 2.5 bar', '0 to 4 bar', '0 to 6 bar', '0 to 10 bar', '0 to 16 bar', '0 to 20 bar', '0 to 25 bar', '0 to 40 bar', '0 to 60 bar', '0 to 100 bar', '0 to 200 bar', '0 to 400 bar', '0 to 600 bar', 'Compound or custom range - sales review'];
const rptConnections = ['1/8 inch NPT', '1/4 inch NPT', '3/8 inch NPT', '1/2 inch NPT', '1/8 inch BSP', '1/4 inch BSP', '3/8 inch BSP', '1/2 inch BSP', '3/4 inch BSP', '1 inch BSP', '1/8 inch BSPT', '1/4 inch BSPT', '3/8 inch BSPT', '1/2 inch BSPT', '1 1/2 inch Tri-Clover', 'NW40 dairy'];
const fixedTemperatureConnections = ['1/4 inch BSP fixed', '1/4 inch NPT fixed', '3/8 inch BSP fixed', '3/8 inch NPT fixed', '1/2 inch BSP fixed', '1/2 inch NPT fixed', '3/4 inch BSP fixed', '3/4 inch NPT fixed'];
const unionTemperatureConnections = ['1/4 inch BSP adjustable union', '1/4 inch NPT adjustable union', '3/8 inch BSP adjustable union', '3/8 inch NPT adjustable union', '1/2 inch BSP adjustable union', '1/2 inch NPT adjustable union'];
const allTemperatureConnections = [...fixedTemperatureConnections, ...unionTemperatureConnections];
const temperatureConnectionsByProbe = {
  '6 mm': allTemperatureConnections,
  '8 mm': fixedTemperatureConnections.slice(4).concat(unionTemperatureConnections.slice(4)),
  '9.52 mm (3/8 inch)': fixedTemperatureConnections.slice(4).concat(unionTemperatureConnections.slice(4)),
  '10 mm': fixedTemperatureConnections.slice(6),
  '12 mm': fixedTemperatureConnections.slice(6),
};

const withOptionsBy = (field, key, map, fallback = []) => ({ ...field, optionsBy: { key, map, fallback } });
const withShowWhen = (field, showWhen) => ({ ...field, showWhen });

const pressureGaugeConfig = product => {
  const fields = [];
  if (product.caseModels) fields.push(choice('caseModel', 'Gauge construction', Object.keys(product.caseModels)));

  const dialField = choice('dialSize', 'Dial size', product.dialSizes || ['63 mm', '100 mm', '150 mm']);
  fields.push(product.dialSizesBy ? withOptionsBy(dialField, product.dialSizesBy.key, product.dialSizesBy.map, product.dialSizes || []) : dialField);
  fields.push(choice('material', 'System / wetted material', product.materialOptions || gaugeSystemMaterials));
  fields.push(select('range', 'Pressure / measuring range', product.rangeOptions || commonPressureRanges, true, product.measuringRange));
  fields.push(text('customRange', 'Describe the required range', 'Example: -1 to 15 bar, dual scale bar/psi', true, 'A representative will validate non-standard ranges.'));

  if (product.code === 'PBB') {
    fields.push(withShowWhen(
      choice('internalContacts', 'Internal electrical contacts', ['No internal contacts', 'Single internal contact', 'Dual internal contacts'], true, 'PBB only: available on the 100 mm model. Catalogue suitability starts above 250 kPa and is confirmed by Rhomberg.'),
      { key: 'dialSize', value: '100 mm' },
    ));
    fields.push(withShowWhen(
      select('contactCableLength', 'Internal-contact cable length', ['1 m', '2 m', '3 m', '5 m', '10 m', 'Custom length - describe in notes'], true, 'Required when single or dual internal contacts are selected.'),
      { key: 'internalContacts', values: ['Single internal contact', 'Dual internal contacts'] },
    ));
  }

  const positionField = choice('connectionPosition', 'Connection position', product.positions || ['Bottom entry (A)', 'Back entry (D)']);
  fields.push(product.positionsByDial ? withOptionsBy(positionField, 'dialSize', product.positionsByDial, product.positions || []) : positionField);
  fields.push(choice('threadType', 'Thread type', product.threadTypes || ['BSP', 'NPT', 'BSPT']));
  fields.push(choice('threadSize', 'Thread size', product.threadSizes || gaugeThreadSizes));
  fields.push(choice('fill', 'Dampening / fill', product.fillOptions || ['Dry', 'Glycerine filled', 'Silicone filled', 'Vibration-free movement']));
  fields.push(choice('installationOption', 'Block / adaptor option', product.installationOptions || ['Standard - no modification', 'Block welded to case', 'Adaptor fitted', 'Centre-back option - where applicable']));
  fields.push(choice('logo', 'Dial branding', ['Standard Rhomberg logo', 'Customer logo', 'No logo']));
  fields.push(multiChoice('gaugeOptions', 'Optional gauge features', product.gaugeOptions || gaugeOptionalFeatures, false, 'Choose only the extras needed. Final compatibility is checked against the selected gauge.'));
  fields.push(choice('sanas', 'SANAS calibration', ['No SANAS certificate', 'SANAS calibration required']));
  if (product.allowChemicalSeal !== false) {
    fields.push(toggle('chemicalSeal', 'I require a Chemical Seal', 'Seal selection is completed by Rhomberg after reviewing the application.'));
    fields.push(textarea('chemicalSealNotes', 'Chemical seal request details', 'Tell us about the medium, temperature, cleaning process or connection. Do not select a seal model.', false, 'Optional: share process details that will help the representative.', { key: 'chemicalSeal', value: true }));
  }
  fields.push(textarea('specialRequirements', 'Gauge notes or special instructions', 'Custom dial, unusual mounting, option details or plant standard', false));
  return fields;
};

const pressureTransmitterConfig = product => [
  select('range', 'Pressure / transducer range', product.rangeOptions || rptRanges, true, product.measuringRange),
  choice('output', 'Output signal', product.outputs || ['4-20 mA', '0-5 V', '0-10 V', 'RS485']),
  choice('processConnection', 'Process connection', product.connections || rptConnections),
  choice('electricalConnection', 'Electrical connection', product.electrical || ['DIN Maxi connector', 'M12 4-pin connector', 'Cable outlet IP68', 'KSE head']),
  choice('branding', 'Customer branding', ['Standard Rhomberg branding', 'Customer company logo', 'No logo']),
  choice('sanas', 'SANAS calibration', ['No SANAS certificate', 'SANAS calibration required']),
  textarea('specialRequirements', 'Special requirements', 'Hazardous area, display, HART, cable length or installation notes', false),
];

const digitalPressureConfig = product => product.code === 'DPG-S281' ? [
  choice('rangeUnit', 'Pressure unit', ['kPa', 'bar', 'MPa', 'psi', 'Pa']),
  text('fullScaleRange', 'Full-scale range', 'Example: 0 to 10 bar', true, product.measuringRange),
  choice('accuracy', 'Accuracy class', ['0.4% F.S.', '0.2% F.S.']),
  choice('processConnection', 'Screw thread', ['M20 x 1.5', 'G1/4', 'G1/2', 'NPT 1/2', 'NPT 1/4', 'ZG1/4', 'Custom thread - sales review']),
  choice('powerSupply', 'Power supply', ['3 V battery']),
  choice('sanas', 'SANAS calibration', ['No SANAS certificate', 'SANAS calibration required']),
  textarea('specialRequirements', 'Special requirements', 'Logging, Bluetooth, display or installation notes', false),
] : [
  select('range', 'Pressure / measuring range', product.rangeOptions || rptRanges, true, product.measuringRange),
  choice('processConnection', 'Process connection', product.connections || ['1/2 inch BSP', '1/2 inch NPT']),
  choice('display', 'Display / power', ['Local digital display - battery powered']),
  choice('sanas', 'SANAS calibration', ['No SANAS certificate', 'SANAS calibration required']),
  textarea('specialRequirements', 'Special requirements', 'Accuracy, logging or installation notes', false),
];

const tpsConfig = product => [
  choice('dialSize', 'Dial size', product.dialSizes),
  select('range', 'Temperature measuring range', ['-10 to 50 °C', '-20 to 120 °C', '-40 to 160 °C', '-50 to 50 °C', '0 to 50 °C', '0 to 60 °C', '0 to 100 °C', '0 to 120 °C', '0 to 150 °C', '10 to 150 °C', '0 to 200 °C', '0 to 300 °C', '10 to 450 °C', '100 to 500 °C', 'Custom range - sales review'], true, product.measuringRange),
  choice('mounting', 'Mounting', product.mounting),
  choice('probeDiameter', 'Probe diameter', product.probeDiameters),
  select('stemLength', 'Probe / stem length', ['63 mm', '100 mm', '150 mm', '228 mm', '304 mm', '381 mm', '457 mm', '610 mm', 'Custom length - sales review']),
  withOptionsBy(choice('processConnection', 'Process connection', allTemperatureConnections), 'probeDiameter', temperatureConnectionsByProbe, allTemperatureConnections),
  choice('traceability', 'Traceability', ['No traceability certificate', 'Traceability certificate required']),
  textarea('specialRequirements', 'Special requirements', 'Thermowell, sanitary connection, response time or process notes', false),
];

const tpbConfig = product => [
  choice('dialSize', 'Dial size', product.dialSizes),
  select('range', 'Temperature measuring range', ['-10 to 50 °C', '-10 to 110 °C', '-20 to 120 °C', '-20 to 160 °C', '-20 to 200 °C', '-30 to 50 °C', '-40 to 40 °C', '-50 to 50 °C', '0 to 60 °C', '0 to 100 °C', '0 to 120 °C', '0 to 160 °C', '0 to 200 °C', '0 to 250 °C', '0 to 300 °C', '0 to 400 °C', '0 to 500 °C', '0 to 600 °C', '50 to 600 °C', 'Custom range - sales review'], true, product.measuringRange),
  choice('mounting', 'Mounting', product.mounting),
  select('capillaryLength', 'Capillary length', ['1.5 m', '2 m', '3 m', '5 m', 'Custom length - sales review']),
  choice('probeDiameter', 'Probe diameter', ['6 mm', '8 mm', '9.52 mm (3/8 inch)', '10 mm', '12 mm']),
  select('probeLength', 'Probe length', ['100 mm', '150 mm', '200 mm', '250 mm', '300 mm', '350 mm', '400 mm', '450 mm', 'Custom length - sales review']),
  withOptionsBy(choice('processConnection', 'Process connection', allTemperatureConnections), 'probeDiameter', temperatureConnectionsByProbe, allTemperatureConnections),
  choice('traceability', 'Traceability', ['No traceability certificate', 'Traceability certificate required']),
  textarea('specialRequirements', 'Special requirements', 'Thermowell, sanitary connection, capillary protection or process notes', false),
];

const temperatureElectronicConfig = product => [
  text('range', 'Required temperature range', product.measuringRange, true, 'Enter the operating range needed for this model.'),
  choice('sensorInput', 'Sensor / input', product.sensorOptions || [product.sensor || 'Configured sensor input']),
  choice('output', 'Output / switching', product.outputs || ['4-20 mA']),
  choice('processConnection', 'Process connection', product.connections || ['1/4 inch BSP', '1/4 inch NPT', '1/2 inch BSP', '1/2 inch NPT']),
  choice('electricalConnection', 'Electrical connection', product.electrical || ['DIN head / terminal', 'M12 connector', 'Cable outlet']),
  choice('traceability', 'Traceability', ['No traceability certificate', 'Traceability certificate required']),
  textarea('specialRequirements', 'Special requirements', 'Probe, thermowell, display, hazardous area or installation notes', false),
];

const temperatureSensorConfig = product => [
  choice('sensorType', 'Sensing element', product.code === 'Thermocouple' ? ['Type J', 'Type K', 'Type T', 'Type N', 'Other - sales review'] : [product.code === 'PT100' ? 'PT100 platinum element' : 'RTD element - specify']),
  text('range', 'Required temperature range', product.measuringRange, true),
  choice('probeDiameter', 'Probe diameter', ['3 mm', '4.5 mm', '6 mm', '8 mm', '9.52 mm (3/8 inch)', 'Custom diameter']),
  text('probeLength', 'Probe length', 'Example: 150 mm', true),
  choice('processConnection', 'Process connection', ['Plain probe', '1/4 inch BSP', '1/4 inch NPT', '1/2 inch BSP', '1/2 inch NPT', 'Adjustable union', 'Custom connection']),
  choice('termination', 'Termination', ['Flying leads', 'Terminal head', 'M12 connector', 'Plug and socket', 'Cable - specify length']),
  choice('traceability', 'Traceability', ['No traceability certificate', 'Traceability certificate required']),
  textarea('specialRequirements', 'Special requirements', 'Lead length, sheath material, head type, thermowell or response-time notes', false),
];

const thermowellConfig = product => {
  const fields = [
    choice('material', 'Thermowell material', ['ANSI 316', 'Brass', 'ANSI 304', 'ANSI 310', 'Inconel 600', 'Special material - sales review']),
    choice('diameter', 'Thermowell diameter', ['1/4 inch NB (13.7 mm)', '1/2 inch NB (21.34 mm)', '3/4 inch NB (26.67 mm)']),
    choice('immersionReference', 'Immersion-depth reference', ['U-length (shaft)', 'S-length (stem)', 'I-length (immersion)']),
    select('length', 'Length', ['100 mm', '200 mm', '300 mm', '400 mm', '500 mm', '600 mm', '700 mm', '800 mm', '900 mm', '1 000 mm', '1 100 mm', 'Custom length - sales review']),
    choice('internalThread', 'Internal instrument thread', ['1/4 inch NPT', '3/8 inch NPT', '1/2 inch NPT', '3/4 inch NPT', '1/4 inch BSP', '3/8 inch BSP', '1/2 inch BSP', '3/4 inch BSP']),
  ];
  if (product.code === 'Flanged Well') {
    fields.push(choice('facing', 'Flange facing', ['Flat face', 'Raised face', 'Ring joint', 'Lap joint']));
    fields.push(choice('flangeSize', 'Flange size', ['NB15 (1/2 inch)', 'NB20 (3/4 inch)', 'NB25 (1 inch)', 'NB32 (1 1/4 inch)', 'NB40 (1 1/2 inch)', 'NB50 (2 inch)', 'NB65 (2 1/2 inch)', 'NB80 (3 inch)', 'NB100 (4 inch)']));
  } else {
    fields.push(choice('externalConnection', 'External process connection', ['1/4 inch NPT', '3/8 inch NPT', '1/2 inch NPT', '3/4 inch NPT', '1/4 inch BSP', '3/8 inch BSP', '1/2 inch BSP', '3/4 inch BSP', 'Weld-on', 'Ball joint', 'Flange - sales review']));
  }
  fields.push(choice('traceability', 'Traceability', ['No traceability certificate', 'Traceability certificate required']));
  fields.push(textarea('specialRequirements', 'Special requirements', 'Pressure, velocity, material certificate or dimensional notes', false));
  return fields;
};

const flowConfig = product => [
  choice('medium', 'Process medium', ['Liquid', 'Air / gas']),
  choice('range', 'Measuring range', product.rangeOptions || ['3-300 cm/s liquid', '200-3 000 cm/s air']),
  choice('output', 'Output / switching', ['Relay (SPDT)', 'PNP', '4-20 mA + relay']),
  choice('probeMaterial', 'Probe material', ['304 stainless steel', '316 stainless steel - sales review']),
  textarea('application', 'Installation details', 'Pipe size, expected flow, process temperature and mounting point', true),
];

const levelConfig = product => [
  choice('medium', 'Measured product', product.mediums || ['Liquid', 'Corrosive liquid', 'Solid powder']),
  select('range', 'Measuring range', product.rangeOptions || ['0-2 m', '0-5 m', '0-10 m', '0-20 m', 'Custom range']),
  choice('output', 'Output / communication', product.outputs || ['4-20 mA', '4-20 mA + HART', 'RS485 / Modbus']),
  choice('processConnection', 'Process connection', product.connections || ['Threaded', 'Flanged', 'Cable suspended']),
  textarea('application', 'Tank and installation details', 'Tank height, nozzle size, medium, temperature and pressure', true),
];

const switchConfig = product => [
  choice('measuredVariable', 'Measured variable', product.variables || ['Pressure']),
  select('range', 'Set-point / measuring range', product.rangeOptions || commonPressureRanges),
  choice('output', 'Switching output', product.outputs || ['SPDT relay', 'PNP', 'Two relay outputs']),
  choice('connection', 'Process connection', product.connections || ['1/4 inch BSP', '1/4 inch NPT', '1/2 inch BSP', '1/2 inch NPT']),
  textarea('application', 'Control duty', 'Describe the alarm, trip or control requirement', true),
];

const analysisConfig = product => [
  choice('gas', 'Gas / measurement', product.gases || ['Oxygen', 'Moisture / dew point', 'Special gas']),
  select('range', 'Measurement range', product.rangeOptions || ['Trace level', '0-1%', '0-5%', '0-25%', 'Custom range']),
  choice('installation', 'Installation', ['In-situ', 'Extractive', 'Portable']),
  choice('output', 'Output / communication', ['4-20 mA', 'RS485 / Modbus', 'Local display only']),
  textarea('application', 'Process details', 'Gas composition, pressure, temperature, expected concentration and hazardous-area requirements', true),
];

const calibrationConfig = product => [
  choice('service', 'Requirement', product.services || ['Instrument supply', 'Calibration support', 'Certificate request']),
  textarea('application', 'Instrument / calibration details', 'Range, accuracy, model, quantity and certificate requirements', true),
];

const consultationConfig = () => [
  textarea('application', 'Application and medium', 'Describe the process medium, concentration, temperature, pressure and cleaning method', true),
  text('connection', 'Existing instrument connection', 'Example: 1/2 inch BSP, DN50 flange or Tri-Clamp', false),
  textarea('notes', 'Additional information', 'A Rhomberg representative will select the correct seal construction with you.', false),
];

const baseSpecs = product => {
  if (product.category === 'pressure') {
    return [
      { tone: 'cyan', title: 'Measurement', items: [['Pressure capability', product.pressureRange], ['Selectable measuring range', product.measuringRange], ['Accuracy', product.accuracy || 'Model dependent']] },
      { tone: 'blue', title: 'Construction', items: [['Case / body', product.caseMaterial || 'Industrial construction'], ['Wetted parts', product.wettedParts || 'Model dependent'], ['Protection', product.ingress || 'Application dependent']] },
      { tone: 'steel', title: 'Connections', items: [['Positions', (product.positions || ['Model dependent']).join(', ')], ['Thread sizes', (product.threadSizes || ['Model dependent']).join(', ')], ['Temperature', product.temperature || 'Application dependent']] },
    ];
  }
  if (product.category === 'temperature') {
    return [
      { tone: 'cyan', title: 'Measurement', items: [['Measuring range', product.measuringRange], ['Accuracy', product.accuracy || 'Model dependent'], ['Traceability', 'Available on temperature units']] },
      { tone: 'blue', title: 'Assembly', items: [['Sensing element', product.sensor || 'Model dependent'], ['Case / head', product.caseMaterial || 'Industrial construction'], ['Stem / probe', product.probe || 'Configured to application']] },
      { tone: 'steel', title: 'Installation', items: [['Mounting', (product.mounting || ['Model dependent']).join(', ')], ['Connection', (product.connections || ['Model dependent']).join(', ')], ['Protection', product.ingress || 'Application dependent']] },
    ];
  }
  return [
    { tone: 'cyan', title: 'Measurement', items: [['Measuring range', product.measuringRange], ['Accuracy', product.accuracy || 'Application dependent'], ['Output', (product.outputs || ['Model dependent']).join(', ')]] },
    { tone: 'blue', title: 'Construction', items: [['Materials', product.caseMaterial || 'Industrial construction'], ['Process connection', (product.connections || ['Configured to application']).join(', ')], ['Protection', product.ingress || 'Application dependent']] },
    { tone: 'steel', title: 'Application', items: [['Typical use', product.application || 'Industrial process measurement'], ['Configuration', 'Reviewed against application details'], ['Availability', 'Confirmed with quotation']] },
  ];
};

const resolveConfig = product => {
  if (product.consultationOnly) return consultationConfig(product);
  if (product.category === 'pressure' && product.variant === 'gauge') return pressureGaugeConfig(product);
  if (product.category === 'pressure' && ['RDPG10', 'DPG-S281'].includes(product.code)) return digitalPressureConfig(product);
  if (product.category === 'pressure') return pressureTransmitterConfig(product);
  if (product.code === 'TPS') return tpsConfig(product);
  if (product.code === 'TPB') return tpbConfig(product);
  if (['Straight Well', 'Tapered Well', 'Flanged Well'].includes(product.code)) return thermowellConfig(product);
  if (['RTD', 'PT100', 'Thermocouple'].includes(product.code)) return temperatureSensorConfig(product);
  if (product.category === 'temperature') return temperatureElectronicConfig(product);
  if (product.category === 'flow') return flowConfig(product);
  if (product.category === 'level') return levelConfig(product);
  if (product.category === 'switches') return switchConfig(product);
  if (product.category === 'analysis') return analysisConfig(product);
  return calibrationConfig(product);
};

const defaultDatasheets = product => {
  const sheets = [];
  if (product.code === 'PBB') sheets.push({ label: 'PBB product sheet', url: datasheet('PBB-product-sheet.pdf') });
  if (['PBG', 'PBJ', 'PBK', 'PBU', 'PBN'].includes(product.code)) sheets.push({ label: 'Utility gauge overview', url: datasheet('Utility-gauge-overview.pdf') });
  if (product.category === 'pressure' && product.variant === 'gauge') sheets.push({ label: 'Pressure gauge ordering guide', url: datasheet('Pressure-gauge-ordering-guide.pdf') });
  if (product.category === 'temperature') sheets.push({ label: 'Temperature ordering guide', url: datasheet('Temperature-ordering-guide.pdf') });
  if (product.code === 'RPT106') sheets.push({ label: 'RPT106 product sheet', url: datasheet('RPT106-product-sheet.pdf') });
  return sheets;
};

const defineProduct = input => {
  const product = {
    image: categories.find(category => category.id === input.category)?.image,
    description: `${input.name} configured by Rhomberg Instruments for reliable industrial measurement and control.`,
    application: 'General industrial measurement',
    measuringRange: 'Configured to application',
    pressureRange: 'Not applicable',
    ...input,
  };
  return {
    ...product,
    specGroups: input.specGroups || baseSpecs(product),
    configurations: resolveConfig(product),
    datasheets: input.datasheets || defaultDatasheets(product),
    rules: {
      sanas: product.category === 'pressure',
      traceability: product.category === 'temperature',
      chemicalSealRequest: product.category === 'pressure' && product.variant === 'gauge' && product.allowChemicalSeal !== false,
    },
  };
};

const pressureGauge = (code, name, overrides = {}) => defineProduct({
  id: code.toLowerCase().replace(/[^a-z0-9]+/g, '-'), code, name, category: 'pressure', variant: 'gauge',
  pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.0-1.6% FSD',
  caseMaterial: 'Stainless steel or model-specific industrial case', wettedParts: 'Brass or stainless steel', ingress: 'Model dependent',
  positions: ['Bottom entry (A)', 'Back entry (D)'], threadSizes: ['1/8 inch', '1/4 inch', '3/8 inch', '1/2 inch'],
  dialSizes: ['63 mm', '100 mm', '150 mm'],
  description: `${name} for dependable local pressure indication across industrial plant and equipment.`,
  ...overrides,
  image: image(overrides.image || (['PBG', 'PBJ', 'PBK', 'PBU', 'PBN'].includes(code) ? 'utility-gauge.png' : 'process-gauge.png')),
});

const pressureInstrument = (code, name, overrides = {}) => defineProduct({
  id: code.toLowerCase().replace(/[^a-z0-9]+/g, '-'), code, name, category: 'pressure', variant: 'transmitter',
  pressureRange: '-1 to 1 000 bar', measuringRange: '-1 to 1 000 bar', accuracy: '0.25-0.5% FSD',
  caseMaterial: 'Stainless steel process construction', wettedParts: '316L stainless steel', ingress: 'Model dependent',
  outputs: ['4-20 mA', '0-5 V', '0-10 V', 'RS485'], connections: rptConnections,
  description: `${name} for electronic pressure measurement and process automation.`,
  ...overrides,
  image: image(overrides.image || 'transmitters.png'),
});

const temperatureInstrument = (code, name, overrides = {}) => defineProduct({
  id: code.toLowerCase().replace(/[^a-z0-9]+/g, '-'), code, name, category: 'temperature', variant: 'temperature',
  measuringRange: '-50 to 400 °C', accuracy: 'Model dependent',
  caseMaterial: 'Stainless steel industrial construction', sensor: 'Application dependent', probe: 'Stainless steel', ingress: 'Model dependent',
  description: `${name} for industrial temperature indication, transmission or control.`,
  ...overrides,
  image: image(overrides.image || 'temperature.png'),
});

export const products = [
  pressureGauge('PBB', 'Stainless steel process gauge', {
    image: productImage('pbb'),
    description: 'A rugged fillable process gauge for vibration, pulsation and shock. The 100 mm and 150 mm versions include a 25 mm blow-out plug as an added safety feature.',
    pressureRange: 'Vacuum to 250 MPa (SS); vacuum to 60 MPa (brass)', measuringRange: '-100/0 kPa to 0/2 500 bar', rangeOptions: highPressureRanges,
    accuracy: '63 mm: 1.6% FSD; 100/150 mm: 1.0% FSD (0.5% optional)', caseMaterial: '304SS case and bezel (316SS on request)', wettedParts: 'Brass or 316L SS block and tube', ingress: 'IP67',
    dialSizes: ['63 mm', '100 mm', '150 mm'], positions: ['Bottom (A)', 'Bottom + back flange (B)', 'Bottom + front flange (C)', 'Back (D)', 'Back + back flange (E)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
    positionsByDial: {
      '63 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Back (D)', 'Back + back flange (E)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
      '100 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Bottom + front flange (C)', 'Back (D)', 'Back + back flange (E)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
      '150 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Back (D)', 'Back + back flange (E)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
    },
    materialOptions: ['Brass system', '316L stainless steel system', 'Monel system - sales review'], fillOptions: ['Dry', 'Glycerine filled', 'Silicone filled', 'Vibration-free movement'],
    temperature: 'Operating -25 to +60 °C; medium -25 to +85 °C',
  }),
  pressureGauge('PBZ', 'Colour-coded process gauge', { image: productImage('pbz'), dialSizes: ['100 mm', '150 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', caseMaterial: 'Colour-coded PBT case', positions: ['Bottom (A)', 'Bottom + back flange (B)'] }),
  pressureGauge('PBX', 'Solid-front safety gauge', { image: productImage('pbx'), dialSizes: ['100 mm'], pressureRange: 'Vacuum to 100 MPa (SS)', measuringRange: '-100/0 kPa to 0/1 000 bar', caseMaterial: 'Black colour-coded PBT safety-pattern case', positions: ['Bottom (A)'], allowChemicalSeal: false }),
  pressureGauge('PCB / PCK', 'Capsule low-pressure gauge', {
    image: productImage('pcb'), rangeOptions: lowPressureRanges, dialSizes: ['63 mm', '68 mm', '100 mm', '150 mm'], pressureRange: 'Vacuum to 40 kPa', measuringRange: '-10 kPa to 0/40 kPa', accuracy: '1.6% FSD', caseMaterial: 'Stainless steel or mild steel case', fillOptions: ['Dry only'], allowChemicalSeal: false,
    caseModels: { 'PCB - polished 304 stainless case': true, 'PCK - black mild-steel case': true },
    dialSizesBy: { key: 'caseModel', map: { 'PCB - polished 304 stainless case': ['63 mm', '100 mm', '150 mm'], 'PCK - black mild-steel case': ['68 mm'] } },
    positionsByDial: {
      '63 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Back (D)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
      '68 mm': ['Bottom (A)', 'Back (D)', 'Narrow front ring (V)'],
      '100 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Bottom + front flange (C)', 'Back (D)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
      '150 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Back (D)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
    },
  }),
  pressureGauge('PBR', 'Heavy-duty process gauge', { image: productImage('pbr'), dialSizes: ['100 mm', '150 mm'], pressureRange: '600 kPa to 6 000 kPa', measuringRange: '0.6 to 60 bar', accuracy: '1.0% FSD', caseMaterial: 'Aluminium case', wettedParts: 'Brass internals' }),
  pressureGauge('CBC', 'Simplex and duplex gauge', { image: productImage('cbc'), dialSizes: ['100 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100 kPa to 600 bar', accuracy: '1.0% FSD', caseMaterial: 'Black powder-coated aluminium', materialOptions: ['Brass duplex tube assembly'] }),
  pressureGauge('BBR', 'Butterfly duplex gauge', { image: productImage('bbr'), dialSizes: ['150 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100 kPa to 600 bar', accuracy: '1.0% FSD', positions: ['Bottom centre (C)', 'Back + front flange (F)'] }),
  pressureGauge('DBB', 'Differential pressure gauge', { image: productImage('dbb'), dialSizes: ['100 mm', '150 mm'], pressureRange: '100 to 6 000 kPa differential', measuringRange: '1 to 60 bar differential', accuracy: '1.6% FSD', caseMaterial: 'Stainless steel', wettedParts: 'Stainless steel' }),
  pressureGauge('HGZ', 'Homogeniser gauge', { image: productImage('hgz'), dialSizes: ['100 mm', '150 mm'], pressureRange: '400 to 700 bar', measuringRange: '0/400 to 0/700 bar', accuracy: '1.6% FSD', caseMaterial: 'Stainless steel', wettedParts: 'Stainless steel', positions: ['Bottom (A)'], materialOptions: ['316L stainless steel system'] }),
  pressureGauge('PBS', 'Solid stainless steel gauge', { image: productImage('pbs'), dialSizes: ['63 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', caseMaterial: 'Polished 304 stainless steel', positions: ['Bottom (A)', 'Back (D)'] }),
  pressureGauge('PBT', 'Turret-style process gauge', { dialSizes: ['100 mm', '150 mm'], caseMaterial: 'Turret-style stainless steel case' }),
  pressureGauge('PDBH', 'Diaphragm pressure gauge', { image: productImage('pdbh'), dialSizes: ['100 mm', '150 mm'], rangeOptions: lowPressureRanges, pressureRange: '-100 to 2 500 kPa', measuringRange: '-1 to 25 bar', accuracy: '1.6% FSD', positions: ['Diaphragm lower connection'], threadSizes: ['1/2 inch'], fillOptions: ['Dry', 'Silicone filled'], allowChemicalSeal: false }),
  pressureGauge('PBG', 'Filled stainless steel utility gauge', {
    image: productImage('pbg'), dialSizes: ['52 mm', '63 mm', '100 mm'], pressureRange: 'Vacuum to 100 MPa (SS); vacuum to 60 MPa (brass)', measuringRange: '-100/0 kPa to 0/1 000 bar', rangeOptions: commonPressureRanges, accuracy: '1.6% FSD', caseMaterial: '304 stainless steel case', wettedParts: 'Stainless steel or brass internals', positions: ['Bottom (A)', 'Bottom + back flange (B)', 'Bottom + front flange (C)', 'Back (D)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'], fillOptions: ['Glycerine filled', 'Silicone filled'],
    positionsByDial: { '52 mm': ['Back (D)'], '63 mm': ['Bottom (A)', 'Back (D)', 'Narrow front ring (V)'], '100 mm': ['Bottom (A)', 'Bottom + back flange (B)', 'Bottom + front flange (C)', 'Back (D)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'] },
  }),
  pressureGauge('PBJ', 'Filled plastic-case utility gauge', { image: productImage('pbj'), dialSizes: ['63 mm', '80 mm'], pressureRange: 'Vacuum to 25 MPa', measuringRange: '-100/0 kPa to 0/250 bar', accuracy: '1.6% FSD', caseMaterial: 'Injection-moulded plastic case', wettedParts: 'Brass internals', positions: ['Bottom (A)'], fillOptions: ['Glycerine filled', 'Silicone filled'] }),
  pressureGauge('PBK', 'Threaded light-industrial gauge', { image: productImage('pbk'), dialSizes: ['42 mm', '54 mm', '68 mm', '96 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.6% FSD', caseMaterial: 'Threaded mild-steel case', positions: ['Bottom (A)', 'Back (D)', 'Narrow front ring (V) on selected sizes'], fillOptions: ['Dry'] }),
  pressureGauge('PBU', 'Dry light-industrial gauge', { image: productImage('pbu'), dialSizes: ['42 mm', '54 mm', '63 mm', '96 mm', '100 mm', '125 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.6% FSD', caseMaterial: 'Mild steel case with flat acrylic window', positions: ['Bottom (A)', 'Bottom + back flange (B)', 'Back (D)', 'Back + back flange (E)', 'Back + front flange (F)', 'Wide front flange (U)'], fillOptions: ['Dry'] }),
  pressureGauge('PBN', 'Injection-moulded utility gauge', { image: productImage('pbn'), dialSizes: ['42 mm', '54 mm', '68 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.6% FSD', caseMaterial: 'Injection-moulded black case', positions: ['Bottom (A)', 'Back (D)'], fillOptions: ['Dry'] }),
  pressureInstrument('RDPG10', 'Reference digital pressure gauge', { image: productImage('rdpg10'), pressureRange: 'Vacuum to 1 000 bar', measuringRange: '-1/0 to 0/1 000 bar', accuracy: '0.2% FSD', caseMaterial: 'Anodised aluminium', outputs: ['Local digital display'], electrical: ['Battery powered'], connections: ['1/2 inch BSP', '1/2 inch NPT'] }),
  pressureInstrument('DPG-S281', 'Bluetooth digital pressure gauge', { image: productImage('dpg-s281'), pressureRange: 'Vacuum to 700 bar', measuringRange: '-1/0 to 0/700 bar', accuracy: '0.2% FSD', caseMaterial: 'TPE + ABS', outputs: ['Bluetooth app', 'Local display'] }),
  pressureInstrument('RPT1', 'Standard pressure transmitter', { image: productImage('rpt-series') }),
  pressureInstrument('RPT3', 'Flush pressure transmitter', { image: productImage('rpt-series'), pressureRange: '1 to 600 bar', measuringRange: '1 to 600 bar', connections: ['1/2 inch flush', '3/4 inch flush', '1 inch flush'] }),
  pressureInstrument('RPT4', 'Absolute pressure transmitter', { image: productImage('rpt-series'), pressureRange: '0.4 to 400 bar absolute', measuringRange: '0.4 to 400 bar absolute' }),
  pressureInstrument('RPT5', 'Voltage-output transmitter', { image: productImage('rpt-series') }),
  pressureInstrument('RPT106', 'Compact OEM pressure transmitter', { image: productImage('rpt106'), pressureRange: '-1 to 2 500 bar', measuringRange: '-1 to 2 500 bar', accuracy: '0.5% FSD', electrical: ['M12 4-pin connector'], connections: ['1/4 inch BSP', '1/4 inch NPT'], outputs: ['4-20 mA', '0-5 V', '0-10 V'] }),
  pressureInstrument('RPT7', 'Differential pressure transmitter', { image: productImage('rpt-series'), pressureRange: '0 to 3.5 MPa differential', measuringRange: '0 to 35 bar differential' }),
  pressureInstrument('RPT102 / 103', 'Ex ia smart pressure transmitter', { image: productImage('rpt102'), pressureRange: '-0.1 to 100 MPa', measuringRange: '-1 to 1 000 bar', outputs: ['4-20 mA', 'RS485', 'HART'] }),
  pressureInstrument('RPT161 / 162', 'Air and process differential transmitter', { image: productImage('rpt161'), pressureRange: '0 to 100 kPa / 3.5 MPa differential', measuringRange: '0 to 1 bar / 35 bar differential' }),
  pressureInstrument('RPT400 / 401', 'High-precision pressure transmitter', { image: productImage('rpt400-401'), accuracy: '0.075% FSD', outputs: ['4-20 mA', 'RS485', 'HART'] }),

  temperatureInstrument('TPS', 'Bi-metal dial thermometer', { image: productImage('tps'), measuringRange: '-50 to 500 °C', accuracy: 'Model dependent', sensor: 'Bi-metal element', dialSizes: ['63 mm', '76 mm', '100 mm', '125 mm', '150 mm'], mounting: ['Rigid back', 'Bottom entry', 'Every angle'], connections: ['1/4 inch BSP/NPT', '3/8 inch BSP/NPT', '1/2 inch BSP/NPT', '3/4 inch BSP/NPT', 'NW40 / NW50 dairy fitting'], probeDiameters: ['6 mm', '8 mm', '9.52 mm (3/8 inch)'] }),
  temperatureInstrument('TPB', 'Nitrogen gas-filled thermometer', { image: productImage('tpb'), measuringRange: '-50 to 600 °C', sensor: 'Nitrogen gas-filled system', remote: true, dialSizes: ['100 mm', '150 mm'], mounting: ['Rigid lower (AS)', 'Rigid back (DS)', 'Remote lower + back flange (BC)', 'Remote lower + front flange (CC)', 'Remote back + back flange (EC)', 'Remote back + front flange (FC)'], connections: ['1/4 inch BSP/NPT', '3/8 inch BSP/NPT', '1/2 inch BSP/NPT', '3/4 inch BSP/NPT'] }),
  temperatureInstrument('RBT100', 'Temperature transmitter', { image: productImage('rbt100'), measuringRange: '-200 to 200 °C', sensor: 'Configured sensor input', outputs: ['4-20 mA', 'RS485', '0-5 V', '0-10 V'], dialSizes: ['Compact transmitter'], mounting: ['Process connection'], probeDiameters: ['Configured probe'] }),
  temperatureInstrument('RBT102', 'Digital temperature transmitter', { image: productImage('rbt102'), measuringRange: '0 to 1 300 °C', accuracy: '0.5%', outputs: ['4-20 mA', 'RS485'], dialSizes: ['4-digit LED'], mounting: ['Process connection'], probeDiameters: ['Configured probe'] }),
  temperatureInstrument('RBT103', 'Smart temperature transmitter', { image: productImage('rbt103'), measuringRange: '0 to 100 °C', accuracy: '0.5%', outputs: ['4-20 mA', 'RS485'], dialSizes: ['5-digit LED'], mounting: ['Process connection'], probeDiameters: ['Configured probe'] }),
  temperatureInstrument('RTB108', '68 mm digital temperature gauge', { image: productImage('rtb118'), measuringRange: '-200 to 400 °C', sensor: 'PT100', dialSizes: ['68 mm LCD'], mounting: ['Process connection'] }),
  temperatureInstrument('RTB118', '100 mm digital temperature gauge', { image: productImage('rtb118'), measuringRange: '-200 to 400 °C', sensor: 'PT100', dialSizes: ['100 mm LCD'], mounting: ['Process connection'] }),
  temperatureInstrument('RTK103', 'Digital temperature switch', { image: productImage('sps103'), measuringRange: 'Configured to application', accuracy: '0.5%', outputs: ['4-20 mA', 'Two relay outputs'], dialSizes: ['Digital display'], mounting: ['1/2 inch fitting'] }),
  temperatureInstrument('RBT30S', 'Head-mounted smart transmitter', { image: productImage('rbt30s'), measuringRange: 'Sensor dependent', outputs: ['2-wire 4-20 mA'], dialSizes: ['Head mounted'], mounting: ['DIN head'] }),
  temperatureInstrument('RBT30H', 'HART temperature transmitter', { image: productImage('rbt30h'), measuringRange: 'Sensor dependent', outputs: ['4-20 mA + HART'], dialSizes: ['Head mounted'], mounting: ['DIN head'] }),
  temperatureInstrument('RTD', 'Resistance temperature detector', { measuringRange: '-200 to 600 °C', sensor: 'RTD element', image: productImage('rtd-pt100') }),
  temperatureInstrument('PT100', 'Precision platinum sensor', { measuringRange: '-200 to 600 °C', sensor: 'PT100 platinum element', image: productImage('rtd-pt100') }),
  temperatureInstrument('Thermocouple', 'High-temperature thermocouple', { measuringRange: 'Type dependent; up to 1 300 °C', sensor: 'Thermocouple', image: productImage('thermocouple') }),
  temperatureInstrument('Straight Well', 'Straight thermowell', { measuringRange: 'Application dependent', sensor: 'Protective well', image: productImage('well-straight') }),
  temperatureInstrument('Tapered Well', 'Tapered thermowell', { measuringRange: 'Application dependent', sensor: 'Protective tapered well', image: productImage('well-tapered') }),
  temperatureInstrument('Flanged Well', 'Flanged thermowell', { measuringRange: 'Application dependent', sensor: 'Protective flanged well', image: productImage('well-flanged') }),

  defineProduct({ id: 'tft', code: 'TFT', name: 'Thermo flow transmitter switch', category: 'flow', image: image('switches.png'), measuringRange: '3-300 cm/s liquid; 200-3 000 cm/s air', accuracy: 'Application dependent', caseMaterial: '304 stainless steel case and probe', outputs: ['Relay (SPDT)', 'PNP'], connections: ['Process probe'], ingress: 'Industrial enclosure', description: 'Electronic flow transmitter switch with LED indication for liquid and air monitoring.' }),

  ...[
    ['RLT201', 'Submersible liquid level transmitter', '0-200 m', ['Liquid'], 'rpt200-level'],
    ['RLT203', 'Level transmitter with air collector', '0-20 m', ['Liquid'], 'rpt200-level'],
    ['RLT701', 'Guided-wave radar for liquid and solids', 'Rod 0-6 m; cable 0-30 m', ['Liquid', 'Solid powder']],
    ['RLT702', 'Guided-wave radar for corrosive liquid', 'Rod 0-6 m; cable 0-20 m', ['Corrosive liquid']],
    ['RLT703', 'Guided-wave radar for solids', 'Cable 0-30 m', ['Solid powder']],
    ['RLT704', 'Radar for low-dielectric liquids', 'Rod 0-6 m', ['Low-dielectric liquid']],
    ['RLT705', 'High-temperature / pressure radar level', 'Rod 0-6 m; cable 0-15 m', ['Liquid']],
    ['RLT908', 'Radar level meter', 'Up to 30 m', ['Liquid', 'Solid powder']],
    ['RLT909', 'Long-range radar level meter', 'Up to 70 m', ['Liquid', 'Solid powder']],
    ['LDC', 'Bin level diaphragm switch', 'Point level', ['Solid powder']],
  ].map(([code, name, measuringRange, mediums, sourceImage]) => defineProduct({ id: code.toLowerCase(), code, name, category: 'level', image: sourceImage ? image(productImage(sourceImage)) : image('transmitters.png'), measuringRange, mediums, accuracy: 'Model dependent', caseMaterial: 'Industrial process construction', outputs: code === 'LDC' ? ['SPDT microswitch'] : ['4-20 mA', 'RS485', 'HART / Modbus'], connections: ['Threaded', 'Flanged', 'Cable suspended'], ingress: 'Model dependent', description: `${name} configured from tank geometry, product properties and required output.` })),

  ...[
    ['SPS103', 'Compact smart pressure switch', ['Pressure'], 'sps103'],
    ['RPT300', 'Digital OLED pressure switch', ['Pressure'], 'sps103'],
    ['RTK103', 'Digital temperature switch', ['Temperature'], 'sps103'],
    ['12 Series', 'Hazardous-location pressure switch', ['Pressure'], 'uec-12-series'],
    ['120 Series', 'Vibration-resistant switch', ['Pressure'], 'uec-12-series'],
    ['100 Series', 'General-purpose switch', ['Pressure'], 'uec-100-series'],
    ['One Series', 'Electronic switch and transmitter', ['Pressure', 'Temperature'], 'uec-one-series'],
  ].map(([code, name, variables, sourceImage]) => defineProduct({ id: `switch-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'switches', image: image(productImage(sourceImage)), measuringRange: 'Configured to set-point', variables, caseMaterial: 'Industrial switch enclosure', outputs: ['SPDT relay', 'PNP', 'Analogue + switching'], connections: ['1/4 inch', '1/2 inch'], description: `${name} for reliable alarm, trip and control duties.` })),

  ...[
    ['XWD35 / XWD50', 'Compact stainless diaphragm seal', 'seal-mini'],
    ['XWD1 / XWD4', 'General-process stainless seal', 'seal-xwd4'],
    ['XWD3 / XWD7', 'Polymer chemical seal', 'seal-xwd7'],
    ['Dairy / Tri-Clamp', 'Hygienic seal consultation', 'seal-dairy'],
    ['Pulp & Paper', 'Extended flush diaphragm consultation', 'seal-pulp-paper'],
    ['FC / FDCS', 'Flanged chemical seal consultation', 'seal-flanged'],
  ].map(([code, name, sourceImage]) => defineProduct({ id: `seal-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'protection', image: image(productImage(sourceImage)), consultationOnly: true, measuringRange: 'Selected with instrument', accuracy: 'System dependent', caseMaterial: 'Material selected for process compatibility', outputs: ['Application review'], connections: ['Threaded', 'Flanged', 'Hygienic'], description: 'Chemical seal construction must be selected by Rhomberg after reviewing the medium, temperature, pressure and process connection. Customers are not asked to configure the seal themselves.' })),

  ...[
    ['OxyTrend', 'Electrochemical oxygen transmitter', ['Oxygen'], 'oxytrend'],
    ['6801', 'Zirconia flue-gas analyser', ['Oxygen'], 'zirconia-6801'],
    ['P8863', 'Thermoparamagnetic oxygen analyser', ['Oxygen'], 'p8863'],
    ['P8863 PM', 'Paramagnetic oxygen analyser', ['Oxygen'], 'p8863-pm'],
    ['ATLAS-900', 'TDLAS gas analyser', ['Special gas'], 'atlas-900'],
    ['AMT', 'Dew-point transmitter', ['Moisture / dew point'], 'amt'],
    ['SADPmini2', 'Portable hygrometer', ['Moisture / dew point'], 'sadmini2'],
  ].map(([code, name, gases, sourceImage]) => defineProduct({ id: `analysis-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'analysis', image: image(productImage(sourceImage)), measuringRange: 'Model and gas dependent', gases, accuracy: 'Model dependent', caseMaterial: 'Industrial analyser construction', outputs: ['4-20 mA', 'RS485 / Modbus', 'Local display'], connections: ['Sample or in-situ connection'], description: `${name} for continuous or portable gas measurement.` })),

  ...[
    ['SPC0001', 'Single-piston pressure comparator', 'comparator'],
    ['RDPG10', 'Reference digital pressure gauge', 'rdpg10'],
    ['DPG-S281', 'Precision logging gauge', 'dpg-s281'],
    ['SANAS Certificate', 'Accredited pressure calibration'],
    ['VFM', 'Vibration-free movement', 'vibration-free-movement'],
    ['Snubber', 'Pressure pulsation protection'],
    ['Heat Reducer', 'High-temperature instrument protection', 'heat-reducer'],
  ].map(([code, name, sourceImage]) => defineProduct({ id: `cal-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'calibration', image: sourceImage ? image(productImage(sourceImage)) : image('calibration.png'), measuringRange: 'Matched to instrument or service', accuracy: 'Application dependent', caseMaterial: 'Industrial accessory / reference construction', services: ['Instrument supply', 'Calibration support', 'Certificate request'], description: `${name} supplied or applied after confirming the instrument range and service requirement.` })),
];

export const productById = id => products.find(product => product.id === id);
export const productsForCategory = categoryId => products.filter(product => product.category === categoryId);
export const categoryById = id => categories.find(category => category.id === id);

export const industries = ['Mining', 'Manufacturing', 'Food & Beverage', 'Water & Wastewater', 'Petrochemical & Oil & Gas', 'Power & Utilities', 'HVAC & Refrigeration', 'Agriculture', 'OEM & Engineering', 'Other'];

export const recommendedCategories = {
  Mining: ['pressure', 'level', 'switches', 'analysis'],
  Manufacturing: ['pressure', 'temperature', 'flow', 'switches'],
  'Food & Beverage': ['temperature', 'level', 'protection', 'flow'],
  'Water & Wastewater': ['pressure', 'level', 'flow', 'analysis'],
  'Petrochemical & Oil & Gas': ['pressure', 'temperature', 'level', 'analysis'],
  'Power & Utilities': ['pressure', 'temperature', 'flow', 'analysis'],
  'HVAC & Refrigeration': ['pressure', 'temperature', 'switches'],
  Agriculture: ['pressure', 'level', 'flow'],
  'OEM & Engineering': ['pressure', 'temperature', 'switches', 'calibration'],
  Other: ['pressure', 'temperature', 'level', 'calibration'],
};

export const shouldShowField = (field, values) => {
  if (field.key === 'customRange' && values.range !== 'Custom range - sales review') return false;
  if (!field.showWhen) return true;
  const actual = values[field.showWhen.key];
  if (field.showWhen.values) return field.showWhen.values.includes(actual);
  if (Object.prototype.hasOwnProperty.call(field.showWhen, 'notValue')) return actual !== field.showWhen.notValue;
  return actual === field.showWhen.value;
};

export const optionsForField = (field, values = {}) => {
  if (!field.optionsBy) return field.options || [];
  const dependency = values[field.optionsBy.key];
  return field.optionsBy.map?.[dependency] || field.optionsBy.fallback || field.options || [];
};
