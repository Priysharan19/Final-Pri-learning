#!/usr/bin/env node
// A branch name is NOT evidence of human authorization. All governed
// task/* and feature/* source changes must have exact-head independent
// approval by a real repository writer before their manual lane can pass.
import {validatedDiffPaths} from './pri-admission-paths.mjs';
const permitted = new Set(['write','maintain','admin']);
const sensitive = path =>
  path === 'AGENTS.md' || path.startsWith('.pri-os/') ||
  path.startsWith('.github/workflows/') || /^scripts\/pri-/.test(path) ||
  /(^|\/)(auth|session|permissions|security)(\/|\.|-|$)/i.test(path);

export function manualDecision({pr,headSha,reviews,permissions,files,securityReviewers=['Kalp-Bajpai']}) {
  const deny=(reason)=>({authorized:false,reason});
  if (!pr || pr.state!=='open' || !/^[a-f0-9]{40}$/i.test(String(headSha||'')) ||
      pr.head?.sha!==headSha || pr.base?.ref!=='main' ||
      pr.head?.repo?.full_name!==pr.base?.repo?.full_name)
    return deny('EXACT_PR_IDENTITY_REQUIRED');
  if (!/^((task|feature)\/)[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(pr.head.ref))
    return deny('MANUAL_BRANCH_FORMAT_INVALID');
  const owner=pr.user?.login;
  if (!owner || pr.user?.type==='Bot' || !permitted.has(permissions?.[owner]))
    return deny('PR_CREATOR_NOT_AUTHORIZED_WRITER');
  if (!Array.isArray(files) || !files.length || !Number.isInteger(pr.changed_files) ||
      pr.changed_files!==files.length) return deny('EMPTY_OR_INCOMPLETE_SOURCE_SCOPE');
  if (!Array.isArray(reviews)) return deny('REVIEW_INVENTORY_MISSING');
  const lastByReviewer=new Map();
  for(const r of reviews) {
    if (!r?.user?.login) return deny('REVIEWER_IDENTITY_MISSING');
    if(!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state)) continue;
    const prev=lastByReviewer.get(r.user.login);
    if(!prev || String(r.submitted_at||'')>=String(prev.submitted_at||'')) lastByReviewer.set(r.user.login,r);
  }
  const humanApproved=[...lastByReviewer.values()].filter(r=>
    r.state==='APPROVED' && r.commit_id===headSha && r.user.login!==owner &&
    r.user.type==='User' && permitted.has(permissions?.[r.user.login]));
  if(!humanApproved.length) return deny('INDEPENDENT_EXACT_HEAD_WRITER_APPROVAL_REQUIRED');
  let canonicalFiles;
  try {canonicalFiles=validatedDiffPaths(files);}
  catch { return deny('MALFORMED_CHANGED_FILES'); }
  const sensitiveFiles=canonicalFiles.filter(sensitive);
  if(sensitiveFiles.length && !humanApproved.some(r=>securityReviewers.includes(r.user.login)))
    return deny('SECURITY_OWNER_EXACT_HEAD_APPROVAL_REQUIRED');
  return {authorized:true,reason:'EXACT_HEAD_INDEPENDENT_MANUAL_REVIEW',
    source_head:headSha,reviewers:humanApproved.map(r=>r.user.login),
    security_sensitive_paths:sensitiveFiles};
}

async function live() {
  const token=process.env.GITHUB_TOKEN;
  const repo=process.env.GITHUB_REPOSITORY;
  const number=Number(process.env.PR_NUMBER);
  const head=process.env.EXPECTED_HEAD_SHA;
  if(!token || repo!=='Priysharan19/Final-Pri-learning' ||
    !Number.isInteger(number)||number<1) throw Error('TRUSTED_GITHUB_CONTEXT_MISSING');
  async function get(url) {
    const response=await fetch('https://api.github.com/repos/'+repo+'/'+url,{
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}
    });
    if(!response.ok) throw Error('GITHUB_REVIEW_QUERY_DENIED_'+response.status);
    return response.json();
  }
  async function pages(url) {
    const result=[];
    for(let n=1;n<=100;n++) {
      const data=await get(url+(url.includes('?')?'&':'?')+'per_page=100&page='+n);
      if(!Array.isArray(data)) throw Error('GITHUB_PAGINATION_INVALID');
      result.push(...data);
      if(data.length<100) return result;
    }
    throw Error('GITHUB_PAGINATION_EXCEEDED');
  }
  const pr=await get('pulls/'+number);
  const [reviews,files]=await Promise.all([pages('pulls/'+number+'/reviews'),pages('pulls/'+number+'/files')]);
  const logins=new Set([pr.user.login,...reviews.map(r=>r.user?.login).filter(Boolean)]);
  const permissions={};
  for(const login of logins) {
    try {permissions[login]=(await get('collaborators/'+encodeURIComponent(login)+'/permission')).permission;}
    catch {permissions[login]='none';}
  }
  const verdict=manualDecision({pr,headSha:head,reviews,permissions,files});
  console.log(JSON.stringify(verdict));
  if(!verdict.authorized) process.exitCode=1;
}
if(process.argv[1] && import.meta.url.endsWith('/'+process.argv[1].split('/').at(-1)))
  live().catch(err=>{console.error('DENY_MANUAL_AUTH:'+String(err.message||err));process.exitCode=1;});
