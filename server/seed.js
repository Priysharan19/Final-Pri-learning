// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Seed a demo account with ~6 weeks of practice — UNUSED LEGACY
// Run: npm run seed
// This fills the legacy SQLite database, which the app never reads. The demo
// the product offers ("Try the demo") is built on-device by
// client/src/local/demoSeed.js. See server/README.md.
// ─────────────────────────────────────────────────────────────────────────────
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db, sydneyDate } from './db.js';
import { scopeForYear, SUBTOPIC_BY_ID, subtopicsForYear } from './engine/curriculum.js';
import { generateQuestion } from './engine/generators/index.js';
import { checkAnswer } from './engine/checker.js';
import { START_RATING, DIFF_RATING, expectedScore, updateRating, pickDifficulty, predictMark, xpFor } from './engine/adaptive.js';
import { makeRng } from './engine/qhelpers.js';

const rng = makeRng(20260818);
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const rc = arr => arr[Math.floor(rng() * arr.length)];

function canonicalInput(q) {
  const a = q.answer;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric':
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a}:${a.b}`;
    default: return '0';
  }
}
const wrongInput = q => q.answerType === 'mcq' ? String((q.answer.correctIndex + 1) % (q.mcqOptions?.length || 4)) : '999';

// ── Reset demo user ──────────────────────────────────────────────────────────
const existing = db.prepare('SELECT id FROM users WHERE is_demo = 1').get();
if (existing) db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);

const YEAR = 10;
const info = db.prepare('INSERT INTO users (email, name, password_hash, year, theme, daily_goal, xp, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)')
  .run('demo@prilearning.app', 'Pri', bcrypt.hashSync('demo123', 10), YEAR, 'dark', 10, Date.now() - 50 * 86400000);
const uid = info.lastInsertRowid;
console.log(`Demo user #${uid} created`);

// ── Simulate practice history ────────────────────────────────────────────────
const { own, revision } = scopeForYear(YEAR);
const pool = [...own, ...own, ...revision]; // bias toward own year
// Persona: strong in algebra/linear, weaker in trig/probability, hasn't touched some topics
const affinity = {};
for (const s of [...own, ...revision]) {
  affinity[s.id] = s.strand === 'Algebra' ? 1.38 : s.strand === 'Trigonometry' ? 0.78 : s.strand === 'Statistics & Probability' ? 0.86 : 1.15;
}
const untouched = new Set(['y10-similarity', 'y9-surface-area', 'y10-stats']);

const ratings = {}; // live sim state
const getR = id => ratings[id] || (ratings[id] = { rating: START_RATING, attempts: 0, correct: 0, last_at: 0 });

