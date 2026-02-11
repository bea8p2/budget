// Budget model
// Stores monthly category limits per user (no rollover in MVP)

import mongoose from 'mongoose';

const limitSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    limit: { type: Number, required: true } // positive number; compare to sum of expenses (negative)
  },
  { _id: false }
);

const budgetSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    period: {
      year: { type: Number, required: true },
      month: { type: Number, min: 1, max: 12, required: true }
    },
    limits: { type: [limitSchema], default: [] } // [{ category, limit }]
  },
  { timestamps: true, versionKey: false }
);

// Enforce one budget doc per (user, year, month)
budgetSchema.index(
  { userId: 1, 'period.year': 1, 'period.month': 1 },
  { unique: true }
);

export default mongoose.model('Budget', budgetSchema);