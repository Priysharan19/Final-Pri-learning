import './support/hermetic.mjs';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const scratch=mkdtempSync(join(tmpdir(),'q1-set-http-'));const keys=['NODE_ENV','PRI_PLATFORM_DB','PRI_AUTH_DELIVERY_KEY','PRI_PUBLIC_ORIGIN'];const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',PRI_PLATFORM_DB:join(scratch,'db.sqlite'),PRI_AUTH_DELIVERY_KEY:'be'.repeat(32)});delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail}=await import('./support/app-harness.mjs');
const h=await startApp({engine:(await import('./support/engine.mjs')).requestedEngine()});console.log('engine: '+h.engine);console.log('Q1_TEST_ENGINE '+h.engine);
const sample={generator:'c11-sets',difficulty:1,seed:1,curriculum:'in'};
function independentlySolve(prompt){
 const groups=[...prompt.matchAll(/\\\{([0-9,\s]+)\\\}/g)].map(m=>m[1].split(',').map(x=>Number(x.trim())));
 if(groups.length!==2||groups.some(x=>x.some(y=>!Number.isInteger(y))))throw Error('Unexpected authored prompt: '+prompt);
 const [a,b]=groups; const aa=new Set(a),bb=new Set(b);
 if(prompt.includes('\\cap'))return [...aa].filter(x=>bb.has(x)).sort((x,y)=>x-y);
 if(prompt.includes('\\cup'))return [...new Set([...a,...b])].sort((x,y)=>x-y);
 throw Error('Unknown set operation: '+prompt);
}
const forms=[
 ['canonical',vs=>'{'+vs.join(',')+'}',true],
 ['permuted valid',vs=>'{'+[...vs].reverse().join(',')+'}',true],
 ['missing comma member',vs=>'{'+vs[0]+',,'+vs.slice(1).join(',')+'}',false],
 ['missing trailing member',vs=>'{'+vs.join(',')+',}',false],
 ['missing semicolon member',vs=>vs[0]+';;'+vs.slice(1).join(';'),false],
 ['empty semicolon member',vs=>'{'+vs[0]+'; ;'+vs.slice(1).join(';')+'}',false],
 ['wrong element',vs=>'{'+[...vs.slice(0,-1),vs.at(-1)+100].join(',')+'}',false],
 ['extra element',vs=>'{'+[...vs,vs.at(-1)+100].join(',')+'}',false],
];let unexpected=0;
try{const account=await registerAccount(h,{email:'q1-set-'+h.engine+'@example.test',deviceId:'q1-set-'+h.engine});const verified=await verifyEmail(h,account.account.id);console.log('AUTH '+account.status+'/'+verified.status);
 for(const [i,[name,form,expected]] of forms.entries()){
  const issued=await h.request('/v1/practice/issue',{method:'POST',jar:account.jar,body:sample});
  if(issued.status!==201){console.log('ISSUE_FAIL '+issued.status+' '+name);unexpected++;continue;}
  let vals;try{vals=independentlySolve(issued.data.question.prompt);}catch(e){console.log('ORACLE_FAIL '+e.message);unexpected++;continue;}
  const answer=form(vals);const submissionId='q1-set-'+i;
  const grade=await h.request('/v1/practice/'+encodeURIComponent(issued.data.question.id)+'/submit',{method:'POST',jar:account.jar,headers:{'Idempotency-Key':submissionId},body:{submissionId,answer,mode:'typed'}});
  const actual=grade.status===200&&grade.data?.correct===true;
  const good=actual===expected;if(!good)unexpected++;
  console.log('Q1_SET '+JSON.stringify({name,prompt:issued.data.question.prompt,oracle:vals,answer,expected,actual,pass:good,status:grade.status,earned:grade.data?.marksEarned,possible:grade.data?.marksPossible}));
 }
 console.log('Q1_SET_SUMMARY '+(forms.length-unexpected)+'/'+forms.length+' expected mismatches='+unexpected+' engine='+h.engine);
}finally{await h.close();rmSync(scratch,{recursive:true,force:true});for(const k of keys)if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
if(unexpected)process.exitCode=1;
