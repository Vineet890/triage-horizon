import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import { PORT } from './config.js';

const app = express();

app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'triage-horizon-backend' });
});

io.on('connection', (socket) => {
  console.log(`[socket.io] client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[socket.io] client disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] Triage Horizon backend listening on port ${PORT}`);
});

export { app, io, httpServer };
