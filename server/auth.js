// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Auth: cookie sessions, register/login/demo
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { db, streakFor, sydneyDate } from './db.js';
import { levelFromXp } from './engine/adaptive.js';

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
export const COOKIE = 'pri_session';

function createSession(res, userId) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, Date.now() + SESSION_MS);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MS });
}

export function currentUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?').get(token, Date.now());
  return row || null;
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
  next();
}

export function publicUser(u, nowMs = Date.now()) {
  const { level, progress, needed } = levelFromXp(u.xp);
  const today = db.prepare('SELECT questions, correct, xp FROM activity WHERE user_id = ? AND date = ?').get(u.id, sydneyDate(nowMs)) || { questions: 0, correct: 0, xp: 0 };
  return {
    id: u.id, name: u.name, email: u.email, year: u.year, theme: u.theme,
    dailyGoal: u.daily_goal, xp: u.xp, level, levelProgress: progress, levelNeeded: needed,
    streak: streakFor(u.id, nowMs), today, isDemo: !!u.is_demo
  };
}

export const authRouter = Router();

authRouter.post('/register', (req, res) => {
  const { name, email, password, year } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const y = Math.min(12, Math.max(7, Number(year) || 9));
  const em = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ error: 'That email doesn’t look right.' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(em);
  if (exists) return res.status(409).json({ error: 'An account with that email already exists.' });
  const hash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare('INSERT INTO users (email, name, password_hash, year, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(em, String(name).trim().slice(0, 60), hash, y, Date.now());
  createSession(res, info.lastInsertRowid);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user: publicUser(u) });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

authRouter.post('/demo', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE is_demo = 1').get();
  if (!u) return res.status(404).json({ error: 'Demo account not found — run npm run seed.' });
  createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

authRouter.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});
