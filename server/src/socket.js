import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import facilityStateManager from './services/facilityStateManager.js';
import { rerouteAffectedPatients } from './services/rerouteService.js';

let ioInstance = null;

const connectedClients = new Set();

const AUTHENTICATED_ROOMS = ['role:PATIENT', 'role:DOCTOR', 'role:ADMIN'];

/** Returns the active Socket.IO server, if it has been initialised. */
export function getIO() {
  return ioInstance;
}

function canAccessPatient(socket, patientId) {
  if (!socket?.user) return false;
  if (socket.user.role === 'DOCTOR' || socket.user.role === 'ADMIN') return true;
  return socket.user.id === patientId;
}

/** Emits to one patient's private room. */
export function emitToPatient(io, patientId, event, payload) {
  if (!io || !patientId) return false;

  io.to(`patient:${patientId}`).emit(event, payload);
  return true;
}

/** Emits to every connected member of a role. */
export function emitToRole(io, role, event, payload) {
  if (!io || !role) return false;

  io.to(`role:${role}`).emit(event, payload);
  return true;
}

/**
 * Emits to every authenticated portal without leaking events to unauthenticated
 * sockets. This replaces the old io.emit() broadcasts.
 */
export function emitToAuthenticated(io, event, payload) {
  if (!io) return false;

  let target = io;
  for (const room of AUTHENTICATED_ROOMS) {
    target = target.to(room);
  }

  target.emit(event, payload);
  return true;
}

/**
 * The canonical fan-out for a shared encounter: the patient who owns it, every
 * physician, and network operations.
 */
export function emitEncounterUpdated(io, encounter) {
  if (!io || !encounter?.id) return false;

  const payload = {
    ...encounter,
    encounter_id: encounter.id,
    encounter,
  };

  io.to(`patient:${encounter.patient_id}`)
    .to('role:DOCTOR')
    .to('role:ADMIN')
    .emit('ENCOUNTER_UPDATED', payload);

  return true;
}

/** Emits a reroute to the affected patient, physicians and administrators. */
export function emitRouteUpdated(io, update) {
  if (!io || !update?.patient_id) return false;

  io.to(`patient:${update.patient_id}`)
    .to('role:DOCTOR')
    .to('role:ADMIN')
    .emit('ROUTE_UPDATED', update);

  return true;
}

/**
 * Legacy helper retained for modules that still import it. New code should use
 * the targeted helpers above.
 */
export function emitToAll(io, event, payload) {
  return emitToAuthenticated(io, event, payload);
}

function safePayload(payload) {
  return payload && typeof payload === 'object' ? payload : {};
}

function reply(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

/**
 * Creates the Socket.IO server, authenticates every handshake and joins each
 * socket to its role and patient rooms.
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  io.use((socket, next) => {
    const header = socket.handshake.headers?.authorization ?? '';
    const token =
      socket.handshake.auth?.token ??
      (header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '');

    if (!token) {
      next(new Error('AUTH_REQUIRED'));
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId ?? decoded.id ?? null;

      if (!userId || !decoded.role) {
        next(new Error('AUTH_INVALID'));
        return;
      }

      socket.user = {
        id: String(userId),
        role: decoded.role,
      };

      next();
    } catch {
      next(new Error('AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => {
    connectedClients.add(socket.id);

    // Role rooms are the staff fan-out; the patient room is private to the
    // authenticated patient identity and is never joined by staff sockets.
    socket.join(`role:${socket.user.role}`);
    if (socket.user.role === 'PATIENT') {
      socket.join(`patient:${socket.user.id}`);
    }
    socket.join(`user:${socket.user.id}`);

    console.log(
      `[socket.io] ${socket.user.role} ${socket.user.id} connected: ${socket.id} (total: ${connectedClients.size})`
    );

    socket.on('PATIENT_SELECTED', (payload, ack) => {
      const data = safePayload(payload);
      const patientId = data.patient_id ?? data.patientId ?? null;

      if (!patientId || !canAccessPatient(socket, patientId)) {
        reply(ack, { status: 'error', error: 'Not authorised for this patient' });
        return;
      }

      reply(ack, {
        status: 'ok',
        event: 'PATIENT_SELECTED',
        patient_id: patientId,
      });
    });

    socket.on('SYMPTOM_SUBMITTED', (payload, ack) => {
      const data = safePayload(payload);
      const patientId = data.patient_id ?? data.patientId ?? socket.user.id;

      if (!canAccessPatient(socket, patientId)) {
        reply(ack, { status: 'error', error: 'Not authorised for this patient' });
        return;
      }

      reply(ack, {
        status: 'ok',
        event: 'SYMPTOM_SUBMITTED',
        patient_id: patientId,
        received_at: new Date().toISOString(),
      });
    });

    socket.on('SIMULATE_SHOCK', async (payload, ack) => {
      if (socket.user.role !== 'ADMIN') {
        reply(ack, { success: false, error: 'Administrator role required' });
        return;
      }

      const data = safePayload(payload);
      const facilityId = data.facility_id ?? data.facilityId;

      if (!facilityId) {
        reply(ack, { success: false, error: 'facility_id is required' });
        return;
      }

      const state = facilityStateManager.simulateShock(facilityId);

      if (!state) {
        reply(ack, { success: false, error: `Unknown facility '${facilityId}'` });
        return;
      }

      // Rule 7: rerouting is invoked explicitly right after the state change.
      let rerouted;

      try {
        rerouted = await rerouteAffectedPatients(facilityId, io);
      } catch (error) {
        console.error('[socket.io] SIMULATE_SHOCK reroute failed:', error);
        reply(ack, {
          success: false,
          error: 'Facility state changed, but rerouting failed. Retry the shock or refresh state.',
          facility_id: facilityId,
          facility: state,
        });
        return;
      }

      // Operational shock context goes to staff only. Patients receive the
      // precise ROUTE_UPDATED / ENCOUNTER_UPDATED events for their own case.
      io.to('role:ADMIN').to('role:DOCTOR').emit('SIMULATE_SHOCK', {
        facility_id: facilityId,
        status: state.status,
        capacity_pct: state.capacity_pct,
        rerouted_routes: rerouted.length,
        simulated_at: new Date().toISOString(),
      });

      reply(ack, {
        success: true,
        facility_id: facilityId,
        facility: state,
        rerouted,
      });
    });

    socket.on('REQUEST_STATE_SYNC', (payload, ack) => {
      if (!['ADMIN', 'DOCTOR'].includes(socket.user.role)) {
        reply(ack, { status: 'error', error: 'Staff role required' });
        return;
      }

      const syncPayload = {
        facilities: facilityStateManager.getAllStates(),
        connected_clients: connectedClients.size,
        synced_at: new Date().toISOString(),
      };

      socket.emit('ADMIN_STATE_SYNC', syncPayload);
      reply(ack, { status: 'ok', connected_clients: connectedClients.size });
    });

    socket.on('disconnect', (reason) => {
      connectedClients.delete(socket.id);

      console.log(
        `[socket.io] client disconnected: ${socket.id} (${reason}, total: ${connectedClients.size})`
      );
    });
  });

  return io;
}
