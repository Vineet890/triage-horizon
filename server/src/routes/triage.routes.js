import express from 'express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { USE_LIVE_LLM } from '../config.js';
import { emitToAll, getIO } from '../socket.js';

const router = express.Router();

const DEMO_RESPONSES_PATH = fileURLToPath(
  new URL('../data/demoResponses.json', import.meta.url)
);

function readDemoResponses() {
  const raw = fs.readFileSync(DEMO_RESPONSES_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * POST /api/triage/submit
 * Mock mode (USE_LIVE_LLM=false) returns the pre-written routing decision for
 * the patient. Live mode is not wired to an LLM yet.
 */
router.post('/submit', (req, res) => {
  const { patient_id, symptom_text } = req.body ?? {};

  if (!patient_id || typeof patient_id !== 'string') {
    return res.status(400).json({ error: 'patient_id is required' });
  }

  if (!symptom_text || typeof symptom_text !== 'string' || !symptom_text.trim()) {
    return res.status(400).json({ error: 'symptom_text is required' });
  }

  if (USE_LIVE_LLM) {
    return res.status(501).json({
      error: 'Live LLM mode is enabled but not implemented yet',
      use_live_llm: true,
    });
  }

  const decision = readDemoResponses()[patient_id];

  if (!decision) {
    return res
      .status(404)
      .json({ error: `No demo routing decision for patient '${patient_id}'` });
  }

  console.log(
    `[triage] mock decision for ${patient_id} (${decision.acuity}/${decision.care_tier}); symptom: ${symptom_text.trim()}`
  );

  const io = getIO();
  if (io) {
    emitToAll(io, 'TRIAGE_COMPLETE', decision);
  }

  return res.status(200).json(decision);
});

export default router;
