// Task 02: score conservation, secrecy, hint accounting and no fabricated
// allocations. Usage: node server/test/verified-step-marks-check.mjs
import assert from 'node:assert/strict';
import { markRowsFor, VERIFIED_MARKS_SCHEME } from '../platform/markRows.js';
let pass = 0;
function check(label, action) { try { action(); pass++; } catch (e) { throw new Error(label + ': ' + e.message, { cause: e }); } }
const call = (props = {}) => markRowsFor({}, props);
for (let possible = 1; possible <= 4; possible++) {
  for (let earned = 0; earned <= possible; earned++) {
    for (const correct of [false, true]) {
      for (const withEvidence of [false, true]) {
        const props = {
          resolved: true, correct, marksPossible: possible, marksEarned: earned,
          partial: withEvidence ? { awarded: earned, okLines: earned, lines: [] } : null
        };
        const actual = call(props);
        const permitted = correct ? earned === possible
          : earned < possible && (earned === 0 || withEvidence);
        check('conservation ' + JSON.stringify(props), () => {
          if (!permitted) assert.equal(actual, null);
          else {
            assert.equal(actual.scheme, VERIFIED_MARKS_SCHEME);
            assert.equal(actual.totals.earned, earned);
            assert.equal(actual.totals.possible, possible);
            assert.equal(actual.attribution, 'aggregate-only');
            assert.equal(Object.hasOwn(actual, 'rows'), false);
            assert.equal(actual.finalAnswer, correct ? 'accepted' : 'not-accepted');
            if (correct) assert.equal(actual.method, undefined);
            else assert.equal(actual.method.awarded, earned);
          }
        });
      }
    }
  }
}
for (const resolved of [false, undefined]) for (const invalid of [false, true]) {
  check('active attempt secrecy', () => assert.equal(call({
    resolved, invalid, correct: false, marksEarned: 1, marksPossible: 3,
    partial: { awarded: 1 }
  }), null));
}
for (const v of [-1, 0.5, NaN, Infinity, 5, '2', null]) {
  check('reject malformed grade', () => assert.equal(call({
    resolved: true, correct: true, marksEarned: v, marksPossible: 4
  }), null));
}
for (const partial of [{ awarded: 0 }, { awarded: 2 }, { awarded: NaN }, { awarded: 1.5 }]) {
  check('reject unsubstantiated method credit', () => assert.equal(call({
    resolved: true, correct: false, marksEarned: 1, marksPossible: 3, partial
  }), partial.awarded === 1 ? call({
    resolved: true, correct: false, marksEarned: 1, marksPossible: 3, partial
  }) : null));
}
check('unread working correct final answer cannot imply method verification', () => {
  const out = call({ resolved: true, correct: true, workingNotRead: true,
    marksEarned: 4, marksPossible: 4 });
  assert.equal(out.workingEvidence, 'not-read');
  assert.equal(out.method, undefined);
});
check('unread wrong working receives no invented method rows', () => {
  const out = call({ resolved: true, correct: false, workingNotRead: true,
    marksEarned: 0, marksPossible: 4 });
  assert.equal(out.workingEvidence, 'not-read');
  assert.equal(out.method, undefined);
});
check('correct method score with hint deduction is separate', () => {
  const out = call({ resolved: true, correct: false, marksEarned: 2,
    marksPossible: 4, partial: { awarded: 2 }, creditedMarks: 1.4 });
  assert.equal(out.totals.earned, 2);
  assert.equal(out.method.awarded, 2);
  assert.equal(out.totals.creditedAfterHints, 1.4);
});
for (const creditedMarks of [-0.1, 4.1, NaN, Infinity, '1']) {
  check('reject impossible hint charge', () => assert.equal(call({
    resolved: true, correct: true, marksEarned: 4, marksPossible: 4, creditedMarks
  }), null));
}
check('never send supplementary marks on invalid attempt', () => assert.equal(call({
  resolved: true, invalid: true, correct: false, marksEarned: 0, marksPossible: 3
}), null));
check('never send supplementary marks on solution reveal', () => assert.equal(call({
  resolved: true, revealed: true, correct: false, marksEarned: 0, marksPossible: 3
}), null));
console.log('VERIFIED STEP MARKS: PASS — ' + pass + '/' + pass + ' checks');
