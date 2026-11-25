// Pri Learning · FUNCTION_ARGUMENT_RULE (client/src/engine/expr.js) swept over every generator and the packed author bank, in both editions.
//
//   (a) every accepted answer of every expression generator (seeds 1-30, all four levels) and of every packed bank question is still marked
//       correct in its bracketed form, and now also in the unbracketed form a student types (`sin2x`, `sin 2x`, `sin^2 3x`, `sin²3x`, `3sin2x`);
//       the forms with two readings (`e^2x`, `sqrt2x`, `log2x`) are accepted too;
//   (b) no wrong answer becomes correct: each key's f(kx) written as f(k)·x, f(x)·k, f(k+x) or k·f(x) is marked WRONG, a key that really is f(k)·x
//       is not matched by `fkx`, and every recorded trap is wrong typed bracketed and unbracketed.
// The edition changes the names a generator draws, never the marker: the sweep runs once per edition, each in its own process.
//
// SYNTHETIC: the engine against its own authored questions. Not evidence about real students.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './support/hermetic.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const edition = process.argv.find(a => a.startsWith('--edition='))?.split('=')[1] ?? null;

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

if (edition) {
  process.env.PRI_EDITION = edition;
  const { sweep } = await import('../../tools/function-argument-sweep.mjs');
  const r = await sweep({ root, seeds: 30 });
  const s = r.stats;
  const exact = (name, got, want) => ok(got === want, `${edition}: ${name} is ${want}, got ${got}`);
  exact('the questions swept (every generator, four levels, seeds 1-30)', s.questions, 49440);
  exact('the expression keys', s.keyed, 1022); exact('the keys marked correct as authored', s.keyAccepted, 1022);
  exact('the packed bank questions', s.bankQuestions, 2031); exact('the bank keys', s.bankKeyed, 351); exact('the bank keys marked correct as authored', s.bankKeyAccepted, 351);
  exact('the unbracketed conventional forms typed', s.conventional, 165); exact('…refused', s.conventionalRefused, 0);
  exact('the two-reading forms typed (e^2x, sqrt2x, log2x)', s.ambiguous, 20); exact('…refused', s.ambiguousRefused, 0);
  exact('the explicit-multiplication typings (e^2*x, e^2·x, e^2×x, sqrt2*x, log2*x)', s.explicit, 60); exact('…marked correct', s.explicitAccepted, 0);
  exact('the misreadings of f(kx) typed', s.misreadings, 104); exact('the trap typings (bracketed and unbracketed)', s.trapsTyped, 442);
  ok(r.keyLost.length === 0 && r.refused.length === 0 && r.wrongAccepted.length === 0, `${edition}: nothing lost, nothing refused, no wrong answer accepted: ${[...r.keyLost, ...r.refused, ...r.wrongAccepted].slice(0, 4).join(' | ')}`);
  // the reviewer's line repro (y12-diff, level 3, seed 4): e^-3x is read as e^(-3x), e^-3*x and the both-readings-false e^-34x are crossed as on main
  {
    const G = await import('../../client/src/engine/generators/index.js'); await G.loadAllBanks();
    const MO = await import('../platform/markerOps.js'); const GS = await import('../platform/genericSteps.js');
    const { checkAnswer } = await import('../../client/src/engine/checker.js');
    const q = { ...G.generateQuestion('y12-diff', 3, 4), _generator: 'y12-diff' }; q._methodScheme = GS.GENERIC_ID;
    const base = GS.authoredLines(q).map(l => l.text);
    const page = f => { const texts = base.map(t => t.replace(/e\^\(-3x\)/g, f)); const ev = MO.stepEvidence(q, '99991', texts.join('\n'), checkAnswer(q, '99991'), { slipWarnings: true }); return ev.stepReport.lines.map(l => l.status[0]).join(''); };
    exact('the page written e^(-3x)', page('e^(-3x)'), 'oooo');
    exact('the page written e^-3x (read as e^(-3x), ticked where the bracketed page is; main: nobn)', page('e^-3x'), 'nooo');
    exact('the page written e^-3*x: crossed as on origin/main', page('e^-3*x'), 'nobn');
    exact('the page written e^-34x (false under both readings): crossed as on origin/main', page('e^-34x'), 'nnbn');
  }
  if (failures.length) { console.error(`FUNCTION ARGUMENT SWEEP (${edition}): FAIL ${failures.length}`); for (const f of failures) console.error(`  ${f}`); process.exit(1); }
  console.log(`FUNCTION ARGUMENT SWEEP (${edition}): ${pass} checks; ${s.questions} questions, ${s.keyed} keys, ${s.conventional} conventional + ${s.ambiguous} two-reading forms, ${s.misreadings} misreadings, ${s.trapsTyped} traps`);
  process.exit(0);
}

for (const e of ['prithagoras', 'priyabhata']) {
  try {
    const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--edition=${e}`], { encoding: 'utf8', env: { ...process.env, PRI_EDITION: e }, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 });
    ok(/FUNCTION ARGUMENT SWEEP \(\w+\): \d+ checks/.test(out), `${e}: the sweep ran`);
    process.stdout.write(out);
  } catch (err) {
    ok(false, `${e}: ${String(err.stderr || err.stdout || err.message).slice(0, 1200)}`);
  }
}
if (failures.length) { console.error(`FUNCTION ARGUMENT SWEEP: FAIL ${failures.length}`); for (const f of failures) console.error(`  ${f}`); process.exit(1); }
console.log(`FUNCTION ARGUMENT SWEEP: PASS — both editions, ${pass} checks`);
