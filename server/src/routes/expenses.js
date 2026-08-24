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
    const { month, categoryId, userId } = req.query;
    let sql = `
      SELECT e.id, e.amount, e.note, e.spent_on, e.created_at,
             e.category_id, c.name AS category_name, c.color AS category_color,
             e.user_id, u.name AS user_name
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      JOIN users u ON u.id = e.user_id
      WHERE e.group_id = ?
    `;
    const args = [req.groupId];

    if (month) {
      sql += ' AND substr(e.spent_on, 1, 7) = ?';
      args.push(month);
    }
    if (categoryId) {
      sql += ' AND e.category_id = ?';
      args.push(Number(categoryId));
    }
    if (userId) {
      sql += ' AND e.user_id = ?';
      args.push(Number(userId));
    }
    sql += ' ORDER BY e.spent_on DESC, e.created_at DESC';

    const expenses = await dbAll(sql, args);
    res.json({ expenses });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { amount, note, spentOn, categoryId } = req.body || {};
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Iznos mora biti pozitivan broj.' });
    }
    const date = spentOn || new Date().toISOString().slice(0, 10);
    if (!isValidDate(date)) return res.status(400).json({ error: 'Datum nije ispravan (format GGGG-MM-DD).' });

    let catId = null;
    if (categoryId) {
      const category = await dbGet('SELECT id FROM categories WHERE id = ? AND group_id = ?', [
        Number(categoryId),
        req.groupId,
      ]);
      if (!category) return res.status(400).json({ error: 'Kategorija ne pripada ovoj grupi.' });
      catId = category.id;
    }

    const info = await dbRun(
      'INSERT INTO expenses (group_id, user_id, category_id, amount, note, spent_on) VALUES (?, ?, ?, ?, ?, ?)',
      [req.groupId, req.userId, catId, numAmount, note ? String(note).trim() : null, date]
    );

    res.status(201).json({
      expense: {
        id: info.lastInsertRowid,
        amount: numAmount,
        note: note || null,
        spent_on: date,
        category_id: catId,
        user_id: req.userId,
      },
    });
  })
);

router.patch(
  '/:expenseId',
  asyncHandler(async (req, res) => {
    const expenseId = Number(req.params.expenseId);
    const expense = await dbGet('SELECT * FROM expenses WHERE id = ? AND group_id = ?', [
      expenseId,
      req.groupId,
    ]);
    if (!expense) return res.status(404).json({ error: 'Trosak nije pronadjen.' });
    if (expense.user_id !== req.userId && req.groupRole !== 'owner') {
      return res.status(403).json({ error: 'Mozete izmeniti samo svoje troskove.' });
    }

    const { amount, categoryId } = req.body || {};
    const updates = [];
    const args = [];

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Iznos mora biti pozitivan broj.' });
      }
      updates.push('amount = ?');
      args.push(numAmount);
    }

    if (categoryId !== undefined) {
      let catId = null;
      if (categoryId) {
        const category = await dbGet('SELECT id FROM categories WHERE id = ? AND group_id = ?', [
          Number(categoryId),
          req.groupId,
        ]);
        if (!category) return res.status(400).json({ error: 'Kategorija ne pripada ovoj grupi.' });
        catId = category.id;
      }
      updates.push('category_id = ?');
      args.push(catId);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Nema izmena za sacuvati.' });

    args.push(expenseId);
    await dbRun(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`, args);

    const updated = await dbGet(
      `SELECT e.id, e.amount, e.note, e.spent_on, e.category_id, c.name AS category_name, c.color AS category_color
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = ?`,
      [expenseId]
    );
    res.json({ expense: updated });
  })
);

router.delete(
  '/:expenseId',
  asyncHandler(async (req, res) => {
    const expenseId = Number(req.params.expenseId);
    const expense = await dbGet('SELECT * FROM expenses WHERE id = ? AND group_id = ?', [
      expenseId,
      req.groupId,
    ]);
    if (!expense) return res.status(404).json({ error: 'Trosak nije pronadjen.' });
    if (expense.user_id !== req.userId && req.groupRole !== 'owner') {
      return res.status(403).json({ error: 'Mozete obrisati samo svoje troskove.' });
    }
    await dbRun('DELETE FROM expenses WHERE id = ?', [expenseId]);
    res.status(204).send();
  })
);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const byCategory = await dbAll(
      `SELECT COALESCE(c.name, 'Bez kategorije') AS name, COALESCE(c.color, '#94a3b8') AS color,
              SUM(e.amount) AS total
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.group_id = ? AND substr(e.spent_on, 1, 7) = ?
       GROUP BY e.category_id
       ORDER BY total DESC`,
      [req.groupId, month]
    );

    const byUser = await dbAll(
      `SELECT u.id, u.name, SUM(e.amount) AS total
       FROM expenses e JOIN users u ON u.id = e.user_id
       WHERE e.group_id = ? AND substr(e.spent_on, 1, 7) = ?
       GROUP BY e.user_id
       ORDER BY total DESC`,
      [req.groupId, month]
    );

    const totalRow = await dbGet(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE group_id = ? AND substr(spent_on, 1, 7) = ?`,
      [req.groupId, month]
    );

    const budgetRow = await dbGet('SELECT amount FROM budgets WHERE group_id = ? AND month = ?', [
      req.groupId,
      month,
    ]);

    res.json({
      month,
      total: totalRow.total,
      budget: budgetRow ? budgetRow.amount : null,
      byCategory,
      byUser,
    });
  })
);

export default router;
