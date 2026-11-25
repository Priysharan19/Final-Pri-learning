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
  ok(s.questions >= 49000, `${edition}: the sweep covers every generator at every level (${s.questions} questions)`);
  ok(s.keyed >= 900 && s.keyAccepted === s.keyed, `${edition}: every keyed expression answer is marked correct as authored (${s.keyAccepted}/${s.keyed}): ${r.keyLost.slice(0, 3).join(' | ')}`);
  ok(s.bankQuestions >= 1900 && s.bankKeyed >= 300 && s.bankKeyAccepted === s.bankKeyed, `${edition}: every packed bank answer is marked correct as authored (${s.bankKeyAccepted}/${s.bankKeyed} of ${s.bankQuestions} questions)`);
  ok(s.conventional >= 150 && s.conventionalRefused === 0, `${edition}: the unbracketed conventional form of every key is marked correct (${s.conventional - s.conventionalRefused}/${s.conventional}): ${r.refused.filter(x => x.includes('conventional')).slice(0, 3).join(' | ')}`);
  ok(s.ambiguous >= 15 && s.ambiguousRefused === 0, `${edition}: e^2x, sqrt2x and log2x are marked correct where either reading is the key (${s.ambiguous - s.ambiguousRefused}/${s.ambiguous}): ${r.refused.filter(x => x.includes('ambiguous')).slice(0, 3).join(' | ')}`);
  ok(s.misreadings >= 100, `${edition}: the misreadings of f(kx) are typed (${s.misreadings})`);
  ok(s.trapsTyped >= 400, `${edition}: the recorded traps are typed bracketed and unbracketed (${s.trapsTyped})`);
  ok(r.wrongAccepted.length === 0, `${edition}: no misreading, trap or f(kx) typed for f(k)·x is marked correct: ${r.wrongAccepted.slice(0, 5).join(' | ')}`);
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
