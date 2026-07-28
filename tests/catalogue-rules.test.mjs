import assert from 'node:assert/strict';

import { products } from '../src/data/catalogue.js';
import { optionsForField, toggleMultiChoiceOption } from '../src/domain/productConfiguration.js';

const product = code => {
  const match = products.find(item => item.code === code);
  assert.ok(match, `Expected catalogue product ${code}`);
  return match;
};

const field = (code, key) => product(code).configurations.find(item => item.key === key);
const options = (code, key, values = {}) => optionsForField(field(code, key), values);
const excludes = (values, denied, message) => denied.forEach(value => assert.ok(!values.includes(value), `${message}: ${value}`));

const gauges = products.filter(item => item.variant === 'gauge');
for (const gauge of gauges) {
  const materials = gauge.configurations.find(item => item.key === 'material')?.options || [];
  assert.ok(materials.every(option => !/monel/i.test(option)), `${gauge.code} must not expose Monel`);
  const optionalFeatures = gauge.configurations.find(item => item.key === 'gaugeOptions');
  if (optionalFeatures) {
    assert.ok(optionalFeatures.options.includes('No optional feature required'), `${gauge.code} must include the no-option choice`);
    assert.equal(optionalFeatures.exclusiveOption, 'No optional feature required');
    assert.equal(optionalFeatures.required, true, `${gauge.code} must require an explicit extras or no-extras choice`);
  }
}

for (const code of ['PBS', 'PBG', 'PBJ', 'PBK', 'PBU', 'PBN']) {
  assert.equal(field(code, 'chemicalSeal'), undefined, `${code} is a utility gauge and must not offer a chemical seal`);
}
assert.ok(field('PBB', 'chemicalSeal'), 'PBB remains a process gauge with a seal request');

assert.equal(products.some(item => item.code === 'PBT'), false, 'PBT must be removed');
assert.deepEqual(product('PBU').dialSizes, ['42 mm', '54 mm', '63 mm', '100 mm']);
assert.deepEqual(product('PBK').dialSizes, ['42 mm', '54 mm', '68 mm']);
assert.deepEqual(product('PBJ').materialOptions, ['Brass system']);
assert.deepEqual(product('PBK').materialOptions, ['Brass system']);
assert.deepEqual(product('PBR').materialOptions, ['Brass system']);

const compactDenied = [
  'Internal overload stop',
  'Female thread',
  'No aluminium parts',
  'Maximum drag pointer',
  'Blow-out back with baffle',
  'Red set pointer',
  'Zero adjuster',
];
for (const code of ['PBN', 'PBU', 'PBK', 'PBJ']) excludes(options(code, 'gaugeOptions'), compactDenied, `${code} utility options`);
assert.ok(!options('PBN', 'installationOption').includes('Block welded to case'));
assert.ok(!options('PBU', 'installationOption').includes('Block welded to case'));
assert.ok(!options('PBK', 'installationOption').includes('Block welded to case'));
excludes(options('PBJ', 'installationOption'), ['Block welded to case', 'Centre-back option - where applicable'], 'PBJ installation options');

assert.deepEqual(options('PBG', 'dialSize', { material: 'Brass system' }), ['42 mm', '52 mm', '63 mm', '100 mm']);
assert.deepEqual(options('PBG', 'dialSize', { material: '316L stainless steel system' }), ['52 mm', '63 mm', '80 mm', '100 mm']);
assert.ok(!options('PBG', 'gaugeOptions').includes('Blow-out back with baffle'));

assert.deepEqual(options('PBB', 'dialSize', { material: 'Brass system' }), ['63 mm', '100 mm', '150 mm']);
assert.ok(options('PBB', 'dialSize', { material: '316L stainless steel system' }).includes('250 mm'));
assert.deepEqual(field('PBB', 'internalContacts').showWhen, { key: 'dialSize', value: '100 mm' });

assert.deepEqual(product('PBS').dialSizes, ['63 mm', '100 mm']);
assert.deepEqual(product('PBS').materialOptions, ['316L stainless steel system']);
assert.deepEqual(options('PBS', 'installationOption'), ['Block welded to case']);
assert.ok(options('PBS', 'range', { dialSize: '63 mm' }).includes('0 to 600 bar'));
assert.ok(!options('PBS', 'range', { dialSize: '63 mm' }).includes('0 to 1 000 bar'));
assert.ok(options('PBS', 'range', { dialSize: '100 mm' }).includes('0 to 2 500 bar'));

