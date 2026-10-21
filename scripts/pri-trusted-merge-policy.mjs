// Pure policy invoked ONLY from an independently controlled trusted runner.
// This module produces a verdict, never a GitHub check or merge mutation.
// Code from the candidate PR MUST NOT execute as the merge authority.
import {verifyReleasedSource} from './pri-admission-state.mjs';
import {validatedDiffPaths,verifyDiffOwnership} from './pri-admission-paths.mjs';

const REPO='Priysharan19/Final-Pri-learning';
const SHA=/^[a-f0-9]{40}$/i;
const eligible=new Set(['write','maintain','admin']);
const sensitive=p => p.startsWith('.pri-os/') || p.startsWith('.github/workflows/') ||
  p==='AGENTS.md' || /^scripts\/pri-/.test(p) ||
  /(^|\/)(auth|session|security|permissions)(\/|\.|-|$)/i.test(p);
function requireRule(value,reason){if(!value)throw Error('MERGE_DENIED_'+reason);}
export function verifyIndependentReviews({pr,head,reviews,permissions,changedPaths,
    securityReviewers=['Kalp-Bajpai'],lastPushActor,securityRequired=false}) {
  requireRule(pr && Array.isArray(reviews) && permissions && Array.isArray(changedPaths),'REVIEW_EVIDENCE_MISSING');
  requireRule(SHA.test(head) && pr.head?.sha===head && pr.user?.type==='User','REVIEW_HEAD_OR_AUTHOR_INVALID');
  requireRule(typeof lastPushActor==='string' && !!lastPushActor,'LATEST_PUSH_ACTOR_UNVERIFIED');
  const last=new Map();
  for(const r of reviews) {
    requireRule(r?.user?.login && r.user?.type,'REVIEWER_RECORD_MALFORMED');
    if(!['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state)) continue;
    const previous=last.get(r.user.login);
    if(!previous || Date.parse(r.submitted_at||0)>Date.parse(previous.submitted_at||0)) last.set(r.user.login,r);
  }
  const approvers=[...last.values()].filter(r=>r.state==='APPROVED' && r.commit_id===head &&
    r.user.type==='User' && r.user.login!==pr.user.login &&
    r.user.login!==lastPushActor && eligible.has(permissions[r.user.login]));
  requireRule(approvers.length>=1,'NO_ELIGIBLE_EXACT_HEAD_INDEPENDENT_APPROVAL');
  if(securityRequired || changedPaths.some(sensitive))
    requireRule(approvers.some(r=>securityReviewers.includes(r.user.login)), 'SECURITY_OWNER_APPROVAL_MISSING');
  return {approvers:approvers.map(r=>r.user.login),head};
}
export function verifyMergePolicy({pr,head,mainSha,files,missionIssue,authority,
    reviews,permissions,branchProtection,checks,routeOwner,lastPushActor,manualScopePolicy=null,nowMs=Date.now()}) {
  requireRule(pr?.state==='open' && pr.head?.repo?.full_name===REPO &&
    pr.base?.repo?.full_name===REPO && pr.base?.ref==='main' &&
    pr.head?.sha===head && SHA.test(head) && SHA.test(mainSha) &&
    pr.base?.sha===mainSha,'PR_IDENTITY_OR_BASE_MOVED');
  requireRule(!pr.draft,'DRAFT_PR_UNMERGEABLE');
  requireRule(branchProtection?.enforce_admins===true &&
    branchProtection?.strict===true &&
    branchProtection?.required_approving_review_count>=1 &&
    branchProtection?.dismiss_stale_reviews===true &&
    branchProtection?.require_last_push_approval===true,
    'PROTECTED_BRANCH_POLICY_WEAKENED');
  requireRule(Array.isArray(files) && files.length===pr.changed_files && files.length>0,'INCOMPLETE_PR_FILES');
  const changedPaths=validatedDiffPaths(files);
  requireRule(typeof routeOwner==='function','CANONICAL_OWNER_ROUTER_UNAVAILABLE');
  const owners=new Set(), riskSensitive=[];
  for(const path of changedPaths) {
    const routed=routeOwner(path);
    requireRule(routed?.owned===true && routed.primary,'UNOWNED_CHANGED_FILE');
    owners.add(routed.primary);
    if (['R3','R4'].includes(routed.risk)) riskSensitive.push(path);
  }
  const autonomous=pr.head.ref.startsWith('agent/mission/');
  let source;
  if(autonomous) {
    requireRule(missionIssue && authority,'SIGNED_PROVENANCE_REQUIRED');
    source=verifyReleasedSource({authority,issue:missionIssue,pr,head,mainSha});
    verifyDiffOwnership(files,source.paths,source.agent,routeOwner);
    requireRule(owners.size===1 && owners.has(source.agent),'MISSION_OWNER_MISMATCH');
  } else {
    requireRule(/^(task|feature)\/[a-z0-9][a-z0-9._/-]*$/i.test(pr.head.ref),
      'MANUAL_BRANCH_NOT_REVIEWABLE');
    requireRule(pr.user?.type==='User' && eligible.has(permissions?.[pr.user.login]),
      'MANUAL_AUTHOR_LACKS_WRITE_PERMISSION');
    // Cross-domain manual changes require a separately reviewed record from
    // protected main, not a candidate-declared comment or PR body marker.
    if(owners.size>1) {
      requireRule(manualScopePolicy?.version===1 && manualScopePolicy.repository===REPO &&
        Array.isArray(manualScopePolicy.authorizations), 'PROTECTED_MANUAL_SCOPE_POLICY_UNAVAILABLE');
      const expectedOwners=[...owners].sort();
      const expectedPaths=[...new Set(changedPaths)].sort();
      const matching=manualScopePolicy.authorizations.filter(entry =>
        entry.repository===REPO && entry.pr_number===pr.number &&
        entry.head_sha===head && entry.main_sha===mainSha &&
        entry.author===pr.user.login &&
        Number.isSafeInteger(entry.expires_ms) && entry.expires_ms>nowMs &&
        entry.expires_ms-nowMs<=24*3600*1000 &&
        Array.isArray(entry.primary_owners) && Array.isArray(entry.changed_paths) &&
        JSON.stringify([...new Set(entry.primary_owners)].sort())===JSON.stringify(expectedOwners) &&
        JSON.stringify([...new Set(entry.changed_paths)].sort())===JSON.stringify(expectedPaths));
      requireRule(matching.length===1,'MIXED_OWNER_MANUAL_SCOPE_NOT_AUTHORIZED');
    }
    source={manual:true,source_head:head,canonical_owners:[...owners].sort(),
      scope_authorized_by:owners.size>1?'protected-main-manual-owner-policy':'single-canonical-owner'};
  }
  const independent=verifyIndependentReviews({pr,head,reviews,permissions,
    changedPaths,lastPushActor,securityRequired:riskSensitive.length>0});
  requireRule(Array.isArray(checks) && checks.length>0,'MISSING_HOSTED_CI');
  const required=branchProtection.required_checks;
  requireRule(Array.isArray(required) && required.length>0,'REQUIRED_CHECKS_UNDEFINED');
  for(const check of required) {
    requireRule(Number.isInteger(check.app_id) && check.app_id>0,'REQUIRED_CHECK_APP_UNPINNED');
    const matching=checks.filter(c=>c.name===check.context && c.sha===head &&
      c.app_id===check.app_id).sort((a,b)=>(b.id||0)-(a.id||0));
    requireRule(matching.length>0 && matching[0].conclusion==='success',
      'REQUIRED_CURRENT_HEAD_CHECK_MISSING_'+check.context);
  }
  return {decision:'SOURCE_REVIEW_POLICY_VERIFIED',pr_number:pr.number,head,main_sha:mainSha,
    source,reviewers:independent.approvers,checked_paths:changedPaths.length,
    verified_at:new Date().toISOString(),
    warning:'Policy verdict is not merge authorization until an independently controlled required App check enforces it.'};
}
