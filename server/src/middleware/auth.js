import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

/**
 * Verifies the JWT sent in the `Authorization: Bearer <token>` header.
 * On success attaches `{ userId, role }` to `req.user`.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      userId: decoded.userId ?? decoded.id ?? null,
      role: decoded.role ?? null,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Guards a route to one or more roles.
 * Must be used after `authenticate`.
 */
export function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required_roles: allowedRoles,
      });
    }

    return next();
  };
}
