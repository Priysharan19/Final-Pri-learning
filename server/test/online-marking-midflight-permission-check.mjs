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
const h=await startApp({engine:requestedEngine()});
const image='data:image/png;base64,'+Buffer.from('a'.repeat(600)).toString('base64');
const issue=jar=>h.request('/v1/practice/issue',{method:'POST',jar,body:{generator:'c8-linear-equations-both-sides',difficulty:2,seed:104729,curriculum:'in'}});
const recognize=(jar,qid)=>h.request('/v1/practice/'+qid+'/recognize',{method:'POST',jar,body:{mode:'photo',image}});
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
 console.log('ONLINE MARKING MIDFLIGHT PERMISSIONS PASS — '+checks+'/'+checks+' checks, real '+h.engine+' HTTP, local test provider');
} finally {
 await h.close();
 await new Promise(resolve=>fake.close(resolve));
 rmSync(dir,{recursive:true,force:true});
 for(const k of vars){if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
}
