// The Index register's truth rules (client/src/instrument/margin/register.js):
// overall accuracy waits for PROGRESS_THRESHOLDS.overallAccuracy answers, the
// "correct" figure is withheld with it, and the dial's whole number is the
// shared claim rounded, so it always agrees with the Report's 0.1 figure.
import { registerOf } from '../src/instrument/margin/register.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../src/engine/progressTruth.js';

let failed = 0; let passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL ${name} ${detail}`); } };
const ch = (attempts, correct) => ({ evidence: { attempts, correct } });
const reg = rows => registerOf(rows, accuracyClaim, PROGRESS_THRESHOLDS);

check('the overall floor is the Report\'s, 10 answers', PROGRESS_THRESHOLDS.overallAccuracy === 10);
for (const n of [6, 7, 8, 9]) {
  const r = reg([ch(n, n - 1), ch(0, 0)]);
  check(`${n} answers: the hand is held at rest (accuracy withheld)`, r.accuracy === null, JSON.stringify(r));
  check(`${n} answers: "correct" is withheld with it`, r.correct === null, JSON.stringify(r));
  check(`${n} answers: answers still count`, r.answers === n);
}
const r5 = reg([ch(5, 5)]);
check('5 answers in one chapter (its own floor) still withhold the overall figure', r5.accuracy === null && r5.correct === null);
const r10 = reg([ch(6, 4), ch(4, 3)]);
check('10 answers across chapters state accuracy as a whole number', r10.accuracy === 70 && r10.correct === 7, JSON.stringify(r10));
// One rounding path: the dial's whole number is the shared claim (the Report's
// 0.1 figure) rounded, so the two always agree.
for (const [n, c] of [[2000, 1249], [200, 125], [10, 7], [3, 2], [11, 7], [1000, 999], [997, 623], [12, 12], [10, 0]]) {
  const r = reg([ch(n, c)]);
  const claim = accuracyClaim(c, n, PROGRESS_THRESHOLDS.overallAccuracy);
  const want = claim.enough ? Math.round(claim.value) : null;
  check(`${c}/${n}: the dial agrees with accuracyClaim (${claim.value} → ${want})`, r.accuracy === want, JSON.stringify(r));
}
check('1249/2000 is 62.5 in the Report, so 63 on the dial', reg([ch(2000, 1249)]).accuracy === 63);
check('chapters started and covered', reg([ch(3, 1), ch(0, 0)]).started === 1 && reg([ch(3, 1), ch(0, 0)]).covered === 50);
check('the date window never needs a decimal', Number.isInteger(reg([ch(37, 23)]).accuracy));

console.log(`${passed}/${passed + failed} index register checks passed`);
process.exit(failed ? 1 : 0);
