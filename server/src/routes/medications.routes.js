import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getMedicationPlan,
  getPushPublicKey,
  recordDose,
  saveMedicationPlan,
  savePushSubscription,
} from '../services/medicationPlanStore.js';
import {
  emitEncounterUpdated,
  getIO,
} from '../socket.js';
import {
  findLatestByPatient,
  updateEncounter,
} from '../services/encounterStore.js';
import { findUserById } from '../services/userStore.js';

const router = express.Router();
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function validTimezone(timezone) {
  if (typeof timezone !== 'string' || timezone.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

router.use(authenticate, requireRole(['PATIENT']));

router.get('/plan', async (req, res) => {
  try {
    return res.status(200).json({
      plan: await getMedicationPlan(req.user.userId),
      push_public_key: getPushPublicKey(),
    });
  } catch (error) {
    console.error('[medications] plan read failed:', error);
    return res.status(500).json({ error: 'Unable to load your medication plan.' });
  }
});

router.put('/plan', async (req, res) => {
  const { medications, timezone } = req.body ?? {};

  if (!Array.isArray(medications) || medications.length > 100) {
    return res.status(400).json({ error: 'A valid medication list is required.' });
  }
  if (
    timezone !== undefined &&
    !validTimezone(timezone)
  ) {
    return res.status(400).json({ error: 'A valid timezone is required.' });
  }

  const normalized = [];
  const medicationIds = new Set();
  for (const medication of medications) {
    if (
      !medication ||
      typeof medication.id !== 'string' ||
      !medication.id.trim() ||
      medication.id.length > 200 ||
      typeof medication.name !== 'string' ||
      !medication.name.trim() ||
      medication.name.length > 200
    ) {
      return res.status(400).json({
        error: 'Each medication must include an id and name.',
      });
    }
    if (medicationIds.has(medication.id.trim())) {
      return res.status(400).json({
        error: `Medication id '${medication.id.trim()}' is duplicated.`,
      });
    }
    medicationIds.add(medication.id.trim());

    const times = Array.isArray(medication.times) ? medication.times : [];
    if (times.some((time) => typeof time !== 'string' || !TIME_PATTERN.test(time))) {
      return res.status(400).json({
        error: `Medication '${medication.name}' has an invalid scheduled time.`,
      });
    }

    const dosesPerDay = Number(
      medication.doses_per_day ?? (times.length || 1)
    );
    if (!Number.isInteger(dosesPerDay) || dosesPerDay < 1 || dosesPerDay > 24) {
      return res.status(400).json({
        error: `Medication '${medication.name}' must have between 1 and 24 doses per day.`,
      });
    }
    if (
      !medication.as_needed &&
      times.length > 0 &&
      (times.length !== dosesPerDay ||
        new Set(times).size !== times.length)
    ) {
      return res.status(400).json({
        error: `Medication '${medication.name}' needs one scheduled time for each daily dose.`,
      });
    }
    if (!medication.as_needed && times.length === 0 && dosesPerDay > 1) {
      return res.status(400).json({
        error: `Medication '${medication.name}' needs a time for each daily dose.`,
      });
    }
    if (
      medication.as_needed !== undefined &&
      typeof medication.as_needed !== 'boolean'
    ) {
      return res.status(400).json({
        error: `Medication '${medication.name}' has an invalid as-needed setting.`,
      });
    }

    normalized.push({
      id: medication.id.trim(),
      name: medication.name.trim(),
      dosage: String(medication.dosage ?? medication.dose ?? '').trim(),
      schedule: String(medication.schedule ?? '').trim(),
      doses_per_day: dosesPerDay,
      times: [...new Set(times)],
      note: String(medication.note ?? '').trim(),
      category: String(medication.category ?? '').trim(),
      prescription_id: medication.prescription_id ?? null,
      doctor_name: String(medication.doctor_name ?? '').trim(),
      as_needed: Boolean(medication.as_needed),
    });
  }

  try {
    const plan = await saveMedicationPlan(
      req.user.userId,
      normalized,
      timezone
    );
    return res.status(200).json({ plan });
  } catch (error) {
    console.error('[medications] plan save failed:', error);
    return res.status(500).json({ error: 'Unable to save your medication plan.' });
  }
});

router.post('/dose', async (req, res) => {
  const { medication_id, scheduled_time } = req.body ?? {};
  if (
    typeof medication_id !== 'string' ||
    typeof scheduled_time !== 'string' ||
    (scheduled_time !== 'PRN' && !TIME_PATTERN.test(scheduled_time))
  ) {
    return res.status(400).json({
      error: 'A medication and valid scheduled time are required.',
    });
  }

  try {
    const result = await recordDose(
      req.user.userId,
      medication_id,
      scheduled_time
    );
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const encounter = await findLatestByPatient(req.user.userId);
    if (encounter) {
      const account = await findUserById(req.user.userId);
      const updated = await updateEncounter(encounter.id, {
        timeline: [
          ...encounter.timeline,
          {
            timestamp: result.event.taken_at,
            actor: account?.name || 'Patient',
            action: `Marked ${result.medication.name}${result.medication.dosage ? ` (${result.medication.dosage})` : ''} as taken${scheduled_time === 'PRN' ? ' as needed' : ` at ${scheduled_time}`}.`,
          },
        ],
      });
      const io = getIO();
      if (io) emitEncounterUpdated(io, updated);
    }

    return res.status(200).json({
      success: true,
      event: result.event,
      plan: result.plan,
    });
  } catch (error) {
    console.error('[medications] dose log failed:', error);
    return res.status(500).json({ error: 'Unable to record this medication dose.' });
  }
});

router.post('/push-subscription', async (req, res) => {
  const { subscription, timezone } = req.body ?? {};
  const endpoint = subscription?.endpoint;
  let endpointHost = '';
  let endpointProtocol = '';
  let endpointPort = '';

  try {
    const parsedEndpoint = new URL(endpoint);
    endpointHost = parsedEndpoint.hostname.toLowerCase();
    endpointProtocol = parsedEndpoint.protocol;
    endpointPort = parsedEndpoint.port;
  } catch {
    return res.status(400).json({ error: 'A valid browser push subscription is required.' });
  }

  const allowedPushHosts = [
    'fcm.googleapis.com',
    'push.services.mozilla.com',
    'web.push.apple.com',
    'notify.windows.com',
  ];
  const trustedHost = allowedPushHosts.some(
    (host) => endpointHost === host || endpointHost.endsWith(`.${host}`)
  );
  if (
    endpointProtocol !== 'https:' ||
    (endpointPort && endpointPort !== '443') ||
    !trustedHost ||
    typeof subscription?.keys?.p256dh !== 'string' ||
    typeof subscription?.keys?.auth !== 'string'
  ) {
    return res.status(400).json({ error: 'The browser push subscription is invalid.' });
  }

  try {
    if (timezone !== undefined && !validTimezone(timezone)) {
      return res.status(400).json({ error: 'A valid timezone is required.' });
    }
    await savePushSubscription(
      req.user.userId,
      subscription,
      typeof timezone === 'string' ? timezone : undefined
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[medications] push subscription save failed:', error);
    return res.status(500).json({ error: 'Unable to enable medication reminders.' });
  }
});

export default router;
