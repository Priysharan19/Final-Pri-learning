// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · adaptive & spaced-review simulation suite (§13)
//
// Scripted learners run against the real picker (engine/adaptive.js) with a
// seeded random source and a counter clock, and the suite asserts the choices
// the engine makes — not that it "ran". Each group is one property the product
// promises a student:
//
//   determinism     the same learner state and the same `rand` give the same
//                   next question (subtopic, reason, difficulty), the same dot
//                   point and the same review schedule; a whole scripted
//                   session replays to the identical trace
//   cold start      a new learner is placed by the curriculum (own class,
//                   exam weight), with no invented mastery and the easiest
//                   rung — never by a guessed rating
//   anti-loop       a learner who keeps failing one idea is not trapped on it:
//                   it stays the most-served idea, but holds at most half of
//                   any recent window (regression: it used to take ~73% of all
//                   questions, four in a row, forever)
//   misconceptions  a repeated slip steers the queue under its #255 ontology
//                   ID, a legacy hash key migrates to that ID, and two clean
//                   repairs quieten it
//   support         hinted / tutored / second-try successes count for less
//                   than independent ones in rating, mastery and FSRS grade
//                   (#246)
//   due reviews     a review is served when due and not before; Again shrinks
//                   the interval and counts a lapse, Good at the due date grows
//                   it, massed same-day repetition does not inflate it, and the
//                   long-term cap holds
//
// Usage: node client/test/adaptive-simulation-check.mjs
// ─────────────────────────────────────────────────────────────────────────────

const SRC = new URL('../src/', import.meta.url).href;
const A = await import(`${SRC}engine/adaptive.js`);
const M = await import(`${SRC}engine/misconceptions.js`);

