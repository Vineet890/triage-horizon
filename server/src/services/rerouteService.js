import facilityStateManager from './facilityStateManager.js';
import {
  findActiveByFacility,
  updateEncounter,
} from './encounterStore.js';

/**
 * Picks the best remaining facility for a care tier.
 * Emergency routes prefer ICU/cath-lab capability before travel time.
 * Mental-health routes prefer another mental-health clinic when one exists.
 */
function selectAlternative(facilityId, encounter) {
  const careTier = encounter.care_tier;
  const previous = encounter.selected_facility ?? encounter.facility_snapshot ?? {};

  let candidates = facilityStateManager
    .getAllStates()
    .filter((facility) => facility.id !== facilityId)
    .filter((facility) => facility.status !== 'OFFLINE')
    .filter((facility) => facility.capacity_pct < 95);

  if (careTier === 'telehealth') {
    const mentalCandidates = candidates.filter(
      (facility) => facility.type === 'mental_health_clinic'
    );

    if (mentalCandidates.length > 0) {
      return mentalCandidates.sort((a, b) => a.eta_min - b.eta_min)[0];
    }

    return {
      id: 'telehealth',
      name: 'Triage Horizon Telehealth',
      type: 'telehealth',
      distance_km: 0,
      eta_min: 0,
      capacity_pct: null,
      er_beds_available: 0,
      er_wait_min: 0,
      specialties: ['telehealth'],
      status: 'AVAILABLE',
    };
  }

  candidates = candidates.filter(
    (facility) =>
      facility.type !== 'mental_health_clinic' ||
      previous.type === 'mental_health_clinic'
  );

  if (careTier === 'emergency') {
    const capable = candidates.filter(
      (facility) => facility.has_icu || facility.has_cath_lab
    );

    if (capable.length > 0) {
      candidates = capable;
    }
  } else {
    const routineCapable = candidates.filter(
      (facility) => facility.capacity_pct < 90 && facility.er_wait_min < 60
    );

    if (routineCapable.length > 0) {
      candidates = routineCapable;
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => {
    if (careTier === 'emergency') {
      const capability = (facility) =>
        Number(facility.has_icu) +
        Number(facility.has_cath_lab) +
        Number(facility.has_icu && facility.has_cath_lab);

      const delta = capability(b) - capability(a);
      if (delta !== 0) return delta;

      if (previous.type === 'teaching_hospital') {
        const teaching =
          Number(b.type === 'teaching_hospital') -
          Number(a.type === 'teaching_hospital');
        if (teaching !== 0) return teaching;
      }
    }

    if (a.eta_min !== b.eta_min) return a.eta_min - b.eta_min;
    return a.capacity_pct - b.capacity_pct;
  })[0];
}

function emitRouteUpdate(io, update) {
  if (!io) return;

  io.to(`patient:${update.patient_id}`)
    .to('role:DOCTOR')
    .to('role:ADMIN')
    .emit('ROUTE_UPDATED', update);
}

function emitEncounter(io, encounter) {
  if (!io) return;

  io.to(`patient:${encounter.patient_id}`)
    .to('role:DOCTOR')
    .to('role:ADMIN')
    .emit('ENCOUNTER_UPDATED', {
      ...encounter,
      encounter_id: encounter.id,
      encounter,
    });
}

/**
 * Explicit rerouting pass required after Simulate Shock.
 * Reassigns every persisted encounter that pointed at the downed facility and
 * emits both ROUTE_UPDATED (legacy patient banner) and ENCOUNTER_UPDATED (the
 * shared rail) for each affected patient.
 */
export async function rerouteAffectedPatients(facilityId, io) {
  const affected = await findActiveByFacility(facilityId);
  const updates = [];

  for (const encounter of affected) {
    if (
      encounter.care_tier === 'telehealth' &&
      encounter.facility_id === 'telehealth'
    ) {
      continue;
    }

    const previous = encounter.selected_facility ?? encounter.facility_snapshot ?? {};
    const alternative = selectAlternative(facilityId, encounter);
    const reroutedAt = new Date().toISOString();

    if (!alternative) {
      const update = {
        encounter_id: encounter.id,
        patient_id: encounter.patient_id,
        previous_facility_id: facilityId,
        previous_facility_name: previous.name ?? encounter.facility_name ?? null,
        // Explicit reroute contract consumed by the admin map and the
        // patient/doctor route cards.
        old_facility_id: facilityId,
        new_facility_id: null,
        new_facility_name: null,
        new_eta: null,
        selected_facility: null,
        care_tier: encounter.care_tier,
        acuity: encounter.acuity,
        reason:
          'No alternative facility currently has capacity; manual coordination required.',
        reroute_status: 'NO_ALTERNATIVE_AVAILABLE',
        rerouted_at: reroutedAt,
        is_simulated: true,
      };

      const updated = await updateEncounter(encounter.id, {
        status: 'ROUTING',
        facility_id: null,
        facility_name: 'Manual care coordination',
        facility_snapshot: null,
        selected_facility: null,
        route_update: update,
        timeline: [
          ...encounter.timeline,
          {
            timestamp: reroutedAt,
            actor: 'Network Agent',
            action:
              'Previous destination went offline; no alternative facility currently has safe capacity.',
          },
        ],
      });

      updates.push(update);
      emitRouteUpdate(io, update);
      if (updated) emitEncounter(io, updated);
      continue;
    }

    const selectedFacility = {
      ...alternative,
      reason: `Reassigned automatically after ${previous.name ?? facilityId} went offline; ${
        alternative.capacity_pct != null
          ? `${alternative.capacity_pct}% capacity and `
          : ''
      }${alternative.eta_min}-minute ETA.`,
    };

    const update = {
      encounter_id: encounter.id,
      patient_id: encounter.patient_id,
      previous_facility_id: facilityId,
      previous_facility_name: previous.name ?? encounter.facility_name ?? null,
      // Explicit reroute contract consumed by the admin map and the
      // patient/doctor route cards.
      old_facility_id: facilityId,
      new_facility_id: selectedFacility.id,
      new_facility_name: selectedFacility.name,
      new_eta: selectedFacility.eta_min,
      selected_facility: {
        id: selectedFacility.id,
        name: selectedFacility.name,
        eta_min: selectedFacility.eta_min,
        distance_km: selectedFacility.distance_km,
        reason: selectedFacility.reason,
      },
      care_tier: encounter.care_tier,
      acuity: encounter.acuity,
      reason: `Previous destination ${
        previous.name ?? facilityId
      } went OFFLINE.`,
      reroute_status: 'REROUTED',
      rerouted_at: reroutedAt,
      is_simulated: true,
    };

    const updated = await updateEncounter(encounter.id, {
      status: 'ROUTING',
      facility_id: selectedFacility.id,
      facility_name: selectedFacility.name,
      facility_snapshot: selectedFacility,
      selected_facility: selectedFacility,
      rejected_facilities: [
        ...(encounter.rejected_facilities ?? []).filter(
          (facility) =>
            (facility.id ?? facility.facility_id) !==
            (previous.id ?? facilityId)
        ),
        {
          id: previous.id ?? facilityId,
          name: previous.name ?? facilityId,
          reason: 'Went offline during the encounter; rerouted automatically.',
        },
      ],
      route_update: update,
      timeline: [
        ...encounter.timeline,
        {
          timestamp: reroutedAt,
          actor: 'Network Agent',
          action: `Rerouted from ${previous.name ?? facilityId} to ${
            selectedFacility.name
          } after the facility went offline.`,
        },
      ],
    });

    updates.push(update);
    emitRouteUpdate(io, update);
    if (updated) emitEncounter(io, updated);
  }

  return updates;
}

export default { rerouteAffectedPatients };
