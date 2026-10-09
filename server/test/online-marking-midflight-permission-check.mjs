// Test-only held local OCR provider. Verify server rechecks student authority after external awaits.
// This cannot certify real OCR transcription or human-written accuracy.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let checks=0;
const eq=(actual,expected,reason)=>{assert.equal(actual,expected,reason);checks++;};
const dir=mkdtempSync(join(tmpdir(),'pri-ocr-midflight-'));
const waiting=[];
const already=[];
const fake=createServer((req,res)=>{
  req.on('data',()=>{});
  req.on('end',()=>{
    if(waiting.length)waiting.shift()(res);
    else already.push(res);
  });
});
await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
const providerUrl='http://127.0.0.1:'+fake.address().port+'/v1/responses';
function waitingProvider(){
  if(already.length)return Promise.resolve(already.shift());
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('provider was never called')),8000);
    waiting.push(res=>{clearTimeout(timer);resolve(res);});
  });
}
function finish(res){
 res.writeHead(200,{'content-type':'application/json'});
 res.end(JSON.stringify({output_text:JSON.stringify({lines:[{text:'x = 9',confidence:0.96}],confidence:0.96,needs_confirmation:false})}));
}
const vars=['NODE_ENV','PRI_PLATFORM_DB','PRI_AUTH_DELIVERY_KEY','PRI_PUBLIC_ORIGIN',
  'PRI_HANDWRITING_API_KEY','PRI_HANDWRITING_ENDPOINT','PRI_HANDWRITING_MODEL','PRI_HANDWRITING_FALLBACK_MODEL',
  'PRI_PAID_CALLS_PER_HOUR','PRI_PAID_CALLS_PER_DAY'];
