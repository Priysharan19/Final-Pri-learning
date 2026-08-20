// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · API routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db, ratingsFor, bumpActivity, setPredictedToday, sydneyDate, streakFor } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { CURRICULUM, SUBTOPIC_BY_ID, subtopicsForYear, scopeForYear, DIFF_LABELS, STRANDS } from '../engine/curriculum.js';
import { generateQuestion } from '../engine/generators/index.js';
import { checkAnswer, stepCheck } from '../engine/checker.js';
import {
  START_RATING, updateRating, masteryOf, masteryBand, pickDifficulty, pickNext,
  nextReview, predictMark, priorities, xpFor, levelFromXp
} from '../engine/adaptive.js';
import { BADGES, checkBadges } from '../badges.js';

export const api = Router();

// ── Profile ──────────────────────────────────────────────────────────────────

api.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

api.patch('/me', requireAuth, (req, res) => {
  const { name, year, theme, dailyGoal } = req.body || {};
  const u = req.user;
  const newName = name !== undefined ? String(name).trim().slice(0, 60) || u.name : u.name;
  const newYear = year !== undefined ? Math.min(12, Math.max(7, Number(year) || u.year)) : u.year;
  const newTheme = theme !== undefined && ['dark', 'light'].includes(theme) ? theme : u.theme;
  const newGoal = dailyGoal !== undefined ? Math.min(60, Math.max(3, Number(dailyGoal) || u.daily_goal)) : u.daily_goal;
  db.prepare('UPDATE users SET name = ?, year = ?, theme = ?, daily_goal = ? WHERE id = ?').run(newName, newYear, newTheme, newGoal, u.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

// ── Curriculum + mastery map ─────────────────────────────────────────────────

api.get('/curriculum', requireAuth, (req, res) => {
  const ratings = ratingsFor(req.user.id);
  const dueRows = db.prepare('SELECT subtopic FROM reviews WHERE user_id = ? AND due_at <= ?').all(req.user.id, Date.now());
  const due = new Set(dueRows.map(r => r.subtopic));
  const now = Date.now();
  const years = CURRICULUM.map(y => ({
    year: y.year, title: y.title, caption: y.caption,
    subtopics: y.subtopics.map(s => {
      const st = ratings[s.id];
      const m = st ? masteryOf(st.rating, st.attempts, st.last_at, now) : 0;
      return {
        id: s.id, name: s.name, strand: s.strand, weight: s.weight, dotpoints: s.dotpoints,
        mastery: Math.round(m * 100), band: st ? masteryBand(m) : 'unseen',
        attempts: st?.attempts || 0, correct: st?.correct || 0,
        due: due.has(s.id), rating: st?.rating || null
      };
    })
  }));
  res.json({ years, userYear: req.user.year });
});

// ── Question serving ─────────────────────────────────────────────────────────

function sanitize(q, row) {
  const s = SUBTOPIC_BY_ID[q.subtopic];
  return {
    id: row.id, subtopic: q.subtopic, subtopicName: s?.name || q.subtopic,
    year: s?.year, strand: s?.strand,
    difficulty: q.difficulty, diffLabel: DIFF_LABELS[q.difficulty],
    prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions,
    inputHint: q.inputHint, answerPrefix: q.answerPrefix, answerSuffix: q.answerSuffix,
    hintsAvailable: (q.hints || []).length, hintsUsed: row.hints_used || 0,
    triesLeft: 2 - (row.tries || 0),
    supportsSteps: !!q.stepcheck
  };
}

function createQuestion(userId, subtopic, difficulty, mode, examId = null) {
  const q = generateQuestion(subtopic, difficulty);
  const id = randomUUID();
  db.prepare('INSERT INTO questions (id, user_id, subtopic, difficulty, seed, payload, mode, exam_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, q.subtopic, q.difficulty, q.seed, JSON.stringify(q), mode, examId, Date.now());
  return { row: { id, hints_used: 0, tries: 0 }, payload: q };
}

api.post('/practice/next', requireAuth, (req, res) => {
  const { mode = 'smart', subtopic, difficulty } = req.body || {};
  const userId = req.user.id;
  let choice;
  if (mode === 'topic' && subtopic && SUBTOPIC_BY_ID[subtopic]) {
    const st = db.prepare('SELECT * FROM ratings WHERE user_id = ? AND subtopic = ?').get(userId, subtopic);
    const d = difficulty ? Math.min(4, Math.max(1, Number(difficulty))) : pickDifficulty(st?.rating ?? START_RATING, st?.attempts ?? 0);
    choice = { subtopic, difficulty: d, reason: 'topic', why: 'Focused practice on your chosen topic.' };
  } else {
    const ratings = ratingsFor(userId);
    const reviewsDue = db.prepare('SELECT subtopic, due_at FROM reviews WHERE user_id = ? AND due_at <= ? ORDER BY due_at ASC').all(userId, Date.now());
    choice = pickNext({ ratings, reviewsDue, year: req.user.year, rand: Math.random() });
  }
  const { row, payload } = createQuestion(userId, choice.subtopic, choice.difficulty, choice.reason === 'review' ? 'review' : 'practice');
  res.json({ question: sanitize(payload, row), reason: choice.reason, why: choice.why });
});

api.post('/practice/:id/hint', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Question not found' });
  const q = JSON.parse(row.payload);
  const hints = q.hints || [];
  const level = Math.min(row.hints_used, hints.length - 1);
  if (!hints.length) return res.json({ hint: 'No hints for this one — trust your instincts!', level: 0, remaining: 0 });
  const used = Math.min(row.hints_used + 1, hints.length);
  db.prepare('UPDATE questions SET hints_used = ? WHERE id = ?').run(used, row.id);
  res.json({ hint: hints[used - 1], level: used, remaining: hints.length - used });
});

/** Resolve a question: write attempt, update rating/review/xp/activity/badges. */
function resolve(user, row, q, correct, answerGiven, ms, mode) {
  const userId = user.id;
  const now = Date.now();
  const st = db.prepare('SELECT * FROM ratings WHERE user_id = ? AND subtopic = ?').get(userId, q.subtopic)
    || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
  const effHints = (row.hints_used || 0) + Math.max(0, (row.tries || 0) - (correct ? 1 : 0));
  let ratingAfter = st.rating;
  const isRush = mode === 'rush';

  if (!isRush) {
    ratingAfter = updateRating(st.rating, st.attempts, q.difficulty, correct, effHints);
    db.prepare(`INSERT INTO ratings (user_id, subtopic, rating, attempts, correct, last_at) VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, subtopic) DO UPDATE SET rating = ?, attempts = attempts + 1, correct = correct + ?, last_at = ?`)
      .run(userId, q.subtopic, ratingAfter, correct ? 1 : 0, now, ratingAfter, correct ? 1 : 0, now);
  }

  // Spaced review scheduling (deliberate practice only)
  if (mode === 'practice' || mode === 'review') {
    const attemptsNow = st.attempts + 1;
    const rev = db.prepare('SELECT * FROM reviews WHERE user_id = ? AND subtopic = ?').get(userId, q.subtopic);
    if (rev) {
      const days = nextReview(rev.interval_days, correct, q.difficulty);
      db.prepare('UPDATE reviews SET due_at = ?, interval_days = ? WHERE user_id = ? AND subtopic = ?')
        .run(now + days * 86400000, days, userId, q.subtopic);
    } else if (attemptsNow >= 3) {
      const days = correct ? 2 : 1;
      db.prepare('INSERT INTO reviews (user_id, subtopic, due_at, interval_days) VALUES (?, ?, ?, ?)')
        .run(userId, q.subtopic, now + days * 86400000, days);
    }
  }

  const xp = isRush ? (correct ? 6 : 0) : xpFor(q.difficulty, correct, 0, effHints);
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(xp, userId);
  bumpActivity(userId, { correct, xp, ms }, now);

  db.prepare('INSERT INTO attempts (user_id, question_id, subtopic, difficulty, correct, answer_given, ms, hints_used, mode, rating_before, rating_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(userId, row.id, q.subtopic, q.difficulty, correct ? 1 : 0, String(answerGiven ?? '').slice(0, 300), ms || 0, row.hints_used || 0, mode, st.rating, ratingAfter, now);
  db.prepare('UPDATE questions SET answered = 1 WHERE id = ?').run(row.id);

  const totalXp = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId).xp;
  const newBadges = checkBadges(userId, { type: 'attempt', difficulty: q.difficulty, correct, hintsUsed: row.hints_used, year: user.year, xp: totalXp }, now);

  const ratings = ratingsFor(userId);
  const pred = predictMark(ratings, user.year, now);
  setPredictedToday(userId, pred.mark, now);

  const stNew = ratings[q.subtopic];
  const mastery = stNew ? Math.round(masteryOf(stNew.rating, stNew.attempts, stNew.last_at, now) * 100) : 0;

  return {
    xp, totalXp, level: levelFromXp(totalXp),
    ratingDelta: ratingAfter - st.rating, mastery, band: masteryBand(mastery / 100),
    predicted: pred, streak: streakFor(userId, now), newBadges
  };
}

api.post('/practice/:id/submit', requireAuth, (req, res) => {
  const { answer, ms, steps } = req.body || {};
  const row = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (row.answered) return res.status(409).json({ error: 'Already answered' });
  const q = JSON.parse(row.payload);

  const result = checkAnswer(q, answer);
  let feedback = result.feedback;
  if (!result.correct && q.answerType === 'mcq' && q.answer.optionTraps) {
    feedback = q.answer.optionTraps[Number(answer)] || feedback;
  }

  // Optional Step Check on the student's working
  let stepReport = null;
  if (steps && q.stepcheck) {
    try { stepReport = stepCheck(q.stepcheck, steps); } catch { stepReport = null; }
  }

  const isRush = row.mode === 'rush';
  if (!result.correct && !result.invalid && !isRush && (row.tries || 0) < 1) {
    db.prepare('UPDATE questions SET tries = tries + 1 WHERE id = ?').run(row.id);
    return res.json({ correct: false, resolved: false, triesLeft: 1, feedback: feedback || 'Not quite — check your working and try once more.', stepReport });
  }
  if (result.invalid && !isRush) {
    return res.json({ correct: false, resolved: false, triesLeft: Math.max(0, 1 - (row.tries || 0)), invalid: true, feedback, stepReport });
  }

  const meta = resolve(req.user, row, q, result.correct, answer, ms, row.mode);
  res.json({
    correct: result.correct, resolved: true, feedback, stepReport,
    solution: { steps: q.steps, answerText: displayAnswer(q) },
    ...meta
  });
});

api.post('/practice/:id/reveal', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (row.answered) return res.status(409).json({ error: 'Already answered' });
  const q = JSON.parse(row.payload);
  const meta = resolve(req.user, row, q, false, 'revealed', req.body?.ms || 0, row.mode);
  res.json({ correct: false, resolved: true, revealed: true, solution: { steps: q.steps, answerText: displayAnswer(q) }, ...meta });
});

function displayAnswer(q) {
  const a = q.answer;
  switch (q.answerType) {
    case 'mcq': return q.mcqOptions?.[a.correctIndex] ?? '';
    case 'numeric': {
      if (a.canonicalInput) return a.canonicalInput;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k}√${a.surdForm.r}`;
      return `${q.answerPrefix ? q.answerPrefix + ' ' : ''}${a.value}${q.answerSuffix ? ' ' + q.answerSuffix : ''}`;
    }
    case 'expression': return a.expr;
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a} : ${a.b}`;
    default: return '';
  }
}

// ── Reviews ──────────────────────────────────────────────────────────────────

api.get('/reviews', requireAuth, (req, res) => {
  const now = Date.now();
  const rows = db.prepare('SELECT subtopic, due_at, interval_days FROM reviews WHERE user_id = ? ORDER BY due_at ASC').all(req.user.id);
  const decorate = r => ({ ...r, name: SUBTOPIC_BY_ID[r.subtopic]?.name, year: SUBTOPIC_BY_ID[r.subtopic]?.year, strand: SUBTOPIC_BY_ID[r.subtopic]?.strand });
  res.json({
    due: rows.filter(r => r.due_at <= now).map(decorate),
    upcoming: rows.filter(r => r.due_at > now && r.due_at < now + 7 * 86400000).map(decorate)
  });
});

// ── Exams ────────────────────────────────────────────────────────────────────

api.post('/exams', requireAuth, (req, res) => {
  const length = [10, 15, 20].includes(Number(req.body?.length)) ? Number(req.body.length) : 10;
  const minutes = Math.min(90, Math.max(10, Number(req.body?.minutes) || (length * 3)));
  const year = Math.min(12, Math.max(7, Number(req.body?.year) || req.user.year));
  const subtopics = subtopicsForYear(year);
  const ratings = ratingsFor(req.user.id);

  // Difficulty profile like a real paper: ~20% D1, 40% D2, 30% D3, 10% D4
  const diffs = [];
  for (let i = 0; i < length; i++) {
    const t = i / length;
    diffs.push(t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4);
  }
  // Weighted subtopic sampling without immediate repeats
  const bag = [];
  for (const s of subtopics) for (let i = 0; i < Math.max(1, Math.round(s.weight / 3)); i++) bag.push(s.id);
  const qids = [];
  const examId = randomUUID();
  let lastPick = null;
  for (let i = 0; i < length; i++) {
    let pick = bag[Math.floor(Math.random() * bag.length)];
    let guard = 20;
    while (pick === lastPick && guard--) pick = bag[Math.floor(Math.random() * bag.length)];
    lastPick = pick;
    const { row } = createQuestion(req.user.id, pick, diffs[i], 'exam', examId);
    qids.push(row.id);
  }
  const count = db.prepare('SELECT COUNT(*) c FROM exams WHERE user_id = ?').get(req.user.id).c;
  const title = `Year ${year} Practice Paper ${count + 1}`;
  db.prepare('INSERT INTO exams (id, user_id, year, title, duration_min, question_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(examId, req.user.id, year, title, minutes, JSON.stringify(qids), Date.now());
  res.json({ exam: examFor(req.user.id, examId) });
});

function examFor(userId, examId) {
  const e = db.prepare('SELECT * FROM exams WHERE id = ? AND user_id = ?').get(examId, userId);
  if (!e) return null;
  const qids = JSON.parse(e.question_ids);
  const questions = qids.map(id => {
    const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    const q = JSON.parse(row.payload);
    return sanitize(q, row);
  });
  return { id: e.id, title: e.title, year: e.year, durationMin: e.duration_min, createdAt: e.created_at, finishedAt: e.finished_at, score: e.score, total: e.total, questions, detail: e.detail ? JSON.parse(e.detail) : null };
}

api.get('/exams', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, title, year, duration_min, created_at, finished_at, score, total FROM exams WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
  res.json({ exams: rows });
});

api.get('/exams/:id', requireAuth, (req, res) => {
  const exam = examFor(req.user.id, req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  res.json({ exam });
});

api.post('/exams/:id/submit', requireAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM exams WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!e) return res.status(404).json({ error: 'Exam not found' });
  if (e.finished_at) return res.status(409).json({ error: 'Exam already submitted' });
  const answers = req.body?.answers || {};
  const totalMs = Number(req.body?.ms) || 0;
  const qids = JSON.parse(e.question_ids);
  const now = Date.now();
  let score = 0;
  const detail = [];

  for (const qid of qids) {
    const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid);
    const q = JSON.parse(row.payload);
    const given = answers[qid];
    const result = given === undefined || given === null || given === '' ? { correct: false } : checkAnswer(q, given);
    if (result.correct) score++;
    if (!row.answered) resolve(req.user, row, q, result.correct, given ?? '', Math.round(totalMs / qids.length), 'exam');
    detail.push({
      id: qid, subtopic: q.subtopic, subtopicName: SUBTOPIC_BY_ID[q.subtopic]?.name,
      difficulty: q.difficulty, prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions,
      given: given ?? '', correct: !!result.correct, feedback: result.feedback,
      solution: { steps: q.steps, answerText: displayAnswer(q) }
    });
  }
  const pct = Math.round(100 * score / qids.length);
  db.prepare('UPDATE exams SET finished_at = ?, score = ?, total = ?, detail = ? WHERE id = ?')
    .run(now, score, qids.length, JSON.stringify(detail), e.id);
  const newBadges = checkBadges(req.user.id, { type: 'exam', pct }, now);
  res.json({ score, total: qids.length, pct, detail, newBadges });
});

