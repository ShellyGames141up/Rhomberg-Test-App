const image = name => `assets/images/${name}`;
const datasheet = name => `assets/datasheets/${name}`;

export const categories = [
  { id: 'pressure', number: '01', name: 'Pressure', short: 'Pressure instruments', icon: 'P', image: image('process-gauge.png'), description: 'Mechanical gauges, digital gauges and transmitters for pressure, vacuum and differential pressure.' },
  { id: 'temperature', number: '02', name: 'Temperature', short: 'Temperature instruments', icon: 'T', image: image('temperature.png'), description: 'Dial thermometers, digital instruments, transmitters, sensors and protective thermowells.' },
  { id: 'flow', number: '03', name: 'Flow', short: 'Flow instruments', icon: 'F', image: image('switches.png'), description: 'Electronic flow monitoring and switching for liquid and air applications.' },
  { id: 'level', number: '04', name: 'Level', short: 'Level instruments', icon: 'L', image: image('transmitters.png'), description: 'Submersible, radar, guided-wave and switching solutions for liquids and bulk solids.' },
  { id: 'switches', number: '05', name: 'Switches', short: 'Industrial switches', icon: 'S', image: image('switches.png'), description: 'Pressure, temperature, flow and level switches for control and alarm duties.' },
  { id: 'protection', number: '06', name: 'Process Protection', short: 'Chemical seal support', icon: 'D', image: image('diaphragm-gauge.png'), description: 'Chemical and diaphragm seal information with application review by a Rhomberg representative.' },
  { id: 'analysis', number: '07', name: 'Gas Analysis', short: 'Gas analysers', icon: 'G', image: image('gas-analysis.png'), description: 'Oxygen, moisture and specialist gas-analysis instruments for continuous monitoring.' },
  { id: 'calibration', number: '08', name: 'Calibration', short: 'Calibration & accessories', icon: 'C', image: image('calibration.png'), description: 'Reference gauges, comparators, certificates and instrument-protection accessories.' },
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
const text = (key, label, placeholder, required = false, help = '') => ({ key, label, type: 'text', placeholder, required, help });
const textarea = (key, label, placeholder, required = false, help = '', showWhen) => ({ key, label, type: 'textarea', placeholder, required, help, showWhen });
const toggle = (key, label, help = '', showWhen) => ({ key, label, type: 'toggle', required: false, help, showWhen });

const pressureGaugeConfig = product => [
  choice('dialSize', 'Dial size', product.dialSizes || ['63 mm', '100 mm', '150 mm']),
  choice('material', 'Case and wetted-parts material', product.materialOptions || ['Stainless steel case / stainless internals', 'Stainless steel case / brass internals']),
  select('range', 'Pressure / measuring range', product.rangeOptions || commonPressureRanges, true, product.measuringRange),
  text('customRange', 'Describe the required range', 'Example: -1 to 15 bar, dual scale bar/psi', true, 'A representative will validate non-standard ranges.'),
  choice('connectionPosition', 'Connection position', product.positions || ['Bottom entry (A)', 'Back entry (D)']),
  choice('threadType', 'Thread type', ['BSP', 'NPT', 'BSPT']),
  choice('threadSize', 'Thread size', product.threadSizes || ['1/8 inch', '1/4 inch', '3/8 inch', '1/2 inch']),
  choice('fill', 'Dampening / fill', product.fillOptions || ['Dry', 'Glycerine filled', 'Silicone filled', 'Vibration-free movement']),
  choice('logo', 'Dial branding', ['Standard Rhomberg logo', 'Customer logo', 'No logo']),
  choice('sanas', 'SANAS calibration', ['No SANAS certificate', 'SANAS calibration required']),
  toggle('chemicalSeal', 'I require a Chemical Seal', 'Seal selection is completed by Rhomberg after reviewing the application.'),
  textarea('chemicalSealNotes', 'Chemical seal request details', 'Tell us about the medium, temperature, cleaning process or connection. Do not select a seal model.', false, 'Optional: share any process details that may help our representative prepare for the discussion.', { key: 'chemicalSeal', value: true }),
];

const pressureTransmitterConfig = product => [
  select('range', 'Pressure / measuring range', product.rangeOptions || commonPressureRanges, true, product.measuringRange),
  choice('output', 'Output signal', product.outputs || ['4-20 mA', '0-5 V', '0-10 V', 'RS485']),
  choice('processConnection', 'Process connection', product.threadSizes || ['1/4 inch BSP', '1/4 inch NPT', '1/2 inch BSP', '1/2 inch NPT']),
  choice('electricalConnection', 'Electrical connection', product.electrical || ['DIN plug', 'M12 connector', 'Cable outlet']),
  choice('sanas', 'SANAS calibration', ['No SANAS certificate', 'SANAS calibration required']),
  textarea('specialRequirements', 'Special requirements', 'Hazardous area, display, HART, cable length or installation notes', false),
];

const temperatureConfig = product => [
  choice('dialSize', 'Dial / display size', product.dialSizes || ['63 mm', '100 mm', '150 mm']),
  select('range', 'Temperature measuring range', product.rangeOptions || temperatureRanges, true, product.measuringRange),
  choice('mounting', 'Mounting / connection position', product.mounting || ['Rigid back', 'Bottom entry', 'Every angle']),
  choice('probeDiameter', 'Probe / stem diameter', product.probeDiameters || ['6 mm', '8 mm', '9.52 mm (3/8 inch)']),
  select('stemLength', product.remote ? 'Capillary length' : 'Stem length', product.remote ? ['1.5 m', '2 m', '3 m', '5 m', 'Custom length'] : ['63 mm', '100 mm', '150 mm', '228 mm', '304 mm', '381 mm', '457 mm', '610 mm', 'Custom length']),
  choice('processConnection', 'Process connection', product.connections || ['1/4 inch BSP', '1/4 inch NPT', '1/2 inch BSP', '1/2 inch NPT', 'Adjustable union']),
  choice('traceability', 'Traceability', ['No traceability certificate', 'Traceability certificate required']),
  textarea('specialRequirements', 'Special requirements', 'Thermowell, sanitary connection, response time or process notes', false),
];

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
  if (product.category === 'pressure') return pressureTransmitterConfig(product);
  if (product.category === 'temperature') return temperatureConfig(product);
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
      chemicalSealRequest: product.category === 'pressure' && product.variant === 'gauge',
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
  outputs: ['4-20 mA', '0-5 V', '0-10 V', 'RS485'], connections: ['1/4 inch', '1/2 inch'],
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
    description: 'A rugged fillable process gauge for vibration, pulsation and shock. The 100 mm and 150 mm versions include a 25 mm blow-out plug as an added safety feature.',
    pressureRange: 'Vacuum to 250 MPa (SS); vacuum to 60 MPa (brass)', measuringRange: '-100/0 kPa to 0/2 500 bar', rangeOptions: highPressureRanges,
    accuracy: '63 mm: 1.6% FSD; 100/150 mm: 1.0% FSD (0.5% optional)', caseMaterial: '304SS case and bezel (316SS on request)', wettedParts: 'Brass or 316L SS block and tube', ingress: 'IP67',
    dialSizes: ['63 mm', '100 mm', '150 mm', '250 mm - sales review'], positions: ['Bottom (A)', 'Bottom + back flange (B)', 'Bottom + front flange (C)', 'Back (D)', 'Back + back flange (E)', 'Back + front flange (F)', 'Wide front flange (U)', 'Narrow front ring (V)'],
    temperature: 'Operating -25 to +60 °C; medium -25 to +85 °C',
  }),
  pressureGauge('PBZ', 'Colour-coded process gauge', { dialSizes: ['80 mm', '100 mm', '150 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', caseMaterial: 'Colour-coded PBT case', positions: ['Bottom (A)', 'Bottom + back flange (B)'] }),
  pressureGauge('PBX', 'Solid-front safety gauge', { dialSizes: ['100 mm'], pressureRange: 'Vacuum to 100 MPa (SS)', measuringRange: '-100/0 kPa to 0/1 000 bar', caseMaterial: 'Black colour-coded PBT safety-pattern case', positions: ['Bottom (A)'] }),
  pressureGauge('PCB / PCK', 'Capsule low-pressure gauge', { rangeOptions: lowPressureRanges, dialSizes: ['63/68 mm', '100 mm', '150 mm'], pressureRange: 'Vacuum to 40 kPa', measuringRange: '-10 kPa to 0/40 kPa', accuracy: '1.6% FSD', caseMaterial: 'Stainless steel or mild steel case', fillOptions: ['Dry only'], image: 'process-gauge.png' }),
  pressureGauge('PBR', 'Heavy-duty process gauge', { dialSizes: ['100 mm', '150 mm'], pressureRange: '600 kPa to 6 000 kPa', measuringRange: '0.6 to 60 bar', accuracy: '1.0% FSD', caseMaterial: 'Aluminium case', wettedParts: 'Brass internals' }),
  pressureGauge('CBC', 'Simplex and duplex gauge', { dialSizes: ['100 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100 kPa to 600 bar', accuracy: '1.0% FSD', caseMaterial: 'Black powder-coated aluminium', materialOptions: ['Brass duplex tube assembly'] }),
  pressureGauge('BBR', 'Butterfly duplex gauge', { dialSizes: ['150 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100 kPa to 600 bar', accuracy: '1.0% FSD', positions: ['Bottom centre (C)', 'Back + front flange (F)'] }),
  pressureGauge('DBB', 'Differential pressure gauge', { dialSizes: ['100 mm', '150 mm'], pressureRange: '100 to 6 000 kPa differential', measuringRange: '1 to 60 bar differential', accuracy: '1.6% FSD', caseMaterial: 'Stainless steel', wettedParts: 'Stainless steel' }),
  pressureGauge('HGZ', 'Homogeniser gauge', { dialSizes: ['100 mm'], pressureRange: '400 to 700 bar', measuringRange: '0/400 to 0/700 bar', accuracy: '1.6% FSD', caseMaterial: 'Stainless steel', wettedParts: 'Stainless steel', positions: ['Bottom (A)'] }),
  pressureGauge('PBS', 'Solid stainless steel gauge', { dialSizes: ['63 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', caseMaterial: 'Polished 304 stainless steel', positions: ['Bottom (A)', 'Back (D)'] }),
  pressureGauge('PBT', 'Turret-style process gauge', { dialSizes: ['100 mm', '150 mm'], caseMaterial: 'Turret-style stainless steel case' }),
  pressureGauge('PDBH', 'Diaphragm pressure gauge', { dialSizes: ['100 mm', '150 mm'], rangeOptions: lowPressureRanges, pressureRange: '-100 to 2 500 kPa', measuringRange: '-1 to 25 bar', accuracy: '1.6% FSD', positions: ['Diaphragm lower connection'], threadSizes: ['1/2 inch'], fillOptions: ['Dry', 'Silicone filled'] }),
  pressureGauge('PBG', 'Filled stainless steel utility gauge', { image: 'utility-gauge.png', dialSizes: ['50 mm', '63 mm', '80 mm', '100 mm'], pressureRange: 'Vacuum to 100 MPa (SS); vacuum to 60 MPa (brass)', measuringRange: '-100/0 kPa to 0/1 000 bar', rangeOptions: commonPressureRanges, accuracy: '1.6% FSD', caseMaterial: '304 stainless steel case', wettedParts: 'Stainless steel or brass internals', positions: ['Bottom (A)', 'Back (D)', 'Flange options on selected sizes'], fillOptions: ['Glycerine filled', 'Silicone filled'] }),
  pressureGauge('PBJ', 'Filled plastic-case utility gauge', { image: 'utility-gauge.png', dialSizes: ['63 mm', '80 mm'], pressureRange: 'Vacuum to 25 MPa', measuringRange: '-100/0 kPa to 0/250 bar', accuracy: '1.6% FSD', caseMaterial: 'Injection-moulded plastic case', wettedParts: 'Brass internals', positions: ['Bottom (A)'], fillOptions: ['Glycerine filled', 'Silicone filled'] }),
  pressureGauge('PBK', 'Threaded light-industrial gauge', { image: 'utility-gauge.png', dialSizes: ['42 mm', '54 mm', '68 mm', '96 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.6% FSD', caseMaterial: 'Threaded mild-steel case', positions: ['Bottom (A)', 'Back (D)', 'Front flange (F) on selected sizes'], fillOptions: ['Dry'] }),
  pressureGauge('PBU', 'Dry light-industrial gauge', { image: 'utility-gauge.png', dialSizes: ['42 mm', '54 mm', '63 mm', '96 mm', '100 mm', '125 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.6% FSD', caseMaterial: 'Mild steel case with flat acrylic window', fillOptions: ['Dry'] }),
  pressureGauge('PBN', 'Injection-moulded utility gauge', { image: 'utility-gauge.png', dialSizes: ['42 mm', '54 mm', '68 mm'], pressureRange: 'Vacuum to 60 MPa', measuringRange: '-100/0 kPa to 0/600 bar', accuracy: '1.6% FSD', caseMaterial: 'Injection-moulded black case', fillOptions: ['Dry'] }),
  pressureInstrument('RDPG10', 'Reference digital pressure gauge', { image: 'calibration.png', pressureRange: 'Vacuum to 1 000 bar', measuringRange: '-1/0 to 0/1 000 bar', accuracy: '0.2% FSD', caseMaterial: 'Anodised aluminium', outputs: ['Local digital display'], electrical: ['Battery powered'], threadSizes: ['1/2 inch'] }),
  pressureInstrument('DPG-S281', 'Bluetooth digital pressure gauge', { image: 'calibration.png', pressureRange: 'Vacuum to 700 bar', measuringRange: '-1/0 to 0/700 bar', accuracy: '0.2% FSD', caseMaterial: 'TPE + ABS', outputs: ['Bluetooth app', 'Local display'] }),
  pressureInstrument('RPT1', 'Standard pressure transmitter'),
  pressureInstrument('RPT3', 'Flush pressure transmitter', { pressureRange: '1 to 600 bar', measuringRange: '1 to 600 bar', connections: ['1/2 inch flush', '3/4 inch flush', '1 inch flush'] }),
  pressureInstrument('RPT4', 'Absolute pressure transmitter', { pressureRange: '0.4 to 400 bar absolute', measuringRange: '0.4 to 400 bar absolute' }),
  pressureInstrument('RPT5', 'Voltage-output transmitter'),
  pressureInstrument('RPT106', 'Compact OEM pressure transmitter', { pressureRange: '-1 to 2 500 bar', measuringRange: '-1 to 2 500 bar', accuracy: '0.5% FSD', electrical: ['M12 4-pin connector'], connections: ['1/4 inch'], outputs: ['4-20 mA', '0-5 V', '0-10 V'] }),
  pressureInstrument('RPT7', 'Differential pressure transmitter', { pressureRange: '0 to 3.5 MPa differential', measuringRange: '0 to 35 bar differential' }),
  pressureInstrument('RPT102 / 103', 'Ex ia smart pressure transmitter', { pressureRange: '-0.1 to 100 MPa', measuringRange: '-1 to 1 000 bar', outputs: ['4-20 mA', 'RS485', 'HART'] }),
  pressureInstrument('RPT161 / 162', 'Air and process differential transmitter', { pressureRange: '0 to 100 kPa / 3.5 MPa differential', measuringRange: '0 to 1 bar / 35 bar differential' }),
  pressureInstrument('RPT400 / 401', 'High-precision pressure transmitter', { accuracy: '0.075% FSD', outputs: ['4-20 mA', 'RS485', 'HART'] }),

  temperatureInstrument('TPS', 'Bi-metal dial thermometer', { measuringRange: '-50 to 500 °C', accuracy: 'Model dependent', sensor: 'Bi-metal element', dialSizes: ['63 mm', '76 mm', '100 mm', '125 mm', '150 mm'], mounting: ['Rigid back', 'Bottom entry', 'Every angle'], connections: ['1/4 inch BSP/NPT', '3/8 inch BSP/NPT', '1/2 inch BSP/NPT', '3/4 inch BSP/NPT', 'NW40 / NW50 dairy fitting'], probeDiameters: ['6 mm', '8 mm', '9.52 mm (3/8 inch)'] }),
  temperatureInstrument('TPB', 'Nitrogen gas-filled thermometer', { measuringRange: '-50 to 600 °C', sensor: 'Nitrogen gas-filled system', remote: true, dialSizes: ['100 mm', '150 mm'], mounting: ['Rigid lower (AS)', 'Rigid back (DS)', 'Remote lower + back flange (BC)', 'Remote lower + front flange (CC)', 'Remote back + back flange (EC)', 'Remote back + front flange (FC)'], connections: ['1/4 inch BSP/NPT', '3/8 inch BSP/NPT', '1/2 inch BSP/NPT', '3/4 inch BSP/NPT'] }),
  temperatureInstrument('RBT100', 'Temperature transmitter', { measuringRange: '-200 to 200 °C', sensor: 'Configured sensor input', outputs: ['4-20 mA', 'RS485', '0-5 V', '0-10 V'], dialSizes: ['Compact transmitter'], mounting: ['Process connection'], probeDiameters: ['Configured probe'] }),
  temperatureInstrument('RBT102', 'Digital temperature transmitter', { measuringRange: '0 to 1 300 °C', accuracy: '0.5%', outputs: ['4-20 mA', 'RS485'], dialSizes: ['4-digit LED'], mounting: ['Process connection'], probeDiameters: ['Configured probe'] }),
  temperatureInstrument('RBT103', 'Smart temperature transmitter', { measuringRange: '0 to 100 °C', accuracy: '0.5%', outputs: ['4-20 mA', 'RS485'], dialSizes: ['5-digit LED'], mounting: ['Process connection'], probeDiameters: ['Configured probe'] }),
  temperatureInstrument('RTB108', '68 mm digital temperature gauge', { measuringRange: '-200 to 400 °C', sensor: 'PT100', dialSizes: ['68 mm LCD'], mounting: ['Process connection'] }),
  temperatureInstrument('RTB118', '100 mm digital temperature gauge', { measuringRange: '-200 to 400 °C', sensor: 'PT100', dialSizes: ['100 mm LCD'], mounting: ['Process connection'] }),
  temperatureInstrument('RTK103', 'Digital temperature switch', { measuringRange: 'Configured to application', accuracy: '0.5%', outputs: ['4-20 mA', 'Two relay outputs'], dialSizes: ['Digital display'], mounting: ['1/2 inch fitting'] }),
  temperatureInstrument('RBT30S', 'Head-mounted smart transmitter', { measuringRange: 'Sensor dependent', outputs: ['2-wire 4-20 mA'], dialSizes: ['Head mounted'], mounting: ['DIN head'] }),
  temperatureInstrument('RBT30H', 'HART temperature transmitter', { measuringRange: 'Sensor dependent', outputs: ['4-20 mA + HART'], dialSizes: ['Head mounted'], mounting: ['DIN head'] }),
  temperatureInstrument('RTD', 'Resistance temperature detector', { measuringRange: '-200 to 600 °C', sensor: 'RTD element', image: 'temperature-sensors.png' }),
  temperatureInstrument('PT100', 'Precision platinum sensor', { measuringRange: '-200 to 600 °C', sensor: 'PT100 platinum element', image: 'temperature-sensors.png' }),
  temperatureInstrument('Thermocouple', 'High-temperature thermocouple', { measuringRange: 'Type dependent; up to 1 300 °C', sensor: 'Thermocouple', image: 'temperature-sensors.png' }),
  temperatureInstrument('Straight Well', 'Straight thermowell', { measuringRange: 'Application dependent', sensor: 'Protective well', image: 'temperature-sensors.png' }),
  temperatureInstrument('Tapered Well', 'Tapered thermowell', { measuringRange: 'Application dependent', sensor: 'Protective tapered well', image: 'temperature-sensors.png' }),
  temperatureInstrument('Flanged Well', 'Flanged thermowell', { measuringRange: 'Application dependent', sensor: 'Protective flanged well', image: 'temperature-sensors.png' }),

  defineProduct({ id: 'tft', code: 'TFT', name: 'Thermo flow transmitter switch', category: 'flow', image: image('switches.png'), measuringRange: '3-300 cm/s liquid; 200-3 000 cm/s air', accuracy: 'Application dependent', caseMaterial: '304 stainless steel case and probe', outputs: ['Relay (SPDT)', 'PNP'], connections: ['Process probe'], ingress: 'Industrial enclosure', description: 'Electronic flow transmitter switch with LED indication for liquid and air monitoring.' }),

  ...[
    ['RLT201', 'Submersible liquid level transmitter', '0-200 m', ['Liquid']],
    ['RLT203', 'Level transmitter with air collector', '0-20 m', ['Liquid']],
    ['RLT701', 'Guided-wave radar for liquid and solids', 'Rod 0-6 m; cable 0-30 m', ['Liquid', 'Solid powder']],
    ['RLT702', 'Guided-wave radar for corrosive liquid', 'Rod 0-6 m; cable 0-20 m', ['Corrosive liquid']],
    ['RLT703', 'Guided-wave radar for solids', 'Cable 0-30 m', ['Solid powder']],
    ['RLT704', 'Radar for low-dielectric liquids', 'Rod 0-6 m', ['Low-dielectric liquid']],
    ['RLT705', 'High-temperature / pressure radar level', 'Rod 0-6 m; cable 0-15 m', ['Liquid']],
    ['RLT908', 'Radar level meter', 'Up to 30 m', ['Liquid', 'Solid powder']],
    ['RLT909', 'Long-range radar level meter', 'Up to 70 m', ['Liquid', 'Solid powder']],
    ['LDC', 'Bin level diaphragm switch', 'Point level', ['Solid powder']],
  ].map(([code, name, measuringRange, mediums]) => defineProduct({ id: code.toLowerCase(), code, name, category: 'level', image: image('transmitters.png'), measuringRange, mediums, accuracy: 'Model dependent', caseMaterial: 'Industrial process construction', outputs: code === 'LDC' ? ['SPDT microswitch'] : ['4-20 mA', 'RS485', 'HART / Modbus'], connections: ['Threaded', 'Flanged', 'Cable suspended'], ingress: 'Model dependent', description: `${name} configured from tank geometry, product properties and required output.` })),

  ...[
    ['SPS103', 'Compact smart pressure switch', ['Pressure']],
    ['RPT300', 'Digital OLED pressure switch', ['Pressure']],
    ['RTK103', 'Digital temperature switch', ['Temperature']],
    ['12 Series', 'Hazardous-location pressure switch', ['Pressure']],
    ['120 Series', 'Vibration-resistant switch', ['Pressure']],
    ['100 Series', 'General-purpose switch', ['Pressure']],
    ['One Series', 'Electronic switch and transmitter', ['Pressure', 'Temperature']],
  ].map(([code, name, variables]) => defineProduct({ id: `switch-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'switches', image: image('switches.png'), measuringRange: 'Configured to set-point', variables, caseMaterial: 'Industrial switch enclosure', outputs: ['SPDT relay', 'PNP', 'Analogue + switching'], connections: ['1/4 inch', '1/2 inch'], description: `${name} for reliable alarm, trip and control duties.` })),

  ...[
    ['XWD35 / XWD50', 'Compact stainless diaphragm seal'],
    ['XWD1 / XWD4', 'General-process stainless seal'],
    ['XWD3 / XWD7', 'Polymer chemical seal'],
    ['Dairy / Tri-Clamp', 'Hygienic seal consultation'],
    ['Pulp & Paper', 'Extended flush diaphragm consultation'],
    ['FC / FDCS', 'Flanged chemical seal consultation'],
  ].map(([code, name]) => defineProduct({ id: `seal-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'protection', image: image('diaphragm-gauge.png'), consultationOnly: true, measuringRange: 'Selected with instrument', accuracy: 'System dependent', caseMaterial: 'Material selected for process compatibility', outputs: ['Application review'], connections: ['Threaded', 'Flanged', 'Hygienic'], description: 'Chemical seal construction must be selected by Rhomberg after reviewing the medium, temperature, pressure and process connection. Customers are not asked to configure the seal themselves.' })),

  ...[
    ['OxyTrend', 'Electrochemical oxygen transmitter', ['Oxygen']],
    ['6801', 'Zirconia flue-gas analyser', ['Oxygen']],
    ['P8863', 'Thermoparamagnetic oxygen analyser', ['Oxygen']],
    ['P8863 PM', 'Paramagnetic oxygen analyser', ['Oxygen']],
    ['ATLAS-900', 'TDLAS gas analyser', ['Special gas']],
    ['AMT', 'Dew-point transmitter', ['Moisture / dew point']],
    ['SADPmini2', 'Portable hygrometer', ['Moisture / dew point']],
  ].map(([code, name, gases]) => defineProduct({ id: `analysis-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'analysis', image: image('gas-analysis.png'), measuringRange: 'Model and gas dependent', gases, accuracy: 'Model dependent', caseMaterial: 'Industrial analyser construction', outputs: ['4-20 mA', 'RS485 / Modbus', 'Local display'], connections: ['Sample or in-situ connection'], description: `${name} for continuous or portable gas measurement.` })),

  ...[
    ['SPC0001', 'Single-piston pressure comparator'],
    ['RDPG10', 'Reference digital pressure gauge'],
    ['DPG-S281', 'Precision logging gauge'],
    ['SANAS Certificate', 'Accredited pressure calibration'],
    ['Electrical Contacts', 'Oil-tight, inductive and internal contacts'],
    ['VFM', 'Vibration-free movement'],
    ['Snubber', 'Pressure pulsation protection'],
    ['Heat Reducer', 'High-temperature instrument protection'],
  ].map(([code, name]) => defineProduct({ id: `cal-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, code, name, category: 'calibration', image: image('calibration.png'), measuringRange: 'Matched to instrument or service', accuracy: 'Application dependent', caseMaterial: 'Industrial accessory / reference construction', services: ['Instrument supply', 'Calibration support', 'Certificate request'], description: `${name} supplied or applied after confirming the instrument range and service requirement.` })),
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
  return values[field.showWhen.key] === field.showWhen.value;
};
