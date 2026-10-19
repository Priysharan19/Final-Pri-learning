// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the tutor guard runs in linear time on attacker-sized text (#538)
//
// The independent review of #535 measured server/platform/tutorGuard.js at
// 1.5–2.3 s on 48 KB of crafted input: the percentage pattern re-scanned a
// digit run from every digit, RUN did the same from every blank in a long
// whitespace stretch, the run tail was trimmed by an end-anchored pattern that
// scanned from every bracket, and the two range patterns that begin with a
// number scanned a digit run from every digit. Before the fix the shapes below
// took 0.5–9.6 s each at 48 KB on this machine; after it, milliseconds.
//
// What this suite holds:
//   1. Timing: every guard entry point on every adversarial shape at 48 KB
//      finishes well inside a bound a quadratic pattern cannot meet, and the
//      work grows no faster than the text (12 KB → 48 KB is 4×; the total may
//      grow at most 10×, where quadratic growth is 16×).
//   2. Semantics: the values and ranges the guard reads from ordinary text are
//      exactly what they were before the patterns were rewritten.
//   3. Fail closed: a message longer than MAX_GUARD_CHARS is refused whole, not
//      read in part; a long legitimate message still has its leak found.
//
//   node server/test/tutor-guard-complexity-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { checks } from './support/app-harness.mjs';
import {
  MAX_GUARD_CHARS, buildGuard, captionWordingOk, leakedExpressions, mathSpans, normalizeMath,
  statedRanges, statedValues, wordsToDigits
} from '../platform/tutorGuard.js';

const c = checks();

// ── Adversarial shapes: each is one long run of the kind a pattern consumes ──
function shapes(n) {
  return {
    digits: '1'.repeat(n),
    digitsSpaceDigits: `${'1'.repeat(n / 2)} ${'2'.repeat(n / 2)}`,
    parensThenDigit: `${'('.repeat(n - 1)}1`,
    spaces: `${' '.repeat(n - 1)}x`,
    dashSpaces: `-${' '.repeat(n - 2)}x`,
    dotsDigits: '1.'.repeat(n / 2),
    fracOpen: `\\frac{${'a'.repeat(n - 6)}`,
    fracSpaces: `\\frac${' '.repeat(n - 5)}`,
    dollarOpen: `$${'a'.repeat(n - 1)}`,
    dollarPairs: '$a'.repeat(n / 2),
    betweenDigits: `between ${'1'.repeat(n - 8)}`,
    ltChain: `${'1'.repeat(n / 2)}<x<${'2'.repeat(n / 2 - 3)}`,
    numberWords: 'one '.repeat(n / 4),
    percentRuns: `${'1'.repeat(1000)} `.repeat(Math.floor(n / 1001)),
    mixedNoSlash: '12 34 '.repeat(n / 6),
    sqrtOpen: `\\sqrt{${'a'.repeat(n - 6)}`
  };
}

const guard = buildGuard({ answer: '$x = 7$', steps: [{ h: 'Double', d: 'So $2x = 14$' }, { h: 'Halve', d: 'Then $x = 7$' }] });
const entryPoints = {
  statedValues: text => statedValues(text),
  statedRanges: text => statedRanges(text),
  normalizeMath: text => normalizeMath(text),
  mathSpans: text => mathSpans(text),
  wordsToDigits: text => wordsToDigits(text),
  // leakedExpressions refuses text past MAX_GUARD_CHARS without reading it, so
  // the adversarial shapes reach it through the values/ranges readers above; the
  // bounded message path is timed separately below.
  captionWordingOk: text => captionWordingOk(text, 'c', new Set())
};

function timeAll(n) {
  const perCall = [];
  let total = 0;
  for (const [fn, run] of Object.entries(entryPoints)) {
    for (const [shape, text] of Object.entries(shapes(n))) {
      const started = performance.now();
      run(text);
      const ms = performance.now() - started;
      total += ms;
      perCall.push({ fn, shape, ms });
    }
  }
  return { perCall, total };
}

// Warm-up so JIT and regexp compilation are not charged to the 12 KB round.
timeAll(4096);
const small = timeAll(12 * 1024);
const large = timeAll(48 * 1024);

// 1. Absolute: a quadratic pattern took 0.5–9.6 s on these shapes at 48 KB; a
//    linear one takes single-digit milliseconds. 250 ms leaves room for a slow
//    CI runner while staying an order of magnitude under the old behaviour.
const SLOW_MS = 250;
const slow = large.perCall.filter(call => call.ms > SLOW_MS);
c.deq(slow.map(call => `${call.fn}/${call.shape}: ${call.ms.toFixed(0)} ms`), [], `no guard entry point takes more than ${SLOW_MS} ms on any 48 KB adversarial shape`);
c.ok(large.perCall.length >= 90, `${large.perCall.length} entry-point × shape timings taken at 48 KB`);

