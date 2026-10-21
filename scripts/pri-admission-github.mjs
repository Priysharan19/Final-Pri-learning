#!/usr/bin/env node
// Trusted workflow transport. Only run from protected default branch or a
// read-only verification job using the protected default branch checkout.
// Requires an independently approved environment and a protected grant ref.
// This script never upgrades a normal PR or an editable issue into authority.
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  appendGrant, assertLedgerMatchesGrants, inspectSignedLog, issueIdentity, eventDigest, verifyAuthorityHistory, revokeAuthoritativeGrant
} from './pri-admission-state.mjs';
import {verifyDiffOwnership} from './pri-admission-paths.mjs';

const REPO=process.env.GITHUB_REPOSITORY || '';
const GH_TOKEN=process.env.GITHUB_TOKEN || '';
const REF='pri-writer-admissions';
const FILE='.pri-os/authorized-writer-events.json';
let PUBKEY;
try { PUBKEY=readFileSync(new URL('../.pri-os/admission-public-key.pem',import.meta.url),'utf8'); }
catch { PUBKEY=null; }
const API='https://api.github.com/repos/' + REPO + '/';
const mode=process.argv[2] || 'verify';
function ensure(cond,reason){if(!cond) throw new Error(reason);}
async function api(method,path,data) {
  ensure(REPO==='Priysharan19/Final-Pri-learning' && GH_TOKEN,'TRUSTED_REPOSITORY_TOKEN_REQUIRED');
  const response=await fetch(API+path,{method,headers:{
    'Authorization':'Bearer '+GH_TOKEN,'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    ...(data?{'Content-Type':'application/json'}:{})
  },body:data?JSON.stringify(data):undefined});
  const body=await response.text();
  if (!response.ok) throw new Error('GITHUB_'+method+'_'+response.status+'_'+path.split('?')[0]+'_'+body.slice(0,140));
  return {data:body?JSON.parse(body):null,headers:response.headers};
}
const get=async p=>(await api('GET',p)).data;
async function allPages(path) {
  const all=[];
  for (let page=1;page<100;page++) {
    const {data,headers}=await api('GET',path + (path.includes('?')?'&':'?')+'per_page=100&page='+page);
    ensure(Array.isArray(data),'UNEXPECTED_GITHUB_PAGE');
    all.push(...data);
    if (!headers.get('link')?.includes('rel="next"')) return all;
  }
  throw new Error('GITHUB_SNAPSHOT_PAGINATION_LIMIT');
}
async function reference(refName=REF) {
  const r=await get('git/ref/heads/'+encodeURIComponent(refName));
  ensure(r.ref==='refs/heads/'+refName && /^[0-9a-f]{40}$/.test(r.object?.sha),'INVALID_GIT_REF');
  return r.object.sha;
}
async function fileVersion(revision) {
  const content=await get('contents/'+FILE+'?ref='+encodeURIComponent(revision));
  ensure(content.encoding==='base64' && content.type==='file','MISSING_PROTECTED_AUTHORITY_FILE');
  return JSON.parse(Buffer.from(content.content.replace(/\s/g,''),'base64').toString('utf8'));
}
async function readAuthority() {
  const head=await reference();
  const genesisSha=process.env.PRI_AUTHORITY_GENESIS_SHA;
  return verifyAuthorityHistory({
    head,genesisSha,filePath:FILE,
    loadCommit:sha=>get('commits/'+sha),
    loadLog:sha=>fileVersion(sha)
  });
}
async function assertProtectionReadOnly() {
  const branch=await get('branches/'+encodeURIComponent(REF));
  ensure(branch.protected===true,'AUTHORITY_REF_NOT_PROTECTED');
  const rules=await get('rules/branches/'+encodeURIComponent(REF));
  ensure(Array.isArray(rules) &&
    rules.some(r=>r.type==='non_fast_forward') &&
    rules.some(r=>r.type==='deletion'),
    'AUTHORITY_FORCE_OR_DELETE_PROTECTION_MISSING');
}

