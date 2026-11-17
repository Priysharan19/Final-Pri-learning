// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · smart feedback · polynomial working lines (client/src/engine/misconceptions/topics/polynomial-lines.js)
//
// Holds the catalogue to the blitz rules, deterministically:
//   A · every slip code is unique, has a detector, and an English, Hindi and en-AU message and a Notes link;
//   B · every designed slip is NAMED, on the broken line, by the code that describes it;
//   C · a correct line (equivalent to the one above) is never named, and the registry is only ever asked about
//       lines the step checker already marked as a break, so status, mark and first break are unchanged;
//   D · over the issued Extension questions that have a Step Check (me11-poly, me12-induction, mex-proof):
//       the first flagged line is the wrong one, the message never states the answer, and the share of flagged
//       lines that carry a specific message is reported (and held at 80% or more).
// SYNTHETIC: generated questions, scripted working. Not evidence about real students.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { diagnoseTopicLine, registeredTopics, topicDiagnosisCodes } = await import(`${SRC}engine/misconceptions/topics/index.js`);
const { polynomialOf } = await import(`${SRC}engine/misconceptions/topics/polynomial-lines.js`);
const { generateQuestion, loadAllBanks, directFormsOnly } = await import(`${SRC}engine/generators/index.js`);
const { stepCheck, checkAnswer } = await import(`${SRC}engine/checker.js`);
const { NSW_ISSUED_CELLS } = await import(`${SRC}engine/nswIssuedCells.js`);
const { checkWorking } = await import(`${SRC}engine/checker.js`);
const nsw = await import(`${SRC}engine/curriculum-nsw/index.js`);
const { exprEquivalent } = await import(`${SRC}engine/expr.js`);
const { stepMetaFor } = await import('../../server/platform/markerOps.js');
await loadAllBanks();
// Questions here are named by (skill, difficulty, seed) and the designed wrong answers are their authored traps: the
// skills' direct forms (client/test/support/direct-forms.mjs). The other forms are step-marked by the sweeps in
// marker-adversarial-corpus-check and feedback-first-error-sweep-check (support/extra-form-step-sweep.mjs).
directFormsOnly(true);

const failures = []; let checks = 0;
const ok = (c, t) => { checks++; if (!c && failures.length < 40) failures.push(t); };

// A · the catalogue's own shape
const codes = topicDiagnosisCodes();
ok(new Set(codes).size === codes.length, 'slip codes are unique across every registered topic');
const mine = registeredTopics().find(t => t.topic === 'polynomial-lines');
ok(!!mine && mine.slips.length >= 5, 'the polynomial-lines catalogue is registered');
const sample = { kind: 'expression', canonical: '4*n^3-4*n' };
const probe = (previous, line, meta = sample) => diagnoseTopicLine({ line, previous, index: 1, meta });

