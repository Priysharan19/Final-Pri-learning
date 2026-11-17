// Pri Learning · algebra and indices slip catalogue (topics/algebra.js, topics/indices.js).
//
// Each slip is written the way a student writes it, under a question built from
// varied numbers: the flagged line must be the slip line, it must be named with
// the exact code and the question's own numbers, and in Hindi too. Correct
// working must never be named (the detectors answer only for a wrong line), and
// the status of every line must be exactly what the equivalence rule says: the
// catalogue only changes which sentence a break is told, never whether it is one.
// SYNTHETIC: scripted working, not evidence about real students.
const SRC = new URL('../src/', import.meta.url).href;
const { stepCheck } = await import(`${SRC}engine/checker.js`);
const { diagnoseTopicLine, registeredTopics, topicDiagnosisCodes } = await import(`${SRC}engine/misconceptions/topics/index.js`);
const { exprEquivalent } = await import(`${SRC}engine/expr.js`);
const { misconceptionIdForDiagnosis } = await import(`${SRC}engine/misconceptions.js`);
let checks = 0; const failures = [];
const ok = (c, t) => { checks++; if (!c) failures.push(t); };
const sg = n => (n < 0 ? `- ${-n}` : `+ ${n}`);
const T = [];   // [code, meta, working lines, line index expected to carry the code, message must contain]

const NUMS = [[2, 3], [4, -5], [-3, 6], [5, 2], [7, -4], [3, 8]];
for (const [b, d] of NUMS) {
  const q = `(x ${sg(b)})(x ${sg(d)})`;
  const canon = `x^2 ${sg(b + d).replace('+ ', '+ ').replace('- ', '- ')}x ${sg(b * d)}`;
  const meta = { kind: 'expression', canonical: canon.replace(/\s/g, '') };
  T.push(['expand-first-and-last-only', meta, [q, `= x^2 ${sg(b * d)}`], 1, [`${b} × ${d}`]]);
  T.push(['expand-last-term-added', meta, [q, `= x^2 ${sg(b + d)}x ${sg(b + d)}`], 1, [`${b} × ${d}`.replace('-', '−')]]);
}
for (const p of [2, 3, 4]) for (const q of [5, 6, -7]) {
  const sq = `(${p}x ${sg(q)})^2`;
  T.push(['power-of-sum', { kind: 'expression', canonical: `${p * p}x^2 ${sg(2 * p * q)}x ${sg(q * q)}`.replace(/\s/g, '') }, [sq, `= ${p * p}x^2 ${sg(q * q)}`], 1, ['middle term']]);
}
for (const b of [3, 5, 9]) {
  const meta = { kind: 'expression', canonical: `x^2-${b * b}` };
  T.push(['expand-difference-of-squares-sign', meta, [`(x + ${b})(x - ${b})`, `= x^2 + ${b * b}`], 1, ['negative']]);
  T.push(['expand-middle-terms-cancel', meta, [`(x + ${b})(x - ${b})`, `= x^2 - ${2 * b}x - ${b * b}`], 1, ['cancel']]);
}
for (const [k, a, b] of [[6, 3, 4], [3, 5, 8], [4, 2, 2]]) {
  const meta = { kind: 'expression', canonical: `${k * a}x+${k * b + 1}` };
  T.push(['distribute-partial', meta, [`${k}(${a}x + ${b}) + 1`, `= ${k * a}x + ${b + 1}`], 1, [`${k} × ${b}`]]);
}
for (const [m, k, a, b] of [[2, 2, 2, -3], [6, 5, 2, -2], [8, 4, 5, -1]]) {
  const meta = { kind: 'expression', canonical: `${m}-${k * a}x${k * b > 0 ? '-' : '+'}${Math.abs(k * b)}`.replace(/\s/g, '') };
  T.push(['distribute-sign', meta, [`${m} - ${k}(${a}x ${sg(b)})`, `= ${k * a}x ${sg(m + k * b)}`], 1, ['sign']]);
}
for (const [s, c] of [[2, -3], [3, -4], [6, -7]]) {
  T.push(['factorise-fails-when-expanded', { kind: 'expression', canonical: `(x+${s + 1})(x-1)` }, [`x^2 ${sg(s)}x ${sg(c)}`, `= (x + ${s})(x - 1)`], 1, ['multiply']]);
}
for (const [a, b] of [[5, 9], [3, 8], [8, 3]]) T.push(['index-multiplied-instead-of-added', { kind: 'expression', canonical: `x^${a + b}` }, [`x^(${a}) * x^(${b})`, `= x^${a * b}`], 1, [`${a} + ${b}`]]);
for (const [a, b] of [[2, 4], [3, 5], [4, 3]]) T.push(['power-of-power', { kind: 'expression', canonical: `x^${a * b}` }, [`(x^(${a}))^(${b})`, `= x^${a + b}`], 1, [`${a} × ${b}`]]);
for (const [c, e, p] of [[4, 4, 3], [2, 3, 3], [3, 2, 2]]) T.push(['index-power-not-applied-to-number', { kind: 'expression', canonical: `${c ** p}x^${e * p}` }, [`(${c}x^(${e}))^(${p})`, `= ${c}x^${e * p}`], 1, [`${c ** p}`]]);
for (const [c1, a, c2, b] of [[5, 6, 3, 4], [2, -2, 3, -3], [7, 6, 6, 3]]) T.push(['index-coefficients-added', { kind: 'expression', canonical: `${c1 * c2}x^${a + b}` }, [`${c1}x^(${a}) * ${c2}x^(${b})`, `= ${c1 + c2}x^(${a + b})`], 1, [`${c1} × ${c2}`]]);
T.push(['surd-sum-under-one-root', { kind: 'expression', canonical: 'sqrt(2)+sqrt(3)' }, ['sqrt(2) + sqrt(3)', '= sqrt(5)'], 1, ['√2 + √3']]);

