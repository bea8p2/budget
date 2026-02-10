// Transaction model
// One row per income/expense. Convention: expenses are NEGATIVE numbers.

import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: mongoose.Types.ObjectId, ref: 'Account', required: true, index: true },
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true }, // expense: -45.20, income: 2500
    category: { type: String, required: true, index: true }, // e.g., "Groceries", "Rent"
    note: { type: String },
    tags: [{ type: String }]
  },
  { timestamps: true, versionKey: false }
);

// Helpful compound indexes for common queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });

export default mongoose.model('Transaction', transactionSchema);