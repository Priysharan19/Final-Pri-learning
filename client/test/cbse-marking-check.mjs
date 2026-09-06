// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · marking the way a board examiner marks
//
// CBSE awards marks per step: formula, substitution, final answer with units.
// Correct method with a slip in the arithmetic still earns most of the marks;
// an answer written with no working earns only the answer mark. Every Indian
// student is told this and almost none get to practise it, because the person
// who would mark their working is teaching twenty-seven other children.
//
// So the marking here has to be right in the specific ways a board is right:
//
//   · method survives a wrong answer;
//   · one slip costs one mark, not the question;
//   · no working shown means no step marks, said plainly rather than hidden;
//   · a missing unit costs the answer mark, because it does in the exam;
//   · a one-mark question has no step marks to give;
//   · and none of this is ever called CBSE's official scheme, because it is
//     derived from the question's own worked solution and is not that document.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MARK_KINDS, awardStepMarks, classifyStep, markScheme, marksSentence, requiresUnits, unitsPresent
} from '../src/engine/cbseMarking.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// A real generated question, copied from c11-sets at difficulty 2.
const SETS = {
  marks: 3,
  prompt: 'In a class, n(A) = 12, n(B) = 11 and n(A ∩ B) = 9. Find n(A ∪ B).',
  answer: { value: 14 },
  steps: [
    { h: 'The addition rule for sets', d: 'n(A ∪ B) = n(A) + n(B) − n(A ∩ B)' },
    { h: 'Substitute', d: '= 12 + 11 − 9' },
    { h: 'Evaluate', d: '= 14' }
  ]
};
const WITH_UNITS = { ...SETS, marks: 3, answerSuffix: 'cm', answer: { value: 14 } };
const report = statuses => ({ lines: statuses.map(status => ({ status })) });

// ── 1 · The scheme reads the solution the way an examiner does ───────────────
const scheme = markScheme(SETS);
eq(scheme.total, 3, 'a three-mark question carries three marks');
eq(scheme.rows.length, 3, 'spread over three scheme points');
eq(scheme.rows[0].kind, MARK_KINDS.METHOD, 'the rule stated first is the method mark');
eq(scheme.rows[1].kind, MARK_KINDS.SUBSTITUTION, 'putting the values in is the substitution mark');
eq(scheme.rows[2].kind, MARK_KINDS.ANSWER, 'and the last mark is the answer');
eq(scheme.rows[2].marks, 1, 'the answer is worth exactly one mark, which is why method still pays');
eq(scheme.stepMarks, 2, 'leaving two step marks available to a wrong answer');

const oneMark = markScheme({ ...SETS, marks: 1 });
eq(oneMark.stepMarks, 0, 'a one-mark question has no step marks — it IS the answer mark');
eq(oneMark.rows.length, 1, 'and one scheme row, not an invented breakdown');

// ── 2 · Method survives a wrong answer ───────────────────────────────────────
// The student states the rule, substitutes correctly, then slips: 12+11−9 = 15.
const slipped = awardStepMarks({
  question: SETS,
  workingLines: ['n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', '= 12 + 11 − 9', '= 15'],
  stepReport: report(['ok', 'ok', 'break']),
  answerText: '15',
  correct: false
});
eq(slipped.awarded, 2, 'formula and substitution are credited though the answer is wrong');
eq(slipped.total, 3, 'out of three');
eq(slipped.rows[2].earned, 0, 'and the answer mark is not');
ok(/method is/i.test(marksSentence(slipped)), 'and the student is told the method earned marks');

// ── 3 · One slip costs one mark, not the question ────────────────────────────
// A break early on, then three sound lines carried from the student's own wrong
// value. A board carries the error forward; so must this.
const carried = awardStepMarks({
  question: { ...SETS, marks: 4, steps: [...SETS.steps, { h: 'State the answer', d: '14' }] },
  workingLines: ['rule', 'wrong substitution', 'follows from it', 'and so does this'],
  stepReport: report(['ok', 'break', 'note', 'note']),
  answerText: 'x',
  correct: false
});
ok(carried.awarded >= 2, `work carried after one slip still earns marks (got ${carried.awarded}/${carried.total})`);
ok(carried.awarded < carried.total, 'but not all of them, because the answer is wrong');

