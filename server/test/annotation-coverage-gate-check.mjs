// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pri Learning · the annotation-coverage gate (Prithagoras edition, NSW Years 11-12 Advanced and Extension 1)
//
// Owner rule (26 Nov 2026): every question must support full step-by-step annotated marking, and no new question may be added unless it has that.
// tools/annotation-coverage.mjs measures it (docs/marking/annotation-coverage.md says what "covered" means). This gate holds the line:
//
//   a. every generator form and every bank part that is NOT on the committed baseline (server/test/fixtures/annotation-coverage/baseline.json) must be
//      fully covered; one that is not FAILS, with its id and the first line at issue;
//   b. the baseline may only shrink and is exact: a baseline id that has become covered must be removed (fails until it is), a baseline id whose
//      status moved or that no longer exists must be refreshed, and, given the branch this one merges into (--base-sha), no id may join the list;
//   c. the importer (tools/qbank-import.mjs compileWithLineHold) holds, with the reason "not line-markable", any part that is not on the baseline
//      and not fully covered, instead of packing it.
// It also proves itself: a planted uncovered new question and a planted baseline addition each fail, and a planted covered id left on the list fails.
//
//   node server/test/annotation-coverage-gate-check.mjs                          measure everything and hold the baseline (about 25 s)
//   node server/test/annotation-coverage-gate-check.mjs --ratchet-only --base-sha <sha>   only: no id joined the baseline since <sha> (no measuring)
//
// No marking code is touched by this suite. Refresh a baseline that moved with: node tools/annotation-coverage.mjs --write
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = await import('../../tools/annotation-coverage.mjs');
const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const done = () => {
  if (failures.length) {
    console.error(`ANNOTATION COVERAGE GATE: FAIL (${failures.length})`);
    for (const f of failures.slice(0, 60)) console.error('  ' + f);
    if (failures.length > 60) console.error(`  ... and ${failures.length - 60} more`);
    console.error('The rule: a question not on the baseline must be fully covered; the baseline only shrinks. See docs/marking/annotation-coverage.md.');
    process.exit(1);
  }
};

const baseline = A.loadBaseline();

