import assert from 'node:assert/strict';
import {generateKeyPairSync, randomUUID} from 'node:crypto';
import {appendGrant, inspectSignedLog, verifyReleasedSource, reconcileIssueAuthority,
  assertLedgerMatchesGrants, eventDigest, signEvent, revokeAuthoritativeGrant, authorizeCAS} from '../../scripts/pri-admission-state.mjs';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const now=Date.now(), H=3600000;
const main='a'.repeat(40), first='b'.repeat(40), reviewed='c'.repeat(40), later='d'.repeat(40);
const branch='agent/mission/platform/provenance-v1';
const paths=['server/platform/accounts.js'];
const baseBody=[`Pri-Mission-ID: provenance-v1`,`Pri-Mission-Status: TRIAGED`,
  `Pri-Agent: platform`,`Pri-Branch: ${branch}`,`Pri-Risk: R4`,
  `Pri-Base-SHA: ${main}`,`Pri-Paths: ${paths.join(', ')}`].join('\n');
const issue=(body=baseBody)=>({number:1001,title:'[PRI-MISSION] Provenance exercise',state:'open',body});
const pr=(head=first)=>({number:1002,state:'open',head:{sha:head,ref:branch,repo:{full_name:'Priysharan19/Final-Pri-learning'}},
  base:{sha:main,ref:'main',repo:{full_name:'Priysharan19/Final-Pri-learning'}}});
