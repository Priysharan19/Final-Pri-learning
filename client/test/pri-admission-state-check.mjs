import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {appendGrant, inspectSignedLog, eventDigest, assertLedgerMatchesGrants,
  authorizeCAS, revokeAuthoritativeGrant, assertAppendOnlyHistory, verifyAuthorityHistory, signEvent} from '../../scripts/pri-admission-state.mjs';
const {publicKey, privateKey}=generateKeyPairSync('ed25519');
const sha='ce8d4b06c91736c82a0e9920917914fe086de6d3';
const head='90b5c405722807282c454592f6e6016397fd59a3';
const now=Date.now(), issueNumber=800, branch='agent/mission/student-experience/signup';
const body=(state='TRIAGED',extra='')=>[
 'Pri-Mission-ID: signup','Pri-Mission-Status: '+state,
 'Pri-Agent: student-experience','Pri-Branch: '+branch,
 'Pri-Risk: R3','Pri-Base-SHA: '+sha,
 'Pri-Attempt: 0','Pri-Failure-Fingerprint: none',
 'Pri-Paths: client/src/pages/Login.jsx, client/src/components/SignUpFlow.jsx',
 'Pri-Dependencies: none',extra
].join('\n');
const issue=(state='TRIAGED',extra='')=>({number:issueNumber,state:'open',title:'[PRI-MISSION] signup',body:body(state,extra)});
const pr={number:478,state:'open',head:{ref:branch,sha:head},base:{ref:'main',sha}};
const request={operation:'GRANT',issue_number:issueNumber,pr_number:478,head_sha:head};
const empty={version:1,events:[]};
let checks=0;
const ok=(label,fn)=>{fn();checks++;};
const denied=(label,rx,fn)=>ok(label,()=>assert.throws(fn,rx));
const grant=appendGrant(empty,request,[issue()],pr,sha,'Priysharan19',123456,now,privateKey,publicKey);
ok('valid signed grant',()=>assert.equal(inspectSignedLog(grant,publicKey,now).live.length,1));
const signed=grant.events[0];
ok('signed-event linkage',()=>assert.equal(eventDigest(signed.payload).length,64));
denied('missing source mission',/NON_MANAGED_ISSUE/,()=>appendGrant(empty,request,[],pr,sha,'owner',1,now,privateKey,publicKey));
denied('wrong PR exact head',/UNTRUSTED_PR_HEAD/,()=>appendGrant(empty,request,[issue()],{...pr,head:{ref:branch,sha}},sha,'owner',1,now,privateKey,publicKey));
denied('wrong base',/BASE_SHA_MOVED/,()=>appendGrant(empty,request,[issue()],pr,head,'owner',1,now,privateKey,publicKey));
denied('non-triaged grant',/REVIEW_WITHOUT_SIGNED_PROVENANCE|WRITER_STATE_NOT_ADMISSIBLE/,()=>appendGrant(empty,request,[issue('REVIEW')],pr,sha,'owner',1,now,privateKey,publicKey));
denied('forged signature',/INVALID_EVENT_SIGNATURE/,()=>inspectSignedLog({...grant,events:[{...signed,signature:'AAAA'}]},publicKey,now));
denied('edited identity after signature',/INVALID_EVENT_SIGNATURE/,()=>inspectSignedLog({...grant,events:[{...signed,payload:{...signed.payload,agent:'qa-release'}}]},publicKey,now));
denied('reordered sequence',/BROKEN_EVENT_CHAIN/,()=>inspectSignedLog({...grant,events:[{...signed,payload:{...signed.payload,seq:2}}]},publicKey,now));
denied('overlong correctly signed TTL',/INVALID_GRANT/,()=>inspectSignedLog({version:1,events:[signEvent({...signed.payload,expiry_ms:now+24*3600000},privateKey)]},publicKey,now));
denied('mutable issue cannot pose as grant',/WRITER_WITHOUT_AUTHORITY/,()=>assertLedgerMatchesGrants([issue('ACTIVE','Pri-Lease-Grant-ID: random')],inspectSignedLog(empty,publicKey,now),sha,now));
const grantId=eventDigest(grant.events[0].payload);
ok('ledger bound exactly to grant',()=>assert.equal(assertLedgerMatchesGrants([issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId)],inspectSignedLog(grant,publicKey,now),sha,now).live_writers,1));
denied('issue owner modification invalidates grant',/WRITER_AUTHORITY_DRIFT/,()=>assertLedgerMatchesGrants([{
 ...issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId),
 body:body('ACTIVE','Pri-Lease-Grant-ID: '+grantId).replace('Pri-Agent: student-experience','Pri-Agent: qa-release')
}],inspectSignedLog(grant,publicKey,now),sha,now));
denied('protected main move invalidates grant',/WRITER_AUTHORITY_DRIFT/,()=>assertLedgerMatchesGrants([issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId)],inspectSignedLog(grant,publicKey,now),head,now));
denied('expired event cannot grant writer',/WRITER_WITHOUT_AUTHORITY/,()=>assertLedgerMatchesGrants([issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId)],inspectSignedLog(grant,publicKey,now+13*3600000),sha,now+13*3600000));
const release={operation:'REVOKE',issue_number:issueNumber,pr_number:478,head_sha:head};
const revoked=appendGrant(grant,release,[issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId)],pr,sha,'Priysharan19',123457,now+2000,privateKey,publicKey);
ok('signed revocation removes lease',()=>assert.equal(inspectSignedLog(revoked,publicKey,now+2001).live.length,0));
const renewal={operation:'RENEW',issue_number:issueNumber,pr_number:478,head_sha:head};
denied('heartbeat cannot renew without new commit',/RENEW_REQUIRES_NEW_EXACT_HEAD/,()=>appendGrant(grant,renewal,[issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId)],pr,sha,'owner',1,now+2000,privateKey,publicKey));
denied('replayed grant denied while live',/LIVE_GRANT_WITH_NONWRITER_ISSUE/,()=>appendGrant(grant,request,[issue()],pr,sha,'owner',1,now+2000,privateKey,publicKey));
denied('branch cannot recycle broken event',/BROKEN_EVENT_CHAIN/,()=>inspectSignedLog({...revoked,events:[revoked.events[1],revoked.events[0]]},publicKey,now+2001));
const store={head:'a',log:empty};
let successful=0, collisions=0;
const adapter={read:async()=>({head:store.head,log:store.log}),putIfFastForward:async(expected,next)=>{
  await new Promise(resolve=>setImmediate(resolve));
  if (store.head!==expected){collisions++;throw new Error('NON_FAST_FORWARD_CAS');}
  store.log=next;store.head=String.fromCharCode(store.head.charCodeAt(0)+1);successful++;
}};
await Promise.allSettled([1,2].map(i=>authorizeCAS(adapter, log=>
  appendGrant(log,request,[issue()],pr,sha,'owner',10000+i,now+i,privateKey,publicKey))));
