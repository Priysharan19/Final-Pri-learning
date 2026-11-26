// Train 8 (R4, display only). The first page pass's prompt-bound recognisers (headings, the restated question, "Given ..." maths, the aim, a method statement and its
// continuation, "Working:") also run on a question of the author's bank (a packed `qbank:` question), under the same truth rules as a generated page: a line is ticked or
// neutral only when every content word and number binds to the question's own prompt; a method line with a claim is checked or stays a note; nothing is ever crossed;
// and the mark, the criteria and the stored report are what they were (a ticked or neutral restatement earns nothing).
//   node server/test/bank-first-pass-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
import fs from 'node:fs';
const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
const QB = await import('../platform/qbankPack.js');
const { buildAnnotatedWorking } = await import('../../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage } = await import('../../client/src/components/markedPageModel.js');
const T = await import('../../client/src/components/markedPageTeacher.js');
const { PAGES } = await import('./support/teacher-page-run.mjs');
const G = await import('../../client/src/engine/generators/index.js'); await G.loadAllBanks();
await QB.ensureQbank(process.env, { strict: true });

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

// ── the owner's velocity page, a bank question ───────────────────────────────
const V = markerView(QB.qbankEntryQuestion('A12-C3-093', 17));
ok(typeof V._bank === 'string', 'the velocity question is a bank question');
const REAL = JSON.parse(fs.readFileSync(new URL('../../client/test/support/teacher-page-real-reports.json', import.meta.url), 'utf8')).pages.key12;
const VL = REAL.lines;
const show = (q, lines, key, opts) => {
  const r = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true }, ...(opts ? { opts } : {}) }, () => {});
  const rep = r?.evidence?.shownReport || r?.evidence?.stepReport;
  const page = buildMarkedPage({ model: buildAnnotatedWorking({ lines, stepReport: rep, page: true }) });
  return { r, rep, page, marks: T.buildTeacherMarks({ page }), tally: T.tallyOf(page) };
};
const st = (o, n) => o.page.lines[n - 1].status;
const cls = (o, n) => o.page.lines[n - 1].card.tickClass;
const v = show(V, VL, '12 m/s');
ok(v.r.result.correct === true, 'velocity: 12 m/s is marked right');
ok(/ 0 not checked\.$/.test(v.tally), `velocity: 0 not checked (${v.tally})`);
ok(v.page.lines.every(l => ['checked', 'condition'].includes(l.status)), `velocity: every line is ticked or neutral (${v.page.lines.map(l => l.status)})`);
ok(cls(v, 1) === 'heading' && cls(v, 2) === 'given-data' && cls(v, 3) === 'restated' && cls(v, 4) === 'method-stated' && cls(v, 5) === 'method-stated' && cls(v, 6) === 'heading', `velocity: lines 1 to 6 are heading, given, aim, method, its continuation, heading (${[1,2,3,4,5,6].map(n => cls(v, n))})`);
ok(v.marks.find(m => m.n === 2)?.phrase === 'Given in the question', 'velocity: the given line says so');
ok(v.page.lines.every(l => l.status !== 'first-error'), 'velocity: nothing is crossed');
ok(v.rep.answerLine === 20, 'velocity: the conclusion is the answer line');

// ── adversarial variants of those lines: none is ticked or neutralised ─────
const swap = (i, t) => VL.map((l, k) => (k === i ? t : l));
const stays = (i, t, label) => { const o = show(V, swap(i, t), '12 m/s'); ok(st(o, i + 1) !== 'checked' && st(o, i + 1) !== 'condition', `${label}: "${t}" is left a note (${st(o, i + 1)}/${cls(o, i + 1)})`); };
stays(1, 'Given v = 12t - 3t^2, 0 <= t <= 5.', 'a changed domain');
stays(1, 'Given v = 12t - 3t^2, 0 <= t <= 4, which is wrong.', 'an extra clause');
stays(1, 'Given v = 12t - 2t^2, 0 <= t <= 4.', 'a changed coefficient');
stays(1, 'Given v = 12t + 3t^2, 0 <= t <= 4.', 'a changed sign');
stays(1, 'Given v = 12t - 3t^2, 0 <= t <= 4, and v decreases.', 'decreases');
stays(1, 'Given v = 12t - 3t^2 and t = 2.', 'an extra value');
stays(2, 'To find the minimum velocity.', 'a different aim');
stays(2, 'To find the maximum acceleration.', 'a different quantity');
stays(3, 'Method: Find the stationary point(s) of v(t) and the answer is 12 using', 'a method with a claim');
stays(3, 'Method: Substitute n = 20 into the given formula.', 'a wrong n in a method');
stays(3, 'Method: Differentiate and set t = 7.', 'a letter set to a number the question never gives');
stays(4, 'dv/dt = 5, and compare with the endpoints t = 0 and t = 4.', 'the derivative set to another value');
stays(4, 'dv/dt = 0, and compare with the endpoints t = 0 and t = 9.', 'a wrong endpoint');
stays(4, 'dv/dt = 0, so the maximum is at t = 2.', 'a claim in the continuation');
stays(4, 'dw/dt = 0, and compare with the endpoints t = 0 and t = 4.', 'the derivative of a letter the question does not have');
// a continuation is only the line straight after a method statement
{ const o = show(V, swap(3, 'Hence compare.'), '12 m/s'); ok(st(o, 4) !== 'condition', 'a method continuation stands only straight after a method statement'); }
{ const lines = VL.slice(); lines.splice(4, 0, 'v = 12t - 3t^2'); const o = show(V, lines, '12 m/s'); ok(!(st(o, 6) === 'condition' && cls(o, 6) === 'method-stated'), 'a line between the method and its continuation breaks the run'); }

