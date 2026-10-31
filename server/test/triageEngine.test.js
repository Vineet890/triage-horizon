import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateTriage, scoreAcuity } from '../src/services/triageEngine.js';

const patient = {
  id: 'synthetic_patient',
  name: 'Synthetic Patient',
  age: 30,
  allergies: [],
  conditions: [],
  medications: [],
  adherence: null,
};

test('maps routine and mild symptoms to Standard', () => {
  assert.equal(scoreAcuity('routine checkup, no symptoms'), 'LOW');
  assert.equal(scoreAcuity('mild headache'), 'LOW');
  assert.equal(scoreAcuity('mild fever, temperature 37.5 C'), 'LOW');
});

test('does not let normal wording suppress additional symptoms', () => {
  assert.equal(scoreAcuity('no symptoms, but headache with nausea'), 'MODERATE');
  assert.equal(scoreAcuity('mild headache with vomiting'), 'MODERATE');
});

test('escalates stable symptoms to Urgent and severe symptoms to Very urgent', () => {
  assert.equal(scoreAcuity('headache'), 'LOW');
  assert.equal(scoreAcuity('headache since this morning'), 'LOW');
  assert.equal(scoreAcuity('headache with nausea'), 'MODERATE');
  assert.equal(scoreAcuity('migraine'), 'MODERATE');
  assert.equal(scoreAcuity('severe headache, worst ever'), 'HIGH');
  assert.equal(scoreAcuity('fever, temperature 39.5 C'), 'HIGH');
  assert.equal(scoreAcuity('fever, temperature 102.2 F'), 'HIGH');
});

test('keeps an uncomplicated headache Standard when Groq suggests Urgent', () => {
  const decision = evaluateTriage({
    patient,
    symptom: 'headache',
    modelDecision: { protocol_code: 'NEURO-001', acuity: 'MODERATE' },
  });

  assert.equal(decision.acuity, 'LOW');
  assert.equal(decision.care_tier, 'telehealth');
});

test('keeps immediate red flags at the highest acuity', () => {
  assert.equal(scoreAcuity('chest pain with sweating'), 'CRITICAL');
  assert.equal(scoreAcuity('sudden facial droop and slurred speech'), 'CRITICAL');
  assert.equal(
    scoreAcuity('unconscious and not responding'),
    'CRITICAL'
  );
});

test('uses the live protocol for routing and never downgrades a red flag', () => {
  const dermatology = evaluateTriage({
    patient,
    symptom: 'itchy rash on my arms',
    modelDecision: { protocol_code: 'DERM-001', acuity: 'MODERATE' },
  });
  assert.equal(dermatology.protocol_matched, 'DERM-001: Dermatology Protocol');
  assert.equal(dermatology.selected_facility?.id, 'facility_004');

  const critical = evaluateTriage({
    patient,
    symptom: 'chest pain with sweating',
    modelDecision: { protocol_code: 'GEN-001', acuity: 'LOW' },
  });
  assert.equal(critical.acuity, 'CRITICAL');
  assert.equal(critical.care_tier, 'emergency');
});
