// A correct intermediate line is ticked when it matches a step of the
// question's worked solution (audit #1). Feedback only: no mark changes.
// Run: node client/test/milestones-check.mjs   [SYNTHETIC: direct engine]
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, GENERATORS, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { IN_CHAPTERS } = await import(`${SRC}engine/curriculum-in.js`);
const { milestonesOf, matchMilestone, annotateMilestones } = await import(`${SRC}engine/milestones.js`);
const { stepCheck, methodMarks } = await import(`${SRC}engine/checker.js`);
const { exprEquivalent } = await import(`${SRC}engine/expr.js`);
const { stepEvidence, stepMetaFor, marksPossibleFor } = await import('../../server/platform/markerOps.js');
await loadAllBanks();

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass += 1; else { fail += 1; console.error('FAIL', l); } };

// ── Group 1: the owner's example and its neighbours ──
const q = { prompt: 'Find the stationary point of $f(x) = 3x^2 + x - 2$.', answerType: 'numeric', answerPrefix: 'x =', answer: { value: -1 / 6 },
  steps: [{ h: 'Differentiate', d: "$f'(x) = 6x + 1$" }, { h: 'Set it to zero', d: '$6x + 1 = 0$' }, { h: 'Solve', d: '$x = -\\frac{1}{6}$' }] };
const meta = stepMetaFor(q);
const raw = stepCheck(meta, "f'(x)=6x+1\n6x+1=0\nx=-1/6");
ok(raw.lines[0].status === 'note', 'baseline: the check alone leaves the derivative unticked');
const ann = annotateMilestones(q, raw);
ok(ann.lines[0].status === 'ok' && ann.lines[0].milestone.step === 1 && /step 1 of the method \(Differentiate\)/.test(ann.lines[0].note), "f'(x)=6x+1 → ✓ matches step 1");
ok(annotateMilestones(q, stepCheck(meta, "f′(x) = 1 + 6x")).lines[0].status === 'ok', 'prime sign and order of terms');
for (const wrong of ["f'(x)=6x-1", "f'(x)=3x+1", "f'(x)=6x", "f'(x)=6x+1+x", "f(x)=6x+1", "g'(x)=6x+1", "f'(x)=f'(x)", "f'(x)=6y+1"]) {
  ok(annotateMilestones(q, stepCheck(meta, wrong)).lines[0].status !== 'ok', `not ticked: ${wrong}`);
}
const brk = stepCheck(meta, "f'(x)=6x+1\n6x+1=0\nx=1/6");
const annB = annotateMilestones(q, brk);
ok(annB.lines[2].status === 'break' && annB.firstBreak === brk.firstBreak, 'a break stays a break');
ok(annotateMilestones({ ...q, steps: [] }, raw) === raw, 'no worked solution: report unchanged');
ok(annotateMilestones(q, null) === null, 'no report: nothing invented');

// ── Group 2: no mark changes ──
const working = "f'(x)=6x+1\n6x+1=0\nx=1/6";
const direct = methodMarks({ meta, working, marks: marksPossibleFor(q), prompt: q.prompt });
const ev = stepEvidence(q, '1/6', working, { correct: false });
ok(ev.partial?.awarded === direct?.awarded && ev.stepReport.lines[0].status === 'ok', 'method mark identical with the milestone tick shown');

const ticks = (q0, line) => annotateMilestones(q0, { lines: [{ text: line, status: 'note' }], firstBreak: -1, diagnosis: null })?.lines[0].status === 'ok';
// ── Group 3: questions with no Step Check of their own ──
const noMeta = { prompt: 'p', answerType: 'mcq', answer: { correctIndex: 0 }, steps: [{ h: 'Discriminant', d: '$D = 25 - 16 = 9$' }] }; // a formula-then-substitution chain (b^2 - 4ac = 9) is not one proven relation, so it yields no milestone
ok(ticks(noMeta, 'D = 9') && !ticks(noMeta, 'D = 8') && !ticks(noMeta, 'so two roots'), 'a matching note is ticked, others stay notes');
// A question whose working is not checked gets no report at all (photo-working-marking-http-check: "no line is judged").
ok(stepEvidence(noMeta, '0', 'D = 9', { correct: true }).stepReport === null && stepEvidence(noMeta, '0', 'D = 9', { correct: true }).partial === null, 'no Step Check: no report, no milestones, no mark');
// Lines after the first break stay unjudged (flagship-ap-working-http-check, seed 7000).
const afterBreak = annotateMilestones(q, stepCheck(meta, "6x+1=0\nx=1/6\nf'(x)=6x+1"));
ok(afterBreak.firstBreak === 1 && afterBreak.lines[2].status === 'note', 'a milestone line after the first break is not ticked');

