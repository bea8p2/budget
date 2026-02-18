import mongoose from 'mongoose';

const RecurringBudgetLineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('RecurringBudgetLine', RecurringBudgetLineSchema);
