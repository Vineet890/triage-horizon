import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authenticate, requireRole } from '../middleware/auth.js';
import { emitToAll, getIO } from '../socket.js';

const router = express.Router();

const PATIENTS_PATH = fileURLToPath(
  new URL('../data/patients.json', import.meta.url)
);
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

// POST /api/handoff/prescription - DOCTOR only
router.post(
  '/prescription',
  authenticate,
  requireRole(['DOCTOR']),
  (req, res) => {
    const { patient_id, medications, instructions } = req.body ?? {};

    if (!patient_id || typeof patient_id !== 'string') {
      return res.status(400).json({ error: 'patient_id is required' });
    }

    if (!Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ error: 'medications must be a non-empty array' });
    }

    if (instructions !== undefined && typeof instructions !== 'string') {
      return res
        .status(400)
        .json({ error: 'instructions must be a string when provided' });
    }

    const prescriptionId = `RX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const payload = {
      prescription_id: prescriptionId,
      patient_id,
      medications,
      instructions: instructions ?? '',
      doctor_id: req.user.userId,
      sent_at: new Date().toISOString(),
      target_portal: 'PATIENT_PORTAL',
    };

    const io = getIO();
    if (io) {
      emitToAll(io, 'PRESCRIPTION_SENT', payload);
    }

    return res.status(200).json({
      prescription_id: prescriptionId,
      success: true,
    });
  }
);

// GET /api/handoff/:patientId - DOCTOR or ADMIN
router.get(
  '/:patientId',
  authenticate,
  requireRole(['DOCTOR', 'ADMIN']),
  (req, res) => {
    const patients = readJson(PATIENTS_PATH);
    const patient = patients.find((entry) => entry.id === req.params.patientId);

    if (!patient) {
      return res
        .status(404)
        .json({ error: `Unknown patient '${req.params.patientId}'` });
    }

    const demoResponses = readJson(DEMO_RESPONSES_PATH);
    const decision = demoResponses[patient.id] ?? null;
    const acuity = decision?.acuity ?? 'LOW';

    const handoff = {
      symptoms: decision?.symptom ? [decision.symptom] : patient.conditions,
      protocol_matched: decision?.protocol_matched ?? 'GEN-000: General Triage Protocol',
      acuity,
      special_flags: decision?.special_flags ?? [],
      recommended_actions: RECOMMENDED_ACTIONS[acuity] ?? RECOMMENDED_ACTIONS.LOW,
      generated_at: new Date().toISOString(),
    };

    return res.status(200).json({
      ...patient,
      handoff,
    });
  }
);

export default router;
