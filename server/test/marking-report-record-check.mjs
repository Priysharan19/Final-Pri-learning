// Pri Learning · the stored record reproduces the marks (markerOps.stepEvidence `markingReport`)
//
// Marks, partial and method marks are computed from the topic step report; three display-only passes (claimFreeReport,
// foldTrueAsWritten, solutionMatch) then change the report that is shown. Where they differ, the report that DECIDED the marks
// is kept beside it as `markingReport`, so the record reproduces `partial` on every page. `stepReport` is unchanged.
import { stepEvidence, stepMetaFor, marksPossibleFor } from '../platform/markerOps.js';
import { methodMarks } from '../../client/src/engine/checker.js';
import { lostMarksForPage } from '../../client/src/components/attemptEvidence.js';
import en from '../../client/src/i18n/strings.en.js';
import hi from '../../client/src/i18n/strings.hi.js';
import * as G from '../../client/src/engine/generators/index.js';
import { SEEDS, transcriptsFor } from '../../tools/understanding-audit/corpus.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
await G.loadAllBanks();
const STRAYS = [['Let x be the number', '7'], ['where k is a constant', 'Area = 12'], ['Method:', '3 + 4 = 7'], ['x', '5']];
const redo = (q, w, report) => {
  const m = methodMarks({ meta: stepMetaFor(q), working: w, marks: marksPossibleFor(q), prompt: q.prompt, report });
  return JSON.stringify(m ? { okLines: m.okLines, awarded: m.awarded, note: m.note, lines: m.lines, lost: m.lost } : null);
};
const stored = p => JSON.stringify(p ? { okLines: p.okLines, awarded: p.awarded, note: p.note, lines: p.lines, lost: p.lost } : null);

const ids = Object.keys(G.GENERATORS).sort().filter(id => {
  for (let seed = 1; seed < 8; seed++) for (const d of [1, 2, 3, 4]) { try { const q = G.generateQuestion(id, d, seed); if (stepMetaFor(q) && q.answerType !== 'mcq' && !Array.isArray(q.boardScheme)) return true; } catch { /* next */ } }
  return false;
}).slice(0, 50);
let pages = 0, before = 0, after = 0, withField = 0, identicalAbsent = 0, sameReport = 0, leak = 0;
for (let round = 0; round < 60 && pages < 1500; round++) for (const id of ids) for (const d of [1, 2, 3, 4]) {
  if (pages >= 1500) break;
  let q; try { q = G.generateQuestion(id, d, SEEDS[round % 3] + round * 7 + d * 3); } catch { continue; }
  if (!stepMetaFor(q) || q.answerType === 'mcq' || Array.isArray(q.boardScheme)) continue;
  const t = transcriptsFor(q)[round % Math.max(1, transcriptsFor(q).length)];
  if (!t) continue;
  const stray = STRAYS[round % STRAYS.length];
  const lines = round % 3 === 2 ? t.lines.map(l => l.text) : round % 2 ? [...stray, ...t.lines.map(l => l.text)] : [...t.lines.map(l => l.text), ...stray];
  const w = lines.join('\n');
  let e; try { e = stepEvidence(q, '', w, { correct: false }); } catch { continue; }
  pages++;
  if (stored(e.partial) !== redo(q, w, e.stepReport)) { before++; if (process.env.DBG && before < 3) console.log(id, JSON.stringify(w), stored(e.partial).slice(0, 200), redo(q, w, e.stepReport).slice(0, 200)); }
  if (stored(e.partial) !== redo(q, w, e.markingReport ?? e.stepReport)) after++;
  if (e.markingReport) { withField++; if (stored(e.partial) === redo(q, w, e.stepReport)) leak++; if (JSON.stringify(e.markingReport) === JSON.stringify(e.stepReport)) sameReport++; }
  else if ('markingReport' in e) identicalAbsent++;
}
ok(pages >= 1500, `${pages} pages over ${ids.length} generators`);
ok(ids.length === 50, `${ids.length} generators`);
ok(after === 0, `partial recomputed from markingReport ?? stepReport equals the stored partial on every page (${after} mismatches; ${before} with stepReport alone)`);
ok(before > 0, `the displayed report alone does not always reproduce partial (${before} pages), so the field is needed`);
ok(withField > 0 && withField < pages * 0.8 && leak === 0, `the field is present only where the reports differ (${withField} of ${pages}; ${leak} present where the displayed report already reproduced partial)`);
ok(sameReport === 0 && identicalAbsent === 0, 'never present when it equals the displayed report; never a null key');
console.log(`  record: ${pages} pages, mismatches ${before} -> ${after}, markingReport on ${withField}`);

// the field is absent when the two reports are identical
{
  const q = { prompt: 'Simplify $3(x + 2)$.', answerType: 'expression', answer: { expr: '3*x+6' }, difficulty: 2, steps: [] };
  const e = stepEvidence(q, '', '3(x + 2)\n3x + 6', { correct: false });
  ok(!('markingReport' in e), 'an ordinary page carries no markingReport');
}
// nothing the client receives before an attempt is resolved contains the field
{
  const src = (await import('node:fs')).readFileSync(new URL('../platform/practice.js', import.meta.url), 'utf8');
  ok(/const \{ stepReport, partial, markingReport \} = resolved \? counted : \{ stepReport: null, partial: null \};/.test(src), 'an unresolved reply takes no markingReport from the evidence');
  ok(/\.\.\.\(resolved && !invalid && markingReport \? \{ markingReport \} : \{\}\)/.test(src), 'the reply carries it only when resolved and a real attempt');
}
// the page is honest where the two reports differ
{
  const lost = [{ line: 3, key: 'marks.lost.break', vars: { line: 3 } }, { line: 4, key: 'marks.lost.afterBreak', vars: { line: 4, breakLine: 3 } }, { line: 5, key: 'marks.lost.restated', vars: { line: 5 } }, { line: 5, key: 'marks.lost.answer', vars: { line: 5 } }];
  const shownNote = { lines: [{ status: 'ok' }, { status: 'ok' }, { status: 'note' }, { status: 'ok' }, { status: 'ok' }] };
  const shownBreak = { lines: [{ status: 'ok' }, { status: 'ok' }, { status: 'break' }, { status: 'ok' }, { status: 'ok' }] };
  const a = lostMarksForPage({ lost, stepReport: shownNote, markingReport: { lines: [] } });
  ok(a.fromCheckable === true && a.rows.map(r => r.key).join() === 'marks.lost.restated,marks.lost.answer', 'a slip the page shows as a note is not pointed at; the other rows stay');
  const b = lostMarksForPage({ lost, stepReport: shownBreak, markingReport: { lines: [] } });
  ok(b.fromCheckable === false && b.rows.length === 4, 'a slip the page does show keeps its rows');
  const c = lostMarksForPage({ lost, stepReport: shownNote });
  ok(c.fromCheckable === false && c.rows === lost, 'without markingReport nothing changes');
  const SAY = "Method marks are counted from the lines Pri could check against this question's method.";
  ok(en['marks.lost.fromCheckable'] === SAY, 'the English sentence');
  ok(typeof hi['marks.lost.fromCheckable'] === 'string' && hi['marks.lost.fromCheckable'].length > 10 && !/[—–]/.test(en['marks.lost.fromCheckable'] + hi['marks.lost.fromCheckable']), 'the Hindi sentence exists; no em dashes');
}
console.log(`MARKING REPORT RECORD: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
if (fail) process.exit(1);
