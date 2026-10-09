import assert from 'node:assert/strict';
import { attestedGrade, gradingReceiptMismatch, matchingGradeResponse, numericalGradeUnavailable } from './authoritativeGrade.js';
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