const request=(operation,head=first)=>({operation,issue_number:1001,pr_number:1002,head_sha:head});
const empty={version:1,events:[]};
let count=0;
const ok=(name,fn)=>{fn();count++};
const deny=(name,pattern,fn)=>ok(name,()=>assert.throws(fn,pattern));
const g=appendGrant(empty,request('GRANT'),[issue()],pr(),main,'Priysharan19',10,now,privateKey,publicKey);
const issued=inspectSignedLog(g,publicKey,now);
ok('positive authentic GRANT',()=>assert.equal(issued.live.length,1));
const activeIssue=issue(reconcileIssueAuthority(issue(),issued,now).body);
ok('issue projection authenticated',()=>assert.equal(assertLedgerMatchesGrants([activeIssue],issued,main,now).live_writers,1));
const renew=appendGrant(g,request('RENEW',reviewed),[activeIssue],pr(reviewed),main,'Priysharan19',11,now+H,privateKey,publicKey);
const renewed=inspectSignedLog(renew,publicKey,now+H);
const afterRenew=issue(reconcileIssueAuthority(activeIssue,renewed,now+H).body.replace('Pri-Mission-Status: ACTIVE','Pri-Mission-Status: TESTING'));
ok('renewal pins new source head',()=>assert.equal(renewed.active.get(1001).head_sha,reviewed));
const released=appendGrant(renew,request('RELEASE',reviewed),[afterRenew],pr(reviewed),main,'Priysharan19',12,now+2*H,privateKey,publicKey);
const r=inspectSignedLog(released,publicKey,now+2*H);
ok('release ends write authority',()=>{assert.equal(r.live.length,0);assert.equal(r.active.size,0);assert.equal(r.released.get(1001).head_sha,reviewed)});
const frozen=issue(reconcileIssueAuthority(afterRenew,r,now+2*H).body);
ok('review marker is an exact signed source event',()=>assert.equal(assertLedgerMatchesGrants([frozen],r,main,now+2*H).live_writers,0));
ok('legitimate review passes',()=>assert.equal(verifyReleasedSource({authority:r,issue:frozen,pr:pr(reviewed),head:reviewed,mainSha:main}).head_sha,reviewed));
for(const stage of ['REVIEW','CI','MERGE_READY']) {
 const inStage=issue(frozen.body.replace('Pri-Mission-Status: REVIEW','Pri-Mission-Status: '+stage));
 ok('signed source survives '+stage,()=>assert.equal(verifyReleasedSource({authority:r,issue:inStage,pr:pr(reviewed),head:reviewed,mainSha:main}).head_sha,reviewed));
}
ok('review survives grant TTL expiration',()=>assert.equal(verifyReleasedSource({authority:inspectSignedLog(released,publicKey,now+30*H),issue:frozen,pr:pr(reviewed),head:reviewed,mainSha:main}).head_sha,reviewed));
deny('review without provenance',/REVIEW_WITHOUT_SIGNED_PROVENANCE/,()=>assertLedgerMatchesGrants([issue(baseBody.replace('TRIAGED','REVIEW'))],issued,main,now));
deny('review of changed source head',/REVIEW_PROVENANCE_MISMATCH|STALE_OR_UNTRUSTED_REVIEW_PR/,()=>verifyReleasedSource({authority:r,issue:frozen,pr:pr(later),head:later,mainSha:main}));
deny('old review on new PR head',/STALE_OR_UNTRUSTED_REVIEW_PR/,()=>verifyReleasedSource({authority:r,issue:frozen,pr:pr(later),head:reviewed,mainSha:main}));
deny('source changed after release',/REVIEW_PROVENANCE_MISMATCH|STALE_OR_UNTRUSTED_REVIEW_PR/,()=>verifyReleasedSource({authority:r,issue:frozen,pr:pr(later),head:later,mainSha:main}));
deny('reassign signed source to another mission',/REVIEW_PROVENANCE_MISMATCH/,()=>verifyReleasedSource({authority:r,issue:issue(frozen.body.replace('Pri-Mission-ID: provenance-v1','Pri-Mission-ID: other-mission')),pr:pr(reviewed),head:reviewed,mainSha:main}));
deny('forged issue provenance receipt',/REVIEW_PROVENANCE_MISMATCH/,()=>verifyReleasedSource({authority:r,issue:issue(frozen.body.replace(/Pri-Provenance-Event: [0-9a-f]{64}/,'Pri-Provenance-Event: '+'0'.repeat(64))),pr:pr(reviewed),head:reviewed,mainSha:main}));
deny('cannot release unsanctioned newer head',/RELEASE_REQUIRES_SIGNED_CHECKPOINT_HEAD/,()=>appendGrant(renew,request('RELEASE',later),[afterRenew],pr(later),main,'Priysharan19',13,now+2*H,privateKey,publicKey));
deny('cannot renew released mission',/NO_LIVE_GRANT_TO_MODIFY/,()=>appendGrant(released,request('RENEW',later),[frozen],pr(later),main,'Priysharan19',14,now+3*H,privateKey,publicKey));
const compromised=revokeAuthoritativeGrant(released,1001,'Kalp-Bajpai',15,now+3*H,privateKey,publicKey);
const c=inspectSignedLog(compromised,publicKey,now+3*H);
deny('compromise invalidates reviewed provenance',/REVIEW_WITHOUT_SIGNED_PROVENANCE/,()=>verifyReleasedSource({authority:c,issue:frozen,pr:pr(reviewed),head:reviewed,mainSha:main}));
ok('reconciliation after compromise produces deny-state',()=>assert.equal(reconcileIssueAuthority(frozen,c,now+3*H).status,'BLOCKED_AUTOMATION'));
ok('post-CAS recovery idempotent',()=>{let body=reconcileIssueAuthority(afterRenew,r,now+2*H).body;assert.equal(reconcileIssueAuthority(issue(body),r,now+2*H).changed,false)});
deny('reconcile after malicious issue edit refused',/ISSUE_IDENTITY_DIFFERS_FROM_SIGNED_AUTHORITY/,()=>reconcileIssueAuthority(issue(frozen.body.replace('Pri-Agent: platform','Pri-Agent: security')),r,now+3*H));
deny('expired grant cannot freshly release',/NO_LIVE_GRANT_TO_MODIFY|WRITER_WITHOUT_AUTHORITY_/,()=>appendGrant(renew,request('RELEASE',reviewed),[afterRenew],pr(reviewed),main,'Priysharan19',16,now+14*H,privateKey,publicKey));
ok('expired writer projects blocked not active',()=>assert.equal(reconcileIssueAuthority(afterRenew,inspectSignedLog(renew,publicKey,now+14*H),now+14*H).status,'BLOCKED_AUTOMATION'));
ok('main movement blocks old unrenewed writer',()=>assert.equal(reconcileIssueAuthority(afterRenew,renewed,now+H,'d'.repeat(40)).status,'BLOCKED_AUTOMATION'));

