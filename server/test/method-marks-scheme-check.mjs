// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · method marks paid by a signed scheme (server/platform/schemeAward.js)
//
// R4 (marking authority). Nothing here switches anything on. The allow-list in the repository is EMPTY; this suite approves types in
// its own process only, by passing a list to the functions that take one, and it never sets PRI_METHOD_MARKS (the policy is passed
// as a plain object). What it holds:
//
//   1. the gates: empty list = every question sealed as before and nothing paid (a differential against the seal of main);
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
import * as G from '../../client/src/engine/generators/index.js';
import * as R from '../../tools/method-marks-ready.mjs';
import { TYPES } from '../../tools/method-marks-drafts.mjs';
import { SCHEMES, UNAVAILABLE, APPROVED_SCHEME_TYPES, schemeDigest, schemeMarks, schemePay, schemeTypeOf, isApproved, awardScheme } from '../platform/schemeAward.js';
import { stepEvidence, marksPossibleFor, practiceMarksEarned, MARKER_OPS } from '../platform/markerOps.js';
import { FINAL_ANSWER_ONLY } from '../platform/markingPolicy.js';
import { UNCERTIFIED_EDITIONS } from '../platform/editionMarking.js';
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
const asMarks = (q, n, typeId) => ({ ...q, difficulty: n, steps: Array.from({ length: n }, (_, i) => ({ h: `Step ${i + 1}`, d: '' })), _methodScheme: typeId });
const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };

// ── 1. the gates ───────────────────────────────────────────────────────────────────────────────────────────────────
ok(Array.isArray(APPROVED_SCHEME_TYPES) && APPROVED_SCHEME_TYPES.length === 0 && Object.isFrozen(APPROVED_SCHEME_TYPES), 'the allow-list in the repository is empty and frozen');
ok(bankPolicy('prithagoras').methodSchemeTypes === APPROVED_SCHEME_TYPES, 'the NSW bank carries the (empty) allow-list');
ok(!('methodSchemeTypes' in bankPolicy('priyabhata')) && bankPolicy('priyabhata').marking === null, 'India has no allow-list and no seal');
let sealedCount = 0, byTypeSealed = 0;
const typed = [];
for (const s of SCHEMES) for (const q of R.questionsOfType(s, { limit: 12 })) typed.push([s, q]);
for (const [s, q] of typed) {
  const generator = s.families[0];
  const a = JSON.parse(JSON.stringify({ ...q, _generator: generator })); const b = JSON.parse(JSON.stringify({ ...q, _generator: generator }));
  const sealed = sealForEdition(a, bankPolicy('prithagoras'), generator);
  // the seal of main, written out: identity and the final-answer seal, nothing else
  const main = sealed ? (() => { b._curriculum = a._curriculum; b._marking = FINAL_ANSWER_MARKING; return b; })() : null;
  if (!sealed) continue;
  sealedCount++;
  if (JSON.stringify(a) === JSON.stringify(main) && a._marking === FINAL_ANSWER_MARKING && !('_methodScheme' in a)) byTypeSealed++;
}
ok(sealedCount >= 20 && byTypeSealed === sealedCount, `empty list: ${byTypeSealed} of ${sealedCount} sealed questions are byte-identical to main's seal`);
// the same, with the list given but empty explicitly, and for the pay function
ok(typed.every(([s, q]) => { const p = schemePay({ q: asMarks(q, schemeMarks(s), s.id), report: { lines: [] }, correct: false, marksPossible: schemeMarks(s), env: ON }); return p.paid === false && p.reason === 'type-not-approved'; }), 'empty list: nothing is paid by a scheme even with the switch on');
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
  // The edition certification (editionMarking.js UNCERTIFIED_EDITIONS): Prithagoras pays nothing while it is uncertified, whatever the
  // allow-list and the switch say, in every environment.
  ok(UNCERTIFIED_EDITIONS.includes('prithagoras'), 'Prithagoras is uncertified in this repository');
  ok(run({ ...ON, PRI_EDITION: 'prithagoras' }).reason === 'MARKER_POLICY_EDITION_UNCERTIFIED' && !run({ ...ON, PRI_EDITION: 'prithagoras' }).paid, 'uncertified Prithagoras: on the list and switched on, the scheme pays nothing');
  ok(run({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'signed-1', PRI_EDITION: 'prithagoras' }).paid === false, 'uncertified Prithagoras: even with the production examiner result the scheme pays nothing');
  ok(run({ ...ON, PRI_EDITION: 'priyabhata' }).paid === true, 'another edition is not affected by the Prithagoras refusal');
  ok(run({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'signed-1' }).paid === true, 'in production it needs the signed result too');
  ok(run(ON).paid === true, 'outside production the switch pays an approved type');
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
      const adversarial = [['0 = 0'], ['x = x'], [first.replace(/=.*/, '= 0')]];
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
  ok(gamed.tried >= 400 && gamed.earned === 0, `no adversarial line earns a criterion (${gamed.earned} of ${gamed.tried})`);
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
  ok(UNAVAILABLE.length === 3 && UNAVAILABLE.every(u => !SCHEMES.some(s => s.id === u.id) && !fs.existsSync(new URL(`../../docs/marking/method-marks-signoff/method-marks/${u.id}.md`, import.meta.url))), 'the three unavailable types have no scheme and no packet');
  const index = fs.readFileSync(new URL('../../docs/marking/method-marks-signoff/method-marks/INDEX.md', import.meta.url), 'utf8');
  ok(/## Not available yet/.test(index) && UNAVAILABLE.every(u => index.includes(u.reason.slice(0, 40))), 'INDEX.md says "not available yet", with the reason for each');
  const readme = fs.readFileSync(new URL('../../docs/marking/method-marks-signoff/READ-ME-method-marks-signoff.md', import.meta.url), 'utf8');
  ok(/1 of 2/.test(readme.slice(0, 5200)) && /I approve the seven step-mark schemes/.test(readme.slice(0, 5200)) && !/[—–]/.test(readme.slice(0, 5200)), 'the owner note opens with the plain summary, the worked example (1 of 2) and one line to approve, no dashes');
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
