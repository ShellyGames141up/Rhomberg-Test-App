import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductConfiguration } from '../src/repositories/postgresRepository.js';

const product = {
  configuration_schema: [
    { key: 'range', type: 'select', required: true, options: ['0 to 10 bar', 'Custom range - sales review'] },
    { key: 'customRange', type: 'text', required: true, showWhen: { key: 'range', value: 'Custom range - sales review' } },
    { key: 'dialSize', type: 'choice', required: true, options: ['63 mm', '100 mm'] },
    { key: 'internalContacts', type: 'choice', required: true, options: ['No internal contacts', 'Single internal contact'], showWhen: { key: 'dialSize', value: '100 mm' } },
    { key: 'gaugeOptions', type: 'multiChoice', required: true, options: ['No optional feature required', 'Safety glass'] },
  ],
};

test('standard ranges do not require the hidden customRange field', () => {
  assert.doesNotThrow(() => assertProductConfiguration(product, {
    range: '0 to 10 bar',
    dialSize: '63 mm',
    gaugeOptions: ['No optional feature required'],
  }));
});

test('custom ranges and visible conditional fields remain mandatory', () => {
  assert.throws(
    () => assertProductConfiguration(product, { range: 'Custom range - sales review', dialSize: '63 mm', gaugeOptions: ['Safety glass'] }),
    error => error.code === 'INVALID_PRODUCT_CONFIGURATION' && /customRange/.test(error.message),
  );
  assert.throws(
    () => assertProductConfiguration(product, { range: '0 to 10 bar', dialSize: '100 mm', gaugeOptions: ['Safety glass'] }),
    error => error.code === 'INVALID_PRODUCT_CONFIGURATION' && /internalContacts/.test(error.message),
  );
});

test('approved multi-choice values are validated without rejecting the array itself', () => {
  assert.doesNotThrow(() => assertProductConfiguration(product, {
    range: 'Custom range - sales review',
    customRange: '-1 to 15 bar',
    dialSize: '100 mm',
    internalContacts: 'No internal contacts',
    gaugeOptions: ['Safety glass'],
  }));
  assert.throws(
    () => assertProductConfiguration(product, {
      range: '0 to 10 bar', dialSize: '63 mm', gaugeOptions: ['Unapproved option'],
    }),
    error => error.code === 'INVALID_PRODUCT_CONFIGURATION' && /gaugeOptions/.test(error.message),
  );
});
