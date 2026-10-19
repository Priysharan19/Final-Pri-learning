// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Hint ladder suite (ledger §6.5)
//
// Four rungs — nudge → method → worked step → full solution — each costing
// mark weight, logged for the mastery model. The weight table, rung order and
// ladder construction are pure functions of a payload (engine/hintLadder.js),
// shared by the server route that serves and charges each rung.
//
// Usage: node client/test/hint-ladder-check.mjs
// ─────────────────────────────────────────────────────────────────────────────

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

// The custom-question path never offers a ladder either.
ok('a custom question offers no ladder', !L.ladderAvailable({ custom: true, hints: ['h'] }));

// The route itself (serving, charging, ordering, the solution rung as a
// reveal, cross-account 404) is the server's, and is checked over real HTTP
// by server/test/practice-hints-notebook-check.mjs.
const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log(`HINT LADDER: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`HINT LADDER: PASS — ${pass}/${total} checks — four rungs in order, the weight table, help units and ladder construction from authored hints and steps`);
