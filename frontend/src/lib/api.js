import axios from 'axios';
import {
  clearSession,
  readSession,
  SESSION_EXPIRED_EVENT,
  storedSessionToken,
} from './session';

export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') || '';
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const SOCKET_URL = API_ORIGIN;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const session = readSession();

  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';

    // Login failures also return 401; only a rejected bearer session should
    // tear down the portal.
    if (status === 401 && !url.includes('/auth/')) {
      const hadToken = Boolean(storedSessionToken());

      clearSession();

      if (hadToken) {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (error.code === 'ECONNABORTED') {
      return 'The clinical network took too long to respond.';
    }

    if (!error.response) {
      return 'The clinical network is unreachable. Check that the backend is running on port 5000.';
    }
  }

  return fallback;
}

export default api;
