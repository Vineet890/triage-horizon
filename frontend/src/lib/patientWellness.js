// Synthetic patient-facing wellness data used by the patient portal modules.
// These values are intentionally local so the demo remains deterministic.

export const MEDICATION_PLAN = [
  {
    id: 'med-budesonide',
    name: 'Budesonide / Formoterol',
    dose: '2 puffs (160/4.5 mcg)',
    schedule: 'Twice daily',
    time: '08:00 · 20:00',
    times: ['08:00', '20:00'],
    doses_per_day: 2,
    as_needed: false,
    category: 'Controller inhaler',
    note: 'Rinse your mouth after each dose.',
  },
  {
    id: 'med-montelukast',
    name: 'Montelukast',
    dose: '1 tablet (10 mg)',
    schedule: 'Once daily at bedtime',
    time: '22:00',
    times: ['22:00'],
    doses_per_day: 1,
    as_needed: false,
    category: 'Oral controller',
    note: 'Take at the same time each night.',
  },
  {
    id: 'med-albuterol',
    name: 'Albuterol',
    dose: '2 puffs (100 mcg)',
    schedule: 'As needed · max 4 doses/day',
    time: 'PRN',
    times: [],
    doses_per_day: 1,
    as_needed: true,
    category: 'Reliever inhaler',
    note: 'Log every reliever use so your clinician can review it.',
  },
  {
    id: 'med-vitamin-d',
    name: 'Vitamin D3',
    dose: '1 capsule (1000 IU)',
    schedule: 'Once daily with breakfast',
    time: '08:00',
    times: ['08:00'],
    doses_per_day: 1,
    as_needed: false,
    category: 'Supplement',
    note: 'Take with food for better absorption.',
  },
];

export const WEEKLY_ADHERENCE = [
  { day: 'Mon', value: 100 },
  { day: 'Tue', value: 75 },
  { day: 'Wed', value: 100 },
  { day: 'Thu', value: 50 },
  { day: 'Fri', value: 100 },
  { day: 'Sat', value: 75 },
  { day: 'Sun', value: 75 },
];

export const MOOD_LEVELS = [
  { value: 1, emoji: '😞', label: 'Very low' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😕', label: 'Struggling' },
  { value: 4, emoji: '😐', label: 'Flat' },
  { value: 5, emoji: '🙂', label: 'Okay' },
  { value: 6, emoji: '😊', label: 'Fair' },
  { value: 7, emoji: '😄', label: 'Good' },
  { value: 8, emoji: '😁', label: 'Great' },
  { value: 9, emoji: '🤩', label: 'Very good' },
  { value: 10, emoji: '😃', label: 'Excellent' },
];

export const MOOD_HISTORY = [
  {
    date: '24 Oct',
    mood: 6,
    note: 'Breathing felt easier after the evening walk.',
  },
  {
    date: '23 Oct',
    mood: 4,
    note: 'Wheezing woke me around 3am. Used the reliever once.',
  },
  {
    date: '22 Oct',
    mood: 7,
    note: 'Good day. Completed all controller doses on time.',
  },
];
