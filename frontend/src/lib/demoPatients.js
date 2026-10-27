export const DEMO_PATIENTS = [
  {
    id: 'patient_001',
    display_id: 'TH-P-001',
    name: 'Aarav Mehta',
    age: 24,
    gender: 'Male',
    blood_type: 'O+',
    allergies: ['Penicillin'],
    conditions: ['Mild persistent asthma'],
    medications: ['Albuterol 100 mcg inhaler (as needed)'],
    sample:
      'Persistent wheezing and mild chest tightness after climbing stairs. My reliever inhaler has been used twice today with only partial relief.',
    vitals: {
      blood_pressure: '128/82 mmHg',
      heart_rate: '92 bpm',
      respiratory_rate: '22 /min',
      oxygen_saturation: '94% on room air',
      temperature: '37.1 °C',
    },
  },
  {
    id: 'patient_002',
    display_id: 'TH-P-002',
    name: 'Gurpreet Singh',
    age: 71,
    gender: 'Male',
    blood_type: 'B+',
    allergies: ['Sulfonamides'],
    conditions: ['Type 2 diabetes mellitus', 'Hypertension', 'Atrial fibrillation'],
    medications: [
      'Metformin 1000 mg twice daily',
      'Amlodipine 5 mg once daily',
      'Warfarin 5 mg once daily (INR target 2.0–3.0)',
    ],
    sample:
      'Sudden palpitations with dizziness and new left-arm weakness. I take warfarin daily and feel unsteady.',
    vitals: {
      blood_pressure: '168/96 mmHg',
      heart_rate: '118 bpm, irregular',
      respiratory_rate: '20 /min',
      oxygen_saturation: '96% on room air',
      temperature: '36.9 °C',
    },
  },
  {
    id: 'patient_003',
    display_id: 'TH-P-003',
    name: 'Ananya Sharma',
    age: 29,
    gender: 'Female',
    blood_type: 'A-',
    allergies: [],
    conditions: ['Generalized anxiety disorder', 'Mild gastroesophageal reflux disease'],
    medications: ['Escitalopram 10 mg once daily', 'Pantoprazole 40 mg once daily'],
    sample:
      'Recurring heartburn and difficulty swallowing, worse during anxiety episodes. No vomiting, weight loss or bleeding.',
    vitals: {
      blood_pressure: '118/76 mmHg',
      heart_rate: '88 bpm',
      respiratory_rate: '16 /min',
      oxygen_saturation: '99% on room air',
      temperature: '36.7 °C',
    },
  },
];

export const PATIENT_DIRECTORY = Object.fromEntries(
  DEMO_PATIENTS.map((patient) => [patient.id, patient])
);

/**
 * Resolves the patient profile for a signed-in session. Seeded demo accounts
 * keep their clinical record; registered accounts receive a minimal synthetic
 * profile derived from their own identity instead of inheriting patient_001.
 */
export function buildPatientProfile(auth) {
  const demo = DEMO_PATIENTS.find((patient) => patient.id === auth?.userId);
  if (demo) return demo;
  if (!auth?.userId) return null;

  return {
    id: auth.userId,
    display_id: `TH-P-${String(auth.userId).slice(-4).toUpperCase()}`,
    name: auth.name || 'Patient',
    age: null,
    gender: '',
    blood_type: 'Not recorded',
    allergies: [],
    conditions: [],
    medications: [],
    sample: DEMO_PATIENTS[0].sample,
    vitals: null,
    is_synthetic: true,
  };
}

export function patientName(patientId) {
  return PATIENT_DIRECTORY[patientId]?.name ?? patientId ?? 'Unknown patient';
}

export function patientVitals(patientId) {
  return PATIENT_DIRECTORY[patientId]?.vitals ?? null;
}
