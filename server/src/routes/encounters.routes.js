import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getEncounter,
  listEncounters,
  updateEncounter,
} from '../services/encounterStore.js';
import {
  acceptEncounter,
  prescribeEncounter,
} from '../services/encounterService.js';
import { assignEncounterToDoctor } from '../services/doctorAssignmentService.js';
import { findUserById } from '../services/userStore.js';
import {
  emitEncounterUpdated,
  emitToPatient,
  getIO,
} from '../socket.js';

const router = express.Router();

router.use(authenticate);

function canReadEncounter(user, encounter) {
  if (!user || !encounter) return false;
  if (user.role === 'ADMIN') return true;
  if (
    user.role === 'DOCTOR' &&
    encounter.assigned_doctor_id === user.userId
  ) {
    return true;
  }
  return user.role === 'PATIENT' && encounter.patient_id === user.userId;
}

async function resolveDoctorName(userId) {
  const account = await findUserById(userId);
  return account?.name || 'Attending clinician';
}

// GET /api/encounters - role-scoped encounter list.
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'PATIENT') {
      filter.patient_id = req.user.userId;
    } else if (req.user.role === 'DOCTOR') {
      filter.assigned_doctor_id = req.user.userId;
    } else if (typeof req.query.patient_id === 'string') {
      filter.patient_id = req.query.patient_id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.active === 'true') {
      filter.activeOnly = true;
    }

    const encounters = await listEncounters(filter);

    return res.status(200).json({
      count: encounters.length,
      encounters,
    });
  } catch (error) {
    console.error('[encounters] list failed:', error);
    return res.status(500).json({ error: 'Unable to load encounters.' });
  }
});

// GET /api/encounters/:id - one shared encounter.
router.get('/:id', async (req, res) => {
  try {
    const encounter = await getEncounter(req.params.id);

    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    if (!canReadEncounter(req.user, encounter)) {
      return res.status(403).json({ error: 'Not authorised for this encounter' });
    }

    return res.status(200).json(encounter);
  } catch (error) {
    console.error('[encounters] read failed:', error);
    return res.status(500).json({ error: 'Unable to load the encounter.' });
  }
});

// POST /api/encounters/:id/assign-doctor - ADMIN only.
router.post(
  '/:id/assign-doctor',
  requireRole(['ADMIN']),
  async (req, res) => {
    const doctorId = typeof req.body?.doctor_id === 'string'
      ? req.body.doctor_id.trim()
      : '';

    if (!doctorId) {
      return res.status(400).json({ error: 'doctor_id is required.' });
    }

    try {
      const result = await assignEncounterToDoctor({
        encounterId: req.params.id,
        doctorId,
        actor: await resolveDoctorName(req.user.userId),
      });

      if (result.error) {
        return res.status(result.statusCode ?? 400).json({ error: result.error });
      }

      const io = getIO();
      if (io) emitEncounterUpdated(io, result.encounter);

      return res.status(200).json({
        success: true,
        encounter: result.encounter,
      });
    } catch (error) {
      console.error('[encounters] doctor assignment failed:', error);
      return res.status(500).json({ error: 'Unable to assign the doctor.' });
    }
  }
);

// POST /api/encounters/:id/accept - DOCTOR only.
router.post(
  '/:id/accept',
  requireRole(['DOCTOR']),
  async (req, res) => {
    try {
      const doctorName = await resolveDoctorName(req.user.userId);
      const result = await acceptEncounter({
        encounterId: req.params.id,
        doctorId: req.user.userId,
        doctorName,
      });

      if (result.error) {
        return res.status(result.statusCode ?? 400).json({ error: result.error });
      }

      const io = getIO();
      if (io) {
        emitEncounterUpdated(io, result.encounter);
        emitToPatient(io, result.encounter.patient_id, 'DOCTOR_ACCEPTED', {
          patient_id: result.encounter.patient_id,
          encounter_id: result.encounter.id,
          doctor_id: result.encounter.assigned_doctor_id,
          doctor_name: result.encounter.assigned_doctor_name,
          accepted_at: result.encounter.updated_at ?? new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        encounter: result.encounter,
      });
    } catch (error) {
      console.error('[encounters] accept failed:', error);
      return res.status(500).json({ error: 'Unable to accept the encounter.' });
    }
  }
);

// POST /api/encounters/:id/prescribe - DOCTOR only.
router.post(
  '/:id/prescribe',
  requireRole(['DOCTOR']),
  async (req, res) => {
    const { medications, instructions } = req.body ?? {};

    try {
      const doctorName = await resolveDoctorName(req.user.userId);
      const result = await prescribeEncounter({
        encounterId: req.params.id,
        doctorId: req.user.userId,
        doctorName,
        medications,
        instructions: instructions ?? '',
      });

      if (result.error) {
        return res.status(result.statusCode ?? 400).json({ error: result.error });
      }

      const io = getIO();
      if (io) {
        emitToPatient(io, result.encounter.patient_id, 'PRESCRIPTION_SENT', {
          encounter_id: result.encounter.id,
          patient_id: result.encounter.patient_id,
          prescription_id: result.prescription.prescription_id,
          prescription: result.prescription,
          medications: result.prescription.medications,
          instructions: result.prescription.instructions,
          doctor_id: result.prescription.doctor_id,
          doctor_name: result.prescription.doctor_name,
          sent_at: result.prescription.sent_at,
        });
        emitEncounterUpdated(io, result.encounter);
      }

      return res.status(200).json({
        success: true,
        prescription_id: result.prescription.prescription_id,
        prescription: result.prescription,
        encounter: result.encounter,
      });
    } catch (error) {
      console.error('[encounters] prescribe failed:', error);
      return res
        .status(500)
        .json({ error: 'Unable to send the prescription.' });
    }
  }
);

// POST /api/encounters/:id/close - staff-only cleanup / discharge.
router.post(
  '/:id/close',
  requireRole(['DOCTOR', 'ADMIN']),
  async (req, res) => {
    try {
      const encounter = await getEncounter(req.params.id);

      if (!encounter) {
        return res.status(404).json({ error: 'Encounter not found' });
      }

      const actor = await resolveDoctorName(req.user.userId);

      const updated = await updateEncounter(encounter.id, {
        status: 'CLOSED',
        timeline: [
          ...encounter.timeline,
          {
            timestamp: new Date().toISOString(),
            actor,
            action: 'Closed the encounter after disposition.',
          },
        ],
      });

      const io = getIO();
      if (io) emitEncounterUpdated(io, updated);

      return res.status(200).json({ success: true, encounter: updated });
    } catch (error) {
      console.error('[encounters] close failed:', error);
      return res.status(500).json({ error: 'Unable to close the encounter.' });
    }
  }
);

export default router;
