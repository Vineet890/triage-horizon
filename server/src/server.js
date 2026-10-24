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
app.use('/api/video', videoRoutes);
app.use('/api/handoff', handoffRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

/**
 * Connects to MongoDB before accepting traffic. A failed connection aborts
 * startup instead of serving requests against a half-initialised store.
 */
async function startServer() {
  try {
    await connectDB();
  } catch {
    console.error(
      '[server] Startup aborted. Start MongoDB or update MONGODB_URI in server/.env.'
    );
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`[server] Triage Horizon backend listening on port ${PORT}`);
  });
}

startServer();

export { app, io, httpServer };
