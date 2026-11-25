// The criteria table: absent unless the author approved this type, for this digest, and the awards sum to the server mark.
import { criteriaView } from '../src/components/criteriaTableModel.js';
import { AUTHOR_APPROVED } from '../src/engine/authorApprovals.js';
import fs from 'node:fs';
import { approvedTypes, recordProblems, readRecords, allTypes } from '../../tools/author-approvals.mjs';

let pass = 0; const fail = [];
const ok = (c, l) => { if (c) pass++; else fail.push(l); };
const D = 'a'.repeat(64), D2 = 'b'.repeat(64);
const FIX = [{ typeId: 'y12-stationary-x', digest: D, approvedBy: 'Fixture Author', date: '2026-11-19' }];   // a test fixture, never a record
const cards = [{ n: 1, status: 'checked' }, { n: 2, status: 'checked' }, { n: 3, status: 'first-error' }, { n: 4, status: 'follows' }];
const crit = (over = {}) => ({ typeId: 'y12-stationary-x', digest: D, items: [
  { key: 'derivative', text: 'Differentiates correctly', marks: 1, awarded: true, lines: [2], reason: 'Line 2 is the derivative.' },
  { key: 'solve', text: 'Sets it to zero and solves', marks: 1, awarded: false, lines: [], reason: 'Line 3 is where it goes wrong.' }], ...over });
const mark = { awarded: 1, possible: 2 };

