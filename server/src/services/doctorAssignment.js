import { ACTIVE_STATUSES, listEncounters } from './encounterStore.js';

export const MAX_ACTIVE_PATIENTS_PER_DOCTOR = 2;

let capacityQueue = Promise.resolve();

export function withDoctorCapacityLock(operation) {
  const result = capacityQueue.then(operation, operation);
  capacityQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function countDoctorActivePatients(doctorId) {
  const encounters = await listEncounters({
    assigned_doctor_id: doctorId,
    activeOnly: true,
  });
  return encounters.filter((encounter) =>
    ACTIVE_STATUSES.includes(encounter.status)
  ).length;
}

export default {
  MAX_ACTIVE_PATIENTS_PER_DOCTOR,
  countDoctorActivePatients,
  withDoctorCapacityLock,
};
