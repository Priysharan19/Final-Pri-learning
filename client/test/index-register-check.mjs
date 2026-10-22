// The Index register's truth rules (client/src/instrument/margin/register.js):
// overall accuracy waits for PROGRESS_THRESHOLDS.overallAccuracy answers, the
// "correct" figure is withheld with it, and the dial's whole number is the
// shared claim rounded, so it always agrees with the Report's 0.1 figure.
import { registerOf } from '../src/instrument/margin/register.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../src/engine/progressTruth.js';
import { scopeFor, chapterEvidence } from '../src/instrument/chapters.js';

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

// One register over the student's own syllabus: the Index builds it from
// scopeFor(curriculum, user) only, so another class's or track's chapters never
// enter it, and a second evidence load replaces every figure together.
const fromCurriculum = (curriculum, user) => {
  const scope = scopeFor(curriculum, user);
  const rows = (scope?.chapters || scope?.subtopics || []).map(row => ({ evidence: chapterEvidence(row, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy) }));
  return registerOf(rows, accuracyClaim, PROGRESS_THRESHOLDS);
};
const user10 = { year: 10, course: 'in' };
const own = n => Array.from({ length: n }, (_, i) => ({ id: `c10-${i}`, name: `C10 ${i}`, attempts: 10, correct: 6 }));
const other = n => Array.from({ length: n }, (_, i) => ({ id: `c9-${i}`, name: `C9 ${i}`, attempts: 10, correct: 10 }));
const cur1 = { years: [{ year: 9, chapters: other(11) }, { year: 10, chapters: own(14) }], streams: [{ track: 'jee-main', chapters: other(30) }] };
const r1 = fromCurriculum(cur1, user10);
check('only the student\'s own syllabus counts (14 chapters, not 25 or 55)', r1.total === 14 && r1.answers === 140, JSON.stringify(r1));
check('out-of-scope chapters never move the accuracy', r1.accuracy === 60 && r1.correct === 84, JSON.stringify(r1));
const cur2 = { ...cur1, years: [cur1.years[0], { year: 10, chapters: own(14).map((c, i) => (i < 2 ? { ...c, attempts: 20, correct: 16 } : c)) }] };
const r2 = fromCurriculum(cur2, user10);
check('a second evidence load updates answers, correct and accuracy together', r2.answers === 160 && r2.correct === 104 && r2.accuracy === 65, JSON.stringify(r2));
check('the dial reading always equals the ledger\'s own ratio', Math.round(accuracyClaim(r2.correct, r2.answers, 10).value) === r2.accuracy);

// A brand-new student: nothing answered, so the ledger reads 0, —, 0/14. (The
// jury's "ANSWERS 1 · 1/25" was the odometer drawing every digit one cell high,
// not data; the drum's blank cell no longer shrinks.)
const fresh = fromCurriculum({ years: [{ year: 10, chapters: own(14).map(c => ({ ...c, attempts: 0, correct: 0 })) }] }, user10);
check('a new student\'s register is 0 answers, correct withheld, 0 of 14 started', fresh.answers === 0 && fresh.correct === null && fresh.started === 0 && fresh.total === 14 && fresh.accuracy === null, JSON.stringify(fresh));

console.log(`${passed}/${passed + failed} index register checks passed`);
process.exit(failed ? 1 : 0);
