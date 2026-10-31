import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPatientSymptoms } from '../src/services/triageAssessment.js';

test('live model failure falls back to deterministic triage and records a warning', async () => {
  const patient = {
    id: 'temporary-test-patient',
    name: 'Temporary Test Patient',
    conditions: [],
    medications: [],
    allergies: [],
  };
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const result = await assessPatientSymptoms({
      patient,
      symptom: 'headache',
      useLiveModel: true,
      liveModelRunner: async () => {
        throw new Error('simulated model outage');
      },
    });

    assert.equal(result.modelFallback, true);
    assert.equal(result.decision.model_fallback, true);
    assert.equal(result.decision.acuity, 'LOW');
    assert.ok(
      result.decision.agent_trace.some(
        (step) => step.tool === 'LIVE_ML_TRIAGE' && step.status === 'warning'
      )
    );
    assert.ok(
      result.decision.agent_rationale.some((item) =>
        item.includes('deterministic assessment used')
      )
    );
  } finally {
    console.error = originalConsoleError;
  }
});
