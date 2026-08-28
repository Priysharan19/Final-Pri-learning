// Pri Learning · Pri Reason V2 authored-curriculum integration gate
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
