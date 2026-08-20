// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · In-browser demo profile: ~6 weeks of realistic history,
// generated locally with the real engine.
// ─────────────────────────────────────────────────────────────────────────────
import { put, add, uuid } from './idb.js';
import { sydneyDate } from './store.js';
import { scopeForYear, SUBTOPIC_BY_ID, subtopicsForYear } from '../engine/curriculum.js';
import { generateQuestion } from '../engine/generators/index.js';
import { START_RATING, DIFF_RATING, expectedScore, updateRating, pickDifficulty, predictMark, xpFor } from '../engine/adaptive.js';
import { makeRng } from '../engine/qhelpers.js';

const DAY = 86400000;

export async function seedDemo() {
  const rng = makeRng(20260818);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const rc = arr => arr[Math.floor(rng() * arr.length)];

  const YEAR = 10;
  const pid = uuid();
  const profile = {
    id: pid, name: 'Pri', year: YEAR, course: 'nsw', role: 'student', avatar: '🚀',
    theme: 'dark', dailyGoal: 10, xp: 0, isDemo: true, createdAt: Date.now() - 50 * DAY
  };

  const { own, revision } = scopeForYear(YEAR);
  const pool = [...own, ...own, ...revision];
  const affinity = {};
  for (const s of [...own, ...revision]) {
    affinity[s.id] = s.strand === 'Algebra' ? 1.38 : s.strand === 'Trigonometry' ? 0.78 : s.strand === 'Statistics & Probability' ? 0.86 : 1.15;
  }
  const untouched = new Set(['y10-similarity', 'y9-surface-area', 'y10-stats']);

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
      let sub = rc(pool);
      let guard = 10;
      while (untouched.has(sub.id) && guard--) sub = rc(pool);
      const st = getR(sub.id);
      const diff = pickDifficulty(st.rating, st.attempts);
      const pCorrect = Math.min(0.96, expectedScore(st.rating, DIFF_RATING[diff]) * affinity[sub.id] + 0.04);
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
      await add('attempts', {
        pid, questionId: 'seed', subtopic: sub.id, difficulty: diff, correct: correct ? 1 : 0,
        answerGiven: correct ? 'correct' : 'wrong', ms, hintsUsed: hints, mode: 'practice',
        viaInk: rng() < 0.3, ratingBefore: before, ratingAfter: st.rating, createdAt: ts
      });
    }
    const pred = predictMark(ratings, YEAR, dayStart);
    const date = sydneyDate(dayStart);
    await put('activity', { key: `${pid}:${date}`, pid, date, questions: nQuestions, correct: dayCorrect, xp: dayXp, ms: dayMs, predicted: pred.mark });
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

  // One finished exam with full detail
  const examId = uuid();
  const qids = [];
  const detail = [];
  let score = 0;
  const subtopics = subtopicsForYear(YEAR);
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
  await put('exams', { id: examId, pid, year: YEAR, title: `Year ${YEAR} Practice Paper 1`, durationMin: 45, questionIds: qids, createdAt: now - 6 * DAY, finishedAt: now - 6 * DAY + 41 * 60000, score, total: 15, detail });

  for (const [i, s] of [8, 11, 14, 12].entries()) {
    await add('rushRuns', { pid, score: s, correct: s, total: s + ri(1, 4), bestCombo: ri(3, 8), createdAt: now - (12 - i * 3) * DAY });
  }
  await add('matchRuns', { pid, won: true, playerScore: 7, rivalScore: 5, rival: 'Robo-Rookie', ms: 0, createdAt: now - 9 * DAY });

  return profile;
}
