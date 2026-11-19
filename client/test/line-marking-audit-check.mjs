// Pri Learning · line marking over every Year 11 and 12 topic, against labelled working.
//
// Owner, 19 November 2026: step-by-step marking on every Year 11 and 12 question.
// The understanding audit's corpus (tools/understanding-audit/corpus.mjs) writes
// working for every generator and labels each line valid, break (the one slip),
// follows or neutral. This runs the whole marking path the server runs
// (markerOps.stepEvidence, then the rules-only line interpreter folded in by
// lineInterpreter/overlay.js) over every NSW Year 11 and 12 family and holds it to:
//
//   · no valid line crossed, at any layer;
//   · no slip ticked, at any layer;
//   · every family has at least one valid line ticked;
//   · the share of valid lines ticked does not fall below the floor measured
//     when this was written (a floor, not a claim about real students: the
//     corpus is synthetic).
import { SEEDS, loadFamilies, questionsFor, transcriptsFor } from '../../tools/understanding-audit/corpus.mjs';
import { stepEvidence } from '../../server/platform/markerOps.js';
import { interpretAfterStepCheck, reportWithInterpretation } from '../../server/platform/lineInterpreter/overlay.js';

const ON = { PRI_FEATURE_LINE_INTERPRETER: '1' };
const ids = (await loadFamilies()).filter(id => /^(y1[12]|ma1[12]|me1[12]|ms1[12])-/.test(id));
const tally = () => ({ lines: 0, valid: 0, ticked: 0, crossedValid: 0, slips: 0, crossedSlips: 0, tickedSlips: 0 });
const engine = tally(), full = tally(), perFamily = {}, problems = [];
// The same pages with no question facts (what the check did before it read the prompt), for the before-and-after report.
const engine0 = tally(), full0 = tally();
const score = (acc, t, rep, id, layer) => t.lines.forEach((l, i) => {
  const st = rep && rep.lines?.length === t.lines.length ? rep.lines[i]?.status : null;
  acc.lines++;
  if (l.truth === 'valid') { acc.valid++; if (st === 'ok') acc.ticked++; if (st === 'break') { acc.crossedValid++; if (layer && problems.length < 12) problems.push(`valid line crossed (${layer}) ${id}: ${l.text} · ${rep.lines[i].note}`); } }
  if (l.truth === 'break') { acc.slips++; if (st === 'break') acc.crossedSlips++; if (st === 'ok') { acc.tickedSlips++; if (layer && problems.length < 12) problems.push(`slip ticked (${layer}) ${id}: ${l.text}`); } }
});
for (const id of ids) {
  perFamily[id] = tally();
  for (const q of questionsFor(id, SEEDS)) {
    if (q.answerType === 'mcq') continue;
    for (const t of transcriptsFor(q)) {
      const working = t.lines.map(l => l.text).join('\n');
      let ev = null;
      try { ev = stepEvidence(q, '', working, { correct: false }).stepReport; } catch { ev = null; }
      const li = await interpretAfterStepCheck({ question: q, working, stepReport: ev, env: ON });
      const rep = reportWithInterpretation({ stepReport: ev, lineInterpretation: li, working });
      score(engine, t, ev, id, 'engine'); score(full, t, rep, id, 'with interpreter'); score(perFamily[id], t, rep, id, null);
      // Before: the facts and the true-as-written fold switched off (opts.facts null, opts.fold false), nothing else changed. The bar below applies to this too.
      let ev0 = null;
      try { ev0 = stepEvidence(q, '', working, { correct: false }, { facts: null, fold: false }).stepReport; } catch { ev0 = null; }
      const li0 = await interpretAfterStepCheck({ question: q, working, stepReport: ev0, env: ON });
      score(engine0, t, ev0, id, null); score(full0, t, reportWithInterpretation({ stepReport: ev0, lineInterpretation: li0, working }), id, null);
    }
  }
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0');
const empty = Object.entries(perFamily).filter(([, a]) => a.valid && !a.ticked).map(([k]) => k);
const FLOOR = { engine: 24, full: 35 };   // % of valid lines ticked, measured 19 November 2026 (24.8 and 36.3)
const GAIN = 0;   // the question's facts must not lower the share of valid lines ticked (measured 20 November 2026: see the report line)
const fails = [];
if (ids.length < 70) fails.push(`only ${ids.length} families`);
if (engine.crossedValid || full.crossedValid) fails.push(`${engine.crossedValid} + ${full.crossedValid} valid lines crossed`);
if (engine0.crossedValid || full0.crossedValid || engine0.tickedSlips || full0.tickedSlips) fails.push('without the question facts: a valid line crossed or a slip ticked');
if (engine.ticked < engine0.ticked + GAIN || full.ticked < full0.ticked + GAIN) fails.push('the question facts lowered the number of valid lines ticked');
if (engine.tickedSlips || full.tickedSlips) fails.push(`${engine.tickedSlips} + ${full.tickedSlips} slips ticked`);
if (empty.length) fails.push(`no valid line ticked in: ${empty.join(', ')}`);
if (100 * engine.ticked / engine.valid < FLOOR.engine) fails.push(`engine ticks ${pct(engine.ticked, engine.valid)}% of valid lines, below ${FLOOR.engine}%`);
if (100 * full.ticked / full.valid < FLOOR.full) fails.push(`with the interpreter ${pct(full.ticked, full.valid)}% of valid lines are ticked, below ${FLOOR.full}%`);
for (const p of problems) console.error(p);
console.log(`LINE MARKING AUDIT: ${fails.length ? 'FAIL' : 'PASS'} — ${ids.length} Year 11 and 12 families, ${full.lines} labelled lines [SYNTHETIC] — valid lines crossed 0, slips ticked 0 required; valid lines ticked: engine ${pct(engine0.ticked, engine0.valid)}% before and ${pct(engine.ticked, engine.valid)}% with the question's facts, with the interpreter ${pct(full0.ticked, full0.valid)}% before and ${pct(full.ticked, full.valid)}% with them; slips crossed: engine ${pct(engine.crossedSlips, engine.slips)}%, with the interpreter ${pct(full.crossedSlips, full.slips)}%`);
if (fails.length) { for (const f of fails) console.error('  ✗', f); process.exit(1); }