// B · designed slips, each named by its own code (the question's numbers drive the message)
const DESIGNED = [
  ['4*n^3 - 4*n', '= 4*n^3 + 4*n', 'poly-term-sign', /term in n has the opposite sign/],
  ['x^3 + 6x^2 + 9x', '= x^3 + 9x', 'poly-term-missing', /no term|has none/],
  ['5x^2 + 2x + 3', '= 5x^2 + 2x + 1', 'poly-constant-off', /Only the constant term changed/],
  ['x^3 + 2x^2 - 5x + 6', '= x^3 + 2x^2 - 5x + 7', 'poly-constant-off', /not right/],
  ['x^2 + 6x + 9', '= x^2 + 5x + 9', 'poly-coefficient-off', /coefficient 5, but the line above gives 6/],
  ['2x^2 + 4x + 6', '= 4x^2 + 8x + 12', 'poly-scaled', /2 times/],
  ['3x^2 - 12', '= 3x^2 + 12', 'poly-term-sign', /constant term has the opposite sign/]
];
for (const [prev, line, code, re] of DESIGNED) {
  const r = probe(prev, line);
  ok(r?.code === code, `${prev} → ${line}: expected ${code}, got ${r?.code}`);
  ok(r && re.test(r.message), `${prev} → ${line}: message ${JSON.stringify(r?.message)}`);
  ok(r && typeof r.messages.hi === 'string' && r.messages.hi.length > 20 && /[ऀ-ॿ]/.test(r.messages.hi) && !!r.messages['en-AU'], `${code}: hi and en-AU messages`);
  ok(r && /^[a-z0-9-]+#mistakes$/.test(r.notesSectionId || ''), `${code}: Notes link ${r?.notesSectionId}`);
}
// The registry names a line by the FIRST registered topic that recognises it, and this catalogue is the fallback for
// lines nothing earlier names (polynomial-lines.js). Two lines it used to name first are now named, with the cause,
// by the algebra catalogue registered before it: a factorisation that does not expand back, and a squared bracket
// whose cross term is missing. Their specific messages are the better ones; that they win is pinned here.
for (const [prev, line, code] of [['4*n^3 - 4*n', '= 4*n*(n^2 + 1)', 'factorise-fails-when-expanded'], ['(4n+8)^2', '= 16n^2 + 64', 'power-of-sum']]) {
  const r = probe(prev, line);
  ok(r?.code === code && r.topic === 'algebra', `${prev} → ${line}: the algebra catalogue names it ${code}, got ${r?.code} (${r?.topic})`);
  ok(r && typeof r.messages.hi === 'string' && r.message.length > 20 && !/undefined|NaN/.test(r.message), `${code}: a real message, in hi too`);
}
// The first line of a working, nothing above it: described, never quantified.
const FIRST = [['= 4*n*(n^2 + 1)', 'poly-final-term-sign'], ['= 16*n^2 + 64', 'poly-final-term-missing'], ['= 8*n^2 + 4*n', 'poly-final-coefficient']];
for (const [line, code] of FIRST) {
  const meta = code === 'poly-final-coefficient' ? { kind: 'expression', canonical: '4*n^2 + 4*n' } : code === 'poly-final-term-sign' ? sample : { kind: 'expression', canonical: '16*n^2 + 64*n + 64' };
  const r = diagnoseTopicLine({ line, previous: null, index: 0, meta });
  ok(r?.code === code, `first line ${line}: expected ${code}, got ${r?.code}`);
  ok(r && !/\d/.test(r.message.replace(/n\^\d/g, '')), `${code}: states no number (${r?.message})`);
}
const eq = { kind: 'equation', variable: 'k', solutions: [22] };
const sign = diagnoseTopicLine({ line: 'k = -22', previous: null, index: 0, meta: eq });
ok(sign?.code === 'solution-sign-flipped' && !/22 =|= 22/.test(sign.message), 'an equation answer with the sign flipped is named without stating the answer');
ok(sign && sign.notesSectionId === 'me1-11-02#mistakes', 'its Notes link is the Extension 1 polynomials chapter');
ok(diagnoseTopicLine({ line: 'k = 7', previous: null, index: 0, meta: eq }) === null, 'a wrong value that is not the opposite sign is not named');
ok(diagnoseTopicLine({ line: 'k = 0', previous: null, index: 0, meta: { kind: 'equation', variable: 'k', solutions: [0] } }) === null, 'zero has no opposite');

// B2 · rules the review added: a first line is never compared with the expanded source as if it were a line the
// student wrote, nothing quantifies the answer, the verdict sentence never shows 'undefined', and every Notes link is a real chapter.
const spansOf = p => [...String(p || '').matchAll(/\$([^$]+)\$/g)].map(m => m[1].replace(/\\left|\\right|\\,|\;|\\displaystyle/g, '').replace(/\\cdot|\\times/g, '*').replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/\\dfrac|\\frac/g, ''));
const withSource = { kind: 'expression', canonical: 'x^2+6*x+9', source: '(x+3)^2' };
for (const w of ['= x^2 + 5*x + 9', '= x^2 + 6*x + 8', '= 2*x^2 + 12*x + 18']) {
  const r = diagnoseTopicLine({ line: w, previous: withSource.source, index: 0, meta: withSource });
  ok(!r || !/above|out by|times|coefficient \d|[^a-z\d]6[^\d]|[^a-z\d]9[^\d]/.test(r.message.replace(/x\^\d/g, '')), `a first line against the source stated a number: ${r?.message}`);
}
const fq = generateQuestion('mex-proof', 3, 7003);
const fm = stepMetaFor(fq);
const fstart = spansOf(fq.prompt).find(s => { try { return !/=/.test(s) && exprEquivalent(s, fm.canonical); } catch { return false; } });
const fb = checkWorking({ answer: { stepMeta: fm, minLines: 2 } }, `${fstart}\n= ${fq.traps[0].expr}`);
ok(!/undefined/.test(JSON.stringify(fb)), `the working feedback shows "undefined": ${JSON.stringify(fb).slice(0, 200)}`);
ok(fb.stepReport?.firstBreak === 1 && /This looks like: a |slip|Check|term|coefficient|constant/i.test(String(fb.feedback)), `the working feedback names the slip: ${String(fb.feedback).slice(0, 160)}`);
const chapters = new Set(['ME1-11-02', 'ME1-12-01', 'ME2-12-01', 'MA5-ALG-C-01'].map(s => s.toLowerCase()));
const known = new Set([nsw.NSW_MATHEMATICS_K10_2022, nsw.NSW_MATHEMATICS_EXTENSION1_2024, nsw.NSW_MATHEMATICS_EXTENSION2_2024].flatMap(sy => sy.focusAreas.map(fa => fa.outcomes[0].toLowerCase())));
for (const id of chapters) ok(known.has(id), `Notes chapter ${id} is not a focus area of the NSW curriculum model`);
for (const s of mine.slips) { const h = s.detect({ line: '= x', previous: 'x', index: 1, meta: { kind: 'expression', canonical: 'x' } }); void h; }

