// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · method marks paid by a signed scheme (server/platform/schemeAward.js)
//
// R4 (marking authority). Nothing here switches anything on. The allow-list in the repository carries the author's fourteen types and the
// generic rule (his records of 24 Nov 2026); the Year 7 and Year 10 drafts are not on it. Most sections pass an explicit list to the functions that
// take one, and the suite never sets PRI_METHOD_MARKS (the policy is passed as a plain object). Sections 1(f), 2b2 and 2b4 check the repository's own
// list: what is approved is stamped, what is not is never stamped and never paid. What it holds:
//
//   1. the gates: an empty list = every question sealed as before and nothing paid (a differential against the seal of main);
//      unapproved or stale-digest types stay sealed; the production gate; India untouched
//   2. the sweep, the seven payable types, every difficulty, seeds 1..60, draft + corpus + falsified pages, each worth the scheme's
//      marks: every earned criterion points at ticked lines before the first crossed line; marks equal the table; never above the
//      question's marks; a wrong final answer never full; a correct one always full; a wrong line never pays
//   3. a question whose marks are not the scheme's marks stays on the final answer, and says why
//   4. the owner's product-rule question with a wrong last line: 1 of 2, and why
//   5. scheme = packet: the digest, criteria and marks the owner reads are the ones paid; the unavailable types are not payable
//
//   node server/test/method-marks-scheme-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as G from '../../client/src/engine/generators/index.js';
import * as R from '../../tools/method-marks-ready.mjs';
import { TYPES } from '../../tools/method-marks-drafts.mjs';
import { SCHEMES, UNAVAILABLE, APPROVED_SCHEME_TYPES, schemeDigest, schemeMarks, schemePay, schemeTypeOf, isApproved, awardScheme } from '../platform/schemeAward.js';
import { genericDigest } from '../platform/genericSteps.js';
import { stepEvidence, marksPossibleFor, practiceMarksEarned, MARKER_OPS } from '../platform/markerOps.js';
import { FINAL_ANSWER_ONLY } from '../platform/markingPolicy.js';
import { UNCERTIFIED_EDITIONS, editionMarkingPolicy } from '../platform/editionMarking.js';
import { sealForEdition, bankPolicy, FINAL_ANSWER_MARKING } from '../platform/editionBanks.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { publicDescription } from '../platform/lineInterpreter/givens.js';
import { criteriaView } from '../../client/src/components/criteriaTableModel.js';
import en from '../../client/src/i18n/strings.en.js';
import hi from '../../client/src/i18n/strings.hi.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await G.loadAllBanks();

const LIST = SCHEMES.map(s => ({ typeId: s.id, digest: schemeDigest(s) }));
const ON = { PRI_METHOD_MARKS: 'on' };
const EQ_SKIP = t => !/[a-z]/i.test(t) || /^\s*[a-z]\s*=\s*-?[\d.]+\s*$/i.test(t);
const num = v => { const r = Math.round(v * 1e6) / 1e6; return String(Object.is(r, -0) ? 0 : r); };
const asMarks = (q, n, typeId) => ({ ...q, difficulty: n, steps: Array.from({ length: n }, (_, i) => ({ h: `Step ${i + 1}`, d: '' })), _methodScheme: typeId });
const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };

