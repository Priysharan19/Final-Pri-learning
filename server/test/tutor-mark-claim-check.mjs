// A model explanation never states or implies a mark, and the existing guards still hold.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { markClaimIssues } from '../platform/tutorGuard.js';
import { diagnosisIssues, deterministicDiagnosis } from '../platform/tutor.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };

const claims = [
  'You lost 2 marks here.', 'That is worth full marks.', 'Your score would be low.', 'This earns partial credit.', 'You passed this step.',
  'That is 3 out of 4.', 'Marked as wrong.', 'A grade of C.', '75% correct so far.', '5 points deducted.',
  'यहाँ आपके अंक कटेंगे।', 'इसका ग्रेड कम होगा।', 'प्रतिशत कम आएगा।', 'आपको पूरे अंक मिलेंगे।'
];
for (const c of claims) ok(markClaimIssues(c).length === 1, `refused: ${c}`);
const fine = [
  'The sign changed when the term crossed the equals sign.', 'Line 2 does not follow from line 1.', 'The points of intersection are where the lines meet.',
  'Divide each term by its new power.', 'दूसरी पंक्ति पहली पंक्ति से नहीं निकलती।', 'घात बढ़ाने के बाद नई घात से भाग दीजिए।', 'x = 3/4', ''
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
// The deterministic message never speaks of a mark either.
for (const locale of ['en', 'hi']) {
  const d = deterministicDiagnosis({ ...request(true), locale });
  ok(markClaimIssues([d.didRight, d.wentWrong, d.nextStep].join(' ')).length === 0, `the deterministic ${locale} message states no mark`);
}
console.log(`TUTOR MARK CLAIM: PASS — ${n}/${n} checks — a model explanation never states a mark, linear time, deterministic message unchanged`);