ok('two contenders race: exactly one CAS wins',()=>{assert.equal(successful,1);assert.equal(collisions,1);});
ok('CAS persisted one real grant',()=>assert.equal(inspectSignedLog(store.log,publicKey,now+2000).live.length,1));
const expiredRelease=appendGrant(grant,release,[issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId)],
 pr,sha,'Priysharan19',123600,now+13*3600000,privateKey,publicKey);
ok('expired granted writer can still be revoked',()=>
 assert.equal(inspectSignedLog(expiredRelease,publicKey,now+13*3600000+1).live.length,0));
const secondIssue={...issue('TRIAGED'),number:801,title:'[PRI-MISSION] signup2',
 body:body('TRIAGED').replace('Pri-Mission-ID: signup','Pri-Mission-ID: signup2').replace('Pri-Branch: '+branch,'Pri-Branch: agent/mission/student-experience/signup2')};
const secondPr={...pr,number:479,head:{...pr.head,ref:'agent/mission/student-experience/signup2'}};
const secondRequest={...request,issue_number:801,pr_number:479};
denied('same-owner collision despite disjoint source',/OWNER_NOT_DISTINCT/,
 ()=>appendGrant(grant,secondRequest,[issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId),secondIssue],
 secondPr,sha,'owner',123610,now+3000,privateKey,publicKey));
denied('unknown issue status cannot evade signed writer enforcement',/UNKNOWN_MANAGED_ISSUE_STATUS_/,
 ()=>assertLedgerMatchesGrants([issue('active')],inspectSignedLog(empty,publicKey,now),sha,now));
denied('arbitrary managed status cannot evade signed writer enforcement',/UNKNOWN_MANAGED_ISSUE_STATUS_/,
 ()=>assertLedgerMatchesGrants([issue('UNRECOGNISED')],inspectSignedLog(empty,publicKey,now),sha,now));
const hidden={...issue('TRIAGED'),number:805,title:'deceptively renamed issue'};
denied('hidden mission marker outside managed title blocks',/HIDDEN_MANAGED_ISSUE/,
 ()=>assertLedgerMatchesGrants([hidden],inspectSignedLog(empty,publicKey,now),sha,now));
denied('revocation has to match signed source identity',/WRITER_AUTHORITY_DRIFT/,
 ()=>appendGrant(grant,release,[{...issue('ACTIVE','Pri-Lease-Grant-ID: '+grantId),
 body:body('ACTIVE','Pri-Lease-Grant-ID: '+grantId).replace('Pri-Agent: student-experience','Pri-Agent: qa-release')}],
 pr,sha,'owner',2,now+2000,privateKey,publicKey));

const abandoned=revokeAuthoritativeGrant(grant,issueNumber,'Kalp-Bajpai',90020,
 now+13*3600000,privateKey,publicKey);
ok('orphaned expired PR can still revoke from signed grant alone',()=>
 assert.equal(inspectSignedLog(abandoned,publicKey,now+13*3600000+1).live.length,0));
denied('unrelated issue cannot revoke another grant',/UNKNOWN_AUTHORITY_GRANT/,()=>
 revokeAuthoritativeGrant(grant,999,'Kalp-Bajpai',90021,now+2000,privateKey,publicKey));

