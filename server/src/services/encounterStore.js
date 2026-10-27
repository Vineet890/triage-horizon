import crypto from 'node:crypto';
import Encounter from '../models/Encounter.js';
import { isDatabaseConnected } from '../config/db.js';

/**
 * Shared encounter persistence.
 *
 * MongoDB is the primary store. Every write is also mirrored into an
 * in-process Map so the demo keeps working when Atlas is unreachable. Reads
 * merge both sources by id, with MongoDB winning when the same encounter
 * exists in both places.
 */

export const ACTIVE_STATUSES = [
  'TRIAGED',
  'ROUTING',
  'AWAITING_ACCEPTANCE',
  'ACCEPTED',
  'EN_ROUTE',
];

const memory = new Map();

function nowIso() {
  return new Date().toISOString();
}

function stripMongoFields(record) {
  if (!record || typeof record !== 'object') return null;

  const {
    _id,
    __v,
    ...rest
  } = typeof record.toObject === 'function' ? record.toObject() : record;

  return rest;
}

function normalizeEncounter(record) {
  if (!record) return null;

  const clean = stripMongoFields(record);

  return {
    ...clean,
    agent_rationale: Array.isArray(clean.agent_rationale)
      ? clean.agent_rationale
      : [],
    agent_trace: Array.isArray(clean.agent_trace) ? clean.agent_trace : [],
    timeline: Array.isArray(clean.timeline) ? clean.timeline : [],
    risk_modifiers: Array.isArray(clean.risk_modifiers)
      ? clean.risk_modifiers
      : [],
    special_flags: Array.isArray(clean.special_flags)
      ? clean.special_flags
      : [],
    rejected_facilities: Array.isArray(clean.rejected_facilities)
      ? clean.rejected_facilities
      : [],
    prescription: clean.prescription ?? null,
    selected_facility: clean.selected_facility ?? null,
    route_update: clean.route_update ?? null,
  };
}

function sortNewestFirst(records) {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

function matchesFilter(record, filter = {}) {
  if (filter.patient_id && record.patient_id !== filter.patient_id) return false;
  if (filter.facility_id && record.facility_id !== filter.facility_id) return false;

  if (filter.activeOnly && !ACTIVE_STATUSES.includes(record.status)) {
    return false;
  }

  if (filter.status) {
    const statuses = Array.isArray(filter.status)
      ? filter.status
      : String(filter.status)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);

    if (statuses.length > 0 && !statuses.includes(record.status)) {
      return false;
    }
  }

  return true;
}

function buildMongoFilter(filter = {}) {
  const query = {};

  if (filter.patient_id) query.patient_id = filter.patient_id;
  if (filter.facility_id) query.facility_id = filter.facility_id;

  if (filter.activeOnly) {
    query.status = { $in: ACTIVE_STATUSES };
  } else if (filter.status) {
    const statuses = Array.isArray(filter.status)
      ? filter.status
      : String(filter.status)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);

    if (statuses.length > 0) {
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
  }

  return query;
}

