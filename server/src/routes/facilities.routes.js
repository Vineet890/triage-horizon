import express from 'express';
import facilityStateManager from '../services/facilityStateManager.js';
import { rerouteAffectedPatients } from '../services/rerouteService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getIO } from '../socket.js';

const router = express.Router();

// GET /api/facilities - all facility states
router.get('/', (req, res) => {
  return res.status(200).json(facilityStateManager.getAllStates());
});

// POST /api/facilities/simulate-shock - ADMIN only
router.post(
  '/simulate-shock',
  authenticate,
  requireRole(['ADMIN']),
  (req, res) => {
    const { facility_id } = req.body ?? {};

    if (!facility_id || typeof facility_id !== 'string') {
      return res.status(400).json({ error: 'facility_id is required' });
    }

    const facility = facilityStateManager.simulateShock(facility_id);

    if (!facility) {
      return res.status(404).json({ error: `Unknown facility '${facility_id}'` });
    }

    // Rule 7: rerouting is invoked explicitly after the state change.
    const rerouted = rerouteAffectedPatients(facility_id, getIO());

    return res.status(200).json({
      success: true,
      facility_id,
      facility,
      rerouted_routes: rerouted.length,
      rerouted,
    });
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