// ── Rush mode ────────────────────────────────────────────────────────────────

api.post('/rush/start', requireAuth, (req, res) => {
  const { own, revision } = scopeForYear(req.user.year);
  const pool = [...own, ...revision];
  const questions = [];
  for (let i = 0; i < 20; i++) {
    const s = pool[Math.floor(Math.random() * pool.length)];
    const d = Math.random() < 0.7 ? 1 : 2;
    const { row, payload } = createQuestion(req.user.id, s.id, d, 'rush');
    questions.push(sanitize(payload, row));
  }
  res.json({ questions, seconds: 90 });
});

api.post('/rush/answer', requireAuth, (req, res) => {
  const { id, answer } = req.body || {};
  const row = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ? AND mode = ?').get(id, req.user.id, 'rush');
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (row.answered) return res.status(409).json({ error: 'Already answered' });
  const q = JSON.parse(row.payload);
  const result = checkAnswer(q, answer);
  resolve(req.user, row, q, result.correct, answer, 0, 'rush');
  res.json({ correct: result.correct, answerText: displayAnswer(q) });
});

api.post('/rush/finish', requireAuth, (req, res) => {
  const { correct = 0, total = 0, bestCombo = 0 } = req.body || {};
  const score = Math.max(0, Math.min(20, Number(correct) || 0));
  const now = Date.now();
  db.prepare('INSERT INTO rush_runs (user_id, score, correct, total, best_combo, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, score, score, Math.max(score, Number(total) || 0), Number(bestCombo) || 0, now);
  const best = db.prepare('SELECT MAX(score) m FROM rush_runs WHERE user_id = ?').get(req.user.id).m;
  const newBadges = checkBadges(req.user.id, { type: 'rush', score }, now);
  res.json({ score, best, newBadges });
});

// ── Stats & reports ──────────────────────────────────────────────────────────

api.get('/stats', requireAuth, (req, res) => {
  const userId = req.user.id;
  const now = Date.now();
  const ratings = ratingsFor(userId);
  const pred = predictMark(ratings, req.user.year, now);
  const prio = priorities(ratings, req.user.year, now, 5);

  // Trajectory: daily predicted marks (carry last known forward)
  const days = db.prepare('SELECT date, questions, correct, xp, ms, predicted FROM activity WHERE user_id = ? ORDER BY date ASC').all(userId);
  let lastPred = null;
  const trajectory = days.map(d => { if (d.predicted != null) lastPred = d.predicted; return { date: d.date, predicted: lastPred }; }).filter(d => d.predicted != null);

  // Strand mastery for own year + revision
  const { own, revision } = scopeForYear(req.user.year);
  const strandAgg = {};
  for (const s of [...own, ...revision]) {
    const st = ratings[s.id];
    const m = st ? masteryOf(st.rating, st.attempts, st.last_at, now) : 0;
    strandAgg[s.strand] = strandAgg[s.strand] || { sum: 0, n: 0 };
    strandAgg[s.strand].sum += m; strandAgg[s.strand].n++;
  }
  const strands = Object.entries(strandAgg).map(([name, v]) => ({ name, mastery: Math.round(100 * v.sum / v.n) }));

  const last120 = days.slice(-120);
  const totals = db.prepare('SELECT COUNT(*) attempts, SUM(correct) correct, SUM(ms) ms FROM attempts WHERE user_id = ?').get(userId);
  const byDiff = db.prepare('SELECT difficulty, COUNT(*) n, SUM(correct) c FROM attempts WHERE user_id = ? GROUP BY difficulty').all(userId);
  const bestRush = db.prepare('SELECT MAX(score) m FROM rush_runs WHERE user_id = ?').get(userId).m || 0;
  const examCount = db.prepare('SELECT COUNT(*) c FROM exams WHERE user_id = ? AND finished_at IS NOT NULL').get(userId).c;
  const recent = db.prepare(`SELECT a.subtopic, a.difficulty, a.correct, a.created_at, a.mode FROM attempts a WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 15`).all(userId)
    .map(a => ({ ...a, name: SUBTOPIC_BY_ID[a.subtopic]?.name }));

  res.json({
    predicted: pred, trajectory, priorities: prio, strands,
    activity: last120, totals: { ...totals, correct: totals.correct || 0, ms: totals.ms || 0 },
    byDiff, bestRush, examCount, recent, streak: streakFor(userId, now)
  });
});

api.get('/badges', requireAuth, (req, res) => {
  const earned = db.prepare('SELECT badge_id, earned_at FROM badges WHERE user_id = ?').all(req.user.id);
  const map = Object.fromEntries(earned.map(b => [b.badge_id, b.earned_at]));
  res.json({ badges: BADGES.map(b => ({ ...b, earnedAt: map[b.id] || null })), earnedCount: earned.length, total: BADGES.length });
});

api.get('/report', requireAuth, (req, res) => {
  const userId = req.user.id;
  const now = Date.now();
  const ratings = ratingsFor(userId);
  const pred = predictMark(ratings, req.user.year, now);
  const { own } = scopeForYear(req.user.year);
  const rows = own.map(s => {
    const st = ratings[s.id];
    const m = st ? Math.round(100 * masteryOf(st.rating, st.attempts, st.last_at, now)) : 0;
    return { name: s.name, strand: s.strand, mastery: m, attempts: st?.attempts || 0, correct: st?.correct || 0, band: st ? masteryBand(m / 100) : 'unseen' };
  });
  const strengths = [...rows].filter(r => r.attempts >= 3).sort((a, b) => b.mastery - a.mastery).slice(0, 3);
  const focus = [...rows].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const last28 = db.prepare(`SELECT date, questions, correct FROM activity WHERE user_id = ? ORDER BY date DESC LIMIT 28`).all(userId).reverse();
  const totals = db.prepare('SELECT COUNT(*) attempts, SUM(correct) correct, SUM(ms) ms FROM attempts WHERE user_id = ?').get(userId);
  res.json({
    student: { name: req.user.name, year: req.user.year },
    generatedAt: now, predicted: pred, subtopics: rows, strengths, focus,
    weekly: last28, totals: { ...totals, correct: totals.correct || 0 }, streak: streakFor(userId, now)
  });
});
