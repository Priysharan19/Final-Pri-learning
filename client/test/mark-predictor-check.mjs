// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the predicted mark, and the ways it could lie
//
// A predicted mark is the easiest number in the app to fake. This suite is
// mostly about the ways it must refuse to:
//
//   · a handful of right answers is not mastery;
//   · easy questions answered well are not a hard paper answered well;
//   · a topic never attempted is an absence, not a zero and not an average;
//   · a number covering a third of the paper must say so;
//   · stale evidence is worth less than fresh evidence.
// ─────────────────────────────────────────────────────────────────────────────
import {
  COVERAGE_FLOOR, freshness, paperDifficultyRating, predictExamMark, predictUnit, predictionSentence, unitEvidence
} from '../src/engine/markPredictor.js';
import { CBSE_CLASS10_STANDARD_REFERENCE } from '../src/engine/indiaExams.js';
import { DIFF_RATING } from '../src/engine/adaptive.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} — expected ${b}±${tol}, got ${a}`);

const PAPER = CBSE_CLASS10_STANDARD_REFERENCE;
const NOW = 1_800_000_000_000;
const strong = { rating: 1500, attempts: 60, correct: 52, last_at: NOW - 86_400_000 };
const weak = { rating: 900, attempts: 40, correct: 12, last_at: NOW - 86_400_000 };

// ── 1 · The paper's own difficulty is what gets predicted against ────────────
const diff = paperDifficultyRating(PAPER);
ok(diff >= DIFF_RATING[1] && diff <= DIFF_RATING[3], 'the target sits inside the paper’s declared difficulty band');
ok(paperDifficultyRating({}) > 0, 'and a blueprint with no band still yields a sane target');

// ── 2 · Evidence is pooled by weight, not by chapter count ───────────────────
const algebra = PAPER.units.find(u => u.id === 'algebra');
const lopsided = unitEvidence(algebra, {
  'c10-polynomials': { rating: 1800, attempts: 2, correct: 2, last_at: NOW },
  'c10-quadratic-equations': { rating: 900, attempts: 40, correct: 14, last_at: NOW }
});
eq(lopsided.attempts, 42, 'attempts across a unit’s chapters are pooled');
ok(lopsided.rating < 1100, 'and a chapter answered twice does not outvote one answered forty times');

// ── 3 · A tiny sample is not mastery ─────────────────────────────────────────
const tiny = predictUnit(algebra, { 'c10-polynomials': { rating: 1900, attempts: 3, correct: 3, last_at: NOW } },
  { difficultyRating: diff, nowMs: NOW });
ok(tiny.p < 0.8, `three right out of three is not near-certainty (got p=${tiny.p})`);
ok(tiny.p > 0.5, 'but it is better than knowing nothing');
const many = predictUnit(algebra, { 'c10-polynomials': { rating: 1900, attempts: 80, correct: 76, last_at: NOW } },
  { difficultyRating: diff, nowMs: NOW });
ok(many.p > tiny.p, 'the same rating with real evidence behind it predicts higher');
ok(many.sd < tiny.sd, 'and carries a tighter interval');

// ── 4 · Easy questions answered well are not a hard paper answered well ──────
const easyRated = predictUnit(algebra, { 'c10-polynomials': { rating: 1000, attempts: 50, correct: 45, last_at: NOW } },
  { difficultyRating: diff, nowMs: NOW });
ok(easyRated.accuracy > 0.85, 'the student’s raw accuracy is high');
ok(easyRated.p < easyRated.accuracy, 'but the predicted rate against this paper is lower, because the rating says the questions were easier');

// ── 5 · Stale evidence is worth less ─────────────────────────────────────────
ok(freshness(NOW, NOW) === 1, 'evidence from today is undiscounted');
ok(freshness(NOW - 200 * 86_400_000, NOW) < freshness(NOW - 10 * 86_400_000, NOW), 'and older evidence is worth less than newer');
ok(freshness(null, NOW) === 1, 'no timestamp is not treated as ancient');
const fresh = predictUnit(algebra, { 'c10-polynomials': { ...strong, last_at: NOW } }, { difficultyRating: diff, nowMs: NOW });
const stale = predictUnit(algebra, { 'c10-polynomials': { ...strong, last_at: NOW - 300 * 86_400_000 } }, { difficultyRating: diff, nowMs: NOW });
ok(stale.p < fresh.p, 'a unit last seen ten months ago predicts lower than the same work done yesterday');

