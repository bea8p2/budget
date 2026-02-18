import mongoose from 'mongoose';

const PlannedExpenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  total: Number,
  dueDate: Date,
  category: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('PlannedExpense', PlannedExpenseSchema);
