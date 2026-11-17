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
const linear = { prompt: 'Solve 3x + 5 = 20.' }, pct = { prompt: 'What is 20% of 50?' };
ok(replyMarkClaimIssues('Great work — that earns you full marks for this step!', linear).length === 1, 'a hint claiming full marks is refused');
ok(replyMarkClaimIssues('That would score well.', linear).length === 1, 'a hint claiming a score is refused');
ok(replyMarkClaimIssues('Think about what percent means here: per hundred.', pct).length === 0, 'percent on a percentage question is maths');
ok(replyMarkClaimIssues('You got 100% of the marks.', pct).length === 1, 'a mark claim on a percentage question is still refused');
// A range that brackets the answer, in any wording, is a leak.
const g = buildGuard({ prompt: 'Solve 3x + 5 = 20.', steps: [{ h: 'Subtract 5', d: '$3x = 15$' }, { h: 'Divide by 3', d: '$x = 5$' }], answer: 'x = 5', hints: [] });
for (const r of ['x is somewhere from 4 to 6.', 'It lies 4 to 6.', 'उत्तर 4 से 6 के बीच है।', 'उत्तर 4 से 6 तक है।', 'between 4 and 6']) {
  ok(leakedExpressions(r, g, { prompt: 'Solve 3x + 5 = 20.' }).some(l => l.startsWith('range')), `range leak caught: ${r}`);
}
ok(leakedExpressions('It lies from 6 to 9.', g, { prompt: 'Solve 3x + 5 = 20.' }).every(l => !l.startsWith('range')), 'a range that does not bracket the answer is not a leak');
ok(statedRanges('from 1 to 2').length === 1 && statedRanges('add 3 to both sides').length === 0, 'ranges are read only between two numbers');
const t1 = Date.now(); statedRanges(`${'1 to '.repeat(4000)}1`); ok(Date.now() - t1 < 200, 'range reading stays linear');

// The deterministic message never speaks of a mark either.
for (const locale of ['en', 'hi']) {
  const d = deterministicDiagnosis({ ...request(true), locale });
  ok(markClaimIssues([d.didRight, d.wentWrong, d.nextStep].join(' ')).length === 0, `the deterministic ${locale} message states no mark`);
}
console.log(`TUTOR MARK CLAIM: PASS — ${n}/${n} checks — a model explanation or hint never states a mark, a bracketing range in any wording is a leak, linear time, deterministic message unchanged`);