{
  // the approvable ids: the per-type schemes in types.json and the generic solution-step rule
  const derived = approvedTypes(readRecords(), allTypes());
  ok(JSON.stringify(AUTHOR_APPROVED) === JSON.stringify(derived), 'the build list equals exactly what the tool derives from the committed records, types.json and the generic rule\'s digest');
  ok(!AUTHOR_APPROVED.some(a => a.typeId === 'y12-stationary-x'), 'a type the page cannot verify is not approved in the build');
}
ok(criteriaView({ criteria: crit(), mark, cards }) === null, 'an unapproved type shows no criteria table at all');
{
  // the generic solution-step rule has its own approval id: the table is drawn for it from the build's OWN list (no test list), at its current digest only,
  // with the long step descriptions the rule writes, and not at a stale digest
  const gd = allTypes().find(t => t.id === 'generic-solution-steps').digest;
  const gcrit = (over = {}) => ({ typeId: 'generic-solution-steps', digest: gd, items: [
    { key: 'step1', text: 'Differentiates h(t) = -3t^2 + 36t + 39 to get h\'(t) = -6t + 36 and sets it to zero, the working that leads to the next line of the authored solution', marks: 1, awarded: true, basis: 'lines', lines: [2], reason: 'Line 2 is true.' },
    { key: 'step2', text: 'Solves for t', marks: 1, awarded: false, verified: false, basis: 'lines', lines: [], reason: 'No line for this step was found true.' },
    { key: 'answer', text: 'The final answer', marks: 1, awarded: false, basis: 'answer', lines: [], reason: '' }], ...over });
  ok(AUTHOR_APPROVED.some(a => a.typeId === 'generic-solution-steps' && a.digest === gd), 'the build list carries the generic rule at its current digest');
  const gv = criteriaView({ criteria: gcrit(), mark: { awarded: 1, possible: 3 }, cards });
  ok(gv && gv.typeId === 'generic-solution-steps' && gv.rows.length === 3 && gv.earned === 1 && gv.possible === 3 && gv.rows[0].text.includes('Differentiates h(t)') && gv.rows[1].verified === false, 'the generic rule\'s table is drawn from the build\'s own list, with its step descriptions, and sums to the server mark');
  ok(criteriaView({ criteria: gcrit({ digest: 'c'.repeat(64) }), mark: { awarded: 1, possible: 3 }, cards }) === null, 'the generic rule at a stale digest draws no table');
  ok(criteriaView({ criteria: gcrit(), mark: { awarded: 2, possible: 3 }, cards }) === null, 'the generic rule\'s table that does not equal the server mark is not drawn');
}
{
  // the bank rule (server/platform/bankSteps.js) has its own approval id and digest, and is keyed exactly as the others: the table is drawn only from an
  // approved list that names it at its current digest (the build's own list does not, until the author files his record), with HIS criteria in his words
  const bd = allTypes().find(t => t.id === 'bank-author-criteria').digest;
  const bcrit = (over = {}) => ({ typeId: 'bank-author-criteria', digest: bd, items: [
    { key: 'c1', text: 'Product rule', marks: 1, awarded: true, basis: 'lines', verified: true, lines: [2], reason: 'Line 2 is ticked and is this criterion.' },
    { key: 'c2', text: 'Correct derivative of \u221a(2x + 1)', marks: 1, awarded: false, basis: 'lines', verified: false, lines: [], reason: 'Only a person can check this criterion, so Pri does not.' },
    { key: 'c3', text: 'Single factorised fraction', marks: 1, awarded: false, basis: 'answer', verified: true, lines: [], reason: 'The final answer was not correct.' }], ...over });
  const listed = [{ typeId: 'bank-author-criteria', digest: bd, approvedBy: 'Fixture Author', date: '2026-11-25' }];   // a test list, never a record
  ok(!AUTHOR_APPROVED.some(a => a.typeId === 'bank-author-criteria' || a.typeId === 'generic-solution-steps-bank'), 'the build list carries neither bank rule: the author has not approved them');
  const gbd = allTypes().find(t => t.id === 'generic-solution-steps-bank').digest;
  ok(criteriaView({ criteria: { typeId: 'generic-solution-steps-bank', digest: gbd, items: [{ key: 'step-1', text: 'Step 1 of the worked solution (Split): y = x', marks: 1, awarded: true, basis: 'lines', verified: true, lines: [2], reason: '' }, { key: 'answer', text: 'The final answer.', marks: 1, awarded: false, basis: 'answer', verified: true, lines: [], reason: '' }] }, mark: { awarded: 1, possible: 2 }, cards, approved: [{ typeId: 'generic-solution-steps-bank', digest: gbd }] })?.rows.length === 2, 'the bank-scoped generic rule is keyed the same way: drawn only from a list naming it at its digest');
  ok(criteriaView({ criteria: bcrit(), mark: { awarded: 1, possible: 3 }, cards }) === null, 'unapproved in the build, the bank rule draws no table');
  const bv = criteriaView({ criteria: bcrit(), mark: { awarded: 1, possible: 3 }, cards, approved: listed });
  ok(bv && bv.typeId === 'bank-author-criteria' && bv.rows.length === 3 && bv.earned === 1 && bv.possible === 3 && bv.rows[1].verified === false && bv.rows[1].text.includes('2x + 1') && bv.rows[0].lines[0] === 2, 'approved at its digest, the bank rule\'s table lists his criteria in his words: earned, not earned, not verified, with the line');
  ok(criteriaView({ criteria: bcrit({ digest: 'c'.repeat(64) }), mark: { awarded: 1, possible: 3 }, cards, approved: listed }) === null, 'the bank rule at a stale digest draws no table');
  ok(criteriaView({ criteria: bcrit(), mark: { awarded: 2, possible: 3 }, cards, approved: listed }) === null, 'a table that is not the server mark is not drawn');
  ok(criteriaView({ criteria: bcrit(), mark: { awarded: 1, possible: 3 }, cards, approved: [{ typeId: 'generic-solution-steps', digest: allTypes().find(t => t.id === 'generic-solution-steps').digest }] }) === null, 'the generic rule\'s approval does not draw the bank rule\'s table');
}
const v = criteriaView({ criteria: crit(), mark, cards, approved: FIX });
ok(v && v.rows.length === 2 && v.earned === 1 && v.possible === 2, 'an approved type shows each criterion with its marks and the total');
ok(v.rows[0].awarded && v.rows[0].lines[0] === 2 && !v.rows[1].awarded, 'awarded or not, tied to the line that earned it');
ok(criteriaView({ criteria: crit({ digest: D2 }), mark, cards, approved: FIX }) === null, 'a changed scheme digest revokes: not approved until the author re-reviews');
ok(criteriaView({ criteria: crit(), mark: { awarded: 2, possible: 2 }, cards, approved: FIX }) === null, 'a table that does not equal the server mark is not shown');
ok(criteriaView({ criteria: crit(), mark: null, cards, approved: FIX }) === null, 'no server mark, no table');
const earnedOn = n => crit({ items: [{ key: 'x', text: 'x', marks: 1, awarded: true, lines: [n], reason: '' }] });
ok(criteriaView({ criteria: earnedOn(3), mark: { awarded: 1, possible: 1 }, cards, approved: FIX }) === null, 'a wrong line never earns a criterion');
ok(criteriaView({ criteria: earnedOn(4), mark: { awarded: 1, possible: 1 }, cards, approved: FIX }) === null, 'a line that only follows from an earlier error never earns (the engine policy)');
ok(criteriaView({ criteria: earnedOn(1), mark: { awarded: 1, possible: 1 }, cards, approved: FIX })?.rows.length === 1, 'a ticked line may earn');
ok(criteriaView({ criteria: crit({ items: [] }), mark, cards, approved: FIX }) === null, 'no criteria, no table');

