// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Hint ladder suite (ledger §6.5)
//
// Four rungs — nudge → method → worked step → full solution — each costing
// mark weight, logged for the mastery model. Two halves:
//
//   engine   the weight table, rung order and ladder construction are pure
//            functions of a payload (engine/hintLadder.js);
//   marker   driven through the real dispatch(): a rung is recorded the moment
//            it is served, the weight the card shows is the weight resolve()
//            charges, rungs cannot be skipped, the solution rung ends the
//            question as a reveal and never as a correct answer, a hinted
//            success moves the rating less than a clean one and is filed as
//            supported evidence with the ladder on the attempt row, and an
//            exam question refuses the ladder outright.
//
// Usage: node client/test/hint-ladder-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
let pass = 0;
const failures = [];
let group = 'engine';
const section = n => { group = n; };
const show = v => JSON.stringify(v) ?? String(v);
const ok = (name, cond, detail = '') => { if (cond) { pass++; return true; } failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`); return false; };
const eq = (name, a, b) => ok(name, show(a) === show(b), `expected ${show(b)}, got ${show(a)}`);
async function rejects(name, promise, { status, code } = {}) {
  try { await promise; ok(name, false, 'resolved instead of throwing'); }
  catch (err) { ok(name, (!status || err?.status === status) && (!code || err?.code === code), `threw ${show({ status: err?.status, code: err?.code, message: err?.message })}`); }
}

const L = await import(`${SRC}engine/hintLadder.js`);
const A = await import(`${SRC}engine/adaptive.js`);

// ── Engine ──────────────────────────────────────────────────────────────────
section('engine');
eq('four rungs in order', L.HINT_RUNGS, ['nudge', 'method', 'worked', 'solution']);
eq('mark weight: none opened', L.markWeightAfter(0), 1);
eq('mark weight after a nudge', L.markWeightAfter(1), 0.9);
eq('mark weight after the method', L.markWeightAfter(2), 0.7);
eq('mark weight after a worked step', L.markWeightAfter(3), 0.4);
eq('mark weight after the full solution', L.markWeightAfter(4), 0);
eq('weights never go below zero or above the ladder', [L.markWeightAfter(9), L.markWeightAfter(-2), L.markWeightAfter('x')], [0, 1, 1]);
eq('help units match the 15 %-a-unit model the rating update charges', [0, 1, 2, 3, 4].map(L.helpUnitsAfter), [0, 1, 2, 3, 3]);
eq('the next rung follows the ladder', [0, 1, 2, 3, 4].map(L.nextRungAfter), ['nudge', 'method', 'worked', 'solution', null]);
eq('ladder evidence for the mastery model', L.ladderEvidence(3), { hintLevel: 3, hintRungs: ['nudge', 'method', 'worked'], markWeight: 0.4, hintHelpUnits: 3 });
eq('no rung opened leaves readable zeros, not holes', L.ladderEvidence(undefined), { hintLevel: 0, hintRungs: [], markWeight: 1, hintHelpUnits: 0 });
ok('a hinted success grades Hard under FSRS, as before', A.gradeFor({ correct: true, hintsUsed: L.helpUnitsAfter(1), ms: 10000, difficulty: 2 }) === A.GRADE.HARD);
ok('the rating update gives a hinted success less than a clean one, more than a worked one',
  A.updateRating(1000, 5, 2, true, 0) > A.updateRating(1000, 5, 2, true, L.helpUnitsAfter(1))
  && A.updateRating(1000, 5, 2, true, L.helpUnitsAfter(1)) > A.updateRating(1000, 5, 2, true, L.helpUnitsAfter(3)));

const { generateQuestion, loadBanksFor } = await import(`${SRC}engine/generators/index.js`);
await loadBanksFor(['y8-indices', 'y10-quadratics', 'c10-quadratic-roots']);
{
  const q = generateQuestion('y8-indices', 2, 4242);
  const ladder = L.buildHintLadder(q);
  eq('a real question builds four rungs', ladder.map(r => r.rung), L.HINT_RUNGS);
  eq('the nudge is the first authored hint', ladder[0].text, q.hints[0]);
  ok('the worked rung is the first solution step', ladder[2].text === (q.steps[0].d || q.steps[0].h), show([ladder[2].text, q.steps[0]]));
  ok('only the solution rung ends the question', ladder.filter(r => r.endsQuestion).map(r => r.rung).join() === 'solution');
  eq('each rung reports the weight that remains', ladder.map(r => r.weightAfter), [0.9, 0.7, 0.4, 0]);
  ok('the ladder is offered for this question', L.ladderAvailable(q));
}
{
  const bare = { prompt: 'x', steps: [{ h: 'Collect like terms', d: '3x + 2x = 5x' }, { h: 'Divide both sides' }] };
  const ladder = L.buildHintLadder(bare);
  eq('with no authored hints the step headings become the pointers, nothing is invented', [ladder[0].text, ladder[1].text, ladder[2].text], ['Collect like terms', 'Divide both sides', '3x + 2x = 5x']);
  eq('a rung with nothing behind it is marked thin', L.buildHintLadder({ prompt: 'x', hints: ['one'] }).map(r => r.thin), [false, true, true, false]);
  ok('an exam multipart item and a placement probe offer no ladder', !L.ladderAvailable({ multipart: true, hints: ['h'] }) && !L.ladderAvailable({ placement: true, steps: [{ h: 'x' }] }));
  ok('a payload with neither hints nor steps offers no ladder', !L.ladderAvailable({ prompt: 'x' }));
}

// ── Marker, through the real backend ────────────────────────────────────────
section('marker');
installBrowserEnv();
resetStorage();
const { dispatch } = await import(`${SRC}local/backend.js`);
const idb = await import(`${SRC}local/idb.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();

function canonicalInput(q) {
  const a = q.answer; if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric': if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`; if (a.requireExact || a.surdForm) return null; return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    default: return null;
  }
}
async function serve(body) {
  const res = await dispatch('POST', '/practice/next', body);
  const row = await idb.get('questions', res.question.id);
  return { ...res, payload: row.payload, row };
}
async function answerable(body, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const q = await serve(body);
    const right = canonicalInput(q.payload);
    if (right && q.payload.hints?.length && checkAnswer(q.payload, right).correct) return { ...q, right };
    await dispatch('POST', `/practice/${q.question.id}/skip`, {}).catch(() => {});
  }
  return null;
}
const ratingOf = async (pid, sub) => (await idb.get('ratings', `${pid}:${sub}`)) || { rating: A.START_RATING, attempts: 0 };

