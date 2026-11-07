import assert from 'node:assert/strict';
import {createGitHubMergeTransport} from './pri-github-app-transport.mjs';
const repo='Priysharan19/Final-Pri-learning',sha='a'.repeat(40),base='b'.repeat(40);
let called=[];
const fetcher=async(url,opts={})=>{
  const route=url.split('/Final-Pri-learning/')[1];
  called.push({route,method:opts.method||'GET'});
  if(route==='branches/main')return {ok:true,json:async()=>({commit:{sha:base}})};
  if(route==='pulls/626')return {ok:true,json:async()=>({number:626,state:'open',draft:false,merged:false,head:{sha},base:{ref:'main',repo:{full_name:repo}}})};
  throw Error('UNKNOWN_MOCK_API');
};
const credential={role:'merger',appId:2026,token:'fake-inert-installation-token-for-unit-tests'};
let count=0;
const t=createGitHubMergeTransport({credential,fetcher});
const pr=await t.read(626);assert.equal(pr.head,sha);assert.equal(pr.main,base);count++;
await assert.rejects(()=>t.merge({pr_number:626,expected_head:sha,expected_main:base,method:'merge',trustedAppId:2026}),/PHYSICAL_EXCLUSIVE_MERGER_NOT_CERTIFIED/);count++;
assert.equal(called.filter(x=>x.method==='PUT').length,0);count++;
await assert.rejects(()=>t.read(0),/PR_NUMBER_INVALID/);count++;
assert.throws(()=>createGitHubMergeTransport({credential:{...credential,role:'verifier'},fetcher}),/MERGER_APP_CREDENTIAL_REQUIRED/);count++;
console.log(`PASS: ${count} GitHub REST adapter read-only and disabled-write contract cases`);
// Fake API responses prove App ID, installation scope, requested permissions,
// and the minted token's exact repository scope; no network or live keys used.
import {generateKeyPairSync} from 'node:crypto';
import {issueRoleInstallationToken} from './pri-github-app-transport.mjs';
const temporaryKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'pem',type:'pkcs8'});
const signerPermissions={contents:'write',issues:'write',pull_requests:'read',administration:'read',actions:'read'};
let claimRepo=repo,claimApp=9011,claimInstallation=9012,claimActions='read';
const signedJwtFetch=async(url,opts={})=>{
  if(url.endsWith('/app'))return {ok:true,json:async()=>({id:claimApp})};
  if(url.endsWith('/installation'))return {ok:true,json:async()=>({id:claimInstallation,app_id:9011,account:{login:'Priysharan19'},repository_selection:'selected'})};
  if(url.endsWith('/access_tokens')){
    const request=JSON.parse(opts.body);
    assert.deepEqual(request.repositories,['Final-Pri-learning']);
    assert.deepEqual(request.permissions,signerPermissions);
    return {ok:true,json:async()=>({token:'fake-token-value-for-tests',expires_at:'2090-01-01T00:00:00Z',
      repositories:[{full_name:claimRepo}],permissions:{...signerPermissions,actions:claimActions}})};
  }
  throw Error('MOCK_UNEXPECTED_API');
};
const mint=()=>issueRoleInstallationToken({role:'signer',appId:9011,
  installationId:9012,privateKey:temporaryKey,fetcher:signedJwtFetch});
const issued=await mint();assert.equal(issued.role,'signer');count++;
claimApp=9999;await assert.rejects(mint,/JWT_IS_WRONG_GITHUB_APP/);count++;claimApp=9011;
claimInstallation=9999;await assert.rejects(mint,/NOT_EXACT_ONE_REPO_APP_INSTALLATION/);count++;claimInstallation=9012;
claimRepo='attacker/other';await assert.rejects(mint,/APP_TOKEN_REPOSITORY_SCOPE_MISMATCH/);count++;claimRepo=repo;
claimActions='none';await assert.rejects(mint,/APP_PERMISSION_SCOPE_MISMATCH_actions/);count++;claimActions='read';
console.log(`PASS: ${count} isolated App token scope and inert HTTP transport tests (no real GitHub credentials)`);
