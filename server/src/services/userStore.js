import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { isDatabaseConnected } from '../config/db.js';
import { DEMO_USERS } from '../data/demoUsers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SALT_ROUNDS = 10;

/**
 * Degraded-mode account persistence.
 *
 * MongoDB is the primary store. When Atlas is unreachable the demo still needs
 * working signup and login, so accounts are written to a local JSON file with
 * bcrypt-hashed passwords. The file lives outside src/ so `node --watch` does
 * not restart the server when a new account is created.
 */
function ensureStoreDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFileUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];

    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`[users] Unable to read ${USERS_FILE}:`, error.message);
    return [];
  }
}

function writeFileUsers(users) {
  ensureStoreDirectory();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: String(user.id ?? user._id ?? ''),
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'PATIENT',
    licenseNumber: user.licenseNumber ?? null,
    specialty: user.specialty ?? null,
    yearsExperience: Number(user.yearsExperience) || 0,
    createdAt: user.createdAt ?? null,
  };
}

function sortNewestFirst(users) {
  return [...users].sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    return bTime - aTime;
  });
}

/**
 * Returns a registered user including the password hash. Callers must never
 * send this object directly to a client.
 */
export async function findUserByEmail(email) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (isDatabaseConnected()) {
    try {
      const user = await User.findOne({ email: normalizedEmail })
        .select('+password')
        .lean();

      if (user) {
        return {
          ...publicUser(user),
          password: user.password,
        };
      }
    } catch (error) {
      console.error(
        `[users] MongoDB lookup failed for '${normalizedEmail}', using local store:`,
        error.message
      );
    }
  }

  const user = readFileUsers().find(
    (candidate) => candidate.email === normalizedEmail
  );

  return user ? { ...publicUser(user), password: user.password } : null;
}

/**
 * Resolves the public profile for a JWT subject. Used by encounter routes to
 * attach the accepting physician's name without trusting a client payload.
 */
export async function findUserById(userId) {
  const normalizedId = String(userId ?? '').trim();
  if (!normalizedId) return null;

  // Synthetic demo identities never reach MongoDB; resolve them first so the
  // accepting physician's real display name is stored on the encounter.
  const demo = DEMO_USERS.find(
    (candidate) => candidate.userId === normalizedId
  );

  if (demo) {
    return {
      id: demo.userId,
      name: demo.name,
      email: demo.email,
      role: demo.role,
      licenseNumber: demo.licenseNumber ?? null,
      specialty: demo.specialty ?? null,
      yearsExperience: Number(demo.yearsExperience) || 0,
      createdAt: null,
    };
  }

  if (isDatabaseConnected()) {
    try {
      const user = await User.findById(normalizedId).select('-password').lean();
      if (user) return publicUser(user);
    } catch (error) {
      console.error(
        `[users] MongoDB id lookup failed for '${normalizedId}', using local store:`,
        error.message
      );
    }
  }

  const user = readFileUsers().find(
    (candidate) => String(candidate.id) === normalizedId
  );

  return user ? publicUser(user) : null;
}

export async function emailExists(email) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  if (isDatabaseConnected()) {
    try {
      const exists = await User.exists({ email: normalizedEmail });
      if (exists) return true;
    } catch (error) {
      console.error(
        `[users] MongoDB existence check failed for '${normalizedEmail}':`,
        error.message
      );
    }
  }

  return readFileUsers().some((user) => user.email === normalizedEmail);
}

export async function createUser({
  email,
  password,
  name,
  role,
  licenseNumber = null,
  specialty = null,
  yearsExperience = 0,
}) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  if (isDatabaseConnected()) {
    try {
      const user = await User.create({
        email: normalizedEmail,
        password: passwordHash,
        name: String(name).trim(),
        role,
        licenseNumber: role === 'DOCTOR' ? licenseNumber : null,
        specialty: role === 'DOCTOR' ? specialty : null,
        yearsExperience: role === 'DOCTOR' ? Number(yearsExperience) || 0 : 0,
      });

      return publicUser(user.toObject());
    } catch (error) {
      // Duplicate-key errors are surfaced to the route so it can return 409.
      if (error?.code === 11000) throw error;

      console.error(
        `[users] MongoDB write failed for '${normalizedEmail}', using local store:`,
        error.message
      );
    }
  }

  const users = readFileUsers();

  if (users.some((user) => user.email === normalizedEmail)) {
    const duplicate = new Error('An account with this email already exists.');
    duplicate.code = 11000;
    throw duplicate;
  }

  const user = {
    id: `usr_${crypto.randomBytes(6).toString('hex')}`,
    email: normalizedEmail,
    password: passwordHash,
    name: String(name).trim(),
    role,
    licenseNumber: role === 'DOCTOR' ? licenseNumber : null,
    specialty: role === 'DOCTOR' ? specialty : null,
    yearsExperience: role === 'DOCTOR' ? Number(yearsExperience) || 0 : 0,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeFileUsers(users);

  return publicUser(user);
}

export async function listUsers() {
  const byEmail = new Map();

  if (isDatabaseConnected()) {
    try {
      const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .lean();

      users.forEach((user) => {
        const safe = publicUser(user);
        byEmail.set(safe.email, safe);
      });
    } catch (error) {
      console.error('[users] MongoDB list failed, using local store:', error.message);
    }
  }

  readFileUsers().forEach((user) => {
    const safe = publicUser(user);
    if (!byEmail.has(safe.email)) {
      byEmail.set(safe.email, safe);
    }
  });

  return sortNewestFirst(Array.from(byEmail.values()));
}

export default {
  createUser,
  emailExists,
  findUserByEmail,
  findUserById,
  listUsers,
};
