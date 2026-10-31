import { ACTIVE_ENCOUNTER_STATUSES } from './encounterStatus.js';

const ACTIVE_STATUS_SET = new Set(ACTIVE_ENCOUNTER_STATUSES);

export function applyRouteUpdateToEncounters(encounters, payload) {
  let updatedEncounter = null;
  const nextEncounters = encounters.map((encounter) => {
    if (
      encounter.patient_id !== payload.patient_id ||
      (payload.encounter_id && encounter.id !== payload.encounter_id) ||
      !ACTIVE_STATUS_SET.has(encounter.status)
    ) {
      return encounter;
    }

    const selectedFacility = payload.selected_facility
      ? {
          ...(encounter.selected_facility ?? {}),
          ...payload.selected_facility,
        }
      : null;

    updatedEncounter = {
      ...encounter,
      status: 'ROUTING',
      facility_id: payload.selected_facility?.id ?? null,
      facility_name:
        payload.selected_facility?.name ?? 'Manual care coordination',
      facility_snapshot: selectedFacility,
      selected_facility: selectedFacility,
      route_update: payload,
    };

    return updatedEncounter;
  });

  return { encounters: nextEncounters, updatedEncounter };
}

export function mergeRouteUpdateIntoEntry(entry, payload) {
  const entryEncounterId =
    entry.encounter_id ?? entry.encounter?.id ?? entry.id;
  if (
    entry.patient_id !== payload.patient_id ||
    (payload.encounter_id && entryEncounterId !== payload.encounter_id)
  ) {
    return entry;
  }

  return {
    ...entry,
    selected_facility:
      payload.selected_facility !== undefined
        ? payload.selected_facility
        : entry.selected_facility,
    route_update: payload,
    rerouted_at: payload.rerouted_at,
    reroute_status: payload.reroute_status,
  };
}

export function createRouteToast(payload) {
  return {
    id: `${payload.patient_id}-${payload.rerouted_at ?? Date.now()}`,
    patient_id: payload.patient_id,
    facility_name:
      payload.selected_facility?.name ??
      (payload.reroute_status === 'NO_ALTERNATIVE_AVAILABLE'
        ? 'manual care coordination'
        : 'an alternate facility'),
    previous_facility_name: payload.previous_facility_name ?? null,
    reason: payload.reason ?? '',
    rerouted_at: payload.rerouted_at ?? new Date().toISOString(),
  };
}
