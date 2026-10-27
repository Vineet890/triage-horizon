import { io } from 'socket.io-client';
import { SOCKET_URL } from './api';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
  timeout: 12000,
});

export default socket;