// The reply shapes a real paid reply takes (24 Nov 2026 review: 66 of 777 paid replies drew no table). For every approved per-type scheme and the generic rule,
// real pages (a full page, a correct method with a wrong last line, a page whose later lines are not read) are marked by the server code, and the table the
// answer card draws (cardsOfReport + criteriaView, the build's own approved list, the server's mark) must exist, add up, and carry the label.
{
  const G = await import('../src/engine/generators/index.js');
  const R = await import('../../tools/method-marks-ready.mjs');
  const { TYPES } = await import('../../tools/method-marks-drafts.mjs');
  const { SCHEMES, schemePay, schemeMarks, schemeTypeOf } = await import('../../server/platform/schemeAward.js');
  const { stepEvidence, marksPossibleFor } = await import('../../server/platform/markerOps.js');
  const { checkAnswer } = await import('../src/engine/checker.js');
  const { cardsOfReport } = await import('../src/components/criteriaTableModel.js');
  const SW = await import('../../tools/generic-steps-sweep.mjs');
  const { authoredLines, GENERIC_ID } = await import('../../server/platform/genericSteps.js');
  await G.loadAllBanks();
  ok(typeof cardsOfReport === 'function', 'the table model exports cardsOfReport, which the answer card\'s table uses');
  const env = { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' };
  const shapes = [];   // { id, q, lines, answer }
  for (const id of ['y12-trig-extreme-2', 'y12-diff-rules-3', 'y12-diff-gradient-2', 'y12-diff-gradient-3', 'y12-integral-2', 'y12-integral-3', 'y12-tangent-3']) {
    const s = SCHEMES.find(x => x.id === id), t = TYPES.find(x => x.id === id); let n = 0;
    for (const q of R.questionsOfType(s, { limit: 60 })) {
      if (n >= 4 || schemeTypeOf(q) !== id || marksPossibleFor(q) !== schemeMarks(s)) continue;
      const built = await t.build(q); if (!built) continue; n++;
      shapes.push({ id, q: { ...q, _methodScheme: id }, lines: built.partial, answer: '999991' });
      shapes.push({ id, q: { ...q, _methodScheme: id }, lines: [...built.partial.slice(0, 1), '= 0', ...built.partial.slice(1)], answer: '999991' });
    }
  }
  for (const p of (await SW.payableQuestions({ seeds: 3 })).slice(0, 60)) {
    const lines = authoredLines(p.q).map(l => l.text); if (lines.length < 2) continue;
    shapes.push({ id: GENERIC_ID, q: p.q, lines: lines.slice(0, -1).concat(SW.falsifyByOne(lines[lines.length - 1]) ?? 'x = 999991'), answer: '999991' });
  }
  let paid = 0, drawn = 0, bad = [];
  for (const sh of shapes) {
    const N = marksPossibleFor(sh.q); const result = checkAnswer(sh.q, sh.answer);
    const ev = stepEvidence(sh.q, sh.answer, sh.lines.join('\n'), result, { slipWarnings: true });
    const pay = schemePay({ q: sh.q, report: ev.stepReport, topic: ev.topicTicks ?? null, correct: result.correct === true, marksPossible: N, env });
    if (!pay.paid) continue;
    paid++;
    const earned = pay.items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0);
    const view = criteriaView({ criteria: { typeId: pay.typeId, digest: pay.digest, items: pay.items }, mark: { awarded: earned, possible: N }, cards: cardsOfReport(ev.stepReport) });
    if (view && view.earned === earned && view.possible === N) drawn++; else bad.push(`${sh.id}: ${sh.lines.join(' | ').slice(0, 80)}`);
  }
  ok(paid >= 60 && drawn === paid, `every paid reply shape draws a table that adds up (${drawn} of ${paid} paid pages over eight approvals, ${bad.slice(0, 2).join('; ')})`);
}

// the records: a digest change revokes; a fixture or an automation name is refused
const types = [{ id: 'y12-stationary-x', digest: D }];
const rec = (o = {}) => ({ file: 'y12-stationary-x.json', record: { schemaVersion: 1, typeId: 'y12-stationary-x', digest: D, verdict: 'approved', note: 'ok', approvedBy: 'Priysharan Tripathi', role: 'author (tutor)', date: '2026-11-19', ...o } });
ok(approvedTypes([rec()], types).length === 1, 'a well-formed approval for the current digest counts');
ok(approvedTypes([rec()], [{ id: 'y12-stationary-x', digest: D2 }]).length === 0, 'the scheme changed after approval: not approved');
ok(approvedTypes([rec({ verdict: 'changes-needed' })], types).length === 0, 'changes needed is not approval');
ok(recordProblems(rec({ fixture: true }), types).length > 0, 'a fixture record is refused');
ok(recordProblems(rec({ approvedBy: 'Claude agent' }), types).length > 0, 'an automation name is refused');
ok(recordProblems(rec({ role: 'independent examiner' }), types).length > 0, 'the role is author (tutor), never examiner');
ok(recordProblems(rec({ note: 'examiner-certified by NESA' }), types).length > 0, 'the wording never claims examiner or NESA certification');
ok(recordProblems({ file: 'other.json', record: rec().record }, types).length > 0, 'a record is named after its type');
if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`CRITERIA TABLE: FAIL (${fail.length})`); process.exit(1); }
console.log(`CRITERIA TABLE: PASS — ${pass} checks — no table for an unapproved type; an approved fixture shows and sums to the server mark; a changed digest revokes; a wrong or follow-on line never earns`);