assert.deepEqual(product('PBX').dialSizes, ['57 mm', '100 mm']);
assert.deepEqual(options('PBX', 'fill'), ['Dry only']);
assert.equal(field('PBX', 'installationOption'), undefined);
assert.ok(field('PBZ', 'caseColour'));
excludes(options('PBZ', 'installationOption'), ['Block welded to case', 'Centre-back option - where applicable'], 'PBZ installation options');

assert.deepEqual(options('BBR', 'connectionPosition'), ['Bottom entry (A)']);
assert.deepEqual(options('BBR', 'fill'), ['Dry only']);
assert.equal(field('BBR', 'installationOption'), undefined);
assert.equal(field('BBR', 'gaugeOptions'), undefined);

for (const code of ['PDBH', 'PDBH Capsule']) {
  assert.deepEqual(options(code, 'connectionPosition'), ['Bottom entry (A)']);
  assert.deepEqual(options(code, 'threadSize'), ['1/2 inch']);
  assert.equal(field(code, 'installationOption'), undefined);
  excludes(options(code, 'gaugeOptions'), [
    'Oil free / oxygen clean',
    'Refrigeration scale',
    'Retarded scale',
    'Internal overload stop',
    'Studs and bracket',
    'Nickel-plated block',
    'Snubber',
    'Female thread',
    'Stainless-steel movement in brass system',
    'No aluminium parts',
    'Blow-out back with baffle',
    'Red set pointer',
    'Zero adjuster',
  ], `${code} options`);
}
assert.deepEqual(options('PDBH', 'range'), ['-100 to 2 500 kPa']);
assert.deepEqual(product('PDBH Capsule').dialSizes, ['150 mm']);
assert.deepEqual(product('PDBH Capsule').diaphragmSizes, ['100 mm', '150 mm']);
assert.deepEqual(options('PDBH Capsule', 'range'), ['-4 to 40 kPa']);

for (const code of ['DBB', 'CBC']) {
  assert.ok(!options(code, 'fill').includes('Vibration-free movement'));
  excludes(options(code, 'installationOption'), ['Centre-back option - where applicable'], `${code} installation options`);
  excludes(options(code, 'gaugeOptions'), [
    'Oil free / oxygen clean',
    'Refrigeration scale',
    'Retarded scale',
    'Internal overload stop',
    'Studs and bracket',
    'Nickel-plated block',
    'Snubber',
    'Female thread',
    'Stainless-steel movement in brass system',
    'No aluminium parts',
    'Blow-out back with baffle',
    'Red set pointer',
    'Zero adjuster',
  ], `${code} optional features`);
}

for (const code of ['RPTKZ', 'RPT3', 'RPT4', 'RPT5', 'RPT7', 'RPT106', 'RPT102 / 103', 'RPT161', 'RPT162', 'RPT400 / 401']) {
  assert.equal(field(code, 'branding'), undefined, `${code} must not offer customer branding`);
}
assert.equal(product('RPTKZ').accuracy, '0.25% FSD');
assert.ok(options('RPTKZ', 'processConnection').every(connection => /1\/8|1\/4|3\/8|1\/2/.test(connection)));
assert.ok(options('RPT7', 'processConnection').includes('M20 x 1.5'));
assert.deepEqual(options('RPT161', 'range').at(-2), '0 to 100 kPa');
assert.deepEqual(options('RPT162', 'range').at(-2), '0 to 3.5 MPa');
assert.equal(options('RPT3', 'range', { processConnection: '1/2 inch flush' })[0], '0 to 6 bar');
assert.equal(options('RPT3', 'range', { processConnection: '1 inch flush' })[0], '0 to 1 bar');

const gaugeOptionField = field('PBB', 'gaugeOptions');
assert.deepEqual(toggleMultiChoiceOption(gaugeOptionField, ['Safety glass'], 'No optional feature required'), ['No optional feature required']);
assert.deepEqual(toggleMultiChoiceOption(gaugeOptionField, ['No optional feature required'], 'Safety glass'), ['Safety glass']);

console.log('Catalogue product-rule tests passed.');
