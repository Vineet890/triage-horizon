import { Server } from 'socket.io';
import facilityStateManager from './services/facilityStateManager.js';
import { rerouteAffectedPatients } from './services/rerouteService.js';

let ioInstance = null;

const connectedClients = new Set();

/** Emits an event to every connected client. */
export function emitToAll(io, event, payload) {
  if (!io) {
    return false;
  }

  io.emit(event, payload);
  return true;
}

/** Returns the active Socket.IO server, if it has been initialised. */
export function getIO() {
  return ioInstance;
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
 * Creates the Socket.IO server, registers realtime handlers and stores the
 * instance for other modules (triage routes, state manager, rerouting).
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    connectedClients.add(socket.id);

    console.log(
      `[socket.io] client connected: ${socket.id} (total: ${connectedClients.size})`
    );

    socket.on('PATIENT_SELECTED', (payload, ack) => {
      const data = safePayload(payload);

      console.log(
        `[socket.io] PATIENT_SELECTED from ${socket.id}: ${data.patient_id ?? data.patientId ?? 'unknown'}`
      );

      reply(ack, {
        status: 'ok',
        event: 'PATIENT_SELECTED',
        patient_id: data.patient_id ?? data.patientId ?? null,
      });
    });

    socket.on('SYMPTOM_SUBMITTED', (payload, ack) => {
      const data = safePayload(payload);

      console.log(
        `[socket.io] SYMPTOM_SUBMITTED from ${socket.id}: patient=${data.patient_id ?? data.patientId ?? 'unknown'}`
      );

      reply(ack, {
        status: 'ok',
        event: 'SYMPTOM_SUBMITTED',
        patient_id: data.patient_id ?? data.patientId ?? null,
        received_at: new Date().toISOString(),
      });
    });

    socket.on('SIMULATE_SHOCK', (payload, ack) => {
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
      const rerouted = rerouteAffectedPatients(facilityId, io);

      emitToAll(io, 'SIMULATE_SHOCK', {
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
