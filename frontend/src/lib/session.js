export const SESSION_KEY = 'triage-horizon.session.v1';
export const SESSION_EXPIRED_EVENT = 'triage-horizon:session-expired';

function decodeTokenPayload(token) {
  try {
    const segment = String(token).split('.')[1];
    if (!segment) return null;

    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function isExpired(token) {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;

  return payload.exp * 1000 <= Date.now();
}

export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.token || !parsed?.role || !parsed?.userId) {
      return null;
    }

    if (isExpired(parsed.token)) {
      clearSession();
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

/** Returns the stored token even when it has expired, so callers can tell
 *  "never signed in" apart from "signed in but the token went stale". */
export function storedSessionToken() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}
