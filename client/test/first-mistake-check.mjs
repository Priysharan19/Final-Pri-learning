// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first mistake in a page of working (issue #430)
//
// The owner photographed five lines for "first term 9, common difference 3,
// find the 9th term" and was told "Incorrect". Every line but the last is
// right; the last says 9 + 24 = 35. This suite pins what the marker now says
// about that page and about the classes of page around it, through the same
// operation the server runs for a submission (server/platform/markerOps.js
// MARKER_OPS.practice) — so what is asserted here is what a typed, an ink and a
// photo submission each receive.
//
// Everything is deterministic and synthetic: authored lines, generated
// questions, no reader, no model, no network. It measures what the marker does
// with lines it is handed; it says nothing about how well a page is read.
//
//   1  the ten mandatory cases of #430
//   2  what must never be called a mistake (valid and unconventional working)
//   3  what must be found (a corpus of slips, by topic)
//   4  readings to confirm are never accusations
//   5  rubric marks: preserved, never invented, never for a guess
//   6  the key-free pre-submission hint never states the right value
//   7  resource bounds: adversarial input is refused quickly, inside the budget
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { generateQuestion, loadAllBanks } from '../src/engine/generators/index.js';
import { stepCheck, methodMarks, WORKING_LIMITS } from '../src/engine/checker.js';
import { auditWorking, workingHint, AUDIT_LIMITS, describeBreak, breakOn } from '../src/engine/lineAudit.js';
import { buildWorkingReview, REVIEW_CHECKS, ERROR_CLASSES, promptLetters } from '../src/engine/workingReview.js';
import { formulaPlan, stepCheckFormula } from '../src/engine/reason-formula.js';
import { MARKER_OPS, marksPossibleFor, stepMetaFor } from '../../server/platform/markerOps.js';

