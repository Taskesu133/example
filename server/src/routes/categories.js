import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireGroupMember);

router.get('/', (req, res) => {
  const categories = db
    .prepare('SELECT id, name, color FROM categories WHERE group_id = ? ORDER BY name ASC')
    .all(req.groupId);
  res.json({ categories });
});

router.post('/', (req, res) => {
  const { name, color } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Naziv kategorije je obavezan.' });

  try {
    const info = db
      .prepare('INSERT INTO categories (group_id, name, color) VALUES (?, ?, ?)')
      .run(req.groupId, String(name).trim(), color || '#6366f1');
    res.status(201).json({ category: { id: info.lastInsertRowid, name: String(name).trim(), color: color || '#6366f1' } });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Kategorija sa ovim nazivom vec postoji.' });
    }
    throw err;
  }
});

router.delete('/:categoryId', (req, res) => {
  const categoryId = Number(req.params.categoryId);
  const category = db
    .prepare('SELECT id FROM categories WHERE id = ? AND group_id = ?')
    .get(categoryId, req.groupId);
  if (!category) return res.status(404).json({ error: 'Kategorija nije pronadjena.' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  res.status(204).send();
});

export default router;
