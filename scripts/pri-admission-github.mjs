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
  appendGrant, assertLedgerMatchesGrants, inspectSignedLog, issueIdentity, eventDigest, verifyAuthorityHistory, revokeAuthoritativeGrant, verifyReleasedSource, reconcileIssueAuthority
} from './pri-admission-state.mjs';
import {verifyDiffOwnership} from './pri-admission-paths.mjs';

// Egress is restricted to this one canonical GitHub repository.
const REPO='Priysharan19/Final-Pri-learning';
const GH_TOKEN=process.env.GITHUB_TOKEN || '';
const REF='pri-writer-admissions';
const FILE='.pri-os/authorized-writer-events.json';
let PUBKEY;
try { PUBKEY=readFileSync(new URL('../.pri-os/admission-public-key.pem',import.meta.url),'utf8'); }
catch { PUBKEY=null; }
const API='https://api.github.com/repos/Priysharan19/Final-Pri-learning/';
const mode=process.argv[2] || 'verify';
function ensure(cond,reason){if(!cond) throw new Error(reason);}
async function api(method,path,data) {
  ensure(process.env.GITHUB_REPOSITORY===REPO && GH_TOKEN,'TRUSTED_REPOSITORY_TOKEN_REQUIRED');
  ensure(/^(GET|POST|PATCH)$/.test(method) && /^[a-z0-9_/%?&=.+\-]+$/i.test(path) && !path.includes('..') && !path.startsWith('/'), 'DISALLOWED_GITHUB_API_REQUEST');
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
function replace(body,key,value) {
  const lines=String(body).split('\n').filter(x=>!x.toLowerCase().startsWith((key+':').toLowerCase()));
  if(value!==null) lines.push(key+': '+value);
  return lines.join('\n').trim()+'\n';
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
  const proof=verifyReleasedSource({authority:inspected.replay,issue:matching[0],
    pr,head,mainSha:inspected.mainSha});
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
    review_provenance:proof.provenance_digest,authority_head:inspected.auth.head,
    grant_id:proof.grant_id,checked_files:files.length}));
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
// CAS is the authority; an issue patch is a separate, auditable projection.
// Recovery is safe to repeat, including after a post-CAS transport failure.
async function reconcileRemoteIssue(issueNumber, expectedAuthorityHead) {
  const snapshot=await inspectRemote(Date.now(),false);
  ensure(snapshot.auth.head===expectedAuthorityHead,'AUTHORITY_MOVED_DURING_RECOVERY');
  const current=snapshot.issues.find(x=>x.number===issueNumber && !x.pull_request);
  ensure(current && current.state==='open','MANAGED_ISSUE_NOT_OPEN_FOR_RECONCILIATION');
  const repair=reconcileIssueAuthority(current,snapshot.replay,Date.now(),snapshot.mainSha);
  if(repair.changed) await api('PATCH','issues/'+issueNumber,{body:repair.body});
  const after=await get('issues/'+issueNumber);
  ensure(after.body===repair.body && after.state==='open','ISSUE_RECONCILIATION_NOT_CONFIRMED');
  ensure(await reference()===expectedAuthorityHead,'AUTHORITY_CHANGED_AFTER_RECONCILIATION');
  return {status:repair.status,changed:repair.changed,event:repair.authority_event};
}
async function transactRevocation(request,inspected,actor,runId,nowMs,secret) {
  const prior=inspected.replay.active.get(request.issue_number) ||
    inspected.replay.released.get(request.issue_number);
  if(!prior) {
    ensure(inspected.replay.invalidated.has(request.issue_number),
      'NO_SIGNED_GRANT_TO_REVOKE');
    const repair=await reconcileRemoteIssue(request.issue_number,inspected.auth.head);
    console.log(JSON.stringify({decision:'ALREADY_REVOKED_AND_RECONCILED',
      issue_number:request.issue_number,authority_head:inspected.auth.head,repair}));
    return;
  }
  const next=revokeAuthoritativeGrant(inspected.auth.log,request.issue_number,
    actor,runId,nowMs,secret,PUBKEY);
  const committed=await commitSignedTransaction(inspected,next,request,runId);
  // If patching fails, leave the signed invalidation effective and emit a
  // failed run. A protected RECONCILE request repairs the issue projection.
  const repair=await reconcileRemoteIssue(request.issue_number,committed);
  console.log(JSON.stringify({decision:'REVOKED_AND_RECONCILED',
    receipt:eventDigest(next.events.at(-1).payload),issue_number:request.issue_number,
    authority_head:committed,repair}));
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
  // The request is an independently approved workflow_dispatch input, not
  // arbitrarily loaded file contents eligible for outbound API transmission.
  const request={
    operation:process.env.PRI_REQUEST_OPERATION,
    issue_number:Number(process.env.PRI_REQUEST_ISSUE_NUMBER),
    pr_number:Number(process.env.PRI_REQUEST_PR_NUMBER),
    head_sha:process.env.PRI_REQUEST_HEAD_SHA
  };
  ensure(Number.isInteger(request.issue_number) && request.issue_number>0 &&
    ['GRANT','RENEW','RELEASE','REVOKE','RECONCILE'].includes(request.operation) &&
    (['REVOKE','RECONCILE'].includes(request.operation) ||
      (Number.isInteger(request.pr_number) && request.pr_number>0 &&
       /^[0-9a-f]{40}$/.test(request.head_sha))),
    'INVALID_GOVERNOR_REQUEST');
  const nowMs=Date.now();
  const inspected=await inspectRemote(nowMs,!['REVOKE','RECONCILE'].includes(request.operation));
  ensure(inspected.mainSha===process.env.GITHUB_SHA,'MAIN_SHA_DRIFT');
  if(request.operation==='RECONCILE') {
    const repair=await reconcileRemoteIssue(request.issue_number,inspected.auth.head);
    console.log(JSON.stringify({decision:'SIGNED_AUTHORITY_PROJECTION_RECONCILED',
      issue_number:request.issue_number,authority_head:inspected.auth.head,repair}));
    return;
  }
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
  // A signed CAS winner becomes authoritative even if issue synchronization
  // fails. RECONCILE requires the same independently approved environment.
  const repair=await reconcileRemoteIssue(request.issue_number,commit.data.sha);
  const final=await inspectRemote(Date.now(),true);
  ensure(final.auth.head===commit.data.sha && final.mainSha===inspected.mainSha,
    'POST_ADMISSION_AUTHORITY_MOVED');
  console.log(JSON.stringify({decision:'COMMITTED_AND_RECONCILED',operation:request.operation,
    event_sha:eventDigest(next.events.at(-1).payload),main_sha:final.mainSha,
    authority_head:final.auth.head,repair,ledger:final.ledger}));
}
try {
  if(mode==='verify') await verifyOnly();
  else if(mode==='transact') await transact();
  else throw new Error('UNKNOWN_GOVERNOR_OPERATION');
} catch(e) {
  console.error('GOVERNANCE_DENIED: '+String(e.message || e));
  process.exitCode=1;
}
