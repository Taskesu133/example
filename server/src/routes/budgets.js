import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireGroupMember);

router.put('/', (req, res) => {
  const { month, amount } = req.body || {};
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const numAmount = Number(amount);
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) return res.status(400).json({ error: 'Mesec mora biti u formatu GGGG-MM.' });
  if (!Number.isFinite(numAmount) || numAmount < 0) return res.status(400).json({ error: 'Budzet mora biti nenegativan broj.' });

  db.prepare(
    `INSERT INTO budgets (group_id, month, amount) VALUES (?, ?, ?)
     ON CONFLICT(group_id, month) DO UPDATE SET amount = excluded.amount`
  ).run(req.groupId, targetMonth, numAmount);

  res.json({ budget: { month: targetMonth, amount: numAmount } });
});

router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const row = db.prepare('SELECT amount FROM budgets WHERE group_id = ? AND month = ?').get(req.groupId, month);
  res.json({ budget: { month, amount: row ? row.amount : null } });
});

export default router;
