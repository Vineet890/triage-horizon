import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Patient from '../models/Patient.js';
import { isDatabaseConnected } from '../config/db.js';
import { findUserById } from './userStore.js';

const PATIENTS_PATH = fileURLToPath(
  new URL('../data/patients.json', import.meta.url)
);

function readSeededPatients() {
  try {
    return JSON.parse(fs.readFileSync(PATIENTS_PATH, 'utf-8'));
  } catch (error) {
    console.error(
      '[patientProfile] could not read patients.json:',
      error.message
    );
    return [];
  }
}

/**
 * Resolves the clinical profile used by triage and handoff.
 *
 * MongoDB is the base record, but operational fields added to the seeded file
 * (notably `adherence`, which is not part of the persisted Patient schema) are
 * overlaid so the deterministic engine sees the same risk data the demo
 * intends. Registered patients get a minimal synthetic profile.
 */
export async function loadPatientProfile(patientId, fallbackName = '') {
  if (!patientId) return null;

  const seeded = readSeededPatients().find(
    (patient) => patient.id === patientId
  );

  if (isDatabaseConnected()) {
    try {
      const patient = await Patient.findOne({ id: patientId }).lean();

      if (patient) {
        return {
          ...seeded,
          ...patient,
          adherence: patient.adherence ?? seeded?.adherence ?? null,
        };
      }
    } catch (error) {
      console.error(
        `[patientProfile] MongoDB lookup failed for '${patientId}':`,
        error.message
      );
    }
  }

  if (seeded) return seeded;

  const account = await findUserById(patientId);

  return {
    id: patientId,
    display_id: `TH-P-${String(patientId).slice(-4).toUpperCase()}`,
    name: account?.name || fallbackName || 'Patient',
    age: null,
    gender: '',
    blood_type: '',
    allergies: [],
    conditions: [],
    medications: [],
    previous_visits: [],
    adherence: null,
    is_synthetic: true,
  };
}

export default { loadPatientProfile };
