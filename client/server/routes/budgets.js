// server/routes/budgets.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Budget from '../models/Budget.js';
import { asyncHandler, badRequest, notFound as notFoundErr } from '../utils/errors.js';

const router = express.Router();
router.use(requireAuth);

/**
 * PUT /budgets/:year/:month
 * body: { limits: [{ category, limit }] }
 * validations:
 *  - year: integer (1900–3000)
 *  - month: integer 1..12
 *  - limits: array; each item requires non-empty category and numeric limit
 */
router.put(
  '/:year/:month',
  asyncHandler(async (req, res) => {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const { limits = [] } = req.body || {};

    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      throw badRequest('Year must be a valid integer (1900–3000).');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw badRequest('Month must be an integer between 1 and 12.');
    }
    if (!Array.isArray(limits)) {
      throw badRequest('limits must be an array of { category, limit }.');
    }
    for (const row of limits) {
      const category = (row?.category ?? '').toString().trim();
      const limit = Number(row?.limit);
      if (!category) throw badRequest('Each limit row needs a non-empty category.');
      if (Number.isNaN(limit)) throw badRequest('Each limit row needs a numeric limit.');
    }

    const doc = await Budget.findOneAndUpdate(
      { userId: req.user.id, 'period.year': year, 'period.month': month },
      { $set: { limits } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(doc);
  })
);

router.get('/:year/:month/categories', asyncHandler(async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);

  const doc = await Budget.findOne({
    userId: req.user.id,
    'period.year': year,
    'period.month': month
  });

  if (!doc) return res.json([]);

  const categories = doc.limits.map(l => l.category);
  res.json(categories);
}));



export default router;