import './support/hermetic.mjs';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const scratch=mkdtempSync(join(tmpdir(),'q1-point-http-'));const keys=['NODE_ENV','PRI_PLATFORM_DB','PRI_AUTH_DELIVERY_KEY','PRI_PUBLIC_ORIGIN'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',PRI_PLATFORM_DB:join(scratch,'db.sqlite'),PRI_AUTH_DELIVERY_KEY:'cd'.repeat(32)});delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail}=await import('./support/app-harness.mjs');
const h=await startApp({engine:(await import('./support/engine.mjs')).requestedEngine()});console.log('engine: '+h.engine);console.log('Q1_ENGINE '+h.engine);
const sample={generator:'c8-plotting-reasoning',difficulty:1,seed:7,curriculum:'in'};
const cases=[
  ['canonical','(-10,6)',true],
  ['semicolon alternative','(-10;6)',true],
  ['missing matrix-like point coordinate','(-10,,6)',false],
  ['missing semicolon point coordinate','(-10; ;6)',false],
  ['extra trailing comma','(-10,6,)',false],
  ['double empty separator','(-10,,6,)',false],
  ['wrong y','(-10,7)',false],
  ['swapped x and y','(6,-10)',false]
];let mismatches=0;
try{
 const a=await registerAccount(h,{email:'q1-point-'+h.engine+'@example.test',deviceId:'q1-point-'+h.engine});const v=await verifyEmail(h,a.account.id);console.log('AUTH '+a.status+'/'+v.status);
 for(const [i,[name,answer,expected]] of cases.entries()){
  const issued=await h.request('/v1/practice/issue',{method:'POST',jar:a.jar,body:sample});
  if(issued.status!==201){console.log('ISSUE_FAIL '+name+' status='+issued.status+' '+JSON.stringify(issued.data));mismatches++;continue;}
  const submissionId='q1-point-'+i;
  const result=await h.request('/v1/practice/'+encodeURIComponent(issued.data.question.id)+'/submit',{method:'POST',jar:a.jar,headers:{'Idempotency-Key':submissionId},body:{submissionId,answer,mode:'typed'}});
  const actual=result.status===200 && result.data?.correct===true;
  const good=actual===expected;
  if(!good)mismatches++;
  console.log('Q1_POINT '+JSON.stringify({name,answer,expected,actual,pass:good,status:result.status,authoritative:result.data?.authoritative,earned:result.data?.marksEarned,possible:result.data?.marksPossible,prompt:issued.data.question.prompt}));
 }
 console.log('Q1_POINT_SUMMARY '+(cases.length-mismatches)+'/'+cases.length+' expected; mismatches='+mismatches+' engine='+h.engine);
}finally{await h.close();rmSync(scratch,{recursive:true,force:true});for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
if(mismatches)process.exitCode=1;
