import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { emitToAll, getIO } from '../socket.js';

const router = express.Router();

const ACUITY_VALUES = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
const JITSI_DOMAIN = 'meet.jit.si';

// Every video endpoint requires a valid JWT.
router.use(authenticate);

function emitToPortal(portal, event, payload) {
  const io = getIO();

  if (!io) {
    return false;
  }

  emitToAll(io, event, {
    ...payload,
    target_portal: portal,
    emitted_at: new Date().toISOString(),
  });

  return true;
}

// POST /api/video/create-room
router.post('/create-room', (req, res) => {
  const { patient_id, patient_name, acuity } = req.body ?? {};

  if (!patient_id || typeof patient_id !== 'string') {
    return res.status(400).json({ error: 'patient_id is required' });
  }

  if (acuity && !ACUITY_VALUES.includes(acuity)) {
    return res.status(400).json({
      error: 'Invalid acuity',
      allowed: ACUITY_VALUES,
    });
  }

  const room_id = `TH-ROOM-${patient_id}`;

  emitToPortal('DOCTOR_PORTAL', 'VIDEO_CALL_INITIATED', {
    room_id,
    patient_id,
    patient_name: patient_name ?? null,
    acuity: acuity ?? null,
    jitsi_url: `https://${JITSI_DOMAIN}/${room_id}`,
    initiated_by: req.user.userId,
  });

  return res.status(200).json({ room_id });
});

// POST /api/video/accept
router.post('/accept', (req, res) => {
  const { room_id, doctor_name, specialty } = req.body ?? {};

  if (!room_id || typeof room_id !== 'string') {
    return res.status(400).json({ error: 'room_id is required' });
  }

  emitToPortal('PATIENT_PORTAL', 'VIDEO_CALL_ACCEPTED', {
    room_id,
    doctor_name: doctor_name ?? null,
    specialty: specialty ?? null,
    accepted_by: req.user.userId,
  });

  return res.status(200).json({ success: true });
});

// POST /api/video/end
router.post('/end', (req, res) => {
  const { room_id, duration_sec, prescription_sent } = req.body ?? {};

  if (!room_id || typeof room_id !== 'string') {
    return res.status(400).json({ error: 'room_id is required' });
  }

  const payload = {
    room_id,
    duration_sec: Number(duration_sec) || 0,
    prescription_sent: Boolean(prescription_sent),
    ended_by: req.user.userId,
    target_portal: 'BOTH_PORTALS',
    ended_at: new Date().toISOString(),
  };

  // A single broadcast reaches both the doctor and patient portals.
  const io = getIO();
  if (io) {
    emitToAll(io, 'VIDEO_CALL_ENDED', payload);
  }

  return res.status(200).json({ success: true });
});

export default router;
