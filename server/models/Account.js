// Account model
// Lets a user track multiple sources (checking, credit card, cash, etc.)

import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true }, // e.g., "Checking", "Visa"
    type: { type: String, enum: ['checking', 'credit', 'cash', 'savings', 'other'], required: true },
    currency: { type: String, default: 'USD' }, // ISO 4217 code
    createdAt: { type: Date, default: () => new Date() }
  },
  { versionKey: false }
);

accountSchema.index({ userId: 1, name: 1 }, { unique: true }); // prevent duplicate names per user

export default mongoose.model('Account', accountSchema);
``