import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import facilityStateManager from './facilityStateManager.js';

const DEMO_RESPONSES_PATH = fileURLToPath(
  new URL('../data/demoResponses.json', import.meta.url)
);

function readDemoResponses() {
  try {
    return JSON.parse(fs.readFileSync(DEMO_RESPONSES_PATH, 'utf-8'));
  } catch (error) {
    console.error('[rerouteService] could not read demoResponses.json:', error.message);
    return {};
  }
}

/**
 * Picks the best remaining facility for a care tier.
 * Emergency routes prefer ICU/cath-lab capability before travel time.
 */
function selectAlternative(facilityId, careTier) {
  const candidates = facilityStateManager
    .getAllStates()
    .filter((facility) => facility.id !== facilityId)
    .filter((facility) => facility.status !== 'OFFLINE')
    .filter((facility) => facility.capacity_pct < 95);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => {
    if (careTier === 'emergency') {
      const icu = Number(b.has_icu) - Number(a.has_icu);
      if (icu !== 0) return icu;

      const cathLab = Number(b.has_cath_lab) - Number(a.has_cath_lab);
      if (cathLab !== 0) return cathLab;
    }

    return a.eta_min - b.eta_min;
  })[0];
}

/**
 * Explicit rerouting pass required after Simulate Shock.
 * Reassigns every mock route that pointed at the downed facility and emits
 * ROUTE_UPDATED for each affected patient.
 */
export function rerouteAffectedPatients(facilityId, io) {
  const responses = readDemoResponses();
  const updates = [];

  for (const [patientId, decision] of Object.entries(responses)) {
    if (decision?.selected_facility?.id !== facilityId) {
      continue;
    }

    if (decision.care_tier === 'telehealth') {
      continue;
    }

    const alternative = selectAlternative(facilityId, decision.care_tier);
    const reroutedAt = new Date().toISOString();

    if (!alternative) {
      const update = {
        patient_id: patientId,
        previous_facility_id: facilityId,
        previous_facility_name: decision.selected_facility?.name ?? null,
        selected_facility: null,
        care_tier: decision.care_tier,
        acuity: decision.acuity,
        reason: 'No alternative facility currently has capacity; manual coordination required.',
        reroute_status: 'NO_ALTERNATIVE_AVAILABLE',
        rerouted_at: reroutedAt,
        is_simulated: true,
      };

      updates.push(update);
      io?.emit('ROUTE_UPDATED', update);
      continue;
    }

    const update = {
      patient_id: patientId,
      previous_facility_id: facilityId,
      previous_facility_name: decision.selected_facility?.name ?? null,
      selected_facility: {
        id: alternative.id,
        name: alternative.name,
        eta_min: alternative.eta_min,
        distance_km: alternative.distance_km,
        reason: `Reassigned automatically after simulated outage; ${alternative.capacity_pct}% capacity and ${alternative.eta_min}-minute ETA.`,
      },
      care_tier: decision.care_tier,
      acuity: decision.acuity,
      reason: `Previous destination ${decision.selected_facility?.name ?? facilityId} went OFFLINE.`,
      reroute_status: 'REROUTED',
      rerouted_at: reroutedAt,
      is_simulated: true,
    };

    updates.push(update);
    io?.emit('ROUTE_UPDATED', update);
  }

  return updates;
}