// ── the ratchet against the branch this one merges into ─────────────────────
function baselineAt(sha) {
  const rel = path.relative(ROOT, A.BASELINE_FILE).split(path.sep).join('/');
  try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore', cwd: ROOT }); } catch { execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], { stdio: 'inherit', cwd: ROOT }); }
  try { return JSON.parse(execFileSync('git', ['show', `${sha}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], cwd: ROOT, maxBuffer: 1 << 28 })); } catch { return null; }
}
const baseSha = (flag('base-sha') || '').trim();
if (baseSha) {
  const base = baselineAt(baseSha);
  if (!base) console.log(`annotation baseline: ${baseSha.slice(0, 9)} has none (the branch that introduces it): nothing to ratchet against`);
  else {
    const grew = A.ratchetViolations(baseline, base);
    ok(grew.length === 0, `the baseline grew since ${baseSha.slice(0, 9)}: ${grew.slice(0, 12).map(v => v.id).join(', ')}${grew.length > 12 ? `, and ${grew.length - 12} more` : ''}`);
    console.log(`annotation baseline: ${Object.keys(baseline.ids).length} ids now, ${Object.keys(base.ids).length} at ${baseSha.slice(0, 9)}; ${grew.length} joined`);
  }
}
if (argv.includes('--ratchet-only')) {
  if (!baseSha) { console.error('--ratchet-only needs --base-sha'); process.exit(2); }
  done();
  console.log(`ANNOTATION COVERAGE RATCHET: PASS: ${pass} checks`);
  process.exit(0);
}

// ── the real measure ─────────────────────────────────────────────────────────
const t0 = Date.now();
const records = await A.measureAll();
const seconds = Math.round((Date.now() - t0) / 1000);
const summary = A.summarise(records);
const gen = records.filter(r => r.kind === 'generated'), bank = records.filter(r => r.kind !== 'generated');
ok(gen.length > 1000 && bank.length > 4000, `the scope is measured: ${gen.length} generated forms, ${bank.length} bank parts`);
// a multiple-choice question has no working page: not-applicable, counted on its own, in no denominator and on no baseline
const na = records.filter(r => r.status === A.STATUS.notApplicable);
ok(na.length > 0 && na.every(r => ['mcq', 'multi-mcq', 'matrix-match'].includes(r.answerType)), `every not-applicable unit is a multiple-choice question (${na.length})`);
ok(records.filter(r => ['mcq', 'multi-mcq', 'matrix-match'].includes(r.answerType)).every(r => r.status === A.STATUS.notApplicable), 'every multiple-choice unit is not-applicable');
ok(summary.notApplicable.multipleChoice === na.length && summary.total.total === records.length - na.length, `the summary counts them apart (${summary.notApplicable.multipleChoice}) and leaves them out of the ${summary.total.total} units`);
ok(na.every(r => baseline.ids[r.id] === undefined), 'no not-applicable unit is on the baseline');
ok(A.compareToBaseline([na[0]], { ...baseline, ids: {} }).length === 0 && A.compareToBaseline([na[0]], { ...baseline, ids: { [na[0].id]: 'u0' } }).some(x => x.kind === 'now-covered'), 'a not-applicable unit passes as new, and fails if left on the baseline');
ok(new Set(records.map(r => r.id)).size === records.length, 'every unit id is unique');

// a, b: against the baseline
const violations = A.compareToBaseline(records, baseline);
for (const v of violations) failures.push(`${v.kind}: ${v.message}`);
pass += violations.length === 0 ? 1 : 0;

// the committed summary says what was measured (counts only: the causes and examples refresh with --write)
const committed = JSON.parse(fs.readFileSync(A.SUMMARY_FILE, 'utf8'));
for (const k of ['total', 'full', 'trueOnly', 'uncovered']) ok(committed.total[k] === summary.total[k], `the committed summary says ${k} ${committed.total[k]}, measured ${summary.total[k]}: node tools/annotation-coverage.mjs --write`);
ok(Object.keys(baseline.ids).length === summary.total.trueOnly + summary.total.uncovered, `the baseline lists every unit that is not fully covered (${Object.keys(baseline.ids).length} listed, ${summary.total.trueOnly + summary.total.uncovered} measured)`);
ok(fs.statSync(A.BASELINE_FILE).size < 500 * 1024, 'the committed baseline stays under 500 kB (id, status and cause only)');
ok(fs.statSync(A.SUMMARY_FILE).size < 500 * 1024, 'the committed summary stays under 500 kB');

// ── it proves itself ─────────────────────────────────────────────────────────
// 1. a planted NEW question whose worked solution cannot be marked line by line: measured by the real path, then judged against the real baseline.
{
  const planted = { subtopic: 'y12-planted', seed: 1, difficulty: 2, prompt: 'Solve $x > 2$ and find the least whole number.', answerType: 'numeric', answer: { value: 3 }, steps: [{ h: 'Set up', d: '$x > 2$' }, { h: 'Least whole number', d: '$x = 3$' }], hints: ['a', 'b'] };
  const m = A.measureQuestion(A.markerViewOf({ ...planted, _marking: 'final-answer-only' }), { toPlain: A.genToPlain });
  const rec = { id: 'gen:y12-planted:d2:0000000', kind: 'generated', status: m.t.ok && m.w.ok ? A.STATUS.full : m.t.ok ? A.STATUS.trueOnly : A.STATUS.uncovered, t: m.t, w: m.w };
  ok(rec.status !== A.STATUS.full, `the planted question is not fully covered (it is ${rec.status}: ${A.causeOf(rec)})`);
  const v = A.compareToBaseline([rec], { ...baseline, ids: {} });
  ok(v.length === 1 && v[0].kind === 'new-uncovered' && v[0].id === rec.id && /first line at issue/.test(v[0].message), `a planted uncovered new question fails the gate with its id and line: ${JSON.stringify(v.map(x => x.message))}`);
  ok(A.compareToBaseline([rec], { ...baseline, ids: { [rec.id]: `${A.SHORT[rec.status]}0` } }).length === 0, 'the same question passes when it is on the baseline (grandfathered)');
}
// 2. the real records: a fully covered one, treated as new, passes; an uncovered one treated as new fails
{
  const full = records.find(r => r.status === A.STATUS.full), open = records.find(r => r.status === A.STATUS.uncovered);
  ok(!!full && !!open, 'the measure holds both a fully covered and an uncovered unit');
  ok(A.compareToBaseline([full], { ...baseline, ids: {} }).length === 0, 'a fully covered new unit passes');
  const v = A.compareToBaseline([open], { ...baseline, ids: {} });
  ok(v.length === 1 && v[0].kind === 'new-uncovered' && v[0].message.includes(open.id), 'an uncovered new unit fails with its id');
  // a covered id left on the baseline fails until it is removed
  const stale = A.compareToBaseline([full], { ...baseline, ids: { [full.id]: 'u0' } });
  ok(stale.length === 1 && stale[0].kind === 'now-covered', 'an id that became covered must leave the baseline');
  const moved = A.compareToBaseline([open], { ...baseline, ids: { [open.id]: 't0' } });
  ok(moved.length === 1 && moved[0].kind === 'status-moved', 'an id whose status moved must be refreshed');
  ok(A.compareToBaseline([], { ...baseline, ids: { 'gen:gone:d1:0000000': 'u0' } }).some(x => x.kind === 'gone'), 'an id the measure no longer finds must leave the baseline');
}
// 3. a baseline addition fails the ratchet; a shrink does not
{
  const ids = Object.keys(baseline.ids);
  const shrunk = { ...baseline, ids: Object.fromEntries(ids.slice(1).map(i => [i, baseline.ids[i]])) };
  const grew = A.ratchetViolations(baseline, shrunk);
  ok(grew.length === 1 && grew[0].kind === 'baseline-grew' && grew[0].id === ids[0], 'a baseline addition fails the ratchet');
  ok(A.ratchetViolations(shrunk, baseline).length === 0, 'a baseline that shrank passes the ratchet');
  ok(A.ratchetViolations(baseline, baseline).length === 0, 'an unchanged baseline passes the ratchet');
}
// 4. the importer holds a new part that is not line-markable, packs one on the baseline, and says why
{
  const { compileWithLineHold, NOT_LINE_MARKABLE } = await import('../../tools/qbank-import.mjs');
  const { fixtureArchive } = await import('./support/qbank-fixture.mjs');
  const held = await compileWithLineHold(fixtureArchive(), { lineBaseline: { ...baseline, ids: {} } });
  ok(NOT_LINE_MARKABLE === 'not line-markable', 'the importer hold reason is "not line-markable"');
  ok(held.held.length > 0 && held.rejects.filter(r => r.reasons.some(x => x.endsWith(NOT_LINE_MARKABLE))).length === held.held.length, `the importer holds new parts that are not fully covered (${held.held.length} of the fixture), each with the reason`);
  const every = Object.fromEntries(held.held.map(h => [h.id, 'u0']));
  const grand = await compileWithLineHold(fixtureArchive(), { lineBaseline: { ...baseline, ids: every } });
  ok(grand.held.length === 0 && grand.summary.questions === 10 && grand.summary.manualQuestions === 1, 'the importer packs the same parts when the baseline grandfathers them (ten questions and one worked solution)');
  ok(held.summary.questions + held.summary.manualQuestions === 11 - held.held.length, 'a held part is out of the pack, every other part is in it');
}

// ── the wrong half is required of every question: a planted new question whose only possible mutation is a self-false one (rung b) ──────────────────────
{
  const mk = (steps, value) => A.markerViewOf({ prompt: 'Calculate the value.', answerType: 'numeric', answer: { value }, steps: steps.map(d => ({ h: 'Step', d: '$' + d + '$' })), marks: 2, _marking: 'final-answer-only' });
  // (1) nothing can be planted on the line above (no operation on it gives the line), so the only mutation is a self-false one, rung b: it is tried, and crossed
  const good = mk(['a=9-3=6', 'b=6*4=24', 'b=24'], 24);
  const mg = A.measureQuestion(good, { toPlain: A.genToPlain });
  ok(A.chooseMutantLine(mg.lines)?.rung === 'b', 'a planted question with no operation to plant on takes the self-false rung (b)');
  ok(mg.w.ok === true && mg.w.mutants.every(x => x.verdict === 'crossed here'), 'its self-false mutants are crossed at the line');
  // (2) the same kind of question whose self-false mutant the marker leaves unjudged (a function value at another argument): the wrong half FAILS it, so the
  // gate refuses a new question like it (not on the baseline, not fully covered)
  const bad = mk(['f(x)=3x+1', 'f(2)=3(2)+1=7', 'f(2)=7'], 7);
  const mb = A.measureQuestion(bad, { toPlain: A.genToPlain });
  ok(A.chooseMutantLine(mb.lines)?.rung === 'b' && mb.w.ok === false && /^wrong step/.test(mb.w.cause), `a planted question whose self-false mutant is not crossed fails its wrong half (${mb.w.cause})`);
  const planted = { id: 'planted:self-false', kind: 'bank', answerType: 'numeric', status: A.STATUS.trueOnly, t: { ...mb.t, ok: true }, w: mb.w };
  const refused = A.compareToBaseline([planted], { ...baseline, ids: {} });
  ok(refused.length === 1 && refused[0].kind === 'new-uncovered' && /wrong step/.test(refused[0].message), 'the gate refuses a new question whose wrong half fails: the self-false mutation must be crossed');
  // (3) a worked solution with no maths line has no wrong half to test: it is not covered, and never excused
  const mw = A.measureQuestion({ ...mk([], 1), steps: [{ h: 'Reason', d: 'Because the function is increasing.' }] }, { toPlain: A.genToPlain });
  ok(mw.w.ok === false && mw.lines.length === 0, 'a worked solution with no maths line has no wrong half: not covered, not excused');
}

console.log(`annotation coverage: ${summary.total.total} units (${gen.length - na.length} generated forms, ${bank.length} bank parts) measured in ${seconds} s; fully covered ${summary.total.full}, true half only ${summary.total.trueOnly}, uncovered ${summary.total.uncovered}; baseline ${Object.keys(baseline.ids).length} ids`);
console.log(`annotation coverage not applicable: ${na.length} multiple-choice questions (no working page), in no denominator and on no baseline`);
done();
console.log(`ANNOTATION COVERAGE GATE: PASS: ${pass} checks`);