async function assertProtection() {
  // Enforce the ruleset verified by read-only jobs as well as classic protection.
  await assertProtectionReadOnly();
  const branch=await get('branches/'+encodeURIComponent(REF)+'/protection');
  ensure(branch.enforce_admins?.enabled===true && branch.allow_force_pushes?.enabled===false
    && branch.allow_deletions?.enabled===false,'AUTHORITY_REF_NOT_PROTECTED');
}
function parseMarker(body,key){const lines=String(body).split('\n').filter(x=>x.toLowerCase().startsWith((key+':').toLowerCase()));ensure(lines.length===1,'MARKER_'+key);return lines[0].slice(key.length+1).trim();}
function replace(body,key,value) {
  const lines=String(body).split('\n').filter(x=>!x.toLowerCase().startsWith((key+':').toLowerCase()));
  if(value!==null) lines.push(key+': '+value);
  return lines.join('\n').trim()+'\n';
}
function fileMatches(pattern,p) {
  if (typeof pattern!=='string' || typeof p!=='string' || !pattern ||
    pattern.startsWith('/') || p.startsWith('/') ||
    pattern.split('/').includes('..') || p.split('/').includes('..')) return false;
  let rx='^';
  for(let i=0;i<pattern.length;i++) {
    const c=pattern[i];
    if(c==='*' && pattern[i+1]==='*') {rx+='.*';i++;}
    else if(c==='*') rx+='[^/]*';
    else if(c==='?') rx+='[^/]';
    else rx+=c.replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');
  }
  return new RegExp(rx+'$').test(p);
}
function run(args) {
  const p=spawnSync(process.execPath,args,{encoding:'utf8'});
  return {ok:p.status===0,stdout:p.stdout,stderr:p.stderr};
}
async function inspectRemote(nowMs, strict=true) {
  ensure(PUBKEY?.includes('PUBLIC KEY'),'PROTECTED_PUBLIC_KEY_NOT_PROVISIONED');
  const mainSha=await reference('main');
  const issues=await allPages('issues?state=all');
  const auth=await readAuthority();
  const replay=inspectSignedLog(auth.log,PUBKEY,nowMs);
  const ledger=strict ? assertLedgerMatchesGrants(issues,replay,mainSha,nowMs) : null;
  return {mainSha,issues,auth,replay,ledger};
}
async function verifyOnly() {
  await assertProtectionReadOnly();
  const inspected=await inspectRemote(Date.now());
  const number=Number(process.env.EXPECTED_PR_NUMBER);
  const head=process.env.EXPECTED_PR_HEAD;
  ensure(Number.isInteger(number) && number>0 && /^[a-f0-9]{40}$/.test(String(head||'')),
    'PR_EXACT_HEAD_PROVENANCE_REQUIRED');
  const pr=await get('pulls/'+number);
  ensure(pr.number===number && pr.state==='open' && pr.head?.sha===head &&
    pr.head?.repo?.full_name===REPO && pr.base?.repo?.full_name===REPO &&
    pr.base?.ref==='main' && pr.base?.sha===inspected.mainSha,
    'PR_HEAD_OR_BASE_CHANGED');
  const matching=inspected.issues.filter(x=>!x.pull_request && x.state==='open' &&
    String(x.title||'').startsWith('[PRI-MISSION]') &&
    issueIdentity(x).branch===pr.head.ref);
  ensure(matching.length===1,'AMBIGUOUS_OR_MISSING_MISSION_ISSUE');
  const mission=issueIdentity(matching[0]);
  ensure(mission.branch==='agent/mission/'+mission.agent+'/'+mission.mission,
    'MISSION_BRANCH_ID_MISMATCH');
  const grant=inspected.replay.live.find(g=>g.issue_number===matching[0].number);
  ensure(grant && grant.mission===mission.mission && grant.agent===mission.agent &&
    grant.branch===mission.branch && grant.risk===mission.risk &&
    grant.head_sha===head && grant.base_sha===mission.base_sha &&
    grant.main_sha===inspected.mainSha &&
    eventDigest(grant)===parseMarker(matching[0].body,'Pri-Lease-Grant-ID'),
    'MISSING_SCOPE_BOUND_SIGNED_CURRENT_HEAD_GRANT');
  const files=await allPages('pulls/'+number+'/files');
  ensure(files.length>0 && files.length===pr.changed_files,'INCOMPLETE_EXACT_PR_DIFF');
  verifyDiffOwnership(files,mission.paths,mission.agent, filename=>{
    const routed=run([join(process.cwd(),'scripts/pri-fleet.mjs'),'route',filename]);
    ensure(routed.ok,'WRITER_FILE_OWNER_UNKNOWN_'+filename);
    return JSON.parse(routed.stdout);
  });
  console.log(JSON.stringify({decision:'EXACT_PR_SIGNED_GRANT_VERIFIED',pr_number:number,
    head_sha:head,issue_number:matching[0].number,mission:mission.mission,
    agent:mission.agent,risk:mission.risk,paths:mission.paths,
    expiry_ms:grant.expiry_ms,authority_head:inspected.auth.head,
    event_digest:eventDigest(grant),checked_files:files.length}));
}
async function commitSignedTransaction(inspected,next,request,runId) {
  inspectSignedLog(next,PUBKEY,Date.now());
  const parent=await get('git/commits/'+inspected.auth.head);
  const blob=await api('POST','git/blobs',{
    content:JSON.stringify(next,null,2)+'\n',encoding:'utf-8'
  });
  const tree=await api('POST','git/trees',{base_tree:parent.tree.sha,tree:[{
    path:FILE,mode:'100644',type:'blob',sha:blob.data.sha
  }]});
  const commit=await api('POST','git/commits',{
    message:'governor: '+request.operation+' mission #'+request.issue_number+' run '+runId,
    tree:tree.data.sha,parents:[inspected.auth.head]
  });
  await api('PATCH','git/refs/heads/'+REF,{sha:commit.data.sha,force:false});
  ensure(await reference()===commit.data.sha,'CAS_COMMIT_NOT_VISIBLE');
  return commit.data.sha;
}
async function transactRevocation(request,inspected,actor,runId,nowMs,secret) {
  const prior=inspected.replay.active.get(request.issue_number);
  if(!prior) {
    const latest=[...inspected.auth.log.events].reverse().find(e=>
      e.payload.issue_number===request.issue_number);
    ensure(latest?.payload.operation==='REVOKE', 'NO_AUTHORITY_GRANT_TO_REVOKE');
    console.log(JSON.stringify({decision:'ALREADY_REVOKED_SIGNED_AUTHORITY',
      receipt:eventDigest(latest.payload),issue_number:request.issue_number,
      authority_head:inspected.auth.head,issue_reconciliation_required:true}));
    return;
  }
  const next=revokeAuthoritativeGrant(inspected.auth.log,request.issue_number,
    actor,runId,nowMs,secret,PUBKEY);
  const committed=await commitSignedTransaction(inspected,next,request,runId);
  // A signed revocation is effective immediately. A closed or deleted PR
  // is deliberately NOT required to release a writer.
  let current;
  try { current=await get('issues/'+request.issue_number); }
  catch(e) {
    if(!/GITHUB_GET_(404|410)_/.test(String(e.message))) throw e;
    current={state:'missing'};
  }
  if(current.state==='open' && String(current.title||'').startsWith('[PRI-MISSION]')) {
    let body=replace(current.body,'Pri-Mission-Status','BLOCKED_AUTOMATION');
    for(const key of ['Pri-Lease-Grant-ID','Pri-Lease-Heartbeat-At',
      'Pri-Lease-Heartbeat-Ref','Pri-Lease-Heartbeat-By'])
      body=replace(body,key,null);
    await api('PATCH','issues/'+request.issue_number,{body});
  }
  const final=await inspectRemote(Date.now(),false);
  ensure(final.auth.head===committed,'REVOKED_REF_CHANGED');
  console.log(JSON.stringify({decision:'REVOKED_SIGNED_AUTHORITY',
    receipt:eventDigest(next.events.at(-1).payload),issue_number:request.issue_number,
    authority_head:committed,issue_reconciliation_required:current.state!=='open'}));
}

