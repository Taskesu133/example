import { dbGet } from '../db.js';
import { asyncHandler } from './asyncHandler.js';

export const requireGroupMember = asyncHandler(async (req, res, next) => {
  const groupId = Number(req.params.groupId);
  if (!groupId) return res.status(400).json({ error: 'Nevazeci ID grupe.' });
  const membership = await dbGet('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [
    groupId,
    req.userId,
  ]);
  if (!membership) return res.status(403).json({ error: 'Niste clan ove grupe.' });
  req.groupId = groupId;
  req.groupRole = membership.role;
  next();
});
