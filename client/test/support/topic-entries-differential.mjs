// Pri Learning · what the engine reads for a learner, collected so two trees can be compared
//
// Every computation (the predicted mark and its coverage, the priorities, the strands, the misconceptions, the
// smart-practice draw, the spaced-review queue, the study plan, the progress export) must read each generator's own
// rows. This module runs them over scripted learners and returns plain data. client/test/topic-entries-check.mjs
// compares it with client/test/fixtures/topic-entries-main-golden.json, written by running this file (--write PATH)
// on origin/main 4251130bc, before the topic-entry change: the two must be equal in every number.
//
// Display names are the one thing allowed to differ (a companion reads as its base), so `name` fields are left out.
// SYNTHETIC: scripted learners.
import { installBrowserEnv, resetStorage } from '../backend-check.mjs';

export async function collect() {
  installBrowserEnv();
  resetStorage();
  const NOW = Date.parse('2026-11-20T02:00:00Z');
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const { dispatch } = await import('../../src/local/backend.js');
    const idb = await import('../../src/local/idb.js');
    const { ratingsFor } = await import('../../src/local/store.js');
    const { pickNext, predictMark, priorities, scheduleReview } = await import('../../src/engine/adaptive.js');
    const { nswIssuedLevels } = await import('../../src/engine/nswOffer.js');
    const { buildStudyPlan } = await import('../../src/plan/studyPlan.js');
    const { composeProgress } = await import('../../src/lib/exportProgress.js');
    const DAY = 86400000;
    const PAIRS = ['me12-induction', 'me12-vectors', 'me12-projectile', 'me12-binomial'];
    const dpOf = (id, k) => `${id}.${k}`;
    const rating = (pid, subtopic, i, side) => ({
      key: `${pid}:${subtopic}`, pid, subtopic, rating: 1010 + 55 * i + side * 17, attempts: 4 + i + side, correct: 2 + i,
      last_at: NOW - (3 + i * 2 + side) * DAY, recent: [1, 0, 1, 1].slice(0, 2 + (i % 3)),
      dp: { [dpOf(subtopic, 1)]: { rating: 1100 + 30 * i, attempts: 2 + i, correct: 1 + i, last_at: NOW - (2 + i) * DAY } },
      traps: i % 2 === 0 ? { [`slip-${subtopic}`]: { n: 3, s: 3, label: `a repeated slip in ${subtopic.replace(/-forms$/, '')}`, dotpoint: dpOf(subtopic, 1), lastAt: NOW - DAY, credit: 0 } } : {}
    });
    const SHAPES = {
      'base only': { base: true, companion: false },
      'companion only': { base: false, companion: true },
      'both sides': { base: true, companion: true },
      'neither': { base: false, companion: false }
    };
    const out = {};
    let n = 0;
    for (const [label, shape] of Object.entries(SHAPES)) {
      const profile = (await dispatch('POST', '/profiles', { name: `Learner ${++n}`, year: 12, course: 'nsw', pathway: 'ext1' })).user;
      await dispatch('POST', '/profiles/select', { id: profile.id });
      const pid = profile.id;
      const rows = [], reviews = [], attempts = [];
      PAIRS.forEach((base, i) => {
        const companion = `${base}-forms`;
        if (shape.base) rows.push(rating(pid, base, i, 0));
        if (shape.companion) rows.push(rating(pid, companion, i, 1));
        // A review that is due on the companion generator (and one on the base) must still be reached.
        if (shape.companion) reviews.push({ key: `${pid}:${companion}`, pid, subtopic: companion, ...scheduleReview(null, 1, NOW - (6 + i) * DAY) });
        if (shape.base && i % 2) reviews.push({ key: `${pid}:${base}`, pid, subtopic: base, ...scheduleReview(null, 3, NOW - (9 + i) * DAY) });
        for (const g of [shape.base && base, shape.companion && companion].filter(Boolean)) {
          for (let k = 0; k < 3; k++) attempts.push({ pid, subtopic: g, difficulty: 2 + (k % 2), correct: k !== 1, createdAt: NOW - (k + i + 1) * 3600000, mode: 'practice', questionId: `q-${g}-${k}` });
        }
      });
      rows.push(rating(pid, 'y12-diff', 3, 0), rating(pid, 'me11-poly', 2, 0));
      reviews.push({ key: `${pid}:y12-diff`, pid, subtopic: 'y12-diff', ...scheduleReview(null, 2, NOW - 7 * DAY) });
      for (const r of rows) await idb.put('ratings', r);
      for (const r of reviews) await idb.put('reviews', r);
      for (const a of attempts) await idb.add('attempts', a);

      const ratings = await ratingsFor(pid);
      const reviewsRaw = (await idb.byIndex('reviews', 'pid', pid)).sort((a, b) => a.dueAt - b.dueAt);
      const due = reviewsRaw.filter(r => r.dueAt <= NOW);
      const draws = [];
      for (let i = 0; i < 400; i++) {
        const d = pickNext({ ratings, reviewsDue: due, year: 12, pathway: 'ext1', rand: (i + 0.5) / 400, recent: [], nowMs: NOW, offered: id => nswIssuedLevels(id).length > 0 });
        draws.push([d.subtopic, d.difficulty, d.reason]);
      }
      const stats = await dispatch('GET', '/stats');
      const plan = buildStudyPlan({ profile: { ...profile, year: 12, course: 'nsw', pathway: 'ext1' }, ratings, reviews: reviewsRaw, examDate: '2027-10-14', weeklyMinutes: 150, today: '2026-11-20', nowMs: NOW, slips: [] });
      out[label] = {
        predicted: predictMark(ratings, 12, NOW, 'ext1'),
        priorities: priorities(ratings, 12, NOW, 9, 'ext1', {}),
        strands: stats.strands, trajectory: stats.trajectory, totals: stats.totals, byDiff: stats.byDiff,
        misconceptions: stats.misconceptions,
        draws,
        reviewsDue: due.map(r => [r.subtopic, r.dueAt]),
        plan: { weeks: plan.weeks, summary: plan.summary },
        // The progress export reads the stats and the curriculum reply as they stand.
        export: composeProgress({ stats, curriculum: null, exams: [], user: { ...profile, year: 12, course: 'nsw' } })
      };
    }
    return out;
  } finally {
    Date.now = realNow;
  }
}

/** The data with every display name left out (a companion reads as its base, so names are the one allowed difference). */
export const withoutNames = value => JSON.parse(JSON.stringify(value, (k, v) => (k === 'name' || k === 'subtopicName' ? undefined : v)));

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === '--write') {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.argv[3], JSON.stringify(withoutNames(await collect()), null, 1) + '\n');
  console.log(`wrote ${process.argv[3]}`);
  process.exit(0);
}
