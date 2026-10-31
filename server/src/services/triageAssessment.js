import { runTriageAgent } from '../agent/graph.js';
import { evaluateTriage } from './triageEngine.js';

const LIVE_MODEL_FALLBACK_MESSAGE =
  'Live triage model unavailable; deterministic assessment used.';

export async function assessPatientSymptoms({
  patient,
  symptom,
  useLiveModel = false,
  liveModelRunner = runTriageAgent,
}) {
  let modelDecision = null;
  let modelFallback = false;

  if (useLiveModel) {
    try {
      modelDecision = await liveModelRunner({
        symptom,
        patientProfile: {
          age: patient?.age ?? null,
          allergies: Array.isArray(patient?.allergies)
            ? patient.allergies
                .filter((item) => typeof item === 'string')
                .slice(0, 20)
            : [],
          conditions: Array.isArray(patient?.conditions)
            ? patient.conditions
                .filter((item) => typeof item === 'string')
                .slice(0, 20)
            : [],
          medications: Array.isArray(patient?.medications)
            ? patient.medications
                .slice(0, 20)
                .map((item) =>
                  typeof item === 'string'
                    ? item
                    : typeof item?.name === 'string'
                      ? item.name
                      : ''
                )
                .filter(Boolean)
            : [],
        },
      });
    } catch (error) {
      modelFallback = true;
      console.error(
        '[triage] Live model failed; deterministic assessment will be used:',
        error
      );
    }
  }

  const decision = evaluateTriage({ patient, symptom, modelDecision });

  if (modelFallback) {
    decision.model_fallback = true;
    decision.agent_rationale.push(LIVE_MODEL_FALLBACK_MESSAGE);
    decision.agent_trace.push({
      timestamp: new Date().toISOString(),
      tool: 'LIVE_ML_TRIAGE',
      detail: LIVE_MODEL_FALLBACK_MESSAGE,
      status: 'warning',
    });
  }

  return { decision, modelFallback };
}

export default { assessPatientSymptoms };
