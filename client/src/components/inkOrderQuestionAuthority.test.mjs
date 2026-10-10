import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const path=mkdtempSync(join(tmpdir(),'pri-differential-order-'));
process.env.NODE_ENV='test';process.env.PRI_PLATFORM_DB=join(path,'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY='d3'.repeat(32);delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail}=await import('../../../server/test/support/app-harness.mjs');
const h=await startApp({engine:'sqlite'});try{
const a=await registerAccount(h,{email:'a1-differential@example.test',deviceId:'ipad-order-test'});
const verified=await verifyEmail(h,a.account.id);console.log('ACCOUNT',a.status,verified.status);
let got=0;
for(let seed=1012;seed<=1012;seed++){
 const r=await h.request('/v1/practice/issue',{method:'POST',jar:a.jar,body:{generator:'c12-differential-equations',difficulty:1,seed,curriculum:'in'}});
 if(r.status!==201){throw new Error('Exact online issue contract unavailable, status '+r.status);}
 if(seed<1003)console.log('EXAMPLE',seed,(r.data.question?.prompt||'').slice(0,200));
 const p=String(r.data.question?.prompt||'');
 if(!/order of the differential equation/.test(p)|| !/\\dfrac\{dy\}\{dx\}/.test(p))continue;
 if(!/\+ 4y = 7/.test(p))continue;
 got++;
 assert.equal(p,'Find the order of the differential equation $\\dfrac{dy}{dx} + 4y = 7$.');console.log('EXACT_PROMPT',seed,p);
 for(const answer of ['4','1']){
   const q=answer==='4'?r:await h.request('/v1/practice/issue',{method:'POST',jar:a.jar,body:{generator:'c12-differential-equations',difficulty:1,seed,curriculum:'in'}});
   const submissionId='order-diff-'+seed+'-'+answer;
   const x=await h.request('/v1/practice/'+q.data.question.id+'/submit',{method:'POST',jar:a.jar,headers:{'Idempotency-Key':submissionId},body:{answer,mode:'typed',submissionId}});
   assert.equal(x.status,200);assert.equal(x.data?.marksPossible,1);assert.equal(x.data?.marksEarned,answer==='4'?0:1);assert.equal(x.data?.correct,answer==='1');console.log('GRADE',answer,x.status,answer==='4'?'0/1':'1/1');
   if(answer==='4'){
     const secondId='order-diff-'+seed+'-4-retry';
     const twice=await h.request('/v1/practice/'+q.data.question.id+'/submit',{method:'POST',jar:a.jar,headers:{'Idempotency-Key':secondId},body:{answer:'4',mode:'typed',submissionId:secondId}});
     const repeated=await h.request('/v1/practice/'+q.data.question.id+'/submit',{method:'POST',jar:a.jar,headers:{'Idempotency-Key':secondId},body:{answer:'4',mode:'typed',submissionId:secondId}});
     assert.equal(twice.status,200);assert.equal(twice.data?.resolved,true);assert.equal(twice.data?.marksEarned,0);assert.equal(twice.data?.marksPossible,1);assert.equal(twice.data?.solution?.answerText,'1');console.log('WRONG_FINAL',twice.status,'0/1, solution 1');
     assert.equal(repeated.data?.attemptId,twice.data?.attemptId);console.log('REPLAY_STABLE',true);
     const n=await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND kind='graded-attempt'",[a.account.id]);
     assert.equal(Number(n?.n),1);console.log('WRONG_EVENT_COUNT',n?.n);
   }
 }
 break;
}
assert.equal(got,1);console.log('EXACT_DIFFERENTIAL_ORDER_RELEASE_CONTRACT: PASS');
}finally{await h.close();}