// ── Group 3b: compound steps (review of #813) and learner state ──
const { fullyVerifiedWorking } = await import(`${SRC}engine/misconceptions.js`);
const comp = { prompt: 'p', answerType: 'mcq', answer: { correctIndex: 0 }, steps: [
  { h: 'Read off', d: '$a = 11, \\quad d = 7$' }, { h: 'Antiderivative', d: '$F(2) = 16, \\quad F(0) = 0$' }, { h: 'Parts', d: '$u = x^{3}, \\quad v = 3x + 4$' }] };
for (const [line, want] of [['a = 7', false], ['a = 11', true], ['d = 7', true], ['F(2) = 0', false], ['F(2) = 16', true], ['u = 3x+4', false], ['u = x^3', true], ['v = 3x + 4', true]]) {
  ok(ticks(comp, line) === want, `compound step: ${line} ${want ? 'ticked' : 'not ticked'}`);
}
ok(milestonesOf({ steps: [{ d: '$x = 1, 2$' }] }).length === 0, 'a value with a top-level comma is never a milestone');
// Real generators the review named, at every seed that shows the compound form.
let compoundSeen = 0, compoundBad = 0;
for (const [gen, d] of [['y12-series', 2], ['y12-integration', 2], ['y12-diff', 2]]) for (let seed = 1; seed <= 40; seed += 1) {
  let g; try { g = generateQuestion(gen, d, seed); } catch { continue; }
  for (const st of g?.steps || []) for (const sp of String(st.d || '').matchAll(/\$([^$]+)\$/g)) {
    if (!/,\s*\\quad/.test(sp[1])) continue;
    compoundSeen += 1;
    const ms = milestonesOf(g);
    for (const m of ms) if (m.values.some(v => /,/.test(v))) compoundBad += 1;
  }
}
ok(compoundBad === 0 && compoundSeen > 0, `compound spans in y12 banks: ${compoundBad} values carry another statement (${compoundSeen} spans seen)`);
const mq = { steps: [{ h: 'D', d: '$D = 1$' }, { h: 'x', d: '$x = -\\frac{1}{6}$' }] };
const mo = annotateMilestones(mq, { lines: [{ text: 'D = 1', status: 'note' }, { text: 'x = -1/6', status: 'note' }], firstBreak: -1, diagnosis: null });
ok(mo.lines.every(l => l.status === 'ok') && fullyVerifiedWorking(mo) === false, 'milestone ticks never count as verified working');
ok(fullyVerifiedWorking(annotateMilestones(q, stepCheck(meta, "f'(x)=6x+1\n6x+1=0\nx=-1/6"))) === false, 'an annotated tick never counts as verified working');
ok(fullyVerifiedWorking(stepCheck(meta, '6x+1=0\nx=-1/6')) === true, 'checked working still counts');


