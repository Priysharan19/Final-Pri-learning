#!/usr/bin/env node
// Pri Learning · how specific is the feedback on a ticked line? (Prithagoras edition, NSW Years 11-12 and the question bank)
//
// Measures; changes nothing. Every question's own worked solution is typed as a page and marked through the server's practice path, read through the
// page model the marked page uses, and each TICKED line is put in one group by what the page writes beside it:
//   specific   a verified fact about THAT line (a change between lines, a proved model, a substitution): `explain` is set (named or fact only)
//   class      the class phrase of the engine's proof ("Correct differentiation", "Given in the question")
//   generic    "True as written" or no phrase at all
// It also writes, per page, the verdict signature (tick, cross, note, neutral per line and the server's correct flag) so that a run on another tree can be
// compared: marks and crosses must be identical, and a tick may only be added.
//   node tools/step-feedback-share.mjs [--out <file>] [--limit <n>]       (out: outside the repository)
//   node tools/step-feedback-share.mjs --compare <before.json> <after.json>
import '../server/test/support/hermetic.mjs';
import fs from 'node:fs';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;

const flag = n => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : null; };
if (process.argv.includes('--compare')) {
  const [a, b] = [process.argv[process.argv.indexOf('--compare') + 1], process.argv[process.argv.indexOf('--compare') + 2]].map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const A = new Map(a.pages.map(p => [p.id, p])), B = new Map(b.pages.map(p => [p.id, p]));
  let same = 0, resultDiff = 0, crossDiff = 0, tickLost = 0, tickAdded = 0, missing = 0, neutralChanged = 0;
  const examples = [];
  for (const [id, p] of A) {
    const q = B.get(id);
    if (!q) { missing++; continue; }
    if (p.correct !== q.correct) { resultDiff++; examples.push(['result', id]); }
    let moved = false;
    for (let i = 0; i < p.sig.length; i++) {
      const x = p.sig[i], y = q.sig[i];
      if (x === y) continue;
      moved = true;
      if (x === 'b' || y === 'b') { crossDiff++; examples.push(['cross', id, i]); }
      else if (x === 'o' && y !== 'o') { tickLost++; examples.push(['tick lost', id, i]); }
      else if (y === 'o') tickAdded++;
      else neutralChanged++;
    }
    if (!moved) same++;
  }
  console.log(JSON.stringify({ pages: A.size, identical: same, correctFlagChanged: resultDiff, crossChanged: crossDiff, tickLost, tickAdded, neutralOrNoteChanged: neutralChanged, missingAfter: missing, examples: examples.slice(0, 10) }));
  process.exit(resultDiff || crossDiff || tickLost || missing ? 1 : 0);
}

const AC = await import('./annotation-coverage.mjs');
const { MARKER_OPS, markerView } = await import('../server/platform/markerOps.js');
const { buildAnnotatedWorking } = await import('../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage } = await import('../client/src/components/markedPageModel.js');
const T = await import('../client/src/components/markedPageTeacher.js');

function pageOf(q, answer, lines) {
  let r;
  try { r = MARKER_OPS.practice({ q, answer, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {}); } catch { return null; }
  const rep = r?.evidence?.shownReport || r?.evidence?.stepReport;
  if (!rep || !Array.isArray(rep.lines)) return null;
  let page = null;
  try { const model = buildAnnotatedWorking({ lines, stepReport: rep, page: true }); page = model ? buildMarkedPage({ model }) : null; } catch { page = null; }
  if (!page) return { correct: r.result?.correct === true, sig: rep.lines.map(l => (l.status === 'ok' ? 'o' : l.status === 'break' ? 'b' : l.context ? 'c' : 'n')).join(''), groups: null };
  const marks = T.buildTeacherMarks({ page });
  const sig = page.lines.map(l => (l.status === 'checked' ? 'o' : l.status === 'first-error' ? 'b' : l.status === 'condition' ? 'c' : 'n')).join('');
  const groups = { specific: 0, named: 0, factOnly: 0, class: 0, generic: 0, ticks: 0 };
  const miss = [];
  for (const m of marks.filter(x => x.kind === 'right')) {
    groups.ticks++;
    if (!m.explain) { const i = page.lines.findIndex(l => l.n === m.n); miss.push({ cls: m.cls, above: i > 0 ? page.lines[i - 1].card.text : null, line: page.lines[i].card.text }); }
    if (m.explain) { groups.specific++; if (m.explain.named) groups.named++; else groups.factOnly++; }
    else if (m.cls === 'trueAsWritten' || !m.phrase) groups.generic++;
    else groups.class++;
  }
  return { correct: r.result?.correct === true, sig, groups, miss };
}

const limit = Number(flag('limit')) || Infinity;
const W = await AC.loadWorld();
const pages = [];
const add = (id, kind, o) => { if (o) pages.push({ id, kind, ...o }); };
let n = 0;
for (const f of AC.generatedForms(W)) {
  for (const seed of f.seeds) {
    if (n++ >= limit) break;
    const q0 = W.G.generateQuestion(f.generator, f.difficulty, seed);
    const q = markerView({ ...q0, _marking: 'final-answer-only' });
    const { lines } = AC.authoredLines(q, AC.genToPlain);
    if (!lines.length || ['mcq', 'multi-mcq', 'matrix-match'].includes(q.answerType)) continue;
    add(`${f.id}#${seed}`, 'generated', pageOf(q, AC.keyText(q), lines));
  }
}
for (const b of AC.bankEntriesOf(W)) {
  if (n++ >= limit) break;
  if (!b.place) continue;
  const q = markerView(b.worked ? W.pack.qbankManualQuestion(b.entry.id, 17) : W.pack.qbankEntryQuestion(b.entry.id, 17));
  const { lines } = AC.authoredLines(q, AC.bankToPlain);
  if (!lines.length || ['mcq', 'multi-mcq', 'matrix-match'].includes(q.answerType)) continue;
  add(`${b.worked ? 'bw' : 'b'}:${b.entry.id}`, b.worked ? 'bank-worked' : 'bank', pageOf(b.worked ? { ...q, _bankWorked: true } : q, b.worked ? '' : AC.keyText(q), lines));
}
const share = kind => {
  const g = { ticks: 0, specific: 0, named: 0, factOnly: 0, class: 0, generic: 0, pages: 0 };
  for (const p of pages.filter(x => !kind || x.kind === kind)) { if (!p.groups) continue; g.pages++; for (const k of Object.keys(g)) if (k !== 'pages') g[k] += p.groups[k]; }
  const pct = x => (g.ticks ? Math.round((x / g.ticks) * 1000) / 10 : 0);
  return { ...g, specificPct: pct(g.specific), namedPct: pct(g.named), factOnlyPct: pct(g.factOnly), classPct: pct(g.class), genericPct: pct(g.generic) };
};
const report = { total: share(null), generated: share('generated'), bank: share('bank'), bankWorked: share('bank-worked') };
console.log(JSON.stringify(report, null, 1));
if (flag('out')) fs.writeFileSync(flag('out'), JSON.stringify({ report, pages }) + '\n');
