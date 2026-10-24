import mongoose from 'mongoose';

const coordinatesSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    distance_km: { type: Number, required: true, min: 0 },
    eta_min: { type: Number, required: true, min: 0 },
    capacity_pct: { type: Number, required: true, min: 0, max: 100 },
    er_beds_available: { type: Number, default: 0, min: 0 },
    er_wait_min: { type: Number, default: 0, min: 0 },
    specialties: { type: [String], default: [] },
    has_cath_lab: { type: Boolean, default: false },
    has_icu: { type: Boolean, default: false },
    status: {
      type: String,
      required: true,
      enum: ['AVAILABLE', 'BUSY', 'OFFLINE', 'LIMITED'],
      default: 'AVAILABLE',
    },
    coordinates: { type: coordinatesSchema, required: true },
    operational_data_simulated: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    id: false,
  }
);

export const Facility =
  mongoose.models.Facility || mongoose.model('Facility', facilitySchema);

export default Facility;
