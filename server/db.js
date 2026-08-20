// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · SQLite persistence — UNUSED LEGACY
// No user data ever reaches this database. The shipped app stores everything in
// IndexedDB on the device (client/src/local/idb.js + store.js), which is what
// makes the product work offline and without an account. Importing this module
// creates server/data/ as a side effect. See server/README.md.
// ─────────────────────────────────────────────────────────────────────────────
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'pri-learning.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 9,
  theme TEXT NOT NULL DEFAULT 'dark',
  daily_goal INTEGER NOT NULL DEFAULT 10,
  xp INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtopic TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  payload TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'practice',
  exam_id TEXT,
  answered INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id, created_at);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  answer_given TEXT,
  ms INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'practice',
  rating_before INTEGER,
  rating_after INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, created_at);
CREATE TABLE IF NOT EXISTS ratings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtopic TEXT NOT NULL,
  rating INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER,
  PRIMARY KEY (user_id, subtopic)
);
CREATE TABLE IF NOT EXISTS reviews (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtopic TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, subtopic)
);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  question_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER,
  total INTEGER,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  questions INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  ms INTEGER NOT NULL DEFAULT 0,
  predicted INTEGER,
  PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS rush_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  best_combo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`);

// ── Small helpers ────────────────────────────────────────────────────────────

/** Date string (YYYY-MM-DD) in Australia/Sydney for a given ms timestamp. */
export function sydneyDate(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

export function sydneyHour(ms = Date.now()) {
  return Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: false }).format(new Date(ms)));
}

/** Consecutive-day streak ending today or yesterday (Sydney time). */
export function streakFor(userId, nowMs = Date.now()) {
  const rows = db.prepare('SELECT date FROM activity WHERE user_id = ? AND questions > 0 ORDER BY date DESC LIMIT 400').all(userId);
  if (!rows.length) return 0;
  const dates = new Set(rows.map(r => r.date));
  let streak = 0;
  let cursor = nowMs;
  const today = sydneyDate(nowMs);
  if (!dates.has(today)) cursor -= 86400000; // allow streak to survive until end of today
  for (; ;) {
    const d = sydneyDate(cursor);
    if (dates.has(d)) { streak++; cursor -= 86400000; } else break;
  }
  return streak;
}

export function bumpActivity(userId, { correct, xp, ms }, nowMs = Date.now()) {
  const date = sydneyDate(nowMs);
  db.prepare(`INSERT INTO activity (user_id, date, questions, correct, xp, ms) VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET questions = questions + 1, correct = correct + excluded.correct, xp = xp + excluded.xp, ms = ms + excluded.ms`)
    .run(userId, date, correct ? 1 : 0, xp, ms || 0);
}

export function setPredictedToday(userId, predicted, nowMs = Date.now()) {
  const date = sydneyDate(nowMs);
  db.prepare(`INSERT INTO activity (user_id, date, questions, predicted) VALUES (?, ?, 0, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET predicted = excluded.predicted`).run(userId, date, predicted);
}

export function ratingsFor(userId) {
  const rows = db.prepare('SELECT subtopic, rating, attempts, correct, last_at FROM ratings WHERE user_id = ?').all(userId);
  return Object.fromEntries(rows.map(r => [r.subtopic, r]));
}
