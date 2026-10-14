#!/usr/bin/env node
/**
 * QA-governed online verification. Never interpret branch prefixes or editable
 * issue text as authentic writing authority. No grants can be issued here.
 * PR-event review checks rely on GitHub REST identities and protected env
 * allowlists; absent configuration or a reviewer approval means DENY.
 */
import {pathToFileURL} from 'node:url';
import process from 'node:process';
export const R='Priysharan19/Final-Pri-learning';
export const REVIEW=new Set(['REVIEW','CI','MERGE_READY','REPAIR_PENDING']);
export const WRITER=new Set(['ACTIVE','IMPLEMENTING','TESTING','REPAIR']);
const SHA=/^[0-9a-f]{40}$/i;
// Frozen legacy REVIEW record. This is not admission, grant or ownership.
// #483 and PR #484 share a mission ID but the preserved GitHub source branch
// was created using a shorter suffix. Exact source head is non-transferable.
const FROZEN_REVIEW_ALIAS_483={
 issue:483,agent:'india-curriculum',risk:'R3',
 mission:'cbse-original-exam-blind-m004-20261014',
 branch:'agent/mission/india-curriculum/cbse-exam-blind-m004-20261014',
 head:'74200a45ba1162095fb18bcf982637759abff51b'
};
const marker=(body,name)=>[...String(body||'').matchAll(new RegExp('^'+name+':[ \t]*(.*)$','gmi'))].map(x=>x[1].trim());
const exact=(body,name)=>{const m=marker(body,name);if(m.length!==1||!m[0])throw Error('MISSING_OR_DUPLICATE_'+name);return m[0];};
const allowedList=x=>new Set(String(x||'').split(',').map(s=>s.trim()).filter(Boolean));
const deny=code=>{throw Error('DENY:'+code);};
export function checkReviewPins(issues,prs){
 if(!Array.isArray(issues)||!Array.isArray(prs))deny('INCOMPLETE_GITHUB_SNAPSHOT');
 const open=issues.filter(x=>!x.pull_request && String(x.title||'').startsWith('[PRI-MISSION]') && x.state==='open');
 if(new Set(issues.map(i=>i.number)).size!==issues.length)deny('DUPLICATE_ISSUE_NUMBER');
 if(new Set(prs.map(p=>p.number)).size!==prs.length)deny('DUPLICATE_PR_NUMBER');
 let verified=0;
 for(const i of open){
  const state=exact(i.body,'Pri-Mission-Status');
  if(!REVIEW.has(state))continue;
  const branch=exact(i.body,'Pri-Branch');
  const pin=exact(i.body,'Pri-Review-Head');
  if(!SHA.test(pin))deny('MISSING_EXACT_REVIEW_PIN_ISSUE_'+i.number);
  const matches=prs.filter(p=>p.state==='open' && p.head?.ref===branch &&
    p.head?.repo?.full_name===R && p.base?.repo?.full_name===R && p.base?.ref==='main');
  if(matches.length!==1)deny('AMBIGUOUS_OR_MISSING_OPEN_PR_ISSUE_'+i.number);
  if(matches[0].head.sha!==pin)deny('FROZEN_REVIEW_HEAD_MISMATCH_ISSUE_'+i.number);
  const agent=exact(i.body,'Pri-Agent'),id=exact(i.body,'Pri-Mission-ID');
  if(branch!==('agent/mission/'+agent+'/'+id)) {
   const a=FROZEN_REVIEW_ALIAS_483;
   if(!(i.number===a.issue && state==='REVIEW' && agent===a.agent &&
     exact(i.body,'Pri-Risk')===a.risk && id===a.mission &&
     branch===a.branch && pin===a.head && matches[0].number===484))
    deny('REVIEW_MISSION_BRANCH_ID_MISMATCH_ISSUE_'+i.number);
  }
  verified++;
 }
 return {verified,openManaged:open.length,verdict:'REVIEW_PINS_GITHUB_REFERENTIALLY_VERIFIED'};
}
export function checkManualPr(pr,reviews,perms,{head,authors,reviewers}={}){
 if(!pr||!Array.isArray(reviews)||!perms||typeof perms!=='object')deny('INCOMPLETE_PR_REVIEW_PROOF');
 if(pr.state!=='open'||pr.head?.repo?.full_name!==R||pr.base?.repo?.full_name!==R)deny('NOT_CANONICAL_OPEN_PR');
 if(!/^(task|feature)\/[a-z0-9][a-z0-9._/-]*$/.test(pr.head.ref||''))deny('NOT_MANUAL_PR_BRANCH');
 if(!SHA.test(head||'')||pr.head.sha!==head)deny('MANUAL_HEAD_SHA_CHANGED');
 const a=allowedList(authors),v=allowedList(reviewers);
 if(!a.size||!v.size)deny('PROTECTED_MANUAL_ALLOWLISTS_MISSING');
 const submitter=pr.user?.login;
 if(pr.user?.type==='Bot'||!a.has(submitter))deny('PR_AUTHOR_NOT_ALLOWED');
 const recent=new Map();
 for(const rev of reviews){
  if(!rev.user?.login||!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(rev.state))continue;
  const prev=recent.get(rev.user.login);
  if(!prev || Date.parse(rev.submitted_at||0)>=Date.parse(prev.submitted_at||0))recent.set(rev.user.login,rev);
 }
 const approvals=[...recent.values()].filter(r=>r.state==='APPROVED'&&r.commit_id===head&&r.user?.type==='User'&&r.user.login!==submitter&&v.has(r.user.login)&&['write','maintain','admin'].includes(perms[r.user.login]));
 if(!approvals.length)deny('INDEPENDENT_AUTHORIZED_CURRENT_HEAD_APPROVAL_MISSING');
 return {authorized:true,head,pr:pr.number,approvingReviewers:approvals.map(r=>r.user.login)};
}
export async function github(path,fetcher=fetch){
 const token=process.env.GITHUB_TOKEN;
 if(!token)deny('GITHUB_READ_ONLY_CREDENTIAL_MISSING');
 const res=await fetcher('https://api.github.com/repos/'+R+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}});
 if(!res.ok)deny('GITHUB_API_'+res.status+':'+path);
 return await res.json();
}
async function allPages(path){
 const out=[];
 for(let page=1;page<=100;page++){
  const a=await github(path+(path.includes('?')?'&':'?')+'per_page=100&page='+page);
  if(!Array.isArray(a))deny('MALFORMED_GITHUB_PAGE');
  out.push(...a);
  if(a.length<100)return out;
 }
 deny('INCOMPLETE_GITHUB_PAGINATION');
}
export async function run(command,arg,sha){
 if(command==='review-pins-bootstrap'){
  // Owner-directed P0 control-plane recovery ONLY, NOT writer admission.
  if(Number(arg)!==492||!SHA.test(sha||''))deny('BOOTSTRAP_SCOPE_DENY');
  const pr=await github('/pulls/492'),tracker=await github('/issues/489');
  if(tracker.state!=='open'||!String(tracker.title||'').includes('[QA Release]')||
     pr.state!=='open'||pr.head?.ref!=='task/p0-governance-recovery-20261014'||
     pr.head?.sha!==sha||pr.base?.ref!=='main')deny('BOOTSTRAP_PR_OR_QA_TRACKER_MISMATCH');
  const reviews=await allPages('/pulls/492/reviews'),permissions={};
  for(const login of allowedList(process.env.PRI_QA_MANUAL_REVIEWERS)){
   permissions[login]=(await github('/collaborators/'+encodeURIComponent(login)+'/permission')).permission;
  }
  // A current-head separate authorized human approval is compulsory.
  const approval=checkManualPr(pr,reviews,permissions,{head:sha,authors:process.env.PRI_QA_MANUAL_AUTHORS,reviewers:process.env.PRI_QA_MANUAL_REVIEWERS});
  const issues=await allPages('/issues?state=all'),prs=await allPages('/pulls?state=open');
  try{return {...checkReviewPins(issues,prs),qaBootstrapIssue:489,approvedBy:approval.approvingReviewers};}
  catch(e){return {qaBootstrapIssue:489,pr:492,head:sha,approvedBy:approval.approvingReviewers,
   pinMigrationRequired:true,diagnostic:String(e),writerAdmissionAllowed:false,
   warning:'Recovery review only; every writer grant remains denied pending independently verified ledger migration.'};}
 }
 if(command==='review-pins'){
  const issues=await allPages('/issues?state=all');
  const prs=await allPages('/pulls?state=open');
  return checkReviewPins(issues,prs);
 }
 if(command==='manual-pr'){
  if(!Number.isInteger(Number(arg))||Number(arg)<1)deny('INVALID_PR_NUMBER');
  const pr=await github('/pulls/'+Number(arg));
  const reviews=await allPages('/pulls/'+Number(arg)+'/reviews');
  const permissions={};
  for(const login of allowedList(process.env.PRI_QA_MANUAL_REVIEWERS)){
   const p=await github('/collaborators/'+encodeURIComponent(login)+'/permission');
   permissions[login]=p.permission;
  }
  return checkManualPr(pr,reviews,permissions,{head:sha,authors:process.env.PRI_QA_MANUAL_AUTHORS,reviewers:process.env.PRI_QA_MANUAL_REVIEWERS});
 }
 deny('UNKNOWN_GATE_COMMAND');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 run(process.argv[2],process.argv[3],process.argv[4]).then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(String(e));process.exitCode=1;});
}
