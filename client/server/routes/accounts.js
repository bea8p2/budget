// server/routes/accounts.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Account from '../models/Account.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /accounts
 * returns: list of accounts for current user
 */
router.get('/', async (req, res) => {
  try {
    const items = await Account.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected error' });
  }
});

/**
 * POST /accounts
 * body: { name, type, currency }
 * validations:
 *  - name: required, trimmed, length > 0
 *  - type: one of allowed enum
 *  - currency: optional, default 'USD'
 */
router.post('/', async (req, res) => {
  try {
    let { name, type, currency } = req.body || {};

    // Normalize inputs
    name = (name ?? '').toString().trim();
    type = (type ?? '').toString().trim();
    currency = ((currency ?? 'USD').toString().trim()) || 'USD';

    // Validation
    const allowedTypes = ['checking', 'credit', 'cash', 'savings', 'other'];
    if (!name) {
      return res.status(400).json({ error: 'Account name is required.' });
    }
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid account type. Use one of: ${allowedTypes.join(', ')}` });
    }
    if (currency.length !== 3) {
      return res.status(400).json({ error: 'Currency must be a 3-letter ISO code (e.g., USD).' });
    }

    const item = await Account.create({ userId: req.user.id, name, type, currency });
    return res.status(201).json(item);
  } catch (err) {
    // handle duplicate (userId, name) unique index
    if (err?.code === 11000) {
      return res.status(400).json({ error: 'An account with this name already exists for this user.' });
    }
    return res.status(400).json({ error: err.message || 'Could not create account.' });
  }
});

export default router;