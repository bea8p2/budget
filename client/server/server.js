// server/server.js
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- DB connect ---
const uri = process.env.MONGODB_URI; // set in your .env
const dbName = process.env.DB_NAME || 'budget_app';

async function start() {
  try {
    await mongoose.connect(uri, { dbName });
    console.log('✅ MongoDB connected');

    // Import models so Mongoose registers them
    await import('./models/User.js');
    await import('./models/Account.js');
    await import('./models/Transaction.js');
    await import('./models/Budget.js');

    // Health check
    app.get('/health', (_, res) => res.json({ ok: true, db: dbName, now: new Date().toISOString() }));

    // Routes
    app.use('/auth', (await import('./routes/auth.js')).default);
    app.use('/accounts', (await import('./routes/accounts.js')).default);
    app.use('/transactions', (await import('./routes/transactions.js')).default);
    app.use('/budgets', (await import('./routes/budgets.js')).default);

    const port = process.env.PORT || 4000;
    app.listen(port, () => console.log(`🚀 API on http://localhost:${port}`));
  } catch (err) {
    console.error('Mongo connection error:', err.message);
    process.exit(1);
  }
}

start();