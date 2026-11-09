import './support/hermetic.mjs';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const scratch=mkdtempSync(join(tmpdir(),'q1-unit-http-'));const keys=['NODE_ENV','PRI_PLATFORM_DB','PRI_AUTH_DELIVERY_KEY','PRI_PUBLIC_ORIGIN'];const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',PRI_PLATFORM_DB:join(scratch,'db.sqlite'),PRI_AUTH_DELIVERY_KEY:'ce'.repeat(32)});delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail}=await import('./support/app-harness.mjs');
const h=await startApp({engine:(await import('./support/engine.mjs')).requestedEngine()});console.log('engine: '+h.engine);console.log('Q1_TEST_ENGINE '+h.engine);
const samples=[
 {id:'c11-conic-sections',d:2,s:1,solve:p=>{let m=p.match(/length of the latus rectum of the parabola \$y\^2 = (\d+)x\$/);if(!m)throw Error('CONIC_PROMPT_NOT_MATCH');return Number(m[1]);}},
 // D15: c9-quadrilaterals is a retired bank the server refuses; this length question is its covered successor's.
 {id:'c8-quadrilateral-property-reasoning',d:1,s:1,solve:p=>{let m=p.match(/perimeter of a rhombus is \$(\d+)\$ cm and one of its diagonals is \$(\d+)\$ cm/);if(!m)throw Error('QUAD_PROMPT_NOT_MATCH');const side=Number(m[1])/4,half=Number(m[2])/2;return 2*Math.sqrt(side*side-half*half);}}
];
const forms=[['correct number',v=>String(v),true],['wrong currency for length',v=>v+' rupees',false],['wrong mass for length',v=>v+' kg',false],['wrong paise',v=>v+' paise',false]];
let fails=0,cases=0;
try{const a=await registerAccount(h,{email:'q1-units-'+h.engine+'@example.test',deviceId:'q1-units-'+h.engine});console.log('AUTH '+a.status+'/'+(await verifyEmail(h,a.account.id)).status);
 for(const sample of samples)for(const [name,form,expected]of forms){cases++;const issued=await h.request('/v1/practice/issue',{method:'POST',jar:a.jar,body:{generator:sample.id,difficulty:sample.d,seed:sample.s,curriculum:'in'}});
  if(issued.status!==201){fails++;console.log('ISSUE_FAILED '+sample.id+' '+issued.status);continue;}
  let key;try{key=sample.solve(issued.data.question.prompt);}catch(e){fails++;console.log('ORACLE_FAILED '+sample.id+' '+e.message+' '+issued.data.question.prompt);continue;}
  const answer=form(key),submissionId='q1-unit-'+cases;
  const graded=await h.request('/v1/practice/'+encodeURIComponent(issued.data.question.id)+'/submit',{method:'POST',jar:a.jar,headers:{'Idempotency-Key':submissionId},body:{submissionId,answer,mode:'typed'}});
  const actual=graded.status===200&&graded.data?.correct===true,pass=actual===expected;if(!pass)fails++;
  console.log('Q1_UNIT '+JSON.stringify({id:sample.id,name,prompt:issued.data.question.prompt,oracle:key,answer,expected,actual,pass,earned:graded.data?.marksEarned,possible:graded.data?.marksPossible,status:graded.status}));
 }
 console.log('Q1_UNIT_SUMMARY '+(cases-fails)+'/'+cases+' expected; mismatches='+fails+' engine='+h.engine);
}finally{await h.close();rmSync(scratch,{recursive:true,force:true});for(const k of keys)if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
if(fails)process.exitCode=1;
