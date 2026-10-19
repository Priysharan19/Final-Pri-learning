// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Spaced review queue suite (ledger §6.3)
//
// "Due today" per dot point, from forgetting curves. A deterministic 30-day
// simulation over the pure function in engine/reviewQueue.js, with the
// chapter's FSRS row advanced through the real scheduleReview/gradeFor, and
// a controlled clock:
//
//   · a dot point practised once decays faster than one practised four times,
//     and one answered wrong decays faster than one answered right;
//   · recall falls monotonically while a dot point is untouched and crosses
//     the retention target on a predictable day, after which it stays due;
//   · reviewing it on its due day restarts the curve, and the second interval
//     is longer than the first (spacing grows);
//   · the queue is ordered weakest recall first, `upcoming` holds what comes
//     due inside a week, nothing with zero attempts is counted, and the same
//     inputs produce the same queue twice.
//
// Then the server replay: reviewStateFromAttempts rebuilds the same inputs
// from server-graded attempts (GET /v1/practice/review-queue).
//
// Usage: node client/test/review-queue-check.mjs
// ─────────────────────────────────────────────────────────────────────────────

const SRC = new URL('../src/', import.meta.url).href;
const DAY = 86_400_000;
let pass = 0;
const failures = [];
let group = 'simulation';
const section = n => { group = n; };
const show = v => JSON.stringify(v) ?? String(v);
const ok = (name, cond, detail = '') => { if (cond) { pass++; return true; } failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`); return false; };
const eq = (name, a, b) => ok(name, show(a) === show(b), `expected ${show(b)}, got ${show(a)}`);

const R = await import(`${SRC}engine/reviewQueue.js`);
const A = await import(`${SRC}engine/adaptive.js`);

// ── A tiny learner model over the real stores' shapes ───────────────────────
const T0 = Date.UTC(2026, 9, 1, 4, 30);          // 10:00 IST, 1 Oct 2026
const CH = 'c10-quadratic-equations';
const dpKey = n => `${CH}.${n}`;

function makeWorld() {
  return { ratings: { [CH]: { rating: 1150, attempts: 0, correct: 0, last_at: null, dp: {} } }, reviews: [] };
}
/** One marked attempt on a dot point: the rating row's dp map and the chapter FSRS row move as resolve() moves them. */
function attempt(world, dp, correct, now) {
  const row = world.ratings[CH];
  const prev = row.dp[dp] || { rating: 1150, attempts: 0, correct: 0, last_at: null };
  row.dp[dp] = { rating: prev.rating, attempts: prev.attempts + 1, correct: prev.correct + (correct ? 1 : 0), last_at: now };
  row.attempts++; row.correct += correct ? 1 : 0; row.last_at = now;
  const grade = A.gradeFor({ correct, hintsUsed: 0, tries: 0, ms: 30000, difficulty: 2 });
  const existing = world.reviews.find(r => r.subtopic === CH);
  if (existing) Object.assign(existing, A.scheduleReview(existing, grade, now));
  else if (row.attempts >= 3) world.reviews.push({ key: `p:${CH}`, pid: 'p', subtopic: CH, ...A.scheduleReview(null, grade, now) });
}
const queueAt = (world, now) => R.dueDotpoints({ ratings: world.ratings, reviews: world.reviews, now });
const find = (q, id) => [...q.due, ...q.upcoming].find(r => r.id === id) || null;
const recallOf = (world, id, now) => {
  const q = queueAt(world, now);
  const all = [...q.due, ...q.upcoming];
  const hit = all.find(r => r.id === id);
  if (hit) return hit.recall;
  // Not listed (not due and more than a week out): recompute from the engine the same way.
  const st = world.ratings[CH].dp[id];
  const rev = world.reviews.find(r => r.subtopic === CH);
  const s = R.dotpointStability({ chapterStability: rev ? A.migrateReview(rev, now).stability : null, attempts: st.attempts, correct: st.correct });
  return Math.round(A.retrievability((now - st.last_at) / DAY, s) * 100) / 100;
};

// ── Day 0 ───────────────────────────────────────────────────────────────────
section('simulation');
const world = makeWorld();
attempt(world, dpKey(1), true, T0);                 // dot point 1: once, right
attempt(world, dpKey(2), true, T0 + 60_000);        // dot point 2: four times, right
attempt(world, dpKey(2), true, T0 + 120_000);
attempt(world, dpKey(2), true, T0 + 180_000);
attempt(world, dpKey(2), true, T0 + 240_000);
attempt(world, dpKey(3), false, T0 + 300_000);      // dot point 3: wrong then right
attempt(world, dpKey(3), true, T0 + 360_000);
world.ratings[CH].dp[dpKey(4)] = { rating: 1150, attempts: 0, correct: 0, last_at: null }; // never asked

const day0 = queueAt(world, T0 + 400_000);
eq('nothing is due the moment it was practised', day0.due.map(r => r.id), []);
eq('three dot points are counted; the never-asked one is not', day0.counted, 3);
ok('a chapter FSRS row exists after three attempts', world.reviews.length === 1);
ok('stability: four right answers > one right answer > wrong-then-right',
  R.dotpointStability({ chapterStability: 3, attempts: 4, correct: 4 }) > R.dotpointStability({ chapterStability: 3, attempts: 1, correct: 1 })
  && R.dotpointStability({ chapterStability: 3, attempts: 1, correct: 1 }) > R.dotpointStability({ chapterStability: 3, attempts: 2, correct: 1 }) * 1.0
  , show([R.dotpointStability({ chapterStability: 3, attempts: 4, correct: 4 }), R.dotpointStability({ chapterStability: 3, attempts: 1, correct: 1 }), R.dotpointStability({ chapterStability: 3, attempts: 2, correct: 1 })]));
eq('a dot point with no attempts has no stability', R.dotpointStability({ attempts: 0 }), null);

// ── Days 1–30, untouched ────────────────────────────────────────────────────
const firstDue = {};
const recallTrail = { [dpKey(1)]: [], [dpKey(2)]: [], [dpKey(3)]: [] };
for (let d = 1; d <= 30; d++) {
  const now = T0 + d * DAY;
  const q = queueAt(world, now);
  for (const id of Object.keys(recallTrail)) {
    recallTrail[id].push(recallOf(world, id, now));
    if (firstDue[id] == null && q.due.some(r => r.id === id)) firstDue[id] = d;
  }
}
for (const id of Object.keys(recallTrail)) {
  const t = recallTrail[id];
  ok(`${id}: recall never rises while untouched`, t.every((v, i) => i === 0 || v <= t[i - 1]), show(t));
}
ok('every practised dot point comes due within 30 days', Object.keys(recallTrail).every(id => firstDue[id] != null), show(firstDue));
ok('the dot point seen four times comes due later than the one seen once', firstDue[dpKey(2)] > firstDue[dpKey(1)], show(firstDue));
ok('the dot point answered wrong comes due no later than the one answered right once', firstDue[dpKey(3)] <= firstDue[dpKey(1)], show(firstDue));
{
  const day = firstDue[dpKey(1)];
  const before = queueAt(world, T0 + (day - 1) * DAY);
  const on = queueAt(world, T0 + day * DAY);
  const later = queueAt(world, T0 + (day + 5) * DAY);
  ok('the day before it is due it is not due', !before.due.some(r => r.id === dpKey(1)));
  ok('on its due day recall is under the target', find(on, dpKey(1)).recall < find(on, dpKey(1)).target, show(find(on, dpKey(1))));
  ok('it stays due until reviewed', later.due.some(r => r.id === dpKey(1)));
  ok('overdue days grow', find(later, dpKey(1)).overdueDays > find(on, dpKey(1)).overdueDays);
  ok('the day before, it is listed as upcoming when inside a week', before.upcoming.some(r => r.id === dpKey(1)) || day - 1 <= 0);
}
{
  const q = queueAt(world, T0 + 30 * DAY);
  const recalls = q.due.map(r => r.recall);
  ok('the queue is ordered weakest recall first', recalls.every((v, i) => i === 0 || v >= recalls[i - 1]), show(recalls));
  eq('dueCount matches the due list', q.dueCount, q.due.length);
  eq('the same inputs give the same queue twice', queueAt(world, T0 + 30 * DAY), q);
}

// ── Review on the due day: the curve restarts and the next interval is longer ─
{
  const day = firstDue[dpKey(1)];
  const now = T0 + day * DAY;
  const first = find(queueAt(world, now), dpKey(1));
  attempt(world, dpKey(1), true, now);
  const after = queueAt(world, now + 60_000);
  ok('reviewing it takes it off the due list', !after.due.some(r => r.id === dpKey(1)));
  const refreshed = recallOf(world, dpKey(1), now + 60_000);
  ok('recall is restored right after the review', refreshed > 0.98, show(refreshed));
  let secondDue = null;
  for (let d = 1; d <= 60 && secondDue == null; d++) {
    if (queueAt(world, now + d * DAY).due.some(r => r.id === dpKey(1))) secondDue = d;
  }
  ok('it comes due again', secondDue != null);
  ok('the second interval is longer than the first — spacing grows', secondDue > day, show({ first: day, second: secondDue, stabilityBefore: first.stabilityDays }));
}

// ── Edge cases ──────────────────────────────────────────────────────────────
eq('no ratings means an empty queue', R.dueDotpoints({ ratings: {}, reviews: [], now: T0 }), { due: [], upcoming: [], counted: 0, dueCount: 0 });
eq('a rating row without a dp map contributes nothing', R.dueDotpoints({ ratings: { x: { rating: 1200, attempts: 5 } }, reviews: [], now: T0 }).counted, 0);
{
  const q = R.dueDotpoints({ ratings: { x: { dp: { 'x.1': { attempts: 2, correct: 1, last_at: T0 - 400 * DAY } } } }, reviews: [], now: T0, name: () => ({ chapterName: 'X', text: 'the first idea', ordinal: 0, grade: 9 }) });
  eq('a chapter with no FSRS row yet still gets a curve from the initial stability', q.due.length, 1);
  eq('the namer decorates each row', [q.due[0].chapterName, q.due[0].text, q.due[0].ordinal, q.due[0].grade], ['X', 'the first idea', 0, 9]);
}


// ── The server's replay of its own graded attempts ─────────────────────────
// GET /v1/practice/review-queue rebuilds the queue's inputs from the account's
// server-graded attempts with reviewStateFromAttempts. The replay must agree
// with the hand-advanced world above, and be pure.
section('replay');
{
  const trail = [
    { subtopic: CH, dotpoint: dpKey(1), correct: true, at: T0 },
    { subtopic: CH, dotpoint: dpKey(2), correct: false, at: T0 + 1000 },
    { subtopic: CH, dotpoint: dpKey(1), correct: true, at: T0 + 2000 },
    { subtopic: CH, dotpoint: null, correct: true, at: T0 + 3000 },
    { subtopic: CH, dotpoint: dpKey(3), correct: false, revealed: true, at: T0 + 4000 }
  ];
  const a = R.reviewStateFromAttempts(trail);
  const b = R.reviewStateFromAttempts([...trail].reverse());
  eq('the replay is order-independent (it sorts by time)', a, b);
  eq('dot point counts come from the attempts that name one', a.ratings[CH].dp[dpKey(1)], { attempts: 2, correct: 2, last_at: T0 + 2000 });
  eq('a revealed attempt is never a correct one', a.ratings[CH].dp[dpKey(3)].correct, 0);
  eq('an attempt without a dot point schedules the chapter only', Object.keys(a.ratings[CH].dp).sort(), [dpKey(1), dpKey(2), dpKey(3)]);
  eq('one FSRS row per chapter, advanced once per attempt', [a.reviews.length, a.reviews[0].reps], [1, 5]);
  let manual = null;
  for (const t of trail) manual = A.scheduleReview(manual, A.gradeFor({ correct: t.correct && !t.revealed }), t.at);
  eq('the chapter row is exactly scheduleReview over the same grades', a.reviews[0].stability, manual.stability);
  const q = R.dueDotpoints({ ...a, now: T0 + 60 * DAY });
  ok('sixty days later every dot point is due', q.due.length === 3, show(q.due.map(r => r.id)));
  ok('the wrong-answer dot point is weakest', q.due[0].id !== dpKey(1), show(q.due.map(r => [r.id, r.recall])));
  eq('nothing usable in, nothing out', R.reviewStateFromAttempts([{ subtopic: '', at: 1 }, null, { subtopic: CH }]), { ratings: {}, reviews: [] });
}

// ── Report ──────────────────────────────────────────────────────────────────
const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log(`REVIEW QUEUE: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`REVIEW QUEUE: PASS — ${pass}/${total} checks — 30-day deterministic simulation and the server replay; first due days ${show(firstDue)}`);
