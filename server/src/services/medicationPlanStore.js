import MedicationPlan from '../models/MedicationPlan.js';
import { isDatabaseConnected } from '../config/db.js';
import {
  VAPID_PRIVATE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
} from '../config.js';
import webpush from 'web-push';

const memory = new Map();
let reminderSweepRunning = false;
const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

function stripMongoFields(record) {
  if (!record || typeof record !== 'object') return null;

  const { _id, __v, ...clean } =
    typeof record.toObject === 'function' ? record.toObject() : record;

  return clean;
}

function normalizePlan(plan) {
  if (!plan) return null;
  const clean = stripMongoFields(plan);

  return {
    ...clean,
    medications: Array.isArray(clean.medications) ? clean.medications : [],
    dose_events: Array.isArray(clean.dose_events) ? clean.dose_events : [],
    push_subscriptions: Array.isArray(clean.push_subscriptions)
      ? clean.push_subscriptions
      : [],
    reminder_keys: Array.isArray(clean.reminder_keys)
      ? clean.reminder_keys
      : [],
  };
}

async function writePlan(patientId, changes) {
  const current =
    (await getMedicationPlan(patientId)) ??
    {
      patient_id: patientId,
      timezone: 'UTC',
      medications: [],
      dose_events: [],
      push_subscriptions: [],
      reminder_keys: [],
    };

  const updated = normalizePlan({
    ...current,
    ...changes,
    patient_id: patientId,
    updated_at: new Date().toISOString(),
  });

  memory.set(patientId, updated);

  if (isDatabaseConnected()) {
    const saved = await MedicationPlan.findOneAndUpdate(
      { patient_id: patientId },
      { $set: updated },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return normalizePlan(saved);
  }

  return updated;
}

export async function getMedicationPlan(patientId) {
  if (isDatabaseConnected()) {
    const saved = await MedicationPlan.findOne({ patient_id: patientId }).lean();
    if (saved) {
      const plan = normalizePlan(saved);
      memory.set(patientId, plan);
      return plan;
    }
  }

  return normalizePlan(memory.get(patientId));
}

export async function saveMedicationPlan(patientId, medications, timezone) {
  const existing = await getMedicationPlan(patientId);

  const normalized = medications.map((medication) => ({
    ...medication,
    id: medication.id,
    prescription_id: medication.prescription_id ?? null,
    times: Array.isArray(medication.times) ? medication.times : [],
    doses_per_day: Number(medication.doses_per_day) || 1,
  }));
  return writePlan(patientId, {
    timezone: timezone || existing?.timezone || 'UTC',
    medications: normalized,
    dose_events: existing?.dose_events ?? [],
    push_subscriptions: existing?.push_subscriptions ?? [],
    reminder_keys: existing?.reminder_keys ?? [],
  });
}

export async function recordDose(patientId, medicationId, scheduledTime) {
  const plan = await getMedicationPlan(patientId);
  const medication = plan?.medications.find((item) => item.id === medicationId);

  if (!medication) return { error: 'Medication not found in your plan.' };
  if (
    (medication.as_needed && scheduledTime !== 'PRN') ||
    (!medication.as_needed &&
      medication.times.length > 0 &&
      !medication.times.includes(scheduledTime)) ||
    (!medication.as_needed &&
      medication.times.length === 0 &&
      scheduledTime !== 'PRN')
  ) {
    return { error: 'That time is not part of this medication schedule.' };
  }

  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: plan.timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  if (
    scheduledTime !== 'PRN' &&
    (plan.dose_events ?? []).some(
      (item) =>
        item.date === date &&
        item.medication_id === medicationId &&
        item.scheduled_time === scheduledTime
    )
  ) {
    return { error: 'This dose has already been logged.' };
  }
  const key =
    scheduledTime === 'PRN'
      ? `${date}:${medicationId}:PRN:${now.getTime()}`
      : `${date}:${medicationId}:${scheduledTime}`;
  const event = {
    key,
    medication_id: medication.id,
    medication_name: medication.name,
    dosage: medication.dosage,
    scheduled_time: scheduledTime,
    date,
    status: 'taken',
    taken_at: now.toISOString(),
  };
  const doseEvents =
    scheduledTime === 'PRN'
      ? [...(plan.dose_events ?? [])]
      : (plan.dose_events ?? []).filter((item) => item.key !== key);
  doseEvents.push(event);

  return {
    plan: await writePlan(patientId, { dose_events: doseEvents }),
    event,
    medication,
  };
}

export async function savePushSubscription(patientId, subscription, timezone) {
  const plan = await getMedicationPlan(patientId);
  const subscriptions = (plan?.push_subscriptions ?? []).filter(
    (item) => item.endpoint !== subscription.endpoint
  );
  subscriptions.push({
    ...subscription,
    created_at: new Date().toISOString(),
  });

  return writePlan(patientId, {
    timezone: timezone || plan?.timezone || 'UTC',
    medications: plan?.medications ?? [],
    dose_events: plan?.dose_events ?? [],
    push_subscriptions: subscriptions,
    reminder_keys: plan?.reminder_keys ?? [],
  });
}

async function listPlans() {
  if (isDatabaseConnected()) {
    const plans = await MedicationPlan.find({}).lean();
    for (const plan of plans) {
      const normalized = normalizePlan(plan);
      memory.set(normalized.patient_id, normalized);
    }
  }

  return [...memory.values()].map(normalizePlan);
}

function getLocalDateTime(timezone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function getDueMedicationReminders(plan, now = new Date()) {
  const { date, time } = getLocalDateTime(plan.timezone, now);
  const medications = (plan.medications ?? []).filter(
    (medication) =>
      !medication.as_needed &&
      Array.isArray(medication.times) &&
      medication.times.includes(time) &&
      !(plan.dose_events ?? []).some(
        (event) =>
          event.date === date &&
          event.medication_id === medication.id &&
          event.scheduled_time === time
      )
  );

  return { date, time, medications };
}

async function performMedicationReminderSweep() {
  const plans = await listPlans();
  for (const plan of plans) {
    if (!plan.push_subscriptions.length) continue;

    const { date, time, medications: reminders } =
      getDueMedicationReminders(plan);
    let reminderKeys = [...plan.reminder_keys];
    let subscriptions = [...plan.push_subscriptions];
    let changed = false;

    for (const medication of reminders) {
      const key = `${date}:${medication.id}:${time}`;
      if (reminderKeys.includes(key)) continue;

      const payload = JSON.stringify({
        title: 'Medication reminder',
        body: `It is time for ${medication.name}${medication.dosage ? ` (${medication.dosage})` : ''}.`,
        url: '/patient?tab=medications',
        tag: `dose-${medication.id}-${time}`,
      });
      let delivered = false;

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(subscription, payload);
          delivered = true;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            subscriptions = subscriptions.filter(
              (item) => item.endpoint !== subscription.endpoint
            );
            changed = true;
          } else {
            console.error(
              `[medications] Push reminder failed for ${plan.patient_id}:`,
              error.message
            );
          }
        }
      }

      if (delivered) {
        reminderKeys.push(key);
        changed = true;
      }
    }

    if (changed) {
      await writePlan(plan.patient_id, {
        medications: plan.medications,
        dose_events: plan.dose_events,
        push_subscriptions: subscriptions,
        reminder_keys: reminderKeys.slice(-2000),
        timezone: plan.timezone,
      });
    }
  }
}

export async function runMedicationReminderSweep() {
  if (!vapidConfigured || reminderSweepRunning) return;
  reminderSweepRunning = true;
  try {
    await performMedicationReminderSweep();
  } finally {
    reminderSweepRunning = false;
  }
}

export function getPushPublicKey() {
  return vapidConfigured ? VAPID_PUBLIC_KEY : '';
}
