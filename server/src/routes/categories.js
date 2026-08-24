import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireGroupMember);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await dbAll('SELECT id, name, color FROM categories WHERE group_id = ? ORDER BY name ASC', [
      req.groupId,
    ]);
    res.json({ categories });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, color } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Naziv kategorije je obavezan.' });

    const existing = await dbGet('SELECT id FROM categories WHERE group_id = ? AND name = ?', [
      req.groupId,
      String(name).trim(),
    ]);
    if (existing) return res.status(409).json({ error: 'Kategorija sa ovim nazivom vec postoji.' });

    const info = await dbRun('INSERT INTO categories (group_id, name, color) VALUES (?, ?, ?)', [
      req.groupId,
      String(name).trim(),
      color || '#6366f1',
    ]);
    res
      .status(201)
      .json({ category: { id: info.lastInsertRowid, name: String(name).trim(), color: color || '#6366f1' } });
  })
);

router.delete(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    const categoryId = Number(req.params.categoryId);
    const category = await dbGet('SELECT id FROM categories WHERE id = ? AND group_id = ?', [
      categoryId,
      req.groupId,
    ]);
    if (!category) return res.status(404).json({ error: 'Kategorija nije pronadjena.' });
    await dbRun('DELETE FROM categories WHERE id = ?', [categoryId]);
    res.status(204).send();
  })
);

export default router;
