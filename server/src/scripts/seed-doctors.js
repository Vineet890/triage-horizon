import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const DOCTORS = [
  {
    name: 'Dr. Riya Shah',
    email: 'riya.shah@triagehorizon.demo',
    licenseNumber: 'MCI-TH-002',
    specialty: 'Emergency Medicine',
    yearsExperience: 9,
  },
  {
    name: 'Dr. Kabir Rao',
    email: 'kabir.rao@triagehorizon.demo',
    licenseNumber: 'MCI-TH-003',
    specialty: 'Cardiology',
    yearsExperience: 12,
  },
  {
    name: 'Dr. Ananya Iyer',
    email: 'ananya.iyer@triagehorizon.demo',
    licenseNumber: 'MCI-TH-004',
    specialty: 'Neurology',
    yearsExperience: 8,
  },
  {
    name: 'Dr. Dev Malhotra',
    email: 'dev.malhotra@triagehorizon.demo',
    licenseNumber: 'MCI-TH-005',
    specialty: 'General Medicine',
    yearsExperience: 10,
  },
];

function generatePassword() {
  return crypto.randomBytes(18).toString('base64url');
}

async function seedDoctors() {
  await connectDB();

  const credentials = [];

  for (const profile of DOCTORS) {
    const existing = await User.findOne({ email: profile.email })
      .select('_id')
      .lean();

    if (existing) {
      console.log(`[seed:doctors] Existing doctor preserved: ${profile.email}`);
      continue;
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const doctor = await User.create({
      ...profile,
      email: profile.email,
      role: 'DOCTOR',
      password: passwordHash,
    });

    credentials.push({
      id: String(doctor._id),
      name: profile.name,
      email: profile.email,
      password,
    });
  }

  if (credentials.length > 0) {
    console.log(
      '[seed:doctors] Save these one-time passwords securely; they are not stored in plaintext:'
    );
    credentials.forEach((credential) => {
      console.log(
        `${credential.name} | id=${credential.id} | email=${credential.email} | password=${credential.password}`
      );
    });
  } else {
    console.log(
      '[seed:doctors] No new accounts created; existing passwords were left unchanged.'
    );
  }

  await mongoose.disconnect();
}

seedDoctors().catch(async (error) => {
  console.error('[seed:doctors] Seeding failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