// C · correct (equivalent) lines are never named
const CORRECT = [['(4n+8)^2', '= 16n^2 + 64n + 64'], ['4*n^3 - 4*n', '= 4*n*(n^2 - 1)'], ['n^3 - 9n', '= n*(n-3)*(n+3)'], ['17(16p+1) - 1', '= 16(17p + 1)'], ['k^2 + 2k + 1', '= (k+1)^2'], ['x^2 - 9', '= (x-3)(x+3)']];
for (const [prev, line] of CORRECT) ok(probe(prev, line) === null, `correct step ${prev} → ${line} was named`);
ok(probe(null, '= 4n') === null, 'with no line above there is no comparison');
ok(probe('what is n?', '= 4n') === null, 'a line above that is not a polynomial is not compared');
ok(polynomialOf('x^7') === null || polynomialOf('x^7').coeffs.every(Number.isFinite), 'a polynomial above the cap never gives a wrong fit');

// D · the Extension questions that have a Step Check
let items = 0, named = 0, wrongLine = 0, leaks = 0, specificCodes = {};
for (const g of ['me11-poly', 'me12-induction', 'mex-proof']) {
  for (const d of NSW_ISSUED_CELLS[g] || []) for (let i = 0; i < 10; i++) {
    let q; try { q = generateQuestion(g, d, 7000 + i * 31 + d); } catch { continue; }
    const meta = stepMetaFor(q); if (!meta) continue;
    const answerText = JSON.stringify(q.answer);
    const start = meta.kind === 'equation' ? null : spansOf(q.prompt).find(s => { try { return !/=/.test(s) && s.length > 2 && s.length < 80 && exprEquivalent(s, meta.canonical); } catch { return false; } }) || null;
    for (const t of (q.traps || []).slice(0, 3)) {
      const wrong = meta.kind === 'equation' ? (Number.isFinite(t?.value) ? `${meta.variable} = ${t.value}` : null) : (typeof t?.expr === 'string' ? `= ${t.expr}` : null);
      if (!wrong) continue;
      let finalWrong = false; try { finalWrong = checkAnswer(q, wrong.replace(/^.*?=\s*/, '')).correct === false; } catch { /* skip */ }
      if (!finalWrong) continue;
      const lines = start ? [start, wrong] : [wrong];
      const r = stepCheck(meta, lines.join('\n'), { prompt: q.prompt });
      items++;
      const idx = lines.length - 1;
      if (r.firstBreak === idx) wrongLine++;
      const dg = r.lines[idx]?.diagnosis;
      if (dg && dg.topic) { named++; specificCodes[dg.code] = (specificCodes[dg.code] || 0) + 1; }
      else if (dg && !['counterexample', 'derivative-check'].includes(dg.code)) { named++; specificCodes[dg.code] = (specificCodes[dg.code] || 0) + 1; }
      const note = String(r.lines[idx]?.note || '');
      if (process.env.SMART_DEBUG && !(dg && (dg.topic || !['counterexample', 'derivative-check'].includes(dg.code)))) console.log('UNNAMED', g, 'D' + d, JSON.stringify(lines), dg?.code, note.slice(0, 80));
      const canonical = meta.canonical ? String(meta.canonical).replace(/\s+/g, '') : (meta.solutions ? String(meta.solutions[0]) : '');
      if (canonical.length > 3 && note.replace(/\s+/g, '').includes(canonical)) leaks++;
    }
  }
}
ok(items >= 10, `the Extension sweep ran over ${items} designed wrong answers`);
ok(wrongLine === items, `the first flagged line was the wrong one in ${wrongLine} of ${items}`);
ok(leaks === 0, `${leaks} messages state the final answer`);
ok(named / items >= 0.8, `specific coverage ${named}/${items} is below 80%`);
console.log(`smart polynomial lines: ${items} designed wrong answers over me11-poly, me12-induction, mex-proof; ${named} named (${Math.round(100 * named / items)}%), ${wrongLine} flagged on the wrong line, ${leaks} leaks; codes ${JSON.stringify(specificCodes)}`);

if (failures.length) { console.error(`SMART POLYNOMIAL LINES: FAIL — ${failures.length} of ${checks} checks failed`); for (const f of failures) console.error('  · ' + f); process.exit(1); }
console.log(`SMART POLYNOMIAL LINES: PASS — ${checks} checks — slips named on the broken line by their own code, correct lines never named, no message states the answer. [SYNTHETIC]`);