// ── 6 · A topic never attempted is an absence ────────────────────────────────
const untouched = predictUnit(algebra, {}, { difficultyRating: diff, nowMs: NOW });
eq(untouched.covered, false, 'a unit with no attempts is not covered');
eq(untouched.expected, null, 'it predicts nothing — not a zero, which would fail someone who has not started');
eq(untouched.p, null, 'and not an average, which would invent evidence');

// ── 7 · The headline says what it covers ─────────────────────────────────────
const everything = {};
for (const unit of PAPER.units) for (const c of unit.chapters) everything[c] = { ...strong };
const full = predictExamMark(PAPER, everything, { nowMs: NOW });
eq(full.coverage, 1, 'practising every unit covers the whole paper');
eq(full.unseenMarks, 0, 'with nothing untouched');
ok(full.show, 'and a headline mark is shown');
ok(full.low < full.expected && full.expected < full.high, 'the prediction is an interval around its estimate');
ok(full.high <= full.totalMarks, 'which never exceeds the paper');
ok(full.low >= 0, 'and never drops below zero');
near(full.percent, 100 * full.expected / full.coveredMarks, 0.2, 'the percentage matches the marks');

const algebraOnly = {};
for (const c of algebra.chapters) algebraOnly[c] = { ...strong };
const partial = predictExamMark(PAPER, algebraOnly, { nowMs: NOW });
eq(partial.coveredMarks, 20, 'only the practised unit’s marks are covered');
eq(partial.unseenMarks, PAPER.totalMarks - 20, 'and the rest is reported as untouched');
ok(!partial.show, `20 of ${PAPER.totalMarks} marks is below the coverage floor, so no headline mark is shown`);
ok(partial.expected <= partial.coveredMarks, 'the prediction never speaks for marks it has no evidence about');
ok(/practised 20 of the paper's 80 marks/i.test(predictionSentence(partial)), 'and the sentence says exactly how much of the paper it saw');

const nothing = predictExamMark(PAPER, {}, { nowMs: NOW });
eq(nothing.coveredMarks, 0, 'a new student covers nothing');
ok(!nothing.show, 'and gets no invented mark');
ok(/haven't answered anything/i.test(predictionSentence(nothing)), 'but is told why, plainly');
ok(COVERAGE_FLOOR > 0.2 && COVERAGE_FLOOR < 1, 'the floor is a real threshold, not a formality');

// ── 8 · What to do next is ranked by marks at stake ──────────────────────────
const mixed = {};
for (const c of algebra.chapters) mixed[c] = { ...weak };
for (const unit of PAPER.units) if (unit.id !== 'algebra') for (const c of unit.chapters) mixed[c] = { ...strong };
const advice = predictExamMark(PAPER, mixed, { nowMs: NOW });
eq(advice.priorities[0].unitId, 'algebra', 'the weakest unit carrying the most marks comes first');
ok(advice.priorities.every((r, i, arr) => i === 0 || arr[i - 1].atStake >= r.atStake), 'and the rest are ranked by marks at stake');
ok(advice.expected < full.expected, 'being weak in a heavy unit lowers the predicted mark');

// A strong student and a weak one must not land in the same place.
const allWeak = {};
for (const unit of PAPER.units) for (const c of unit.chapters) allWeak[c] = { ...weak };
const weakAll = predictExamMark(PAPER, allWeak, { nowMs: NOW });
ok(weakAll.expected < full.expected * 0.75, 'a weak student is predicted well below a strong one');
ok(weakAll.show, 'and still gets a number, because they have covered the paper');

eq(predictExamMark({ units: [] }, {}), null, 'a blueprint with no units predicts nothing at all');

console.log(failures.length
  ? `MARK PREDICTOR: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `MARK PREDICTOR: PASS — ${pass}/${pass} checks — weighted by the real paper, shrunk toward the middle on thin evidence, silent about topics never attempted.`);
process.exit(failures.length ? 1 : 0);
