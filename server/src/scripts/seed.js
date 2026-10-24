import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Patient from '../models/Patient.js';
import Facility from '../models/Facility.js';
import patientsData from '../data/patients.json' with { type: 'json' };
import facilitiesData from '../data/facilities.json' with { type: 'json' };

/**
 * Idempotent seed: inserts the synthetic demo records only when each
 * collection is empty, so re-running the script never duplicates data.
 */
async function seed() {
  await connectDB();

  let inserted = 0;

  const patientCount = await Patient.countDocuments();

  if (patientCount === 0) {
    const patients = await Patient.insertMany(patientsData);
    inserted += patients.length;
    console.log(`[seed] Inserted ${patients.length} patients`);
  } else {
    console.log(`[seed] Patients already present (${patientCount}), skipping`);
  }

  const facilityCount = await Facility.countDocuments();

  if (facilityCount === 0) {
    const facilities = await Facility.insertMany(facilitiesData);
    inserted += facilities.length;
    console.log(`[seed] Inserted ${facilities.length} facilities`);
  } else {
    console.log(`[seed] Facilities already present (${facilityCount}), skipping`);
  }

  if (inserted === 0) {
    console.log('Database already seeded, skipping');
  } else {
    console.log('Database seeded successfully');
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (error) => {
  console.error('[seed] Seeding failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
