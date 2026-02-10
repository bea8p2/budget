// server/routes/transactions.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';

const router = express.Router();
router.use(requireAuth);

// helpers
function isISODateLike(value) {
  // Accepts YYYY-MM-DD or any parseable date string
  return !Number.isNaN(new Date(value).getTime());
}
function toNumberMaybe(n) {
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isNaN(num) ? null : num;
}

/**
 * GET /transactions
 * query: from, to, category, accountId, limit
 */
router.get('/', async (req, res) => {
  try {
    const { from, to, category, accountId } = req.query;
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit ?? 50)));

    const q = { userId: req.user.id };
    if (from || to) {
      q.date = {};
      if (from) {
        if (!isISODateLike(from)) return res.status(400).json({ error: 'Query param "from" must be a valid date.' });
        q.date.$gte = new Date(from);
      }
      if (to) {
        if (!isISODateLike(to)) return res.status(400).json({ error: 'Query param "to" must be a valid date.' });
        q.date.$lte = new Date(to);
      }
    }
    if (category) q.category = category;
    if (accountId) q.accountId = accountId;

    const items = await Transaction.find(q).sort({ date: -1 }).limit(limit);
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected error' });
  }
});

/**
 * POST /transactions
 * body: { accountId, date, amount, category, note, tags }
 * validations:
 *  - accountId: required, must belong to current user
 *  - date: required, valid date
 *  - amount: required, number (expense negative, income positive)
 *  - category: required, non-empty
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const accountId = (body.accountId ?? '').toString().trim();
    const dateRaw = body.date;
    const amount = toNumberMaybe(body.amount);
    const category = (body.category ?? '').toString().trim();
    const note = (body.note ?? '').toString();
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

    // Validate required fields
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required.' });
    }
    if (!dateRaw || !isISODateLike(dateRaw)) {
      return res.status(400).json({ error: 'date is required and must be a valid date.' });
    }
    if (amount === null) {
      return res.status(400).json({ error: 'amount is required and must be a number.' });
    }
    if (!category) {
      return res.status(400).json({ error: 'category is required.' });
    }

    // Ensure the account belongs to the current user
    const acc = await Account.findOne({ _id: accountId, userId: req.user.id });
    if (!acc) {
      return res.status(404).json({ error: 'Account not found for this user.' });
    }

    const tx = await Transaction.create({
      userId: req.user.id,
      accountId,
      date: new Date(dateRaw),
      amount,
      category,
      note,
      tags
    });

    return res.status(201).json(tx);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Could not create transaction.' });
  }
});

/**
 * DELETE /transactions/:id
 * ensures the transaction belongs to the current user
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Transaction.deleteOne({ _id: id, userId: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Could not delete transaction.' });
  }
});

export default router;