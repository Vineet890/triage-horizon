import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/analytics - ADMIN only
router.get('/', authenticate, requireRole(['ADMIN']), (req, res) => {
  return res.status(200).json({
    diverted_er_visits: 1,
    avg_triage_time_sec: 45,
    network_load_pct: 34,
    reroute_frequency: 1,
    is_simulated: true,
  });
});

export default router;
