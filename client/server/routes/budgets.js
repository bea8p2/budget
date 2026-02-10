// server/routes/budgets.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Budget from '../models/Budget.js';

const router = express.Router();
router.use(requireAuth);

/**
 * PUT /budgets/:year/:month
 * body: { limits: [{ category, limit }] }
 * validations:
 *  - month: 1..12
 *  - limits: array; each item requires non-empty category and numeric limit
 */
router.put('/:year/:month', async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const { limits = [] } = req.body || {};

    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      return res.status(400).json({ error: 'Year must be a valid integer (1900–3000).' });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be an integer between 1 and 12.' });
    }
    if (!Array.isArray(limits)) {
      return res.status(400).json({ error: 'limits must be an array of { category, limit }.' });
    }
    for (const row of limits) {
      const category = (row?.category ?? '').toString().trim();
      const limit = Number(row?.limit);
      if (!category) return res.status(400).json({ error: 'Each limit row needs a non-empty category.' });
      if (Number.isNaN(limit)) return res.status(400).json({ error: 'Each limit row needs a numeric limit.' });
    }

    const doc = await Budget.findOneAndUpdate(
      { userId: req.user.id, 'period.year': year, 'period.month': month },
      { $set: { limits } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Could not save budget.' });
  }
});

/**
 * GET /budgets/:year/:month
 */
router.get('/:year/:month', async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      return res.status(400).json({ error: 'Year and month must be integers.' });
    }

    const doc = await Budget.findOne({
      userId: req.user.id,
      'period.year': year,
      'period.month': month
    });
    if (!doc) return res.status(404).json({ error: 'No budget for this month.' });
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Could not load budget.' });
  }
});

export default router;