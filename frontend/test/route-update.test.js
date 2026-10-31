import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRouteUpdateToEncounters,
  createRouteToast,
  mergeRouteUpdateIntoEntry,
} from '../src/lib/routeUpdates.js';

test('applies a reroute only to its matching active encounter', () => {
  const active = {
    id: 'enc-active',
    patient_id: 'patient-001',
    status: 'TRIAGED',
    facility_id: 'facility-old',
    facility_name: 'Old Hospital',
    selected_facility: { id: 'facility-old', name: 'Old Hospital' },
  };
  const older = {
    id: 'enc-older',
    patient_id: 'patient-001',
    status: 'CLOSED',
    facility_id: 'facility-older',
    facility_name: 'Older Hospital',
  };

  const payload = {
    encounter_id: active.id,
    patient_id: active.patient_id,
    previous_facility_id: 'facility-old',
    previous_facility_name: 'Old Hospital',
    new_facility_id: 'facility-new',
    new_facility_name: 'New Hospital',
    new_eta: 8,
    selected_facility: {
      id: 'facility-new',
      name: 'New Hospital',
      eta_min: 8,
    },
    reroute_status: 'REROUTED',
    reason: 'Old Hospital went offline.',
    rerouted_at: '2026-10-31T00:00:00.000Z',
  };
  const { encounters, updatedEncounter } = applyRouteUpdateToEncounters(
    [active, older],
    payload
  );
  const toast = createRouteToast(payload);
  const queueEntry = {
    id: 'enc-active',
    encounter_id: 'enc-active',
    patient_id: active.patient_id,
    facility_name: 'Old Hospital',
  };
  const staleQueueEntry = {
    id: 'enc-old',
    encounter_id: 'enc-old',
    patient_id: active.patient_id,
    facility_name: 'Older Hospital',
  };

  assert.equal(
    mergeRouteUpdateIntoEntry(queueEntry, payload).selected_facility.id,
    'facility-new'
  );
  assert.equal(
    mergeRouteUpdateIntoEntry(staleQueueEntry, payload),
    staleQueueEntry
  );
  assert.equal(
    encounters.find((encounter) => encounter.id === active.id).facility_name,
    'New Hospital'
  );
  assert.equal(
    encounters.find((encounter) => encounter.id === older.id).facility_name,
    'Older Hospital'
  );
  assert.equal(updatedEncounter.id, active.id);
  assert.equal(toast.previous_facility_name, 'Old Hospital');
  assert.equal(toast.facility_name, 'New Hospital');
});

test('records manual coordination when no safe destination exists', () => {
  const toast = createRouteToast({
    patient_id: 'patient-001',
    encounter_id: 'enc-active',
    reroute_status: 'NO_ALTERNATIVE_AVAILABLE',
    reason: 'No emergency facility with capacity was available.',
  });

  assert.equal(toast.facility_name, 'manual care coordination');
  assert.equal(
    toast.reason,
    'No emergency facility with capacity was available.'
  );
});
