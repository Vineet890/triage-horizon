import { findUserById } from './userStore.js';
import { getEncounter, updateEncounter } from './encounterStore.js';
import {
  countDoctorActivePatients,
  MAX_ACTIVE_PATIENTS_PER_DOCTOR,
  withDoctorCapacityLock,
} from './doctorAssignment.js';

const ASSIGNABLE_STATUSES = [
  'TRIAGED',
  'ROUTING',
  'AWAITING_ACCEPTANCE',
];

function nowIso() {
  return new Date().toISOString();
}

export async function assignEncounterToDoctor({ encounterId, doctorId, actor }) {
  return withDoctorCapacityLock(async () => {
    const [encounter, doctor] = await Promise.all([
      getEncounter(encounterId),
      findUserById(doctorId),
    ]);

    if (!encounter) {
      return { statusCode: 404, error: `Unknown encounter '${encounterId}'` };
    }

    if (encounter.status === 'CLOSED') {
      return { statusCode: 409, error: 'This encounter is already closed.' };
    }

    if (!ASSIGNABLE_STATUSES.includes(encounter.status)) {
      return {
        statusCode: 409,
        error: 'Doctor assignment is locked after a doctor accepts the encounter.',
      };
    }

    if (!doctor || doctor.role !== 'DOCTOR') {
      return { statusCode: 404, error: 'Doctor account not found.' };
    }

    if (encounter.assigned_doctor_id === doctorId) {
      return { encounter };
    }

    const activePatients = await countDoctorActivePatients(doctorId);
    if (activePatients >= MAX_ACTIVE_PATIENTS_PER_DOCTOR) {
      return {
        statusCode: 409,
        error: `${doctor.name} already has the maximum of ${MAX_ACTIVE_PATIENTS_PER_DOCTOR} active patients.`,
      };
    }

    const timestamp = nowIso();
    const updated = await updateEncounter(encounter.id, {
      assigned_doctor_id: doctorId,
      assigned_doctor_name: doctor.name,
      timeline: [
        ...encounter.timeline,
        {
          timestamp,
          actor: actor || 'Network Admin',
          action: `Assigned the encounter to ${doctor.name}.`,
        },
      ],
    });

    return updated
      ? { encounter: updated }
      : { statusCode: 404, error: `Unknown encounter '${encounterId}'` };
  });
}

export default { assignEncounterToDoctor };
