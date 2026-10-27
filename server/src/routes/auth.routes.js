import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET } from '../config.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { DEMO_USERS } from '../data/demoUsers.js';
import {
  createUser,
  emailExists,
  findUserByEmail,
  listUsers,
} from '../services/userStore.js';

const router = express.Router();

const TOKEN_TTL = '8h';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_ROLES = ['PATIENT', 'DOCTOR'];

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function issueToken(user) {
  return jwt.sign(
    { userId: user.userId ?? user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function sessionResponse(user) {
  return {
    token: issueToken(user),
    role: user.role,
    userId: user.userId ?? user.id,
    name: user.name ?? '',
    email: user.email ?? '',
    specialty: user.specialty ?? null,
  };
}

function findDemoUser(email, password) {
  return DEMO_USERS.find(
    (candidate) =>
      candidate.email === email && candidate.password === password
  );
}

async function passwordMatches(plainText, hash) {
  if (typeof hash !== 'string' || !hash.startsWith('$2')) {
    return false;
  }

  try {
    return await bcrypt.compare(plainText, hash);
  } catch {
    return false;
  }
}

// POST /api/auth/register - public signup for patients and doctors.
router.post('/register', async (req, res) => {
  const body = req.body ?? {};

  const name = normalizeText(body.name);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const role = normalizeText(body.role).toUpperCase();

  if (name.length < 2) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  if (!SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({
      error: 'Role must be PATIENT or DOCTOR.',
      allowed_roles: SIGNUP_ROLES,
    });
  }

  let licenseNumber = null;
  let specialty = null;
  let yearsExperience = 0;

  if (role === 'DOCTOR') {
    licenseNumber = normalizeText(body.licenseNumber);
    specialty = normalizeText(body.specialty);

    if (licenseNumber.length < 3) {
      return res.status(400).json({ error: 'Medical license number is required.' });
    }

    if (!specialty) {
      return res.status(400).json({ error: 'Select a medical specialty.' });
    }

    if (
      body.yearsExperience === undefined ||
      body.yearsExperience === null ||
      body.yearsExperience === ''
    ) {
      return res.status(400).json({ error: 'Years of experience is required.' });
    }

    yearsExperience = Number(body.yearsExperience);

    if (
      !Number.isFinite(yearsExperience) ||
      yearsExperience < 0 ||
      yearsExperience > 60
    ) {
      return res.status(400).json({
        error: 'Years of experience must be between 0 and 60.',
      });
    }
  }

  try {
    if (await emailExists(email)) {
      return res
        .status(409)
        .json({ error: 'An account with this email already exists.' });
    }

    const user = await createUser({
      name,
      email,
      password,
      role,
      licenseNumber,
      specialty,
      yearsExperience,
    });

    return res.status(201).json(sessionResponse(user));
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ error: 'An account with this email already exists.' });
    }

    console.error('[auth] Registration failed:', error.message);
    return res.status(500).json({ error: 'Unable to create the account.' });
  }
});

// POST /api/auth/login - MongoDB first, then synthetic demo accounts.
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    const registered = await findUserByEmail(normalizedEmail);

    if (registered) {
      const valid = await passwordMatches(password, registered.password);

      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      return res.status(200).json(sessionResponse(registered));
    }
  } catch (error) {
    console.error('[auth] Login lookup failed:', error.message);
  }

  const demo = findDemoUser(normalizedEmail, password);

  if (!demo) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.status(200).json(sessionResponse(demo));
});

// GET /api/auth/users - ADMIN only. Password hashes are never returned.
router.get('/users', authenticate, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await listUsers();
    return res.status(200).json(users);
  } catch (error) {
    console.error('[auth] User listing failed:', error.message);
    return res.status(500).json({ error: 'Unable to load registered users.' });
  }
});

export default router;
