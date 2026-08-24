import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbRun } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Ime je obavezno.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Unesite ispravan email.' });
    if (!password || String(password).length < 6)
      return res.status(400).json({ error: 'Lozinka mora imati bar 6 karaktera.' });

    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Nalog sa ovim emailom vec postoji.' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const info = await dbRun('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
      String(name).trim(),
      email.toLowerCase(),
      passwordHash,
    ]);

    const token = signToken(info.lastInsertRowid);
    res.status(201).json({
      token,
      user: { id: info.lastInsertRowid, name: String(name).trim(), email: email.toLowerCase() },
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email i lozinka su obavezni.' });

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Pogresan email ili lozinka.' });
    }

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await dbGet('SELECT id, name, email FROM users WHERE id = ?', [req.userId]);
    if (!user) return res.status(404).json({ error: 'Korisnik nije pronadjen.' });
    res.json({ user });
  })
);

export default router;