// ── the adversarial inputs of #1135, replayed on a bank-shaped question ──────────────
const bankOf = (name, prompt, key) => markerView({ id: `bank-${name}`, contentId: `qbank:T-${name}`, _bank: `T-${name}`, _family: 'qb-t', subtopic: 'qb-t', answerType: 'numeric', type: 'numeric', prompt, answer: { type: 'numeric', value: Number(key) }, totalMarks: 1 });
const SEATS = bankOf('seats', PAGES.seats.prompt, PAGES.seats.key), USERS = bankOf('users', PAGES.users.prompt, PAGES.users.key);
const U = PAGES.users.lines, S = PAGES.seats.lines;
const sw = (L, i, t) => L.map((l, k) => (k === i ? t : l));
const U2 = (i, t) => show(USERS, sw(U, i, t), PAGES.users.key), S2 = (i, t) => show(SEATS, sw(S, i, t), PAGES.seats.key);
const notChecked = (o, n, label) => ok(st(o, n) !== 'checked' && !(st(o, n) === 'condition' && ['method-stated', 'restated', 'defines'].includes(cls(o, n))), `bank replay: ${label} (${st(o, n)}/${cls(o, n)})`);
for (const t of ['Given: Initial users = 815, and the number of users decreases every week.', 'Given: Initial users = 815, and the number of users stays the same every week.', 'Given: Initial users = 815, and the number of users doubles every week, which is impossible.',
  'Given: Initial users = 816, and the number of users doubles every week.', 'Given: Initial users = 815, and the number of users triples every week.', 'Given: Initial users = 815, and the number of users doubles every month.', 'Given: Initial users = 815, and the app is free.']) notChecked(U2(1, t), 2, `users data line "${t}"`);
notChecked(U2(2, 'Method: Use a geometric sequence with common ratio r = 3.'), 3, 'a method claim with the wrong ratio');
notChecked(S2(3, 'Method: Substitute n = 29 into the given formula.'), 4, 'wrong n in a method line');
notChecked(S2(3, 'Method: Substitute n = 20 into the given formula and the answer is 960.'), 4, 'a method line with an extra clause');
notChecked(U2(6, 'x = 4'), 7, 'a bare x = 4');
notChecked(S2(0, 'Number of seats in the first 21 rows'), 1, 'a title with another number');
// the true lines of those pages still read as they do on a generated page
{ const o = show(USERS, U, PAGES.users.key); ok(/ 0 not checked\.$/.test(o.tally) || o.page.lines.every(l => l.status !== 'first-error'), `users as a bank question: nothing crossed (${o.tally})`); }
{ const o = show(SEATS, S, PAGES.seats.key); ok(o.page.lines.every(l => l.status !== 'first-error'), `seats as a bank question: nothing crossed (${o.tally})`); }

// ── marks are unchanged: the pass is display only ──────────────────────────────
for (const [name, q, lines, key] of [['velocity', V, VL, '12 m/s'], ['velocity with a wrong answer', V, VL, '10 m/s'], ['seats', SEATS, S, PAGES.seats.key], ['users', USERS, U, PAGES.users.key], ['users wrong', USERS, U, '13041']]) {
  const on = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const off = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true }, opts: { proved: false } }, () => {});
  ok(JSON.stringify(on.result) === JSON.stringify(off.result), `${name}: the result is identical with the display passes off`);
  ok(JSON.stringify(on.evidence.stepReport) === JSON.stringify(off.evidence.stepReport), `${name}: stepReport is identical`);
  ok(JSON.stringify(on.evidence.partial) === JSON.stringify(off.evidence.partial), `${name}: the partial (method marks) is identical`);
}
// no line is ever crossed by this pass: every break of the displayed report is the marker's own
{ const on = MARKER_OPS.practice({ q: V, answer: '10 m/s', working: VL.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {});
  const sh = on.evidence.shownReport || on.evidence.stepReport, base = on.evidence.stepReport;
  ok(sh.lines.every((l, i) => l.status !== 'break' || base.lines[i]?.status === 'break'), 'a wrong answer: no cross is added by the display pass'); }

if (failures.length) { console.error(`BANK FIRST PASS: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`BANK FIRST PASS: PASS: ${pass} checks`);
