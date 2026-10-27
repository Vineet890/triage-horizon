import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Stored as a bcrypt hash. The schema transform below guarantees the hash
    // is never serialised into an API response.
    password: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['PATIENT', 'DOCTOR', 'ADMIN'],
      default: 'PATIENT',
    },
    licenseNumber: {
      type: String,
      trim: true,
      required: function requiredForDoctor() {
        return this.role === 'DOCTOR';
      },
      default: null,
    },
    specialty: {
      type: String,
      trim: true,
      required: function requiredForDoctor() {
        return this.role === 'DOCTOR';
      },
      default: null,
    },
    yearsExperience: {
      type: Number,
      min: 0,
      max: 60,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
    id: false,
    toJSON: {
      transform: (_document, result) => {
        delete result.password;
        return result;
      },
    },
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
