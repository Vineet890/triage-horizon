import mongoose from 'mongoose';

const previousVisitSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    facility: { type: String, required: true },
    reason: { type: String, required: true },
    outcome: { type: String, default: '' },
  },
  { _id: false }
);

const insuranceSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    policy_number: { type: String, required: true },
    coverage: { type: String, default: '' },
    valid_until: { type: String, default: null },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    relation: { type: String, default: '' },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    display_id: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true },
    blood_type: { type: String, default: null },
    allergies: { type: [String], default: [] },
    conditions: { type: [String], default: [] },
    medications: { type: [String], default: [] },
    previous_visits: { type: [previousVisitSchema], default: [] },
    insurance: { type: insuranceSchema, default: null },
    emergency_contact: { type: emergencyContactSchema, default: null },
    is_synthetic: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    // Disable Mongoose's `id` virtual so the synthetic business id can own the name.
    id: false,
  }
);

export const Patient =
  mongoose.models.Patient || mongoose.model('Patient', patientSchema);

export default Patient;
