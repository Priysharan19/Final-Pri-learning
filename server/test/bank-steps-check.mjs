// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the BANK step-mark rule (server/platform/bankSteps.js), a DRAFT
//
// R4 (marking authority). The rule pays step marks on the author's own question bank from HIS marking criteria, decided only by the
// deterministic engine. It is NOT approved: the author has filed no record for `bank-author-criteria`, so in the repository it pays nothing.
// This suite never creates an author record; it approves the rule IN THIS TEST PROCESS ONLY, by passing a list.
//
//   1. the gates: not approved in the repository; its own digest; the approval machinery lists it only for a record at the current digest;
//      the generic rule's approved digest is unchanged by it
//   2. sealing at issue, over the committed pack: unapproved, no bank question is stamped; approved in the test list, exactly the parts that
//      passed the import-time proof are; a worked-solution question and a stale digest stamp nothing
//   3. paying: the Prithagoras tier, the switch, a stale digest, the one-try modes, the unstamped question; a wrong answer never earns N;
//      the table lists HIS criteria in his words; a correct answer is N
//   4. the import-time proof over every part of the pack (printed numbers pinned) and the sweep (tools/bank-steps-sweep.mjs): every hard
//      assertion, zero violations
//   5. no model, no network, no clock in the rule
//
//   node server/test/bank-steps-check.mjs
// SYNTHETIC: the author's own bank and scripted working. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.env.PRI_EDITION = 'prithagoras';
const { checks } = await import('./support/app-harness.mjs');
const qb = await import('../platform/qbankPack.js');
const { BANK_ID, bankDigest, bankPlan, bankEligible, bankStructural, bankAuthoredLines, stepsMatching, PARAMETERS } = await import('../platform/bankSteps.js');
const { GENERIC_ID, genericDigest } = await import('../platform/genericSteps.js');
const { isApproved, approvedSchemeTypes, schemePay, stepMarksOpen } = await import('../platform/schemeAward.js');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { marksPossibleFor } = await import('../platform/markerOps.js');
const { allTypes, readRecords } = await import('../../tools/author-approvals.mjs');
const { bankStepProofs } = await import('../../tools/qbank-import.mjs');
const sweep = await import('../../tools/bank-steps-sweep.mjs');

// The numbers printed by `node tools/qbank-import.mjs --bank-steps` and `node tools/bank-steps-sweep.mjs` on the committed pack. A new pack changes them on purpose.
const PIN = { parts: 1294, eligible: 174, verifiable: 183, notVerified: 48, sweepPages: 3625 };

const c = checks();
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
await qb.ensureQbank(process.env, { strict: true });

// ── 1. the gates ────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const records = readRecords();
  c.ok(!records.some(r => r.record.typeId === BANK_ID) && !fs.existsSync(path.join(ROOT, 'docs/marking/author-approvals', `${BANK_ID}.json`)), 'the author has filed no record for the bank rule: it is a draft');
  c.ok(!approvedSchemeTypes().some(a => a.typeId === BANK_ID), 'the repository\'s own approved list does not name the bank rule');
  c.match(bankDigest(), /^[0-9a-f]{64}$/, 'the bank rule has its own sha256 digest over its code and wording');
  c.ok(bankDigest() !== genericDigest(), 'it is not the generic rule\'s digest');
  c.ok(allTypes().some(t => t.id === BANK_ID && t.digest === bankDigest()), 'the approval machinery knows the bank id at the digest the code computes today');
  c.ok(!isApproved(BANK_ID, []) && isApproved(BANK_ID, [{ typeId: BANK_ID, digest: bankDigest() }]) && !isApproved(BANK_ID, [{ typeId: BANK_ID, digest: 'f'.repeat(64) }]), 'approved only for a record at the current digest, never at a stale one');
  c.ok(!isApproved(BANK_ID, [{ typeId: GENERIC_ID, digest: genericDigest() }]), 'the generic rule\'s approval is not the bank rule\'s');
  const generic = records.find(r => r.record.typeId === GENERIC_ID);
  c.eq(generic.record.digest, genericDigest(), 'the generic rule is still at the digest the author approved (genericSteps.js is not edited)');
}

