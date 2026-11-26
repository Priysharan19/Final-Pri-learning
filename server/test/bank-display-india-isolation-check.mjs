// The author bank is Prithagoras-only (qbankPack.js), and every display pass keyed on `q._bank` (markerOps.js bankDisplayFields, bankFault, markerView) runs only for a
// question that carries `_bank`. So on the India edition (Priyabhata) no question may ever carry `_bank`: the bank is not loaded, serves no subtopic, and no
// generated or banked question of the shared engine is stamped with it. Static check of the keying, then a sweep of every generator.
//   node server/test/bank-display-india-isolation-check.mjs
import './support/hermetic.mjs';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.PRI_EDITION = 'priyabhata';
delete process.env.PRI_QBANK_DIR;
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const { packDirFor, ensureQbank, qbankStatus, qbankServes, qbankVersion, resetQbank } = await import('../platform/qbankPack.js');
resetQbank();
ok(packDirFor(process.env) === null, 'India: no pack directory');
ok((await ensureQbank(process.env)) === null, 'India: ensureQbank loads nothing');
ok(qbankStatus().loaded === false && qbankVersion() === null, 'India: no bank is loaded and there is no bank version');

const { GENERATORS, generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
await loadAllBanks();
let questions = 0, stamped = 0, served = 0;
for (const g of Object.keys(GENERATORS)) {
  if (qbankServes(g)) served++;
  for (let d = 1; d <= 4; d++) for (let seed = 1; seed <= 3; seed++) {
    let q = null; try { q = generateQuestion(g, d, seed); } catch { q = null; }
    if (!q) continue;
    questions++;
    if (Object.hasOwn(q, '_bank') || Object.hasOwn(q, '_family')) stamped++;
  }
}
ok(questions > 1000, `the sweep covered ${questions} questions`);
ok(served === 0, `no generator is served by a bank on India (${served})`);
ok(stamped === 0, `no India question carries _bank or _family (${stamped})`);

// The passes are keyed on the field itself, never on the edition or on anything else a question may carry.
const src = fs.readFileSync(fileURLToPath(new URL('../platform/markerOps.js', import.meta.url)), 'utf8');
const bankPass = src.match(/typeof q\._bank === 'string'\) \{\s*\n\s*const base = shownReport \|\| report;\s*\n\s*const more = base \? bankDisplayFields/);
ok(!!bankPass, 'the bank display pass is guarded by typeof q._bank === "string"');
const { MARKER_OPS } = await import('../platform/markerOps.js');
const q = generateQuestion(Object.keys(GENERATORS).find(g => /^y12-|^y11-/.test(g)) || Object.keys(GENERATORS)[0], 2, 1);
const lines = ['x = 1'];
const r = MARKER_OPS.practice({ q, answer: String(q.answer?.value ?? q.answer?.expr ?? '0'), working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
ok(!JSON.stringify(r.evidence?.shownReport ?? {}).includes('"proof":"bank'), 'an India question marked by the engine carries no bank-pass fact');

if (failures.length) { console.error(`BANK DISPLAY INDIA ISOLATION: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`BANK DISPLAY INDIA ISOLATION: PASS: ${pass} checks (${questions} India-edition questions, none with _bank)`);
