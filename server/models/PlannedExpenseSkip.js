import mongoose from 'mongoose';

const PlannedExpenseSkipSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  plannedExpenseId: mongoose.Schema.Types.ObjectId,
  year: Number,
  month: Number
});

export default mongoose.model('PlannedExpenseSkip', PlannedExpenseSkipSchema);
