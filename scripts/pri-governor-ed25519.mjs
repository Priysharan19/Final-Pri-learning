/**
 * QA governance admission verifier, adapted from the reviewed Mission 007
 * Ed25519 candidate. Public verification only, NO signer or admission API.
 * Writer states MUST equal scripts/pri-mission-control.mjs.
 *
 * This is an integration boundary, NOT proof that an issuer, protected ref or
 * independent reviewer exists. An unprovisioned keyring DENIES all grants.
 */
import {createHash,verify as cryptoVerify} from 'node:crypto';
export const WRITER_STATES=new Set(['ACTIVE','IMPLEMENTING','TESTING','REPAIR']);
export const FROZEN_STATES=new Set(['REVIEW','CI','MERGE_READY','REPAIR_PENDING']);
export const MAX_WRITERS=2;
export const MAX_TTL_MS=12*60*60*1000;
const fullSHA=/^[a-f0-9]{40}$/i;
const fail=x=>{throw Error('GOVERNOR_DENIED:'+x);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const mark=(text,k)=>{
 const values=[...String(text||'').matchAll(new RegExp('^'+k+':[ \t]*(.*)$','gmi'))].map(x=>x[1].trim());
 if(values.length!==1||!values[0])fail('MISSING_OR_DUPLICATE_'+k);
 return values[0];
};
const attrs=['Pri-Mission-ID','Pri-Mission-Status','Pri-Agent','Pri-Branch','Pri-Risk','Pri-Base-SHA','Pri-Paths'];
export function signedIssues(issues){
 if(!Array.isArray(issues)||!issues.length)fail('INCOMPLETE_ISSUE_SNAPSHOT');
 const relevant=issues.filter(x=>!x.pull_request&&String(x.title||'').startsWith('[PRI-MISSION]'));
 const ids=new Set(),missions=new Set(),branches=new Set();
 const rows=[];
 for(const x of relevant){
  if(!Number.isSafeInteger(x.number)||ids.has(x.number))fail('DUPLICATE_OR_INVALID_ISSUE');
  ids.add(x.number);
  if(!['open','closed'].includes(x.state))fail('MISSING_GITHUB_ISSUE_STATE');
  if(x.state==='closed')continue;
  const m={number:x.number,state:x.state};
  for(const k of attrs)m[k]=mark(x.body,k);
  if(missions.has(m['Pri-Mission-ID'])||branches.has(m['Pri-Branch']))fail('DUPLICATE_MISSION_OR_BRANCH');
  missions.add(m['Pri-Mission-ID']);branches.add(m['Pri-Branch']);
  if(!fullSHA.test(m['Pri-Base-SHA']))fail('INVALID_BASE_SHA');
  const branch='agent/mission/'+m['Pri-Agent']+'/'+m['Pri-Mission-ID'];
  if(m['Pri-Branch']!==branch)fail('ISSUE_BRANCH_ID_MISMATCH');
  let paths;
  try{paths=JSON.parse(m['Pri-Paths']);}catch{paths=m['Pri-Paths'].split(',').map(s=>s.trim());}
  if(!Array.isArray(paths)||!paths.length||paths.some(v=>typeof v!=='string'||!v))fail('MISSING_APPROVED_PATHS');
  m.paths=[...new Set(paths)].sort();
  rows.push(m);
 }
 return rows.sort((a,b)=>a.number-b.number);
}
export const issueDigest=issues=>digest(signedIssues(issues).map(x=>[x.number,x.state,...attrs.map(k=>x[k])]));
export function verifyEnvelope(env,keyring,kind){
 if(!env||!env.keyId||!env.payload||!env.signature)fail('UNSIGNED_'+kind);
 const key=keyring?.[env.keyId];
 if(!key||key.status!=='trusted'||!key.publicKey)fail('UNTRUSTED_VERIFICATION_KEY');
 if(env.payload.kind!==kind)fail('WRONG_ENVELOPE_KIND');
 if(!cryptoVerify(null,Buffer.from(JSON.stringify(env.payload)),key.publicKey,Buffer.from(env.signature,'base64url')))fail('INVALID_ED25519_SIGNATURE');
 return env.payload;
}
export function verifyTrustedState({signedState,keyring,issues,mainSha,now=Date.now()}){
 if(!fullSHA.test(mainSha||''))fail('INVALID_TRUSTED_MAIN_SHA');
 const state=verifyEnvelope(signedState,keyring,'pri-governor-state-v1');
 if(state.mainSha!==mainSha)fail('MAIN_MOVED_SINCE_STATE_ISSUANCE');
 if(!Number.isSafeInteger(state.revision)||state.revision<1)fail('INVALID_GOVERNOR_REVISION');
 if(state.pending)fail('INCOMPLETE_TWO_PHASE_GOVERNOR_TRANSACTION');
 if(state.issuesHash!==issueDigest(issues))fail('GITHUB_MANAGED_LEDGER_MOVED');
 if(!Array.isArray(state.grants)||!Array.isArray(state.revokedGrantIds)||!Array.isArray(state.usedEventIds))fail('INCOMPLETE_GOVERNOR_STATE');
 if(new Set(state.revokedGrantIds).size!==state.revokedGrantIds.length||new Set(state.usedEventIds).size!==state.usedEventIds.length)fail('DUPLICATE_REVOKED_OR_APPROVAL_EVENT');
 const live=signedIssues(issues).filter(x=>WRITER_STATES.has(x['Pri-Mission-Status']));
 if(live.length>MAX_WRITERS)fail('WRITER_CAP_EXCEEDED');
 if(new Set(live.map(x=>x['Pri-Agent'])).size!==live.length)fail('CONCURRENT_PRIMARY_OWNER_COLLISION');
 const identities=new Set();
 for(const x of live){
  const candidates=state.grants.filter(g=>g.payload?.issueNumber===x.number);
  if(candidates.length!==1)fail('MISSING_OR_DUPLICATE_WRITER_GRANT');
  const g=verifyEnvelope(candidates[0],keyring,'pri-writer-grant-v1');
  if(!g.grantId||identities.has(g.grantId)||state.revokedGrantIds.includes(g.grantId))fail('REPLAYED_OR_REVOKED_GRANT');
  identities.add(g.grantId);
  if(g.issueNumber!==x.number||g.missionId!==x['Pri-Mission-ID']||g.owner!==x['Pri-Agent']||
     g.branch!==x['Pri-Branch']||g.risk!==x['Pri-Risk']||g.pathsHash!==digest(x.paths)||
     g.baseSha!==x['Pri-Base-SHA']||g.mainSha!==mainSha)fail('GRANT_MISSION_SCOPE_MISMATCH');
  const issued=Date.parse(g.issuedAt),expires=Date.parse(g.expiresAt);
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now||expires<=now||
    expires<=issued||expires-issued>MAX_TTL_MS)fail('EXPIRED_OR_FORGED_LEASE_WINDOW');
  if(!Number.isSafeInteger(g.sequence)||g.sequence<1||g.sequence>state.revision||
     !g.authorizationEventId||!state.usedEventIds.includes(g.authorizationEventId))fail('UNTRACKED_AUTHORIZATION_EVENT');
 }
 if(state.grants.length!==live.length)fail('ORPHAN_ACTIVE_GRANT');
 return {authorized:true,activeCount:live.length,revision:state.revision,verifiedGrantIds:[...identities]};
}
