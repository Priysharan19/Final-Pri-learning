from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    p.write_text(s.replace(old, new, 1))


year11 = 'client/src/engine/generators/year11.js'
replace_once(
    year11,
    "        answerPrefix: 'dy/dx =',\n        traps: [\n",
    "        answerPrefix: 'dy/dx =',\n        stepcheck: { kind: 'derivative', variable: 'x', source: `${a}x^${n}`, canonical: `${a * n}x^${n - 1}` },\n        traps: [\n",
    'Year 11 D1 derivative metadata'
)
replace_once(
    year11,
    "        answerPrefix: \"f '(x) =\",\n        traps: [{ expr: `${3 * a}x^2 + ${2 * b}x + ${c === 0 ? 1 : c}x`, why: `The derivative of $${c}x$ is just $${c}$ — and the constant ${d} vanishes.` }],\n",
    "        answerPrefix: \"f '(x) =\",\n        stepcheck: { kind: 'derivative', variable: 'x', source: poly([a, b, c, d]), canonical: `${3 * a}x^2 + ${2 * b}x + ${c}` },\n        traps: [{ expr: `${3 * a}x^2 + ${2 * b}x + ${c === 0 ? 1 : c}x`, why: `The derivative of $${c}x$ is just $${c}$ — and the constant ${d} vanishes.` }],\n",
    'Year 11 D2 derivative metadata'
)

india = Path('client/src/engine/generators/india-algebra.js')
s = india.read_text()
start = s.index("  'c11-linear-inequalities': (rng, diff) => {")
end = s.index("\n  // ── Class 11 · Binomial Theorem", start)
block = s[start:end]
anchor = "        prompt: `Solve $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}$.`,\n        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,\n        hints: [\n"
if block.count(anchor) != 2:
    raise SystemExit(f'India inequality anchors: expected two, found {block.count(anchor)}')
block = block.replace(
    anchor,
    "        prompt: `Solve $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}$.`,\n        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,\n        stepcheck: { kind: 'inequality', source: `${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}`, canonical: `x ${dir} ${bound}` },\n        hints: [\n",
    1
)
if block.count(anchor) != 1:
    raise SystemExit('India D2 inequality anchor missing after D1 patch')
block = block.replace(
    anchor,
    "        prompt: `Solve $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}$.`,\n        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,\n        stepcheck: { kind: 'inequality', source: `${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} ${dir} ${k}`, canonical: `x ${flipped} ${bound}` },\n        hints: [\n",
    1
)
india.write_text(s[:start] + block + s[end:])

Path('client/test/pri-reason-curriculum-check.mjs').write_text(r'''// Pri Learning · Pri Reason V2 authored-curriculum integration gate
// Verifies production generators opt into V2 only with exact machine-readable
// metadata and that unsupported multi-operation/chained forms remain abstained.

import { makeRng } from '../src/engine/qhelpers.js';
import { year11 } from '../src/engine/generators/year11.js';
import { indiaAlgebra } from '../src/engine/generators/india-algebra.js';
import { stepCheck } from '../src/engine/checker.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass++; else { fail++; failures.push(label); } };
const same = (label, got, want) => ok(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`, got === want);

console.log('PRI REASON V2 — authored curriculum integration\n');

for (const difficulty of [1, 2]) {
  const q = year11['y11-diff'](makeRng(0x521100 + difficulty), difficulty);
  same(`Year 11 differentiation D${difficulty} kind`, q.stepcheck?.kind, 'derivative');
  same(`Year 11 differentiation D${difficulty} variable`, q.stepcheck?.variable, 'x');
  ok(`Year 11 differentiation D${difficulty} source`, typeof q.stepcheck?.source === 'string' && q.stepcheck.source.length > 0);
  ok(`Year 11 differentiation D${difficulty} canonical`, typeof q.stepcheck?.canonical === 'string' && q.stepcheck.canonical.length > 0);

  let r = stepCheck(q.stepcheck, `dy/dx = ${q.stepcheck.canonical}`);
  same(`Year 11 differentiation D${difficulty} canonical has no break`, r.firstBreak, -1);
  same(`Year 11 differentiation D${difficulty} canonical is verified`, r.lines[0]?.status, 'ok');

  r = stepCheck(q.stepcheck, 'dy/dx = 0');
  same(`Year 11 differentiation D${difficulty} wrong derivative breaks`, r.firstBreak, 0);
  same(`Year 11 differentiation D${difficulty} diagnosis`, r.diagnosis?.code, 'derivative-error');
}

for (const difficulty of [3, 4]) {
  const q = year11['y11-diff'](makeRng(0x521100 + difficulty), difficulty);
  ok(`Year 11 differentiation D${difficulty} stays outside single-operation metadata`, !q.stepcheck);
}

for (const difficulty of [1, 2]) {
  const q = indiaAlgebra['c11-linear-inequalities'](makeRng(0x110000 + difficulty), difficulty);
  same(`Class 11 inequality D${difficulty} kind`, q.stepcheck?.kind, 'inequality');
  ok(`Class 11 inequality D${difficulty} source`, typeof q.stepcheck?.source === 'string' && q.stepcheck.source.length > 0);
  ok(`Class 11 inequality D${difficulty} canonical`, typeof q.stepcheck?.canonical === 'string' && q.stepcheck.canonical.length > 0);

  let r = stepCheck(q.stepcheck, `${q.stepcheck.source}\n${q.stepcheck.canonical}`);
  same(`Class 11 inequality D${difficulty} correct chain has no break`, r.firstBreak, -1);
  ok(`Class 11 inequality D${difficulty} correct chain verified`, r.lines.every(line => line.status === 'ok'));

  if (difficulty === 2) {
    const wrong = q.stepcheck.canonical.replace(/[<>]/, c => c === '<' ? '>' : '<');
    r = stepCheck(q.stepcheck, `${q.stepcheck.source}\n${wrong}`);
    same('Negative-coefficient inequality catches missed sign flip', r.firstBreak, 1);
    same('Negative-coefficient inequality names direction error', r.diagnosis?.code, 'inequality-direction');
  }
}

for (const difficulty of [3, 4]) {
  const q = indiaAlgebra['c11-linear-inequalities'](makeRng(0x110000 + difficulty), difficulty);
  ok(`Class 11 inequality D${difficulty} stays outside single-relation metadata`, !q.stepcheck);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.error('\nFailures:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('Pri Reason V2 curriculum integration gate: PASS');
''')

wf = Path('.github/workflows/pri-reason.yml')
w = wf.read_text()
needle = "      - 'client/test/pri-reason-v2-check.mjs'\n"
addition = needle + "      - 'client/test/pri-reason-curriculum-check.mjs'\n      - 'client/src/engine/generators/year11.js'\n      - 'client/src/engine/generators/india-algebra.js'\n"
if w.count(needle) != 2:
    raise SystemExit(f'Pri Reason workflow path anchor: expected 2, found {w.count(needle)}')
w = w.replace(needle, addition)
run_anchor = "      - name: Pri Reason V2 safety gate\n        run: node client/test/pri-reason-v2-check.mjs\n"
run_add = run_anchor + "      - name: Pri Reason V2 curriculum integration gate\n        run: node client/test/pri-reason-curriculum-check.mjs\n"
if w.count(run_anchor) != 1:
    raise SystemExit('Pri Reason workflow run anchor changed')
wf.write_text(w.replace(run_anchor, run_add, 1))
