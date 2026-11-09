#!/usr/bin/env node
// Dedicated GitHub App controller. This MUST run trusted protected-main source,
// not pull-request checkout code or a candidate-controlled workflow.
// Without exact independent webhook proof and installed App restrictions, fails closed.
import {createHmac,createSign,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const REPO='Priysharan19/Final-Pri-learning';
const API='https://api.github.com/';
const CONTEXT='Pri Trusted Governor / Source Authorization';
const HEX40=/^[a-f0-9]{40}$/i;
const ensure=(c,code)=>{if(!c)throw Error(code);};
const b64=x=>Buffer.from(x).toString('base64url');
export function appJWT(appId,privateKey,when=Math.floor(Date.now()/1000)){
  ensure(Number.isSafeInteger(Number(appId)) && Number(appId)>0,'APP_ID_REQUIRED');
  const h=b64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const p=b64(JSON.stringify({iat:when-30,exp:when+480,iss:String(appId)}));
  const payload=h+'.'+p;
  const signer=createSign('RSA-SHA256');signer.update(payload);signer.end();
  return payload+'.'+signer.sign(privateKey).toString('base64url');
}
export function webhookEvidence(raw,signature,secret,expectedNumber,expectedHead){
  ensure(typeof raw==='string' && raw.length<1048576 && typeof secret==='string' && secret.length>=32,'WEBHOOK_INPUT_INVALID');
  ensure(/^sha256=[0-9a-f]{64}$/i.test(signature||''),'WEBHOOK_SIGNATURE_MISSING');
  const actual=createHmac('sha256',secret).update(raw).digest();
  const expected=Buffer.from(signature.slice(7),'hex');
  ensure(expected.length===actual.length && timingSafeEqual(actual,expected),'WEBHOOK_SIGNATURE_INVALID');
  const event=JSON.parse(raw);
  ensure(event.repository?.full_name===REPO && event.pull_request?.number===expectedNumber &&
    event.pull_request?.head?.sha===expectedHead &&
    ['opened','synchronize'].includes(event.action) &&
    event.sender?.type==='User' && /^[A-Za-z0-9-]+$/.test(event.sender.login||''),
    'WEBHOOK_PROVENANCE_MISMATCH');
  return {actor:event.sender.login,head:event.pull_request.head.sha,number:event.pull_request.number};
}
// Called only by the trusted webhook ingress, not by a PR/workflow caller.
// The persistent unique-delivery insert is atomic and never overwrites history.
export async function recordVerifiedWebhook({raw,signature,secret,deliveryId,eventName,
    prNumber,head,store}) {
  ensure(eventName==='pull_request' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deliveryId||''),
    'WEBHOOK_DELIVERY_HEADER_INVALID');
  ensure(store && typeof store.recordDeliveryOnce==='function',
    'DURABLE_WEBHOOK_DELIVERY_STORE_MISSING');
  const verified=webhookEvidence(raw,signature,secret,prNumber,head);
  const record={delivery_id:deliveryId,trusted_signature:true,repository:REPO,
    pr_number:verified.number,head_sha:verified.head,sender_type:'User',
    sender_login:verified.actor,event_name:eventName};
  ensure(await store.recordDeliveryOnce(record)===true,
    'WEBHOOK_DELIVERY_REPLAY_DETECTED');
  return record;
}