for (const [code, meta, lines, at, mustHave] of T) {
  const tag = `${code} ${JSON.stringify(lines)}`;
  const r = stepCheck(meta, lines.join('\n'), { prompt: '' });
  const l = r.lines[at];
  ok(r.firstBreak === at, `${tag}: first break is line ${at + 1}, got ${r.firstBreak + 1}`);
  ok(l?.status === 'break', `${tag}: the slip line is a break (${l?.status})`);
  ok(l?.diagnosis?.code === code, `${tag}: named ${l?.diagnosis?.code}`);
  ok(mustHave.every(s => String(l?.note || '').includes(s.replace(/-/g, '−'))), `${tag}: the message carries the question's own numbers (${mustHave}): ${l?.note}`);
  ok(typeof l?.diagnosis?.messages?.hi === 'string' && l.diagnosis.messages.hi.length > 10, `${tag}: a Hindi message exists`);
  ok(misconceptionIdForDiagnosis(l?.diagnosis) === code, `${tag}: the diagnosis is a recordable ontology identity`);
  ok(r.lines[0].status !== 'break', `${tag}: the restated question is not flagged`);
  // The status of every line is exactly the equivalence rule's: naming changes a sentence, never a verdict.
  if (meta.kind === 'expression') for (let i = 1; i < lines.length; i++) {
    const cand = lines[i].replace(/^=\s*/, '');
    ok((r.lines[i].status === 'ok') === exprEquivalent(cand, meta.canonical), `${tag}: line ${i + 1} status follows the equivalence rule`);
  }
}

// Solving a linear equation: the checker's own diagnoser names these first (sides-mismatched, term-dropped);
// the catalogue answers only when it has nothing to say, so its detectors are exercised directly.
const SOLVE = [];
for (const [a, c] of [[6, -6], [3, 15], [7, 21]]) {
  const meta = { kind: 'equation', variable: 'x', solutions: [c / a] };
  SOLVE.push(['solve-linear-subtracted-instead-of-divided', meta, `${a}x = ${c}`, `x = ${c - a}`, 'dividing']);
  SOLVE.push(['solve-linear-multiplied-instead-of-divided', meta, `${a}x = ${c}`, `x = ${c * a}`, 'multiplying']);
}
for (const [a, b, c] of [[3, 4, 19], [5, 2, 17], [4, 7, 31]]) {
  const meta = { kind: 'equation', variable: 'x', solutions: [(c - b) / a] };
  SOLVE.push(['solve-linear-constant-ignored', meta, `${a}x + ${b} = ${c}`, `x = ${c / a}`, String(b)]);
  SOLVE.push(['solve-linear-divided-one-term', meta, `${a}x + ${b} = ${c}`, `x = ${c / a - b}`, String(a)]);
}
for (const [code, meta, previous, line, word] of SOLVE) {
  const hit = diagnoseTopicLine({ line, previous, index: 1, meta });
  ok(hit?.code === code && hit.message.includes(word) && hit.messages.hi, `${code} ${previous} → ${line}: ${hit?.code} ${hit?.message}`);
  ok(misconceptionIdForDiagnosis(hit) === code, `${code} is a recordable ontology identity`);
}
ok(diagnoseTopicLine({ line: 'x = 5', previous: '3x + 4 = 19', index: 1, meta: { kind: 'equation', variable: 'x', solutions: [5] } }) === null, 'a correct solved line is not named');

