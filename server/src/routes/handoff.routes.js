import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authenticate, requireRole } from '../middleware/auth.js';
import { loadPatientProfile } from '../services/patientProfile.js';
import { findUserById } from '../services/userStore.js';
import {
  findActiveByPatient,
  findLatestByPatient,
  getEncounter,
} from '../services/encounterStore.js';
import { prescribeEncounter } from '../services/encounterService.js';
import {
  emitEncounterUpdated,
  emitToPatient,
  getIO,
} from '../socket.js';

const router = express.Router();

const DEMO_RESPONSES_PATH = fileURLToPath(
  new URL('../data/demoResponses.json', import.meta.url)
);

const RECOMMENDED_ACTIONS = {
  CRITICAL: [
    'Pre-notify the receiving emergency department',
    'Confirm anticoagulation status and reversal plan',
    'Prepare ICU bed and specialist team',
  ],
  HIGH: [
    'Arrange urgent specialist assessment',
    'Start continuous monitoring on arrival',
    'Escalate immediately if symptoms worsen',
  ],
  MODERATE: [
    'Book a same-day appointment at the selected facility',
    'Review current medications and allergies',
    'Reassess after initial treatment',
  ],
  LOW: [
    'Start the telehealth consultation',
    'Provide self-care and red-flag advice',
    'Schedule follow-up if symptoms persist',
  ],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * POST /api/handoff/prescription - DOCTOR only
 *
 * Legacy alias retained for the physician workspace. When the patient has a
 * shared encounter (the normal path) the prescription is written to that
 * encounter and the full closed loop runs. When no encounter exists the old
 * targeted notification is still delivered so nothing regresses.
 */
router.post(
  '/prescription',
  authenticate,
  requireRole(['DOCTOR']),
  async (req, res) => {
    const { patient_id, encounter_id, medications, instructions } =
      req.body ?? {};

    if (!Array.isArray(medications) || medications.length === 0) {
      return res
        .status(400)
        .json({ error: 'medications must be a non-empty array' });
    }

    if (instructions !== undefined && typeof instructions !== 'string') {
      return res
        .status(400)
        .json({ error: 'instructions must be a string when provided' });
    }

    const encounter = encounter_id
      ? await getEncounter(encounter_id)
      : patient_id
        ? await findActiveByPatient(patient_id)
        : null;

    if (encounter) {
      if (patient_id && encounter.patient_id !== patient_id) {
        return res
          .status(409)
          .json({ error: 'The encounter does not belong to this patient.' });
      }

      const account = await findUserById(req.user.userId);
      const result = await prescribeEncounter({
        encounterId: encounter.id,
        doctorId: req.user.userId,
        doctorName: account?.name || 'Attending clinician',
        medications,
        instructions: instructions ?? '',
      });

      if (result.error) {
        return res
          .status(result.statusCode ?? 400)
          .json({ error: result.error });
      }

      const io = getIO();
      if (io) {
        emitToPatient(io, result.encounter.patient_id, 'PRESCRIPTION_SENT', {
          encounter_id: result.encounter.id,
          patient_id: result.encounter.patient_id,
          prescription_id: result.prescription.prescription_id,
          prescription: result.prescription,
          medications: result.prescription.medications,
          instructions: result.prescription.instructions,
          doctor_id: result.prescription.doctor_id,
          doctor_name: result.prescription.doctor_name,
          sent_at: result.prescription.sent_at,
        });
        emitEncounterUpdated(io, result.encounter);
      }

      return res.status(200).json({
        success: true,
        encounter_id: result.encounter.id,
        prescription_id: result.prescription.prescription_id,
        prescription: result.prescription,
        encounter: result.encounter,
      });
    }

    if (!patient_id || typeof patient_id !== 'string') {
      return res.status(400).json({
        error: 'patient_id or encounter_id is required',
      });
    }

    const prescriptionId = `RX-${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;

    const payload = {
      prescription_id: prescriptionId,
      patient_id,
      medications,
      instructions: instructions ?? '',
      doctor_id: req.user.userId,
      sent_at: new Date().toISOString(),
      target_portal: 'PATIENT_PORTAL',
      legacy: true,
    };

    const io = getIO();
    if (io) {
      emitToPatient(io, patient_id, 'PRESCRIPTION_SENT', payload);
    }

    return res.status(200).json({
      prescription_id: prescriptionId,
      success: true,
      legacy: true,
    });
  }
);

// GET /api/handoff/:patientId - DOCTOR or ADMIN
router.get(
  '/:patientId',
  authenticate,
  requireRole(['DOCTOR', 'ADMIN']),
  async (req, res) => {
    try {
      const patient = await loadPatientProfile(req.params.patientId);

      if (!patient) {
        return res
          .status(404)
          .json({ error: `Unknown patient '${req.params.patientId}'` });
      }

      // Prefer the shared encounter over the demo fixture: it is the source of
      // truth for acuity, routing, risk modifiers and the prescription.
      const encounter =
        (await findActiveByPatient(patient.id)) ??
        (await findLatestByPatient(patient.id));

      const demoResponses = readJson(DEMO_RESPONSES_PATH);
      const fixture = demoResponses[patient.id] ?? null;

      const acuity = encounter?.acuity ?? fixture?.acuity ?? 'LOW';
      const symptom = encounter?.symptom ?? fixture?.symptom ?? null;

      const handoff = {
        encounter_id: encounter?.id ?? null,
        encounter: encounter ?? null,
        status: encounter?.status ?? null,
        care_tier: encounter?.care_tier ?? fixture?.care_tier ?? null,
        symptoms: symptom ? [symptom] : patient.conditions,
        protocol_matched:
          encounter?.protocol_matched ??
          fixture?.protocol_matched ??
          'GEN-000: General Triage Protocol',
        acuity,
        special_flags: encounter?.special_flags ?? fixture?.special_flags ?? [],
        risk_modifiers: encounter?.risk_modifiers ?? [],
        agent_rationale: encounter?.agent_rationale ?? [],
        agent_trace: encounter?.agent_trace ?? [],
        timeline: encounter?.timeline ?? [],
        assigned_doctor_id: encounter?.assigned_doctor_id ?? null,
        assigned_doctor_name: encounter?.assigned_doctor_name ?? null,
        prescription: encounter?.prescription ?? null,
        recommended_actions:
          RECOMMENDED_ACTIONS[acuity] ?? RECOMMENDED_ACTIONS.LOW,
        generated_at: new Date().toISOString(),
      };

      return res.status(200).json({
        ...patient,
        handoff,
      });
    } catch (error) {
      console.error(
        `[handoff] Failed to load patient '${req.params.patientId}':`,
        error.message
      );
      return res.status(500).json({ error: 'Failed to load patient record' });
    }
  }
);

export default router;
