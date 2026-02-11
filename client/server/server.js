import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
console.log("DEBUG MONGODB_URI:", process.env.MONGODB_URI);
console.log("DEBUG DB_NAME:", process.env.DB_NAME);

mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) =>
  res.json({ ok: true, message: 'Server is running!', now: new Date().toISOString() })
);

// Routes
app.use('/auth', (await import('./routes/auth.js')).default);
app.use('/accounts', (await import('./routes/accounts.js')).default);
app.use('/transactions', (await import('./routes/transactions.js')).default);
app.use('/budgets', (await import('./routes/budgets.js')).default);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🚀 API on http://localhost:${port}`));