// ── 2. sealing at issue, over the committed pack ──────────────────────────────────────────────────────────────────────────
const entries = qb.qbankEntries();
const served = id => JSON.parse(JSON.stringify(qb.qbankEntryQuestion(id, 17)));
const prit = bankPolicy('prithagoras');
const approvedList = [{ typeId: BANK_ID, digest: bankDigest() }];
let eligibleIds = [];
{
  const repo = { ...prit, methodSchemeTypes: approvedSchemeTypes() };
  const tests = { ...prit, methodSchemeTypes: approvedList };
  const stale = { ...prit, methodSchemeTypes: [{ typeId: BANK_ID, digest: '0'.repeat(64) }] };
  let unsealed = 0, repoStamped = 0, testStamped = 0, staleStamped = 0, sealedWhenNot = 0, notEligibleStamped = 0, multi = 0;
  for (const { entry } of entries) {
    const q = served(entry.id); q._generator = q.subtopic;
    const q2 = served(entry.id); q2._generator = q2.subtopic;
    const q3 = served(entry.id); q3._generator = q3.subtopic;
    if (!(sealForEdition(q, repo) && sealForEdition(q2, tests) && sealForEdition(q3, stale))) unsealed++;
    if (q._methodScheme !== undefined) repoStamped++;
    if (q3._methodScheme !== undefined) staleStamped++;
    if (entry.marks >= 2) multi++;
    if (q2._methodScheme === BANK_ID) { testStamped++; eligibleIds.push(entry.id); if (!bankEligible(q2)) notEligibleStamped++; }
    else if (q2._marking === FINAL_ANSWER_MARKING) sealedWhenNot++;
  }
  c.eq(unsealed, 0, 'every bank question seals');
  c.eq(repoStamped, 0, 'with the repository\'s own list no bank question is stamped with the rule');
  c.eq(staleStamped, 0, 'with the rule at a stale digest no bank question is stamped');
  c.eq(notEligibleStamped, 0, 'a part that did not pass the import-time proof is never stamped');
  c.eq(testStamped + sealedWhenNot, entries.length, 'with the rule approved in the test list every question is either stamped or sealed final-answer-only');
  c.eq(testStamped, PIN.eligible, `with the rule approved in the test list exactly the ${PIN.eligible} proved parts are stamped`);
  c.eq(multi, PIN.parts, `of ${PIN.parts} parts worth two or more marks`);
  const worked = qb.qbankManualEntries();
  c.ok(worked.length > 0, 'the pack holds worked-solution questions');
  let workedStamped = 0;
  for (const { entry } of worked) { const q = JSON.parse(JSON.stringify(qb.qbankManualQuestion(entry.id, 17))); q._generator = q.subtopic; sealForEdition(q, tests); if (q._methodScheme !== undefined) workedStamped++; }
  c.eq(workedStamped, 0, 'a worked-solution question is never stamped');
}

