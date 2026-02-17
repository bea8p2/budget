import mongoose from 'mongoose';

const RecurringSkipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  category: { type: String, required: true },
  year: Number,
  month: Number
});

export default mongoose.model('RecurringSkip', RecurringSkipSchema);
