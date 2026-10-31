import crypto from 'node:crypto';
import {
  getEncounter,
  updateEncounter,
} from './encounterStore.js';
import {
  getMedicationPlan,
  saveMedicationPlan,
} from './medicationPlanStore.js';
import {
  countDoctorActivePatients,
  MAX_ACTIVE_PATIENTS_PER_DOCTOR,
  withDoctorCapacityLock,
} from './doctorAssignment.js';

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
          doses_per_day: 1,
          times: [],
          as_needed: false,
        };
      }

      if (!medication || typeof medication !== 'object') {
        return null;
      }

      const name = String(medication.name ?? '').trim();

      if (!name) return null;
      const times = Array.isArray(medication.times)
        ? [...new Set(medication.times.map((time) => String(time).trim()))]
        : [];
      const hasSchedule =
        Array.isArray(medication.times) ||
        medication.doses_per_day !== undefined ||
        medication.as_needed !== undefined;
      const dosesPerDay = Number(
        medication.doses_per_day ?? (times.length || 1)
      );
      if (
        !Number.isInteger(dosesPerDay) ||
        dosesPerDay < 1 ||
        dosesPerDay > 24 ||
        times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
        (hasSchedule &&
          !medication.as_needed &&
          times.length !== dosesPerDay)
      ) {
        return null;
      }

      return {
        name,
        dosage: String(medication.dosage ?? medication.dose ?? '').trim(),
        schedule: String(
          medication.schedule ?? medication.frequency ?? ''
        ).trim(),
        note: String(medication.note ?? medication.instructions ?? '').trim(),
        doses_per_day: dosesPerDay,
        times,
        as_needed: Boolean(medication.as_needed),
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
  return withDoctorCapacityLock(async () => {
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

    if (!encounter.assigned_doctor_id) {
      return {
        statusCode: 409,
        error: 'An administrator must assign this encounter before a doctor can accept it.',
      };
    }

    const alreadyAccepted =
      encounter.assigned_doctor_id === doctorId &&
      ['ACCEPTED', 'EN_ROUTE'].includes(encounter.status);

    if (alreadyAccepted) {
      return { encounter };
    }

    const activePatients = await countDoctorActivePatients(doctorId);
    if (activePatients > MAX_ACTIVE_PATIENTS_PER_DOCTOR) {
      return {
        statusCode: 409,
        error: `You already have more than the maximum of ${MAX_ACTIVE_PATIENTS_PER_DOCTOR} active patients. Ask an administrator to reassign an encounter.`,
      };
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
  });
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

  if (!['ACCEPTED', 'EN_ROUTE'].includes(encounter.status)) {
    return {
      statusCode: 409,
      error: 'Accept the assigned encounter before issuing a prescription.',
    };
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

  try {
    const medicationPlan = await getMedicationPlan(encounter.patient_id);
    const replacementNames = new Set(
      normalized.map((medication) => medication.name.toLowerCase())
    );
    const prescribedPlanItems = normalized.map((medication, index) => ({
      id: `rx-${prescription.prescription_id}-${index}`,
      name: medication.name,
      dosage: medication.dosage,
      schedule: medication.schedule,
      doses_per_day: medication.doses_per_day,
      times: medication.times,
      note: medication.note || prescription.instructions,
      category: `Prescribed by ${doctorName}`,
      prescription_id: prescription.prescription_id,
      doctor_name: doctorName,
      as_needed: medication.as_needed,
    }));

    await saveMedicationPlan(
      encounter.patient_id,
      [
        ...(medicationPlan?.medications ?? []).filter(
          (medication) => !replacementNames.has(medication.name.toLowerCase())
        ),
        ...prescribedPlanItems,
      ],
      medicationPlan?.timezone
    );
  } catch (error) {
    console.error(
      `[medications] Could not sync prescription ${prescription.prescription_id} to the reminder plan:`,
      error
    );
  }

  return { encounter: updated, prescription };
}

export default { acceptEncounter, prescribeEncounter };