// 2. Growth: 4× the text may cost at most 10× the time in total (quadratic
//    would be 16×). The 12 KB total is floored at 5 ms so timer noise on a
//    fast machine cannot fail a linear implementation.
const growth = large.total / Math.max(small.total, 5);
c.ok(growth <= 10, `total guard time grows at most 10× for 4× the text (12 KB ${small.total.toFixed(1)} ms → 48 KB ${large.total.toFixed(1)} ms, ${growth.toFixed(1)}×)`);

// 3. The bounded message path end to end: a message at the cap, made of the
//    worst shape, with the protected value hidden at the very end.
{
  const worst = `${'1'.repeat(MAX_GUARD_CHARS - 6)} so 7.`;
  const started = performance.now();
  const leaks = leakedExpressions(worst, guard);
  const ms = performance.now() - started;
  c.ok(ms <= SLOW_MS, `leakedExpressions on a ${MAX_GUARD_CHARS}-character digit run takes ${ms.toFixed(0)} ms (≤ ${SLOW_MS})`);
  c.ok(leaks.includes('value:7'), 'and still finds the protected value at the end of it');
}

// ── Semantics are unchanged by the rewrite ───────────────────────────────────
// Distinct values: statedValues reports a value once per pattern that reads it.
const values = text => [...new Set(statedValues(text).map(v => Number(v.v.toFixed(6))))].sort((a, b) => a - b);
const has = (text, value) => statedValues(text).some(v => Math.abs(v.v - value) <= Math.max(v.tol, 1e-9));
c.ok(has('3-5%', -0.05), '"3-5%" states -0.05: the sign is read wherever it stands');
c.ok(has('12 3%', 0.03), '"12 3%" states 3%');
c.ok(has('1.2.3%', 0.023), '"1.2.3%" states 2.3%');
c.ok(has('175%', 1.75) && !has('175%', 0.75), '"175%" states 1.75 once, never 75% from inside the run');
c.ok(has('x = 3/4', 0.75), 'a fraction');
c.ok(has('1 3/4', 1.75), 'a mixed number');
c.ok(has('- 3', -3), 'a sign followed by a space');
c.ok(has('2²', 4), 'a power');
c.ok(has('1 + 3/4', 0.75) && has('1 + 3/4', 1.75), 'additive terms and the whole run');
c.ok(has('0.33', 1 / 3), 'a decimal carries the tolerance of its precision');
c.ok(has('(2 + 1) * 3', 9), 'brackets evaluate');
c.deq(values('the answer is seven'), [7], 'number words are read');
c.deq(values('चार बटा पाँच'), [0.8], 'Hindi fractions are read');
c.deq(statedRanges('between 3 and 5'), [[3, 5]], 'between … and …');
c.deq(statedRanges('3-5<x<7'), [[-5, 7]], 'a chained inequality keeps the sign of its lower bound');
c.deq(statedRanges('3 और 5 के बीच'), [[3, 5]], 'Hindi range');
c.deq(statedRanges('more than 2 and less than 9'), [[2, 9]], 'more than … and less than …');
c.deq(statedRanges('9 > x > 2'), [[2, 9]], 'descending chain');
c.deq(statedRanges('between 3 and'), [], 'an unfinished range states none');
c.deq(leakedExpressions('Try halving both sides.', guard), [], 'a clean nudge passes');
c.deq(leakedExpressions('So x is 7.', guard), ['value:7'], 'the protected answer is caught');
c.deq(leakedExpressions('It lies between 6 and 8.', guard), ['range:7'], 'a bracketing range is caught');
c.deq(leakedExpressions('So x = 14/2.', guard), ['value:7', 'value:14'], 'arithmetic that evaluates to it is caught, and so is the protected next-step result it states');
c.deq(leakedExpressions('About 700%.', guard), ['value:7'], 'a percentage equal to it is caught');

// ── Fail closed on size ──────────────────────────────────────────────────────
c.eq(MAX_GUARD_CHARS, 8000, 'MAX_GUARD_CHARS matches the largest tutor.js field limit');
c.deq(leakedExpressions('x'.repeat(MAX_GUARD_CHARS + 1), guard), [`length:${MAX_GUARD_CHARS + 1}`], 'a message one past the cap is refused as a leak, unread');
c.deq(leakedExpressions('x'.repeat(MAX_GUARD_CHARS), guard), [], 'a clean message exactly at the cap is read and passes');
c.deq(leakedExpressions(`${'Keep going. '.repeat(600)}So x = 7.`, guard), ['expression:x=7', 'value:7'], 'a long legitimate message still has its leak found (the whole expression and the value)');

console.log(`TUTOR GUARD COMPLEXITY: PASS — ${c.count()}/${c.count()} checks (12 KB ${small.total.toFixed(1)} ms → 48 KB ${large.total.toFixed(1)} ms, ${growth.toFixed(1)}×)`);
