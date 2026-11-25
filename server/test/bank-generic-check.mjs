// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the approved GENERIC step-mark rule applied to the author's own BANK (server/platform/bankGenericSteps.js), a DRAFT
//
// R4 (marking authority). genericSteps.js is imported and applied unchanged, with his worked steps as the authored solution and his marks as N, under
// its own approval id `generic-solution-steps-bank`. The author has filed no record for it, so in the repository it pays nothing. This suite approves it
// IN THIS TEST PROCESS ONLY, by passing a list, and never creates a record.
//   1. the gates   2. sealing over the committed pack   3. paying   4. eligibility and the two rules side by side (printed numbers pinned)
//   5. the sweep, every hard assertion   6. no model, network or clock
//   node server/test/bank-generic-check.mjs
// SYNTHETIC: the author's own bank and scripted working. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.PRI_EDITION = 'prithagoras';
const { checks } = await import('./support/app-harness.mjs');
const qb = await import('../platform/qbankPack.js');
const { BANK_GENERIC_ID, bankGenericDigest, bankGenericEligible } = await import('../platform/bankGenericSteps.js');
const { BANK_ID, bankDigest, bankAuthoredLines } = await import('../platform/bankSteps.js');
const { GENERIC_ID, genericDigest } = await import('../platform/genericSteps.js');
const { isApproved, approvedSchemeTypes, schemePay } = await import('../platform/schemeAward.js');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../platform/editionBanks.js');
const { marksPossibleFor } = await import('../platform/markerOps.js');
const { allTypes, readRecords } = await import('../../tools/author-approvals.mjs');
const sweep = await import('../../tools/bank-steps-sweep.mjs');
const measure = await import('../../tools/bank-generic-measure.mjs');

// The numbers printed by `node tools/bank-generic-measure.mjs` and `BANK_RULE=generic node tools/bank-steps-sweep.mjs` on the committed pack.
const PIN = { parts: 1287, eligible: 356, all: 279, sweepPages: 7324, bothParts: 118, bothPages: 476, prose: 1053 };
const c = checks();
const here = path.dirname(fileURLToPath(import.meta.url));
await qb.ensureQbank(process.env, { strict: true });

