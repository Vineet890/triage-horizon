import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FACILITIES_PATH = fileURLToPath(
  new URL('../data/facilities.json', import.meta.url)
);

/**
 * In-memory source of truth for live facility operational state.
 * Seeded from facilities.json and mutated at runtime (e.g. by Simulate Shock).
 */
class FacilityStateManager {
  constructor() {
    this.states = new Map();
    this.io = null;
    this.init();
  }

  /** Loads facilities.json into the Map. */
  init() {
    const raw = fs.readFileSync(FACILITIES_PATH, 'utf-8');
    const facilities = JSON.parse(raw);

    this.states = new Map(facilities.map((facility) => [facility.id, { ...facility }]));

    return this.getAllStates();
  }

  /** Receives the Socket.IO server instance so state changes can be broadcast. */
  setIO(io) {
    this.io = io;
    return this;
  }

  getState(id) {
    const state = this.states.get(id);
    return state ? { ...state } : null;
  }

  getAllStates() {
    return Array.from(this.states.values(), (state) => ({ ...state }));
  }

  /**
   * Merges updates into a facility and broadcasts FACILITY_STATE_CHANGED.
   * Returns the updated state, or null when the facility does not exist.
   */
  setState(id, updates = {}) {
    const current = this.states.get(id);

    if (!current) {
      return null;
    }

    const { id: _ignoredId, ...safeUpdates } = updates;
    const next = {
      ...current,
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    };

    this.states.set(id, next);
    this.emit('FACILITY_STATE_CHANGED', { ...next });

    return { ...next };
  }

  /**
   * Simulate Shock: takes a facility fully offline.
   * Callers must invoke rerouting afterwards (see services/rerouteService.js).
   */
  simulateShock(id) {
    const current = this.states.get(id);

    if (!current) {
      return null;
    }

    // setState persists the change and emits FACILITY_STATE_CHANGED.
    return this.setState(id, {
      capacity_pct: 0,
      status: 'OFFLINE',
      er_beds_available: 0,
    });
  }

  emit(event, payload) {
    if (!this.io) {
      console.warn(`[facilityStateManager] no Socket.IO instance; dropped event ${event}`);
      return false;
    }

    // Operational state is relevant to every authenticated portal, but it must
    // never leak to unauthenticated sockets.
    this.io
      .to('role:PATIENT')
      .to('role:DOCTOR')
      .to('role:ADMIN')
      .emit(event, payload);

    return true;
  }
}

export const facilityStateManager = new FacilityStateManager();

export default facilityStateManager;
