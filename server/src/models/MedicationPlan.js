import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    dosage: { type: String, default: '' },
    schedule: { type: String, default: '' },
    doses_per_day: { type: Number, default: 1 },
    times: { type: [String], default: [] },
    note: { type: String, default: '' },
    category: { type: String, default: '' },
    prescription_id: { type: String, default: null },
    doctor_name: { type: String, default: '' },
    as_needed: { type: Boolean, default: false },
  },
  { _id: false }
);

const doseEventSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    medication_id: { type: String, required: true },
    medication_name: { type: String, required: true },
    dosage: { type: String, default: '' },
    scheduled_time: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['taken'], default: 'taken' },
    taken_at: { type: String, required: true },
  },
  { _id: false }
);

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    created_at: { type: String, required: true },
  },
  { _id: false }
);

const medicationPlanSchema = new mongoose.Schema(
  {
    patient_id: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: 'UTC' },
    medications: { type: [medicationSchema], default: [] },
    dose_events: { type: [doseEventSchema], default: [] },
    push_subscriptions: { type: [pushSubscriptionSchema], default: [] },
    reminder_keys: { type: [String], default: [] },
    updated_at: { type: String, required: true },
  },
  { minimize: false, versionKey: false }
);

const MedicationPlan =
  mongoose.models.MedicationPlan ||
  mongoose.model('MedicationPlan', medicationPlanSchema);

export default MedicationPlan;
