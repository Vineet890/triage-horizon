import mongoose from 'mongoose';

export const ENCOUNTER_STATUSES = [
  'INTAKE',
  'TRIAGED',
  'ROUTING',
  'AWAITING_ACCEPTANCE',
  'ACCEPTED',
  'EN_ROUTE',
  'CLOSED',
];

export const ACUITY_VALUES = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'];

export const CARE_TIERS = ['telehealth', 'urgent_specialist', 'emergency'];

const timelineSchema = new mongoose.Schema(
  {
    timestamp: { type: String, required: true },
    actor: { type: String, required: true },
    action: { type: String, required: true },
  },
  { _id: false }
);

const agentStepSchema = new mongoose.Schema(
  {
    timestamp: { type: String, required: true },
    tool: { type: String, required: true },
    detail: { type: String, default: '' },
    status: { type: String, default: 'ok' },
  },
  { _id: false }
);

const riskModifierSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    level: { type: String, default: 'INFO' },
    detail: { type: String, default: '' },
    source: { type: String, default: '' },
  },
  { _id: false }
);

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    dosage: { type: String, default: '' },
    schedule: { type: String, default: '' },
    note: { type: String, default: '' },
    doses_per_day: { type: Number, default: 1 },
    times: { type: [String], default: [] },
    as_needed: { type: Boolean, default: false },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescription_id: { type: String, required: true },
    medications: { type: [medicationSchema], default: [] },
    instructions: { type: String, default: '' },
    doctor_id: { type: String, default: null },
    doctor_name: { type: String, default: '' },
    sent_at: { type: String, required: true },
  },
  { _id: false }
);

const encounterSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    patient_id: { type: String, required: true, index: true },
    patient_name: { type: String, default: '' },
    symptom: { type: String, required: true },
    acuity: { type: String, enum: ACUITY_VALUES, default: 'LOW' },
    care_tier: { type: String, enum: CARE_TIERS, default: 'telehealth' },
    status: {
      type: String,
      enum: ENCOUNTER_STATUSES,
      default: 'INTAKE',
      index: true,
    },
    facility_id: { type: String, default: null },
    facility_name: { type: String, default: null },
    facility_snapshot: { type: Object, default: null },
    assigned_doctor_id: { type: String, default: null },
    assigned_doctor_name: { type: String, default: null },
    protocol_matched: { type: String, default: '' },
    agent_rationale: { type: [String], default: [] },
    agent_trace: { type: [agentStepSchema], default: [] },
    timeline: { type: [timelineSchema], default: [] },
    prescription: { type: prescriptionSchema, default: null },
    risk_modifiers: { type: [riskModifierSchema], default: [] },
    special_flags: { type: [String], default: [] },
    selected_facility: { type: Object, default: null },
    rejected_facilities: { type: [Object], default: [] },
    route_update: { type: Object, default: null },
    source: { type: String, default: 'live' },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { minimize: false, versionKey: false }
);

encounterSchema.index({ patient_id: 1, created_at: -1 });
encounterSchema.index({ status: 1, acuity: 1 });

const Encounter =
  mongoose.models.Encounter || mongoose.model('Encounter', encounterSchema);

export default Encounter;
