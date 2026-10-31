import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { GROQ_API_KEY, GROQ_MODEL } from '../config.js';
import { retrieveProtocols } from './rag.js';
import { buildTriagePrompt, TRIAGE_SYSTEM_PROMPT } from './prompts.js';

const AgentState = Annotation.Root({
  symptom: Annotation(),
  patient_profile: Annotation(),
  retrieved_context: Annotation({ reducer: (_, value) => value, default: () => [] }),
  final_decision: Annotation(),
});

const ACUITIES = new Set(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']);
const PROTOCOL_CODES = new Set([
  'CARD-001',
  'DERM-001',
  'GEN-001',
  'GI-001',
  'NEURO-001',
  'PSY-001',
]);

function createModel() {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is required when USE_LIVE_LLM=true');
  }

  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: GROQ_MODEL,
    temperature: 0,
  });
}

function parseDecision(content) {
  const raw = typeof content === 'string' ? content : JSON.stringify(content);
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Triage model did not return a JSON object');

  const parsed = JSON.parse(json);
  if (
    typeof parsed.protocol_code !== 'string' ||
    !PROTOCOL_CODES.has(parsed.protocol_code) ||
    !ACUITIES.has(parsed.acuity)
  ) {
    throw new Error('Triage model returned an invalid protocol or acuity');
  }

  return {
    protocol_code: parsed.protocol_code,
    acuity: parsed.acuity,
    risk_modifiers: Array.isArray(parsed.risk_modifiers)
      ? parsed.risk_modifiers.slice(0, 20)
      : [],
    special_flags: Array.isArray(parsed.special_flags)
      ? parsed.special_flags.slice(0, 20)
      : [],
    evidence_summary: Array.isArray(parsed.evidence_summary)
      ? parsed.evidence_summary.slice(0, 20)
      : [],
  };
}

async function retrieveContext(state) {
  return { retrieved_context: await retrieveProtocols(state.symptom) };
}

async function analyzeAndPredict(state) {
  const model = createModel();
  const prompt = buildTriagePrompt({
    symptom: state.symptom,
    patientProfile: state.patient_profile,
    retrievedContext: state.retrieved_context,
  });
  const response = await model.invoke([
    new SystemMessage(TRIAGE_SYSTEM_PROMPT),
    new HumanMessage(prompt),
  ]);
  return { final_decision: parseDecision(response.content) };
}

function formatOutput(state) {
  return { final_decision: parseDecision(JSON.stringify(state.final_decision)) };
}

const graph = new StateGraph(AgentState)
  .addNode('retrieve_context', retrieveContext)
  .addNode('analyze_and_predict', analyzeAndPredict)
  .addNode('format_output', formatOutput)
  .addEdge(START, 'retrieve_context')
  .addEdge('retrieve_context', 'analyze_and_predict')
  .addEdge('analyze_and_predict', 'format_output')
  .addEdge('format_output', END)
  .compile();

export async function runTriageAgent({ symptom, patientProfile }) {
  if (typeof symptom !== 'string' || !symptom.trim()) {
    throw new Error('symptom is required');
  }

  const result = await graph.invoke({
    symptom: symptom.trim(),
    patient_profile: patientProfile ?? {},
  });
  return result.final_decision;
}

export default { runTriageAgent };