ok('genuine append-only signed event extension',()=>assertAppendOnlyHistory(grant,empty));
denied('rollback by rewinding valid signed log',/NON_APPEND_ONLY_AUTHORITY_HISTORY/,()=>
 assertAppendOnlyHistory(empty,grant));
denied('non-append-only historical event rewrite',/NON_APPEND_ONLY_AUTHORITY_HISTORY/,()=>
 assertAppendOnlyHistory({...revoked,events:[{...grant.events[0],signature:'altered'},revoked.events[1]]},grant));

const rootSha='a'.repeat(40), activeSha='b'.repeat(40), deletedSha='c'.repeat(40), recreatedSha='d'.repeat(40);
const filePath='.pri-os/authorized-writer-events.json';
const entries=new Map([[rootSha,{version:1,events:[]}],[activeSha,grant],[recreatedSha,{version:1,events:[]}]]);
const commits=new Map([
 [rootSha,{parents:[{sha:'0'.repeat(40)}],files:[{filename:filePath}]}],
 [activeSha,{parents:[{sha:rootSha}],files:[{filename:filePath}]}],
 [deletedSha,{parents:[{sha:activeSha}],files:[{filename:filePath}]}],
 [recreatedSha,{parents:[{sha:deletedSha}],files:[{filename:filePath}]}]
]);
const history={genesisSha:rootSha,filePath,loadCommit:async sha=>commits.get(sha),loadLog:async sha=>{
 if(!entries.has(sha)) throw Error('GITHUB_GET_404_');
 return entries.get(sha);
}};
await assert.rejects(verifyAuthorityHistory({...history,head:activeSha,genesisSha:''}),/AUTHORITY_GENESIS_NOT_PINNED/);checks++;
await verifyAuthorityHistory({...history,head:activeSha});
checks++;
await assert.rejects(verifyAuthorityHistory({...history,head:recreatedSha}),/UNPINNED_EMPTY_AUTHORITY_LOG/);
checks++;
await assert.rejects(verifyAuthorityHistory({...history,head:activeSha,genesisSha:'e'.repeat(40)}),/PINNED_AUTHORITY_GENESIS_UNREACHABLE|AUTHORITY_HISTORY_CONTAINS_UNTRUSTED_CHANGE|UNPINNED_EMPTY_AUTHORITY_LOG/);
checks++;
denied('risk tampering breaks signature',/INVALID_EVENT_SIGNATURE/,()=>inspectSignedLog({version:1,events:[{...signed,payload:{...signed.payload,risk:'R1'}}]},publicKey,now));
denied('invalid signed risk rejected',/INVALID_SIGNED_RISK/,()=>inspectSignedLog({version:1,events:[signEvent({...signed.payload,risk:'R9'},privateKey)]},publicKey,now));
console.log('PASS: '+checks+' signed-grant/CAS security assertions');

// Signed-but-out-of-domain events must fail even with a valid private key.
for (const [field,value] of [
  ['repository','someone-else/Fork'],['policy_version',999],['signer_id','untrusted-signer'],['grant_id','reused']
]) denied('signed wrong authority '+field,/INVALID_GRANT_DOMAIN/,()=>
  inspectSignedLog({version:1,events:[signEvent({...signed.payload,[field]:value},privateKey)]},publicKey,now));
const colliding={...signed.payload,
  seq:2, prev:eventDigest(signed.payload),issue_number:801,
  mission:'collision',agent:'platform',branch:'agent/mission/platform/collision',
  grant_id:'550e8400-e29b-41d4-a716-446655440000',paths:['client/src/pages/Login.jsx']};
denied('signed conflicting source scopes rejected',/HISTORICAL_SCOPE_CONFLICT|WRITER_SCOPE_CONFLICT/,()=>
 inspectSignedLog({version:1,events:[signed,signEvent(colliding,privateKey)]},publicKey,now));
denied('signed grant identifier reuse rejected',/REUSED_GRANT_ID/,()=>
 inspectSignedLog({version:1,events:[signed,signEvent({...colliding,grant_id:signed.payload.grant_id},privateKey)]},publicKey,now));
console.log('PASS: 6 additional authenticated domain, identity and conflicting-scope adversarial assertions');

const duplicateMission={...secondIssue,body:body('TRIAGED')};
denied('distinct open issues cannot reuse one mission ID',/DUPLICATE_MISSION_ID_/,
 ()=>assertLedgerMatchesGrants([issue(),duplicateMission],inspectSignedLog(empty,publicKey,now),sha,now));
const duplicateBranch={...secondIssue,body:body('TRIAGED').replace('Pri-Mission-ID: signup','Pri-Mission-ID: signup-two')};
denied('distinct open issues cannot reuse one mission branch',/DUPLICATE_MISSION_BRANCH_/,
 ()=>assertLedgerMatchesGrants([issue(),duplicateBranch],inspectSignedLog(empty,publicKey,now),sha,now));
console.log('PASS: 2 extra managed-ledger identity conflict regressions');
