import './support/hermetic.mjs';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'q1-persist-'));const keys=['NODE_ENV','PRI_PLATFORM_DB','PRI_AUTH_DELIVERY_KEY','PRI_PUBLIC_ORIGIN'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',PRI_PLATFORM_DB:join(dir,'db.sqlite'),PRI_AUTH_DELIVERY_KEY:'d6'.repeat(32)});delete process.env.PRI_PUBLIC_ORIGIN;
const {startApp,registerAccount,verifyEmail}=await import('./support/app-harness.mjs');
const h=await startApp({engine:process.env.PRI_TEST_PG_ADMIN_URL?'postgres':'sqlite'});
const cases=[
 {id:'exact-integer',generator:'c8-exponents-ncert-mastery',d:4,s:1,answer:'3840000000000.001',good:'3840000000000'},
 {id:'malformed-point',generator:'c8-plotting-reasoning',d:1,s:7,answer:'(-10,,6)',good:'(-10,6)'},
 {id:'malformed-set',generator:'c11-sets',d:1,s:1,answer:'{4,,8}',good:'{4,8}'},
 {id:'unit-mismatch',generator:'c11-conic-sections',d:2,s:1,answer:'24 kg',good:'24'},
];
console.log('Q1_ENGINE '+h.engine);let defects=0,consistent=0;
try {
 const a=await registerAccount(h,{email:'q1-persist-a-'+h.engine+'@example.test',deviceId:'q1-persist-a'});
 const b=await registerAccount(h,{email:'q1-persist-b-'+h.engine+'@example.test',deviceId:'q1-persist-b'});
 await verifyEmail(h,a.account.id);await verifyEmail(h,b.account.id);
 console.log('Q1_AUTH '+a.status+'/'+b.status);
 for(let i=0;i<cases.length;i++){
  const fixture=cases[i];
  const issued=await h.request('/v1/practice/issue',{method:'POST',jar:a.jar,body:{generator:fixture.generator,difficulty:fixture.d,seed:fixture.s,curriculum:'in'}});
  if(issued.status!==201){console.log('ISSUE_FAILURE '+fixture.id+' '+issued.status);continue;}
  const qid=issued.data.question.id,sid='q1-persist-'+i;
  const submit=(jar,submissionId,answer)=>h.request('/v1/practice/'+encodeURIComponent(qid)+'/submit',{method:'POST',jar,headers:{'Idempotency-Key':submissionId},body:{submissionId,answer,mode:'typed'}});
  const blocked=await submit(b.jar,'q1-b-attempt-'+i,fixture.answer);
  const grade=await submit(a.jar,sid,fixture.answer);
  const replay=await submit(a.jar,sid,fixture.answer);
  const conflict=await submit(a.jar,sid,'not the same answer');
  const beforeEvent=await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'",[a.account.id,qid]);
  const correct=await submit(a.jar,'q1-correct-'+i,fixture.good);
  const goodReplay=await submit(a.jar,'q1-correct-'+i,fixture.good);
  const event=await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'",[a.account.id,qid]);
  const row=await h.db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt' LIMIT 1",[a.account.id,qid]);
  const foreign=await h.db.get("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'",[b.account.id,qid]);
  let data=null;try{data=typeof row?.payload_json==='string'?JSON.parse(row.payload_json):row?.payload_json;}catch{}
  const wrongCredit=grade.data?.authoritative===true&&grade.data?.correct===true&&grade.data?.marksEarned===grade.data?.marksPossible;
  if(wrongCredit)defects++;
  const integrity=blocked.status===404&&grade.status===200&&grade.data?.correct===false&&grade.data?.marksEarned===0
    &&replay.data?.attemptId===grade.data?.attemptId&&conflict.status===409&&Number(beforeEvent?.n)===0
    &&correct.status===200&&correct.data?.correct===true&&correct.data?.marksEarned===correct.data?.marksPossible
    &&goodReplay.data?.attemptId===correct.data?.attemptId&&Number(event?.n)===1
    &&data?.correct===true&&data?.marksEarned===correct.data.marksEarned&&Number(foreign?.n)===0;
  if(integrity)consistent++;
  console.log('Q1_PERSIST '+JSON.stringify({id:fixture.id,prompt:issued.data.question.prompt,answer:fixture.answer,gradeStatus:grade.status,wrongFullCredit:wrongCredit,gradeMarks:grade.data?.marksEarned,total:grade.data?.marksPossible,resolved:grade.data?.resolved,storedMarks:data?.marksEarned,storedCorrect:data?.correct,eventCount:event?.n,foreignEvents:foreign?.n,foreignSubmitStatus:blocked.status,replaySameAttempt:replay.data?.attemptId===grade.data?.attemptId,changedIdempotencyStatus:conflict.status,integrity}));
 }
 console.log('Q1_PERSIST_SUMMARY badFullCredit='+defects+'/'+cases.length+' integrityControls='+consistent+'/'+cases.length+' engine='+h.engine);
}finally{await h.close();rmSync(dir,{recursive:true,force:true});for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
if(defects||consistent!==cases.length)process.exitCode=1;
