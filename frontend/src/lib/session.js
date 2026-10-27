export const SESSION_KEY = 'triage-horizon.session.v1';

export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.token || !parsed?.role || !parsed?.userId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}