const prev=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
Object.assign(process.env,{
 NODE_ENV:'test', PRI_PLATFORM_DB:join(dir,'test.sqlite'),PRI_AUTH_DELIVERY_KEY:'ea'.repeat(32),
 PRI_HANDWRITING_API_KEY:'local-provider-fixture',PRI_HANDWRITING_ENDPOINT:providerUrl,
 PRI_HANDWRITING_MODEL:'local-fixture',PRI_HANDWRITING_FALLBACK_MODEL:'local-fixture',
 PRI_PAID_CALLS_PER_HOUR:'10000',PRI_PAID_CALLS_PER_DAY:'100000'
});
delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail} = await import('./support/app-harness.mjs');
const {requestedEngine} = await import('./support/engine.mjs');
const {decryptDeliveryToken}=await import('../platform/deliveryCrypto.js');
const h=await startApp({engine:requestedEngine()});
const image='data:image/png;base64,'+Buffer.from('a'.repeat(600)).toString('base64');
const issue=jar=>h.request('/v1/practice/issue',{method:'POST',jar,body:{generator:'c8-linear-equations-both-sides',difficulty:2,seed:104729,curriculum:'in'}});
const recognize=(jar,qid)=>h.request('/v1/practice/'+qid+'/recognize',{method:'POST',jar,body:{mode:'photo',image}});
async function guardianToken(accountId,kind){
 const row=await h.db.get('SELECT token_id,token_ciphertext FROM auth_delivery_outbox WHERE account_id=? AND kind=? ORDER BY created_at DESC LIMIT 1',[accountId,kind]);
 assert.ok(row,'guardian delivery envelope must exist');
 return decryptDeliveryToken(row.token_ciphertext,accountId+':'+kind+':'+row.token_id);
}
const receipts=accountId=>h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition'",[accountId]);
try{
 const a=await registerAccount(h,{email:'ocr.revocation.qa@example.test',deviceId:'qa-ipad-ocr'});
 eq(a.status,201);
 eq((await verifyEmail(h,a.account.id)).status,200);
 const q=await issue(a.jar);eq(q.status,201);
 const running=recognize({...a.jar},q.data.question.id);
 const reply=await waitingProvider();
 const logout=await h.request('/v1/account/logout',{method:'POST',jar:a.jar,body:{}});
 eq(logout.status,200);
 finish(reply);
 const result=await running;
 console.log('LOGOUT_DURING_PROVIDER',result.status,result.data?.error?.code,'RECEIPTS',(await receipts(a.account.id))?.n);
 eq(result.status,401);
 eq(Number((await receipts(a.account.id))?.n),0);
 const b=await registerAccount(h,{email:'ocr.completion.qa@example.test',deviceId:'qa-ipad-completion'});
 eq((await verifyEmail(h,b.account.id)).status,200);
 const foreign=await recognize({...b.jar},q.data.question.id);
 eq(foreign.status,404,'foreign account cannot enter provider route for another question');
 const fresh=await issue(b.jar);eq(fresh.status,201);
 const running2=recognize({...b.jar},fresh.data.question.id);
 const reply2=await waitingProvider();
 const grade=await h.request('/v1/practice/'+fresh.data.question.id+'/submit',{method:'POST',jar:b.jar,
   headers:{'Idempotency-Key':'qa-grading-while-provider-waiting'},
   body:{submissionId:'qa-grading-while-provider-waiting',answer:'9',mode:'typed'}});
 console.log('GRADE_DURING_PROVIDER',grade.status,grade.data?.correct,grade.data?.marksEarned);
 eq(grade.status,200);eq(grade.data.resolved,true);
 finish(reply2);
 const after=await running2;
 console.log('GRADE_COMPLETION_DURING_PROVIDER',after.status,after.data?.error?.code,'RECEIPTS',(await receipts(b.account.id))?.n);
 eq(after.status,409);
 eq(Number((await receipts(b.account.id))?.n),0);
 // Actual minor registration, email verification and guardian consent ceremony.
 // The guardian withdraws permission while the provider is waiting, rather
 // than a test mutating client flags or faking a server permission response.
 const childJar={};
 const registration=await h.request('/v1/account/register',{method:'POST',jar:childJar,body:{
  name:'QA Student',email:'ocr.child.qa@example.test',password:'guardian-pass-123',
  deviceId:'qa-child-ipad',isAdult:false,year:'9',
  guardianName:'QA Guardian',guardianEmail:'ocr.guardian.qa@example.test'
 }});
 eq(registration.status,201,'minor registration creates pending account');
 const childId=registration.data.account.id;
 eq((await verifyEmail(h,childId)).status,200,'minor email verified');
 const guardianConsentToken=await guardianToken(childId,'guardian-consent');
 const confirmed=await h.request('/v1/account/guardian/confirm',{method:'POST',body:{token:guardianConsentToken}});
 eq(confirmed.status,200,'guardian confirmation accepted');
 eq(confirmed.data?.confirmed,true,'guardian consent granted');
 const childQuestion=await issue(childJar);
 eq(childQuestion.status,201,'guardian-approved minor receives online issued question');
 const heldChild=recognize({...childJar},childQuestion.data.question.id);
 const heldReply=await waitingProvider();
 const withdrawToken=await guardianToken(childId,'guardian-withdraw');
 const withdrawn=await h.request('/v1/account/guardian/withdraw',{method:'POST',body:{token:withdrawToken}});
 eq(withdrawn.status,200,'guardian withdrawal accepted during OCR wait');
 eq(withdrawn.data?.withdrawn,true,'guardian withdrawal is recorded');
 finish(heldReply);
 const blockedChild=await heldChild;
 eq(blockedChild.status,403,'a withdrawn minor cannot receive a late OCR receipt');
 eq(blockedChild.data?.error?.code,'GUARDIAN_CONSENT_WITHDRAWN',
    'late OCR fails with explicit guardian revocation');
 eq(Number((await receipts(childId))?.n),0,
    'guardian withdrawal leaves zero persisted recognition receipts');
 console.log('ONLINE MARKING MIDFLIGHT PERMISSIONS PASS — '+checks+'/'+checks+' checks, real '+h.engine+' HTTP, local test provider');
} finally {
 await h.close();
 await new Promise(resolve=>fake.close(resolve));
 rmSync(dir,{recursive:true,force:true});
 for(const k of vars){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
}
