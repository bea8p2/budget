// server/routes/transactions.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { asyncHandler, badRequest, notFound as notFoundErr } from '../utils/errors.js';

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
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, category, accountId } = req.query;
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit ?? 50)));

    const q = { userId: req.user.id };
    if (from || to) {
      q.date = {};
      if (from) {
        if (!isISODateLike(from)) throw badRequest('Query param "from" must be a valid date.');
        q.date.$gte = new Date(from);
      }
      if (to) {
        if (!isISODateLike(to)) throw badRequest('Query param "to" must be a valid date.');
        q.date.$lte = new Date(to);
      }
    }
    if (category) q.category = category;
    if (accountId) q.accountId = accountId;

    const items = await Transaction.find(q).sort({ date: -1 }).limit(limit);
    res.json(items);
  })
);

/**
 * POST /transactions
 * body: { accountId, date, amount, category, note, tags }
 * validations:
 *  - accountId: required, must belong to current user
 *  - date: required, valid date
 *  - amount: required, number (expense negative, income positive)
 *  - category: required, non-empty
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const accountId = (body.accountId ?? '').toString().trim();
    const dateRaw = body.date;
    const amount = toNumberMaybe(body.amount);
    const category = (body.category ?? '').toString().trim();
    const note = (body.note ?? '').toString();
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

    // Validate required fields
    if (!accountId) throw badRequest('accountId is required.');
    if (!dateRaw || !isISODateLike(dateRaw)) throw badRequest('date is required and must be a valid date.');
    if (amount === null) throw badRequest('amount is required and must be a number.');
    if (!category) throw badRequest('category is required.');

    // Ensure the account belongs to the current user
    const acc = await Account.findOne({ _id: accountId, userId: req.user.id });
    if (!acc) throw notFoundErr('Account not found for this user.');

    const tx = await Transaction.create({
      userId: req.user.id,
      accountId,
      date: new Date(dateRaw),
      amount,
      category,
      note,
      tags
    });

    res.status(201).json(tx);
  })
);

/**
 * DELETE /transactions/:id
 * ensures the transaction belongs to the current user
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await Transaction.deleteOne({ _id: id, userId: req.user.id });
    if (result.deletedCount === 0) throw notFoundErr('Transaction not found.');
    res.json({ ok: true });
  })
);

export default router;