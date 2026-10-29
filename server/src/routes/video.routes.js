import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { emitToPatient, emitToRole, getIO } from '../socket.js';

const router = express.Router();

const ACUITY_VALUES = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];
const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'jitsi.riot.im';
const ROOM_PREFIX = 'TH-ROOM-';

// Every video endpoint requires a valid JWT.
router.use(authenticate);

/** Derives the patient id from the deterministic room name. */
function patientIdFromRoom(roomId) {
  if (typeof roomId !== 'string' || !roomId.startsWith(ROOM_PREFIX)) {
    return null;
  }

  const value = roomId.slice(ROOM_PREFIX.length).trim();
  return value || null;
}

function stamp(payload) {
  return {
    ...payload,
    emitted_at: new Date().toISOString(),
  };
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

  // A patient may only open a room for themselves.
  if (req.user.role === 'PATIENT' && req.user.userId !== patient_id) {
    return res.status(403).json({ error: 'Not authorised for this patient' });
  }

  const room_id = `${ROOM_PREFIX}${patient_id}`;

  const io = getIO();
  if (io) {
    emitToRole(
      io,
      'DOCTOR',
      'VIDEO_CALL_INITIATED',
      stamp({
        room_id,
        patient_id,
        patient_name: patient_name ?? null,
        acuity: acuity ?? null,
        jitsi_url: `https://${JITSI_DOMAIN}/${room_id}`,
        initiated_by: req.user.userId,
        target_portal: 'DOCTOR_PORTAL',
      })
    );
  }

  return res.status(200).json({ room_id });
});

// POST /api/video/accept
router.post('/accept', requireRole(['DOCTOR']), (req, res) => {
  const { room_id, doctor_name, specialty } = req.body ?? {};

  if (!room_id || typeof room_id !== 'string') {
    return res.status(400).json({ error: 'room_id is required' });
  }

  const patientId = patientIdFromRoom(room_id);

  if (!patientId) {
    return res.status(400).json({ error: 'Unrecognised room_id' });
  }

  const io = getIO();
  if (io) {
    const payload = stamp({
      room_id,
      patient_id: patientId,
      doctor_name: doctor_name ?? null,
      specialty: specialty ?? null,
      accepted_by: req.user.userId,
      target_portal: 'PATIENT_PORTAL',
    });

    emitToPatient(io, patientId, 'VIDEO_CALL_ACCEPTED', payload);
    emitToRole(io, 'DOCTOR', 'VIDEO_CALL_ACCEPTED', payload);
  }

  return res.status(200).json({ success: true });
});

// POST /api/video/end
router.post('/end', (req, res) => {
  const { room_id, duration_sec, prescription_sent } = req.body ?? {};

  if (!room_id || typeof room_id !== 'string') {
    return res.status(400).json({ error: 'room_id is required' });
  }

  const patientId = patientIdFromRoom(room_id);

  if (!patientId) {
    return res.status(400).json({ error: 'Unrecognised room_id' });
  }

  // Clinicians may end any consultation; a patient may only end their own room.
  if (req.user.role === 'PATIENT' && req.user.userId !== patientId) {
    return res.status(403).json({ error: 'Not authorised for this consultation' });
  }

  if (!['PATIENT', 'DOCTOR'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Not authorised to end consultations' });
  }

  const payload = stamp({
    room_id,
    patient_id: patientId,
    duration_sec: Number(duration_sec) || 0,
    prescription_sent: Boolean(prescription_sent),
    ended_by: req.user.userId,
    target_portal: 'BOTH_PORTALS',
    ended_at: new Date().toISOString(),
  });

  const io = getIO();
  if (io) {
    if (patientId) {
      emitToPatient(io, patientId, 'VIDEO_CALL_ENDED', payload);
    }
    emitToRole(io, 'DOCTOR', 'VIDEO_CALL_ENDED', payload);
  }

  return res.status(200).json({ success: true });
});

export default router;