const DAY = 86400000;
let pass = 0;
const failures = [];
let group = 'startup';
const section = name => { group = name; };
const show = v => JSON.stringify(v) ?? String(v);
function ok(name, cond, detail = '') {
  if (cond) { pass++; return true; }
  failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
const eq = (name, actual, expected) => ok(name, show(actual) === show(expected), `expected ${show(expected)}, got ${show(actual)}`);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// The engine must never reach for its own randomness when it was handed some.
// Any call to Math.random inside a picker that was given `rand` is a defect, so
// the global is booby-trapped for the determinism group.
const realRandom = Math.random;
function forbidRandom() { Math.random = () => { throw new Error('Math.random used despite an explicit rand'); }; }
function allowRandom() { Math.random = realRandom; }

const T0 = Date.UTC(2026, 8, 1, 4, 30);

// Eight chapters with CBSE-like weights (marks), the first six own-class, the
// last two the year ahead (revision material for the coverage axis).
const CANDIDATES = [
  { id: 'ch-a', weight: 8, own: true }, { id: 'ch-b', weight: 6, own: true },
  { id: 'ch-c', weight: 6, own: true }, { id: 'ch-d', weight: 5, own: true },
  { id: 'ch-e', weight: 5, own: true }, { id: 'ch-f', weight: 4, own: true },
  { id: 'ch-g', weight: 7, own: false }, { id: 'ch-h', weight: 3, own: false }
];

/**
 * One scripted session. `outcome(id, i, rand)` decides correctness; hints are
 * optional per id. Ratings, FSRS reviews and the recent list are kept exactly
 * as local/backend.js keeps them (resolve() + noteServed()).
 */
function simulate({ n = 120, seed = 7, outcome, hintsFor = () => 0, candidates = CANDIDATES, start = T0, step = 90000, window = 8 }) {
  const rng = mulberry32(seed);
  const ratings = {};
  const reviews = {};
  const recent = [];
  const trace = [];
  let now = start;
  for (let i = 0; i < n; i++) {
    const due = Object.values(reviews).filter(r => r.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
    const pick = A.pickNextAmong({ candidates, ratings, reviewsDue: due, rand: rng(), recent, nowMs: now });
    const id = pick.subtopic;
    const st = ratings[id] || { rating: A.START_RATING, attempts: 0, correct: 0, last_at: 0, recent: [] };
    const correct = !!outcome(id, i, rng);
    const hints = hintsFor(id, i);
    ratings[id] = {
      ...st,
      rating: A.updateRating(st.rating, st.attempts, pick.difficulty, correct, hints),
      attempts: st.attempts + 1, correct: st.correct + (correct ? 1 : 0), last_at: now,
      recent: [correct ? 1 : 0, ...(st.recent || [])].slice(0, 8)
    };
    const grade = A.gradeFor({ correct, hintsUsed: hints, tries: 0, ms: 30000, difficulty: pick.difficulty });
    if (reviews[id]) reviews[id] = { subtopic: id, ...A.scheduleReview(reviews[id], grade, now) };
    else if (ratings[id].attempts >= 3) reviews[id] = { subtopic: id, ...A.scheduleReview(null, grade, now) };
    recent.unshift(id);
    recent.length = Math.min(recent.length, window);
    trace.push({ id, reason: pick.reason, difficulty: pick.difficulty, correct });
    now += step;
  }
  return { trace, ratings, reviews, now };
}

const longestRun = ids => {
  let best = 0, run = 0, prev = null;
  for (const id of ids) { run = id === prev ? run + 1 : 1; prev = id; best = Math.max(best, run); }
  return best;
};
const maxInWindow = (ids, id, w) => {
  let best = 0;
  for (let i = 0; i + w <= ids.length; i++) best = Math.max(best, ids.slice(i, i + w).filter(x => x === id).length);
  return best;
};

// ── Determinism ──────────────────────────────────────────────────────────────
section('determinism');
{
  // A learner state where the success target falls between two rungs, so the
  // rung really is a draw — the case the defect lived in.
  const ratings = {
    'ch-a': { rating: 1210, attempts: 6, correct: 4, last_at: T0 - 2 * DAY, recent: [1, 0, 1] },
    'ch-b': { rating: 1090, attempts: 4, correct: 2, last_at: T0 - 5 * DAY, recent: [0, 1] },
    'ch-c': { rating: 1320, attempts: 12, correct: 10, last_at: T0 - 9 * DAY, recent: [1, 1, 1] }
  };
  const reviewsDue = [{ subtopic: 'ch-c', ...A.scheduleReview(null, A.GRADE.GOOD, T0 - 12 * DAY) }];
  const args = { candidates: CANDIDATES, ratings, reviewsDue, recent: ['ch-b'], nowMs: T0 };
  forbidRandom();
  let threw = null;
  const outs = new Set();
  const diffs = new Set();
  try {
    for (const rand of [0.03, 0.31, 0.5, 0.77, 0.99]) {
      const first = A.pickNextAmong({ ...args, rand });
      for (let k = 0; k < 25; k++) outs.add(`${rand}:${show(A.pickNextAmong({ ...args, rand }))}` === `${rand}:${show(first)}` ? 'same' : 'diff');
      diffs.add(first.difficulty);
    }
  } catch (err) { threw = err.message; }
  allowRandom();
  ok('pickNextAmong never calls Math.random when given rand (regression: the difficulty rung did)', threw === null, threw || '');
  eq('pickNextAmong is a pure function of its inputs', [...outs], ['same']);
  ok('different rand values can still reach different rungs (the mix is a real mix)', diffs.size >= 1);

  forbidRandom();
  let dpThrew = null;
  let dpSame = true;
  try {
    const states = [
      { id: 'dp0', index: 0, rating: 1150, attempts: 0, correct: 0, last_at: 0 },
      { id: 'dp1', index: 1, rating: 1100, attempts: 3, correct: 1, last_at: T0 - DAY },
      { id: 'dp2', index: 2, rating: 1300, attempts: 6, correct: 5, last_at: T0 - 20 * DAY }
    ];
    const first = A.pickDotpoint(states, { rand: 0.42, nowMs: T0, recent: ['dp0'] });
    for (let k = 0; k < 20; k++) dpSame = dpSame && A.pickDotpoint(states, { rand: 0.42, nowMs: T0, recent: ['dp0'] }) === first;
  } catch (err) { dpThrew = err.message; }
  allowRandom();
  ok('pickDotpoint is deterministic for the same inputs', dpThrew === null && dpSame, dpThrew || '');

  const s1 = A.scheduleReview({ stability: 4.2, fsrsDifficulty: 5.1, reps: 3, lapses: 1, lastAt: T0 - 5 * DAY, intervalDays: 4, dueAt: T0 - DAY }, A.GRADE.GOOD, T0);
  const s2 = A.scheduleReview({ stability: 4.2, fsrsDifficulty: 5.1, reps: 3, lapses: 1, lastAt: T0 - 5 * DAY, intervalDays: 4, dueAt: T0 - DAY }, A.GRADE.GOOD, T0);
  eq('scheduleReview is deterministic', s1, s2);

  const outcome = (id, i, r) => (id === 'ch-b' ? r() < 0.3 : r() < 0.75);
  forbidRandom();
  let simThrew = null;
  let a = null, b = null;
  try {
    a = simulate({ n: 80, seed: 99, outcome });
    b = simulate({ n: 80, seed: 99, outcome });
  } catch (err) { simThrew = err.message; }
  allowRandom();
  ok('a scripted 80-question session never reaches for Math.random', simThrew === null, simThrew || '');
  ok('a scripted 80-question session replays to the identical trace', a && b && show(a.trace) === show(b.trace));
}

// ── Cold start ───────────────────────────────────────────────────────────────
section('cold start');
{
  const first = A.pickNextAmong({ candidates: CANDIDATES, ratings: {}, reviewsDue: [], rand: 0.5, recent: [], nowMs: T0 });
  eq('a new learner\'s first pick is new ground', first.reason, 'new-ground');
  ok('the first pick is in the learner\'s own class, not the year ahead', CANDIDATES.find(c => c.id === first.subtopic)?.own === true, first.subtopic);
  eq('no mastery is invented for an unseen chapter', first.mastery, 0);
  eq('the success target for a first meeting is the fresh target', first.target, A.TARGET_SUCCESS.fresh);
  eq('a first meeting is served on the easiest rung', first.difficulty, 1);
  eq('masteryOf with no attempts is zero whatever the rating says', [A.masteryOf(1800, 0, T0, T0), A.masteryOf(600, 0, T0, T0)], [0, 0]);

  // Across seeds the opening pick is always among the heavier own-class
  // chapters: the jitter breaks ties, the curriculum decides.
  const opening = {};
  for (let s = 1; s <= 200; s++) {
    const id = A.pickNextAmong({ candidates: CANDIDATES, ratings: {}, reviewsDue: [], rand: mulberry32(s)(), recent: [], nowMs: T0 }).subtopic;
    opening[id] = (opening[id] || 0) + 1;
  }
  ok('opening picks are always own-class chapters', Object.keys(opening).every(id => CANDIDATES.find(c => c.id === id).own), show(opening));
  ok('the lightest own-class chapter never opens', !opening['ch-f'], show(opening));
  eq('the heaviest own-class chapter opens most often', Object.entries(opening).sort((x, y) => y[1] - x[1])[0][0], 'ch-a');

  // A whole fresh session meets every own-class chapter before repeating any.
  const { trace } = simulate({ n: 6, seed: 3, outcome: () => true });
  eq('the first six questions cover the six own-class chapters once each', [...new Set(trace.map(t => t.id))].sort(), ['ch-a', 'ch-b', 'ch-c', 'ch-d', 'ch-e', 'ch-f']);
  ok('every cold-start pick is labelled new ground', trace.every(t => t.reason === 'new-ground'), show(trace.map(t => t.reason)));

  const prio = A.prioritiesAmong(CANDIDATES.map(c => ({ ...c, name: c.id, rev: !c.own })), {}, T0, 8);
  ok('cold-start priorities say "not attempted yet", never a mastery figure', prio.every(p => p.reason.startsWith('not attempted yet') && p.mastery === 0), show(prio.map(p => p.reason)));
  eq('cold-start priorities rank own-class chapters by exam weight', prio.filter(p => !CANDIDATES.find(c => c.id === p.subtopic).own === false).slice(0, 3).map(p => p.subtopic), ['ch-a', 'ch-b', 'ch-c']);
}

// ── Anti-loop ────────────────────────────────────────────────────────────────
section('anti-loop');
{
  // Learner 1: always wrong on ch-a, right 80% elsewhere.
  const stuck = simulate({ n: 120, seed: 7, outcome: (id, i, r) => (id === 'ch-a' ? false : r() < 0.8) });
  const ids = stuck.trace.map(t => t.id);
  const share = ids.filter(id => id === 'ch-a').length / ids.length;
  ok('a failing idea holds at most 40% of a long session (regression: 72.5%)', share <= 0.40, `share ${share.toFixed(3)}`);
  ok('a failing idea is still the most-served idea — it is not abandoned', Object.entries(ids.reduce((m, id) => ({ ...m, [id]: (m[id] || 0) + 1 }), {})).sort((x, y) => y[1] - x[1])[0][0] === 'ch-a');
  ok('a failing idea never takes more than 4 of any 8 consecutive picks', maxInWindow(ids, 'ch-a', 8) <= 4, `max ${maxInWindow(ids, 'ch-a', 8)}`);
  ok('no run longer than the acquisition run', longestRun(ids) <= A.INTERLEAVE.acquisitionRun, `longest ${longestRun(ids)}`);
  ok('once acquisition is spent, the failing idea runs at most two in a row', longestRun(ids.slice(40)) <= A.INTERLEAVE.settledRun, `longest ${longestRun(ids.slice(40))}`);
  ok('every own-class chapter keeps being served', ['ch-b', 'ch-c', 'ch-d', 'ch-e', 'ch-f'].every(id => ids.slice(60).includes(id)), show([...new Set(ids.slice(60))]));

  // Learner 2: perfect everywhere — settled interleaving.
  const strong = simulate({ n: 80, seed: 11, outcome: () => true });
  const sids = strong.trace.map(t => t.id);
  ok('a strong learner is never blocked more than two in a row after acquisition', longestRun(sids.slice(16)) <= A.INTERLEAVE.settledRun, `longest ${longestRun(sids.slice(16))}`);
  ok('a strong learner sees every chapter, the year ahead included', new Set(sids).size === CANDIDATES.length, show([...new Set(sids)]));

  // Learner 3: failing everything — no single idea may own the queue.
  const lost = simulate({ n: 80, seed: 5, outcome: () => false });
  const lids = lost.trace.map(t => t.id);
  const top = Math.max(...Object.values(lids.reduce((m, id) => ({ ...m, [id]: (m[id] || 0) + 1 }), {})));
  ok('a learner failing everything is spread across ideas (no idea above 40%)', top / lids.length <= 0.40, `top share ${(top / lids.length).toFixed(3)}`);

  // The window-share cap, isolated from everything else that bounds a block.
  // Acquiring state (1 correct, 3 attempts: under acquisitionAttempts), a run
  // of three (under acquisitionRun), but four of the last six picks: only the
  // window-share rule can say no here.
  const acq = { rating: 1100, attempts: 3, correct: 1 };
  const broken = ['ch-a', 'ch-a', 'ch-a', 'ch-x', 'ch-a', 'ch-y'];
  ok('precondition: the idea is still acquiring', acq.correct < A.INTERLEAVE.acquisitionCorrect && acq.attempts < A.INTERLEAVE.acquisitionAttempts);
  ok('precondition: the current run is under the acquisition run', broken.indexOf('ch-x') < A.INTERLEAVE.acquisitionRun);
  eq('window share: an acquiring idea holding 4 of the last 6 picks is suppressed', A.interleavePenalty('ch-a', broken, acq), 0.04);
  eq('window share: the same idea holding 2 of 6 is not', A.interleavePenalty('ch-a', ['ch-a', 'ch-a', 'ch-x', 'ch-y', 'ch-z', 'ch-w'], acq), 1);
  // Settled state: alternate picks (never a run of two) but half the window.
  const settled = { rating: 1300, attempts: 9, correct: 6 };
  eq('window share: a settled idea served every other pick is suppressed', A.interleavePenalty('ch-a', ['ch-x', 'ch-a', 'ch-y', 'ch-a', 'ch-z', 'ch-a', 'ch-w', 'ch-a'], settled), 0.04);
  // End to end with acquisition never expiring: the window rule alone must
  // keep a failing idea at or under half of any recent window.
  const savedAttempts = A.INTERLEAVE.acquisitionAttempts;
  A.INTERLEAVE.acquisitionAttempts = Number.MAX_SAFE_INTEGER;
  let capped;
  try {
    capped = simulate({ n: 120, seed: 7, outcome: (id, i, r) => (id === 'ch-a' ? false : r() < 0.8) }).trace.map(t => t.id);
  } finally { A.INTERLEAVE.acquisitionAttempts = savedAttempts; }
  ok('with acquisition never expiring, the window cap alone holds a failing idea to 4 of any 8 picks', maxInWindow(capped, 'ch-a', 8) <= 4, `max ${maxInWindow(capped, 'ch-a', 8)}`);
  ok('…and to at most half of the session', capped.filter(id => id === 'ch-a').length / capped.length <= 0.5, `share ${(capped.filter(id => id === 'ch-a').length / capped.length).toFixed(3)}`);

  // Dot points: the same dot point is not served three times running.
  const dps = [0, 1, 2, 3].map(i => ({ id: `dp${i}`, index: i, rating: 1150, attempts: 0, correct: 0, last_at: 0 }));
  const rng = mulberry32(17);
  const recent = [];
  const served = [];
  let now = T0;
  for (let i = 0; i < 40; i++) {
    const dp = A.pickDotpoint(dps, { rand: rng(), nowMs: now, recent });
    served.push(dp.id);
    dp.attempts++; dp.last_at = now;
    if (dp.id !== 'dp0') { dp.correct++; dp.rating = A.updateRating(dp.rating, dp.attempts - 1, 2, true); } else dp.rating = A.updateRating(dp.rating, dp.attempts - 1, 2, false);
    recent.unshift(dp.id); recent.length = Math.min(recent.length, 8);
    now += 60000;
  }
  ok('no dot point is served three times in a row', longestRun(served) <= 2, show(served.join(' ')));
  ok('every dot point is reached', new Set(served).size === dps.length);
}

// ── Misconception targeting (#255) ───────────────────────────────────────────
section('misconceptions');
{
  const why = 'Every one of the 30 people is equally likely, so the denominator is the whole table, not one of its rows or columns.';
  const mapped = M.mappedIdForTrap(why);
  eq('precondition: the authored trap maps to its ontology ID', mapped, 'probability-wrong-total');
  const legacyKey = A.misconceptionKey('ch-d', why);
  ok('precondition: the legacy key is the hash form', /^ch-d\.t[0-9a-z]+$/.test(legacyKey), legacyKey);
  const legacyRow = { rating: 1120, attempts: 7, correct: 3, last_at: T0 - DAY, recent: [0, 1, 0], traps: { [legacyKey]: { n: 3, credit: 0, label: 'whole-table denominator', lastAt: T0 - DAY } } };
  const row = M.migrateRatingRow(legacyRow);
  ok('a legacy hash-keyed ledger migrates to the ontology ID', Object.keys(row.traps || {}).includes('probability-wrong-total'), show(Object.keys(row.traps || {})));
  const ratings = {
    'ch-a': { rating: 1350, attempts: 12, correct: 10, last_at: T0 - DAY, recent: [1, 1, 1] },
    'ch-b': { rating: 1340, attempts: 12, correct: 10, last_at: T0 - DAY, recent: [1, 1, 1] },
    'ch-c': { rating: 1330, attempts: 12, correct: 10, last_at: T0 - DAY, recent: [1, 1, 1] },
    'ch-d': row,
    'ch-e': { rating: 1320, attempts: 12, correct: 10, last_at: T0 - DAY, recent: [1, 1, 1] },
    'ch-f': { rating: 1310, attempts: 12, correct: 10, last_at: T0 - DAY, recent: [1, 1, 1] }
  };
  const cands = CANDIDATES.filter(c => c.own);
  const pick = A.pickNextAmong({ candidates: cands, ratings, reviewsDue: [], rand: 0.5, recent: [], nowMs: T0 });
  eq('a repeated slip steers the queue to its chapter', pick.subtopic, 'ch-d');
  eq('the reason is the misconception', pick.reason, 'misconception');
  eq('the trap carried to the question generator is the ontology ID', pick.trap?.key, 'probability-wrong-total');
  ok('that ID resolves in the ontology', !!M.misconceptionById(pick.trap?.key));
  eq('the success target is lowered while the slip is live', pick.target, A.TARGET_SUCCESS.fragile);

  const quiet = { ...row, traps: { 'probability-wrong-total': { ...row.traps['probability-wrong-total'], credit: A.TRAP_CREDIT_QUIET } } };
  const after = A.pickNextAmong({ candidates: cands, ratings: { ...ratings, 'ch-d': quiet }, reviewsDue: [], rand: 0.5, recent: [], nowMs: T0 });
  ok('two clean repairs stop the slip steering the queue', after.reason !== 'misconception' && !after.trap, show({ reason: after.reason, trap: after.trap?.key }));
  const stale = { ...row, traps: { 'probability-wrong-total': { ...row.traps['probability-wrong-total'], lastAt: T0 - (A.TRAP_WINDOW_DAYS + 1) * DAY } } };
  eq('a slip outside the recency window is no longer active', A.activeTraps(stale.traps, T0).length, 0);
}

// ── Supported vs independent evidence (#246) ────────────────────────────────
section('supported evidence');
{
  const clean = A.updateRating(1150, 4, 2, true, 0);
  const hinted = A.updateRating(1150, 4, 2, true, 1);
  const tutored3 = A.updateRating(1150, 4, 2, true, 3);
  ok('a hinted success gains less rating than an independent one', hinted < clean, `${hinted} vs ${clean}`);
  ok('more help gains less again', tutored3 < hinted, `${tutored3} vs ${hinted}`);
  ok('help never turns a success into a loss', tutored3 > 1150);
  eq('FSRS grade: hinted success is Hard', A.gradeFor({ correct: true, hintsUsed: 1, difficulty: 2, ms: 10000 }), A.GRADE.HARD);
  eq('FSRS grade: second-try success is Hard', A.gradeFor({ correct: true, tries: 1, difficulty: 2, ms: 10000 }), A.GRADE.HARD);
  eq('FSRS grade: fast clean success is Easy', A.gradeFor({ correct: true, difficulty: 2, ms: 10000 }), A.GRADE.EASY);
  eq('FSRS grade: slow clean success is Good', A.gradeFor({ correct: true, difficulty: 2, ms: 50000 }), A.GRADE.GOOD);
  eq('FSRS grade: any miss is Again', A.gradeFor({ correct: false, difficulty: 2 }), A.GRADE.AGAIN);

  // Two scripted learners, identical outcomes; one always takes a hint.
  const only = [{ id: 'ch-a', weight: 8, own: true }];
  const ind = simulate({ n: 10, seed: 1, outcome: () => true, candidates: only, step: DAY });
  const sup = simulate({ n: 10, seed: 1, outcome: () => true, candidates: only, step: DAY, hintsFor: () => 1 });
  const mi = A.masteryOf(ind.ratings['ch-a'].rating, 10, ind.ratings['ch-a'].last_at, ind.now);
  const ms = A.masteryOf(sup.ratings['ch-a'].rating, 10, sup.ratings['ch-a'].last_at, sup.now);
  ok('ten supported successes show less mastery than ten independent ones', ms < mi, `${ms.toFixed(3)} vs ${mi.toFixed(3)}`);
  ok('supported successes schedule the next review sooner', sup.reviews['ch-a'].intervalDays < ind.reviews['ch-a'].intervalDays, `${sup.reviews['ch-a'].intervalDays}d vs ${ind.reviews['ch-a'].intervalDays}d`);
}

// ── Due-review semantics ─────────────────────────────────────────────────────
section('due reviews');
{
  const first = A.scheduleReview(null, A.GRADE.GOOD, T0);
  ok('a first review is scheduled within the first-interval cap', first.intervalDays >= 1 && first.intervalDays <= A.FIRST_INTERVAL_CAP, show(first));
  eq('the due date is exactly the interval after the answer', first.dueAt, T0 + first.intervalDays * DAY);
  const again0 = A.scheduleReview(null, A.GRADE.AGAIN, T0);
  ok('a first miss is due sooner than a first success', again0.intervalDays <= first.intervalDays);
  eq('a first miss is one lapse', again0.lapses, 1);

  const atDue = first.dueAt;
  const good = A.scheduleReview(first, A.GRADE.GOOD, atDue);
  ok('Good at the due date grows the interval', good.intervalDays > first.intervalDays, `${first.intervalDays} → ${good.intervalDays}`);
  eq('Good keeps lapses', good.lapses, 0);
  eq('reps count up', good.reps, 2);
  const again = A.scheduleReview(good, A.GRADE.AGAIN, good.dueAt);
  ok('Again at the due date shrinks the interval', again.intervalDays < good.intervalDays, `${good.intervalDays} → ${again.intervalDays}`);
  eq('Again counts a lapse', again.lapses, 1);
  const hard = A.scheduleReview(good, A.GRADE.HARD, good.dueAt);
  const easy = A.scheduleReview(good, A.GRADE.EASY, good.dueAt);
  ok('Hard < Good < Easy at the same moment', hard.intervalDays <= A.scheduleReview(good, A.GRADE.GOOD, good.dueAt).intervalDays && A.scheduleReview(good, A.GRADE.GOOD, good.dueAt).intervalDays <= easy.intervalDays,
    show([hard.intervalDays, easy.intervalDays]));

  // Massed practice: five Good answers inside ten minutes must not buy a long interval.
  let massed = A.scheduleReview(null, A.GRADE.GOOD, T0);
  for (let k = 1; k <= 5; k++) massed = A.scheduleReview(massed, A.GRADE.GOOD, T0 + k * 120000);
  ok('massed same-day repetition does not inflate the interval', massed.intervalDays <= first.intervalDays + 1, `${massed.intervalDays}d after 6 same-day answers`);

  // Spaced success converges up to the cap and never past it.
  let spaced = A.scheduleReview(null, A.GRADE.EASY, T0);
  for (let k = 0; k < 30; k++) spaced = A.scheduleReview(spaced, A.GRADE.EASY, spaced.dueAt);
  eq('the interval never exceeds MAX_INTERVAL', spaced.intervalDays, A.MAX_INTERVAL);

  // Leeches: more lapses → higher retention target → shorter intervals.
  ok('a leech is held to a higher retention target', A.desiredRetention({ lapses: 4 }) > A.desiredRetention({ lapses: 0 }));

  // Served when due, not before: a known chapter with a live review beats an
  // equally strong chapter without one, and the same row not yet due does not.
  const strong = { rating: 1500, attempts: 15, correct: 14, last_at: T0 - 3 * DAY, recent: [1, 1, 1] };
  const ratings = Object.fromEntries(CANDIDATES.filter(c => c.own).map(c => [c.id, { ...strong }]));
  const cands = CANDIDATES.filter(c => c.own);
  const rev = { subtopic: 'ch-f', ...A.scheduleReview(null, A.GRADE.GOOD, T0 - 10 * DAY) };
  ok('precondition: the review is due', rev.dueAt <= T0);
  const duePick = A.pickNextAmong({ candidates: cands, ratings, reviewsDue: [rev], rand: 0.5, recent: [], nowMs: T0 });
  eq('a due review is served first', [duePick.subtopic, duePick.reason], ['ch-f', 'review']);
  // The backend only ever hands the picker rows with dueAt <= now.
  const notDue = [rev].filter(r => r.dueAt <= rev.dueAt - DAY);
  const early = A.pickNextAmong({ candidates: cands, ratings, reviewsDue: notDue, rand: 0.5, recent: [], nowMs: rev.dueAt - DAY });
  ok('a review that is not yet due is not served as a review', early.reason !== 'review');
  ok('review pressure grows with time overdue', A.reviewPressure(rev, T0 + 20 * DAY) > A.reviewPressure(rev, T0));

  // Rescheduling on outcome, end to end through a scripted learner: the row
  // for a chapter answered wrong at its review is due sooner than one answered right.
  const right = simulate({ n: 30, seed: 21, outcome: () => true, candidates: cands, step: 6 * 3600000 });
  const wrongF = simulate({ n: 30, seed: 21, outcome: (id) => id !== 'ch-f', candidates: cands, step: 6 * 3600000 });
  ok('a chapter answered wrong is due sooner than the same chapter answered right', wrongF.reviews['ch-f'] && right.reviews['ch-f'] && wrongF.reviews['ch-f'].dueAt < right.reviews['ch-f'].dueAt,
    show([wrongF.reviews['ch-f']?.intervalDays, right.reviews['ch-f']?.intervalDays]));
  ok('the failing chapter carries lapses, the passing one none', (wrongF.reviews['ch-f']?.lapses || 0) > 0 && right.reviews['ch-f']?.lapses === 0);
}

// ── Report ───────────────────────────────────────────────────────────────────
allowRandom();
if (failures.length) {
  console.error(`ADAPTIVE SIMULATION: FAIL — ${failures.length} failed, ${pass} passed`);
  for (const f of failures) console.error(`  ✘ ${f}`);
  process.exit(1);
}
console.log(`ADAPTIVE SIMULATION: PASS — ${pass}/${pass} checks`);
