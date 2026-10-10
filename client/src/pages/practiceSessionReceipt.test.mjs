import assert from 'node:assert/strict';
import { consumeSessionReceipt } from './practiceSessionReceipt.js';
const seen = new Set();
const r = { authoritative: true, resolved: true, attemptId: 'attempt-immutable-0001', correct: false };
assert.equal(consumeSessionReceipt(r, seen), true, 'first committed receipt accepted');
assert.equal(seen.size, 1);
assert.equal(consumeSessionReceipt({...r,replayed:true}, seen), false, 'lost ACK retry not a second session question');
assert.equal(consumeSessionReceipt({...r,replayed:true,correct:true}, seen), false, 'same attempt may not replace its correctness');
assert.equal(consumeSessionReceipt({...r,resolved:false,attemptId:'attempt-immutable-0002'},seen),false,'unresolved try is not completed');
assert.equal(consumeSessionReceipt({...r,authoritative:false,attemptId:'attempt-immutable-0003'},seen),false,'local grade not committed');
assert.equal(consumeSessionReceipt({...r,attemptId:''},seen),false,'no verifiable server attempt id');
assert.equal(consumeSessionReceipt({...r,attemptId:'attempt-immutable-0004'},seen),true,'different committed attempt counted');
assert.equal(seen.size,2);
assert.equal(consumeSessionReceipt({...r,attemptId:'attempt-immutable-0004',revealed:true},seen),false,'duplicate reveal/submit callback');
assert.equal(consumeSessionReceipt({...r,attemptId:'attempt-immutable-0005'},null),false,'missing Set fails closed');
const otherStudent = new Set();
assert.equal(consumeSessionReceipt(r,otherStudent),true,'new local profile has its own isolated session ledger');
// Device-shaped results are never counted: practice is checked by the server
// only, so a completed question always has a server attempt behind it.
const device = { authoritative: false, resolved: true, correct: true, submissionId: 'sub-device-1' };
const deviceSeen = new Set();
assert.equal(consumeSessionReceipt(device, deviceSeen), false, 'a device verdict is not a completed session question');
assert.equal(consumeSessionReceipt({ ...device, questionId: 'question-A' }, deviceSeen), false, 'naming its question does not make it one');
assert.equal(consumeSessionReceipt({ authoritative: false, resolved: true, revealed: true, questionId: 'question-E' }, deviceSeen), false, 'a device reveal is not counted');
assert.equal(consumeSessionReceipt({ resolved: true, correct: true, questionId: 'question-D' }, deviceSeen), false, 'a result that does not say who marked it is not counted');
assert.equal(consumeSessionReceipt({ ...device, attemptId: 'attempt-immutable-0009' }, deviceSeen), false, 'a device verdict naming a server attempt is not counted');
assert.equal(deviceSeen.size, 0, 'and none of them enters the session ledger');
console.log('STUDENT SESSION RECEIPT DEDUP: PASS 18/18');