// Even an attacker who somehow possesses a signer and later appends a valid
// REVOKE cannot erase an earlier transient over-allocation in the signed log.
const a=g.events[0].payload;
const e2={...a,seq:2,prev:eventDigest(a),grant_id:randomUUID(),issue_number:1003,mission:'independent',agent:'security',branch:'agent/mission/security/independent',paths:['server/security/safe.js'],timestamp_ms:now+100};
const e3={...a,seq:3,prev:eventDigest(e2),grant_id:randomUUID(),issue_number:1004,mission:'third',agent:'reliability',branch:'agent/mission/reliability/third',paths:['docs/release/plan.md'],timestamp_ms:now+200};
const bad={version:1,events:[g.events[0],signEvent(e2,privateKey),signEvent(e3,privateKey),signEvent({...e3,seq:4,prev:eventDigest(e3),operation:'REVOKE',timestamp_ms:now+300},privateKey)]};
deny('historical third concurrent writer not erasable',/HISTORICAL_WRITER_CAP/,()=>inspectSignedLog(bad,publicKey,now+500));
const sameOwner={...e2,agent:'platform',paths:['server/security/safe.js']};
deny('historical same owner conflict',/HISTORICAL_OWNER_CONFLICT/,()=>inspectSignedLog({version:1,events:[g.events[0],signEvent(sameOwner,privateKey)]},publicKey,now+500));
const overlap={...e2,paths:['server/platform/accounts.js']};
deny('historical overlapping path conflict',/HISTORICAL_SCOPE_CONFLICT/,()=>inspectSignedLog({version:1,events:[g.events[0],signEvent(overlap,privateKey)]},publicKey,now+500));
const before={...e2,timestamp_ms:now-100};
deny('nonmonotonic signed event time',/NON_MONOTONIC_SIGNED_EVENT_TIME/,()=>inspectSignedLog({version:1,events:[g.events[0],signEvent(before,privateKey)]},publicKey,now+500));
// Once first writer expires, another grant at a later historical instant does not overlap.
const afterExpiry={...e2,agent:'platform',timestamp_ms:now+13*H,expiry_ms:now+20*H};
ok('expired historical lease frees owner later',()=>assert.equal(inspectSignedLog({version:1,events:[g.events[0],signEvent(afterExpiry,privateKey)]},publicKey,now+14*H).live.length,1));
// A loss of CAS by an emergency revoker must be explicit. A different
// contender winning RELEASE never silently counts as a completed REVOKE.
const memory={head:'1',log:renew}, attempts=[];
const adapter={read:async()=>({head:memory.head,log:memory.log}),
  putIfFastForward:async(parent,next)=>{
    await new Promise(resolve=>setImmediate(resolve));
    if(memory.head!==parent)throw Error('NON_FAST_FORWARD_CAS_COLLISION');
    memory.head='2';memory.log=next;return true;
  }};
const contend=await Promise.allSettled([
  authorizeCAS(adapter, log=>appendGrant(log,request('RELEASE',reviewed),[afterRenew],pr(reviewed),main,'Priysharan19',200,now+2*H,privateKey,publicKey)),
  authorizeCAS(adapter,log=>revokeAuthoritativeGrant(log,1001,'Kalp-Bajpai',201,now+2*H,privateKey,publicKey))
]);
ok('concurrent release versus compromise revocation one CAS winner',()=>{
  assert.equal(contend.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(contend.filter(x=>x.status==='rejected').length,1);
  assert.match(String(contend.find(x=>x.status==='rejected').reason),/NON_FAST_FORWARD_CAS_COLLISION/);
});
ok('replayed winner remains exactly signed',()=>assert.equal(inspectSignedLog(memory.log,publicKey,now+2*H).nextSeq,4));
const invalidatedThenForgedGrant={...g.events[0].payload,seq:5,prev:eventDigest(compromised.events.at(-1).payload),
  grant_id:randomUUID(),timestamp_ms:now+4*H,expiry_ms:now+8*H};
deny('revoked mission cannot be resurrected by signed replay',/REVOKED_MISSION_REGRANT_FORBIDDEN/,()=>
 inspectSignedLog({version:1,events:[...compromised.events,signEvent(invalidatedThenForgedGrant,privateKey)]},publicKey,now+4*H));
console.log('PASS: '+count+' source provenance, lifecycle, replay, concurrency and recovery assertions');