{
  const records = readRecords();
  c.ok(!records.some(r => r.record.typeId === BANK_GENERIC_ID) && !fs.existsSync(path.join(here, '../../docs/marking/author-approvals', `${BANK_GENERIC_ID}.json`)), 'the author has filed no record for the bank-scoped generic rule: it is a draft');
  c.ok(!approvedSchemeTypes().some(a => a.typeId === BANK_GENERIC_ID), 'the repository list does not name it');
  c.ok(bankGenericDigest() !== genericDigest() && /^[0-9a-f]{64}$/.test(bankGenericDigest()), 'it has its own digest, not the generic rule\'s');
  c.eq(records.find(r => r.record.typeId === GENERIC_ID).record.digest, genericDigest(), 'the existing generic id and digest are unchanged');
  c.ok(allTypes().some(t => t.id === BANK_GENERIC_ID && t.digest === bankGenericDigest()), 'the approval machinery knows the id at the current digest');
  c.ok(isApproved(BANK_GENERIC_ID, [{ typeId: BANK_GENERIC_ID, digest: bankGenericDigest() }]) && !isApproved(BANK_GENERIC_ID, [{ typeId: BANK_GENERIC_ID, digest: 'e'.repeat(64) }]) && !isApproved(BANK_GENERIC_ID, [{ typeId: GENERIC_ID, digest: genericDigest() }]), 'approved only for a record at the current digest; the generic rule\'s approval is not it');
}
const entries = qb.qbankEntries();
const served = id => JSON.parse(JSON.stringify(qb.qbankEntryQuestion(id, 17)));
const prit = bankPolicy('prithagoras');
{
  const run = list => { let stamped = 0, sealed = 0, other = 0, bad = 0; for (const { entry } of entries) { const q = served(entry.id); q._generator = q.subtopic; if (!sealForEdition(q, { ...prit, methodSchemeTypes: list })) bad++; if (q._methodScheme === BANK_GENERIC_ID) { stamped++; if (!bankGenericEligible(q)) bad++; } else if (q._methodScheme !== undefined) other++; else if (q._marking === FINAL_ANSWER_MARKING) sealed++; } return { stamped, sealed, other, bad }; };
  const none = run(approvedSchemeTypes()), alone = run([{ typeId: BANK_GENERIC_ID, digest: bankGenericDigest() }]), stale = run([{ typeId: BANK_GENERIC_ID, digest: '0'.repeat(64) }]), both = run([{ typeId: BANK_GENERIC_ID, digest: bankGenericDigest() }, { typeId: BANK_ID, digest: bankDigest() }]);
  c.eq(none.stamped + none.other, 0, 'with the repository list no bank question is stamped');
  c.eq(stale.stamped, 0, 'a stale digest stamps nothing');
  c.eq(alone.bad, 0, 'every question seals, and only an eligible part is stamped');
  c.eq(alone.stamped + alone.sealed, entries.length, 'approved alone, every packed question is stamped or sealed final-answer-only');
  const multi = entries.filter(e => e.entry.marks >= 2).length;
  c.ok(alone.stamped > 0 && alone.stamped <= multi && alone.other === 0, `approved alone, ${alone.stamped} parts are stamped, none with another rule`);
  c.ok(both.stamped <= alone.stamped && both.other > 0, 'where his criteria rule is also approved it keeps the parts it can pay');
  let worked = 0; for (const { entry } of qb.qbankManualEntries()) { const q = JSON.parse(JSON.stringify(qb.qbankManualQuestion(entry.id, 17))); q._generator = q.subtopic; sealForEdition(q, { ...prit, methodSchemeTypes: [{ typeId: BANK_GENERIC_ID, digest: bankGenericDigest() }] }); if (q._methodScheme !== undefined) worked++; }
  c.eq(worked, 0, 'a worked-solution question is never stamped');
}
{
  const part = sweep.eligibleParts({ rule: 'generic' }).find(p => marksPossibleFor(p.q) === 3) || sweep.eligibleParts({ rule: 'generic' })[0];
  const q = part.q, N = marksPossibleFor(q);
  const texts = bankAuthoredLines(q).map(l => l.text);
  const m = sweep.markPage(q, texts, '99991');
  const env = sweep.ENV, list = sweep.LIST;
  c.ok(m.pay.paid && m.marks >= 1 && m.marks < N, 'a wrong answer with his working earns some step marks and never N');
  c.ok(m.pay.items.filter(i => i.key !== 'answer').every(i => /^Step \d+ of the worked solution/.test(i.text) && q.steps.some(s => i.text.includes(String(s.h).replace(/\$/g, '').slice(0, 6)))), 'the table shows his step headings');
  c.eq(m.pay.items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0), m.marks, 'the table equals the marks');
  const rep = m.ev.stepReport;
  const pay = o => schemePay({ q, report: rep, correct: false, marksPossible: N, env, list, ...o });
  c.eq(pay({ env: { PRI_EDITION: 'prithagoras' } }).reason, 'method-marks-off', 'switch off: nothing');
  c.eq(pay({ env: { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' } }).reason, 'bank-generic-author-tier-only', 'India untouched');
  c.eq(pay({ list: [{ typeId: BANK_GENERIC_ID, digest: '1'.repeat(64) }] }).reason, 'type-not-approved', 'stale digest: nothing');
  c.eq(pay({ list: approvedSchemeTypes() }).reason, 'type-not-approved', 'repository list: nothing');
  for (const mode of ['rush', 'match', 'placement']) c.eq(schemePay({ q: { ...q, _practiceMode: mode }, report: rep, correct: false, marksPossible: N, env, list }).reason, 'mode-final-answer-only', `${mode} stays final-answer-only`);
  c.eq(schemePay({ q, report: rep, correct: true, marksPossible: N, env, list }).awarded, N, 'a correct answer is N');
}
{
  const E = measure.eligibility();
  c.eq(E.summary.parts, PIN.parts, `${PIN.parts} parts worth 2+ marks`);
  c.eq(E.summary.eligible, PIN.eligible, `${PIN.eligible} can pay at least one step`);
  c.eq(E.summary.all, PIN.all, `${PIN.all} can pay all N-1`);
  c.eq(Object.values(E.summary.reasons).reduce((a, b) => a + b, 0), PIN.parts - PIN.eligible, 'every part that cannot pay has a counted reason');
  const C = measure.compare();
  c.eq(C.parts, PIN.bothParts, 'parts both rules apply to'); c.eq(C.pages, PIN.bothPages, 'pages compared');
  c.ok(C.genericMarks >= C.criteriaMarks, 'where both apply the generic rule pays at least as many marks in all');
  const R = sweep.runSweep({ rule: 'generic' });
  console.log(sweep.report(R));
  c.eq(R.parts, PIN.eligible, 'the sweep covers every eligible part'); c.eq(R.pages, PIN.sweepPages, `${PIN.sweepPages} pages marked`);
  c.eq(R.violations.length, 0, `no violation: ${JSON.stringify(R.violations.slice(0, 3))}`);
  c.eq(R.exceptions.length, 0, 'no gamed page earned a mark');
  c.eq(R.g.wrongFull + R.g.overN + R.g.correctNotFull + R.g.unticked + R.g.afterCross + R.g.answerByWorking + R.g.tableNotMark + R.g.notPaid, 0, 'every invariant holds on every page');
  c.eq(R.c.afterWrong, 0, 'nothing at or after a wrong middle line'); c.eq(R.b.wrongAtN, 0, 'never N on a wrong typed answer'); c.eq(R.f.atN, 0, 'a trap answer is never N'); c.eq(R.e.aloneEarned, 0, 'a bare value alone earns nothing');
  c.eq(R.byClass.get('digit-free-claim-then-his-lines').earned, 0, 'a digit-free claim stops every later line');
  c.eq(R.byClass.get('plain-word-false-claim-then-his-lines').proseThrough, PIN.prose, 'pure prose is no claim to the approved rule: his true lines after it pay (reported, as approved)');
}
{
  const src = fs.readFileSync(path.join(here, '../platform/bankGenericSteps.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  c.ok(!/\b(fetch|XMLHttpRequest|Date\.now|new Date|Math\.random|setTimeout|openai|anthropic|child_process|node:http)\b/i.test(src), 'no model, network, clock or randomness');
  c.ok(/import \{[^}]*awardGeneric[^}]*\} from '\.\/genericSteps\.js'/.test(src), 'it imports the generic rule and does not copy it');
}
console.log(`BANK GENERIC: PASS — ${c.count()}/${c.count()} checks`);
process.exit(0);
