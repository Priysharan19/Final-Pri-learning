/**
 * QA-only protected Git ref compare-and-swap, adapted from M007 existing
 * governor GitHubCAS candidate. This module never grants a lease itself.
 * Calling it from pull_request or pull_request_target MUST fail closed.
 */
const R='Priysharan19/Final-Pri-learning';
const BRANCH='pri-governor-state';
const sha=/^[a-f0-9]{40}$/i;
const fail=x=>{throw Error('GOVERNOR_REF_DENIED:'+x);};
export class ProtectedGovernorRef {
 constructor({token,fetcher=fetch,repo=R,branch=BRANCH}={}){
  if(repo!==R||branch!==BRANCH)fail('REF_OUTSIDE_PINNED_REPOSITORY');
  if(!token||token.length<16)fail('RESTRICTED_GITHUB_APP_TOKEN_REQUIRED');
  if(['pull_request','pull_request_target'].includes(process.env.GITHUB_EVENT_NAME))fail('UNTRUSTED_PR_JOB_CONTEXT');
  this.token=token;this.fetcher=fetcher;
 }
 async api(method,path,body){
  const res=await this.fetcher('https://api.github.com/repos/'+R+path,{
   method,headers:{Authorization:'Bearer '+this.token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok)fail('GITHUB_API_'+method+'_'+res.status+':'+path);
  return await res.json();
 }
 async ensureProtected(){
  const branch=await this.api('GET','/branches/'+BRANCH);
  if(!branch.protected||!sha.test(branch.commit?.sha||''))fail('GOVERNOR_REF_NOT_PROTECTED');
  const protection=await this.api('GET','/branches/'+BRANCH+'/protection');
  if(!protection.enabled && !protection.required_status_checks && !protection.enforce_admins)fail('NO_GOVERNOR_BRANCH_PROTECTION');
  if(protection.enforce_admins?.enabled!==true)fail('GOVERNOR_PROTECTION_ADMIN_BYPASS');
  // Enforced allowlisted app restrictions must be reviewed independently.
  if(!Array.isArray(protection.restrictions?.apps)||protection.restrictions.apps.length!==1)fail('GOVERNOR_PUSH_RESTRICTIONS_MISSING');
  if(protection.restrictions.apps[0].slug!==process.env.PRI_QA_TRUSTED_APP_SLUG)fail('GOVERNOR_APP_NOT_PINNED');
  return {protected:true,sha:branch.commit.sha,approvedApp:protection.restrictions.apps[0].slug};
 }
 async currentHead(){
  const p=await this.api('GET','/git/ref/heads/'+BRANCH);
  if(!sha.test(p.object?.sha||''))fail('BAD_GOVERNOR_HEAD');
  return p.object.sha;
 }
 async readEnvelope(){
  const head=await this.currentHead();
  const obj=await this.api('GET','/contents/governor-state.json?ref='+head);
  if(obj.encoding!=='base64'||!obj.content)fail('NO_SIGNED_STATE');
  let envelope;try{envelope=JSON.parse(Buffer.from(obj.content.replace(/\s/g,''),'base64').toString('utf8'));}catch{fail('INVALID_STATE_JSON');}
  if(!envelope?.signature||!envelope?.keyId)fail('STATE_UNSIGNED');
  return {head,envelope};
 }
 async fastForwardCAS({expectedHead,signedEnvelope,eventId}={}){
  if(!sha.test(expectedHead||'')||!signedEnvelope?.signature||!/^QA-[A-Za-z0-9_.:-]+$/.test(eventId||''))fail('INVALID_SIGNED_CAS_TRANSACTION');
  await this.ensureProtected();
  if(await this.currentHead()!==expectedHead)fail('STALE_EXPECTED_REF');
  const parent=await this.api('GET','/git/commits/'+expectedHead);
  if(!sha.test(parent.tree?.sha||''))fail('INVALID_PARENT_TREE');
  const blob=await this.api('POST','/git/blobs',{content:JSON.stringify(signedEnvelope)+'\n',encoding:'utf-8'});
  const tree=await this.api('POST','/git/trees',{base_tree:parent.tree.sha,tree:[{path:'governor-state.json',mode:'100644',type:'blob',sha:blob.sha}]});
  const commit=await this.api('POST','/git/commits',{message:'qa-governor: '+eventId,tree:tree.sha,parents:[expectedHead]});
  if(!sha.test(commit.sha||''))fail('INVALID_NEW_COMMIT');
  try{await this.api('PATCH','/git/refs/heads/'+BRANCH,{sha:commit.sha,force:false});}catch{fail('GITHUB_CAS_LOST_OR_PROTECTION_DENIED');}
  if(await this.currentHead()!==commit.sha)fail('REF_ADVANCED_DURING_POST_COMMIT_CHECK');
  return {ref:commit.sha,pendingExternalIssueTransition:true};
 }
 async managedIssues(){
  const out=[];
  for(let i=1;i<=100;i++){
   const page=await this.api('GET','/issues?state=all&per_page=100&page='+i);
   if(!Array.isArray(page))fail('INCOMPLETE_GITHUB_ISSUE_PAGE');
   out.push(...page);
   if(page.length<100){
    if(new Set(out.map(x=>x.number)).size!==out.length)fail('DUPLICATE_MANAGED_ISSUES');
    return out;
   }
  }
  fail('ISSUE_PAGINATION_TRUNCATION');
 }
}