// ── 1. the gates ───────────────────────────────────────────────────────────────────────────────────────────────────
ok(Array.isArray(APPROVED_SCHEME_TYPES) && Object.isFrozen(APPROVED_SCHEME_TYPES) && APPROVED_SCHEME_TYPES.every(a => isApproved(a.typeId, APPROVED_SCHEME_TYPES)), 'the allow-list in the repository is frozen and every entry is at its scheme\'s current digest');
ok(bankPolicy('prithagoras').methodSchemeTypes === APPROVED_SCHEME_TYPES, 'the NSW bank carries the generated allow-list');
ok(!('methodSchemeTypes' in bankPolicy('priyabhata')) && bankPolicy('priyabhata').marking === null, 'India has no allow-list and no seal');
let sealedCount = 0, byTypeSealed = 0;
const typed = [];
for (const s of SCHEMES) for (const q of R.questionsOfType(s, { limit: 12 })) typed.push([s, q]);
for (const [s, q] of typed) {
  const generator = s.families[0];
  const a = JSON.parse(JSON.stringify({ ...q, _generator: generator })); const b = JSON.parse(JSON.stringify({ ...q, _generator: generator }));
  const sealed = sealForEdition(a, { ...bankPolicy('prithagoras'), methodSchemeTypes: [] }, generator);
  // the seal of main, written out: identity and the final-answer seal, nothing else
  const main = sealed ? (() => { b._curriculum = a._curriculum; b._marking = FINAL_ANSWER_MARKING; return b; })() : null;
  if (!sealed) continue;
  sealedCount++;
  if (JSON.stringify(a) === JSON.stringify(main) && a._marking === FINAL_ANSWER_MARKING && !('_methodScheme' in a)) byTypeSealed++;
}
ok(sealedCount >= 20 && byTypeSealed === sealedCount, `empty list: ${byTypeSealed} of ${sealedCount} sealed questions are byte-identical to main's seal`);
// the same, with the list given but empty explicitly, and for the pay function
ok(typed.every(([s, q]) => { const p = schemePay({ q: asMarks(q, schemeMarks(s), s.id), report: { lines: [] }, correct: false, marksPossible: schemeMarks(s), env: ON, list: [] }); return p.paid === false && p.reason === 'type-not-approved'; }), 'empty list: nothing is paid by a scheme even with the switch on');
ok(typed.every(([s, q]) => schemePay({ q, report: { lines: [] }, correct: false, marksPossible: 1, env: ON, list: LIST }).reason === 'not-a-scheme-question'), 'a question not stamped with a scheme is never paid by one');
// approved in this process: stamped, others sealed
{
  const policy = { ...bankPolicy('prithagoras'), methodSchemeTypes: LIST.filter(a => a.typeId === 'y12-diff-rules') };
  const [s1, q1] = typed.find(([s]) => s.id === 'y12-diff-rules'); const [s2, q2] = typed.find(([s]) => s.id === 'y12-trig-extreme');
  const a = JSON.parse(JSON.stringify({ ...asMarks(q1, schemeMarks(s1)), _generator: s1.families[0] })); delete a._methodScheme; const b = JSON.parse(JSON.stringify({ ...asMarks(q2, schemeMarks(s2)), _generator: s2.families[0] })); delete b._methodScheme;
  ok(sealForEdition(a, policy, s1.families[0]) && a._methodScheme === 'y12-diff-rules' && !('_marking' in a), 'an approved type is stamped with its scheme and not sealed final-answer-only');
  ok(sealForEdition(b, policy, s2.families[0]) && b._marking === FINAL_ANSWER_MARKING && !('_methodScheme' in b), 'a type not on the list stays sealed final-answer-only');
  const stale = { ...bankPolicy('prithagoras'), methodSchemeTypes: [{ typeId: 'y12-diff-rules', digest: 'f'.repeat(64) }] };
  const c = JSON.parse(JSON.stringify({ ...asMarks(q1, schemeMarks(s1)), _generator: s1.families[0] })); delete c._methodScheme;
  ok(sealForEdition(c, stale, s1.families[0]) && c._marking === FINAL_ANSWER_MARKING && !('_methodScheme' in c), 'an approval for a digest the scheme no longer has is not an approval');
  ok(isApproved('y12-diff-rules', LIST) && !isApproved('y12-diff-rules', stale.methodSchemeTypes) && !isApproved('y12-tangent', LIST), 'isApproved needs the type, its current digest');
  ok(bankPolicy('priyabhata').marking === null && !bankPolicy('priyabhata').methodSchemeTypes, 'India: no seal and no scheme, so the new branch of the seal is never entered');
}
// the production gate
{
  const [s, q] = typed[0]; const q2 = asMarks(q, schemeMarks(s), s.id);
  const run = env => schemePay({ q: q2, report: { lines: [] }, correct: false, marksPossible: schemeMarks(s), env, list: LIST });
  ok(run({}).reason === 'method-marks-off' && run({ PRI_METHOD_MARKS: 'off' }).reason === 'method-marks-off' && run({ PRI_METHOD_MARKS: 'yes' }).paid === false && run({ PRI_METHOD_MARKS: 'yes' }).reason === 'MARKER_POLICY_INVALID', 'the switch off, empty or misspelt pays nothing');
  ok(run({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on' }).reason === 'MARKER_POLICY_UNSIGNED', 'in production the switch alone pays nothing');
  // The edition certification (editionMarking.js UNCERTIFIED_EDITIONS) is unchanged: Prithagoras is still uncertified, so the GENERIC
  // method rubric pays nothing there. Owner decision 24 Nov 2026 (author-approved tier): a scheme of a type the author approved IS paid
  // there when PRI_METHOD_MARKS=on, without the examiner variable. (This replaces the two assertions that said the scheme paid nothing
  // on Prithagoras in every environment; the generic rubric assertions below keep the old meaning.)
  const PRI = { PRI_EDITION: 'prithagoras' };
  ok(UNCERTIFIED_EDITIONS.includes('prithagoras'), 'Prithagoras is still uncertified in this repository (no examiner certification)');
  ok(editionMarkingPolicy({ ...ON, ...PRI }).methodMarks === false && editionMarkingPolicy({ NODE_ENV: 'production', ...ON, ...PRI, PRI_METHOD_MARKS_EXAMINER_RESULT: 'signed-1' }).methodMarks === false, 'Prithagoras: the generic method rubric pays nothing, switch on or not, examiner variable or not');
  ok(run({ ...ON, ...PRI }).paid === true && run({ ...ON, ...PRI }).typeId === s.id, 'author-approved tier: on the list, switched on, Prithagoras pays the scheme');
  ok(run({ NODE_ENV: 'production', ...ON, ...PRI }).paid === true, 'author-approved tier: in production the switch alone pays, with no examiner variable');
  ok(run({ NODE_ENV: 'production', ...ON, ...PRI, PRI_METHOD_MARKS_EXAMINER_RESULT: 'signed-1' }).paid === true, 'author-approved tier: the examiner variable is neither needed nor read');
  ok(!run({ ...PRI }).paid && run({ ...PRI }).reason === 'method-marks-off' && !run({ ...PRI, PRI_METHOD_MARKS: 'off' }).paid && !run({ ...PRI, PRI_METHOD_MARKS: ' ' }).paid, 'author-approved tier: unset, empty or off pays nothing');
  ok(['yes', 'true', '1', 'onn', 'enabled'].every(v => run({ ...PRI, PRI_METHOD_MARKS: v }).paid === false && run({ ...PRI, PRI_METHOD_MARKS: v }).reason === 'MARKER_POLICY_INVALID'), 'author-approved tier: a misspelt switch fails closed');
  ok(schemePay({ q: q2, report: { lines: [] }, correct: false, marksPossible: schemeMarks(s), env: { ...ON, ...PRI }, list: [{ typeId: s.id, digest: 'f'.repeat(64) }] }).reason === 'type-not-approved', 'author-approved tier: a digest the scheme no longer has pays nothing');
  ok(schemePay({ q: q2, report: { lines: [] }, correct: false, marksPossible: schemeMarks(s), env: { ...ON, ...PRI }, list: LIST.filter(a => a.typeId !== s.id) }).reason === 'type-not-approved', 'author-approved tier: an unlisted type pays nothing');
  ok(run({ ...ON, PRI_EDITION: 'priyabhata' }).paid === true, 'another edition is not affected by the Prithagoras refusal');
  ok(run({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' }).reason === 'MARKER_POLICY_UNSIGNED' && !run({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_EDITION: 'priyabhata' }).paid, 'India is unchanged: in production the switch alone pays nothing');
  ok(run({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'signed-1' }).paid === true, 'in production it needs the signed result too');
  ok(run(ON).paid === true, 'outside production the switch pays an approved type');
}

// (f) the repository's generated lists equal what the tool derives from the committed records, and the tool generates them from records only
{
  const AA = await import('../../tools/author-approvals.mjs');
  const { AUTHOR_APPROVED_SERVER } = await import('../platform/authorApproved.generated.js');
  const typesJson = JSON.parse(fs.readFileSync(new URL('../../owner-review/method-marks/types.json', import.meta.url), 'utf8')).types;
  // the approvable ids are the per-type schemes in types.json plus the generic solution-step rule (its digest is over the rule's own code)
  const allTypes = AA.allTypes();
  const derived = AA.approvedTypes(AA.readRecords(), allTypes).map(a => ({ typeId: a.typeId, digest: a.digest }));
  ok(Object.isFrozen(AUTHOR_APPROVED_SERVER) && APPROVED_SCHEME_TYPES === AUTHOR_APPROVED_SERVER && JSON.stringify(AUTHOR_APPROVED_SERVER) === JSON.stringify(derived), 'the generated server list equals exactly what the tool derives from the committed records and types.json');
  ok(AA.readRecords().flatMap(r => AA.recordProblems(r, allTypes)).length === 0 && derived.every(d => allTypes.find(t => t.id === d.typeId)?.digest === d.digest && (d.typeId === 'generic-solution-steps' ? genericDigest() === d.digest : SCHEMES.some(x => x.id === d.typeId && schemeDigest(x) === d.digest))), 'every committed record is valid and its digest is the type\'s current digest');
  // fixtures in a temporary directory: valid + approved + current digest is listed; stale digest, changes-needed, automation names are not
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-approvals-'));
  const rec = (typeId, o = {}) => ({ schemaVersion: 1, typeId, digest: typesJson.find(t => t.id === typeId).digest, verdict: 'approved', role: 'author (tutor)', approvedBy: 'Priysharan Tripathi', date: '2026-11-24', note: 'ok', ...o });
  const put = r => fs.writeFileSync(path.join(dir, `${r.typeId}.json`), JSON.stringify(r));
  put(rec('y12-diff-rules')); put(rec('y11-poly-evaluate', { digest: 'a'.repeat(64) })); put(rec('y12-trig-extreme', { verdict: 'changes-needed' })); put(rec('y12-diff-explog', { approvedBy: 'claude bot' }));
  const got = AA.approvedTypes(AA.readRecords(dir), typesJson);
  ok(got.length === 1 && got[0].typeId === 'y12-diff-rules' && got[0].digest === typesJson.find(t => t.id === 'y12-diff-rules').digest, 'only a valid, approved record at the type\'s current digest is listed');
  const text = AA.renderServer(got);
  ok(/typeId": "y12-diff-rules"/.test(text) && !/approvedBy|date/.test(text), 'the server list carries the type and the digest only');
  // only the author's own name: another name (even a plausible one) is refused and appears in neither generated list
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-approvals-'));
  fs.writeFileSync(path.join(dir2, 'y12-diff-rules.json'), JSON.stringify(rec('y12-diff-rules', { approvedBy: 'Priya Sharma' })));
  const other = AA.readRecords(dir2);
  ok(AA.recordProblems(other[0], typesJson).some(m => /approvedBy/.test(m)) && AA.approvedTypes(other, typesJson).length === 0 && !AA.renderServer(AA.approvedTypes(other, typesJson)).includes('y12-diff-rules') && !AA.render(AA.approvedTypes(other, typesJson)).includes('y12-diff-rules'), 'a record by any other name is refused and listed in neither generated list');
  ok(AA.approvedTypes(AA.readRecords(dir), typesJson).length === 1, 'the author\'s own name (trimmed) still lists');
  fs.rmSync(dir2, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 2. the sweep ───────────────────────────────────────────────────────────────────────────────────────────────────
const N = { pages: 0, paid: 0, earnedCriteria: 0, notVerified: 0, correctPages: 0, wrongPages: 0, partialPaid: 0, byAnswerOnly: 0, tableNull: 0, tableShown: 0 };
const V = { onUnticked: 0, afterCross: 0, tableNotMark: 0, overPossible: 0, wrongFull: 0, correctNotFull: 0, wrongLinePays: 0, notPaid: 0, markNotTotal: 0 };
for (const s of SCHEMES) {
  const possible = schemeMarks(s);
  for (const q of R.questionsOfType(s)) {
    for (const page of await R.pagesFor(TYPES.find(t => t.id === s.id), q)) {
      const q2 = asMarks(q, possible, s.id);
      const answer = page.answer ?? finalOf(page.lines);
      const result = checkAnswer(q2, answer);
      const ev = stepEvidence(q2, answer, page.lines.join('\n'), result, { slipWarnings: true });
      const poss = marksPossibleFor(q2);
      N.pages++;
      const pay = schemePay({ q: q2, report: ev.stepReport, topic: ev.topicTicks ?? null, correct: result.correct === true, marksPossible: poss, env: ON, list: LIST });
      if (!pay.paid) { V.notPaid++; continue; }
      N.paid++;
      const lines = ev.stepReport?.lines || [];
      const cross = lines.findIndex(l => l?.status === 'break');
      const correct = result.correct === true;
      let sum = 0;
      for (const it of pay.items) {
        if (it.awarded) { sum += it.marks; N.earnedCriteria++; } else if (!it.verified) N.notVerified++;
        for (const n of it.lines) {
          const l = lines[n - 1];
          if (!(l && l.status === 'ok' && l.ecf !== true)) V.onUnticked++;
          if (cross >= 0 && n - 1 >= cross) V.afterCross++;
          if (!correct && (page.wrong || []).includes(n - 1)) V.wrongLinePays++;
        }
        if (it.awarded && it.basis === 'lines' && !it.lines.length) V.onUnticked++;
        if (it.awarded && !it.lines.length && it.basis !== 'answer') V.onUnticked++;
      }
      if (!correct && pay.items.some(i => i.basis === 'answer' && i.awarded && i.reason !== 'The final answer is correct.')) V.wrongFull++;
      const marks = correct ? practiceMarksEarned(q2, result, ev, poss) : practiceMarksEarned(q2, result, { ...ev, partial: pay.partial }, poss);
      if (marks > poss) V.overPossible++;
      if (!correct && marks >= poss) V.wrongFull++;
      if (correct && (marks !== poss || pay.items.some(i => !i.awarded))) V.correctNotFull++;
      if (!correct && marks !== sum) V.markNotTotal++;
      correct ? N.correctPages++ : N.wrongPages++;
      if (!correct && marks > 0) N.partialPaid++;
      if (pay.items.some(i => i.awarded && i.basis === 'answer' && !correct)) V.wrongFull++;
      if (pay.items.some(i => i.awarded && !i.lines.length)) N.byAnswerOnly++;
      // the table: only when the author approved this digest, it must add up to the mark and rest on ticked cards
      const cards = lines.map((l, i) => ({ n: i + 1, status: l.status === 'ok' ? 'checked' : l.status === 'break' ? 'first-error' : 'unchecked' }));
      const view = criteriaView({ criteria: { typeId: pay.typeId, digest: pay.digest, items: pay.items }, mark: { awarded: marks, possible: poss }, cards, approved: [{ typeId: s.id, digest: schemeDigest(s) }] });
      if (view) {
        N.tableShown++;
        if (view.earned !== marks) V.tableNotMark++;
        if (!pay.items.every((it, i) => view.rows[i].verified === (it.verified !== false))) V.tableNotMark++;
      } else { N.tableNull++; V.tableNotMark++; }
    }
  }
}
console.log(`  scheme sweep: ${N.pages} pages, paid ${N.paid} (${N.correctPages} right answers, ${N.wrongPages} wrong, ${N.partialPaid} wrong answers that earned a method mark), criteria earned ${N.earnedCriteria}, not verified ${N.notVerified}, earned by the answer alone ${N.byAnswerOnly}, table shown ${N.tableShown}`);
console.log(`  violations: ${Object.entries(V).map(([k, v]) => `${k} ${v}`).join(', ')}`);
ok(N.pages >= 1500 && N.paid === N.pages, `${N.pages} pages, every one paid by the scheme`);
ok(N.partialPaid >= 100 && N.correctPages >= 100 && N.notVerified >= 1, `the sweep exercises part marks (${N.partialPaid}), right answers (${N.correctPages}) and "not verified" (${N.notVerified})`);
for (const [k, v] of Object.entries(V)) ok(v === 0, `${k} = ${v} (must be 0)`);
ok(N.tableShown === N.paid, 'the table is shown on every page, adds up to the mark, and rests on ticked lines');
// every payable type shows up
for (const s of SCHEMES) ok(R.questionsOfType(s, { limit: 3 }).length === 3, `${s.id}: questions exist`);


// ── 2b. adversarial lines: value-equal but not the named step, true but irrelevant, the question restated ─────────────
{
  const gamed = { tried: 0, earned: 0, controlEarned: 0, controls: 0 };
  const payOn = (s, q, lines, answer) => {
    const q2 = asMarks(q, schemeMarks(s), s.id);
    const result = checkAnswer(q2, answer);
    const ev = stepEvidence(q2, answer, lines.join('\n'), result, { slipWarnings: true });
    return schemePay({ q: q2, report: ev.stepReport, topic: ev.topicTicks ?? null, correct: result.correct === true, marksPossible: marksPossibleFor(q2), env: ON, list: LIST });
  };
  for (const s of SCHEMES) {
    const type = TYPES.find(t => t.id === s.id);
    for (const q of R.questionsOfType(s, { limit: 40 })) {
      const built = await type.build(q);
      if (!built) continue;
      const first = built.full[0];
      const zeroed = first.replace(/=.*/, '= 0');
      // (a first line that already is "... = 0" is the genuine step, not a gamed one)
      const adversarial = [['0 = 0'], ['x = x'], ...(zeroed.replace(/\s+/g, '') === first.replace(/\s+/g, '') ? [] : [[zeroed]])];
      const sub = /^\s*([A-Za-z])\((-?\d+)\)\s*=/.exec(first);
      if (sub && /^(y11-poly-evaluate|y12-trig-evaluate)$/.test(s.id)) {
        const [, name, a] = sub; const A = Number(a);
        const v = Number(built.full[built.full.length - 1].split('=').pop());
        adversarial.push([`${name}(${a}) = ${a} + ${a} + ${a} + ${v - 3 * A}`], [`${name}(${a}) = ${v - 3} + 3 - 3 + 3`], [`${name}(${a}) = ${v}`], [`${name}(${a}) = ${v} + 0`], [`${name}(${a}) = ${v - A}${A < 0 ? ' - ' : ' + '}${Math.abs(A)}`]);
        const real = payOn(s, q, built.full, '999');
        gamed.controls++; if (real.items.find(i => i.key === 'substitute')?.awarded) gamed.controlEarned++;
      } else {
        const f = publicDescription(q).functions[0];
        if (f) adversarial.push([`dy/dx = ${f.rhs}`], [`${f.name}'(x) = ${f.rhs}`], [`${f.name} = ${f.rhs}`]);
      }
      for (const lines of adversarial) {
        gamed.tried++;
        const p = payOn(s, q, lines, '999');
        if (p.items.some(i => i.basis === 'lines' && i.awarded)) gamed.earned++;
      }
    }
  }
  console.log(`  adversarial: ${gamed.tried} lines tried over ${SCHEMES.length} types, gamed marks ${gamed.earned}; the real substitution earned its criterion on ${gamed.controlEarned} of ${gamed.controls}`);
  ok(gamed.tried >= 800 && gamed.earned === 0, `no adversarial line earns a criterion (${gamed.earned} of ${gamed.tried})`);
  ok(gamed.controls >= 40 && gamed.controlEarned === gamed.controls, 'the genuine term-by-term substitution still earns its criterion');
  // the reviewer's two lines, on the question they named (y11-polynomials, difficulty 2, seed 1)
  const polyType = SCHEMES.find(x => x.id === 'y11-poly-evaluate');
  const rq = G.generateQuestion('y11-polynomials', 2, 1);
  if (polyType.pick(rq)) {
    const a = /P\((-?\d+)\)/.exec(rq.prompt)?.[1] ?? '3';
    for (const rhs of [`${a} + ${a} + ${a} + 19`, `28 + ${a} - ${a} + ${a} - ${a} + ${a} - ${a}`]) {
      const p = payOn(polyType, rq, [`P(${a}) = ${rhs}`], '29');
      ok(!p.items.find(i => i.key === 'substitute').awarded, `P(${a}) = ${rhs} does not earn the substitution criterion`);
    }
  }
}

// ── 2b2. the draft schemes the author has NOT approved (Years 7 and 10 equations, 24 Nov 2026): never stamped, never pay; gamed lines earn nothing ──────────────
{
  // y12-trig-extreme-2 was a draft here until the author approved it on 24 Nov 2026 (asserted below, in 2b4); these four are still unapproved
  const DRAFT_IDS = ['y7-equation-solve-2', 'y7-equation-solve-3', 'y10-quadratic-solve-2', 'y10-quadratic-solve-3'];
  ok(DRAFT_IDS.every(id => SCHEMES.some(s => s.id === id) && !APPROVED_SCHEME_TYPES.some(a => a.typeId === id) && !isApproved(id)), 'the draft schemes exist and none is on the repository\'s approved list');
  // with the repository's own list, a draft type is never stamped and never pays
  {
    let stamped = 0, tried = 0;
    for (const id of DRAFT_IDS) { const s = SCHEMES.find(x => x.id === id); for (const q of R.questionsOfType(s, { limit: 15 })) {
      const copy = JSON.parse(JSON.stringify({ ...q, _generator: s.families[0] })); tried++;
      if (sealForEdition(copy, bankPolicy('prithagoras'), s.families[0]) && copy._methodScheme === id) stamped++;
      const p = schemePay({ q: asMarks(q, schemeMarks(s), id), report: { lines: [{ status: 'ok', text: 'x' }] }, correct: false, marksPossible: schemeMarks(s), env: { ...ON, PRI_EDITION: 'prithagoras' } });
      if (p.paid) stamped++;
    } }
    ok(tried >= 30 && stamped === 0, `an unapproved draft is never stamped and never pays (${tried} questions)`);
  }
  // the mark-variants: a question is stamped with the variant whose marks are its marks, and the other variant never pays it
  {
    const two = SCHEMES.find(x => x.id === 'y7-equation-solve-2'), three = SCHEMES.find(x => x.id === 'y7-equation-solve-3');
    let n2 = 0, n3 = 0, bad = 0;
    for (const q of R.questionsOfType(two)) { const m = marksPossibleFor(q); const id = schemeTypeOf(q); if (m === 2) { n2++; if (id !== two.id) bad++; } if (m === 3) { n3++; if (id !== three.id) bad++; } }
    ok(n2 >= 20 && n3 >= 20 && bad === 0, `equation questions: ${n2} two-mark ones typed to the two-mark scheme, ${n3} three-mark ones to the three-mark scheme, ${bad} wrongly typed`);
  }
  // gaming lines on an equation question earn no step: its own equation (either way round), a line with no letter, an identity, a solved form, a repeat
  const gamed = { tried: 0, earned: 0, controls: 0, controlEarned: 0, repeatEarned: 0 };
  for (const id of ['y7-equation-solve-2', 'y7-equation-solve-3', 'y10-quadratic-solve-2', 'y10-quadratic-solve-3']) {
    const s = SCHEMES.find(x => x.id === id); const type = TYPES.find(t => t.id === id);
    for (const q of R.questionsOfType(s, { limit: 60 })) {
      const built = await type.build(q); if (!built) continue;
      const q2 = asMarks(q, schemeMarks(s), id);
      const payLines = lines => { const result = checkAnswer(q2, '999'); const ev = stepEvidence(q2, '999', lines.join('\n'), result, { slipWarnings: true }); return schemePay({ q: q2, report: ev.stepReport, topic: ev.topicTicks ?? null, correct: false, marksPossible: schemeMarks(s), env: ON, list: LIST }); };
      const given = /^\s*Solve\s+\$([^$]+)\$/i.exec(q.prompt)?.[1];
      const v = q.stepcheck?.variable || 'x';
      const roots = q.answerType === 'set' ? q.answer.values.map(Number) : [Number(q.answer.value)];
      const lists = [['2 + 2 = 4'], ['9 = 9'], [`${v} = ${v}`], ['0 = 0'], [`${v} = ${num(roots[0])}`], [`${v} = ${num(roots[0])}`, `${v} = ${num(roots[0])}`]];
      // an equation that merely happens to have one of the several solutions (x - 5 = 1 when 6 is a solution) is ticked as incomplete: it is no step
      if (q.answerType === 'set') for (const r of roots) lists.push([`${v} - ${num(r - 1)} = 1`], [`2${v} = ${num(2 * r)}`.replace(/^2/, '2')]);
      if (given) { const [l, r] = given.split('='); lists.push([given], [`${r.trim()} = ${l.trim()}`], [given, given]); }
      for (const lines of lists) { gamed.tried++; if (payLines(lines).items.some(i => i.basis === 'lines' && i.awarded)) gamed.earned++; }
      // a real first step is earned, and the same line written twice earns once only
      // (the page ticks a line only when the lines after it lead somewhere: a first step on its own, with nothing after it, is "not verified")
      // (a one-step equation has no step but the answer itself, and the answer written early is not a step)
      if (!EQ_SKIP(built.full[0])) { gamed.controls++; if (payLines(built.partial).items.find(i => i.key === 'step' || i.key === 'step1')?.awarded) gamed.controlEarned++; }
      if (id.endsWith('3') && payLines([built.partial[0], built.partial[0], ...built.partial.slice(1)]).items.find(i => i.key === 'step2')?.awarded && built.partial.slice(1).every(t => EQ_SKIP(t))) gamed.repeatEarned++;
    }
  }
  console.log(`  equation drafts, adversarial: ${gamed.tried} gamed lines, ${gamed.earned} earned a step; real first step earned ${gamed.controlEarned} of ${gamed.controls}; repeated line earned a second step ${gamed.repeatEarned} times`);
  ok(gamed.tried >= 400 && gamed.earned === 0, `no gamed line earns a step on an equation draft (${gamed.earned} of ${gamed.tried})`);
  ok(gamed.controls >= 40 && gamed.controlEarned === gamed.controls, `a genuine first step earns the step (${gamed.controlEarned} of ${gamed.controls})`);
  ok(gamed.repeatEarned === 0, 'the same line written twice never earns the second step');
}

// ── 2b3. regression (24 Nov 2026): a braced exponent, e^{3x - 3}, was never read, so a correct derivative line earned nothing ──────
{
  const q = { ...G.generateQuestion('y12-explogcalc', 2, 29), _methodScheme: 'y12-diff-explog' };
  const lines = ['y = -4e^{3x - 3}', "y' = -4 × 3e^{3x - 3}", '= -4e^{3x - 3}'];
  const result = checkAnswer(q, '-4e^(3x-3)');
  const ev = stepEvidence(q, '-4e^(3x-3)', lines.join('\n'), result, { slipWarnings: true });
  const p = schemePay({ q, report: ev.stepReport, topic: ev.topicTicks ?? null, correct: result.correct === true, marksPossible: marksPossibleFor(q), env: ON, list: LIST });
  ok(marksPossibleFor(q) === 2 && p.paid && p.awarded === 1 && p.items[0].awarded && p.items[0].lines.join() === '2', `braced exponent: correct derivative line earned, wrong last line, 1 of 2 (got ${p.awarded})`);
  const wrong = ev2 => ev2.stepReport.lines[1].status;
  const bad = stepEvidence(q, '-4e^(3x-3)', ['y = -4e^{3x - 3}', "y' = -4 × 2e^{3x - 3}", '= -4e^{3x - 3}'].join('\n'), result, { slipWarnings: true });
  ok(wrong(bad) !== 'ok', 'a wrong derivative line with a braced exponent is not ticked');
  ok(checkAnswer(q, '-12e^{3x-3}').correct === true && checkAnswer(q, '-12e^{3x-2}').correct === false, 'the answer checker reads a braced exponent, and still refuses a wrong one');
}

// ── 2c. a lying interpreter cannot pay a mark ────────────────────────────────────────────────────────────────────
{
  const { reportWithInterpretation } = await import('../platform/lineInterpreter/overlay.js');
  const q = asMarks(R.OWNER_QUESTION, 2, 'y12-diff-rules');
  const working = ['Differentiate y = x^2(x-1).', 'dy/dx = 3x^2 - 2x'];
  // A report in which the engine left both lines unchecked (a value-chain report, the only kind the interpreter extends).
  const engine = { source: 'value-chain', firstBreak: -1, lines: working.map(text => ({ text, status: 'note', state: 'unverified', unverified: true, note: 'Not checked' })) };
  const lying = { lines: working.map((_, index) => ({ index, engine: false, verdict: 'valid', ticked: true })) };
  const shown = reportWithInterpretation({ stepReport: engine, lineInterpretation: lying, working: working.join('\n') });
  ok(shown.lines.every(l => l.status === 'ok'), 'the lying interpreter ticks both lines on the page');
  const wrong = { correct: false };
  const fromDeterministic = schemePay({ q, report: engine, topic: null, correct: wrong.correct, marksPossible: 2, env: ON, list: LIST });
  const fromShown = schemePay({ q, report: shown, topic: null, correct: wrong.correct, marksPossible: 2, env: ON, list: LIST });
  ok(fromDeterministic.paid && fromDeterministic.awarded === 0 && fromDeterministic.items[0].verified === false, 'paid from the engine\'s report: no mark, the derivative criterion is "not verified"');
  ok(fromShown.awarded === 1, 'control: paid from the folded report it WOULD pay, which is why practice.js never reads it');
}

// ── 2b4. the seven Years 11-12 schemes the author approved on 24 Nov 2026: stamped from the repository's list; gamed lines earn nothing ──
{
  const NEW = ['y12-diff-rules-3', 'y12-diff-gradient-2', 'y12-diff-gradient-3', 'y12-integral-2', 'y12-integral-3', 'y12-tangent-3'];
  // The author approved these six, and y12-trig-extreme-2, on 24 Nov 2026 (docs/marking/author-approvals). With the repository's own list a question of each
  // is stamped with its scheme at issue; with a stale digest it is not.
  const APPROVED_NOW = [...NEW, 'y12-trig-extreme-2'];
  ok(APPROVED_NOW.every(id => SCHEMES.some(s => s.id === id) && APPROVED_SCHEME_TYPES.some(a => a.typeId === id && a.digest === schemeDigest(SCHEMES.find(s => s.id === id))) && isApproved(id)), 'the seven newly approved schemes are on the repository\'s approved list at their current digests');
  {
    let eligible = 0, stamped = 0, staleStamped = 0, wrongTyped = 0;
    for (const id of APPROVED_NOW) {
      const s = SCHEMES.find(x => x.id === id); let own = 0;
      for (const q of R.questionsOfType(s, { limit: 80 })) {
        // a type with two generator families (y12-integral-2): the question comes from one of them, so seal it as that one
        let copy = null, sealed = false;
        const fam = s.families.find(f => schemeTypeOf(q, f) === id) ?? s.families[0];
        copy = JSON.parse(JSON.stringify({ ...q, _generator: fam })); sealed = sealForEdition(copy, bankPolicy('prithagoras'), fam);
        // a question of another mark count (a 1-mark integral beside the 2-mark scheme) is rightly left on the final answer, and is not counted
        // (a question the edition does not admit under its generator is never issued, so it is not counted either)
        if (sealed && schemeTypeOf(q, fam) === id && marksPossibleFor(q) === schemeMarks(s)) { own++; eligible++; if (sealed && copy._methodScheme === id) stamped++; } else if (copy._methodScheme === id) wrongTyped++;
        const stale = JSON.parse(JSON.stringify({ ...q, _generator: s.families[0] }));
        if (sealForEdition(stale, { ...bankPolicy('prithagoras'), methodSchemeTypes: [{ typeId: id, digest: 'f'.repeat(64) }] }, s.families[0]) && stale._methodScheme === id) staleStamped++;
      }
      ok(own >= 3, `${id}: at least three questions of its marks were issued to test (${own})`);
    }
    ok(eligible >= 30 && stamped === eligible && wrongTyped === 0 && staleStamped === 0, `every question of an approved type at the scheme's marks is stamped with it from the repository's list (${stamped} of ${eligible}), a question of another mark count is never stamped with it (${wrongTyped}), a stale digest stamps nothing (${staleStamped})`);
  }
  // a question is typed to the variant whose marks are its marks
  {
    let n2 = 0, n3 = 0, bad = 0;
    for (const s of SCHEMES.filter(x => x.id === 'y12-diff-gradient-2')) for (const q of R.questionsOfType(s)) { const m = marksPossibleFor(q); const id = schemeTypeOf(q); if (m === 2) { n2++; if (id !== 'y12-diff-gradient-2') bad++; } if (m === 3) { n3++; if (id !== 'y12-diff-gradient-3') bad++; } }
    ok(n2 >= 10 && n3 >= 20 && bad === 0, `gradient questions: ${n2} two-mark ones typed to the two-mark scheme, ${n3} three-mark ones to the three-mark scheme, ${bad} wrongly typed`);
  }
  const g = { tried: 0, earned: 0, controls: 0, controlEarned: 0 };
  const run = (s, q, lines) => { const q2 = asMarks(q, schemeMarks(s), s.id); const result = checkAnswer(q2, '999'); const ev = stepEvidence(q2, '999', lines.join('\n'), result, { slipWarnings: true }); return schemePay({ q: q2, report: ev.stepReport, topic: ev.topicTicks ?? null, correct: false, marksPossible: marksPossibleFor(q2), env: ON, list: LIST }); };
  const earnedKeys = p => p.items.filter(i => i.basis === 'lines' && i.awarded).map(i => i.key);
  for (const id of NEW) {
    const s = SCHEMES.find(x => x.id === id); const type = TYPES.find(t => t.id === id);
    for (const q of R.questionsOfType(s, { limit: 60 })) {
      const built = await type.build(q); if (!built) continue;
      const f = publicDescription(q).functions[0];
      const lists = [['0 = 0'], ['x = x'], ['999'], ...(f ? [[`dy/dx = ${f.rhs}`], [`y' = ${f.rhs}`], [`f'(x) = ${f.rhs}`]] : [])];
      const base = lists.length;
      if (id === 'y12-diff-rules-3') {
        const key = String(q.answer.expr);
        lists.push([`dy/dx = ${key}`, `dy/dx = ${key}`], [`dy/dx = ${key}`, `= ${key}`], [`dy/dx = ${key}`, `dy/dx = ${key.replace(/\s+/g, '')}`], [`dy/dx = ${key}`, `dy/dx = ${key.replace(/\s+/g, '')} `]);
        // a first correct line earns the first criterion; the same derivative written again earns no second one
        for (const ls of lists.slice(base)) { g.tried++; const k = earnedKeys(run(s, q, ls)); if (k.includes('second')) g.earned++; }
        lists.length = base;
        // a crossed line, then right lines: nothing after the cross
        const wrong = built.zero[0];
        g.tried++; if (earnedKeys(run(s, q, [wrong, built.full[0], built.full[1]])).length) g.earned++;
        g.controls++; if (earnedKeys(run(s, q, built.full.slice(0, 2))).join() === 'derivative,second') g.controlEarned++; else if (process.env.DEBUG_CONTROL) console.log('control', id, q.prompt.slice(0, 90), JSON.stringify(built.full), earnedKeys(run(s, q, built.full.slice(0, 2))));
      } else if (id === 'y12-tangent-3') {
        const st = q.stepcheck.stages; const slope = st[1].expected; const D = built.full[0];
        // the value alone is a true line at the second stage and earns the gradient only under a gradient label; the final line restated; the curve restated
        lists.push([`y = ${String(q.answer.expr)}`], [`m = ${num(slope)}`, `y = ${String(q.answer.expr)}`], [`${num(slope)}`], [`dy/dx = ${num(slope)}`], [`2 + 2 = ${num(slope)}`], [`m = ${num(slope + 1)}`], [`m = ${num(slope - 3)} + 1 + 1 + 1`, D]);
        for (const ls of lists) { g.tried++; const k = earnedKeys(run(s, q, ls)); if (k.includes('derivative') && !ls.includes(D)) g.earned++; if (k.includes('gradient') && !(ls.length && /^m\b/.test(ls[0]) && ls[0] === `m = ${num(slope)}`) && !/^m = .*=/.test(ls.join('|'))) { if (!(ls.some(x => /^dy\/dx = /.test(x) && x.endsWith(`= ${num(slope)}`)))) g.earned++; } }
        g.tried++; if (earnedKeys(run(s, q, [built.zero[0], built.full[1]])).length) g.earned++;
        g.controls++; if (earnedKeys(run(s, q, built.partial)).join() === 'derivative,gradient') g.controlEarned++; else if (process.env.DEBUG_CONTROL) console.log('control', id, q.prompt.slice(0, 90), JSON.stringify(built.partial), earnedKeys(run(s, q, built.partial)));
        continue;
      } else if (id.startsWith('y12-integral')) {
        const st = q.stepcheck.stages; const val = st[1].expected; const F = built.full[0];
        const integrand = st[0].integrand;
        // a difference of numbers that merely comes to the value, the value alone, the integrand restated, a function that is not an antiderivative, a wrong antiderivative then a right substitution
        lists.push([`F(x) = ${integrand}`], [`${num(val)}`], [`= ${num(val + 7.31)} - 7.31`], [F, `= ${num(val + 7.31)} - 7.31`], [F, `= ${num(val)} + 0`], [F, F], [`F(x) = ${integrand}`, `= ${num(val + 7.31)} - 7.31`]);
        if (id.endsWith('3')) lists.push([built.zero[0], built.full[1]], [built.zero[0], built.full[1], built.full[2]]);
        for (const ls of lists) { g.tried++; const k = earnedKeys(run(s, q, ls)); const real = ls.includes(F); if (k.includes('limits')) g.earned++; if (k.includes('antiderivative') && !real) g.earned++; }
        g.tried++; if (earnedKeys(run(s, q, [F, F])).filter(x => x === 'limits').length) g.earned++;
        // the real lines earn their criteria, even with a wrong final answer
        const want = id.endsWith('3') ? 'antiderivative,limits' : 'antiderivative';
        g.controls++; if (earnedKeys(run(s, q, built.partial)).join() === want) g.controlEarned++; else if (process.env.DEBUG_CONTROL) console.log('control', id, q.prompt.slice(0, 90), JSON.stringify(built.partial), earnedKeys(run(s, q, built.partial)));
        continue;
      } else {
        const st = q.stepcheck.stages; const val = st[1].expected; const D = built.full[0]; const S = built.full[1];
        const wrongD = built.zero[0];
        // the value alone is a true line at the second stage, and shows no substitution; a sum that merely comes to the value shows none either
        lists.push([`dy/dx = ${num(val)}`], [D, `dy/dx = ${num(val - 3)} + 1 + 1 + 1`], [D, `dy/dx = ${num(val)}`], [D, `dy/dx = ${num(val)} + 0`], [`dy/dx = ${num(val - 3)} + 1 + 1 + 1`, D]);
        for (const ls of lists) { g.tried++; const k = earnedKeys(run(s, q, ls)); if (k.includes('substitute') && !ls.includes(S)) g.earned++; if (!ls.includes(D) && k.includes('derivative')) g.earned++; }
        // nothing is earned by a crossed line, nor by the lines after it
        g.tried++; if (earnedKeys(run(s, q, [wrongD, D, ...(id.endsWith('3') ? [S] : [])])).length) g.earned++;
        // the real lines earn their criteria, even with a wrong final answer
        const want = id.endsWith('3') ? 'derivative,substitute' : 'derivative';
        g.controls++; if (earnedKeys(run(s, q, built.partial)).join() === want) g.controlEarned++; else if (process.env.DEBUG_CONTROL) console.log('control', id, q.prompt.slice(0, 90), JSON.stringify(built.partial), earnedKeys(run(s, q, built.partial)));
        // a line that restates the function is never the derivative
        g.tried++; if (earnedKeys(run(s, q, [`dy/dx = ${f.rhs}`])).includes('derivative')) g.earned++;
        continue;
      }
      for (const ls of lists) { g.tried++; if (earnedKeys(run(s, q, ls)).length) g.earned++; }
    }
  }
  console.log(`  Years 11-12 drafts, adversarial: ${g.tried} gamed pages, ${g.earned} earned a criterion they should not; the real lines earned their criteria on ${g.controlEarned} of ${g.controls}`);
  ok(g.tried >= 600 && g.earned === 0, `no gamed page earns a criterion on a Years 11-12 draft (${g.earned} of ${g.tried})`);
  ok(g.controls >= 100 && g.controlEarned === g.controls, `the genuine lines earn their criteria (${g.controlEarned} of ${g.controls})`);
}

// ── 3. criteria not the question's marks ───────────────────────────────────────────────────────────────────────────
{
  const [s, q] = typed.find(([x]) => x.id === 'y12-diff-rules');
  const wrong = asMarks(q, schemeMarks(s) + 1, s.id);
  const p = schemePay({ q: wrong, report: { lines: [{ status: 'ok', text: 'x' }] }, correct: false, marksPossible: marksPossibleFor(wrong), env: ON, list: LIST });
  ok(p.paid === false && /^criteria-count: the scheme has 2 marks and this question is worth 3/.test(p.reason), `a 3-mark question of a 2-mark scheme stays on the final answer: ${p.reason}`);
  const one = schemePay({ q: asMarks(q, 1, s.id), report: { lines: [] }, correct: false, marksPossible: 1, env: ON, list: LIST });
  ok(one.paid === false && /criteria-count/.test(one.reason), 'a 1-mark question of a 2-mark scheme stays on the final answer');
}

// ── 4. the owner's product-rule question ──────────────────────────────────────────────────────────────────────────
{
  const q = { ...R.OWNER_QUESTION, difficulty: 2, steps: Array.from({ length: 4 }, (_, i) => ({ h: `Step ${i + 1}`, d: '' })), _methodScheme: 'y12-diff-rules' };
  const lines = [...R.OWNER_HEAD, '= 3x^2 - x'];
  const result = checkAnswer(q, '3x^2-x');
  const ev = stepEvidence(q, '3x^2-x', lines.join('\n'), result, { slipWarnings: true });
  const poss = marksPossibleFor(q);
  const p = schemePay({ q, report: ev.stepReport, topic: ev.topicTicks, correct: false, marksPossible: poss, env: ON, list: LIST });
  const st = ev.stepReport.lines.map(l => l.status);
  ok(poss === 2 && p.paid && p.awarded === 1, `the owner's question: ${p.awarded} of ${poss}`);
  {
    // (a) Prithagoras, switch on, approved type, matching digest: correct method, wrong last line = 1 of 2. (b) switch off: final answer only.
    const PRI = { PRI_EDITION: 'prithagoras' };
    const pay = env => schemePay({ q, report: ev.stepReport, topic: ev.topicTicks, correct: false, marksPossible: poss, env, list: LIST });
    ok(pay({ ...ON, ...PRI }).paid && pay({ ...ON, ...PRI }).awarded === 1 && pay({ NODE_ENV: 'production', ...ON, ...PRI }).awarded === 1, 'Prithagoras, switch on, approved type, matching digest: 1 of 2 (also in production, no examiner variable)');
    ok(!pay({ ...PRI }).paid && !pay({ ...PRI, PRI_METHOD_MARKS: 'off' }).paid && !pay({ ...PRI, PRI_METHOD_MARKS: 'onn' }).paid, 'Prithagoras, switch off, unset or misspelt: final answer only, nothing paid');
    // (d) the generic rubric pays nothing on Prithagoras even with the switch on: the real marker operation under the edition's policy
    const gen = { ...R.OWNER_QUESTION, difficulty: 2, steps: q.steps };
    const withPolicy = MARKER_OPS.practice({ q: gen, answer: '3x^2-x', working: lines.join('\n'), evidenceIfWrong: true, policy: editionMarkingPolicy({ ...ON, ...PRI }) }, () => {});
    const control = MARKER_OPS.practice({ q: gen, answer: '3x^2-x', working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true, scheme: 'method-marks' } }, () => {});
    ok(withPolicy.evidence.partial === null && (control.evidence.partial?.awarded ?? 0) >= 1, `Prithagoras with the switch on: the generic rubric pays nothing (the control rubric would pay ${control.evidence.partial?.awarded ?? 0})`);
    // (e) India behaves as before: the examiner result is still required in production, a scheme is never stamped
    ok(editionMarkingPolicy({ NODE_ENV: 'production', ...ON, PRI_EDITION: 'priyabhata' }).methodMarks === false && editionMarkingPolicy({ NODE_ENV: 'production', ...ON, PRI_EDITION: 'priyabhata', PRI_METHOD_MARKS_EXAMINER_RESULT: 'x' }).methodMarks === true && editionMarkingPolicy({ NODE_ENV: 'production', ...ON }).methodMarks === false, 'India (and no edition): in production the examiner result is still required');
  }
  ok(p.items[0].awarded && p.items[0].lines.join() === '6' && !p.items[1].awarded && p.items[1].verified && st[8] === 'break', `derivative earned on line 6 (the first ticked line), answer not earned, line 9 crossed: ${JSON.stringify(p.items.map(i => [i.key, i.awarded, i.lines]))}`);
  const right = schemePay({ q, report: stepEvidence(q, '3x^2-2x', [...R.OWNER_HEAD, '= 3x^2 - 2x'].join('\n'), checkAnswer(q, '3x^2-2x')).stepReport, correct: true, marksPossible: poss, env: ON, list: LIST });
  ok(right.paid && right.items.every(i => i.awarded) && right.awarded === 2, 'the right answer is 2 of 2');
  // Through the real marker operation with the policy OFF (the Prithagoras process): the generic method mark is withheld, the page's
  // report and the topic check's own ticks still arrive, and the scheme pays from them.
  {
    const emitted = [];
    const out = MARKER_OPS.practice({ q, answer: '3x^2-x', working: lines.join('\n'), evidenceIfWrong: true, policy: FINAL_ANSWER_ONLY }, x => emitted.push(x));
    const viaOp = schemePay({ q, report: out.evidence.stepReport, topic: out.evidence.topicTicks ?? null, correct: out.result.correct === true, marksPossible: poss, env: ON, list: LIST });
    ok(out.evidence.partial === null && Array.isArray(out.evidence.topicTicks) && viaOp.paid && viaOp.awarded === 1, 'through the marker operation with the policy off: no generic method mark, the scheme still pays 1 of 2 from the same report');
    const plain = MARKER_OPS.practice({ q: { ...R.OWNER_QUESTION, difficulty: 2 }, answer: '3x^2-x', working: lines.join('\n'), evidenceIfWrong: true, policy: FINAL_ANSWER_ONLY }, () => {});
    ok(!('topicTicks' in plain.evidence), 'a question with no scheme gets exactly the evidence it always got');
    const src = fs.readFileSync(new URL('../platform/practice.js', import.meta.url), 'utf8');
    ok(/schemePay\(\{ q, report: evidence\.stepReport \|\| null, topic: evidence\.topicTicks \?\? null,/.test(src) && !/schemePay\([^\n]*(?:shownReport|reportWithInterpretation|lineInterpretation)/.test(src) && /stepReport: invalid \? null : reportWithInterpretation\(\{ stepReport, lineInterpretation, working \}\), partial: invalid \? null : partial,/.test(src) && /!finalAnswerOnly && schemeQuestion/.test(src), 'practice.js pays a scheme question from the deterministic step report, never from the report the interpreter has been folded into');
  }
  // a crossed line and the lines after it never earn: line 8 falsified, line 9 true again
  const slip = [...R.OWNER_HEAD.slice(0, 7), '= 2x^2 - 2x + 2x^2', '= 3x^2 - 2x'];
  const r2 = stepEvidence(q, '3x^2-x', slip.join('\n'), checkAnswer(q, '3x^2-x'));
  const p2 = schemePay({ q, report: r2.stepReport, topic: r2.topicTicks, correct: false, marksPossible: poss, env: ON, list: LIST });
  ok(p2.items[0].lines.join() === '6' && p2.awarded === 1, 'a crossed line and the line after it do not add a mark');
  // nothing ticked before the cross: not verified, never "wrong"
  const none = awardScheme(SCHEMES[0], { lines: [{ status: 'note', text: 'a' }, { status: 'note', text: 'b' }] }, false);
  ok(none.items[0].awarded === false && none.items[0].verified === false && none.total === 0, 'no ticked line and no cross: the criterion is "not verified"');
  const crossed = awardScheme(SCHEMES[0], { lines: [{ status: 'break', text: 'a' }, { status: 'ok', text: 'b' }] }, false);
  ok(crossed.items[0].awarded === false && crossed.items[0].verified === true && crossed.total === 0, 'a crossed first line: nothing after it earns');
}

// ── 5. scheme = packet ────────────────────────────────────────────────────────────────────────────────────────────
{
  const types = JSON.parse(fs.readFileSync(new URL('../../owner-review/method-marks/types.json', import.meta.url), 'utf8'));
  ok(types.types.length === SCHEMES.length && types.types.every(t => schemeDigest(SCHEMES.find(s => s.id === t.id)) === t.digest), 'every packet digest is the digest of the criteria the server pays');
  ok(types.types.every(t => { const s = SCHEMES.find(x => x.id === t.id); return t.totalMarks === schemeMarks(s) && t.criteria.length === s.criteria.length && t.criteria.every((c, i) => c.key === s.criteria[i].key && c.marks === s.criteria[i].marks && c.text === s.criteria[i].text); }), 'every packet criterion, mark and text is the server\'s');
  const owner = id => fs.readFileSync(new URL(`../../docs/marking/method-marks-signoff/method-marks/${id}.md`, import.meta.url), 'utf8');
  ok(SCHEMES.every(s => owner(s.id).includes(schemeDigest(s)) && s.criteria.every(c => owner(s.id).includes(c.text))), 'the owner packets carry the digest and every criterion');
  // Three until the Years 11-12 pass (24 Nov 2026): the gradient at a point and the tangent now have a derived step plan and a scheme each (y12-diff-gradient-2/-3, y12-tangent-3), so they left this list; the stationary points stay.
  ok(UNAVAILABLE.length === 1 && UNAVAILABLE[0].id === 'y12-stationary-x' && UNAVAILABLE.every(u => !SCHEMES.some(s => s.id === u.id) && !fs.existsSync(new URL(`../../docs/marking/method-marks-signoff/method-marks/${u.id}.md`, import.meta.url))), 'the unavailable type has no scheme and no packet');
  const index = fs.readFileSync(new URL('../../docs/marking/method-marks-signoff/method-marks/INDEX.md', import.meta.url), 'utf8');
  ok(/## Not available yet/.test(index) && UNAVAILABLE.every(u => index.includes(u.reason.slice(0, 40))), 'INDEX.md says "not available yet", with the reason for each');
  const readme = fs.readFileSync(new URL('../../docs/marking/method-marks-signoff/READ-ME-method-marks-signoff.md', import.meta.url), 'utf8');
  ok(/1 of 2/.test(readme.slice(0, 5200)) && /Status, 24 November 2026/.test(readme.slice(0, 5200)) && /fourteen of the eighteen/.test(readme.slice(0, 5200)) && !/the approved list stays empty/.test(readme) && !/[—–]/.test(readme.slice(0, 5200)), 'the owner note opens with the plain summary, the worked example (1 of 2) and the status of the author\'s records (fourteen types and the generic rule), no dashes');
  // unavailable types are never typed as a scheme question
  let leaked = 0;
  for (const u of UNAVAILABLE) for (const fam of u.families) for (let d = 1; d <= 4; d++) for (let seed = 1; seed <= 20; seed++) { let q; try { q = G.generateQuestion(fam, d, seed); } catch { continue; } const id = schemeTypeOf(q, fam); if (id && (/stationary|tangent/.test(id) || id.endsWith('gradient')) && !SCHEMES.some(s => s.id === id)) leaked++; }
  ok(leaked === 0, 'no unavailable type is ever typed as a scheme question');
  ok(SCHEMES.every(s => s.criteria.filter(c => c.by === 'final').length === 1), 'every scheme has exactly one final-answer criterion, so a wrong answer is never full marks');
}
// the display strings
for (const k of ['mp.criteria.notVerified']) ok(typeof en[k] === 'object' && typeof hi[k] === 'object' && !/[—–]/.test(JSON.stringify(en[k]) + JSON.stringify(hi[k])), `${k} in English and Hindi, no dash`);

if (failures.length) { console.error(`METHOD MARKS SCHEME: FAIL (${failures.length})`); for (const f of failures) console.error(`  ${f}`); process.exit(1); }
console.log(`METHOD MARKS SCHEME: PASS: ${pass} checks`);
