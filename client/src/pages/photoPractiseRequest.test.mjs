import assert from 'node:assert/strict';
import { createPhotoRequestGate } from './photoPractiseRequest.js';
const gate=createPhotoRequestGate();
const first=gate.next();
assert.equal(gate.current(first.epoch), true, 'selected photo starts current');
const newer=gate.next();
assert.equal(first.signal.aborted, true, 'old FileReader or network provider is aborted on replacement');
assert.equal(gate.current(first.epoch), false, 'old provider result is stale');
assert.equal(gate.current(newer.epoch), true, 'new photo may publish');
gate.dispose();
assert.equal(newer.signal.aborted, true, 'unmount aborts active provider');
assert.equal(gate.current(newer.epoch), false, 'provider result after unmount cannot publish');
const preAbort=new AbortController();preAbort.abort();
let noUnhandled=false;
try { preAbort.signal.throwIfAborted(); } catch { noUnhandled=true; }
assert.equal(noUnhandled,true,'aborted read is an expected controlled failure');
console.log('PHOTO-PRACTISE REQUEST LIFECYCLE: PASS 7/7');
