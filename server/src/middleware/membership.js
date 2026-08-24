import { db } from '../db.js';

export function requireGroupMember(req, res, next) {
  const groupId = Number(req.params.groupId);
  if (!groupId) return res.status(400).json({ error: 'Nevazeci ID grupe.' });
  const membership = db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, req.userId);
  if (!membership) return res.status(403).json({ error: 'Niste clan ove grupe.' });
  req.groupId = groupId;
  req.groupRole = membership.role;
  next();
}