// Correct working is never named.
const CORRECT = [
  [{ kind: 'expression', canonical: 'x^2+3x-28' }, ['(x + 7)(x - 4)', '= x^2 + 3x - 28']],
  [{ kind: 'expression', canonical: 'x^2-9' }, ['(x + 3)(x - 3)', '= x^2 - 9']],
  [{ kind: 'expression', canonical: '4x^2+20x+25' }, ['(2x + 5)^2', '= 4x^2 + 20x + 25']],
  [{ kind: 'expression', canonical: '7x-31' }, ['3(x - 5) + 4(x - 4)', '= 7x - 31']],
  [{ kind: 'expression', canonical: '8-4x' }, ['2 - 2(2x - 3)', '= 8 - 4x']],
  [{ kind: 'expression', canonical: 'x^14' }, ['x^(5) * x^(9)', '= x^14']],
  [{ kind: 'expression', canonical: 'x^8' }, ['(x^(2))^(4)', '= x^8']],
  [{ kind: 'expression', canonical: '15x^10' }, ['5x^(6) * 3x^(4)', '= 15x^10']],
  [{ kind: 'equation', variable: 'x', solutions: [5] }, ['3x + 4 = 19', 'x = 5']]
];
for (const [meta, lines] of CORRECT) {
  const r = stepCheck(meta, lines.join('\n'), { prompt: '' });
  ok(r.lines.every(l => l.status !== 'break'), `correct working is not flagged: ${JSON.stringify(lines)}`);
  ok(r.lines.every(l => !l.diagnosis || !topicDiagnosisCodes().includes(l.diagnosis.code)), `and not named by a topic: ${JSON.stringify(lines)}`);
  // The detectors on their own are silent on a correct line, too.
  ok(diagnoseTopicLine({ line: lines[1], previous: lines[0], index: 1, meta }) === null, `no detector claims a correct line: ${JSON.stringify(lines)}`);
}
// A wrong line that is no known slip stays unnamed (the generic note is kept, not a guess).
{
  const meta = { kind: 'expression', canonical: 'x^2+3x-28' };
  const r = stepCheck(meta, '(x + 7)(x - 4)\n= x^2 + 11x + 1', { prompt: '' });
  ok(r.lines[1].status === 'break' && !topicDiagnosisCodes().includes(r.lines[1].diagnosis?.code), 'an unexplained wrong line is not given a guessed slip');
}
// R4 review regressions: bounded cost, no answer printed on an expand question, true index messages.
{
  const timed = (meta, lines) => { const t = Date.now(); const r = stepCheck(meta, lines.join('\n'), { prompt: '' }); return { r, ms: Date.now() - t }; };
  const heavy = timed({ kind: 'expression', canonical: '2' }, ['((x+y+1)^6)^6', '= 2']);
  ok(heavy.ms < 2000, `a huge power of a sum is bounded (${heavy.ms} ms)`);
  const heavy2 = timed({ kind: 'expression', canonical: '1' }, ['(a+b+c+d+e+f)^12', '= 1']);
  ok(heavy2.ms < 2000, `a twelfth power of six terms is bounded (${heavy2.ms} ms)`);
  const ex = stepCheck({ kind: 'expression', canonical: 'x^2+5x+6' }, '(x + 2)(x + 3)\n= (x + 1)(x + 6)', { prompt: '' });
  ok(!/x² \+ 5x \+ 6/.test(String(ex.lines[1]?.note)), 'an expand question never has its expansion printed by the factorise check');
  const neg = diagnoseTopicLine({ line: '= -2x^6', previous: '(-2x^(3))^(2)', index: 1, meta: { kind: 'expression' } });
  ok(!neg || /\(−2\)\^2 = 4/.test(neg.message), `the power of a negative number is written (−2)^2 = 4: ${neg?.message}`);
  ok(diagnoseTopicLine({ line: '= x^6*y^2', previous: 'x^2*y * x^3*y^2', index: 1, meta: { kind: 'expression' } }) === null, 'a product over two variables is not named by the single-variable rule');
}
ok(registeredTopics().map(t => t.topic).includes('algebra') && registeredTopics().map(t => t.topic).includes('indices'), 'algebra and indices register themselves');
ok(topicDiagnosisCodes().length >= 18, `${topicDiagnosisCodes().length} slip codes registered`);

console.log(failures.length
  ? `TOPIC SLIPS (algebra, indices): FAIL — ${failures.length} of ${checks} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`
  : `TOPIC SLIPS (algebra, indices): PASS — ${checks} checks — ${T.length + SOLVE.length} scripted slips named on the right line in English and Hindi, correct working never named, every status unchanged. [SYNTHETIC]`);
process.exit(failures.length ? 1 : 0);
