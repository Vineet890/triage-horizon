import test from 'node:test';
import assert from 'node:assert/strict';
import { getDueMedicationReminders } from '../src/services/medicationPlanStore.js';

test('matches medication reminders to the plan timezone and exact prescribed time', () => {
  const plan = {
    timezone: 'America/New_York',
    medications: [
      { id: 'morning', name: 'Medicine A', times: ['08:00'], as_needed: false },
      { id: 'evening', name: 'Medicine B', times: ['20:00'], as_needed: false },
    ],
    dose_events: [],
  };

  const result = getDueMedicationReminders(
    plan,
    new Date('2025-01-15T13:00:00.000Z')
  );

  assert.equal(result.date, '2025-01-15');
  assert.equal(result.time, '08:00');
  assert.deepEqual(result.medications.map(({ id }) => id), ['morning']);
});

test('does not remind for as-needed medication or a dose already logged today', () => {
  const plan = {
    timezone: 'UTC',
    medications: [
      { id: 'prn', name: 'As-needed medicine', times: [], as_needed: true },
      { id: 'taken', name: 'Taken medicine', times: ['08:00'], as_needed: false },
    ],
    dose_events: [
      {
        date: '2025-01-15',
        medication_id: 'taken',
        scheduled_time: '08:00',
      },
    ],
  };

  const result = getDueMedicationReminders(
    plan,
    new Date('2025-01-15T08:00:00.000Z')
  );

  assert.deepEqual(result.medications, []);
});

test('does not invent reminder times for a medication without an explicit schedule', () => {
  const plan = {
    timezone: 'UTC',
    medications: [
      { id: 'unscheduled', name: 'Medicine C', times: [], as_needed: false },
      { id: 'bad-schedule', name: 'Medicine D', schedule: 'twice daily', as_needed: false },
    ],
    dose_events: [],
  };

  const result = getDueMedicationReminders(
    plan,
    new Date('2025-01-15T08:00:00.000Z')
  );

  assert.deepEqual(result.medications, []);
});
