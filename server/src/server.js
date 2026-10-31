import express from 'express';
import cors from 'cors';
import http from 'node:http';
import mongoose from 'mongoose';
import { PORT } from './config.js';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';
import facilityStateManager from './services/facilityStateManager.js';
import authRoutes from './routes/auth.routes.js';
import facilitiesRoutes from './routes/facilities.routes.js';
import triageRoutes from './routes/triage.routes.js';
import videoRoutes from './routes/video.routes.js';
import handoffRoutes from './routes/handoff.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import encountersRoutes from './routes/encounters.routes.js';
import medicationsRoutes from './routes/medications.routes.js';
import { runMedicationReminderSweep } from './services/medicationPlanStore.js';

const app = express();

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

// Socket.IO is created first so routes and services can emit through it.
const io = initSocket(httpServer);
facilityStateManager.setIO(io);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'triage-horizon-backend',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/encounters', encountersRoutes);
app.use('/api/medications', medicationsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/handoff', handoffRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

/**
 * Connects to MongoDB before accepting traffic. When the cluster is
 * unreachable the server still starts in degraded demo mode: facilities come
 * from the seeded in-memory state and patient handoffs from demo data.
 */
async function startServer() {
  try {
    await connectDB();
  } catch {
    console.warn(
      '[server] MongoDB unavailable. Starting in degraded demo mode with file-backed data.'
    );
  }

  httpServer.listen(PORT, () => {
    console.log(`[server] Triage Horizon backend listening on port ${PORT}`);
  });

  const sweepMedicationReminders = () => {
    runMedicationReminderSweep().catch((error) => {
      console.error('[medications] Reminder sweep failed:', error);
    });
  };
  sweepMedicationReminders();

  const reminderTimer = setInterval(sweepMedicationReminders, 30_000);
  reminderTimer.unref();
}

startServer();

export { app, io, httpServer };
