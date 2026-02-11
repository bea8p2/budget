// server/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { notFoundHandler, errorHandler } from './middleware/error.js';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'budget_app';
const port = process.env.PORT || 4000;

if (!uri) {
  console.error('Missing MONGODB_URI environment variable.');
  process.exit(1);
}

console.log('DEBUG MONGODB_URI:', uri);
console.log('DEBUG DB_NAME:', dbName);

async function start() {
  try {
    // Connect using dbName option (cleaner than URI concatenation)
    await mongoose.connect(uri, { dbName });
    console.log('✅ MongoDB connected');

    // Register models so indexes & validators are in place
    await import('./models/User.js');
    await import('./models/Account.js');
    await import('./models/Transaction.js');
    await import('./models/Budget.js');

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Health check
    app.get('/health', (_req, res) => {
      res.json({ ok: true, message: 'Server is running!', now: new Date().toISOString() });
    });

    // Routes
    app.use('/auth', (await import('./routes/auth.js')).default);
    app.use('/accounts', (await import('./routes/accounts.js')).default);
    app.use('/transactions', (await import('./routes/transactions.js')).default);
    app.use('/budgets', (await import('./routes/budgets.js')).default);

    // Friendly errors: 404 first, then central formatter
    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(port, () => {
      console.log(`🚀 API on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

start();