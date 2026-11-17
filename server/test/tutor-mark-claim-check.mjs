// A model explanation never states or implies a mark, and the existing guards still hold.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { markClaimIssues, replyMarkClaimIssues, buildGuard, leakedExpressions, statedRanges } from '../platform/tutorGuard.js';
import { diagnosisIssues, deterministicDiagnosis } from '../platform/tutor.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };

const claims = [
  'You lost 2 marks here.', 'That is worth full marks.', 'Your score would be low.', 'This earns partial credit.', 'You passed this step.',
  'That is 3 out of 4.', 'Marked as wrong.', 'A grade of C.', '75% correct so far.', '5 points deducted.',
  'यहाँ आपके अंक कटेंगे।', 'इसका ग्रेड कम होगा।', 'आपको पूरे अंक मिलेंगे।'
];
for (const c of claims) ok(markClaimIssues(c).length === 1, `refused: ${c}`);
const fine = [
  'The sign changed when the term crossed the equals sign.', 'Line 2 does not follow from line 1.', 'The points of intersection are where the lines meet.',
  'Divide each term by its new power.', 'दूसरी पंक्ति पहली पंक्ति से नहीं निकलती।', 'घात बढ़ाने के बाद नई घात से भाग दीजिए।', 'x = 3/4', 'अंकगणित का नियम लगाइए।', 'इन अंकों का योग देखिए।', 'What percentage of the circle is shaded?', 'Mark the point on the graph.'
];
for (const c of fine) ok(markClaimIssues(c).length === 0, `allowed: ${c}`);
ok(markClaimIssues('a'.repeat(30_000)).length === 1, 'an over-long reply is refused, not scanned');
const t0 = Date.now(); markClaimIssues(`${'1 '.repeat(5000)}out of ${' '.repeat(5000)}`); ok(Date.now() - t0 < 200, 'linear time on adversarial input');

// Through the diagnosis guard: open and resolved attempts both refuse a mark claim.
const question = { prompt: 'Integrate x squared.', steps: [{ h: 'Raise the power and divide', d: 'x cubed over three' }], answer: 'x^3/3 + c', hints: [] };
const request = resolved => ({ locale: 'en', resolved, question, studentWork: { lines: ['x^2 integrated is x^3'], firstBreak: 0, verifiedLines: 0, lineStatus: ['break'] } });
const clean = { didRight: 'You raised the power.', wentWrong: 'Line 1 skipped the division.', nextStep: 'Divide by the new power.', revealsAnswer: false };
for (const resolved of [false, true]) {
  ok(diagnosisIssues(clean, request(resolved)).filter(i => i === 'mark-claim').length === 0, `a clean explanation passes (resolved=${resolved})`);
  for (const field of ['didRight', 'wentWrong', 'nextStep']) {
    const issues = diagnosisIssues({ ...clean, [field]: 'You would get full marks for this.' }, request(resolved));
    ok(issues.includes('mark-claim'), `a mark claim in ${field} is refused (resolved=${resolved})`);
  }
}
// Hints, "why" and streamed replies refuse a mark claim too (AI red-team, 2026-11-18);
// on a percentage question "percent" is the mathematics, not a score.
const linear = { prompt: 'Solve 3x + 5 = 20.' };
for (const t of ['Great work — that earns you full marks for this step!', 'You would get full marks here.', "You'd get 2 marks here.", "You've earned 2 marks.", 'You scored 3', 'you passed', 'Perfect score!', "That's 10/10!", 'That would score well.', "You'll be marked correct.", 'This would be marked right.', 'Top marks!', 'Ten out of ten!', 'Youve earned 2 marks', 'That costs you 2 marks.', 'You lost marks for this step.', 'This is worth 3 marks.', 'You passed this question.', 'आपको पूरे अंक मिलेंगे।']) {
  ok(replyMarkClaimIssues(t, linear).length === 1, `a hint claiming a mark is refused: ${t}`);
}
// …and the everyday maths words stay hints (#1001 review).
for (const t of ['Multiply 4 by 3 and you get 12; now compare.', 'You get 2 equations; solve them together.', 'When you expand (x+1)^2 you get 3 terms.', "You've got 3 terms on the left.", "That's 3/4 of the whole bar.", 'This is 3/4, so shade three parts.', 'That is 2 out of 6 outcomes.', 'Look at a score of 12 out of 20 in the table.', 'It looks like you failed to change the sign.', 'You failed to carry the 1.', 'You passed 3 on the number line; go back.', 'The line has passed through (0, 2) already.', "It's a line through 2 points.", 'Plot 3 points and join them.', 'The marked angle is 40°.', 'The graph passed through (0, 2).', 'Find the score of the third batsman.', 'Look at the graded scale.', 'There is a 25% chance of rain.', 'Think about what percent means here: per hundred.']) {
  ok(replyMarkClaimIssues(t, linear).length === 0, `an ordinary hint passes: ${t}`);
}
// A range that brackets the answer, in any wording, is a leak.
const g = buildGuard({ prompt: 'Solve 3x + 5 = 20.', steps: [{ h: 'Subtract 5', d: '$3x = 15$' }, { h: 'Divide by 3', d: '$x = 5$' }], answer: 'x = 5', hints: [] });
for (const r of ['x is somewhere from 4 to 6.', 'It lies 4 to 6.', 'The answer is from 4 to 6.', 'x is roughly 4 to 6.', "It's 4 to 6.", 'x = 4 to 6', 'x: 4 to 6', "the answer's from 4 to 6", 'x is likely 4 to 6', 'Try the whole numbers from 4 to 6.', 'उत्तर 4 से 6 के बीच है।', 'उत्तर 4 से 6 तक है।', 'between 4 and 6']) {
  ok(leakedExpressions(r, g, { prompt: 'Solve 3x + 5 = 20.' }).some(l => l.startsWith('range')), `range leak caught: ${r}`);
}
ok(leakedExpressions('It lies from 6 to 9.', g, { prompt: 'Solve 3x + 5 = 20.' }).every(l => !l.startsWith('range')), 'a range that does not bracket the answer is not a leak');
ok(statedRanges('x lies from 1 to 2').length === 1 && statedRanges('add 3 to both sides').length === 0, 'ranges are read only between two numbers');
for (const t of ['Go from 20 to 3 groups.', 'Count up from 1 to 9 on the number line.', 'Now add 3 to 12.', 'The odds are 1 to 9.', 'Step 1: 3 to 12 is a jump of 9.']) {
  ok(!leakedExpressions(t, g, { prompt: 'Solve 3x + 5 = 20.' }).some(l => l.startsWith('range')), `not a range claim: ${t}`);
}
const t1 = Date.now(); statedRanges(`${'1 to '.repeat(4000)}1`); ok(Date.now() - t1 < 200, 'range reading stays linear');

// The deterministic message never speaks of a mark either.
for (const locale of ['en', 'hi']) {
  const d = deterministicDiagnosis({ ...request(true), locale });
  ok(markClaimIssues([d.didRight, d.wentWrong, d.nextStep].join(' ')).length === 0, `the deterministic ${locale} message states no mark`);
}
console.log(`TUTOR MARK CLAIM: PASS — ${n}/${n} checks — a model explanation or hint never states a mark, a bracketing range in any wording is a leak, linear time, deterministic message unchanged`);