await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (got, want, label) => ok(JSON.stringify(got) === JSON.stringify(want), `${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

/** What the server computes for one submission that resolves the question. */
function submit(q, answer, lines) {
  const out = MARKER_OPS.practice({ q, answer: String(answer), working: lines.join('\n'), evidenceIfWrong: true }, () => {});
  const possible = marksPossibleFor(q);
  const earned = out.result.correct ? possible : Math.max(0, Math.min(possible - 1, out.evidence.partial?.awarded ?? 0));
  return { correct: out.result.correct === true, earned, possible, review: out.evidence.review, report: out.evidence.stepReport, partial: out.evidence.partial };
}
const checks = review => review.lines.filter(l => l.read === 'submitted').map(l => l.check);
const mistakes = review => review.lines.filter(l => l.check === 'first-mistake' || l.check === 'later-mistake').length;

// The owner's question, as the server's generator issues it.
const TERM = generateQuestion('c10-arithmetic-progressions', 1, 10931);
const SUM = (() => { for (let seed = 1; seed < 5000; seed++) { const q = generateQuestion('c10-arithmetic-progressions', 2, seed); if (q.stepcheck?.substitutions.a > 0 && q.stepcheck.substitutions.d > 0) return q; } })();
const SAVINGS = generateQuestion('c10-arithmetic-progressions', 4, 11);
const FLAGSHIP = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '    = 9 + 24', '    = 35'];

// ── 1 · The ten mandatory cases ──────────────────────────────────────────────
{
  eq(TERM.prompt, 'An arithmetic progression has first term $9$ and common difference $3$. Find its $9$th term.', 'the generator issues the owner\'s question');
  eq([TERM.answer.value, marksPossibleFor(TERM), stepMetaFor(TERM)?.kind], [33, 1, 'formula'], 'its answer is 33, its rubric carries one mark, and its working is now checked');

  // (1) 9 + 24 = 35.
  const r = submit(TERM, '35', FLAGSHIP);
  eq(r.correct, false, '1: 35 is incorrect');
  eq(checks(r.review), ['verified', 'verified', 'verified', 'verified', 'first-mistake'], '1: four ticks, then the first mistake on the last line');
  eq(r.review.lines.slice(0, 4).map(l => l.role), ['given', 'formula', 'substitution', 'arithmetic'], '1: each tick says what it verified');
  ok(r.review.lines.slice(0, 4).every(l => l.reason && l.reason.length < 90), '1: each tick has a short reason');
  eq([r.review.firstMistake.index, r.review.firstMistake.line, r.review.firstMistake.position, r.review.firstMistake.cls], [4, 5, 'last', 'arithmetic-slip'], '1: the first mistake is the last line, an arithmetic slip');
  eq(r.review.firstMistake.what, 'Arithmetic slip in the addition.', '1: what went wrong names the addition');
  eq(r.review.firstMistake.correction, '9 + 24 = 33, not 35.', '1: the correction states 33');
  eq(r.review.firstMistake.hint, 'Recheck 9 + 24.', '1: the hint points at the addition');
  ok(!/33/.test(r.review.firstMistake.hint) && !/33/.test(r.review.firstMistake.what), '1: neither the hint nor the kind of mistake reveals 33');
  eq(r.review.didWell, ['You chose the right formula.', 'You substituted the values correctly.', 'Every line before the last one checks out.'], '1: what was done well');
  ok(/calculation/.test(r.review.improve), '1: how to improve is about the calculation');
  eq([r.earned, r.possible], [0, 1], '1: the question carries one mark, for the answer — none is invented for method');
  eq(r.partial.note, 'No method marks: this question carries a single mark, for the answer.', '1: and the marker says why');
  eq([r.review.certified, r.review.answerCorrect, r.review.laterMistakes.length], [false, false, 0], '1: not certified; one mistake only');
  // The blank line and the indentation of the photographed page keep their place.
  const page = submit(TERM, '35', ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '', '    = 9 + 24', '', '    = 35']);
  eq([page.review.firstMistake.index, page.review.firstMistake.n], [6, 4], '1: with blank lines on the page the mistake is still on the line it was written on');
  eq(page.review.lines.map(l => l.read), ['submitted', 'submitted', 'submitted', 'blank', 'submitted', 'blank', 'submitted'], '1: every submitted line keeps its index, blank ones included');
  eq(page.review.lines.filter(l => l.read === 'submitted').map(l => l.check), checks(r.review), '1: and blank lines change no verdict');

  // (2) Fully correct.
  const right = submit(TERM, '33', [...FLAGSHIP.slice(0, 4), '    = 33']);
  eq([right.correct, right.earned, right.review.firstMistake, mistakes(right.review), right.review.certified], [true, 1, null, 0, true], '2: the correct page has no mistake and is certified');
  eq(checks(right.review), ['verified', 'verified', 'verified', 'verified', 'verified'], '2: every line is ticked');
  eq(right.review.lines.at(-1).role, 'answer', '2: the last line is the answer');

  // (3) The sum formula on an nth-term question.
  for (const [label, lines] of [
    ['in letters', ['S_n = n/2(2a + (n - 1)d)', 'S_9 = 9/2(2 × 9 + 8 × 3)', '= 9/2 × 42', '= 189']],
    ['in numbers', ['S_9 = 9/2(2 × 9 + 8 × 3)', '= 189']],
    ['under the asked name', ['T_9 = 9/2(2 × 9 + 8 × 3)', '= 189']]
  ]) {
    const s = submit(TERM, '189', lines);
    eq([s.review.firstMistake?.index, s.review.firstMistake?.cls], [0, 'wrong-formula'], `3 ${label}: the first error is the choice of formula, on the line it is made`);
    ok(/sum of the first n terms/.test(s.review.firstMistake?.correction || ''), `3 ${label}: and it is named`);
    eq(checks(s.review).slice(1).every(c => c === 'follows-through'), true, `3 ${label}: the arithmetic done with it follows through and is not marked again`);
    eq([mistakes(s.review), s.earned], [1, 0], `3 ${label}: one mistake, no mark`);
  }
  const offByOne = submit(TERM, '36', ['T_9 = 9 + 9 × 3', '= 9 + 27', '= 36']);
  eq([offByOne.review.firstMistake?.cls, offByOne.review.firstMistake?.index], ['wrong-formula', 0], '3: a + nd for the nth term is the formula one step too far');

  // (4) -3x = 12, then x = 4.
  const LIN = { prompt: '$-3x = 12$', answerType: 'numeric', answer: { value: -4 }, difficulty: 2, steps: [{ h: 'Divide', d: '' }, { h: 'Answer', d: '' }] };
  const lin = submit(LIN, '4', ['-3x = 12', 'x = 4']);
  eq([lin.review.firstMistake?.index, lin.review.firstMistake?.line], [1, 2], '4: -3x = 12 then x = 4 breaks on the second line');
  eq(lin.review.firstMistake?.cls, 'sign', '4: as a sign error');
  eq(lin.review.lines[0].check, 'verified', '4: the question\'s own line is verified');
  const linOk = submit(LIN, '-4', ['-3x = 12', 'x = 12/(-3)', 'x = -4']);
  eq([linOk.review.firstMistake, linOk.review.certified], [null, true], '4: the same question solved correctly has no mistake');

  // (5) Carry-forward.
  const carried = submit(TERM, '35', ['T_9 = 9 + 8 × 3', '= 9 + 26', '= 35']);
  eq(checks(carried.review), ['verified', 'first-mistake', 'follows-through'], '5: the slip, then a line that is right for the slipped value');
  eq(carried.review.firstMistake.correction, '9 + 8 × 3 = 33, but 9 + 26 = 35.', '5: the slip is where 8 × 3 became 26');
  eq(mistakes(carried.review), 1, '5: the last line is not a second mistake');
  ok(carried.review.didWell.includes('After the slip, your working was right for the value you had.'), '5: and following through correctly is acknowledged');
  const keyFree = auditWorking(['T = 9 + 8 × 3', '= 9 + 26', '= 35', '= 35 × 2', '= 70']);
  eq(keyFree.lines.map(l => [l.verdict, l.carried]), [['open', false], ['break', false], ['ok', true], ['ok', true], ['ok', true]], '5: with no key at all, every later line is checked against the student\'s own value');

  // (6) Two independent mistakes, one penalty each and no more.
  const twice = submit(SAVINGS, '1', (() => {
    const { a, d, n } = SAVINGS.stepcheck.substitutions;
    const inner = 2 * a + (n - 1) * d;
    return [`S_n = n/2(2a + (n - 1)d)`, `S = ${n}/2 × (2 × ${a} + ${n - 1} × ${d})`, `= ${n}/2 × (${2 * a} + ${(n - 1) * d + 10})`, `= ${n}/2 × ${inner + 10}`, `= ${(n * (inner + 10)) / 2 + 7}`];
  })());
  eq(checks(twice.review), ['verified', 'verified', 'first-mistake', 'follows-through', 'later-mistake'], '6: a slip, a line that follows from it, and a second independent slip');
  eq([twice.review.laterMistakes.length, twice.review.laterMistakes[0]?.cls], [1, 'arithmetic-slip'], '6: the second is reported as its own mistake');
  const once = submit(SAVINGS, '1', (() => {
    const { a, d, n } = SAVINGS.stepcheck.substitutions;
    return [`S_n = n/2(2a + (n - 1)d)`, `S = ${n}/2 × (2 × ${a} + ${n - 1} × ${d})`, `= ${n}/2 × (${2 * a} + ${(n - 1) * d + 10})`];
  })());
  eq([twice.earned, once.earned, twice.possible], [2, 2, 3], '6: two mistakes cost exactly what one costs — the marks earned before the first are kept');

  // (7) A 9 read as g.
  for (const [label, lines] of [['in the arithmetic', ['T_9 = 9 + 8 × 3', '= g + 24', '= 35']], ['in the name', ['T_q = 9 + 8 × 3', '= 9 + 24', '= 35']]]) {
    const g = submit(TERM, '35', lines);
    eq([g.review.firstMistake, mistakes(g.review)], [null, 0], `7 ${label}: no line is accused`);
    ok(checks(g.review).includes('confirm') && !checks(g.review).includes('first-mistake'), `7 ${label}: a confirmation is asked for instead`);
    ok(g.review.lines.some(l => /Please confirm/.test(l.reason)), `7 ${label}: in words`);
    eq(g.earned, 0, `7 ${label}: and nothing is credited from an unconfirmed reading`);
  }
  eq(workingHint(['T_9 = 9 + 8 × 3', '= g + 24', '= 35'])?.kind, 'confirm', '7: before submission the hint is the same question, not a correction');

  // (8) Wrong final answer, valid method: the rubric's marks, no more.
  const { a, d, n } = SAVINGS.stepcheck.substitutions;
  const method = submit(SAVINGS, '1', ['S_n = n/2(2a + (n - 1)d)', `S = ${n}/2 × (2 × ${a} + ${n - 1} × ${d})`, '= 1']);
  eq([method.correct, method.earned, method.possible], [false, 2, 3], '8: a three-mark sum with the formula and the substitution right earns 2 of 3');
  eq(method.review.lines.map(l => [l.criterion, l.mark]), [['formula', 1], ['substitution', 1], [null, 0]], '8: each mark names the criterion that earned it');
  const sa = SUM.stepcheck.substitutions;
  const two = submit(SUM, '1', ['S_n = n/2(2a + (n - 1)d)', `S = ${sa.n}/2 × (2 × ${sa.a} + ${sa.n - 1} × ${sa.d})`, '= 1']);
  eq([two.earned, two.possible], [1, 2], '8: on a two-mark sum the same working earns 1 of 2 — the rubric decides, not the working');
  eq([submit(TERM, '35', FLAGSHIP).earned, submit(TERM, '35', FLAGSHIP).possible], [0, 1], '8: and on the one-mark term question, 0 of 1');

  // (9) Correct final answer over invalid working.
  const lucky = submit(TERM, '33', ['T_9 = 9 + 8 × 3', '= 9 + 26', '= 33']);
  eq([lucky.correct, lucky.earned], [true, 1], '9: the right answer keeps its mark');
  eq([lucky.review.certified, lucky.review.firstMistake?.index, lucky.review.firstMistake?.cls], [false, 1, 'arithmetic-slip'], '9: but the working is not certified, and the invalid line is shown');
  const unseen = submit(TERM, '33', ['the terms go up by three each time', '33']);
  eq([unseen.review.certified, unseen.review.counts.notChecked], [false, 1], '9: a right answer under a line nobody could check is not certified either');

  // (10) A new attempt has a new review: nothing of the old one is in it.
  const first = submit(TERM, '35', FLAGSHIP);
  const second = submit(TERM, '33', ['T_9 = 9 + 8 × 3', '= 33']);
  eq([second.review.lines.length, second.review.firstMistake, second.review.lines.some(l => /35/.test(l.text + l.reason))], [2, null, false], '10: the rewritten working carries no line, mistake or note of the earlier one');
  eq(JSON.stringify(submit(TERM, '35', FLAGSHIP).review), JSON.stringify(first.review), '10: and the same lines always review the same way');
}

// ── 2 · What must never be called a mistake ──────────────────────────────────
// Valid working, written the ways students write it. The audit holds no key,
// so anything it calls a break here would be a false accusation on any question.
{
  const VALID = {
    linear: [['2x + 3 = 11', '2x = 11 - 3', '2x = 8', 'x = 8/2', 'x = 4'], ['3(x - 2) = 12', 'x - 2 = 4', 'x = 6'], ['x/3 + 1 = 5', 'x/3 = 4', 'x = 12'], ['-3x = 12', 'x = -4']],
    quadratic: [['x^2 - 5x + 6 = 0', '(x - 2)(x - 3) = 0', 'x - 2 = 0 or x - 3 = 0', 'x = 2 or x = 3'], ['D = b^2 - 4ac', '= (-5)^2 - 4 × 1 × 6', '= 25 - 24', '= 1'], ['x = (5 ± 1)/2', 'x = 3, x = 2'], ['-3^2 + 10 = 19']],
    simultaneous: [['x + y = 5', 'x - y = 1', '2x = 6', 'x = 3', 'y = 5 - 3 = 2'], ['3x + 2y = 12, x = 2', '6 + 2y = 12', '2y = 6', 'y = 3']],
    inequalities: [['-2x > 6', 'x < -3'], ['3x - 1 <= 8', '3x <= 9', 'x <= 3'], ['5 - x >= 2', '-x >= -3', 'x <= 3']],
    fractions: [['1/2 + 1/3 = 3/6 + 2/6 = 5/6'], ['3 1/2 + 1 1/2 = 5'], ['20% × 150 = 30'], ['15/100 × 80 = 12'], ['1/3 = 0.33'], ['2/3 ≈ 0.67'], ['7/8 = 0.875'], ['3/4 ÷ 3/8 = 3/4 × 8/3 = 2']],
    functions: [['f(x) = 2x + 3', 'f(4) = 2 × 4 + 3', '= 8 + 3', '= 11'], ['y = 2x + 3', 'x = (y - 3)/2', 'f^-1(x) = (x - 3)/2'], ['g(2) = 2^2 - 1 = 3']],
    identities: [['(x + 3)^2 = x^2 + 6x + 9'], ['x^2 - 9 = (x - 3)(x + 3)'], ['(a + b)^2 - (a - b)^2 = 4ab'], ['103^2 = (100 + 3)^2', '= 10000 + 600 + 9', '= 10609'], ['x^2 + 5x + 6', '= x^2 + 2x + 3x + 6', '= x(x + 2) + 3(x + 2)', '= (x + 2)(x + 3)']],
    coordinate: [['d = √((4 - 1)^2 + (6 - 2)^2)', '= √(9 + 16)', '= √25', '= 5'], ['m = (7 - 3)/(4 - 2) = 4/2 = 2'], ['midpoint = ((1 + 5)/2, (2 + 8)/2) = (3, 5)']],
    trig: [['sin 30° = 1/2'], ['tan 45° = 1'], ['sin^2 A + cos^2 A = 1'], ['height = 10 × tan 60° = 10√3'], ['cos 60° = 0.5']],
    mensuration: [['A = πr^2', '= 22/7 × 7 × 7', '= 154 cm^2'], ['V = l × b × h = 5 × 4 × 3 = 60 cm^3'], ['A = 3.14 × 5^2 = 78.5'], ['C = 2 × 3.14 × 10 = 62.8 cm'], ['5 cm × 3 cm = 15 cm^2'], ['1.5 m = 150 cm'], ['2 km = 2000 m'], ['π × 7^2 = 153.94']],
    unconventional: [['9 + 24 = 33 + 2 = 35'], ['9, 12, 15, 18, 21, 24, 27, 30, 33'], ['T_9 = T_8 + d', 'T_8 = 9 + 7 × 3 = 30', 'T_9 = 30 + 3 = 33'], ['a_9 = a_1 + 8d = 9 + 24 = 33'], ['8 x 3 = 24', '9 + 24 = 33'], ['6/2(1 + 2) = 9'], ['6/2(1 + 2) = 1'], ['2 + 3 × 4 = 14'], ['Rs 500 + Rs 250 = Rs 750'], ['₹4500 ÷ 9 = ₹500'], ['180° - 60° - 50° = 70°'], ['1,000 + 500 = 1,500'], ['LHS = 2(3) + 1 = 7', 'RHS = 7', 'LHS = RHS'], ['∴ x = 4.'], ['2^3 × 2^2 = 2^5 = 32'], ['5! = 120'], ['√16 + √9 = 4 + 3 = 7']]
  };
  let valid = 0;
  for (const [topic, cases] of Object.entries(VALID)) {
    for (const lines of cases) {
      valid += 1;
      const audit = auditWorking(lines, { vocabulary: ['x', 'y', 'a', 'b', 'c', 'n', 'd', 'r', 'h', 'l', 'm', 'A'] });
      eq(audit.breaks, [], `valid ${topic} working is not flagged: ${lines.join(' | ')}`);
      ok(workingHint(lines, { vocabulary: ['x', 'y', 'a', 'b', 'c', 'n', 'd', 'r', 'h', 'l', 'm', 'A'] })?.kind !== 'recheck', `and draws no "recheck" hint: ${lines.join(' | ')}`);
      const review = buildWorkingReview({ working: lines.join('\n'), prompt: '$x$, $y$, $a$, $b$, $n$, $d$', correct: true });
      eq(mistakes(review), 0, `nor a mistake in the review with no step metadata: ${lines.join(' | ')}`);
    }
  }
  ok(valid >= 60, `the valid corpus has at least sixty workings (${valid})`);

  // Valid nth-term working in every form the question's own metadata must accept.
  const FORMS = [
    ['T_n = a + (n - 1)d', 'T_9 = 9 + (9 - 1) × 3', '= 9 + 8 × 3', '= 9 + 24', '= 33'],
    ['a_n = a + nd - d', 'a_9 = 9 + 27 - 3 = 33'],
    ['an = a + (n-1)d', 'a9 = 9 + (8)(3) = 33'],
    ['l = a + (n - 1)d = 9 + 8(3) = 9 + 24 = 33'],
    ['n - 1 = 8', '8 × 3 = 24', '9 + 24 = 33'],
    ['T_9 = T_8 + d', 'T_8 = 9 + 7 × 3 = 30', 'T_9 = 30 + 3 = 33'],
    ['9, 12, 15, 18, 21, 24, 27, 30, 33', '9th term = 33'],
    ['a = 9', 'd = 3', 'n = 9', 't_n = a + (n − 1)d', 't_9 = 9 + (9 − 1)(3) = 33'],
    ['d = 3, a = 9', 'T9 = 3 × 8 + 9 = 24 + 9 = 33'],
    ['9th term = 9 + 8 × 3 = 33'],
    ['T_9 = 9 + 8 × 3', '= 9 + 24', '= 33.0']
  ];
  for (const lines of FORMS) {
    const r = submit(TERM, '33', lines);
    eq([r.correct, mistakes(r.review)], [true, 0], `a valid way to the 9th term is not flagged: ${lines.join(' | ')}`);
    ok(!checks(r.review).includes('follows-through') && !checks(r.review).includes('after-mistake'), `and nothing in it is said to follow from a slip: ${lines.join(' | ')}`);
  }
}

// ── 3 · What must be found ───────────────────────────────────────────────────
{
  const SLIPS = [
    // [lines, index of the first mistake, class, a fragment of the correction]
    [['2x = 11 - 3', '2x = 11 - 3 = 9'], 1, 'arithmetic-slip', '11 - 3 = 8, not 9'],
    [['D = 25 - 24', '= 2'], 1, 'arithmetic-slip', '25 - 24 = 1, not 2'],
    [['1/2 + 1/3 = 2/5'], 0, 'arithmetic-slip', '1/2 + 1/3'],
    [['20% × 150 = 300'], 0, 'arithmetic-slip', '= 30, not 300'],
    [['12 ÷ 4 = 4'], 0, 'arithmetic-slip', '12 ÷ 4 = 3, not 4'],
    [['2^3 = 6'], 0, 'arithmetic-slip', '2^3 = 8, not 6'],
    [['(2 + 3) × 4 = 24'], 0, 'arithmetic-slip', '= 20, not 24'],
    [['3 - 5 = 2'], 0, 'sign', '3 - 5 = -2, not 2'],
    [['7 × (-3) = 21'], 0, 'sign', '= -21, not 21'],
    [['f(4) = 2 × 4 + 3', '= 8 + 3', '= 12'], 2, 'arithmetic-slip', '8 + 3 = 11, not 12'],
    [['d = √(9 + 16)', '= √25', '= 6'], 2, 'arithmetic-slip', '√25 = 5, not 6'],
    [['m = (7 - 3)/(4 - 2) = 4/2 = 3'], 0, 'arithmetic-slip', '4/2 = 2, not 3'],
    [['A = 22/7 × 7 × 7', '= 22 × 7', '= 144'], 2, 'arithmetic-slip', '22 × 7 = 154, not 144'],
    [['V = 5 × 4 × 3 = 50'], 0, 'arithmetic-slip', '5 × 4 × 3 = 60, not 50'],
    [['103^2 = (100 + 3)^2', '= 10000 + 600 + 9', '= 10690'], 2, 'arithmetic-slip', '= 10609, not 10690'],
    [['0.5 + 0.25 = 0.57'], 0, 'arithmetic-slip', '0.5 + 0.25 = 0.75, not 0.57'],
    [['1/3 = 0.43'], 0, 'arithmetic-slip', '1/3'],
    [['(x + 3)^2 = x^2 + 6x + 9', '= x^2 + 9'], 1, 'invalid-transformation', 'not the same expression'],
    [['2(x + 3) + x', '= 2x + 3 + x'], 1, 'invalid-transformation', 'not the same expression'],
    [['y = (x^2 - 1)/(x - 1)', '= x - 1'], 1, 'invalid-transformation', 'not the same expression']
  ];
  for (const [lines, at, cls, fragment] of SLIPS) {
    const review = buildWorkingReview({ working: lines.join('\n'), prompt: '$x$', correct: false });
    eq([review.firstMistake?.index, review.firstMistake?.cls], [at, cls], `found: ${lines.join(' | ')}`);
    ok(String(review.firstMistake?.correction).includes(fragment), `with the correction "${fragment}" (${review.firstMistake?.correction})`);
    ok(review.checkedAgainst === 'lines-only' && review.basis === 'deterministic', `with no key and no model: ${lines.join(' | ')}`);
    ok(ERROR_CLASSES.includes(review.firstMistake?.cls) && review.lines.every(l => l.check === null || REVIEW_CHECKS.includes(l.check)), `in the published vocabulary: ${lines.join(' | ')}`);
  }
  // Each operator, right and wrong.
  for (const [expr, value] of [['7 + 8', 15], ['20 - 7', 13], ['6 × 7', 42], ['84 ÷ 7', 12], ['2^5', 32], ['(3 + 4) × 2', 14], ['3 + 4 × 2', 11], ['2.5 × 4', 10], ['0.1 + 0.2', 0.3], ['3/4 + 1/4', 1], ['(1/2)^2', 0.25], ['10 - 2 - 3', 5]]) {
    eq(auditWorking([`${expr} = ${value}`]).lines[0].verdict, 'ok', `${expr} = ${value} is verified`);
    eq(auditWorking([`${expr} = ${value + 1}`]).lines[0].verdict, 'break', `${expr} = ${value + 1} is a slip`);
    eq(auditWorking([expr, `= ${value}`]).lines[1].verdict, 'ok', `${expr} then "= ${value}" on the next line is one chain, verified`);
    eq(auditWorking([expr, '', `   = ${value + 1}`]).firstBreak, 2, `and a wrong continuation after a blank line is found on its own line`);
  }
  // Wrong formula, wrong substitution and a misread given, on the sum question.
  const { a, d, n } = SUM.stepcheck.substitutions;
  const term = a + (n - 1) * d;
  eq(submit(SUM, String(term), ['T_n = a + (n - 1)d', `T = ${a} + ${n - 1} × ${d}`, `= ${term}`]).review.firstMistake?.cls, 'wrong-formula', 'the nth-term formula on a sum question is a wrong formula');
  eq(submit(SUM, '1', [`S_${n} = ${n}/2 × (${a} + ${n - 1} × ${d})`, '= 1']).review.firstMistake?.cls, 'substitution', 'the sum with 2a written as a is a wrong substitution, on that line');
  // …but the last term is also a step towards the sum: S = n/2 × (a + l).
  const sum = SUM.answer.value;
  const viaLast = submit(SUM, String(sum), ['l = a + (n - 1)d', `l = ${a} + ${n - 1} × ${d} = ${term}`, `S = ${n}/2 × (${a} + ${term})`, `= ${sum}`]);
  eq([viaLast.correct, mistakes(viaLast.review), checks(viaLast.review).includes('follows-through')], [true, 0, false], 'the sum by n/2 × (a + l), finding the last term first, is not flagged');
  const viaLastSlip = submit(SUM, String(sum + 3), ['l = a + (n - 1)d', `l = ${a} + ${n - 1} × ${d} = ${term}`, `S = ${n}/2 × (${a} + ${term})`, `= ${sum + 3}`]);
  eq([viaLastSlip.review.firstMistake?.index, viaLastSlip.review.firstMistake?.cls, viaLastSlip.earned], [3, 'arithmetic-slip', 1], 'and a slip at the end of that method is found there, with the substitution mark kept');
  const misread = submit(SUM, '1', [`a = ${a}, d = ${d + 1}`, `S_${n} = ${n}/2 × (2 × ${a} + ${n - 1} × ${d + 1})`, `= ${(n * (2 * a + (n - 1) * (d + 1))) / 2}`]);
  eq([misread.review.firstMistake?.cls, misread.review.firstMistake?.index], ['given-misread', 0], 'a given value copied wrongly is the first mistake, on the line it was copied');
  eq(checks(misread.review).slice(1), ['follows-through', 'follows-through'], 'and the correct work done with it follows through');
}

// ── 4 · A reading to confirm is never an accusation ──────────────────────────
{
  for (const lines of [['9 + 8 × 3', '= g + 24', '= 35'], ['T_q = 9 + 24 = 35'], ['l5 + 3 = 18'], ['9 + 2O = 29'], ['S + 3 = 8'], ['T_9 = 9 + 8 × 3', '= 9 + Z4', '= 33']]) {
    const audit = auditWorking(lines);
    eq(audit.breaks, [], `a letter where a digit probably was is not a mistake: ${lines.join(' | ')}`);
    ok(audit.lines.some(l => l.verdict === 'confirm'), `it is a reading to confirm: ${lines.join(' | ')}`);
    eq(buildWorkingReview({ working: lines.join('\n'), correct: false }).firstMistake, null, `and the review accuses no line: ${lines.join(' | ')}`);
  }
  // A letter the question uses, or the working uses twice, is a name.
  eq(auditWorking(['2b = 6', 'b = 3']).lines.map(l => l.verdict), ['open', 'open'], 'a letter used on two lines is the student\'s own name, not a misread digit');
  eq(auditWorking(['g + 24 = 30'], { vocabulary: ['g'] }).lines[0].verdict, 'open', 'nor is a letter the question itself uses');
  // Ambiguous notation is read both ways; when either reading fits, nothing is said.
  for (const line of ['-3^2 = 9', '-3^2 = -9', '6/2(1 + 2) = 9', '6/2(1 + 2) = 1', '3 1/2 = 3.5', '2 1/4 + 1/4 = 2.5']) eq(auditWorking([line]).lines[0].verdict, 'ok', `${line} is accepted`);
  for (const line of ['9 24 = 33', '1,000 + 5 = 1006', 'sin 30 = 0.6', 'log 100 = 3', '2^3^2 = 60']) ok(auditWorking([line]).breaks.length === 0, `${line} cannot be read safely, so it is not judged`);
  // A contradiction reached, a test that fails and a question asked are not slips.
  for (const lines of [['2x + 3 = 2x + 8', '3 = 8', 'no solution'], ['0 = 5'], ['Is 2 a root? 4 - 10 + 7 = 0'], ['check: 2(2) + 3 = 11'], ['if x = 2, 4 - 10 + 7 = 0', 'so 2 is not a root'], ['LHS = 4 - 10 + 7 = 1', 'RHS = 0'], ['verify 3 + 4 = 8']]) {
    eq(auditWorking(lines, { vocabulary: ['x'] }).breaks, [], `not a slip: ${lines.join(' | ')}`);
  }
  eq(auditWorking(['T = 9 + 24', '= 33', '= 35']).firstBreak, 2, 'but a value that changes from one line of a chain to the next is one');
  eq(auditWorking(['7/2 = 3']).lines[0].verdict, 'approx', 'a value cut short is neither ticked nor crossed');
  eq(buildWorkingReview({ working: '7/2 = 3\n= 3', correct: false }).lines[0].check, 'not-checked', 'and the review says it was not checked exactly');
  eq(auditWorking(['8 x 3 = 25'], { vocabulary: [] }).lines[0].verdict, 'confirm', 'a slip that depends on reading x as × is a reading to confirm');
  eq(auditWorking(['8 x 3 = 25'], { vocabulary: ['x'] }).lines[0].verdict, 'open', 'and where the question has an x, x is x');
  eq([...promptLetters('Solve $2x + 3 = 11$ for $x$, where $\\dfrac{a}{b} = \\sin\\theta$.')].sort(), ['a', 'b', 'x'], 'the question\'s letters are read from its mathematics, not its words or its commands');
}

// ── 5 · Marks: preserved, never invented, never for a guess ──────────────────
{
  const { a, d, n } = SAVINGS.stepcheck.substitutions;
  const total = SAVINGS.answer.value;
  const formula = 'S_n = n/2(2a + (n - 1)d)';
  const substitution = `S = ${n}/2 × (2 × ${a} + ${n - 1} × ${d})`;
  const earned = lines => submit(SAVINGS, '1', lines).earned;
  eq(marksPossibleFor(SAVINGS), 3, 'the savings question carries three marks');
  eq(earned([formula]), 1, 'the formula alone: 1');
  eq(earned([substitution]), 1, 'the substitution alone: 1');
  eq(earned([formula, substitution]), 2, 'both: 2 — capped one below full marks');
  eq(earned([formula, substitution, `= ${n}/2 × ${2 * a + (n - 1) * d}`, `= ${total}`]), 2, 'more correct lines add nothing beyond the rubric');
  eq(earned([formula, formula, formula]), 1, 'the formula three times is one criterion');
  eq(earned([`a = ${a}, d = ${d}, n = ${n}`]), 0, 'restating the given values earns nothing');
  eq(earned([`a = ${a}`, `d = ${d}`, `n = ${n}`, `n - 1 = ${n - 1}`, `2 × ${a} = ${2 * a}`]), 0, 'nor does true arithmetic on the side');
  eq(earned([`S = ${total}`]), 0, 'nor the bare answer under a wrong final answer');
  eq(earned([`S = ${total - 5}`, `S = ${total}`, `S = ${total + 5}`]), 0, 'nor a list of tries');
  eq(earned([`S = ${total - 6} + 1`, `S = ${total - 6} + 6`, `S = ${total - 6} + 9`]), 0, 'nor a list of tries dressed as sums');
  eq(earned(['S_n = n(a + (n - 1)d)', substitution]), 0, 'nothing after a wrong formula');
  eq(earned([substitution.replace(`2 × ${a}`, `${a}`)]), 0, 'a wrong substitution earns nothing');
  eq(earned(['the answer is big', 'I added them all']), 0, 'prose earns nothing');
  eq(earned([`S = ${n}/2 × (2 × g + ${n - 1} × ${d})`]), 0, 'a line with an unconfirmed reading earns nothing');
  eq(submit(SAVINGS, String(total), ['nonsense = 1']).earned, 3, 'a right answer has full marks whatever the working says');
  // The marks in the review are the marker's own.
  const r = submit(SAVINGS, '1', [formula, substitution, '= 1']);
  eq(r.review.lines.reduce((s, l) => s + (l.mark || 0), 0), r.partial.awarded, 'the per-line marks in the review sum to the method marks awarded');
  // Every formula question of the bank: metadata is consistent with the answer key.
  let formulaQuestions = 0;
  for (const difficulty of [1, 2, 4]) {
    for (let seed = 1; seed <= 400; seed += 1) {
      const q = generateQuestion('c10-arithmetic-progressions', difficulty, seed);
      if (q.stepcheck?.kind !== 'formula') continue;
      formulaQuestions += 1;
      const plan = formulaPlan(q.stepcheck);
      if (!plan || plan.expected !== q.answer.value) { ok(false, `formula metadata disagrees with the answer key (difficulty ${difficulty}, seed ${seed})`); continue; }
      const { a: A, d: D, n: N } = q.stepcheck.substitutions;
      const paren = v => (v < 0 ? `(${v})` : String(v));
      const sub = plan.source.includes('n/2') ? `${N}/2 × (2 × ${paren(A)} + ${N - 1} × ${paren(D)})` : `${paren(A)} + ${N - 1} × ${paren(D)}`;
      const good = stepCheckFormula(q.stepcheck, `X = ${sub}\n= ${q.answer.value}`);
      const bad = stepCheckFormula(q.stepcheck, `X = ${sub}\n= ${q.answer.value + 2}`);
      if (good.firstBreak !== -1 || bad.firstBreak !== 1 || good.lines[0].role !== 'substitution') ok(false, `difficulty ${difficulty} seed ${seed}: correct substitution ${sub} → ${JSON.stringify([good.firstBreak, bad.firstBreak, good.lines[0].role])}`);
    }
  }
  ok(formulaQuestions >= 1000, `every generated formula question was checked against its own key (${formulaQuestions})`);
  ok(true, 'and on each, the correct substitution is verified and a slip of 2 on the last line is the first mistake');
}

// ── 6 · The pre-submission hint is key-free and never states the value ───────
{
  const hint = workingHint(FLAGSHIP);
  eq(hint, { index: 4, kind: 'recheck', cls: 'arithmetic-slip', text: 'Recheck 9 + 24.' }, 'the hint for the owner\'s page points at 9 + 24 on the last line');
  eq(workingHint([...FLAGSHIP.slice(0, 4), '= 33']), null, 'correct working draws no hint');
  eq(workingHint(['T_9 = 9 + 8 × 3', '= 30']), { index: 1, kind: 'recheck', cls: 'arithmetic-slip', text: 'Recheck 9 + 8 × 3.' }, 'a slip is hinted wherever it is');
  // It is computed from the lines alone: the same for every question.
  eq(workingHint(['x = 5', 'x = 7', '2x = 99']), null, 'lines about an unknown draw no hint — that would need the answer');
  eq(workingHint(['T_9 = 35']), null, 'a wrong final value with no arithmetic draws no hint');
  eq(workingHint(['S_9 = 9/2(2 × 9 + 8 × 3)', '= 189']), null, 'nor does a wrong formula evaluated correctly: only the key could say so');
  for (const lines of [FLAGSHIP, ['12 ÷ 4 = 4'], ['3 - 5 = 2'], ['(x + 3)^2 = x^2 + 6x + 9', '= x^2 + 9'], ['1/2 + 1/3 = 2/5']]) {
    const h = workingHint(lines, { vocabulary: ['x'] });
    const truth = describeBreak(breakOn(auditWorking(lines, { vocabulary: ['x'] }).lines.find(l => l.verdict === 'break')));
    const value = truth.correction.match(/= (-?[\d.]+), not/)?.[1];
    ok(h && h.kind === 'recheck', `a hint is offered: ${lines.join(' | ')}`);
    ok(!value || !new RegExp(`(^|[^\\d.])${value.replace('.', '\\.')}([^\\d.]|$)`).test(h.text.replace(lines.join(' '), '')) || lines.join(' ').includes(value), `and it does not state the right value ${value}: "${h?.text}"`);
    ok(!/not |should|answer|correct value/i.test(h.text), `nor say what the line should be: "${h?.text}"`);
  }
  // Statically: the audit imports nothing that could hold a key.
  const source = readFileSync(new URL('../src/engine/lineAudit.js', import.meta.url), 'utf8');
  eq([...source.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['./expr.js'], 'lineAudit.js imports the expression engine and nothing else');
  ok(!/\b(answer|solution|expected|stepcheck|stepMeta|marks)\b/.test(source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'and its code never names an answer, a solution, an expected value or a mark');
}

// ── 7 · Resource bounds ──────────────────────────────────────────────────────
{
  eq({ ...AUDIT_LIMITS }, { ...WORKING_LIMITS }, 'the audit reads working under the same bounds as Step Check');
  const timed = (label, lines, ms, meta = TERM.stepcheck) => {
    const at = performance.now();
    const audit = auditWorking(lines);
    const report = stepCheck(meta, lines.join('\n'));
    methodMarks({ meta, working: lines.join('\n'), marks: 4 });
    const review = buildWorkingReview({ meta, working: lines.join('\n'), report, correct: false });
    const took = performance.now() - at;
    ok(took < ms, `${label}: audited, checked, marked and reviewed in ${Math.round(took)} ms (limit ${ms})`);
    return { audit, report, review };
  };
  const long = timed('a line of 12 000 characters', ['T_9 = ' + '9+'.repeat(6000) + '9', '= 35'], 400);
  eq([long.audit.lines[0].verdict, long.audit.breaks, long.report.lines[0].status], ['unread', [], 'note'], 'a line too long to read is not read, not judged, and breaks nothing');
  const many = timed('five hundred lines', Array.from({ length: 500 }, (_, i) => `${i} + 1 = ${i + 1}`), 900);
  eq([many.audit.lines[99].verdict, many.audit.lines[100].verdict, many.audit.lines[499].verdict], ['ok', 'unread', 'unread'], 'only the first hundred lines are read');
  ok(many.review.lines.slice(100).every(l => l.check === 'not-checked' && l.mark === 0), 'and what is not read is neither a mistake nor credit');
  timed('a hundred lines at the character limit', Array.from({ length: 100 }, () => '(' + '1+'.repeat(98) + '1)'.padEnd(3, ' ') + ' = 99'), 900);
  timed('deep nesting', ['T = ' + '('.repeat(90) + '1' + ')'.repeat(90), '= 2'], 400);
  timed('a huge power', ['9^9^9^9 = 1', '2^99999 = 3', '170! + 170! = 5'], 400);
  timed('a sum that would run for seconds', ['sum(sum(k;k;1;10000);j;1;10000) = 1', '= 2'], 900);
  timed('a ladder of equals signs', [Array.from({ length: 60 }, (_, i) => String(i)).join(' = ')], 400);
  timed('fifty statements on a line', [Array.from({ length: 40 }, (_, i) => `a = ${i}`).join(', ').slice(0, 199)], 400);
  timed('symbolic chains', Array.from({ length: 100 }, () => '(x+1)^9 = (x+1)^9 = (x+1)^8(x+1)'), 1400, { kind: 'expression', canonical: '(x+1)^9' });
  timed('catastrophic-backtracking bait', [' '.repeat(190) + '=', '(' + ' '.repeat(180) + ')', '=' + '≈'.repeat(150), 'so '.repeat(60) + '1 = 1'], 400);
  const junk = timed('non-mathematical input', ['<script>alert(1)</script>', '{"answer":33}', '\u0000\u0001 = 3', '= = = =', '∴∴∴', '९ + २४ = ३३'], 400);
  eq(junk.audit.breaks, [], 'junk is never a mistake');
  // The whole server operation, on the owner's page, a hundred times.
  const at = performance.now();
  for (let i = 0; i < 100; i += 1) submit(TERM, '35', FLAGSHIP);
  const each = (performance.now() - at) / 100;
  ok(each < 15, `one submission of the owner's page is marked and reviewed in ${each.toFixed(2)} ms (a hundredth of the marker's 1500 ms deadline)`);
}

console.log(failures.length
  ? `FIRST MISTAKE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `FIRST MISTAKE: PASS — ${pass}/${pass} checks — the first independent mistake is found on the line it was made, what follows from it is not marked again, a doubtful reading is confirmed rather than accused, valid working is never flagged, and marks come from the rubric alone.`);
process.exit(failures.length ? 1 : 0);