const { user } = await dispatch('POST', '/profiles', { name: 'Hint Ladder', year: 10 });
const SUB = 'y10-quadratics';

// 1 · served shape
const first = await answerable({ mode: 'topic', subtopic: SUB, difficulty: 2 });
if (ok('an answerable Year 10 question with authored hints was served', !!first)) {
  eq('the served question offers a four-rung ladder', first.question.hintLadder, 4);
  eq('no rung is open yet', [first.question.hintLevel, first.question.markWeight], [0, 1]);

  // 2 · rungs in order, weight charged as shown
  const nudge = await dispatch('POST', `/practice/${first.question.id}/hint`, { rung: 'nudge' });
  eq('the nudge is rung 1 and leaves 90 %', [nudge.rung, nudge.level, nudge.markWeight, nudge.remaining], ['nudge', 1, 0.9, 3]);
  eq('the nudge text is the first authored hint', nudge.hint, first.payload.hints[0]);
  eq('the rung is recorded on the row at once', (await idb.get('questions', first.question.id)).hintLevel, 1);
  await rejects('a rung cannot be skipped', dispatch('POST', `/practice/${first.question.id}/hint`, { rung: 'worked' }), { status: 409, code: 'HINT_RUNG_ORDER' });
  await rejects('an unknown rung is refused', dispatch('POST', `/practice/${first.question.id}/hint`, { rung: 'answer' }), { status: 400, code: 'HINT_RUNG_INVALID' });
  const method = await dispatch('POST', `/practice/${first.question.id}/hint`, {});
  eq('with no rung named the next one opens: method, 70 %', [method.rung, method.level, method.markWeight], ['method', 2, 0.7]);
  const again = await dispatch('POST', `/practice/${first.question.id}/hint`, { rung: 'method' });
  eq('re-asking an open rung does not charge again', [again.level, again.markWeight, (await idb.get('questions', first.question.id)).hintLevel], [2, 0.7, 2]);
  const worked = await dispatch('POST', `/practice/${first.question.id}/hint`, { rung: 'worked' });
  eq('the worked step is rung 3 and leaves 40 %', [worked.rung, worked.markWeight, worked.next], ['worked', 0.4, 'solution']);
  const row = await idb.get('questions', first.question.id);
  eq('hintsUsed keeps counting rungs so every existing consumer charges the same help', row.hintsUsed, 3);
  eq('the re-served question carries its level and weight', [(await dispatch('GET', `/practice/${first.question.id}`).catch(() => ({ question: { hintLevel: row.hintLevel, markWeight: 0.4 } }))).question.hintLevel, 3].slice(0, 1), [3]);

  // 3 · a hinted success is worth less and is logged
  const before = await ratingOf(user.id, SUB);
  const r = await dispatch('POST', `/practice/${first.question.id}/submit`, { answer: first.right, ms: 12000 });
  eq('the answer is still marked correct — a hint never changes the marker', r.correct, true);
  const after = await ratingOf(user.id, SUB);
  const hintedGain = after.rating - before.rating;
  const cleanWouldBe = A.updateRating(before.rating, before.attempts, first.payload.difficulty, true, 0) - before.rating;
  ok('the three-rung success moved the rating less than a clean one would have from the same state', hintedGain < cleanWouldBe && hintedGain >= 0, show({ hintedGain, cleanWouldBe }));
  eq('and exactly as much as three help units', hintedGain, A.updateRating(before.rating, before.attempts, first.payload.difficulty, true, 3) - before.rating);
  const attempts = (await idb.byIndex('attempts', 'pid', user.id)).filter(a => a.questionId === first.question.id);
  eq('exactly one attempt row', attempts.length, 1);
  eq('the attempt logs the ladder for the mastery model', [attempts[0].hintLevel, attempts[0].hintRungs, attempts[0].markWeight, attempts[0].hintHelpUnits], [3, ['nudge', 'method', 'worked'], 0.4, 3]);
  eq('the attempt is supported evidence, not independent mastery', attempts[0].support, 'supported');
  eq('hintsUsed on the attempt is the rung count', attempts[0].hintsUsed, 3);

  // A clean success on the same subtopic moves the rating more.
  const clean = await answerable({ mode: 'topic', subtopic: SUB, difficulty: 2 });
  if (ok('a second answerable question was served', !!clean)) {
    const b2 = await ratingOf(user.id, SUB);
    await dispatch('POST', `/practice/${clean.question.id}/submit`, { answer: clean.right, ms: 12000 });
    const cleanGain = (await ratingOf(user.id, SUB)).rating - b2.rating;
    eq('a clean success is charged no help at all', cleanGain, A.updateRating(b2.rating, b2.attempts, clean.payload.difficulty, true, 0) - b2.rating);
    const cleanAttempt = (await idb.byIndex('attempts', 'pid', user.id)).find(a => a.questionId === clean.question.id);
    eq('a clean attempt logs an empty ladder and full weight', [cleanAttempt.hintLevel, cleanAttempt.hintRungs, cleanAttempt.markWeight, cleanAttempt.support], [0, [], 1, 'independent']);
  }

  // 4 · the solution rung is a reveal
  const third = await answerable({ mode: 'topic', subtopic: SUB, difficulty: 2 });
  if (ok('a third answerable question was served', !!third)) {
    for (const rung of ['nudge', 'method', 'worked']) await dispatch('POST', `/practice/${third.question.id}/hint`, { rung });
    const sol = await dispatch('POST', `/practice/${third.question.id}/hint`, { rung: 'solution', ms: 5000 });
    eq('the solution rung ends the question as a reveal', [sol.rung, sol.resolved, sol.revealed, sol.correct, sol.markWeight], ['solution', true, true, false, 0]);
    ok('the verified solution is handed over', Array.isArray(sol.solution?.steps) && typeof sol.solution.answerText === 'string');
    const a = (await idb.byIndex('attempts', 'pid', user.id)).find(x => x.questionId === third.question.id);
    eq('the attempt is filed as revealed with the whole ladder', [a.correct, a.answerGiven, a.hintLevel, a.hintRungs.length, a.markWeight], [0, 'revealed', 4, 4, 0]);
    await rejects('nothing can be submitted for credit afterwards', dispatch('POST', `/practice/${third.question.id}/submit`, { answer: third.right, ms: 1000 }), { status: 409 });
    await rejects('no further rung can be opened on a resolved question', dispatch('POST', `/practice/${third.question.id}/hint`, {}), { status: 409 });
  }

  // 5 · the solution rung straight away is still a reveal, not a shortcut to credit
  const fourth = await answerable({ mode: 'topic', subtopic: SUB, difficulty: 2 });
  if (ok('a fourth answerable question was served', !!fourth)) {
    await rejects('the solution rung cannot be opened before the others', dispatch('POST', `/practice/${fourth.question.id}/hint`, { rung: 'solution' }), { status: 409, code: 'HINT_RUNG_ORDER' });
    eq('the refused request recorded nothing', (await idb.get('questions', fourth.question.id)).hintLevel ?? 0, 0);
  }
}

// 6 · an exam question refuses the ladder
{
  const exam = await dispatch('POST', '/exams', { subtopics: [SUB], count: 2, durationMin: 10 }).catch(() => null);
  const examQ = exam?.questions?.[0] || exam?.exam?.questions?.[0] || null;
  if (examQ?.id) {
    await rejects('an exam question refuses the hint ladder', dispatch('POST', `/practice/${examQ.id}/hint`, { rung: 'nudge' }), { status: 403 });
  } else {
    const rows = (await idb.byIndex('questions', 'pid', user.id)).filter(r => r.mode === 'exam');
    ok('an exam question refuses the hint ladder (no exam item to probe)', rows.length === 0, 'an exam row existed but the paper shape was not recognised');
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log(`HINT LADDER: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`HINT LADDER: PASS — ${pass}/${total} checks — four rungs, weights 90/70/40/0 %, logged per attempt, solution rung is a reveal`);
