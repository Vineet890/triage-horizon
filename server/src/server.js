import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { PORT } from './config.js';
import { initSocket } from './socket.js';
import facilityStateManager from './services/facilityStateManager.js';
import authRoutes from './routes/auth.routes.js';
import facilitiesRoutes from './routes/facilities.routes.js';
import triageRoutes from './routes/triage.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

// Socket.IO is created first so routes and services can emit through it.
const io = initSocket(httpServer);
facilityStateManager.setIO(io);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'triage-horizon-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/triage', triageRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

httpServer.listen(PORT, () => {
  console.log(`[server] Triage Horizon backend listening on port ${PORT}`);
});

export { app, io, httpServer };
