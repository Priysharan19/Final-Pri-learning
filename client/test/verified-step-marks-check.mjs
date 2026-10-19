// Client gate refuses stale, mixed and invented mark rows.
import assert from 'node:assert/strict';
import { verifiedMarkBreakdown } from '../src/components/verifiedMarkRows.js';
let pass = 0;
const ok = (label, got, expected) => {
  assert.equal(got, expected, label); pass++;
};
const r = {
  authoritative: true, resolved: true, correct: false,
  marksEarned: 2, marksPossible: 4,
  markRows: {
    scheme: 'pri-practice-verified-aggregate-v1', attribution: 'aggregate-only',
    totals: { earned: 2, possible: 4 },
    finalAnswer: 'not-accepted', method: { awarded: 2, attribution: 'aggregate-only' }
  }
};
const grade = { awarded: 2, possible: 4 };
ok('valid server aggregate', verifiedMarkBreakdown(r, grade), r.markRows);
ok('no matched grade', verifiedMarkBreakdown(r, null), null);
ok('incorrect submitted question', verifiedMarkBreakdown(r, { awarded: 1, possible: 4 }), null);
ok('incorrect possible', verifiedMarkBreakdown(r, { awarded: 2, possible: 3 }), null);
ok('unresolved', verifiedMarkBreakdown({ ...r, resolved: false }, grade), null);
ok('invalid', verifiedMarkBreakdown({ ...r, invalid: true }, grade), null);
ok('revealed', verifiedMarkBreakdown({ ...r, revealed: true }, grade), null);
ok('not authoritative', verifiedMarkBreakdown({ ...r, authoritative: false }, grade), null);
ok('row fiction', verifiedMarkBreakdown({ ...r, markRows: { ...r.markRows, rows: [{ earned: 2 }] } }, grade), null);
ok('wrong answer receives no accepted credit', verifiedMarkBreakdown({ ...r, markRows: { ...r.markRows, finalAnswer: 'accepted' } }, grade), null);
ok('client never invents second method mark', verifiedMarkBreakdown({ ...r, markRows: { ...r.markRows, method: { awarded: 3, attribution: 'aggregate-only' } } }, grade), null);
ok('malformed after hint credit', verifiedMarkBreakdown({ ...r, markRows: { ...r.markRows, totals: { earned: 2, possible: 4, creditedAfterHints: 2.5 } } }, grade), null);
ok('missing method attribution', verifiedMarkBreakdown({ ...r, markRows: { ...r.markRows, method: null } }, grade), null);
const correct = { ...r, correct: true, marksEarned: 4, markRows: {
  scheme: r.markRows.scheme, attribution: 'aggregate-only',
  totals: { earned: 4, possible: 4 }, finalAnswer: 'accepted'
}};
ok('correct answer without invented method', verifiedMarkBreakdown(correct, { awarded: 4, possible: 4 }), correct.markRows);
ok('correct answer cannot acquire method marks', verifiedMarkBreakdown({
  ...correct, markRows: { ...correct.markRows, method: { awarded: 3, attribution: 'aggregate-only' } }
}, { awarded: 4, possible: 4 }), null);
ok('older response safely degrades', verifiedMarkBreakdown({ ...r, markRows: undefined }, grade), null);
console.log('VERIFIED STEP MARKS CLIENT: PASS — ' + pass + '/' + pass + ' checks');
