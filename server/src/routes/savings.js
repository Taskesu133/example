import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireGroupMember);

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(new Date(str).getTime());
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const goals = await dbAll(
      `SELECT g.id, g.name, g.target_amount,
              COALESCE((SELECT SUM(amount) FROM savings_contributions c WHERE c.goal_id = g.id), 0) AS saved
       FROM savings_goals g
       WHERE g.group_id = ?
       ORDER BY g.created_at ASC`,
      [req.groupId]
    );

    const contributions = await dbAll(
      `SELECT c.id, c.goal_id, c.amount, c.note, c.contributed_on, c.user_id, u.name AS user_name
       FROM savings_contributions c
       JOIN savings_goals g ON g.id = c.goal_id
       JOIN users u ON u.id = c.user_id
       WHERE g.group_id = ?
       ORDER BY c.contributed_on DESC, c.created_at DESC`,
      [req.groupId]
    );

    const byGoal = {};
    for (const c of contributions) {
      if (!byGoal[c.goal_id]) byGoal[c.goal_id] = [];
      byGoal[c.goal_id].push(c);
    }

    res.json({
      goals: goals.map((g) => ({ ...g, contributions: byGoal[g.id] || [] })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, targetAmount } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Naziv cilja je obavezan.' });
    const numTarget = Number(targetAmount);
    if (!Number.isFinite(numTarget) || numTarget <= 0) {
      return res.status(400).json({ error: 'Ciljani iznos mora biti pozitivan broj.' });
    }

    const info = await dbRun('INSERT INTO savings_goals (group_id, name, target_amount) VALUES (?, ?, ?)', [
      req.groupId,
      String(name).trim(),
      numTarget,
    ]);

    res.status(201).json({
      goal: { id: info.lastInsertRowid, name: String(name).trim(), target_amount: numTarget, saved: 0, contributions: [] },
    });
  })
);

router.delete(
  '/:goalId',
  asyncHandler(async (req, res) => {
    const goalId = Number(req.params.goalId);
    const goal = await dbGet('SELECT id FROM savings_goals WHERE id = ? AND group_id = ?', [goalId, req.groupId]);
    if (!goal) return res.status(404).json({ error: 'Cilj nije pronadjen.' });
    await dbRun('DELETE FROM savings_goals WHERE id = ?', [goalId]);
    res.status(204).send();
  })
);

router.post(
  '/:goalId/contributions',
  asyncHandler(async (req, res) => {
    const goalId = Number(req.params.goalId);
    const goal = await dbGet('SELECT id FROM savings_goals WHERE id = ? AND group_id = ?', [goalId, req.groupId]);
    if (!goal) return res.status(404).json({ error: 'Cilj nije pronadjen.' });

    const { amount, note, contributedOn } = req.body || {};
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Iznos mora biti pozitivan broj.' });
    }
    const date = contributedOn || new Date().toISOString().slice(0, 10);
    if (!isValidDate(date)) return res.status(400).json({ error: 'Datum nije ispravan (format GGGG-MM-DD).' });

    const info = await dbRun(
      'INSERT INTO savings_contributions (goal_id, user_id, amount, note, contributed_on) VALUES (?, ?, ?, ?, ?)',
      [goalId, req.userId, numAmount, note ? String(note).trim() : null, date]
    );

    res.status(201).json({
      contribution: {
        id: info.lastInsertRowid,
        goal_id: goalId,
        amount: numAmount,
        note: note || null,
        contributed_on: date,
        user_id: req.userId,
      },
    });
  })
);

router.delete(
  '/:goalId/contributions/:contributionId',
  asyncHandler(async (req, res) => {
    const goalId = Number(req.params.goalId);
    const contributionId = Number(req.params.contributionId);
    const contribution = await dbGet(
      `SELECT c.id FROM savings_contributions c
       JOIN savings_goals g ON g.id = c.goal_id
       WHERE c.id = ? AND c.goal_id = ? AND g.group_id = ?`,
      [contributionId, goalId, req.groupId]
    );
    if (!contribution) return res.status(404).json({ error: 'Uplata nije pronadjena.' });
    await dbRun('DELETE FROM savings_contributions WHERE id = ?', [contributionId]);
    res.status(204).send();
  })
);

export default router;
