import assert from 'node:assert/strict';
import {
  LAB_METHOD_IDS,
  assertLabTransition,
  calculateCorrection,
  calculateIndicationError,
  calculateLaboratoryWorksheet,
  calculateMeanReading,
  calculateRepeatabilityStandardDeviation,
  calculateStandardError,
  calculateUncertaintyBudget,
  createLaboratoryWorkflow,
  labTurnaround,
  validStandardsForWorksheet,
} from '../src/domain/laboratoryCalibration.js';

assert.equal(calculateMeanReading([1, 2, 3]), 2);
assert.equal(calculateIndicationError({ measured: 10.02, applied: 10 }), 0.019999999999999574);
assert.equal(calculateCorrection({ measured: 10.02, applied: 10 }), -0.019999999999999574);
assert.equal(calculateRepeatabilityStandardDeviation([1, 2, 3]), 1);
assert.equal(Number(calculateStandardError([1, 2, 3]).toFixed(6)), 0.57735);

const budget = calculateUncertaintyBudget({
  contributions: [
    { source: 'Fabricated standard', uncertainty: 0.1, divisor: 2, sensitivity: 1, degreesOfFreedom: 200 },
    { source: 'Fabricated resolution', uncertainty: 0.1, divisor: Math.sqrt(3), sensitivity: 1, degreesOfFreedom: 12 },
  ],
  coverageFactor: 2,
});
assert.ok(budget.combinedUncertainty > 0);
assert.ok(Math.abs(budget.expandedUncertainty - budget.combinedUncertainty * 2) < 0.00000002);
assert.ok(budget.effectiveDegreesOfFreedom > 0);

const worksheet = calculateLaboratoryWorksheet({
  methodId: LAB_METHOD_IDS.PRESSURE_MASTER_GAUGE,
  decimals: 5,
  rangeMaximum: 10,
  testPoints: [{ applied: 5, standardCorrection: 0, direction: 'increasing', readings: [5.01, 5, 5.01] }],
  uncertaintyContributions: [{ source: 'Fabricated standard', uncertainty: 0.04, divisor: 2, sensitivity: 1, degreesOfFreedom: 200 }],
  coverageFactor: 2,
});
assert.equal(worksheet.points.length, 1);
assert.equal(worksheet.points[0].mean, 5.00667);
assert.ok(worksheet.warnings.length > 0, 'unapproved legacy dependencies must remain visible as warnings');

assert.ok(validStandardsForWorksheet({ branchId: 'cape_town', methodId: LAB_METHOD_IDS.PRESSURE_MASTER_GAUGE, minimum: 0, maximum: 10, asOf: '2026-08-03' }).length > 0);
assert.equal(validStandardsForWorksheet({ branchId: 'johannesburg', methodId: LAB_METHOD_IDS.TEMPERATURE_COMPARISON, minimum: -20, maximum: 100, asOf: '2026-08-03' }).length, 0);
assert.equal(assertLabTransition('awaiting_lab_receipt', 'receive'), 'received_in_lab');
assert.throws(() => assertLabTransition('awaiting_lab_receipt', 'calculate'), /current stage/i);
assert.equal(createLaboratoryWorkflow().status, 'awaiting_lab_receipt');
assert.deepEqual(labTurnaround('2026-08-01T08:00:00Z', '2026-08-03T20:00:00Z'), { hours: 60, days: 2.5 });

console.log('Laboratory calculations, method separation, standards and transition tests passed.');
