import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import facilityStateManager from '../services/facilityStateManager.js';
import { listEncounters } from '../services/encounterStore.js';

const router = express.Router();

const ACTIVE_STATUSES = [
  'TRIAGED',
  'ROUTING',
  'AWAITING_ACCEPTANCE',
  'ACCEPTED',
  'EN_ROUTE',
];

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function countBy(records, key) {
  return records.reduce((counts, record) => {
    const value = record[key] ?? 'UNKNOWN';
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

/**
 * GET /api/analytics - ADMIN only
 *
 * Derived from the live facility state and shared encounters instead of a
 * hard-coded fixture. The numbers move when patients are triaged, accepted,
 * prescribed or rerouted, which is what the command centre is meant to show.
 */
router.get('/', authenticate, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [encounters, facilities] = await Promise.all([
      listEncounters({ limit: 500 }),
      Promise.resolve(facilityStateManager.getAllStates()),
    ]);

    const active = encounters.filter((encounter) =>
      ACTIVE_STATUSES.includes(encounter.status)
    );

    const diverted = active.filter(
      (encounter) => encounter.care_tier !== 'emergency'
    );

    const rerouted = encounters.filter((encounter) => encounter.route_update);

    const triageDurations = encounters
      .map((encounter) => {
        const start = new Date(encounter.created_at ?? 0).getTime();
        const triagedStep = (encounter.timeline ?? []).find((step) =>
          String(step.action ?? '').startsWith('Triaged')
        );
        const end = triagedStep
          ? new Date(triagedStep.timestamp ?? 0).getTime()
          : Number.NaN;

        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          return null;
        }

        return (end - start) / 1000;
      })
      .filter((value) => value !== null);

    const networkLoad = average(
      facilities
        .filter((facility) => facility.status !== 'OFFLINE')
        .map((facility) => Number(facility.capacity_pct))
        .filter((value) => Number.isFinite(value))
    );

    return res.status(200).json({
      diverted_er_visits: diverted.length,
      avg_triage_time_sec: Number(average(triageDurations).toFixed(1)),
      network_load_pct: Math.round(networkLoad),
      reroute_frequency: rerouted.length,
      active_encounters: active.length,
      total_encounters: encounters.length,
      awaiting_acceptance: encounters.filter((encounter) =>
        ['TRIAGED', 'AWAITING_ACCEPTANCE'].includes(encounter.status)
      ).length,
      prescriptions_sent: encounters.filter(
        (encounter) => encounter.prescription
      ).length,
      acuity_breakdown: countBy(active, 'acuity'),
      status_breakdown: countBy(encounters, 'status'),
      facility_breakdown: countBy(facilities, 'status'),
      facility_count: facilities.length,
      generated_at: new Date().toISOString(),
      is_simulated: true,
    });
  } catch (error) {
    console.error('[analytics] aggregation failed:', error);
    return res.status(500).json({ error: 'Unable to compute analytics.' });
  }
});

export default router;
