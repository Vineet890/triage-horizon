import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import facilityStateManager from '../services/facilityStateManager.js';

const PATIENTS_PATH = fileURLToPath(
  new URL('../data/patients.json', import.meta.url)
);

function readPatients() {
  const raw = fs.readFileSync(PATIENTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Reads patients.json and returns the matching patient, or null.
 */
export function getPatientHistory(patientId) {
  if (!patientId) {
    return null;
  }

  const patients = readPatients();
  return patients.find((patient) => patient.id === patientId) ?? null;
}

/**
 * Returns facilities that can currently accept patients, sorted by ETA.
 * Excludes OFFLINE facilities and those at >= 95% capacity, and optionally
 * requires a specialty.
 */
export function checkFacilityAvailability(requiredSpecialty) {
  const specialty =
    typeof requiredSpecialty === 'string'
      ? requiredSpecialty.trim().toLowerCase().replace(/\s+/g, '_')
      : '';

  return facilityStateManager
    .getAllStates()
    .filter((facility) => facility.status !== 'OFFLINE')
    .filter((facility) => facility.capacity_pct < 95)
    .filter((facility) => {
      if (!specialty) {
        return true;
      }

      const specialties = Array.isArray(facility.specialties)
        ? facility.specialties
        : [];

      return specialties.some((entry) => {
        const normalized = String(entry).toLowerCase().replace(/\s+/g, '_');
        return normalized === specialty || normalized.includes(specialty);
      });
    })
    .sort((a, b) => a.eta_min - b.eta_min);
}

/**
 * Creates a synthetic booking confirmation.
 */
export function bookAppointment(facilityId, patientId, careTier) {
  const bookingId = `TH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  return {
    status: 'confirmed',
    booking_id: bookingId,
    facility_id: facilityId,
    care_tier: careTier,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clinical protocol retrieval stub. Replaced by the RAG/ML service later.
 */
export function retrieveClinicalProtocol(symptom) {
  void symptom;
  return 'CARD-001: Cardiac protocol placeholder';
}
