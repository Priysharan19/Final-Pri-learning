import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPostgresControlStore} from './pri-postgres-control-store.mjs';
import {createSerializedSigner} from './pri-serialized-signer.mjs';
const connection=process.env.PRI_ISOLATED_TEST_POSTGRES_URL;
if(!/^postgresql?:\/\/127\.0\.0\.1:55439\//.test(connection||''))
  throw Error('ONLY_DISPOSABLE_LOOPBACK_POSTGRES_PERMITTED');
const require=createRequire(new URL('../../server/package.json',import.meta.url));
const {Pool}=require('pg');
const pool=new Pool({connectionString:connection,max:3});
const store=createPostgresControlStore(pool);
const base='b'.repeat(40),first='c'.repeat(40),next='d'.repeat(40);
let head=first,signCount=0;
const req={repository:'Priysharan19/Final-Pri-learning',issue_number:804,pr_number:880,
  operation:'GRANT',idempotency_key:'signed-grant-test-804',approved_run_id:99881234,
  expected_main:base,expected_authority:first};
const deps={store,authority:{
  read:async()=>({verified:true,main_sha:base,authority_head:head}),
  apply:async x=>{signCount++;head=next;return {decision:'SIGNED_LEDGER_CAS_COMMITTED',
    operation:x.operation,issue_number:x.issue_number,authority_head:next}}
 },approve:async x=>({decision:'INDEPENDENT_PROTECTED_RUN_APPROVED',run_id:x.approved_run_id,
    main_sha:x.expected_main}),
 runtime:{independentlyDeployed:true,protectedMainSource:true,
  sameLockAsMerger:true,signedAuthorityInstalled:true}};
let count=0;
try{
 const result=await createSerializedSigner(deps).transact(req);
 assert.equal(result.authority_head,next);assert.equal(signCount,1);count++;
 const audit=await pool.query("SELECT event_kind FROM pri_governor.audit_events WHERE event_kind='SIGNER_SIGNED_CAS_CONFIRMED'");
 assert.equal(audit.rowCount,1);count++;
 const reqRev={...req,operation:'REVOKE',expected_authority:next,
  idempotency_key:'signed-revoke-test-804'};
 const fatal=()=>{throw Error('INTERRUPTED_SIGNER_BEFORE_COMMIT')};
 deps.authority.apply=fatal;
 await assert.rejects(()=>createSerializedSigner(deps).transact(reqRev),/INTERRUPTED_SIGNER_BEFORE_COMMIT/);
 const outstanding=await pool.query("SELECT state FROM pri_governor.emergency_queue WHERE idempotency_key=$1",[reqRev.idempotency_key]);
 assert.equal(outstanding.rows[0].state,'PENDING');count++;
 await store.transaction('prilearning:trusted-main-authority',async tx=>{
  assert.equal(await tx.hasQueuedRevocation(req.pr_number),true);
 });count++;
 console.log(`PASS: ${count} real isolated PostgreSQL shared signer / merger lock audit and durable emergency-denial cases (synthetic authority only)`);
}catch(err){console.error('SIGNER_DISPOSABLE_POSTGRES_TEST_FAILED',err);process.exitCode=1;}
finally{await pool.end();}
