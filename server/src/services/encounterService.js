import crypto from 'node:crypto';
import {
  getEncounter,
  updateEncounter,
} from './encounterStore.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeMedications(medications) {
  if (!Array.isArray(medications) || medications.length === 0) {
    return null;
  }

  const normalized = medications
    .map((medication) => {
      if (typeof medication === 'string') {
        return {
          name: medication.trim(),
          dosage: '',
          schedule: '',
          note: '',
        };
      }

      if (!medication || typeof medication !== 'object') {
        return null;
      }

      const name = String(medication.name ?? '').trim();

      if (!name) return null;

      return {
        name,
        dosage: String(medication.dosage ?? medication.dose ?? '').trim(),
        schedule: String(
          medication.schedule ?? medication.frequency ?? ''
        ).trim(),
        note: String(medication.note ?? medication.instructions ?? '').trim(),
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : null;
}

export async function acceptEncounter({
  encounterId,
  doctorId,
  doctorName,
}) {
  const encounter = await getEncounter(encounterId);

  if (!encounter) {
    return { statusCode: 404, error: `Unknown encounter '${encounterId}'` };
  }

  if (encounter.status === 'CLOSED') {
    return { statusCode: 409, error: 'This encounter is already closed.' };
  }

  if (
    encounter.assigned_doctor_id &&
    encounter.assigned_doctor_id !== doctorId
  ) {
    return {
      statusCode: 409,
      error: `This encounter is already assigned to ${encounter.assigned_doctor_name || 'another clinician'}.`,
    };
  }

  const alreadyAccepted =
    encounter.assigned_doctor_id === doctorId &&
    ['ACCEPTED', 'EN_ROUTE'].includes(encounter.status);

  if (alreadyAccepted) {
    return { encounter };
  }

  const timestamp = nowIso();

  const updated = await updateEncounter(encounter.id, {
    status: 'ACCEPTED',
    assigned_doctor_id: doctorId,
    assigned_doctor_name: doctorName,
    timeline: [
      ...encounter.timeline,
      {
        timestamp,
        actor: doctorName,
        action: 'Accepted the case and requested a receiving bed',
      },
    ],
  });

  return { encounter: updated };
}

export async function prescribeEncounter({
  encounterId,
  doctorId,
  doctorName,
  medications,
  instructions = '',
}) {
  const encounter = await getEncounter(encounterId);

  if (!encounter) {
    return { statusCode: 404, error: `Unknown encounter '${encounterId}'` };
  }

  if (encounter.status === 'CLOSED') {
    return { statusCode: 409, error: 'This encounter is already closed.' };
  }

  if (encounter.assigned_doctor_id !== doctorId) {
    return {
      statusCode: 409,
      error: 'Accept the encounter before issuing a prescription.',
    };
  }

  const normalized = normalizeMedications(medications);

  if (!normalized) {
    return {
      statusCode: 400,
      error: 'medications must be a non-empty array with at least one name.',
    };
  }

  if (typeof instructions !== 'string') {
    return { statusCode: 400, error: 'instructions must be a string.' };
  }

  const prescription = {
    prescription_id: `RX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    medications: normalized,
    instructions: instructions.trim(),
    doctor_id: doctorId,
    doctor_name: doctorName,
    sent_at: nowIso(),
  };

  const nextStatus = encounter.status === 'ACCEPTED' ? 'EN_ROUTE' : encounter.status;

  const updated = await updateEncounter(encounter.id, {
    status: nextStatus,
    prescription,
    timeline: [
      ...encounter.timeline,
      {
        timestamp: prescription.sent_at,
        actor: doctorName,
        action: `Prescribed ${normalized
          .map((medication) => medication.name)
          .join(', ')} (${prescription.prescription_id})`,
      },
    ],
  });

  return { encounter: updated, prescription };
}

export default { acceptEncounter, prescribeEncounter };
