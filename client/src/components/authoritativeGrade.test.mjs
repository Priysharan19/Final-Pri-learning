import assert from 'node:assert/strict';
import { attestedGrade, gradingReceiptMismatch, matchingGradeResponse, numericalGradeUnavailable, showCommittedMethodAwardNote } from './authoritativeGrade.js';
const attempt = { submissionId: 'sub_valid123', attemptId: 'attempt-001', questionId: 'question-A' };
const base = { authoritative: true, resolved: true, questionId: 'question-A', submissionId: attempt.submissionId,
  attemptId: attempt.attemptId, marksEarned: 2, marksPossible: 4 };
for(const [name,result,expected] of [
 ['full', {...base,marksEarned:4}, {awarded:4,possible:4}],
 ['partial',base,{awarded:2,possible:4}],
 ['fractional method credit',{...base,marksEarned:1.5},{awarded:1.5,possible:4}],
 ['zero',{...base,marksEarned:0},{awarded:0,possible:4}],
 ['idempotent replay',{...base,replayed:true},{awarded:2,possible:4}],
 ['cross-device restored receipt',{...base,serverAcknowledgedAt:12345},{awarded:2,possible:4}],
 ['local verified wrapper without raw question id',{...base,questionId:undefined},{awarded:2,possible:4}]
]) assert.deepEqual(attestedGrade(result,'question-A',attempt),expected,name);
console.log('ATTESTED GRADE POSITIVE: PASS 7/7');
const unsafe = [
 ['correct with no numeric award',{marksEarned:undefined,marksPossible:undefined,correct:true}],
 ['incorrect with no numeric award',{marksEarned:undefined,marksPossible:undefined,correct:false}],
 ['method feedback only',{marksEarned:undefined,marksPossible:undefined,partial:{awarded:2}}],
 ['not authoritative',{authoritative:false}],['not resolved',{resolved:false}],
 ['wrong question',{questionId:'question-B'}],['older retry',{submissionId:'sub_other'}],
 ['stale attempt',{attemptId:'older'}],['missing possible',{marksPossible:undefined}],
 ['missing award',{marksEarned:undefined}],['coerced award',{marksEarned:'2'}],
 ['coerced denominator',{marksPossible:'4'}],['negative award',{marksEarned:-1}],
 ['above possible',{marksEarned:5}],['nonfinite possible',{marksPossible:Infinity}],
 ['zero possible',{marksPossible:0}],['infinite award',{marksEarned:Infinity}],
 ['no attempt ID',{attemptId:null}],['no submission ID',{submissionId:null}]
];
for(const [name,fields] of unsafe) assert.equal(attestedGrade({...base,...fields},'question-A',attempt),null,name);
const revealAttempt = { questionId: 'question-A', attemptId: 'reveal-attempt-001', submissionId: null, revealed: true };
const reveal = { authoritative: true, resolved: true, revealed: true, questionId: 'question-A',
  attemptId: 'reveal-attempt-001', marksEarned: 0, marksPossible: 4 };
assert.deepEqual(attestedGrade(reveal, 'question-A', revealAttempt), { awarded: 0, possible: 4 }, 'server zero for committed reveal');
assert.equal(attestedGrade({ ...reveal, marksEarned: undefined }, 'question-A', revealAttempt), null, 'legacy reveal cannot fabricate zero');
assert.equal(attestedGrade({ ...reveal, attemptId: 'stale-reveal' }, 'question-A', revealAttempt), null, 'late different reveal cannot settle this card');
assert.equal(attestedGrade({ ...reveal, revealed: false }, 'question-A', revealAttempt), null, 'not a reveal receipt');
console.log('SERVER-ATTESTED REVEAL ZERO: PASS 4/4');
assert.equal(attestedGrade(base,'question-A',null),null,'no mounted attempt');
console.log('ATTESTED GRADE NEGATIVE: PASS 20/20');

assert.match(numericalGradeUnavailable('en-IN'), /No server-attested numerical marks/);
assert.match(numericalGradeUnavailable('hi-IN'), /अंक उपलब्ध नहीं हैं/);
console.log('BILINGUAL MISSING-GRADE TRUTH: PASS 2/2');

