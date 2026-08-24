import { Router } from 'express';
import crypto from 'node:crypto';
import { dbGet, dbAll, dbRun, withTransaction, seedDefaultCategoriesTx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.use(requireAuth);

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const groups = await dbAll(
      `SELECT g.id, g.name, g.invite_code, g.owner_id,
              (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ?
       ORDER BY g.created_at DESC`,
      [req.userId]
    );
    res.json({ groups });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Naziv grupe je obavezan.' });

    const inviteCode = generateInviteCode();
    const trimmedName = String(name).trim();

    const groupId = await withTransaction(async ({ get, run }) => {
      const info = await run('INSERT INTO groups (name, invite_code, owner_id) VALUES (?, ?, ?)', [
        trimmedName,
        inviteCode,
        req.userId,
      ]);
      await run('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [
        info.lastInsertRowid,
        req.userId,
        'owner',
      ]);
      await seedDefaultCategoriesTx(run, info.lastInsertRowid);
      return info.lastInsertRowid;
    });

    res.status(201).json({ group: { id: groupId, name: trimmedName, invite_code: inviteCode } });
  })
);

router.post(
  '/join',
  asyncHandler(async (req, res) => {
    const { inviteCode } = req.body || {};
    if (!inviteCode) return res.status(400).json({ error: 'Kod za pridruzivanje je obavezan.' });

    const group = await dbGet('SELECT * FROM groups WHERE invite_code = ?', [
      String(inviteCode).trim().toUpperCase(),
    ]);
    if (!group) return res.status(404).json({ error: 'Grupa sa ovim kodom ne postoji.' });

    const existing = await dbGet('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?', [
      group.id,
      req.userId,
    ]);
    if (existing) return res.status(409).json({ error: 'Vec ste clan ove grupe.' });

    await dbRun('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [
      group.id,
      req.userId,
      'member',
    ]);
    res.status(201).json({ group: { id: group.id, name: group.name, invite_code: group.invite_code } });
  })
);

router.get(
  '/:groupId/members',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const members = await dbAll(
      `SELECT u.id, u.name, u.email, gm.role
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`,
      [req.groupId]
    );
    res.json({ members });
  })
);

router.delete(
  '/:groupId/leave',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const group = await dbGet('SELECT owner_id FROM groups WHERE id = ?', [req.groupId]);
    if (group.owner_id === req.userId) {
      return res.status(400).json({ error: 'Vlasnik ne moze napustiti grupu. Obrisite grupu umesto toga.' });
    }
    await dbRun('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [req.groupId, req.userId]);
    res.status(204).send();
  })
);

router.delete(
  '/:groupId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const group = await dbGet('SELECT owner_id FROM groups WHERE id = ?', [req.groupId]);
    if (group.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Samo vlasnik moze obrisati grupu.' });
    }
    await dbRun('DELETE FROM groups WHERE id = ?', [req.groupId]);
    res.status(204).send();
  })
);

export default router;
