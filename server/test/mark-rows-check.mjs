// Pri Learning · step-mark rows never contradict the deterministic mark.
//
// server/platform/markRows.js only SAYS the engine's decision in the shape of
// a CBSE-style scheme. This check proves, over every shape it can meet, that:
//   · the earned column always sums to marksEarned and the rows to marksPossible;
//   · a wrong answer never earns the answer row;
//   · a correct answer earns every row;
//   · impossible inputs (earned > possible, a wrong answer at full marks,
//     non-integers) get no rows at all rather than a guess;
//   · labels are the authored headings, never "Check"/"Note"/"Bonus", and a
//     nameless heading is left for the client to number;
//   · no half marks ever appear.
// Usage: node server/test/mark-rows-check.mjs
import { markRowsFor } from '../platform/markRows.js';

let pass = 0; const fails = [];
const ok = (name, cond, detail = '') => { if (cond) pass += 1; else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const q = steps => ({ steps: steps.map(h => ({ h, d: 'detail' })) });
const shapes = [
  q(['Answer']),
  q(['Substitute', 'Answer']),
  q(['Equation', 'Solve', 'Answer']),
  q(['Set up', 'Expand', 'Simplify', 'Solve', 'Back-substitute', 'Answer']),
  q(['Form the equations', 'Check', 'Solve the pair', 'Note', 'Answer']),
  q(['Step 1', 'Step 2', 'Answer']),
  { steps: [] },
  {}
];

for (const [si, shape] of shapes.entries()) {
  for (let possible = 1; possible <= 4; possible += 1) {
    for (let earned = 0; earned <= possible; earned += 1) {
      for (const correct of [true, false]) {
        const tag = `shape ${si}, ${earned}/${possible}, ${correct ? 'correct' : 'wrong'}`;
        const out = markRowsFor(shape, { marksEarned: earned, marksPossible: possible, correct });
        const impossible = (correct && earned !== possible) || (!correct && earned > possible - 1);
        if (!correct && earned > possible - 1) { ok(`${tag}: a wrong answer at full marks gets no rows`, out === null); continue; }
        if (correct && earned !== possible) {
          // The server never sends this; if it ever did, the rows must still not lie.
          ok(`${tag}: rows never claim more or less than the mark`, out === null || out.rows.reduce((s, r) => s + r.earned, 0) === earned);
          continue;
        }
        if (impossible) continue;
        ok(`${tag}: rows exist`, !!out && Array.isArray(out.rows));
        if (!out) continue;
        ok(`${tag}: earned sums to marksEarned`, out.rows.reduce((s, r) => s + r.earned, 0) === earned);
        ok(`${tag}: rows total marksPossible`, out.rows.reduce((s, r) => s + r.outOf, 0) === possible);
        ok(`${tag}: one row per mark, last is the answer`, out.rows.length === possible && out.rows.at(-1).kind === 'answer');
        ok(`${tag}: a wrong answer never earns the answer row`, correct || out.rows.at(-1).earned === 0);
        ok(`${tag}: a correct answer earns every row`, !correct || out.rows.every(r => r.earned === 1));
        ok(`${tag}: whole marks only`, out.rows.every(r => Number.isInteger(r.earned) && Number.isInteger(r.outOf)));
        ok(`${tag}: method credit is read down the page`, out.rows.slice(0, -1).map(r => r.earned).join('') === [...out.rows.slice(0, -1).map(r => r.earned)].sort((a, b) => b - a).join(''));
        ok(`${tag}: labelled as Pri practice feedback, not an official scheme`, out.scheme === 'pri-practice-cbse-style');
        ok(`${tag}: no Check/Note/Bonus heading becomes a mark`, out.rows.every(r => !/^(check|note|bonus)/i.test(r.label || '')));
        ok(`${tag}: a nameless heading is left unlabelled`, out.rows.every(r => !/^step\s*\d/i.test(r.label || '')));
        ok(`${tag}: a wrong answer names no step`, correct || out.rows.every(r => r.label === null));
      }
    }
  }
}
for (const bad of [{ marksEarned: 5, marksPossible: 4, correct: false }, { marksEarned: 1.5, marksPossible: 3, correct: false }, { marksEarned: 2, marksPossible: 0, correct: true }, { marksEarned: -1, marksPossible: 2, correct: false }]) {
  ok(`impossible ${JSON.stringify(bad)} gets no rows`, markRowsFor(q(['Solve', 'Answer']), bad) === null);
}
// Method credit counts verified lines; it is never matched to an authored
// step. So a wrong answer's rows are never named after steps (they would
// claim which step the student did), and only a correct answer — every row
// earned — carries the authored headings.
const wrongRows = markRowsFor(q(['Form the equations', 'Check', 'Solve the pair', 'Answer']), { marksEarned: 1, marksPossible: 3, correct: false });
ok('a wrong answer with partial credit names no authored step', wrongRows.rows.every(r => r.label === null), JSON.stringify(wrongRows.rows.map(r => r.label)));
const rightRows = markRowsFor(q(['Form the equations', 'Check', 'Solve the pair', 'Answer']), { marksEarned: 3, marksPossible: 3, correct: true });
ok('a correct answer carries the authored headings, Check skipped', JSON.stringify(rightRows.rows.map(r => r.label)) === JSON.stringify(['Form the equations', 'Solve the pair', null]), JSON.stringify(rightRows.rows.map(r => r.label)));
const hinted = markRowsFor(q(['Solve', 'Answer']), { marksEarned: 2, marksPossible: 2, correct: true, creditedMarks: 1.4 });
ok('a hint charge is stated beside the rows', hinted.creditedAfterHints === 1.4);
ok('no hint charge, nothing stated', !('creditedAfterHints' in markRowsFor(q(['Solve', 'Answer']), { marksEarned: 2, marksPossible: 2, correct: true, creditedMarks: 2 })));

// Real questions: every generator, every difficulty — the rows agree with the
// server's own marksPossibleFor and never name a step on a wrong answer.
const { marksPossibleFor } = await import('../platform/markerOps.js');
const gen = await import('../../client/src/engine/generators/index.js');
await gen.loadAllBanks?.();
let real = 0; const threw = [];
for (const id of Object.keys(gen.GENERATORS).slice(0, 400)) {
  for (const d of [1, 4]) {
    let question; try { question = gen.generateQuestion(id, d, 7919 * d + 3); } catch (err) { threw.push(`${id} D${d}: ${err?.message || err}`); continue; }
    if (!question) continue;
    real += 1;
    const possible = marksPossibleFor(question);
    const right = markRowsFor(question, { marksEarned: possible, marksPossible: possible, correct: true });
    const wrong = possible > 1 ? markRowsFor(question, { marksEarned: possible - 1, marksPossible: possible, correct: false }) : null;
    ok(`${id} D${d}: one row per mark`, right?.rows.length === possible);
    if (wrong) ok(`${id} D${d}: a wrong answer names no step`, wrong.rows.every(r => r.label === null));
  }
}
ok('real questions were exercised', real >= 200, `${real}`);
ok('no generator threw while the rows were checked', threw.length === 0, threw.slice(0, 3).join(' | '));

if (fails.length) {
  console.log(`MARK ROWS: FAIL — ${fails.length} of ${pass + fails.length} checks failed`);
  for (const f of fails.slice(0, 20)) console.log('  · ' + f);
  process.exit(1);
}
console.log(`MARK ROWS: PASS — ${pass}/${pass} checks — step-mark rows always sum to the engine's mark, never award a wrong answer's answer row, never show ½, and refuse impossible input.`);
