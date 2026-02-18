// User model
// Minimal user for email/password auth (JWT will come later)

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true }, // store bcrypt hash ONLY
    createdAt: { type: Date, default: () => new Date() }
  },
  { versionKey: false }
);

export default mongoose.model('User', userSchema);