// ── Group 3c: permanent regression fuzz (reviews of #813) ──
// The rule is structural: a step's span yields statements only when the
// whole span reads (every TeX command known, every piece a complete
// LABEL = value chain whose values are all equivalent). Otherwise nothing is
// ticked. So for every joiner, the WRONG pairing is never ticked; the right
// line is ticked only where the span is cut at a plain , or ;.
const tick = (span, line) => ticks({ steps: [{ h: 'S', d: `$${span}$` }] }, line);
const JOINS = [
  // first and second reviews
  '\\Rightarrow', '\\Longrightarrow', '\\implies', '\\iff', '\\Leftrightarrow', '\\to', '\\therefore', '\\because', '\\quad', '\\qquad',
  '\\;', '\\,', '\\:', '\\ ', '\\\\', ', \\quad', ',\\ ', '\\text{ so }', '\\text{ gives }', '\\text{ then }', '\\text{ hence }',
  '\\text{ and }', '\\text{ i.e. }', '\\text{ thus }', '\\mathrm{ and }', '⇒', '→', '∴',
  // third review: the 33 variants' joiners
  '\\text{ also }', '\\text{ while }', '\\text{ when }', '\\text{ where }', '\\text{ if }', '\\text{. Then }', '\\mid', '\\vee',
  '\\Leftarrow', '\\Longleftarrow', '\\longrightarrow', '\\mapsto', '⟹', '\\enspace', '\\hspace{1em}', '\\text{, }', '\\wedge', '\\land',
  '\\lor', '\\text{ or }', '\\text{ with }', '\\text{ giving }', '\\qquad\\text{and}\\qquad', ' ', '  ', '\\!', '\\>', '\\medspace', '\\thinspace',
  // plain separators: here the right line must still be ticked
  ',', ';', ', ', '; '
];
const PLAIN = new Set([',', ';', ', ', '; ']);
const SHAPES = [['x = 2', 'y = 5', 'x = 5', 'x = 2'], ['a = 11', '2d = 14', 'a = 14', 'a = 11'], ['m = 3', 'y - 1 = 3(x - 2)', 'm = 3(x-2)', 'm = 3'],
  ['T_n = 7', 'n + 1 = 9', 'T_n = 9', 'T_n = 7'], ['k = 3', 'm = 4', 'k = 4', 'k = 3'], ['a = 11', 'd + 1 = 8', 'a = 8', 'a = 11']];
let fuzz = 0, falseTicks = 0, plainMissed = 0;
for (const j of JOINS) for (const [l, r, wrong, right] of SHAPES) {
  const span = `${l}${/^[,;]/.test(j) ? '' : ' '}${j} ${r}`;
  fuzz += 1;
  if (tick(span, wrong)) { falseTicks += 1; console.error('false tick', JSON.stringify(span), wrong); }
  if (PLAIN.has(j) && /^[A-Za-z]/.test(r) && /^[A-Za-z_]+ =/.test(r) && !tick(span, right)) { plainMissed += 1; console.error('missed', JSON.stringify(span), right); }
}
ok(falseTicks === 0, `joiner fuzz: ${falseTicks} false ticks in ${fuzz}`);
ok(plainMissed === 0, `plain , and ; separators: ${plainMissed} right lines missed`);
// Spacing inside an expression is part of the expression (third review).
for (const [span, wrong, right] of [
  ['F(2) = 2\\,(4) + 8 = 16', 'F(2) = 2', 'F(2) = 16'], ['y = 3\\,x + 2', 'y = 3', 'y = 3x + 2'], ['A = 2\\ \\pi r', 'A = 2', null],
  ['v = 4\\;t + 1', 'v = 4', 'v = 4t + 1'], ['k = 3\\text{, } m = 4', 'k = 4', null], ['\\sqrt{-4} = \\sqrt{4}\\,i = 2i', 'i = 2i', null],
  ['x = 2 y = 5', 'x = 5', null], ['D = b^2 - 4ac = 9', 'D = 9', null], ['i = 2i', 'i = 2i', null], ['x = 1, 2', 'x = 2', null], ['x = 1, 2', 'x = 1', null]]) {
  ok(!tick(span, wrong), `no tick: ${span} — ${wrong}`);
  if (right) ok(tick(span, right), `tick: ${span} — ${right}`);
}
// Student lines that do not read in full are never ticked.
const qd = { prompt: 'p', answerType: 'mcq', answer: { correctIndex: 0 }, steps: [{ h: 'D', d: "$f'(x) = 6x + 1$" }] };
for (const line of ["f'(x) = 6x + 1 so", "f'(x) = 6x + 1 ⟹", "f'(x) = 6x + 1 = 7", "f'(x) == 6x + 1", "f'(x) = 6x + 1 ✓", "f'(x) = (6x + 1"]) {
  ok(!ticks(qd, line), `a line that does not read in full: ${line}`);
}
// Real draws the reviews named.
for (const [gen, d, seeds, line] of [['c11-domain-range-reasoning', 1, [1, 1009, 7919, 16847], 'y(x^2+2x+2) = 0'], ['mex-mechanics', 1, [1], 'x = 8'],
  ['c12-bijection-reasoning', 1, [7], 'y(5x-2) = (2y+4)/(5y+6)'], ['c11-complex-numbers', 4, [1], 'i = 2i'], ['c11-complex-numbers', 4, [1], 'i = 2*i']]) for (const seed of seeds) {
  let g; try { g = generateQuestion(gen, d, seed); } catch { g = null; }
  if (!g) continue;
  ok(!ticks(g, line), `${gen} d${d} s${seed}: ${line} not ticked`);
}
// Catalogue: one label's line carrying another statement's (different) value is never ticked.
let cross = 0, crossBad = 0, spans = 0;
for (const gen of Object.keys(GENERATORS)) for (let d = 1; d <= 4; d += 1) for (const seed of [1, 7, 7919, 15838, 23757, 104729]) {
  let g; try { g = generateQuestion(gen, d, seed); } catch { continue; }
  for (const st of g?.steps || []) for (const sp of String(st.d || '').matchAll(/\$([^$]+)\$/g)) {
    const ms = milestonesOf({ steps: [{ h: 'S', d: `$${sp[1]}$` }] });
    spans += 1;
    for (const a of ms) for (const b of ms) {
      if (a === b) continue;
      const own = a.values[a.values.length - 1], v = b.values[b.values.length - 1];
      let same = false;
      try { same = exprEquivalent(v, own, {}); } catch { same = false; }
      if (same) continue;
      cross += 1;
      if (matchMilestone(ms.filter(m => m.label === a.label), `${a.label} = ${v}`) && !ms.some(m => m.label === a.label && m !== a && (() => { try { return exprEquivalent(m.values[m.values.length - 1], v, {}); } catch { return false; } })())) {
        crossBad += 1; if (crossBad < 6) console.error('cross', gen, d, seed, sp[1]);
      }
    }
  }
}
ok(crossBad === 0, `catalogue cross-pairing: ${crossBad} of ${cross} pairings ticked, over ${spans} spans`);
console.log(`joiners: ${falseTicks} false ticks in ${fuzz} fuzz cases; cross-pairing ${crossBad}/${cross} over ${spans} spans [SYNTHETIC]`);