// ── 3. paying ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const ENV = sweep.ENV, LIST = sweep.LIST;
{
  const parts = sweep.eligibleParts();
  c.eq(parts.length, PIN.eligible, 'the sweep sees the same eligible parts');
  const pick = parts.find(p => bankPlan(p.q).specs.filter(s => s.live).length >= 2) || parts[0];
  const q = pick.q, N = marksPossibleFor(q);
  const texts = bankAuthoredLines(q).map(l => l.text);
  const wrong = sweep.markPage(q, texts, '99991');
  c.ok(wrong.pay.paid && wrong.marks >= 1 && wrong.marks <= N - 1, 'a wrong answer with his working earns at least one mark and never N');
  c.deq(wrong.pay.items.map(i => i.text), q.criteria.map(x => x.point), 'the table lists HIS criteria, in his order and his words');
  c.eq(wrong.pay.items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0), wrong.marks, 'the table equals the marks');
  c.ok(wrong.pay.items.filter(i => i.awarded && i.basis === 'lines').every(i => i.lines.length === 1), 'each earned criterion names its line');
  const right = sweep.markPage(q, texts, require_accepted(q));
  c.eq(right.marks, N, 'his working with the right answer is N');
  const report = wrong.ev.stepReport;
  const pay = (over = {}) => schemePay({ q, report, correct: false, marksPossible: N, env: ENV, list: LIST, ...over });
  c.ok(pay().paid === true, 'approved in the list, the switch on, Prithagoras: it pays');
  c.eq(pay({ env: { PRI_EDITION: 'prithagoras' } }).reason, 'method-marks-off', 'without PRI_METHOD_MARKS=on it pays nothing');
  c.eq(pay({ env: { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' } }).reason, 'bank-author-tier-only', 'India is never touched');
  c.eq(pay({ list: [{ typeId: BANK_ID, digest: '1'.repeat(64) }] }).reason, 'type-not-approved', 'a stale digest pays nothing');
  c.eq(pay({ list: approvedSchemeTypes() }).reason, 'type-not-approved', 'with the repository\'s own list it pays nothing');
  for (const mode of ['rush', 'match', 'placement']) c.eq(schemePay({ q: { ...q, _practiceMode: mode }, report, correct: false, marksPossible: N, env: ENV, list: LIST }).reason, 'mode-final-answer-only', `${mode} stays on the final answer`);
  c.ok(schemePay({ q: { ...q, _practiceMode: 'practice' }, report, correct: false, marksPossible: N, env: ENV, list: LIST }).paid === true, 'practice pays');
  c.eq(schemePay({ q: { ...q, _methodScheme: undefined }, report, correct: false, marksPossible: N, env: ENV, list: LIST }).reason, 'not-a-scheme-question', 'an unstamped question is not a scheme question');
  c.eq(pay({ marksPossible: N + 1 }).paid, false, 'a question whose marks are not the rule\'s stays on the final answer');
  c.eq(stepMarksOpen({ q, env: ENV, list: LIST }), true, 'the device is told step marks are open only when the stamp is approved and the switch is on');
  c.eq(stepMarksOpen({ q, env: ENV, list: [] }), false, 'and not otherwise');
  const done = schemePay({ q, report, correct: true, marksPossible: N, env: ENV, list: LIST });
  c.ok(done.paid && done.awarded === N && done.items.every(i => i.awarded), 'a correct final answer is N, every criterion met');
}
function require_accepted(q) { return q.answerType === 'numeric' ? String(q.answer.value) : q.answerType === 'expression' ? q.answer.expr : q.answerType === 'set' ? q.answer.values.join(', ') : q.answerType === 'point' ? `(${q.answer.x}, ${q.answer.y})` : q.answerType === 'equation' ? `${q.answer.lhs} = ${q.answer.rhs}` : q.answer.region; }

// ── 4. the proof over the pack, and the sweep ───────────────────────────────────────────────────────────────────────────
{
  qb.installPack(await qb.loadPack(qb.directorySource(qb.DEFAULT_PACK_DIR)));
  const { rows, summary } = bankStepProofs();
  c.eq(summary.parts, PIN.parts, `${PIN.parts} parts worth two or more marks`);
  c.eq(summary.eligible, PIN.eligible, `${PIN.eligible} are eligible`);
  c.eq(summary.verifiable, PIN.verifiable, `${PIN.verifiable} of his criteria on them are verifiable`);
  c.eq(summary.notVerified, PIN.notVerified, `${PIN.notVerified} are not verified (manual, a given, the answer itself, an inequality, no matching step, or not earned by his own steps)`);
  c.eq(Object.values(summary.reasons).reduce((a, b) => a + b, 0), summary.parts - summary.eligible, 'every part that is not eligible has a listed reason');
  c.ok(rows.filter(r => r.eligible).every(r => r.criteria.some(k => k.live) && r.criteria.filter(k => k.kind === 'answer').every(k => !k.live)), 'an eligible part has a verifiable criterion and its answer criterion is never one');
  const R = sweep.runSweep();
  console.log(sweep.report(R));
  c.eq(R.parts, PIN.eligible, 'the sweep covers every eligible part');
  c.eq(R.pages, PIN.sweepPages, `the sweep marked ${PIN.sweepPages} pages`);
  c.eq(R.violations.length, 0, `no violation: ${JSON.stringify(R.violations.slice(0, 3))}`);
  c.eq(R.exceptions.length, 0, 'no gamed page earned a mark');
  c.eq(R.g.wrongFull + R.g.overN + R.g.correctNotFull + R.g.unticked + R.g.afterCross + R.g.answerByWorking + R.g.tableNotMark + R.g.notPaid, 0, 'every invariant holds on every page');
  c.eq(R.c.afterWrong, 0, 'nothing is earned at or after a wrong middle line');
  c.eq(R.b.wrongAtN, 0, 'a wrong typed answer is never N, whatever the working');
  c.eq(R.b.full, R.b.fullPages, 'his lines with the right answer are N on every part');
  c.ok(R.c.marks <= R.c.ideal, 'with one middle line wrong no page earns more than the lines before it');
  c.eq(R.f.atN, 0, 'a trap answer is never N');
  c.eq(R.e.aloneEarned, 0, 'a bare intermediate value alone earns nothing');
  for (const [k, v] of R.byClass) c.eq(v.exceptions, 0, `gaming class ${k}: no exception`);
  qb.resetQbank();
}

// ── matching rule (b), strict and deterministic ──────────────────────────────────────────────────────────────────────────
{
  const steps = [{ h: 'Product rule', d: '$x$' }, { h: 'Chain', d: 'Apply the chain rule to the root' }, { h: 'Solve', d: '$x=2$' }, { h: 'Solve again', d: '$x=3$' }];
  c.deq(stepsMatching('Product rule', steps), [0], 'a point equal to a heading matches that step');
  c.deq(stepsMatching('Chain rule', steps), [1], 'a heading that is a run of the point matches');
  c.deq(stepsMatching('Solve', steps), [2, 3], 'two steps match: ambiguous (the criterion is then not verified)');
  c.deq(stepsMatching('Differentiate the root', steps), [], 'no match: not verified');
  c.deq(stepsMatching('', steps), [], 'an empty point matches nothing');
  c.eq(PARAMETERS.MIN_MARKS, 2, 'the rule applies from two marks');
  c.eq(bankStructural({ _bank: 'x', answerType: 'manual', criteria: [{ marks: 2, point: 'p' }], steps: [], authoredMarks: 2 }), false, 'a worked-solution question is not structural');
}

// ── 4a. the bank's own reading never turns his TeX into a different mathematical statement (review of PR #1121): each is read correctly or left unread ──────────
{
  const { withBankReading, spanToPlain } = (await import('../../client/src/engine/solutionMatch.js'))._internals;
  const rd = t => withBankReading(() => spanToPlain(t));
  const cases = [
    ['a\\tan\\tfrac{\\pi}{4}=2', 'a*tan(((π)/4))=2'], ['y=a\\sin x', 'y=a*sin(x)'], ['2e-3', '2*e-3'], ['\\cos\\pi t', 'cos(π*t)'], ['\\ln e^{5}', 'ln(e^(5))'],
    ['\\sin x\\sin(2m+1)x', null], ['\\sin x!', null], ['\\sin^{-1}x', 'arcsin(x)'], ['3e-2x', '3*e-2x']
  ];
  for (const [tex, want] of cases) c.eq(rd(tex), want, `the bank reads ${tex} as ${want === null ? 'nothing (unread)' : want}`);
}

// ── 4b. an authoring fault is held, never crossed: his step disagrees with his own answer (X12-C2-053: the step has no +C, his answer has it) ──────
{
  const { BANK_AUTHORING_FAULTS, bankFault, holdFaultCrosses } = await import('../platform/bankFaults.js');
  const { bankGenericEligible } = await import('../platform/bankGenericSteps.js');
  const { stepEvidence } = await import('../platform/markerOps.js');
  const { checkBankAnswer } = await import('../platform/qbankMarking.js');
  const { withBankReading } = (await import('../../client/src/engine/solutionMatch.js'))._internals;
  qb.installPack(await qb.loadPack(qb.directorySource(qb.DEFAULT_PACK_DIR)));
  c.ok(Object.keys(BANK_AUTHORING_FAULTS).length >= 1 && Object.values(BANK_AUTHORING_FAULTS).every(f => typeof f.why === 'string' && f.why.length > 20 && typeof f.line === 'string'), 'each held question carries its reason');
  for (const id of Object.keys(BANK_AUTHORING_FAULTS)) {
    const q = qb.qbankEntryQuestion(id, 17);
    c.ok(bankFault(q) !== null && bankFault({ ...q, _bank: undefined }) === null, `${id} is held by its own id alone`);
    c.eq(bankPlan(q).eligible, false, `${id}: the bank rule does not pay a held question`);
    c.eq(bankPlan(q).why, 'authoring-fault', `${id}: and says why`);
    c.eq(bankGenericEligible(q), false, `${id}: nor does the generic rule applied to the bank`);
    // the page he wrote, as the bank reads it and as a student's own page is read: no line is crossed, with a wrong or a right typed answer
    const lines = bankAuthoredLines(q).map(l => l.text);
    c.ok(lines.length >= 2, `${id}: his page has ${lines.length} lines`);
    for (const typed of ['99991', '1']) {
      for (const scoped of [false, true]) {
        const go = () => stepEvidence({ ...q }, typed, lines.join('\n'), checkBankAnswer(q, typed), { slipWarnings: true });
        const ev = scoped ? withBankReading(go) : go();
        const crossed = [ev.stepReport, ev.shownReport].filter(Boolean).flatMap(r => r.lines).filter(l => l?.status === 'break');
        c.eq(crossed.length, 0, `${id}: no line of his page is crossed (typed ${typed}, ${scoped ? 'bank scope' : 'as a student page is read'})`);
      }
    }
    // the hold itself: ONLY his faulty line (or a line equal to it) that is crossed becomes a note; every other cross stays a cross
    const f = BANK_AUTHORING_FAULTS[id];
    const X = text => ({ text, status: 'break', note: 'x' });
    const rep = { lines: [{ text: 'a', status: 'ok' }, X(f.line), { text: 'c', status: 'note', note: 'Follows from the earlier slip.' }, X('(1/3)*arctan(4*x)'), X('(1/3)*arctan(3*x)+7'), X('  (1/3) * arctan( 3x )'), X('x=1')] };
    const held = holdFaultCrosses(q, rep);
    c.deq(held.lines.map(l => l.status), ['ok', 'note', 'note', 'break', 'break', 'note', 'break'], `${id}: his line and a line equal to it become notes; arctan(4x), a different constant and an unrelated line stay crossed`);
    c.ok(held.lines[1].note !== 'x' && held.lines[3].note === 'x' && held.lines[4].note === 'x', `${id}: the held line's cross words are not shown, the others keep theirs`);
    c.eq(holdFaultCrosses(q, { lines: [X('(1/3)*arctan(4*x)')] }).lines[0].status, 'break', `${id}: a page with no faulty line is returned as it was`);
    c.eq(holdFaultCrosses({ ...q, _bank: 'A11-F1-001' }, rep), rep, 'a question that is not held is returned unchanged');
    { const { usesExtendedTex } = await import('../platform/markerOps.js'); c.eq(usesExtendedTex(q), true, 'a bank question is read with the extended TeX reading'); c.eq(usesExtendedTex({ ...q, _bank: undefined, _marking: 'final-answer-only' }), false, 'a generator or paper question sealed final-answer-only uses the default reader'); c.eq(usesExtendedTex({ _methodScheme: 'x' }), false, 'and so does one stamped with a scheme'); }
    c.eq(holdFaultCrosses(q, null), null, 'no report, no change');
  }
  qb.resetQbank();
}

// ── 5. no model, no network, no clock ──────────────────────────────────────────────────────────────────────────────────────
{
  const src = fs.readFileSync(path.join(here, '../platform/bankSteps.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  c.ok(!/\b(fetch|XMLHttpRequest|WebSocket|Date\.now|new Date|Math\.random|setTimeout|setInterval|openai|anthropic|child_process|node:http|node:https|node:net)\b/i.test(src), 'no model, network, clock or randomness in the rule');
  c.ok(fs.readFileSync(path.join(here, '../platform/bankSteps.js'), 'utf8').includes("from './genericSteps.js'"), 'it imports the generic rule and does not copy it');
  c.eq(crypto.createHash('sha256').update(fs.readFileSync(path.join(here, '../platform/bankSteps.js'))).digest('hex').length, 64, 'the digest is over this very file');
}
console.log(`BANK STEPS: PASS — ${c.count()}/${c.count()} checks`);
process.exit(0);
