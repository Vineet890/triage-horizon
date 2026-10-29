import express from 'express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { USE_LIVE_LLM } from '../config.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { loadPatientProfile } from '../services/patientProfile.js';
import {
  closeActiveForPatient,
  createEncounter,
} from '../services/encounterStore.js';
import { evaluateTriage } from '../services/triageEngine.js';
import { getIO } from '../socket.js';

const router = express.Router();

const DEMO_RESPONSES_PATH = fileURLToPath(
  new URL('../data/demoResponses.json', import.meta.url)
);

const PATIENTS_PATH = fileURLToPath(
  new URL('../data/patients.json', import.meta.url)
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function buildEncounterPayload({ patient, decision, source }) {
  const timestamp = new Date().toISOString();
  const facility = decision.selected_facility ?? null;

  return {
    patient_id: patient.id,
    patient_name: patient.name,
    symptom: decision.symptom,
    acuity: decision.acuity,
    care_tier: decision.care_tier,
    status: 'TRIAGED',
    facility_id: facility?.id ?? null,
    facility_name: facility?.name ?? null,
    facility_snapshot: facility,
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    protocol_matched: decision.protocol_matched,
    agent_rationale: decision.agent_rationale,
    agent_trace: decision.agent_trace,
    timeline: [
      {
        timestamp,
        actor: patient.name || patient.id,
        action: 'Submitted symptom intake',
      },
      {
        timestamp,
        actor: 'Triage Agent',
        action: `Triaged ${decision.acuity} · ${decision.protocol_matched}`,
      },
    ],
    prescription: null,
    risk_modifiers: decision.risk_modifiers,
    special_flags: decision.special_flags,
    selected_facility: facility,
    rejected_facilities: decision.rejected_facilities,
    route_update: null,
    source,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function emitAgentThinking(io, encounter) {
  if (!io || !encounter?.agent_trace?.length) return;

  const payload = {
    encounter_id: encounter.id,
    patient_id: encounter.patient_id,
    status: encounter.status,
    steps: encounter.agent_trace,
    emitted_at: new Date().toISOString(),
  };

  io.to(`patient:${encounter.patient_id}`)
    .to('role:DOCTOR')
    .to('role:ADMIN')
    .emit('AGENT_THINKING', payload);
}

function emitEncounter(io, encounter) {
  if (!io) return;

  io.to(`patient:${encounter.patient_id}`)
    .to('role:DOCTOR')
    .to('role:ADMIN')
    .emit('ENCOUNTER_UPDATED', {
      ...encounter,
      encounter_id: encounter.id,
      encounter,
    });
}

function emitLegacyTriage(io, encounter) {
  if (!io) return;

  const payload = {
    ...encounter,
    encounter_id: encounter.id,
    patient_id: encounter.patient_id,
    selected_facility: encounter.selected_facility,
    rejected_facilities: encounter.rejected_facilities,
    received_at: encounter.created_at,
  };

  io.to('role:DOCTOR').to('role:ADMIN').emit('TRIAGE_COMPLETE', payload);
}

async function submitForPatient({ patientId, fallbackName, symptom, source }) {
  const patient = await loadPatientProfile(patientId, fallbackName);
  const decision = evaluateTriage({ patient, symptom });

  const closedEncounters = await closeActiveForPatient(
    patient.id,
    patient.name || patient.id,
    'Superseded by a new intake'
  );

  const encounter = await createEncounter(
    buildEncounterPayload({ patient, decision, source })
  );

  return { patient, decision, encounter, closedEncounters };
}

/**
 * POST /api/triage/submit
 * The patient identity is derived from the JWT. Mock mode uses the
 * deterministic engine; live mode is not wired to an LLM yet.
 */
router.post(
  '/submit',
  authenticate,
  requireRole(['PATIENT']),
  async (req, res) => {
    const { symptom_text } = req.body ?? {};

    if (
      !symptom_text ||
      typeof symptom_text !== 'string' ||
      !symptom_text.trim()
    ) {
      return res.status(400).json({ error: 'symptom_text is required' });
    }

    if (USE_LIVE_LLM) {
      return res.status(501).json({
        error: 'Live LLM mode is enabled but not implemented yet',
        use_live_llm: true,
      });
    }

    try {
      const { decision, encounter, closedEncounters } = await submitForPatient({
        patientId: req.user.userId,
        symptom: symptom_text.trim(),
        source: 'live',
      });

      const io = getIO();
      for (const closed of closedEncounters) emitEncounter(io, closed);
      emitAgentThinking(io, encounter);
      emitEncounter(io, encounter);
      emitLegacyTriage(io, encounter);

      console.log(
        `[triage] ${encounter.patient_id} -> ${encounter.acuity}/${encounter.care_tier} · ${encounter.facility_name ?? 'no facility'} (${encounter.id})`
      );

      return res.status(200).json({
        ...decision,
        encounter_id: encounter.id,
        encounter,
        status: encounter.status,
        timeline: encounter.timeline,
        assigned_doctor_id: encounter.assigned_doctor_id,
        assigned_doctor_name: encounter.assigned_doctor_name,
      });
    } catch (error) {
      console.error('[triage] submit failed:', error);
      return res.status(500).json({ error: 'Unable to complete triage.' });
    }
  }
);

/**
 * POST /api/triage/demo-seed
 * Staff-only queue seeding. Replaces the old doctor-portal call to
 * /triage/submit, which now requires a PATIENT token.
 */
router.post(
  '/demo-seed',
  authenticate,
  requireRole(['DOCTOR', 'ADMIN']),
  async (req, res) => {
    try {
      const demoResponses = readJson(DEMO_RESPONSES_PATH);
      const patients = readJson(PATIENTS_PATH);
      const encounters = [];
      const closedEncounters = [];

      for (const patient of patients) {
        const fixture = demoResponses[patient.id];
        const symptom =
          fixture?.symptom ??
          'Routine follow-up requested by the clinical coordination team.';

        const result = await submitForPatient({
          patientId: patient.id,
          fallbackName: patient.name,
          symptom,
          source: 'demo',
        });

        encounters.push(result.encounter);
        closedEncounters.push(...(result.closedEncounters ?? []));
      }

      const io = getIO();
      for (const closed of closedEncounters) emitEncounter(io, closed);
      for (const encounter of encounters) {
        emitAgentThinking(io, encounter);
        emitEncounter(io, encounter);
        emitLegacyTriage(io, encounter);
      }

      return res.status(200).json({
        success: true,
        count: encounters.length,
        encounters,
      });
    } catch (error) {
      console.error('[triage] demo seed failed:', error);
      return res.status(500).json({ error: 'Unable to seed the demo queue.' });
    }
  }
);

export default router;
