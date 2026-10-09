import assert from 'node:assert/strict';
import { blockedInkRecovery, canOpenInkSignIn, inkRecoveryWords, completeInkOtpRecovery } from './signedOutInkRecovery.js';
const wait = { kind:'ACCOUNT_ACTION_REQUIRED', blocker:'ink.waitingSignIn' };
const base = {readerState:wait,mode:'write',inkHasStrokes:true,resolved:false};
assert.equal(blockedInkRecovery(base),true,'written signed-out question needs in-context action');
assert.equal(canOpenInkSignIn({...base,saveState:'saving'}),false,'queued IndexedDB work is not attested');
assert.equal(canOpenInkSignIn({...base,saveState:'failed'}),false,'failed IDB write cannot permit risky profile switch');
assert.equal(canOpenInkSignIn({...base,saveState:'saved'}),true,'verified readback enables account recovery');
assert.equal(blockedInkRecovery({...base,inkHasStrokes:false}),false,'empty ink not a claim of saved work');
assert.equal(blockedInkRecovery({...base,mode:'type'}),false,'Type must remain available');
assert.equal(blockedInkRecovery({...base,resolved:true}),false,'already graded question not reauthored');
assert.equal(blockedInkRecovery({...base,readerState:{kind:'READ_FAILED'}}),false,'bad recognition is not a sign-in error');
assert.equal(blockedInkRecovery({...base,readerState:{kind:'ACCOUNT_ACTION_REQUIRED',blocker:'ink.waitingGuardian'}}),true,'guardian remains separate account action');
assert.equal(canOpenInkSignIn({...base,readerState:{kind:'ACCOUNT_ACTION_REQUIRED',blocker:'ink.waitingGuardian'},saveState:'saved'}),false,'guardian gate cannot be bypassed by signing in');
assert.match(inkRecoveryWords('en').action,/Sign in to check this answer/);
assert.ok(inkRecoveryWords('hi').action.includes('साइन इन'));
assert.doesNotMatch(inkRecoveryWords('en').detail,/saved|marked on device/i,'no unverified persistence/grade promise');
const operations=[];
const invoke=(overrides={})=>completeInkOtpRecovery({
  localProfileId:'local-a',currentProfileId:'local-a',account:{id:'cloud-a'},
  verifiedSaved:true,
  getLinked:async()=>{operations.push('check');return null;},
  linkAccount:async(id,account)=>operations.push('link:'+id+':'+account.id),
  refreshProfile:async()=>operations.push('refresh'),
  ...overrides
});
await assert.rejects(invoke({currentProfileId:'local-b'}), e=>e.code==='INK_PROFILE_CHANGED');
await assert.rejects(invoke({verifiedSaved:false}), e=>e.code==='INK_DRAFT_NOT_SAVED');
await assert.rejects(invoke({account:null}), e=>e.code==='INK_ACCOUNT_NOT_VERIFIED');
assert.deepEqual(operations,[],'missing/unsafe identities must never touch account storage');
await assert.rejects(invoke({getLinked:async()=>({accountId:'cloud-other'})}),e=>e.code==='INK_ACCOUNT_MISMATCH');
assert.deepEqual(operations,[],'another cloud account must not acquire private strokes');
await invoke();
assert.deepEqual(operations,['check','link:local-a:cloud-a','refresh'],'new link under same local identity');
operations.length=0;
await invoke({getLinked:async()=>({accountId:'cloud-a'})});
assert.deepEqual(operations,['link:local-a:cloud-a','refresh'],'original account reauthentication is idempotent');
operations.length=0;
await assert.rejects(invoke({linkAccount:async()=>{throw Error('Server refusal');}}),/Server refusal/);
assert.deepEqual(operations,['check'],'failed linkage cannot announce connected profile');
assert.match(inkRecoveryWords('en').otpAction,/phone or email code/);
assert.ok(inkRecoveryWords('hi').otpAction.includes('कोड'));
console.log('SIGNED-OUT INK ACCOUNT RECOVERY: PASS 23/23');
