import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {signedIssues,issueDigest,verifyTrustedState} from '../../scripts/pri-governor-ed25519.mjs';
import {ProtectedGovernorRef} from '../../scripts/pri-governor-ref.mjs';
const main='c'.repeat(40),now=Date.parse('2026-10-14T12:00:00Z');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const keys={qa1:{status:'trusted',publicKey}};
const issue=(n,owner='india-curriculum',status='ACTIVE')=>({number:n,state:'open',title:'[PRI-MISSION] test',
 body:['Pri-Mission-ID: mission-'+n,'Pri-Mission-Status: '+status,'Pri-Agent: '+owner,
 'Pri-Branch: agent/mission/'+owner+'/mission-'+n,'Pri-Risk: R3',
 'Pri-Base-SHA: '+main,'Pri-Paths: ["client/src/engine/ncert/a.js"]'].join('\n')});
const sig=p=>({keyId:'qa1',payload:p,signature:sign(null,Buffer.from(JSON.stringify(p)),privateKey).toString('base64url')});
const digest=arr=>createHash('sha256').update(JSON.stringify(arr)).digest('hex');

const record=issue(470);
const pathHash=digest(['client/src/engine/ncert/a.js']);
const grant=sig({kind:'pri-writer-grant-v1',grantId:'grant-1',issueNumber:470,missionId:'mission-470',owner:'india-curriculum',
 branch:'agent/mission/india-curriculum/mission-470',risk:'R3',pathsHash:pathHash,baseSha:main,mainSha:main,sequence:1,
 issuedAt:'2026-10-14T11:00:00Z',expiresAt:'2026-10-14T13:00:00Z',authorizationEventId:'QA-a1'});
const state=sig({kind:'pri-governor-state-v1',revision:1,mainSha:main,issuesHash:issueDigest([record]),
 grants:[grant],revokedGrantIds:[],usedEventIds:['QA-a1'],pending:null});
const request={signedState:state,keyring:keys,issues:[record],mainSha:main,now};
let checks=0;function ok(f){f();checks++;}function no(p,fragment){assert.throws(()=>verifyTrustedState(p),e=>String(e).includes(fragment));checks++;}
ok(()=>assert.equal(verifyTrustedState(request).activeCount,1));
no({...request,keyring:{}},'UNTRUSTED');
no({...request,issues:[]},'INCOMPLETE');
no({...request,mainSha:'d'.repeat(40)},'MAIN_MOVED');
no({...request,now:Date.parse('2026-10-14T14:00:00Z')},'EXPIRED');
no({...request,signedState:{...state,signature:'abcd'}},'SIGNATURE');
no({...request,signedState:sig({...state.payload,pending:{issueNumber:470}})},'INCOMPLETE_TWO_PHASE');
no({...request,signedState:sig({...state.payload,revokedGrantIds:['grant-1']})},'REVOKED');
no({...request,signedState:sig({...state.payload,usedEventIds:[]})},'UNTRACKED');
no({...request,issues:[{...record,body:record.body.replace('Pri-Risk: R3','Pri-Risk: R4')}]},'LEDGER_MOVED');
no({...request,issues:[record,issue(471,'india-curriculum')]},'LEDGER_MOVED');
no({...request,signedState:sig({...state.payload,grants:[grant,grant]})},'MISSING_OR_DUPLICATE_WRITER_GRANT');
no({...request,signedState:sig({...state.payload,revision:0})},'REVISION');
no({...request,issues:[{...record,state:'closed'}]},'LEDGER_MOVED');
no({...request,issues:[{...record,state:'unknown'}]},'ISSUE_STATE');
no({...request,issues:[{...record,body:record.body.replace('Pri-Mission-Status: ACTIVE','Pri-Mission-Status: active')}]},'UNKNOWN_MISSION_STATUS');
const wrong=sig({...grant.payload,pathsHash:'f'.repeat(64)});
no({...request,signedState:sig({...state.payload,grants:[wrong]})},'SCOPE');
const stale=sig({...grant.payload,expiresAt:'2026-10-15T03:00:00Z'});
no({...request,signedState:sig({...state.payload,grants:[stale]})},'FORGED_LEASE_WINDOW');
const altered=sig({...grant.payload,branch:'agent/mission/student-experience/misbound'});
no({...request,signedState:sig({...state.payload,grants:[altered]})},'SCOPE');
const old=process.env.GITHUB_EVENT_NAME;process.env.GITHUB_EVENT_NAME='pull_request';
assert.throws(()=>new ProtectedGovernorRef({token:'x'.repeat(32)}),/UNTRUSTED_PR_JOB/);checks++;
if(old===undefined)delete process.env.GITHUB_EVENT_NAME;else process.env.GITHUB_EVENT_NAME=old;
assert.throws(()=>new ProtectedGovernorRef({token:''}),/RESTRICTED/);checks++;
const saved=process.env.GITHUB_EVENT_NAME;delete process.env.GITHUB_EVENT_NAME;
const gov=new ProtectedGovernorRef({token:'x'.repeat(32),fetcher:async()=>({ok:false,status:404,json:async()=>({})})});
if(saved===undefined)delete process.env.GITHUB_EVENT_NAME;else process.env.GITHUB_EVENT_NAME=saved;
await assert.rejects(()=>gov.ensureProtected(),/GITHUB_API_GET_404/);checks++;
console.log('PASS '+checks+' Ed25519 signed grant/state and protected-ref fail-closed cases, no private keys stored.');