export function activationGate({appId,repositoryAppId,branch,head,mainSha}) {
  ensure(HEX40.test(head||'') && HEX40.test(mainSha||''),'SOURCE_SHA_REQUIRED');
  ensure(appId>0 && repositoryAppId===appId,'TRUSTED_APP_IDENTITY_MISMATCH');
  const checks=branch?.required_status_checks?.checks;
  ensure(branch?.enforce_admins?.enabled===true && branch?.required_status_checks?.strict===true &&
    branch?.required_pull_request_reviews?.required_approving_review_count>=1 &&
    branch?.required_pull_request_reviews?.dismiss_stale_reviews===true &&
    branch?.required_pull_request_reviews?.require_last_push_approval===true,
    'BRANCH_PROTECTION_TOO_WEAK');
  ensure(Array.isArray(checks) && checks.some(x=>x.context===CONTEXT && x.app_id===appId),
    'INDEPENDENT_APP_REQUIRED_CHECK_NOT_ENFORCED');
  // No current personal-repo GitHub protection guarantees exclusive merges.
  // Publishing a green authorization would leave a stale-green merge window.
  // The trusted App must become the sole branch merger with a serial commit
  // transaction / revocation interlock before any positive status is issued.
  throw Error('SERIAL_MERGE_AND_REVOCATION_INTERLOCK_NOT_ACTIVATED');
}
async function run(){
  const e=process.env;
  ensure(e.GITHUB_REPOSITORY===REPO && e.GITHUB_REF==='refs/heads/main' &&
    HEX40.test(e.GITHUB_SHA||'') && e.GITHUB_SHA===execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    'UNTRUSTED_CHECKOUT');
  const number=Number(e.PRI_VERIFIER_PR_NUMBER),head=e.PRI_VERIFIER_EXPECTED_HEAD;
  ensure(Number.isSafeInteger(number)&&number>0 && HEX40.test(head||''),'EXACT_PR_IDENTITY_REQUIRED');
  const appId=Number(e.PRI_TRUSTED_APP_ID),installationId=Number(e.PRI_TRUSTED_INSTALLATION_ID);
  ensure(Number.isSafeInteger(installationId) && installationId>0,'DEDICATED_INSTALLATION_REQUIRED');
  // Decode only from protected environment; never print credential material.
  const jwt=appJWT(appId,e.PRI_TRUSTED_APP_PRIVATE_KEY||'');
  async function call(method,path,token,body){
    ensure(/^\/?[A-Za-z0-9_/.?=&+%-]+$/.test(path) && !path.includes('..'),'UNTRUSTED_GITHUB_API_PATH');
    const res=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,
      Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
      ...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    ensure(res.ok,'GITHUB_APP_REQUEST_FAILED_'+res.status);
    return await res.json();
  }
  const app=await call('GET','app',jwt);
  ensure(app.id===appId,'SIGNER_IS_NOT_EXPECTED_GITHUB_APP');
  const installed=await call('GET','repos/'+REPO+'/installation',jwt);
  ensure(installed.id===installationId && installed.app_id===appId,'APP_NOT_INSTALLED_ON_AUTHORITATIVE_REPO');
  const access=await call('POST','app/installations/'+installationId+'/access_tokens',jwt,{
    repositories:['Final-Pri-learning'],permissions:{checks:'write',contents:'read',issues:'read',pull_requests:'read',administration:'read'}
  });
  ensure(access?.token && access.permissions?.checks==='write','CHECKS_WRITE_INSTALLATION_TOKEN_REQUIRED');
  const token=access.token;
  const main=await call('GET','repos/'+REPO+'/branches/main',token);
  ensure(main.commit?.sha===e.GITHUB_SHA,'PROTECTED_MAIN_CHANGED');
  const branch=await call('GET','repos/'+REPO+'/branches/main/protection',token);
  // Verify the HMAC sent by GitHub on a genuine push/open/synchronize event,
  // not arbitrary editable issue/comment/PR fields.
  const raw=readFileSync(e.PRI_VERIFIER_WEBHOOK_FILE,'utf8');
  const proof=webhookEvidence(raw,e.PRI_VERIFIER_WEBHOOK_SIGNATURE,
    e.PRI_GITHUB_WEBHOOK_SECRET,number,head);
  const pr=await call('GET','repos/'+REPO+'/pulls/'+number,token);
  ensure(pr.head?.sha===head && pr.base?.sha===e.GITHUB_SHA,'STALE_PR_HEAD_OR_BASE');
  try {
    activationGate({appId,repositoryAppId:installed.app_id,branch,head,mainSha:e.GITHUB_SHA});
  } catch (error) {
    // A real GitHub App failure check invalidates any previously green check
    // from the same App and context. This is NEVER a claim of safe merging.
    await call('POST','repos/'+REPO+'/check-runs',token,{
      name:CONTEXT,head_sha:head,status:'completed',conclusion:'failure',
      output:{title:'Trusted source authorization NOT certified',
        summary:String(error.message||'FAIL_CLOSED').slice(0,500)}
    });
    throw error;
  }
  // Intentionally unreachable until a serial, independently controlled
  // merger and source-revocation interlock are externally certified.
  void proof;
}
const isMain=process.argv[1]?.endsWith('/pri-trusted-check-publisher.mjs');
if(isMain)run().catch(err=>{console.error('TRUSTED_CHECK_DENIED:',String(err.message||err).slice(0,200));process.exitCode=1});
