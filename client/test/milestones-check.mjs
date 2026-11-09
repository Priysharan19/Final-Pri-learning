// A correct intermediate line is ticked when it matches a step of the
// question's worked solution (audit #1). Feedback only: no mark changes.
// Run: node client/test/milestones-check.mjs   [SYNTHETIC: direct engine]
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, GENERATORS, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { IN_CHAPTERS } = await import(`${SRC}engine/curriculum-in.js`);
const { milestonesOf, matchMilestone, annotateMilestones, milestoneOnlyReport } = await import(`${SRC}engine/milestones.js`);
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

// ── Group 3: questions with no Step Check of their own ──
const noMeta = { prompt: 'p', answerType: 'mcq', answer: { correctIndex: 0 }, steps: [{ h: 'Discriminant', d: '$D = b^2 - 4ac = 25 - 16 = 9$' }] };
const r3 = milestoneOnlyReport(noMeta, 'D = 9\nso two roots\nD = 8');
ok(r3.lines[0].status === 'ok' && r3.lines[1].status === 'note' && r3.lines[2].status === 'note' && r3.firstBreak === -1, 'milestone-only: ticks matches, never calls a line wrong');
ok(stepEvidence(noMeta, '0', 'D = 9', { correct: true }).stepReport?.lines[0].status === 'ok', 'stepEvidence builds it when there is no check');
ok(stepEvidence(noMeta, '0', 'D = 9', { correct: true }).partial === null, 'and awards nothing');

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
