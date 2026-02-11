// server/routes/accounts.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Account from '../models/Account.js';
import { asyncHandler, badRequest } from '../utils/errors.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /accounts
 * returns: list of accounts for current user
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await Account.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  })
);

/**
 * POST /accounts
 * body: { name, type, currency }
 * validations:
 *  - name: required, trimmed, length > 0
 *  - type: one of allowed enum
 *  - currency: optional, default 'USD'
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    let { name, type, currency } = req.body || {};

    // Normalize inputs
    name = (name ?? '').toString().trim();
    type = (type ?? '').toString().trim();
    currency = ((currency ?? 'USD').toString().trim()) || 'USD';

    // Validation
    const allowedTypes = ['checking', 'credit', 'cash', 'savings', 'other'];
    if (!name) throw badRequest('Account name is required.');
    if (!allowedTypes.includes(type)) {
      throw badRequest(`Invalid account type. Use one of: ${allowedTypes.join(', ')}`);
    }
    if (currency.length !== 3) {
      throw badRequest('Currency must be a 3-letter ISO code (e.g., USD).');
    }

    const item = await Account.create({ userId: req.user.id, name, type, currency });
    res.status(201).json(item);
  })
);

export default router;