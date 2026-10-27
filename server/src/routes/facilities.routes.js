import express from 'express';
import Facility from '../models/Facility.js';
import { isDatabaseConnected } from '../config/db.js';
import facilityStateManager from '../services/facilityStateManager.js';
import { rerouteAffectedPatients } from '../services/rerouteService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

// Operational fields owned by the in-memory manager for live Socket.IO updates.
const LIVE_FIELDS = ['status', 'capacity_pct', 'er_beds_available', 'er_wait_min'];

/**
 * Merges the persisted facility record with the live operational snapshot so
 * API reads immediately reflect shock/reroute changes.
 */
function withLiveState(record) {
  const live = facilityStateManager.getState(record.id);

  if (!live) {
    return record;
  }

  const merged = { ...record };

  for (const field of LIVE_FIELDS) {
    if (live[field] !== undefined) {
      merged[field] = live[field];
    }
  }

  if (live.updated_at) {
    merged.updated_at = live.updated_at;
  }

  return merged;
}

// GET /api/facilities - all facilities (persisted base records + live state)
router.get('/', async (req, res) => {
  // Serve the seeded in-memory state immediately when MongoDB is unavailable.
  // This keeps the command centre usable in demo mode instead of stalling on
  // the driver's server-selection timeout.
  if (!isDatabaseConnected()) {
    return res.status(200).json(facilityStateManager.getAllStates());
  }

  try {
    const facilities = await Facility.find().lean();
    return res.status(200).json(facilities.map(withLiveState));
  } catch (error) {
    console.error(
      '[facilities] MongoDB read failed, serving in-memory state:',
      error.message
    );
    return res.status(200).json(facilityStateManager.getAllStates());
  }
});

// POST /api/facilities/simulate-shock - ADMIN only
router.post(
  '/simulate-shock',
  authenticate,
  requireRole(['ADMIN']),
  async (req, res) => {
    const { facility_id } = req.body ?? {};

    if (!facility_id || typeof facility_id !== 'string') {
      return res.status(400).json({ error: 'facility_id is required' });
    }

    const facility = facilityStateManager.simulateShock(facility_id);

    if (!facility) {
      return res.status(404).json({ error: `Unknown facility '${facility_id}'` });
    }

    try {
      // Rule 7: rerouting is invoked explicitly after the state change and
      // must complete before the response so the client receives the full
      // list of reassigned encounters.
      const rerouted = await rerouteAffectedPatients(facility_id, getIO());

      return res.status(200).json({
        success: true,
        facility_id,
        facility,
        rerouted_routes: rerouted.length,
        rerouted,
      });
    } catch (error) {
      console.error('[facilities] reroute failed after shock:', error);
      return res.status(500).json({
        error: 'Facility state changed but rerouting failed.',
        facility,
      });
    }
  }
);

// GET /api/facilities/:id - single facility state
router.get('/:id', (req, res) => {
  const facility = facilityStateManager.getState(req.params.id);

  if (!facility) {
    return res.status(404).json({ error: `Unknown facility '${req.params.id}'` });
  }

  return res.status(200).json(facility);
});

export default router;
