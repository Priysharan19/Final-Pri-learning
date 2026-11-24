// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the GENERIC step-mark rule (server/platform/genericSteps.js)
//
// R4 (marking authority). The rule is a DRAFT: nothing here approves it in the repository, and it never creates an author record. It is approved
// in THIS TEST PROCESS only, by passing an approved list to the functions that take one (the environment is a plain object).
//
//   1. the gates: not approved in the repository; the seven approved per-type digests are unchanged; its own digest over the rule's code and
//      wording; the author-approval machinery lists it only for a record at the current digest; no record exists in docs/marking/author-approvals
//   2. sealing at issue: nothing changes with the repository's list; an approved per-type scheme keeps its question; the rule stamps only an
//      eligible written question worth 2+ marks; a stale digest or an unapproved rule stamps nothing; India is never touched
//   3. paying: the switch, the Prithagoras tier, a stale digest; a wrong or missing final answer never earns N; a correct one is N
//   4. the sweep (tools/generic-steps-sweep.mjs) over every Years 11-12 topic: the invariants (e), the gaming classes (d), the wrong-step pages (c)
//   5. no model, no network, no clock in the rule
//
//   node server/test/generic-solution-steps-check.mjs
// SYNTHETIC: generated questions and scripted working. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as G from '../../client/src/engine/generators/index.js';
import * as R from '../../tools/method-marks-ready.mjs';
import * as AA from '../../tools/author-approvals.mjs';
import * as S from '../../tools/generic-steps-sweep.mjs';
import { GENERIC_ID, GENERIC_TITLE, GENERIC_WORDING, PARAMETERS, genericDigest, genericEligible, genericPlan, authoredLines } from '../platform/genericSteps.js';
import { SCHEMES, APPROVED_SCHEME_TYPES, schemeDigest, schemeMarks, schemePay, isApproved } from '../platform/schemeAward.js';
import { marksPossibleFor } from '../platform/markerOps.js';
import { sealForEdition, bankPolicy, FINAL_ANSWER_MARKING } from '../platform/editionBanks.js';
import { criteriaView } from '../../client/src/components/criteriaTableModel.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await G.loadAllBanks();
const ROOT = new URL('../../', import.meta.url);
const LIST = [{ typeId: GENERIC_ID, digest: genericDigest() }];
const ON_AU = { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' };

// ── 1. the gates ───────────────────────────────────────────────────────────────────────────────────────────────────
ok(!isApproved(GENERIC_ID) && !APPROVED_SCHEME_TYPES.some(a => a.typeId === GENERIC_ID), 'the generic rule is NOT approved in the repository');
const SEVEN = {
  'y11-diff-gradient-plan': 'c9d8465b12841281dec30c8bb4b9bdebef94bb375c47c06e7e4f32838d86865b',
  'y11-diff-power-rule': '892c8bdbf9df8c287f9ed2ed4da9ad244170f0ed27085970c527ba4a6a491a94',
  'y11-poly-evaluate': '752b0bb78307bec0f5a234efc8c69a8713a464081f5b38b1a87ebfe3eec50503',
  'y12-diff-explog': '3d22a090d1a9e2bbbcdf4af4e742d5c7e6600812c0e048222be50f2e9e39be85',
  'y12-diff-rules': '1ad1b2e438c55f503fd39357e4d7f17981edee6820dbdfbadc7638caf33cfeca',
  'y12-trig-evaluate': '8575a4d493aa7c7367da17544e73cf82676b79029ce67e7f45a5185f0986e6a1',
  'y12-trig-extreme': '9e37098253118df9b4ee3f6835251440577c093ade8f29c652106809f6fda786'
};
ok(Object.entries(SEVEN).every(([id, d]) => APPROVED_SCHEME_TYPES.some(a => a.typeId === id && a.digest === d) && schemeDigest(SCHEMES.find(s => s.id === id)) === d), 'the approved per-type digests are the digests the author read (unchanged)');
ok(APPROVED_SCHEME_TYPES.length === 7 && SCHEMES.filter(s => isApproved(s.id)).length === 7, 'exactly the seven approved types are approved');
ok(!SCHEMES.some(s => s.id === GENERIC_ID), 'the generic rule is not one of the per-type schemes');
ok(/^[0-9a-f]{64}$/.test(genericDigest()) && Object.isFrozen(PARAMETERS) && Object.isFrozen(GENERIC_WORDING), 'the digest is a sha256 and the parameters and wording are frozen');
{
  // the digest is over the id, title, wording, parameters and the rule's own source (LF-normalised): recomputed here, and any change to any part moves it
  const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
  const source = fs.readFileSync(new URL('server/platform/genericSteps.js', ROOT), 'utf8').replace(/\r\n/g, '\n');
  const of = o => crypto.createHash('sha256').update(canon({ id: GENERIC_ID, title: GENERIC_TITLE, wording: GENERIC_WORDING, parameters: PARAMETERS, source, ...o })).digest('hex');
  ok(of({}) === genericDigest(), 'the digest is exactly sha256 over the rule\'s id, title, wording, parameters and source');
  ok(of({ source: `${source} ` }) !== of({}) && of({ parameters: { ...PARAMETERS, BARE_VALUE_EVIDENCE: !PARAMETERS.BARE_VALUE_EVIDENCE } }) !== of({}) && of({ wording: { ...GENERIC_WORDING, answer: 'x' } }) !== of({}), 'a change to the code, a parameter or the wording changes the digest');
}
{
  const dir = new URL('docs/marking/author-approvals/', ROOT);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'schema.json');
  ok(files.length === 7 && !files.includes(`${GENERIC_ID}.json`), 'no author record exists for the generic rule in docs/marking/author-approvals (only the seven type records)');
  // the author-approval machinery lists it for a valid record at the current digest, and for nothing else
  const types = AA.allTypes();
  ok(types.some(t => t.id === GENERIC_ID && t.digest === genericDigest()), 'the approval machinery knows the rule\'s id and its current digest');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-generic-approvals-'));
  const rec = (o = {}) => ({ schemaVersion: 1, typeId: GENERIC_ID, digest: genericDigest(), verdict: 'approved', role: 'author (tutor)', approvedBy: 'Priysharan Tripathi', date: '2026-11-24', note: 'ok', ...o });
  const put = r => fs.writeFileSync(path.join(tmp, `${r.typeId}.json`), JSON.stringify(r));
  put(rec());
  ok(AA.approvedTypes(AA.readRecords(tmp), types).length === 1 && AA.renderServer(AA.approvedTypes(AA.readRecords(tmp), types)).includes(GENERIC_ID) && AA.readRecords(tmp).flatMap(r => AA.recordProblems(r, types)).length === 0, 'a record at the current digest, in the author\'s name, lists it');
  put(rec({ digest: 'a'.repeat(64) }));
  ok(AA.approvedTypes(AA.readRecords(tmp), types).length === 0, 'a record at another digest does not');
  put(rec({ approvedBy: 'claude bot' }));
  ok(AA.approvedTypes(AA.readRecords(tmp), types).length === 0 && AA.recordProblems(AA.readRecords(tmp)[0], types).length > 0, 'a record by an automation name does not');
  put(rec({ verdict: 'changes-needed' }));
  ok(AA.approvedTypes(AA.readRecords(tmp), types).length === 0, 'a changes-needed record does not');
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── 2. sealing at issue ────────────────────────────────────────────────────────────────────────────────────────────
const issuable = [];
for (const [gen, d, seed] of [['y12-appdiff', 3, 1], ['y12-appdiff', 3, 2], ['y12-integration', 3, 1], ['me12-trigeq', 3, 1], ['me11-poly', 4, 4], ['y12-financial', 4, 1], ['y12-financial', 2, 1], ['me12-calc', 3, 2], ['y12-series', 3, 2], ['y12-motion', 2, 2]]) {
  const q = G.generateQuestion(gen, d, seed); issuable.push({ gen, d, seed, q: JSON.parse(JSON.stringify({ ...q, _generator: gen })) });
}
const seal = (item, list) => { const c = JSON.parse(JSON.stringify(item.q)); const accepted = sealForEdition(c, { ...bankPolicy('prithagoras'), methodSchemeTypes: list }, item.gen); return { accepted, c }; };
{
  // the repository's own list: no question is stamped by the generic rule (a differential against main's seal)
  const stamped = issuable.filter(i => { const c = JSON.parse(JSON.stringify(i.q)); return sealForEdition(c, bankPolicy('prithagoras'), i.gen) && c._methodScheme === GENERIC_ID; });
  ok(stamped.length === 0, 'with the repository\'s list nothing is stamped by the generic rule');
  const emptied = issuable.every(i => { const { accepted, c } = seal(i, []); return accepted && c._marking === FINAL_ANSWER_MARKING && !('_methodScheme' in c); });
  ok(emptied, 'an empty list seals every question final-answer-only, as main does');
  const eligible = issuable.filter(i => genericEligible(i.q));
  ok(eligible.length >= 8, `${eligible.length} of ${issuable.length} sample questions are eligible (written, worth 2 or more marks)`);
  ok(eligible.every(i => { const { accepted, c } = seal(i, LIST); return accepted && c._methodScheme === GENERIC_ID && !('_marking' in c); }), 'with the rule approved every eligible question is stamped with it and not sealed final-answer-only');
  ok(issuable.every(i => { const { accepted, c } = seal(i, [{ typeId: GENERIC_ID, digest: 'f'.repeat(64) }]); return accepted && c._marking === FINAL_ANSWER_MARKING && !('_methodScheme' in c); }), 'a stale digest stamps nothing');
  ok(issuable.every(i => { const { c } = seal(i, SCHEMES.filter(s => isApproved(s.id)).map(s => ({ typeId: s.id, digest: schemeDigest(s) })).filter(a => a.typeId !== GENERIC_ID)); return c._methodScheme !== GENERIC_ID; }), 'the seven approved types without the rule never stamp it');
  // a one-mark question and an objective question are never stamped
  const one = JSON.parse(JSON.stringify({ ...G.generateQuestion('y11-diff', 1, 1), _generator: 'y11-diff' }));
  ok(marksPossibleFor(one) === 1 && !genericEligible(one), 'a one-mark question is not eligible');
  const mcq = { answerType: 'mcq', difficulty: 3, steps: [{ h: 'a', d: '$x=1$' }, { h: 'b', d: '$x=2$' }] };
  ok(!genericEligible(mcq), 'an objective question is not eligible');
  // India: no allow-list, no seal
  const india = bankPolicy('priyabhata');
  ok(india.marking === null && !('methodSchemeTypes' in india), 'India has no seal and no allow-list: the rule can never be stamped there');
  // a question with an approved per-type scheme keeps that scheme
  const dr = SCHEMES.find(s => s.id === 'y12-diff-rules');
  const qd = R.questionsOfType(dr, { limit: 6 }).find(q => marksPossibleFor(q) === schemeMarks(dr)) ?? R.questionsOfType(dr, { limit: 6 })[0];
  const typed = JSON.parse(JSON.stringify({ ...qd, difficulty: 2, steps: [{ h: 'Differentiate', d: '$y\' = 1$' }, { h: 'Answer', d: '$y\' = 1$' }], _generator: dr.families[0] }));
  const both = [...LIST, { typeId: 'y12-diff-rules', digest: schemeDigest(dr) }];
  const typedCopy = JSON.parse(JSON.stringify(typed)); sealForEdition(typedCopy, { ...bankPolicy('prithagoras'), methodSchemeTypes: both }, dr.families[0]);
  ok(marksPossibleFor(typed) === 2 && typedCopy._methodScheme === 'y12-diff-rules', 'a question of an approved per-type scheme, at the scheme\'s marks, keeps that scheme when the rule is also approved');
  const typed3 = JSON.parse(JSON.stringify({ ...typed, difficulty: 3, steps: [...typed.steps, { h: 'Simplify', d: '$y\' = 1$' }] })); sealForEdition(typed3, { ...bankPolicy('prithagoras'), methodSchemeTypes: both }, dr.families[0]);
  ok(marksPossibleFor(typed3) === 3 && typed3._methodScheme === GENERIC_ID, 'where the approved type\'s scheme is for other marks (it cannot pay), the rule is used');
}

// ── 3. paying ──────────────────────────────────────────────────────────────────────────────────────────────────────
const pay = (q, lines, answer, { env = ON_AU, list = LIST } = {}) => { const m = S.markPage({ ...q, _methodScheme: GENERIC_ID }, lines, answer); return { ...m, again: schemePay({ q: { ...q, _methodScheme: GENERIC_ID }, report: m.ev.stepReport, topic: m.ev.topicTicks ?? null, correct: m.correct, marksPossible: m.N, env, list }) }; };
{
  const item = issuable.find(i => i.gen === 'y12-appdiff' && i.d === 3 && i.seed === 1);
  const q = G.generateQuestion('y12-appdiff', 3, 1);
  const texts = authoredLines(q).map(l => l.text);
  const plan = genericPlan(q);
  ok(plan.marks === 3 && plan.keySteps.length === 2 && plan.keySteps.map(k => k.number).join() === '2,3', 'the greatest-height question: 3 marks, key steps 2 and 3 (the last N-1 usable results before the answer step)');
  const wrongFinal = texts.slice(0, -1).concat('h(6)=1042');
  const a = S.markPage({ ...q, _methodScheme: GENERIC_ID }, wrongFinal, '1042');
  ok(a.pay.paid && a.marks === 2 && a.pay.items.filter(i => i.awarded).length === 2 && !a.pay.items.find(i => i.key === 'answer').awarded, 'correct method and a wrong final answer: 2 of 3, never 3');
  ok(a.pay.items.filter(i => i.basis === 'lines' && i.awarded).every(i => i.lines.every(n => a.lines[n - 1].status === 'ok')), 'each earned step points at ticked lines');
  const view = criteriaView({ criteria: { typeId: GENERIC_ID, digest: genericDigest(), items: a.pay.items }, mark: { awarded: a.marks, possible: a.N }, cards: a.lines.map((l, i) => ({ n: i + 1, status: l.status === 'ok' ? 'checked' : l.status === 'break' ? 'first-error' : 'unchecked' })), approved: LIST });
  ok(view && view.earned === 2 && view.possible === 3 && view.rows.length === 3, 'the criteria table the page draws adds up to the mark (shown only for the approved digest)');
  ok(criteriaView({ criteria: { typeId: GENERIC_ID, digest: genericDigest(), items: a.pay.items }, mark: { awarded: a.marks, possible: a.N }, cards: [], approved: [] }) === null, 'with no approval the page draws no table');
  const right = S.markPage({ ...q, _methodScheme: GENERIC_ID }, texts, '147');
  ok(right.correct && right.marks === 3 && right.pay.items.every(i => i.awarded), 'a correct final answer earns N, every criterion met');
  const none = S.markPage({ ...q, _methodScheme: GENERIC_ID }, [], '1042');
  ok(none.pay.paid && none.marks === 0, 'a wrong answer with no working earns nothing');
  const blank = S.markPage({ ...q, _methodScheme: GENERIC_ID }, texts.slice(0, -1), '');
  ok(blank.pay.paid && blank.marks === 2 && blank.marks < blank.N, 'a missing final answer with the working earns at most N - 1');
  const restated = S.markPage({ ...q, _methodScheme: GENERIC_ID }, ['h(t) = -3t^2 + 36t + 39', 't >= 0'], '1042');
  ok(restated.pay.paid && restated.marks === 0, 'restating the question earns nothing');
  const crossed = S.markPage({ ...q, _methodScheme: GENERIC_ID }, ['h\'(t) = -6t + 99', ...texts.slice(1)], '1042');
  ok(crossed.lines[0].status !== 'ok' ? !crossed.pay.items.some(i => i.awarded && i.lines.includes(1)) : true, 'a wrongly differentiated first line earns nothing for itself');
  // the gates
  const run = (env, list) => schemePay({ q: { ...q, _methodScheme: GENERIC_ID }, report: a.ev.stepReport, correct: false, marksPossible: 3, env, list });
  ok(run(ON_AU, LIST).paid === true, 'approved, switched on, Prithagoras: it pays');
  ok(run(ON_AU, []).reason === 'type-not-approved' && run(ON_AU, [{ typeId: GENERIC_ID, digest: 'a'.repeat(64) }]).reason === 'type-not-approved', 'unapproved, or approved at another digest: nothing');
  ok(run({ PRI_EDITION: 'prithagoras' }, LIST).reason === 'method-marks-off' && run({ PRI_EDITION: 'prithagoras', PRI_METHOD_MARKS: 'off' }, LIST).paid === false && run({ PRI_EDITION: 'prithagoras', PRI_METHOD_MARKS: 'yes' }, LIST).reason === 'MARKER_POLICY_INVALID', 'the switch unset, off or misspelt: nothing');
  ok(run({ PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' }, LIST).reason === 'generic-author-tier-only' && run({ PRI_METHOD_MARKS: 'on' }, LIST).reason === 'generic-author-tier-only', 'any other edition (India): the rule never pays, even if a question were stamped');
  ok(run({ NODE_ENV: 'production', ...ON_AU }, LIST).paid === true && run({ NODE_ENV: 'production', ...ON_AU, PRI_METHOD_MARKS_EXAMINER_RESULT: 'signed-1' }, LIST).paid === true, 'author-approved tier: in production the switch alone pays and the examiner variable is neither needed nor read');
  ok(schemePay({ q: { ...q }, report: a.ev.stepReport, correct: false, marksPossible: 3, env: ON_AU, list: LIST }).reason === 'not-a-scheme-question', 'a question not stamped with the rule is never paid by it');
  ok(schemePay({ q: { ...q, _methodScheme: GENERIC_ID }, report: a.ev.stepReport, correct: false, marksPossible: 2, env: ON_AU, list: LIST }).reason?.startsWith('criteria-count'), 'a question whose marks are not the rule\'s marks stays on the final answer');
  void item;
}

// ── 4. the sweep ───────────────────────────────────────────────────────────────────────────────────────────────────
const SWEEP_SEEDS = 6;
const SW = await S.runSweep({ seeds: SWEEP_SEEDS });
console.log(S.report(SW));
console.log(`  violations: ${SW.violations.length}, exceptions: ${SW.exceptions.length}`);
for (const v of SW.violations.slice(0, 10)) console.log('  VIOLATION', JSON.stringify(v).slice(0, 500));
for (const e of SW.exceptions.slice(0, 10)) console.log('  EXCEPTION', JSON.stringify(e).slice(0, 700));
console.log(`  coincidences (another question's working that is also true here): ${SW.coincidences.length}`);
for (const e of SW.coincidences.slice(0, 6)) console.log('  COINCIDENCE', JSON.stringify(e).slice(0, 500));
ok(SW.payable >= 300 && SW.a.pages >= 300 && SW.b.pages >= 250 && SW.c.pages >= 300 && SW.c.fromPages >= 300, `the sweep is large enough (${SW.payable} payable questions, ${SW.e.pages} pages)`);
ok(SW.violations.length === 0, `no violation of an invariant or of a "nothing" in (c) and (d): ${SW.violations.length}`);
ok(SW.e.wrongFull === 0 && SW.e.overN === 0 && SW.e.correctNotFull === 0, '(e) a wrong or missing final answer never earns N; never above N; a correct one always N');
ok(SW.e.unticked === 0 && SW.e.afterCross === 0 && SW.e.finalByLines === 0 && SW.e.tableNotMark === 0, '(e) every mark rests on a ticked line before the first crossed line; the answer mark is never earned by working; the table is the mark');
ok(SW.b.wrongTypedAtN === 0 && SW.b.notFull === 0 && SW.b.full === SW.b.pages, '(b) full working with the right answer is N on every page; with a wrong typed answer it is never N');
ok(SW.c.falsifiedEarned === 0 && SW.c.atOrAfterCross === 0 && SW.c.fromEarnedAtOrAfter === 0 && SW.c.fromMarksOverBefore === 0, '(c) a wrong line earns nothing, nothing at or after a crossed line, and a page wrong from step k earns nothing on or after k');
for (const [name, v] of SW.d.classes) ok(v.exceptions === 0, `(d) ${name}: ${v.exceptions} exceptions of ${v.pages} pages (must be 0)`);
for (const need of ['restate-the-question', 'given-numbers', 'irrelevant-true-arithmetic', 'irrelevant-true-arithmetic-outside-the-question', 'lines-no-check-can-read', 'naming-a-formula', 'bare-intermediate-value-alone', 'bare-intermediate-value-after-earlier-lines', 'same-value-other-operations', 'lines-after-the-first-crossed-line', 'numbers-of-the-solution-without-working', 'another-questions-working']) ok((SW.d.classes.get(need)?.pages ?? 0) >= 100, `(d) the class "${need}" was exercised on at least 100 pages`);
ok((SW.d.classes.get('bare-intermediate-value-alone')?.earned ?? 1) === 0, 'a bare intermediate value with no line before it earns nothing (the page does not tick it)');
ok((SW.d.classes.get('bare-intermediate-value-after-earlier-lines')?.bareEarnedItsOwnStep ?? 0) >= 5, 'a bare value after earlier lines the page recognised can earn its own step (BARE_VALUE_EVIDENCE) and no other');
ok(SW.exceptions.length === 0, `no gamed page earned a mark (${SW.exceptions.length} exceptions)`);
ok(SW.coincidences.length <= 6 && (SW.d.classes.get('another-questions-working')?.pages ?? 0) >= 300, `another question's working earns nothing except where its line is also true here (${SW.coincidences.length} coincidences, each printed above)`);
const dist = [...SW.a.dist].map(([k, v]) => `${k}:${v}`).join(' ');
console.log(`  (a) distribution of marks with only the final line wrong: ${dist}`);

// ── 5. no model, no network, no clock ──────────────────────────────────────────────────────────────────────────────
{
  const src = fs.readFileSync(new URL('server/platform/genericSteps.js', ROOT), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/fetch\(|XMLHttpRequest|Date\.now|new Date|Math\.random|process\.env|setTimeout|setInterval|openai|anthropic|interpretAfterStepCheck|reportWithInterpretation/i.test(src), 'the rule reads no clock, no random number, no environment, no network and no interpreter');
  const pr = fs.readFileSync(new URL('server/platform/practice.js', ROOT), 'utf8');
  ok(!/genericSteps|GENERIC_ID/.test(pr), 'practice.js is unchanged: the rule is reached only through schemePay');
}

if (failures.length) { console.error(failures.join('\n')); console.error(`GENERIC SOLUTION STEPS: FAIL (${failures.length})`); process.exit(1); }
console.log(`GENERIC SOLUTION STEPS: PASS: ${pass} checks`);
