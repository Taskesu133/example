import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Niste prijavljeni.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Nevazeci ili istekao token.' });
  }
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// Dugotrajan token namenjen automatizaciji (npr. skripta koja cita mejlove i
// dodaje troskove preko API-ja), a ne za prijavu u browseru.
export function signAutomationToken(userId) {
  return jwt.sign({ userId, automation: true }, JWT_SECRET, { expiresIn: '3650d' });
}
