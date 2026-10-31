import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignEncounterToDoctor,
} from '../src/services/doctorAssignmentService.js';
import {
  acceptEncounter,
  prescribeEncounter,
} from '../src/services/encounterService.js';
import {
  createEncounter,
  updateEncounter,
} from '../src/services/encounterStore.js';
import {
  countDoctorActivePatients,
  MAX_ACTIVE_PATIENTS_PER_DOCTOR,
} from '../src/services/doctorAssignment.js';

test('doctor assignments and self-acceptance never exceed two active patients', async () => {
  const doctorId = 'doctor_001';
  const encounterIds = [
    'TEST-DOCTOR-CAPACITY-1',
    'TEST-DOCTOR-CAPACITY-2',
    'TEST-DOCTOR-CAPACITY-3',
  ];

  for (const [index, id] of encounterIds.entries()) {
    await createEncounter({
      id,
      patient_id: `test_patient_${index + 1}`,
      patient_name: `Test Patient ${index + 1}`,
      symptom: 'Test encounter for doctor capacity.',
      status: 'TRIAGED',
    });
  }

  const assignments = await Promise.all(
    encounterIds.map((encounterId) =>
      assignEncounterToDoctor({
        encounterId,
        doctorId,
        actor: 'Test Admin',
      })
    )
  );

  assert.equal(
    assignments.filter((result) => result.encounter).length,
    MAX_ACTIVE_PATIENTS_PER_DOCTOR
  );
  assert.equal(
    assignments.filter((result) => result.statusCode === 409).length,
    1
  );
  assert.equal(
    await countDoctorActivePatients(doctorId),
    MAX_ACTIVE_PATIENTS_PER_DOCTOR
  );

  const unassignedEncounterId = encounterIds.find(
    (_id, index) => !assignments[index].encounter
  );
  const fullDoctorAcceptance = await acceptEncounter({
    encounterId: unassignedEncounterId,
    doctorId,
    doctorName: 'Dr. Mira Sen',
  });
  assert.equal(fullDoctorAcceptance.statusCode, 409);
  const unassignedPrescription = await prescribeEncounter({
    encounterId: unassignedEncounterId,
    doctorId,
    doctorName: 'Dr. Mira Sen',
    medications: [{ name: 'Test medication' }],
  });
  assert.equal(unassignedPrescription.statusCode, 409);

  const assignedEncounter = assignments.find(
    (result) => result.encounter
  ).encounter;
  await updateEncounter(assignedEncounter.id, { status: 'CLOSED' });

  const acceptanceAfterDischarge = await acceptEncounter({
    encounterId: unassignedEncounterId,
    doctorId,
    doctorName: 'Dr. Mira Sen',
  });
  assert.equal(acceptanceAfterDischarge.statusCode, 409);

  const reassignmentAfterDischarge = await assignEncounterToDoctor({
    encounterId: unassignedEncounterId,
    doctorId,
    actor: 'Test Admin',
  });
  assert.ok(reassignmentAfterDischarge.encounter);

  const acceptanceAfterAssignment = await acceptEncounter({
    encounterId: unassignedEncounterId,
    doctorId,
    doctorName: 'Dr. Mira Sen',
  });
  assert.ok(acceptanceAfterAssignment.encounter);
  assert.equal(
    await countDoctorActivePatients(doctorId),
    MAX_ACTIVE_PATIENTS_PER_DOCTOR
  );

  for (const encounterId of encounterIds) {
    await updateEncounter(encounterId, { status: 'CLOSED' });
  }
});
