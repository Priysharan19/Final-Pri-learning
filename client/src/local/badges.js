// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Achievements (local edition)
// ─────────────────────────────────────────────────────────────────────────────
import { get, put, byIndex } from './idb.js';
import { streakFor, sydneyHour } from './store.js';
import { levelFromXp } from '../engine/adaptive.js';
import { subtopicsForYear } from '../engine/curriculum.js';

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
  { id: 'match-winner', name: 'Matchwinner', icon: '🥇', desc: 'Win a Match against a rival.' },
  { id: 'penmanship', name: 'Digital Penmanship', icon: '✍️', desc: 'Have 10 handwritten answers recognised and marked.' },
  { id: 'scholar', name: 'Scholar', icon: '🎓', desc: 'Reach level 5.' },
  { id: 'sage', name: 'Sage', icon: '🧙', desc: 'Reach level 10.' },
  { id: 'extension', name: 'Extension Thinker', icon: '🚀', desc: 'Answer a D4 Exam-Extension question correctly without hints.' }
];

export async function checkBadges(pid, event, nowMs = Date.now()) {
  const haveRows = await byIndex('badges', 'pid', pid);
  const have = new Set(haveRows.map(r => r.badgeId));
  const out = [];
  const award = async id => {
    if (have.has(id)) return;
    have.add(id);
    await put('badges', { key: `${pid}:${id}`, pid, badgeId: id, earnedAt: nowMs });
    const meta = BADGES.find(b => b.id === id);
    if (meta) out.push(meta);
  };
  const maybe = async (id, cond) => { if (cond) await award(id); };

  const attempts = await byIndex('attempts', 'pid', pid);
  const totalCorrect = attempts.filter(a => a.correct).length;
  await maybe('first-steps', totalCorrect >= 1);
  await maybe('ten-up', totalCorrect >= 10);
  await maybe('half-century', totalCorrect >= 50);
  await maybe('century', totalCorrect >= 100);

  const streak = await streakFor(pid, nowMs);
  await maybe('streak-3', streak >= 3);
  await maybe('streak-7', streak >= 7);
  await maybe('streak-14', streak >= 14);
  await maybe('streak-30', streak >= 30);

  if (event.type === 'attempt') {
    const recent = attempts.slice(-11).reverse();
    const lastTen = recent.slice(0, 10);
    await maybe('sharpshooter', lastTen.length === 10 && lastTen.every(r => r.correct));
    await maybe('comeback', recent.length >= 4 && recent[0].correct && recent.slice(1, 4).every(r => !r.correct));
    const hour = sydneyHour(nowMs);
    await maybe('night-owl', hour >= 22 || hour < 4);
    await maybe('early-bird', hour >= 5 && hour < 8);
    await maybe('extension', event.difficulty === 4 && event.correct && !event.hintsUsed);
    const distinct = new Set(attempts.map(a => a.subtopic)).size;
    await maybe('explorer', distinct >= 15);
    if (event.year) {
      const own = subtopicsForYear(event.year).map(s => s.id);
      const done = new Set(attempts.map(a => a.subtopic));
      await maybe('all-rounder', own.length > 0 && own.every(id => done.has(id)));
    }
    const inkMarked = attempts.filter(a => a.viaInk).length;
    await maybe('penmanship', inkMarked >= 10);
  }
  if (event.type === 'exam') {
    await maybe('exam-ready', event.pct >= 80);
    await maybe('perfect-exam', event.pct >= 100);
  }
  if (event.type === 'rush') await maybe('rush-15', event.score >= 15);
  if (event.type === 'match') await maybe('match-winner', !!event.won);
  if (event.xp !== undefined) {
    const lv = levelFromXp(event.xp).level;
    await maybe('scholar', lv >= 5);
    await maybe('sage', lv >= 10);
  }
  return out;
}