// ── 4 · No working shown is the rule students most need told ─────────────────
const bare = awardStepMarks({ question: SETS, workingLines: [], stepReport: null, answerText: '14', correct: true });
eq(bare.awarded, 1, 'a correct answer with no working earns the answer mark only');
eq(bare.lostToNoWorking, 2, 'and forfeits the two step marks');
eq(bare.showedWorking, false, 'which is recorded, not hidden');
const sentence = marksSentence(bare);
ok(/only the answer/i.test(sentence) && /show the working/i.test(sentence),
  'and the student is told exactly what it cost and what to do instead');
ok(/board exam/i.test(sentence), 'in the terms that make it matter to them');

// ── 5 · A missing unit costs the answer mark, because it does in the exam ────
ok(requiresUnits(WITH_UNITS), 'a question with a unit suffix requires units');
ok(!requiresUnits(SETS), 'one without does not');
ok(unitsPresent(WITH_UNITS, ['area = 14 cm'], '14 cm'), 'units written anywhere in the working count');
ok(!unitsPresent(WITH_UNITS, ['= 14'], '14'), 'and their absence is detected');

const noUnits = awardStepMarks({
  question: WITH_UNITS,
  workingLines: ['n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', '= 12 + 11 − 9', '= 14'],
  stepReport: report(['ok', 'ok', 'ok']),
  answerText: '14',
  correct: true
});
eq(noUnits.unitsMissing, true, 'the value is right and the unit is missing');
eq(noUnits.rows[noUnits.rows.length - 1].earned, 0, 'so the answer mark is withheld');
eq(noUnits.awarded, 2, 'and the step marks still stand');
ok(/unit is missing/i.test(marksSentence(noUnits)), 'and the reason is named — this is the most commonly lost mark in board maths');

const withUnits = awardStepMarks({
  question: WITH_UNITS,
  workingLines: ['n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', '= 12 + 11 − 9', '= 14 cm'],
  stepReport: report(['ok', 'ok', 'ok']),
  answerText: '14 cm',
  correct: true
});
eq(withUnits.awarded, 3, 'written with its unit, the same work earns full marks');

// ── 6 · Nothing is credited that could not be verified ───────────────────────
const unverifiable = awardStepMarks({
  question: SETS,
  workingLines: ['something', 'something else'],
  stepReport: report(['note', 'note']),
  answerText: '14',
  correct: true
});
eq(unverifiable.awarded, 1, 'lines the checker could not verify earn nothing — only the answer mark stands');
ok(unverifiable.creditedLines === 0, 'and none are counted as credit');

// ── 7 · An award never exceeds the scheme ────────────────────────────────────
const generous = awardStepMarks({
  question: SETS,
  workingLines: Array.from({ length: 12 }, (_, i) => `line ${i}`),
  stepReport: report(Array.from({ length: 12 }, () => 'ok')),
  answerText: '14',
  correct: true
});
eq(generous.awarded, 3, 'twelve correct lines do not earn more than the question is worth');
ok(generous.rows.every(r => r.earned <= r.outOf), 'and no scheme row is over-awarded');

// ── 8 · It never claims to be the official document ──────────────────────────
eq(scheme.rows.every(r => typeof r.label === 'string' && r.label.length > 0), true, 'every scheme row is labelled for the student');
eq(awardStepMarks({ question: SETS, workingLines: [], correct: false }).schemeKind, 'board-style-derived',
  'the award records that the scheme is derived from the worked solution');
const source = await import('node:fs').then(fs => fs.readFileSync('client/src/engine/cbseMarking.js', 'utf8'));
ok(/not CBSE's own marking scheme|is not the official document/i.test(source),
  'and the module says in words that it is not the official CBSE scheme');
ok(!/official CBSE marking scheme for this question|CBSE official scheme/i.test(source),
  'and never claims otherwise anywhere in the file');

console.log(failures.length
  ? `CBSE STEP MARKING: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CBSE STEP MARKING: PASS — ${pass}/${pass} checks — method survives a wrong answer, one slip costs one mark, no working means no step marks, a missing unit costs the answer.`);
process.exit(failures.length ? 1 : 0);
