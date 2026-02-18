// server/routes/budgets.js
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import Budget from '../models/Budget.js';
import { asyncHandler, badRequest, notFound as notFoundErr } from '../utils/errors.js';

import RecurringBudgetLine from '../models/RecurringBudgetLine.js';
import RecurringSkip from '../models/RecurringSkip.js';

import PlannedExpense from '../models/PlannedExpense.js';
import PlannedExpenseSkip from '../models/PlannedExpenseSkip.js';

const router = express.Router();
router.use(requireAuth);

/**
 * PUT /budgets/:year/:month
 * body: { limits: [{ category, limit }] }
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

/**
 * GET /budgets/:year/:month
 * (MERGED VIEW: saved + recurring + planned)
 */
router.get(
  '/:year/:month',
  asyncHandler(async (req, res) => {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      throw badRequest('Year and month must be integers.');
    }

const saved = await Budget.findOne({
  userId: req.user.id,
  $or: [
    { 'period.year': year, 'period.month': month },
    { 'period.year': String(year), 'period.month': String(month) }
  ]
});

    const savedLines = saved ? saved.limits : [];

    // Load recurring
    const recurring = await RecurringBudgetLine.find({ userId: req.user.id, active: true });
    const recurringSkips = await RecurringSkip.find({ userId: req.user.id, year, month });

    const recurringLines = recurring
      .filter(r => !recurringSkips.some(s => s.category === r.category))
      .map(r => ({
        category: r.category,
        limit: r.amount,
        type: 'recurring'
      }));

    // Load planned expenses
    const planned = await PlannedExpense.find({ userId: req.user.id });
    const plannedSkips = await PlannedExpenseSkip.find({ userId: req.user.id, year, month });

    const today = new Date(year, month - 1);

    const plannedLines = planned
      .filter(p => !plannedSkips.some(s => s.plannedExpenseId.toString() === p._id.toString()))
      .map(p => {
        const due = new Date(p.dueDate);
        const months = (due.getFullYear() - today.getFullYear()) * 12 +
                       (due.getMonth() - today.getMonth());
        const monthly = months > 0 ? p.total / months : p.total;

        return {
          category: p.category || p.name,
          limit: monthly,
          type: 'planned',
          name: p.name
        };
      });

    res.json({
      year,
      month,
      limits: [...savedLines, ...recurringLines, ...plannedLines]
    });
  })
);

/**
 * GET /budgets/:year/:month/categories
 */
router.get(
  '/:year/:month/categories',
  asyncHandler(async (req, res) => {
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
  })
);

// Recurring
router.post('/recurring', asyncHandler(async (req, res) => {
  const { category, amount } = req.body;

  if (!category) throw badRequest('Category is required.');
  if (amount === undefined) throw badRequest('Amount is required.');

  const line = await RecurringBudgetLine.create({
    userId: req.user.id,
    category,
    amount,
    active: true
  });

  res.status(201).json(line);
}));

router.post('/recurring/skip', asyncHandler(async (req, res) => {
  const { category, year, month } = req.body;

  const skip = await RecurringSkip.create({
    userId: req.user.id,
    category,
    year,
    month
  });

  res.status(201).json(skip);
}));

// Planned
router.post('/planned', asyncHandler(async (req, res) => {
  const { name, total, dueDate, category } = req.body;

  if (!name) throw badRequest('Name required.');
  if (!total) throw badRequest('Total required.');
  if (!dueDate) throw badRequest('Due date required.');

  const item = await PlannedExpense.create({
    userId: req.user.id,
    name,
    total,
    dueDate,
    category
  });

  res.status(201).json(item);
}));

router.post('/planned/skip', asyncHandler(async (req, res) => {
  const { plannedExpenseId, year, month } = req.body;

  const skip = await PlannedExpenseSkip.create({
    userId: req.user.id,
    plannedExpenseId,
    year,
    month
  });

  res.status(201).json(skip);
}));

export default router;
