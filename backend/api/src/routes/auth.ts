import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getPgPoolOrThrow } from '../db/pg';
import { requireAuth, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Real brute-force protection on login — previously only covered by the
// global 1000-req/15min limiter in server.ts, which does essentially
// nothing against password guessing on a single account. 10 attempts per
// 15 minutes per IP is generous enough for a real user who mistypes, tight
// enough to slow down automated guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set.');
  return secret;
}

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const pool = getPgPoolOrThrow();
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, name, role FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  await pool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    getJwtSecret(),
    { expiresIn: '12h' },
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.post('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }
  const validRoles = ['technician', 'manager', 'admin'];
  const assignedRole = validRoles.includes(role) ? role : 'technician';
  const passwordHash = await bcrypt.hash(password, 12);
  const pool = getPgPoolOrThrow();
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4)
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase().trim(), passwordHash, name, assignedRole],
    );
    res.status(201).json({ user: rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'A user with that email already exists' });
      return;
    }
    throw err;
  }
});

export default router;
