/**
 * Synthetic demo accounts.
 *
 * These are intentionally not persisted: they exist so the three portals can be
 * demonstrated without a seeded user database. Never reuse these credentials in
 * production. Keeping the list in its own module lets both the auth route and
 * the user store resolve the same identities without a circular import.
 */
export const DEMO_USERS = [
  {
    email: 'patient@demo.com',
    password: 'patient123',
    role: 'PATIENT',
    userId: 'patient_001',
    name: 'Aarav Mehta',
  },
  {
    email: 'ananya@demo.com',
    password: 'patient123',
    role: 'PATIENT',
    userId: 'patient_003',
    name: 'Ananya Sharma',
  },
  {
    email: 'doctor@demo.com',
    password: 'doctor123',
    role: 'DOCTOR',
    userId: 'doctor_001',
    name: 'Dr. Mira Sen',
    specialty: 'Emergency Medicine',
    licenseNumber: 'MCI-DEMO-001',
    yearsExperience: 11,
  },
  {
    email: 'admin@demo.com',
    password: 'admin123',
    role: 'ADMIN',
    userId: 'admin_001',
    name: 'Network Admin',
  },
];

export default DEMO_USERS;
