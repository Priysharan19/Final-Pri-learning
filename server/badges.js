// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Achievements
// ─────────────────────────────────────────────────────────────────────────────
import { db, streakFor, sydneyHour } from './db.js';
import { levelFromXp } from './engine/adaptive.js';
import { SUBTOPICS, subtopicsForYear } from './engine/curriculum.js';

export const BADGES = [
  { id: 'first-steps', name: 'First Steps', icon: '🌱', desc: 'Answer your first question correctly.' },
  { id: 'ten-up', name: 'Warming Up', icon: '🔥', desc: 'Answer 10 questions correctly.' },
  { id: 'half-century', name: 'Half Century', icon: '🏏', desc: 'Answer 50 questions correctly.' },
  { id: 'century', name: 'Century Club', icon: '💯', desc: 'Answer 100 questions correctly.' },
  { id: 'streak-3', name: 'On a Roll', icon: '📆', desc: 'Practise 3 days in a row.' },
  { id: 'streak-7', name: 'Week Warrior', icon: '🗓️', desc: 'Practise 7 days in a row.' },
  { id: 'streak-14', name: 'Fortnight Force', icon: '⚡', desc: 'Practise 14 days in a row.' },
  { id: 'streak-30', name: 'Iron Habit', icon: '🛡️', desc: 'Practise 30 days in a row.' },
  { id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', desc: 'Get 10 correct answers in a row.' },
  { id: 'comeback', name: 'The Comeback', icon: '💪', desc: 'Answer correctly right after 3 wrong in a row.' },
  { id: 'night-owl', name: 'Night Owl', icon: '🦉', desc: 'Practise between 10 pm and 4 am.' },
  { id: 'early-bird', name: 'Early Bird', icon: '🌅', desc: 'Practise between 5 am and 8 am.' },
  { id: 'explorer', name: 'Explorer', icon: '🧭', desc: 'Attempt questions in 15 different subtopics.' },
  { id: 'all-rounder', name: 'All-Rounder', icon: '🪐', desc: 'Attempt every subtopic of your own year.' },
  { id: 'exam-ready', name: 'Exam Ready', icon: '📄', desc: 'Score 80%+ on a practice exam.' },
  { id: 'perfect-exam', name: 'Flawless', icon: '👑', desc: 'Score 100% on a practice exam.' },
  { id: 'rush-15', name: 'Rush Hour', icon: '⏱️', desc: 'Score 15+ in a single Rush.' },
  { id: 'scholar', name: 'Scholar', icon: '🎓', desc: 'Reach level 5.' },
  { id: 'sage', name: 'Sage', icon: '🧙', desc: 'Reach level 10.' },
  { id: 'extension', name: 'Extension Thinker', icon: '🚀', desc: 'Answer a D4 Exam-Extension question correctly without hints.' }
];

const earnedSet = userId => new Set(db.prepare('SELECT badge_id FROM badges WHERE user_id = ?').all(userId).map(r => r.badge_id));

function award(userId, id, out, nowMs) {
  db.prepare('INSERT OR IGNORE INTO badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)').run(userId, id, nowMs);
  const meta = BADGES.find(b => b.id === id);
  if (meta) out.push(meta);
}

/** Evaluate badge conditions after an event. Returns newly earned badge metas. */
export function checkBadges(userId, event, nowMs = Date.now()) {
  const have = earnedSet(userId);
  const out = [];
  const maybe = (id, cond) => { if (!have.has(id) && cond) award(userId, id, out, nowMs); };

  const totalCorrect = db.prepare('SELECT COUNT(*) c FROM attempts WHERE user_id = ? AND correct = 1').get(userId).c;
  maybe('first-steps', totalCorrect >= 1);
  maybe('ten-up', totalCorrect >= 10);
  maybe('half-century', totalCorrect >= 50);
  maybe('century', totalCorrect >= 100);

  const streak = streakFor(userId, nowMs);
  maybe('streak-3', streak >= 3);
  maybe('streak-7', streak >= 7);
  maybe('streak-14', streak >= 14);
  maybe('streak-30', streak >= 30);

  if (event.type === 'attempt') {
    const recent = db.prepare('SELECT correct FROM attempts WHERE user_id = ? ORDER BY id DESC LIMIT 11').all(userId);
    const lastTen = recent.slice(0, 10);
    maybe('sharpshooter', lastTen.length === 10 && lastTen.every(r => r.correct));
    maybe('comeback', recent.length >= 4 && recent[0].correct === 1 && recent.slice(1, 4).every(r => !r.correct));
    const hour = sydneyHour(nowMs);
    maybe('night-owl', hour >= 22 || hour < 4);
    maybe('early-bird', hour >= 5 && hour < 8);
    maybe('extension', event.difficulty === 4 && event.correct && !event.hintsUsed);
    const distinct = db.prepare('SELECT COUNT(DISTINCT subtopic) c FROM attempts WHERE user_id = ?').get(userId).c;
    maybe('explorer', distinct >= 15);
    if (event.year) {
      const own = subtopicsForYear(event.year).map(s => s.id);
      if (own.length) {
        const done = new Set(db.prepare('SELECT DISTINCT subtopic FROM attempts WHERE user_id = ?').all(userId).map(r => r.subtopic));
        maybe('all-rounder', own.every(id => done.has(id)));
      }
    }
  }
  if (event.type === 'exam') {
    maybe('exam-ready', event.pct >= 80);
    maybe('perfect-exam', event.pct >= 100);
  }
  if (event.type === 'rush') {
    maybe('rush-15', event.score >= 15);
  }
  if (event.xp !== undefined) {
    const lv = levelFromXp(event.xp).level;
    maybe('scholar', lv >= 5);
    maybe('sage', lv >= 10);
  }
  return out;
}
