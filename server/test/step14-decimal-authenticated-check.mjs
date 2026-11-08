// Step 14: real authenticated issue/submit, independently derived exact integers.
import './support/hermetic.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const scratch=mkdtempSync(join(tmpdir(),'step14-exact-http-'));
const keys=['NODE_ENV','PRI_PLATFORM_DB','PRI_AUTH_DELIVERY_KEY','PRI_PUBLIC_ORIGIN'];
const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',PRI_PLATFORM_DB:join(scratch,'platform.db'),PRI_AUTH_DELIVERY_KEY:'ad'.repeat(32)});
delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail}=await import('./support/app-harness.mjs');
const h=await startApp({engine:(await import('./support/engine.mjs')).requestedEngine()});console.log('engine: '+h.engine);
const cases=[
 {generator:'c8-exponents-ncert-mastery',difficulty:4,seed:1,actual:(p)=>{if(!/\(3\.2\\times10\\?\^?\{6\}\)\(1\.2/.test(p))throw Error('Unexpected exponent prompt: '+p);return 32n*12n*10n**10n;}, answers:[['3840000000000',true],['3.84*10^12',true],['3840000000000.001',false],['3840000000000.2',false]]},
 {generator:'c7-place-value-systems-reasoning',difficulty:1,seed:6,actual:p=>{if(!/2.*crores.*11.*lakhs.*45.*thousands.*47.*hundreds/i.test(p))throw Error('Unexpected place-value prompt: '+p);return 2n*10000000n+11n*100000n+45n*1000n+47n*100n;},answers:[['21149700',true],['21149700.000000004',false],['21149700.01',false]]}
];
let n=0,fail=0;
try {
 const a=await registerAccount(h,{email:'step14-exact-'+h.engine+'@example.test',deviceId:'step14-exact-'+h.engine});
 if(a.status!==201 || (await verifyEmail(h,a.account.id)).status!==200)throw Error('Auth bootstrap failed');
 for(const data of cases)for(const [answer,expected] of data.answers) {
  n++;
  const issued=await h.request('/v1/practice/issue',{method:'POST',jar:a.jar,body:{generator:data.generator,difficulty:data.difficulty,seed:data.seed,curriculum:'in'}});
  if(issued.status!==201)throw Error('Issue failed '+data.generator+': '+issued.status);
  const key=data.actual(issued.data.question.prompt).toString();
  if(expected && answer==='3840000000000' && key!==answer)throw Error('Math oracle disagrees');
  if(expected && answer==='21149700' && key!==answer)throw Error('Math oracle disagrees');
  const submissionId='step14-precision-'+n;
  const grade=await h.request('/v1/practice/'+encodeURIComponent(issued.data.question.id)+'/submit',{method:'POST',jar:a.jar,headers:{'Idempotency-Key':submissionId},body:{submissionId,answer,mode:'typed'}});
  const observed=grade.status===200 && grade.data?.correct===true;
  const ok=observed===expected && grade.data?.authoritative===true && (expected ? grade.data?.marksEarned===grade.data?.marksPossible : grade.data?.marksEarned===0);
  if(!ok)fail++;
  console.log('STEP14_DECIMAL '+JSON.stringify({generator:data.generator,answer,key,expected,observed,marks:grade.data?.marksEarned,possible:grade.data?.marksPossible,pass:ok}));
 }
 console.log('STEP14_DECIMAL_SUMMARY '+(n-fail)+'/'+n+' engine='+h.engine);
}finally{await h.close();rmSync(scratch,{recursive:true,force:true});for(const k of keys)if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
if(fail)process.exitCode=1;
