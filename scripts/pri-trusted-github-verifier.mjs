#!/usr/bin/env node
// Read-only adapter for a future independently controlled GitHub App runner.
// MUST execute protected-main source under trusted identity and independent
// webhook-derived last-pusher evidence. Never emit a required check from
// candidate-controlled GitHub Actions code.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inspectSignedLog,verifyAuthorityHistory,assertLedgerMatchesGrants,issueIdentity} from './pri-admission-state.mjs';
import {verifyMergePolicy} from './pri-trusted-merge-policy.mjs';
const REPO='Priysharan19/Final-Pri-learning';
const API='https://api.github.com/repos/Priysharan19/Final-Pri-learning/';
const SHA=/^[a-f0-9]{40}$/i;
const AUTHORITY_REF='pri-writer-admissions';
const AUTHORITY_FILE='.pri-os/authorized-writer-events.json';
function demand(yes,code){if(!yes)throw Error(code);}
async function main(){
  const {GITHUB_TOKEN,GITHUB_REPOSITORY,GITHUB_REF,GITHUB_SHA,
    PRI_AUTHORITY_GENESIS_SHA,PRI_VERIFIER_PR_NUMBER,PRI_VERIFIER_EXPECTED_HEAD,
    PRI_VERIFIER_LAST_PUSH_ACTOR}=process.env;
  demand(GITHUB_TOKEN && GITHUB_REPOSITORY===REPO && GITHUB_REF==='refs/heads/main' &&
    SHA.test(GITHUB_SHA||'') && SHA.test(PRI_VERIFIER_EXPECTED_HEAD||'') &&
    SHA.test(PRI_AUTHORITY_GENESIS_SHA||'') &&
    Number.isSafeInteger(Number(PRI_VERIFIER_PR_NUMBER)) && Number(PRI_VERIFIER_PR_NUMBER)>0 &&
    /^[A-Za-z0-9-]+$/.test(PRI_VERIFIER_LAST_PUSH_ACTOR||''),
    'TRUSTED_VERIFIER_ENVIRONMENT_UNAVAILABLE');
  const localMain=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  demand(localMain===GITHUB_SHA,'UNTRUSTED_CHECKOUT_NOT_PROTECTED_MAIN');
  const requestHeaders={Authorization:'Bearer '+GITHUB_TOKEN,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28'};
  async function get(path){
    demand(typeof path==='string' && /^[\w./?&=%+\-]+$/.test(path) &&
      !path.includes('..') && !path.startsWith('/'), 'GITHUB_API_PATH_UNTRUSTED');
    const r=await fetch(API+path,{headers:requestHeaders});
    demand(r.ok,'TRUSTED_GITHUB_API_READ_FAILED_'+r.status);
    return await r.json();
  }
  async function pages(path){
    const all=[];
    for(let page=1;page<=100;page++) {
      const a=await get(path+(path.includes('?')?'&':'?')+'per_page=100&page='+page);
      demand(Array.isArray(a),'MALFORMED_GITHUB_PAGE');
      all.push(...a);if(a.length<100)return all;
    }
    throw Error('GITHUB_PAGINATION_LIMIT');
  }
  const mainBranch=await get('branches/main');
  demand(mainBranch.commit?.sha===GITHUB_SHA,'MAIN_MOVED_DURING_VERIFICATION');
  const protection=await get('branches/main/protection');
  const expected=protection.required_status_checks?.checks;
  demand(Array.isArray(expected) && expected.length>0,'REQUIRED_PROTECTIONS_MISSING');
  const branchProtection={enforce_admins:protection.enforce_admins?.enabled===true,
    strict:protection.required_status_checks?.strict===true,
    required_approving_review_count:protection.required_pull_request_reviews?.required_approving_review_count,
    dismiss_stale_reviews:protection.required_pull_request_reviews?.dismiss_stale_reviews,
    require_last_push_approval:protection.required_pull_request_reviews?.require_last_push_approval,
    required_checks:expected};
  const number=Number(PRI_VERIFIER_PR_NUMBER),head=PRI_VERIFIER_EXPECTED_HEAD;
  const pr=await get('pulls/'+number);
  demand(pr.head?.sha===head && pr.base?.sha===GITHUB_SHA,'PR_HEAD_OR_BASE_MOVED');
  const files=await pages('pulls/'+number+'/files');
  const reviews=await pages('pulls/'+number+'/reviews');
  const checksResult=await get('commits/'+head+'/check-runs?per_page=100');
  demand(checksResult.total_count <= 100 && Array.isArray(checksResult.check_runs),
    'INCOMPLETE_HOSTED_CHECK_RUNS');
  const checks=checksResult.check_runs.map(c=>({id:c.id,name:c.name,sha:c.head_sha,
    conclusion:c.conclusion,app_id:c.app?.id}));
  const logins=new Set([pr.user?.login,...reviews.filter(x=>x.user?.type==='User').map(x=>x.user?.login)].filter(Boolean));
  const permissions={};
  for(const login of logins) {
    demand(/^[A-Za-z0-9-]+$/.test(login),'INVALID_GITHUB_LOGIN');
    const obj=await get('collaborators/'+encodeURIComponent(login)+'/permission');
    permissions[login]=obj.permission;
  }
  const routeOwner=filename=>{
    const process=execFileSync('node',['scripts/pri-fleet.mjs','route',filename],{
      encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:12000});
    return JSON.parse(process);
  };
  let missionIssue=null,authority=null;
  if(pr.head?.ref?.startsWith('agent/mission/')) {
    const pubkey=readFileSync('.pri-os/admission-public-key.pem','utf8');
    demand(pubkey.includes('PUBLIC KEY'),'TRUSTED_PUBLIC_KEY_MISSING');
    const allIssues=await pages('issues?state=all');
    const headOfAuthority=await get('git/ref/heads/'+AUTHORITY_REF);
    const history=await verifyAuthorityHistory({head:headOfAuthority.object?.sha,
      genesisSha:PRI_AUTHORITY_GENESIS_SHA,filePath:AUTHORITY_FILE,
      loadCommit:sha=>get('commits/'+sha),
      loadLog:async sha=>{
        const f=await get('contents/'+AUTHORITY_FILE+'?ref='+sha);
        demand(f.encoding==='base64','INVALID_AUTHORITY_BLOB');
        return JSON.parse(Buffer.from(f.content.replace(/\s/g,''),'base64').toString('utf8'));
      }});
    authority=inspectSignedLog(history.log,pubkey,Date.now());
    assertLedgerMatchesGrants(allIssues,authority,GITHUB_SHA,Date.now());
    const matching=allIssues.filter(x=>!x.pull_request && x.state==='open' &&
      String(x.title||'').startsWith('[PRI-MISSION]') &&
      issueIdentity(x).branch===pr.head.ref);
    demand(matching.length===1,'AMBIGUOUS_MISSION_ISSUE');
    missionIssue=matching[0];
  }
  const verdict=verifyMergePolicy({pr,head,mainSha:GITHUB_SHA,files,missionIssue,authority,
    reviews,permissions,branchProtection,checks,routeOwner,lastPushActor:PRI_VERIFIER_LAST_PUSH_ACTOR});
  const latestMain=await get('branches/main');
  demand(latestMain.commit?.sha===GITHUB_SHA,'MAIN_MOVED_POST_VERIFICATION');
  console.log(JSON.stringify({decision:verdict.decision,pr_number:number,head_sha:head,
    main_sha:GITHUB_SHA,checked_paths:verdict.checked_paths,
    proof:verdict.source,independent_reviewers:verdict.reviewers,
    message:'READ ONLY. This is not a live required check or merge authorization.'}));
}
main().catch(error=>{
  // No token, key, personally identifying secret, or full API response is logged.
  console.error('TRUSTED_POLICY_DENIED:',String(error?.message||'UNKNOWN_FAILURE').slice(0,250));
  process.exitCode=1;
});