export function newEncounterId() {
  return `ENC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

export async function createEncounter(input = {}) {
  const timestamp = nowIso();

  const record = normalizeEncounter({
    id: input.id ?? newEncounterId(),
    patient_id: input.patient_id,
    patient_name: input.patient_name ?? '',
    symptom: input.symptom ?? '',
    acuity: input.acuity ?? 'LOW',
    care_tier: input.care_tier ?? 'telehealth',
    status: input.status ?? 'INTAKE',
    facility_id: input.facility_id ?? null,
    facility_name: input.facility_name ?? null,
    facility_snapshot: input.facility_snapshot ?? null,
    assigned_doctor_id: input.assigned_doctor_id ?? null,
    assigned_doctor_name: input.assigned_doctor_name ?? null,
    protocol_matched: input.protocol_matched ?? '',
    agent_rationale: input.agent_rationale ?? [],
    agent_trace: input.agent_trace ?? [],
    timeline: input.timeline ?? [],
    prescription: input.prescription ?? null,
    risk_modifiers: input.risk_modifiers ?? [],
    special_flags: input.special_flags ?? [],
    selected_facility: input.selected_facility ?? null,
    rejected_facilities: input.rejected_facilities ?? [],
    route_update: input.route_update ?? null,
    source: input.source ?? 'live',
    created_at: input.created_at ?? timestamp,
    updated_at: input.updated_at ?? timestamp,
  });

  memory.set(record.id, record);

  if (isDatabaseConnected()) {
    try {
      const created = await Encounter.create(record);
      return normalizeEncounter(created);
    } catch (error) {
      console.error(
        `[encounters] MongoDB create failed for '${record.id}', using memory store:`,
        error.message
      );
    }
  }

  return record;
}

export async function getEncounter(id) {
  if (!id) return null;

  if (isDatabaseConnected()) {
    try {
      const found = await Encounter.findOne({ id }).lean();
      if (found) {
        const normalized = normalizeEncounter(found);
        memory.set(normalized.id, normalized);
        return normalized;
      }
    } catch (error) {
      console.error(
        `[encounters] MongoDB read failed for '${id}', using memory store:`,
        error.message
      );
    }
  }

  return memory.get(id) ?? null;
}

export async function listEncounters(filter = {}) {
  const merged = new Map();

  if (isDatabaseConnected()) {
    try {
      const records = await Encounter.find(buildMongoFilter(filter))
        .sort({ created_at: -1 })
        .limit(Number(filter.limit) || 200)
        .lean();

      records.forEach((record) => {
        const normalized = normalizeEncounter(record);
        merged.set(normalized.id, normalized);
        memory.set(normalized.id, normalized);
      });
    } catch (error) {
      console.error(
        '[encounters] MongoDB list failed, using memory store:',
        error.message
      );
    }
  }

  for (const record of memory.values()) {
    if (!merged.has(record.id)) {
      merged.set(record.id, record);
    }
  }

  return sortNewestFirst(
    Array.from(merged.values()).filter((record) => matchesFilter(record, filter))
  ).slice(0, Number(filter.limit) || 200);
}

export async function updateEncounter(id, patch = {}) {
  const current = await getEncounter(id);

  if (!current) {
    return null;
  }

  const next = normalizeEncounter({
    ...current,
    ...patch,
    id: current.id,
    created_at: current.created_at,
    updated_at: nowIso(),
  });

  memory.set(id, next);

  if (isDatabaseConnected()) {
    try {
      const updated = await Encounter.findOneAndUpdate(
        { id },
        { $set: { ...next } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();

      if (updated) {
        const normalized = normalizeEncounter(updated);
        memory.set(id, normalized);
        return normalized;
      }
    } catch (error) {
      console.error(
        `[encounters] MongoDB update failed for '${id}', using memory store:`,
        error.message
      );
    }
  }

  return next;
}

export async function appendTimeline(id, actor, action) {
  const current = await getEncounter(id);

  if (!current) return null;

  return updateEncounter(id, {
    timeline: [
      ...current.timeline,
      {
        timestamp: nowIso(),
        actor: actor || 'System',
        action: action || '',
      },
    ],
  });
}

export async function findActiveByFacility(facilityId) {
  return listEncounters({ facility_id: facilityId, activeOnly: true });
}

export async function findLatestByPatient(patientId) {
  const records = await listEncounters({ patient_id: patientId, limit: 1 });
  return records[0] ?? null;
}

export async function findActiveByPatient(patientId) {
  const records = await listEncounters({
    patient_id: patientId,
    activeOnly: true,
  });
  return records[0] ?? null;
}

export async function closeActiveForPatient(
  patientId,
  actor = 'System',
  reason = 'Superseded by a new intake'
) {
  const active = await listEncounters({
    patient_id: patientId,
    activeOnly: true,
  });

  for (const encounter of active) {
    await updateEncounter(encounter.id, {
      status: 'CLOSED',
      timeline: [
        ...encounter.timeline,
        {
          timestamp: nowIso(),
          actor,
          action: reason,
        },
      ],
    });
  }

  return active.length;
}

export async function countEncounters(filter = {}) {
  const records = await listEncounters(filter);
  return records.length;
}

export default {
  ACTIVE_STATUSES,
  appendTimeline,
  closeActiveForPatient,
  countEncounters,
  createEncounter,
  findActiveByFacility,
  findActiveByPatient,
  findLatestByPatient,
  getEncounter,
  listEncounters,
  newEncounterId,
  updateEncounter,
};
