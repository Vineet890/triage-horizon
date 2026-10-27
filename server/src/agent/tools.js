import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import facilityStateManager from '../services/facilityStateManager.js';

const PATIENTS_PATH = fileURLToPath(
  new URL('../data/patients.json', import.meta.url)
);

const MENTAL_HEALTH_CONDITION_TERMS = [
  'anxiety',
  'anxious',
  'depression',
  'depressive',
  'bipolar',
  'ptsd',
  'post-traumatic',
  'ocd',
  'panic',
  'schizo',
  'mental health',
  'mood disorder',
];

const MENTAL_HEALTH_SYMPTOM_TERMS = [
  'anxiety',
  'anxious',
  'panic',
  'depress',
  'hopeless',
  'suicidal',
  'self-harm',
  'self harm',
  'mood',
  'overwhelmed',
  'mental health',
];

const CHRONIC_CONDITION_TERMS = [
  'asthma',
  'copd',
  'diabetes',
  'hypertension',
  'atrial fibrillation',
  'heart failure',
  'coronary',
  'chronic',
  'epilepsy',
  'arthritis',
  'kidney disease',
  'ckd',
  'gerd',
  'reflux',
  'thyroid',
  'lupus',
  'crohn',
  'ulcerative colitis',
];

function readPatients() {
  const raw = fs.readFileSync(PATIENTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).toLowerCase());
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function matchesAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function hasAdherenceRecord(patient) {
  const adherence = patient?.adherence;

  if (!adherence || typeof adherence !== 'object') {
    return false;
  }

  return [
    'last_7_days_pct',
    'seven_day_pct',
    'adherence_pct',
    'last_refill_days',
    'missed_doses_7d',
  ].some((key) => Number.isFinite(Number(adherence[key])));
}

function adherencePercentage(patient) {
  const adherence = patient?.adherence ?? {};

  const direct = [
    adherence.last_7_days_pct,
    adherence.seven_day_pct,
    adherence.adherence_pct,
  ].find((value) => Number.isFinite(Number(value)));

  if (direct !== undefined) {
    return Math.max(0, Math.min(100, Number(direct)));
  }

  return null;
}

/**
 * Reads patients.json and returns the matching patient, or null.
 * Registered patients who are not part of the seeded demo return null and are
 * handled by the caller with a minimal synthetic profile.
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
 * Adherence is a first-class triage modifier.
 *
 * A patient with a chronic condition and no recorded adherence history is
 * treated as HIGH risk because the engine cannot rule out untreated disease.
 * This is deliberately conservative and is surfaced to the physician as an
 * explicit risk modifier rather than hidden inside the model.
 */
export function evaluateAdherenceRisk(patient) {
  const conditions = normalizeList(patient?.conditions);
  const chronicConditions = conditions.filter((condition) =>
    matchesAny(condition, CHRONIC_CONDITION_TERMS)
  );
  const adherence = patient?.adherence ?? null;
  const recorded = hasAdherenceRecord(patient);
  const percentage = adherencePercentage(patient);

  if (chronicConditions.length > 0 && !recorded) {
    return {
      risk: 'HIGH',
      acuity_escalation: true,
      recorded: false,
      percentage: null,
      chronic_conditions: chronicConditions,
      detail: `No adherence data on file for ${chronicConditions.join(
        ', '
      )}. Treat as uncontrolled until verified.`,
    };
  }

  if (recorded && percentage !== null && percentage < 70) {
    return {
      risk: 'MODERATE',
      acuity_escalation: false,
      recorded: true,
      percentage,
      chronic_conditions: chronicConditions,
      detail: `Recorded 7-day adherence is ${percentage}% (below the 70% safety threshold).`,
    };
  }

  if (recorded) {
    return {
      risk: 'LOW',
      acuity_escalation: false,
      recorded: true,
      percentage,
      chronic_conditions: chronicConditions,
      detail:
        percentage !== null
          ? `Recorded 7-day adherence is ${percentage}%.`
          : 'Adherence data is on file and no gap was detected.',
    };
  }

  return {
    risk: 'LOW',
    acuity_escalation: false,
    recorded: false,
    percentage: null,
    chronic_conditions: chronicConditions,
    detail:
      chronicConditions.length === 0
        ? 'No chronic condition requiring adherence monitoring.'
        : 'No adherence gap detected.',
  };
}

/**
 * Mental-health context changes the destination, not just the label.
 * Anxiety/depression flags recommend a telehealth pathway delivered by a
 * mental-health clinic when the presentation is primarily psychological.
 */
export function evaluateMentalHealthContext(patient, symptom) {
  const conditions = normalizeList(patient?.conditions);
  const text = String(symptom ?? '').toLowerCase();

  const conditionFlags = conditions.filter((condition) =>
    matchesAny(condition, MENTAL_HEALTH_CONDITION_TERMS)
  );
  const symptomFlags = MENTAL_HEALTH_SYMPTOM_TERMS.filter((term) =>
    text.includes(term)
  );

  const flags = Array.from(new Set([...conditionFlags, ...symptomFlags]));

  if (flags.length === 0) {
    return {
      has_context: false,
      recommended_care_tier: null,
      facility_type: null,
      flags: [],
      detail: 'No mental-health flags detected.',
    };
  }

  return {
    has_context: true,
    recommended_care_tier: 'telehealth',
    facility_type: 'mental_health_clinic',
    flags,
    detail: `Mental-health context detected (${flags.join(
      ', '
    )}); telehealth is the least restrictive safe pathway.`,
  };
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

export default {
  bookAppointment,
  checkFacilityAvailability,
  evaluateAdherenceRisk,
  evaluateMentalHealthContext,
  getPatientHistory,
  retrieveClinicalProtocol,
};
