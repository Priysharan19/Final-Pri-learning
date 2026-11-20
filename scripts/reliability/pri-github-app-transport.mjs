// Real REST transport adapter (inert by default). The trusted runtime must
// supply externally verified role credentials and exclusive App ruleset proof.
// This file can be unit-tested without creating GitHub writes or app tokens.
import {appJWT} from './pri-trusted-check-publisher.mjs';
import {TRUSTED_MERGE_REPO} from './pri-serial-merge-controller.mjs';
const API='https://api.github.com/';
const SHA=/^[0-9a-f]{40}$/i;
const deny=(s)=>{throw Error('PRI_APP_TRANSPORT_DENIED_'+s)};
const assert=(v,s)=>{if(!v)deny(s)};
const appPermissions={
  signer:{contents:'write',issues:'write',pull_requests:'read',administration:'read',actions:'read'},
  verifier:{contents:'read',issues:'read',pull_requests:'read',checks:'write',administration:'read'},
  merger:{contents:'write',pull_requests:'write',checks:'read',issues:'read',administration:'read'}
};
const roles=new Set(Object.keys(appPermissions));
const repoName='Final-Pri-learning';

// Authenticate as the *expected* separate GitHub App, verify its exact
// repository installation, and mint a one-repo, exact-permission short token.
export async function issueRoleInstallationToken({role,appId,installationId,
  privateKey,fetcher=fetch}){
  assert(roles.has(role),'UNKNOWN_ROLE');
  assert(Number.isSafeInteger(appId)&&appId>0 && Number.isSafeInteger(installationId)&&installationId>0,
    'APP_OR_INSTALLATION_ID_INVALID');
  assert(typeof privateKey==='string' && privateKey.includes('PRIVATE KEY'),
    'APP_RSA_PRIVATE_KEY_MISSING');
  assert(typeof fetcher==='function','GITHUB_TRANSPORT_UNAVAILABLE');
  const jwt=appJWT(appId,privateKey);
  async function getJwt(path){
    const response=await fetcher(API+path,{headers:{authorization:'Bearer '+jwt,
      accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'}});
    assert(response.ok,'GITHUB_JWT_IDENTITY_HTTP_'+response.status);
    return await response.json();
  }
  const app=await getJwt('app');
  assert(app.id===appId,'JWT_IS_WRONG_GITHUB_APP');
  const installed=await getJwt('repos/'+TRUSTED_MERGE_REPO+'/installation');
  assert(installed.id===installationId && installed.app_id===appId &&
    installed.account?.login==='Priysharan19' &&
    installed.repository_selection==='selected','NOT_EXACT_ONE_REPO_APP_INSTALLATION');
  const permissions=appPermissions[role];
  const response=await fetcher(API+'app/installations/'+installationId+'/access_tokens',{
    method:'POST',headers:{authorization:'Bearer '+jwt,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','content-type':'application/json'},
    body:JSON.stringify({repositories:[repoName],permissions})
  });
  assert(response.ok,'GITHUB_INSTALLATION_TOKEN_HTTP_'+response.status);
  const minted=await response.json();
  assert(typeof minted.token==='string'&&minted.token.length>12,'NO_INSTALLATION_TOKEN');
  for(const [permission,level] of Object.entries(permissions))
    assert(minted.permissions?.[permission]===level,'APP_PERMISSION_SCOPE_MISMATCH_'+permission);
  assert(Array.isArray(minted.repositories) && minted.repositories.length===1 &&
    minted.repositories[0].full_name===TRUSTED_MERGE_REPO,'APP_TOKEN_REPOSITORY_SCOPE_MISMATCH');
  return {token:minted.token,role,appId,installationId,expiresAt:minted.expires_at};
}

// Intent receipt, independent policy, signed ledger, review verification and
// rulesets are checked by createSerialMergeController BEFORE this adapter.
// This transport cannot stand in for those independent controls.
export function createGitHubMergeTransport({credential,fetcher=fetch,
  physicallyCertified=false}){
  assert(credential?.role==='merger' && Number.isSafeInteger(credential?.appId),
    'MERGER_APP_CREDENTIAL_REQUIRED');
  assert(typeof credential?.token==='string' && credential.token.length>12,
    'INSTALLATION_TOKEN_REQUIRED');
  async function call(method,path,body){
    assert(/^repos\/Priysharan19\/Final-Pri-learning\/[A-Za-z0-9_/.?=&-]+$/.test(path) &&
      !path.includes('..'),'UNTRUSTED_GITHUB_PATH');
    const response=await fetcher(API+path,{method,headers:{authorization:'Bearer '+credential.token,
      accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',
      ...(body?{'content-type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined,redirect:'error'});
    assert(response.ok,'GITHUB_REST_HTTP_'+response.status);
    return await response.json();
  }
  const path=(suffix)=>'repos/'+TRUSTED_MERGE_REPO+'/'+suffix;
  async function read(prNumber){
    assert(Number.isSafeInteger(prNumber)&&prNumber>0,'PR_NUMBER_INVALID');
    const [branch,pr]=await Promise.all([
      call('GET',path('branches/main')),
      call('GET',path('pulls/'+prNumber))
    ]);
    assert(SHA.test(branch.commit?.sha||'') && SHA.test(pr.head?.sha||''),
      'SOURCE_SHA_MISSING');
    return {repo:pr.base?.repo?.full_name,pr_number:pr.number,
      head:pr.head.sha,main:branch.commit.sha,base_ref:pr.base?.ref,
      open:pr.state==='open',draft:pr.draft===true};
  }
  async function readMerged(prNumber){
    assert(Number.isSafeInteger(prNumber)&&prNumber>0,'PR_NUMBER_INVALID');
    const pr=await call('GET',path('pulls/'+prNumber));
    if(pr.merged!==true)return {merged:false};
    const commit=await call('GET',path('commits/'+pr.merge_commit_sha));
    assert(pr.state==='closed' && SHA.test(pr.head?.sha||'') &&
      SHA.test(pr.merge_commit_sha||'') &&
      commit.sha===pr.merge_commit_sha && commit.parents?.length===2 &&
      SHA.test(commit.parents[0].sha||''), 'MERGED_COMMIT_NOT_PROVEN_NORMAL_TWO_PARENT');
    return {merged:true,head_sha:pr.head.sha,merge_commit_sha:commit.sha,
      base_before:commit.parents[0].sha};
  }
  async function merge({pr_number,expected_head,expected_main,method,trustedAppId}){
    assert(physicallyCertified===true && trustedAppId===credential.appId,
      'PHYSICAL_EXCLUSIVE_MERGER_NOT_CERTIFIED');
    assert(method==='merge' && SHA.test(expected_head||'') && SHA.test(expected_main||''),
      'EXACT_NORMAL_MERGE_REQUIRED');
    const actual=await read(pr_number);
    assert(actual.repo===TRUSTED_MERGE_REPO && actual.base_ref==='main' && actual.open &&
      actual.head===expected_head && actual.main===expected_main,
      'MERGE_HEAD_OR_MAIN_CHANGED');
    // GitHub rejects a stale head with `sha`. A base SHA cannot be sent to
    // this API; App-only branch updates and shared durable lock must enforce it.
    const response=await call('PUT',path('pulls/'+pr_number+'/merge'),{
      sha:expected_head,merge_method:'merge'});
    assert(response.merged===true && SHA.test(response.sha||''),'MERGE_API_AMBIGUOUS');
    return {merged:true,merge_commit_sha:response.sha};
  }
  return {read,readMerged,merge};
}