async function transact() {
  ensure(process.env.GITHUB_EVENT_NAME==='workflow_dispatch'
    && process.env.GITHUB_REF==='refs/heads/main'
    && process.env.GITHUB_SHA,'UNTRUSTED_WORKFLOW_CONTEXT');
  const actor=process.env.GITHUB_ACTOR;
  const runId=Number(process.env.GITHUB_RUN_ID);
  ensure(actor && Number.isSafeInteger(runId) && runId>0,'UNTRUSTED_ACTOR_OR_RUN');
  // GitHub environment required reviewer is independently configured.
  const env=await get('environments/pri-writer-admission');
  const policy=env.protection_rules?.find(r=>r.type==='required_reviewers');
  ensure(policy?.prevent_self_review===true &&
    policy.reviewers?.some(r=>r.type==='User' && r.reviewer?.login==='Kalp-Bajpai'),
    'INDEPENDENT_ENVIRONMENT_APPROVAL_REQUIRED');
  const approvals=await get('actions/runs/'+runId+'/approvals');
  ensure(Array.isArray(approvals) && approvals.some(a=>
    a.state==='approved' && a.user?.login==='Kalp-Bajpai' &&
    a.user.login!==actor && a.environments?.some(e=>e.name==='pri-writer-admission')),
    'AUTHENTICATED_INDEPENDENT_RUN_APPROVAL_REQUIRED');
  const securityPermission=await get('collaborators/Kalp-Bajpai/permission');
  ensure(['admin','maintain','write'].includes(securityPermission.permission),
    'ENVIRONMENT_APPROVER_NOT_AUTHORITATIVE_WRITER');
  const permission=await get('collaborators/'+encodeURIComponent(actor)+'/permission');
  ensure(['admin','maintain','write'].includes(permission.permission),'ACTOR_NOT_REPOSITORY_WRITER');
  await assertProtection();
  const request=JSON.parse(readFileSync(process.argv[3],'utf8'));
  ensure(Number.isInteger(request.issue_number) && request.issue_number>0 &&
    ['GRANT','RENEW','REVOKE'].includes(request.operation) &&
    (request.operation==='REVOKE' ||
      (Number.isInteger(request.pr_number) && request.pr_number>0 &&
       /^[0-9a-f]{40}$/.test(request.head_sha))),
    'INVALID_GOVERNOR_REQUEST');
  const nowMs=Date.now();
  const inspected=await inspectRemote(nowMs,request.operation!=='REVOKE');
  ensure(inspected.mainSha===process.env.GITHUB_SHA,'MAIN_SHA_DRIFT');
  const secret=process.env.PRI_ADMISSION_PRIVATE_KEY?.replace(/\\n/g,'\n');
  ensure(secret?.includes('PRIVATE KEY'),'PROTECTED_SIGNING_SECRET_REQUIRED');
  if(request.operation==='REVOKE')
    return transactRevocation(request,inspected,actor,runId,nowMs,secret);
  const issue=inspected.issues.find(x=>x.number===request.issue_number && !x.pull_request);
  const mission=issueIdentity(issue);
  const pr=await get('pulls/'+request.pr_number);
  // All changed files must be in the exact mission scope and owned by its
  // one canonical primary agent. PR changed-files pagination is complete.
  const files=await allPages('pulls/'+request.pr_number+'/files');
  ensure(files.length>0 && Number.isInteger(pr.changed_files) &&
    files.length===pr.changed_files,'EMPTY_OR_INCOMPLETE_SOURCE_SCOPE');
  ensure(pr.head?.repo?.full_name===REPO && pr.base?.repo?.full_name===REPO,
    'SOURCE_PR_REPOSITORY_MISMATCH');
  verifyDiffOwnership(files,mission.paths,mission.agent, filename=>{
    const result=run([join(process.cwd(),'scripts/pri-fleet.mjs'),'route',filename]);
    ensure(result.ok,'NO_CANONICAL_OWNER_'+filename);
    return JSON.parse(result.stdout);
  });
  if (request.operation==='GRANT') {
    // Every issue remains part of the full, live GitHub snapshot. The CLI
    // deliberately says snapshot-eligible, never grants its own lease.
    const dir=mkdtempSync(join(tmpdir(),'pri-admission-'));
    const candidate={id:mission.mission,status:mission.status,agent:mission.agent,
      branch:mission.branch,risk:mission.risk,base_sha:mission.base_sha,paths:mission.paths,
      dependencies:[],updated_at:issue.updated_at};
    writeFileSync(join(dir,'candidate.json'),JSON.stringify(candidate));
    writeFileSync(join(dir,'issues.json'),JSON.stringify(inspected.issues));
    const advisory=run([join(process.cwd(),'scripts/pri-mission-control.mjs'),'admit',
      join(dir,'candidate.json'),join(dir,'issues.json')]);
    let result;try{result=JSON.parse(advisory.stdout);}catch{throw new Error('ADVISORY_VALIDATOR_CRASH');}
    ensure(!advisory.ok && result.reason==='SERIALIZED_ADMISSION_REQUIRED'
      && result.eligible_on_snapshot===true,'FULL_LEDGER_ADMISSION_DENIED_'+result.reason);
    for (const g of inspected.replay.live) {
      const dirPair=mkdtempSync(join(tmpdir(),'pri-pair-'));
      const left={...candidate,dependencies:[]};
      const right={id:g.mission,agent:g.agent,branch:g.branch,base_sha:g.base_sha,
        risk:'R3',status:'ACTIVE',paths:g.paths,dependencies:[]};
      writeFileSync(join(dirPair,'a.json'),JSON.stringify(left));
      writeFileSync(join(dirPair,'b.json'),JSON.stringify(right));
      ensure(run([join(process.cwd(),'scripts/pri-mission-control.mjs'),'can-run-concurrently',
        join(dirPair,'a.json'),join(dirPair,'b.json')]).ok,'CONCURRENCY_RULE_DENIED');
    }
  }
  const next=appendGrant(inspected.auth.log,request,inspected.issues,pr,inspected.mainSha,
    actor,runId,nowMs,secret,PUBKEY);
  inspectSignedLog(next,PUBKEY,nowMs);
  // Build a Git commit with a single changed authority JSON blob. The
  // GitHub non-fast-forward ref update is the atomic compare-and-swap.
  const parent=await get('git/commits/'+inspected.auth.head);
  const blob=await api('POST','git/blobs',{content:JSON.stringify(next,null,2)+'\n',encoding:'utf-8'});
  const tree=await api('POST','git/trees',{base_tree:parent.tree.sha,tree:[{
    path:FILE,mode:'100644',type:'blob',sha:blob.data.sha
  }]});
  const commit=await api('POST','git/commits',{
    message:'governor: '+request.operation+' mission #'+request.issue_number+' run '+runId,
    tree:tree.data.sha,parents:[inspected.auth.head]
  });
  await api('PATCH','git/refs/heads/'+REF,{sha:commit.data.sha,force:false});
  ensure(await reference()===commit.data.sha,'CAS_COMMIT_NOT_VISIBLE');
  // The issue is a synchronised view ONLY; the signed git lineage is truth.
  // A crash or concurrent body edit after CAS fails closed, never fabricates
  // permission. Recovery requires another independently approved transaction.
  const current=await get('issues/'+request.issue_number);
  ensure(current.body===issue.body,'POST_CAS_ISSUE_BODY_DRIFT');
  const p=next.events[next.events.length-1].payload;
  let body=issue.body;
  if(request.operation==='REVOKE') {
    body=replace(body,'Pri-Mission-Status','REVIEW');
    body=replace(body,'Pri-Review-Head',request.head_sha);
    for(const key of ['Pri-Lease-Grant-ID','Pri-Lease-Heartbeat-At','Pri-Lease-Heartbeat-Ref','Pri-Lease-Heartbeat-By'])
      body=replace(body,key,null);
  } else {
    body=replace(body,'Pri-Mission-Status','ACTIVE');
    body=replace(body,'Pri-Lease-Grant-ID',eventDigest(p));
    body=replace(body,'Pri-Lease-Heartbeat-At',new Date(nowMs).toISOString());
    body=replace(body,'Pri-Lease-Heartbeat-Ref',request.head_sha);
    body=replace(body,'Pri-Lease-Heartbeat-By',mission.agent);
  }
  await api('PATCH','issues/'+request.issue_number,{body});
  const final=await inspectRemote(Date.now(),request.operation!=='REVOKE');
  ensure(final.auth.head===commit.data.sha && final.mainSha===inspected.mainSha,
    'POST_ADMISSION_AUTHORITY_MOVED');
  console.log(JSON.stringify({decision:'COMMITTED_AND_VERIFIED',operation:request.operation,
    event_sha:eventDigest(p),main_sha:final.mainSha,authority_head:final.auth.head,
    ...(final.ledger || {status:'RECOVERY_REVOKED_PENDING_FULL_LEDGER_RECONCILIATION'})}));
}
try {
  if(mode==='verify') await verifyOnly();
  else if(mode==='transact') await transact();
  else throw new Error('UNKNOWN_GOVERNOR_OPERATION');
} catch(e) {
  console.error('GOVERNANCE_DENIED: '+String(e.message || e));
  process.exitCode=1;
}
