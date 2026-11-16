import assert from 'node:assert/strict';
import {createSerializedSigner} from './pri-serialized-signer.mjs';
const main='b'.repeat(40),origin='c'.repeat(40),next='d'.repeat(40);
const req={repository:'Priysharan19/Final-Pri-learning',issue_number:700,pr_number:626,
  operation:'RENEW',idempotency_key:'signed-renew-unique-700',approved_run_id:123456789,
  expected_main:main,expected_authority:origin};
function setup(){
 let authority=origin,shutdown=false,valid=true,applyCount=0;
 const events=[],pending=new Set();
 const tx={durable:true,fenced:true,sharedWithSigner:true,
  hasShutdown:async()=>shutdown,hasQueuedRevocation:async p=>pending.has(p),
  audit:async x=>events.push(x.kind)};
 const store={transaction:async(d,cb)=>{assert.equal(d,'prilearning:trusted-main-authority');return cb(tx)},
  queueEmergency:async req=>{pending.add(req.pr_number);events.push('QUEUED')},
  ackEmergency:async req=>{pending.delete(req.pr_number);events.push('ACKED')}};
 const deps={store,authority:{
  read:async()=>({verified:valid,main_sha:main,authority_head:authority}),
  apply:async request=>{applyCount++;authority=next;return {decision:'SIGNED_LEDGER_CAS_COMMITTED',
    operation:request.operation,issue_number:request.issue_number,authority_head:next}}},
  approve:async r=>({decision:'INDEPENDENT_PROTECTED_RUN_APPROVED',run_id:r.approved_run_id,
    main_sha:r.expected_main}),
  runtime:{independentlyDeployed:true,protectedMainSource:true,
    sameLockAsMerger:true,signedAuthorityInstalled:true}};
 return {deps,events,pending,stats:()=>({applyCount,authority}),
   setShutdown:v=>shutdown=v,setValid:v=>valid=v};
}
let n=0;const yes=async(label,cb)=>{await cb();n++};
await yes('genuine signed renewal takes shared lock and confirms exact ledger',async()=>{
 const f=setup();const result=await createSerializedSigner(f.deps).transact(req);
 assert.equal(result.authority_head,next);assert.equal(f.stats().applyCount,1);
 assert.deepEqual(f.events,['SIGNER_SIGNED_CAS_CONFIRMED']);
});
await yes('REVOKE queues durable emergency before signing and acknowledges after',async()=>{
 const f=setup();const r=await createSerializedSigner(f.deps).transact({...req,operation:'REVOKE'});
 assert.equal(r.operation,'REVOKE');assert.deepEqual(f.events,['QUEUED','REVOCATION_SIGNED_CAS_CONFIRMED','ACKED']);
});
await yes('shutdown prevents any nonemergency signing',async()=>{
 const f=setup();f.setShutdown(true);
 await assert.rejects(()=>createSerializedSigner(f.deps).transact(req),/EMERGENCY_SHUTDOWN_ACTIVE/);
 assert.equal(f.stats().applyCount,0);
});
await yes('compromised ledger prevents signing',async()=>{
 const f=setup();f.setValid(false);
 await assert.rejects(()=>createSerializedSigner(f.deps).transact(req),/SIGNED_AUTHORITY_OR_MAIN_STALE/);
 assert.equal(f.stats().applyCount,0);
});
await yes('independent approval remains mandatory',async()=>{
 const f=setup();f.deps.approve=async()=>({decision:'user_claimed_approval'});
 await assert.rejects(()=>createSerializedSigner(f.deps).transact(req),/NO_GENUINE_INDEPENDENT_RUN_APPROVAL/);
});
await yes('queued external REVOKE denies new nonemergency event',async()=>{
 const f=setup();await f.deps.store.queueEmergency({pr_number:626});
 await assert.rejects(()=>createSerializedSigner(f.deps).transact(req),/REVOCATION_PENDING/);
});
await yes('revocation signing failure leaves durable emergency pending',async()=>{
 const f=setup();f.deps.authority.apply=async()=>{throw Error('SIMULATED_SIGNER_CRASH')};
 await assert.rejects(()=>createSerializedSigner(f.deps).transact({...req,operation:'REVOKE'}),/SIMULATED_SIGNER_CRASH/);
 assert.equal(f.pending.has(626),true);assert.deepEqual(f.events,['QUEUED']);
});
await yes('uncertified runtime is refused even if approval data appears valid',async()=>{
 const f=setup();f.deps.runtime.sameLockAsMerger=false;
 assert.throws(()=>createSerializedSigner(f.deps),/LIVE_SIGNER_NOT_CERTIFIED/);
});
await yes('unsigned request source never enters signer',async()=>{
 const f=setup();await assert.rejects(()=>createSerializedSigner(f.deps).transact({...req,repository:'attacker/repo'}),/EXACT_SIGNED_INTENT_REQUIRED/);
});
console.log(`PASS: ${n} serialized signer / shared lock / revocation priority / emergency fail-closed contract checks (simulated authority)`);
