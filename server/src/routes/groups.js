import { Router } from 'express';
import crypto from 'node:crypto';
import { db, seedDefaultCategories } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';

const router = Router();
router.use(requireAuth);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

router.get('/', (req, res) => {
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.invite_code, g.owner_id,
              (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ?
       ORDER BY g.created_at DESC`
    )
    .all(req.userId);
  res.json({ groups });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Naziv grupe je obavezan.' });

  let inviteCode = generateInviteCode();
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO groups (name, invite_code, owner_id) VALUES (?, ?, ?)')
      .run(String(name).trim(), inviteCode, req.userId);
    db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
      info.lastInsertRowid,
      req.userId,
      'owner'
    );
    seedDefaultCategories(info.lastInsertRowid);
    return info.lastInsertRowid;
  });

  const groupId = tx();
  res.status(201).json({ group: { id: groupId, name: String(name).trim(), invite_code: inviteCode } });
});

router.post('/join', (req, res) => {
  const { inviteCode } = req.body || {};
  if (!inviteCode) return res.status(400).json({ error: 'Kod za pridruzivanje je obavezan.' });

  const group = db.prepare('SELECT * FROM groups WHERE invite_code = ?').get(String(inviteCode).trim().toUpperCase());
  if (!group) return res.status(404).json({ error: 'Grupa sa ovim kodom ne postoji.' });

  const existing = db
    .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(group.id, req.userId);
  if (existing) return res.status(409).json({ error: 'Vec ste clan ove grupe.' });

  db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
    group.id,
    req.userId,
    'member'
  );
  res.status(201).json({ group: { id: group.id, name: group.name, invite_code: group.invite_code } });
});

router.get('/:groupId/members', requireGroupMember, (req, res) => {
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.email, gm.role
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`
    )
    .all(req.groupId);
  res.json({ members });
});

router.delete('/:groupId/leave', requireGroupMember, (req, res) => {
  const group = db.prepare('SELECT owner_id FROM groups WHERE id = ?').get(req.groupId);
  if (group.owner_id === req.userId) {
    return res.status(400).json({ error: 'Vlasnik ne moze napustiti grupu. Obrisite grupu umesto toga.' });
  }
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(req.groupId, req.userId);
  res.status(204).send();
});

router.delete('/:groupId', requireGroupMember, (req, res) => {
  const group = db.prepare('SELECT owner_id FROM groups WHERE id = ?').get(req.groupId);
  if (group.owner_id !== req.userId) {
    return res.status(403).json({ error: 'Samo vlasnik moze obrisati grupu.' });
  }
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.groupId);
  res.status(204).send();
});

export default router;
