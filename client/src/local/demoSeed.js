// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · In-browser demo profile: ~6 weeks of realistic history,
// generated locally with the real engine.
//
// The demo a visitor meets is an Indian Class 10 student on the CBSE / NCERT
// track, with her day boundary in Asia/Kolkata. The legacy NSW Year 10 demo
// is kept behind `course: 'nsw'` for the Australian flows.
// ─────────────────────────────────────────────────────────────────────────────
import { put, add, uuid } from './idb.js';
import { dayKey, defaultTimezone } from '../lib/locale.js';
import { scopeForYear, SUBTOPIC_BY_ID, subtopicsForYear } from '../engine/curriculum.js';
import { indiaScope } from '../engine/indiaProduct.js';
import { generateQuestion } from '../engine/generators/index.js';
import { START_RATING, DIFF_RATING, expectedScore, updateRating, pickDifficulty, predictMark, xpFor } from '../engine/adaptive.js';
import { makeRng } from '../engine/qhelpers.js';

const DAY = 86400000;
const DEMO_YEAR = 10;
const INDIA_TRACK = 'cbse';

/** How readily the demo student gets a strand right — she is an algebra person. */
function affinityOf(strand) {
  if (/algebra|number/i.test(strand)) return 1.38;
  if (/trigonometry/i.test(strand)) return 0.78;
  if (/statistics|probability/i.test(strand)) return 0.86;
  return 1.15;
}

/**
 * What the demo student practises. Each item names a generator, the
 * difficulties it is authored at, and — for India — the NCERT chapter and dot
 * point the question is evidence for, so History and Progress can name them.
 */
function nswPool() {
  const { own, revision } = scopeForYear(DEMO_YEAR);
  const item = s => ({ id: s.id, strand: s.strand, diffs: [1, 2, 3, 4], chapterId: null, dotpointIndex: null });
  return { pool: [...own, ...own, ...revision].map(item), untouched: new Set(['y10-similarity', 'y9-surface-area', 'y10-stats']) };
}

function indiaPool() {
  const pool = [];
  for (const chapter of indiaScope(INDIA_TRACK, DEMO_YEAR)) {
    for (const cover of chapter.covers || []) {
      const diffs = (cover.diff || []).filter(d => d >= 1 && d <= 4);
      if (!diffs.length) continue;
      pool.push({ id: cover.gen, strand: chapter.strand, diffs, chapterId: chapter.id, dotpointIndex: Number.isInteger(cover.dp?.[0]) ? cover.dp[0] : null });
    }
  }
  // Two chapters she has not opened yet, so Progress has something honest to
  // say about coverage rather than a wall of green.
  return { pool, untouched: new Set(['c10-probability', 'c10-trig-applications']) };
}

const nearestDiff = (diffs, want) => diffs.reduce((best, d) => (Math.abs(d - want) < Math.abs(best - want) ? d : best), diffs[0]);

