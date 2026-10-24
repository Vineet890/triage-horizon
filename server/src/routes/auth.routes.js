import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

const router = express.Router();

const TOKEN_TTL = '8h';

// Synthetic demo accounts only. Never use hardcoded credentials in production.
const DEMO_USERS = [
  {
    email: 'patient@demo.com',
    password: 'patient123',
    role: 'PATIENT',
    userId: 'patient_001',
  },
  {
    email: 'doctor@demo.com',
    password: 'doctor123',
    role: 'DOCTOR',
    userId: 'doctor_001',
  },
  {
    email: 'admin@demo.com',
    password: 'admin123',
    role: 'ADMIN',
    userId: 'admin_001',
  },
];

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = DEMO_USERS.find(
    (candidate) =>
      candidate.email === normalizedEmail && candidate.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { userId: user.userId, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  return res.status(200).json({
    token,
    role: user.role,
    userId: user.userId,
  });
});

export default router;