const DAYS = 45;
const now = Date.now();
let totalXp = 0;
const insertAttempt = db.prepare('INSERT INTO attempts (user_id, question_id, subtopic, difficulty, correct, answer_given, ms, hints_used, mode, rating_before, rating_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const upsertActivity = db.prepare(`INSERT INTO activity (user_id, date, questions, correct, xp, ms, predicted) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, date) DO UPDATE SET questions = excluded.questions, correct = excluded.correct, xp = excluded.xp, ms = excluded.ms, predicted = excluded.predicted`);

for (let d = DAYS; d >= 0; d--) {
  const dayStart = now - d * 86400000;
  // Practice most days; guarantee an unbroken streak for the final 9 days
  const practiceToday = d <= 8 ? true : rng() < 0.72;
  if (!practiceToday) continue;
  const nQuestions = d === 0 ? 4 : ri(6, 14);
  let dayCorrect = 0, dayXp = 0, dayMs = 0;

  for (let i = 0; i < nQuestions; i++) {
    let sub = rc(pool);
    let guard = 10;
    while (untouched.has(sub.id) && guard--) sub = rc(pool);
    const st = getR(sub.id);
    const diff = pickDifficulty(st.rating, st.attempts);
    const q = generateQuestion(sub.id, diff, ri(1, 2 ** 30));
    const pCorrect = Math.min(0.96, expectedScore(st.rating, DIFF_RATING[diff]) * affinity[sub.id] + 0.04);
    const correct = rng() < pCorrect;
    const hints = correct && rng() < 0.2 ? 1 : 0;
    const before = st.rating;
    st.rating = updateRating(st.rating, st.attempts, diff, correct, hints);
    st.attempts++; if (correct) st.correct++;
    const ts = dayStart + i * 60000 * ri(2, 9) + ri(0, 59000);
    st.last_at = ts;
    const ms = ri(20000, 150000);
    const xp = xpFor(diff, correct, 0, hints);
    totalXp += xp; dayXp += xp; dayMs += ms; if (correct) dayCorrect++;
    insertAttempt.run(uid, 'seed-' + randomUUID().slice(0, 8), sub.id, diff, correct ? 1 : 0, correct ? canonicalInput(q) : wrongInput(q), ms, hints, 'practice', before, st.rating, ts);
  }
  const pred = predictMark(ratings, YEAR, dayStart + 86000000 / 2);
  upsertActivity.run(uid, sydneyDate(dayStart), nQuestions, dayCorrect, dayXp, dayMs, pred.mark);
}

// Persist final ratings
const insertRating = db.prepare('INSERT INTO ratings (user_id, subtopic, rating, attempts, correct, last_at) VALUES (?, ?, ?, ?, ?, ?)');
for (const [id, st] of Object.entries(ratings)) insertRating.run(uid, id, st.rating, st.attempts, st.correct, st.last_at);

// Reviews: a few due now, some upcoming
const practiced = Object.keys(ratings).filter(id => ratings[id].attempts >= 3);
practiced.slice(0, 14).forEach((id, i) => {
  const dueOffset = i < 4 ? -ri(1, 3) : ri(1, 6); // 4 due now
  db.prepare('INSERT INTO reviews (user_id, subtopic, due_at, interval_days) VALUES (?, ?, ?, ?)')
    .run(uid, id, now + dueOffset * 86400000, ri(2, 12));
});

// XP + badges
db.prepare('UPDATE users SET xp = ? WHERE id = ?').run(totalXp, uid);
const badgeTimes = { 'first-steps': DAYS, 'ten-up': DAYS - 2, 'half-century': DAYS - 14, 'streak-3': DAYS - 8, 'streak-7': 4, 'sharpshooter': DAYS - 9, 'night-owl': DAYS - 5, 'explorer': DAYS - 6, 'scholar': DAYS - 10, 'comeback': DAYS - 12 };
for (const [bid, daysAgo] of Object.entries(badgeTimes)) {
  db.prepare('INSERT OR IGNORE INTO badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)').run(uid, bid, now - daysAgo * 86400000);
}

// One finished exam with full detail
const examId = randomUUID();
const examYear = YEAR;
const qids = [];
const detail = [];
let score = 0;
const subtopics = subtopicsForYear(examYear);
for (let i = 0; i < 15; i++) {
  const s = subtopics[i % subtopics.length];
  const diff = i < 3 ? 1 : i < 9 ? 2 : i < 13 ? 3 : 4;
  const q = generateQuestion(s.id, diff, ri(1, 2 ** 30));
  const qid = randomUUID();
  const correct = i % 5 !== 4 && i !== 13; // 12/15
  if (correct) score++;
  db.prepare('INSERT INTO questions (id, user_id, subtopic, difficulty, seed, payload, mode, exam_id, answered, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
    .run(qid, uid, q.subtopic, q.difficulty, q.seed, JSON.stringify(q), 'exam', examId, now - 6 * 86400000);
  qids.push(qid);
  const given = correct ? canonicalInput(q) : wrongInput(q);
  const res = checkAnswer(q, given);
  detail.push({
    id: qid, subtopic: q.subtopic, subtopicName: SUBTOPIC_BY_ID[q.subtopic]?.name, difficulty: q.difficulty,
    prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions, given, correct: !!res.correct,
    solution: { steps: q.steps, answerText: '' }
  });
}
db.prepare('INSERT INTO exams (id, user_id, year, title, duration_min, question_ids, created_at, finished_at, score, total, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(examId, uid, examYear, `Year ${examYear} Practice Paper 1`, 45, JSON.stringify(qids), now - 6 * 86400000, now - 6 * 86400000 + 41 * 60000, score, 15, JSON.stringify(detail));

// Rush history
[8, 11, 14, 12].forEach((s, i) => {
  db.prepare('INSERT INTO rush_runs (user_id, score, correct, total, best_combo, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uid, s, s, s + ri(1, 4), ri(3, 8), now - (12 - i * 3) * 86400000);
});

const finalPred = predictMark(ratings, YEAR, now);
console.log(`Seeded: ${db.prepare('SELECT COUNT(*) c FROM attempts WHERE user_id = ?').get(uid).c} attempts, ` +
  `${practiced.length} practised subtopics, predicted mark ${finalPred.mark} (${finalPred.low}–${finalPred.high}), XP ${totalXp}`);
console.log('Demo login: demo@prilearning.app / demo123 (or the “Try the demo” button)');
