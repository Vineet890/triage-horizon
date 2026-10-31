import facilityStateManager from './facilityStateManager.js';
import {
  findActiveByFacility,
  updateEncounter,
} from './encounterStore.js';
import { rankFacilities } from './facilityRouting.js';
import { getProtocolByCode, matchProtocol } from './triageEngine.js';

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

    const previous =
      encounter.selected_facility ?? encounter.facility_snapshot ?? {};
    const protocolCode = String(encounter.protocol_matched ?? '')
      .split(':', 1)[0]
      .trim();
    const protocol =
      getProtocolByCode(protocolCode) ?? matchProtocol(encounter.symptom);
    const mentalHealthContext =
      protocol.required_specialty === 'mental_health' ||
      previous.type === 'mental_health_clinic';
    const alternative =
      rankFacilities({
        facilities: facilityStateManager.getAllStates(),
        protocol,
        careTier: encounter.care_tier,
        mentalHealthContext,
        excludeFacilityIds: [facilityId],
      })[0] ??
      (encounter.care_tier === 'telehealth' && !mentalHealthContext
        ? {
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
          }
        : null);
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