assert.equal(matchingGradeResponse(base,'question-A','sub_valid123'),true,'fresh settled');
assert.equal(matchingGradeResponse({...base,questionId:undefined},'question-A','sub_valid123'),true,'local verified wrapper omits raw ID');
assert.equal(matchingGradeResponse({...base,replayed:true},'question-A','sub_valid123'),true,'lost ACK replay');
for (const bad of [
 {...base,submissionId:'sub_old123'}, {...base,questionId:'question-Z'},
 {...base,attemptId:''}, {...base,authoritative:false}
]) assert.equal(matchingGradeResponse(bad,'question-A','sub_valid123'),false,'stale/fabricated grade');
console.log('EXACT SERVER RESPONSE CORRELATION: PASS 7/7');

assert.match(gradingReceiptMismatch('en'), /safe retry/);
assert.match(gradingReceiptMismatch('hi'), /फिर भेजें/);
console.log('BILINGUAL RECEIPT MISMATCH: PASS 2/2');

const note = { ...base, correct: false, partial: { awarded: 2,
  note: '2 marks for working even though the final answer was incorrect.' } };
assert.equal(showCommittedMethodAwardNote(note, { awarded: 2, possible: 4 }), true);
assert.equal(showCommittedMethodAwardNote(note, { awarded: 1, possible: 4 }), false);
assert.equal(showCommittedMethodAwardNote({ ...note, resolved: false }, { awarded: 2, possible: 4 }), false);
assert.equal(showCommittedMethodAwardNote(note, null), false);
assert.equal(showCommittedMethodAwardNote({ ...note, partial: { awarded: '2' } }, { awarded: 2, possible: 4 }), false);
assert.equal(showCommittedMethodAwardNote({ ...note, authoritative: false }, { awarded: 2, possible: 4 }), false);
console.log('METHOD FEEDBACK NUMERIC AUTHORITY: PASS 6/6');

// Device-shaped results are never a practice result (online-only grading):
// only a matched server receipt is, for a submission and for a reveal.
{
  const { matchingGradeResponse } = await import('./authoritativeGrade.js');
  const { serverRevealReceipt, legacyDeviceReplay } = await import('./checkAccess.js');
  const mod = await import('./authoritativeGrade.js');
  assert.equal('deviceMarkedResponse' in mod || 'deviceRevealResponse' in mod, false, 'there is no device-verdict acceptor left to call');
  const dev = { authoritative: false, correct: true, resolved: true, submissionId: 'sub-1' };
  assert.equal(matchingGradeResponse(dev, 'question-A', 'sub-1'), false, 'an explicit device verdict for the submission sent is refused');
  assert.equal(matchingGradeResponse({ ...dev, attemptId: 'attempt-1' }, 'question-A', 'sub-1'), false, 'even when it names an attempt');
  assert.equal(matchingGradeResponse({ authoritative: false, correct: false, resolved: false, invalid: true }, 'question-A', 'sub-1'), false, 'an unreadable device answer is refused');
  assert.equal(matchingGradeResponse({ ...dev, authoritative: undefined, attemptId: 'attempt-1' }, 'question-A', 'sub-1'), false, 'a result that does not say who marked it is refused');
  assert.equal(matchingGradeResponse({ ...dev, authoritative: true, attemptId: 'attempt-1' }, 'question-A', 'sub-1'), true, 'the matched server receipt is the only accepted shape');
  assert.equal(attestedGrade({ ...dev, attemptId: 'a', marksEarned: 1, marksPossible: 1 }, 'question-A', { questionId: 'question-A', attemptId: 'a', submissionId: 'sub-1' }), null, 'a device verdict is never an attested grade');
  assert.equal(serverRevealReceipt({ authoritative: false, resolved: true, revealed: true, correct: false }), false, 'a device reveal does not open the solution');
  assert.equal(serverRevealReceipt({ authoritative: true, resolved: true, revealed: true }), false, 'a reveal with no server attempt is refused');
  assert.equal(serverRevealReceipt({ authoritative: true, resolved: true, attemptId: 'attempt-1' }), false, 'a result that is not a reveal is refused');
  assert.equal(serverRevealReceipt({ authoritative: true, resolved: true, revealed: true, attemptId: 'attempt-1' }), true, 'the server\'s committed reveal is accepted');
  assert.equal(legacyDeviceReplay({ ...dev, replayed: true }), true, 'a replay of an older version\'s device mark is recognised as history');
  assert.equal(legacyDeviceReplay(dev), false, 'a fresh device-shaped result is never treated as one');
  assert.equal(legacyDeviceReplay({ ...dev, replayed: true, authoritative: true }), false, 'nor is a server replay');
  console.log('DEVICE VERDICT REFUSED FOR PRACTICE: PASS 14/14');
}