export async function seedDemo({ course = 'in' } = {}) {
  const india = course !== 'nsw';
  const rng = makeRng(india ? 20260905 : 20260818);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const rc = arr => arr[Math.floor(rng() * arr.length)];

  const pid = uuid();
  const timezone = defaultTimezone(india ? 'in' : 'nsw');
  const profile = {
    id: pid, name: 'Pri', year: DEMO_YEAR, course: india ? 'in' : 'nsw', role: 'student', avatar: '🚀',
    indiaTrack: india ? INDIA_TRACK : null, pathway: null, timezone,
    theme: 'dark', dailyGoal: 10, xp: 0, isDemo: true, createdAt: Date.now() - 50 * DAY
  };

  const { pool, untouched } = india ? indiaPool() : nswPool();
  const skip = item => untouched.has(item.chapterId || item.id);

  const ratings = {};
  const getR = id => ratings[id] || (ratings[id] = { rating: START_RATING, attempts: 0, correct: 0, last_at: 0 });
  const now = Date.now();
  let totalXp = 0;

  for (let d = 45; d >= 0; d--) {
    const dayStart = now - d * DAY;
    const practiceToday = d <= 8 ? true : rng() < 0.72;
    if (!practiceToday) continue;
    const nQuestions = d === 0 ? 4 : ri(6, 14);
    let dayCorrect = 0, dayXp = 0, dayMs = 0;
    for (let i = 0; i < nQuestions; i++) {
      let item = rc(pool);
      let guard = 10;
      while (skip(item) && guard--) item = rc(pool);
      const st = getR(item.id);
      const diff = nearestDiff(item.diffs, pickDifficulty(st.rating, st.attempts));
      const pCorrect = Math.min(0.96, expectedScore(st.rating, DIFF_RATING[diff]) * affinityOf(item.strand) + 0.04);
      const correct = rng() < pCorrect;
      const hints = correct && rng() < 0.2 ? 1 : 0;
      const before = st.rating;
      st.rating = updateRating(st.rating, st.attempts, diff, correct, hints);
      st.attempts++; if (correct) st.correct++;
      const ts = dayStart + i * 60000 * ri(2, 9);
      st.last_at = ts;
      const ms = ri(20000, 150000);
      const xp = xpFor(diff, correct, 0, hints);
      totalXp += xp; dayXp += xp; dayMs += ms; if (correct) dayCorrect++;
      // The last few days are real question rows, so History has something to
      // open, retry and name by chapter; the weeks before are attempts only.
      let questionId = 'seed';
      if (india && d <= 2) {
        try {
          const q = generateQuestion(item.id, diff, ri(1, 2 ** 30));
          questionId = uuid();
          await put('questions', {
            id: questionId, pid, subtopic: q.subtopic, difficulty: q.difficulty || diff, payload: q,
            india: { chapterId: item.chapterId, track: INDIA_TRACK, dotpointIndex: item.dotpointIndex },
            mode: 'practice', examId: null, taskId: null, answered: 1, tries: correct ? 1 : 2, hintsUsed: hints, createdAt: ts
          });
        } catch { questionId = 'seed'; }
      }
      await add('attempts', {
        pid, questionId, subtopic: item.id, difficulty: diff, correct: correct ? 1 : 0,
        answerGiven: correct ? 'correct' : 'wrong', ms, hintsUsed: hints, mode: 'practice',
        viaInk: rng() < 0.3, ratingBefore: before, ratingAfter: st.rating, createdAt: ts
      });
    }
    // The NSW model predicts an HSC mark; the India product refuses to invent
    // a board percentage, so an Indian day carries no prediction at all.
    const predicted = india ? null : predictMark(ratings, DEMO_YEAR, dayStart).mark;
    const date = dayKey(dayStart, timezone);
    await put('activity', { key: `${pid}:${date}`, pid, date, questions: nQuestions, correct: dayCorrect, xp: dayXp, ms: dayMs, predicted });
  }

  for (const [id, st] of Object.entries(ratings)) {
    await put('ratings', { key: `${pid}:${id}`, pid, subtopic: id, rating: st.rating, attempts: st.attempts, correct: st.correct, last_at: st.last_at });
  }

  const practiced = Object.keys(ratings).filter(id => ratings[id].attempts >= 3);
  for (let i = 0; i < Math.min(14, practiced.length); i++) {
    const dueOffset = i < 4 ? -ri(1, 3) : ri(1, 6);
    await put('reviews', { key: `${pid}:${practiced[i]}`, pid, subtopic: practiced[i], dueAt: now + dueOffset * DAY, intervalDays: ri(2, 12) });
  }

  profile.xp = totalXp;
  await put('profiles', profile);

  const badgeDays = { 'first-steps': 45, 'ten-up': 43, 'half-century': 31, 'streak-3': 37, 'streak-7': 4, 'sharpshooter': 36, 'night-owl': 40, 'explorer': 39, 'scholar': 35, 'comeback': 33, 'penmanship': 20 };
  for (const [bid, daysAgo] of Object.entries(badgeDays)) {
    await put('badges', { key: `${pid}:${bid}`, pid, badgeId: bid, earnedAt: now - daysAgo * DAY });
  }

  // One finished practice paper with full detail. Only the NSW demo gets one:
  // India exams are served from the reviewed exam catalogue, and a seeded
  // paper would be a fake board result.
  if (!india) {
    const examId = uuid();
    const qids = [];
    const detail = [];
    let score = 0;
    const subtopics = subtopicsForYear(DEMO_YEAR);
    for (let i = 0; i < 15; i++) {
      const s = subtopics[i % subtopics.length];
      const diff = i < 3 ? 1 : i < 9 ? 2 : i < 13 ? 3 : 4;
      const q = generateQuestion(s.id, diff, ri(1, 2 ** 30));
      const qid = uuid();
      const correct = i % 5 !== 4 && i !== 13;
      if (correct) score++;
      await put('questions', { id: qid, pid, subtopic: q.subtopic, difficulty: q.difficulty, payload: q, mode: 'exam', examId, taskId: null, answered: 1, tries: 0, hintsUsed: 0, createdAt: now - 6 * DAY });
      qids.push(qid);
      detail.push({
        id: qid, subtopic: q.subtopic, subtopicName: SUBTOPIC_BY_ID[q.subtopic]?.name, difficulty: q.difficulty,
        prompt: q.prompt, answerType: q.answerType, mcqOptions: q.mcqOptions,
        given: correct ? 'correct' : '—', correct,
        solution: { steps: q.steps, answerText: '' }
      });
    }
    await put('exams', { id: examId, pid, year: DEMO_YEAR, title: `Year ${DEMO_YEAR} Practice Paper 1`, durationMin: 45, questionIds: qids, createdAt: now - 6 * DAY, finishedAt: now - 6 * DAY + 41 * 60000, score, total: 15, detail });
  }

  for (const [i, s] of [8, 11, 14, 12].entries()) {
    await add('rushRuns', { pid, score: s, correct: s, total: s + ri(1, 4), bestCombo: ri(3, 8), createdAt: now - (12 - i * 3) * DAY });
  }
  await add('matchRuns', { pid, won: true, playerScore: 7, rivalScore: 5, rival: 'Robo-Rookie', ms: 0, createdAt: now - 9 * DAY });

  return profile;
}
