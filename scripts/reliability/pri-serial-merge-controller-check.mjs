import assert from 'node:assert/strict';
import {createSerialMergeController,verifyExclusiveMainUpdate,TRUSTED_MERGE_REPO} from './pri-serial-merge-controller.mjs';
const repo=TRUSTED_MERGE_REPO;
const head='a'.repeat(40),main='b'.repeat(40),ledger='c'.repeat(40),mergeSha='d'.repeat(40);
const apps={mergerAppId:2001,signerAppId:2002,verifierAppId:2003};
const protection={enforce_admins:{enabled:true},required_status_checks:{strict:true,checks:[{context:'Pri Trusted Governor / Source Authorization',app_id:2003},{context:'Browser suites (end-to-end and accessibility)',app_id:15368}]},required_pull_request_reviews:{required_approving_review_count:1,dismiss_stale_reviews:true,require_last_push_approval:true}};
const rulesets=[{id:123,target:'branch',enforcement:'active',bypass_actors:[{actor_id:2001,actor_type:'Integration',bypass_mode:'always'}],conditions:{ref_name:{include:['refs/heads/main'],exclude:[]}},rules:[{type:'update'},{type:'deletion'},{type:'non_fast_forward'}]}];
const request={repository:repo,pr_number:625,expected_head:head,expected_main:main,delivery_id:'git-delivery-abcd9876',idempotency_key:'merge-intent-unique-abc123',event_authority:'verified-independent-intent'};
function fixture(){
 const receipts=new Map(),pending=new Set(),events=[];
 let delivered={trusted_signature:true,repository:repo,pr_number:625,head_sha:head,sender_type:'User',sender_login:'Priysharan19'};
 let tail=Promise.resolve(),mainNow=main,headNow=head,authorityHead=ledger,revoked=false,merges=0,reads=0,failAfterCommit=false,failBeforeCommit=false,merged=false,shutdown=false;
 const tx={durable:true,fenced:true,sharedWithSigner:true,
   hasShutdown:async()=>shutdown,hasQueuedRevocation:async()=>pending.size>0,
   prepare:async(key,req,proof)=>{receipts.set(key,{state:'PREPARED',request:req,proof,operation:'MERGE'});events.push('PREPARED')},
   complete:async(key,result,req=null,operation=null)=>{const old=receipts.get(key);receipts.set(key,{state:'COMPLETED',request:req||old.request,result,operation:operation||old.operation});events.push('COMPLETED')},
   deny:async(key,reason)=>{receipts.set(key,{...receipts.get(key),state:'DENIED',reason});events.push('DENIED')},
   audit:async e=>{events.push(e.kind)}
 };
 const store={
  transaction:async(domain,cb)=>{
    assert.equal(domain,'prilearning:trusted-main-authority');
    const prev=tail;let done;tail=new Promise(resolve=>{done=resolve});await prev;
    try{return await cb(tx)}finally{done()}
  },
  readReceipt:async key=>receipts.get(key),
  verifyDelivery:async()=>delivered,
  queueEmergency:async req=>{pending.add(req.pr_number);events.push('EMERGENCY_QUEUED')},
  ackEmergency:async req=>{pending.delete(req.pr_number);events.push('EMERGENCY_ACK')}
 };
 const github={
  read:async()=>{reads++;return {repo,pr_number:625,head:headNow,main:mainNow,base_ref:'main',open:!merged,draft:false}},
  readMerged:async()=>({merged,head_sha:head,base_before:main,merge_commit_sha:merged?mergeSha:null}),
  merge:async(opts)=>{
    assert.equal(opts.method,'merge');
    assert.equal(opts.trustedAppId,2001);
    if(failBeforeCommit)throw Error('GITHUB_HTTP_TIMEOUT_BEFORE_MUTATION');
    if(headNow!==opts.expected_head || mainNow!==opts.expected_main)throw Error('MERGE_HEAD_OR_BASE_CHANGED');
    merges++;merged=true;mainNow=mergeSha;
    if(failAfterCommit)throw Error('NETWORK_DROP_AFTER_SUCCESS');
    return {merged:true,merge_commit_sha:mergeSha};
  }
 };
 const authority={
  read:async()=>({verified:true,head:authorityHead,revoked}),
  revoke:async()=>{revoked=true;authorityHead='e'.repeat(40);events.push('SIGNED_REVOKE');return {committed:true,authority_head:authorityHead}}
 };
 const deps={store,github,authority,
  readRules:async()=>({rulesets,branchProtection:protection,...apps}),
  evaluate:async({request,snapshot})=>{
    if(snapshot.revoked)throw Error('SIGNED_PROVENANCE_REVOKED');
    return {decision:'SOURCE_REVIEW_POLICY_VERIFIED',head:request.expected_head,
      main_sha:request.expected_main,authority_head:snapshot.head,trusted_evaluator:true};
  },
  runtime:{independentlyDeployed:true,trustedProtectedMain:true,exclusiveMergerApp:true,
    allSignerWritesSerialized:true,verifiedAppPositiveAndUserNegative:true,trustedCheckPublicationActive:true}
 };
 return {deps,request,events,pending,receipts,setHead:v=>headNow=v,setMain:v=>mainNow=v,
   setLedger:v=>authorityHead=v,setRevoked:v=>revoked=v,setShutdown:v=>shutdown=v,
   setDelivery:v=>delivered=v,
   failAfterCommit:v=>failAfterCommit=v,failBeforeCommit:v=>failBeforeCommit=v,
   stats:()=>({merges,reads,merged,mainNow,authorityHead}),
   controller:()=>createSerialMergeController(deps)};
}
let count=0;const yes=async(name,fn)=>{await fn();count++};
const no=async(name,match,fn)=>yes(name,async()=>await assert.rejects(fn,match));
yes('integration bypass exact',()=>assert.equal(verifyExclusiveMainUpdate({rulesets,branchProtection:protection,...apps}).merger_app,2001));
for(const [name,change,pattern] of [
 ['missing update rule',r=>r.rulesets[0].rules=[{type:'deletion'},{type:'non_fast_forward'}],/MAIN_UPDATES_NOT_EXCLUSIVE/],
 ['untrusted owner bypass',r=>r.rulesets[0].bypass_actors.push({actor_type:'User',actor_id:42,bypass_mode:'always'}),/UNTRUSTED_UPDATE_BYPASS/],
 ['missing non-fast-forward',r=>r.rulesets[0].rules=r.rulesets[0].rules.filter(x=>x.type!=='non_fast_forward'),/UPDATE_RULESET_MISSING_IMMUTABILITY/],
 ['absent verifier binding',r=>r.branchProtection.required_status_checks.checks=[],/DEDICATED_VERIFIER_CHECK_NOT_REQUIRED/],
 ['same merger and signer identity',r=>r.apps.signerAppId=2001,/APP_IDENTITIES_NOT_INDEPENDENT/],
 ['review protection disabled',r=>r.branchProtection.required_pull_request_reviews.required_approving_review_count=0,/MAIN_BRANCH_PROTECTION_CHANGED/]
]) {
 const r={rulesets:structuredClone(rulesets),branchProtection:structuredClone(protection),apps:{...apps}};
 change(r);
 await no(name,pattern,async()=>verifyExclusiveMainUpdate({...r, ...r.apps}));
}
await yes('trusted synthetic merge commit and audit',async()=>{
 const f=fixture();const result=await f.controller().merge(f.request);
 assert.equal(result.decision,'TRUSTED_MERGE_CONFIRMED');
 assert.equal(result.main_before,main);assert.equal(f.stats().merges,1);
 assert.ok(f.events.includes('PREPARED')&&f.events.includes('MERGE_COMMITTED'));
});
await yes('same idempotency request recovers completed without GitHub merge',async()=>{
 const f=fixture();const c=f.controller();await c.merge(f.request);
 const result=await c.merge(f.request);assert.equal(result.idempotent,true);assert.equal(f.stats().merges,1);
});
await no('replayed idempotency key with different exact head rejected',/IDEMPOTENCY_KEY_REPLAY_WITH_NEW_SOURCE/,async()=>{
 const f=fixture();const c=f.controller();await c.merge(f.request);await c.merge({...f.request,expected_head:'f'.repeat(40)});
});
await no('unknown current PR head denied',/LIVE_PR_HEAD_OR_MAIN_CHANGED/,async()=>{
 const f=fixture();f.setHead('f'.repeat(40));await f.controller().merge(f.request);
});
await no('moved protected main denied',/LIVE_PR_HEAD_OR_MAIN_CHANGED/,async()=>{
 const f=fixture();f.setMain('f'.repeat(40));await f.controller().merge(f.request);
});
await no('revoked provenance denies stale green',/SIGNED_PROVENANCE_REVOKED/,async()=>{
 const f=fixture();f.setRevoked(true);await f.controller().merge(f.request);
});
await no('emergency shutdown denies merge',/REVOCATION_OR_SHUTDOWN_PENDING/,async()=>{
 const f=fixture();f.setShutdown(true);await f.controller().merge(f.request);
});
await no('unsigned webhook delivery cannot initiate merge',/WEBHOOK_DELIVERY_UNVERIFIED_OR_STALE/,async()=>{
 const f=fixture();f.setDelivery({trusted_signature:false,repository:repo,pr_number:625,head_sha:head,sender_type:'User',sender_login:'Priysharan19'});await f.controller().merge(f.request);
});
await no('replayed stale webhook SHA cannot merge new source',/WEBHOOK_DELIVERY_UNVERIFIED_OR_STALE/,async()=>{
 const f=fixture();f.setDelivery({trusted_signature:true,repository:repo,pr_number:625,head_sha:'f'.repeat(40),sender_type:'User',sender_login:'Priysharan19'});await f.controller().merge(f.request);
});
await no('queued revoke denies earlier green merge',/REVOCATION_OR_SHUTDOWN_PENDING/,async()=>{
 const f=fixture();await f.deps.store.queueEmergency({pr_number:625});await f.controller().merge(f.request);
});
await no('authority ledger changes before merge cannot be ignored',/AUTHORITY_OR_PR_CHANGED_AT_COMMIT_BOUNDARY/,async()=>{
 const f=fixture();const original=f.deps.evaluate;
 f.deps.evaluate=async(args)=>{const res=await original(args);f.setLedger('f'.repeat(40));return res};
 await f.controller().merge(f.request);
});
await no('live PR moves between validation and merge',/AUTHORITY_OR_PR_CHANGED_AT_COMMIT_BOUNDARY/,async()=>{
 const f=fixture();const original=f.deps.evaluate;
 f.deps.evaluate=async(args)=>{const res=await original(args);f.setHead('f'.repeat(40));return res};
 await f.controller().merge(f.request);
});
await no('independent policy verdict must be protected main',/POLICY_NOT_INDEPENDENTLY_VERIFIED/,async()=>{
 const f=fixture();f.deps.evaluate=async()=>({decision:'SOURCE_REVIEW_POLICY_VERIFIED',head,main_sha:main,authority_head:ledger,trusted_evaluator:false});await f.controller().merge(f.request);
});
await no('unsigned foreign repo intent denied',/INVALID_AUTHENTICATED_INTENT/,async()=>{
 const f=fixture();await f.controller().merge({...f.request,repository:'attacker/Fork'});
});
await no('unsafe runtime configuration cannot instantiate controller',/NOT_LIVE_CERTIFIED/,async()=>{
 const f=fixture();f.deps.runtime.verifiedAppPositiveAndUserNegative=false;f.controller();
});
await yes('crash after GitHub success leads to signed/idempotent read-back recovery',async()=>{
 const f=fixture();f.failAfterCommit(true);const c=f.controller();
 await assert.rejects(()=>c.merge(f.request),/MERGE_RESULT_REQUIRES_RECONCILIATION/);
 assert.equal(f.stats().merges,1);
 const result=await c.merge(f.request);assert.equal(result.decision,'MERGE_RECOVERED');
 assert.equal(f.stats().merges,1);assert.ok(f.events.includes('MERGE_RECOVERED'));
});
await yes('interrupted pre-merge request cannot be blindly retried',async()=>{
 const f=fixture();f.failBeforeCommit(true);const c=f.controller();
 await assert.rejects(()=>c.merge(f.request),/MERGE_RESULT_REQUIRES_RECONCILIATION/);
 await assert.rejects(()=>c.merge(f.request),/INTERRUPTED_MERGE_REQUIRES_FRESH_AUTHORIZATION/);
 assert.equal(f.stats().merges,0);
});
await yes('signed revocation passes through same serial lock',async()=>{
 const f=fixture();await f.controller().revoke({repository:repo,pr_number:625,idempotency_key:'revoke-idempotent-unique42',event_authority:'verified-independent-emergency'});
 assert.ok(f.events.indexOf('EMERGENCY_QUEUED')<f.events.indexOf('SIGNED_REVOKE'));
 assert.ok(f.events.indexOf('SIGNED_REVOKE')<f.events.indexOf('EMERGENCY_ACK'));
 assert.equal(f.pending.size,0);
 await assert.rejects(()=>f.controller().merge(f.request),/SIGNED_PROVENANCE_REVOKED/);
});
await yes('same signed revoke cannot be executed twice',async()=>{
 const f=fixture(),c=f.controller(),rev={repository:repo,pr_number:625,idempotency_key:'revoke-idempotent-unique42',event_authority:'verified-independent-emergency'};
 await c.revoke(rev);await c.revoke(rev);
 assert.equal(f.events.filter(x=>x==='SIGNED_REVOKE').length,1);
});
await yes('parallel revoked request eventually wins lock and denies later merge',async()=>{
 const f=fixture(),c=f.controller(),rev={repository:repo,pr_number:625,idempotency_key:'revoke-parallel-unique42',event_authority:'verified-independent-emergency'};
 await Promise.all([c.revoke(rev),Promise.resolve()]);
 await assert.rejects(()=>c.merge(f.request),/SIGNED_PROVENANCE_REVOKED/);
 assert.equal(f.stats().merges,0);
});
console.log(`PASS: ${count} simulated serialized-merger, exclusive-update, revocation and failure-recovery assertions (NOT live certification)`);