// ── Group 4: every milestone in the India catalogue, and its corruptions ──
const cells = new Map();
for (const ch of IN_CHAPTERS) for (const c of ch.covers || []) if (GENERATORS[c.gen]) for (const d of c.diff || [1, 2, 3, 4]) cells.set(`${c.gen}|${d}`, { gen: c.gen, d });
let qs = 0, withM = 0, own = 0, ownMiss = 0, corrupt = 0, falseTick = 0;
for (const { gen, d } of cells.values()) for (const seed of [7919, 15838, 23757]) {
  let g; try { g = generateQuestion(gen, d, seed); } catch { continue; }
  if (!g) continue;
  qs += 1;
  const ms = milestonesOf(g);
  if (ms.length) withM += 1;
  for (const m of ms) {
    const v = m.values[m.values.length - 1];
    own += 1;
    if (!matchMilestone(ms, `${m.label} = ${v}`)) ownMiss += 1;
    for (const bad of [`(${v})+1`, `-(${v})`, `2*(${v})`, `(${v})-0.5`]) {
      // −0 and 2·0 are still 0: not a corruption.
      if (exprEquivalent(bad, v, {})) continue;
      // A corruption can coincide with ANOTHER milestone of the same label (two roots x = 2, x = -2): not a false tick.
      if (ms.some(o => o.label === m.label && o !== m && matchMilestone([o], `${m.label} = ${bad}`))) continue;
      corrupt += 1;
      if (matchMilestone(ms, `${m.label} = ${bad}`)) { falseTick += 1; if (falseTick < 6) console.error('false tick', gen, d, m.label, bad); }
    }
  }
}
ok(ownMiss === 0, `every milestone matches its own result (${ownMiss} missed of ${own})`);
ok(falseTick === 0 && corrupt > 3000, `milestone sweep: ${falseTick} false ticks in ${corrupt} corrupted lines`);
console.log(`milestones: ${withM} of ${qs} India questions carry them; ${own} milestones, ${ownMiss} missed; ${falseTick} false ticks in ${corrupt} corrupted lines [SYNTHETIC]`);

console.log(`MILESTONES: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
