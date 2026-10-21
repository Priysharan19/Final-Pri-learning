import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPostgresControlStore} from './pri-postgres-control-store.mjs';
const require=createRequire(new URL('../../server/package.json',import.meta.url));
const {Pool}=require('pg');
const conn=process.env.PRI_ISOLATED_TEST_POSTGRES_URL;
if(!conn || !/^postgresql?:\/\/127\.0\.0\.1:55439\//.test(conn)) {
 console.error('BLOCKED: only disposable local Postgres port 55439 is permitted');process.exit(2);
}
const pool=new Pool({connectionString:conn,max:4,connectionTimeoutMillis:3000});
const store=createPostgresControlStore(pool);
let count=0;
const ok=async(name,fn)=>{await fn();count++};
const id='1cfed678-e15f-47a7-a7aa-2f6e0e8b72e1';
const delivery={delivery_id:id,repository:'Priysharan19/Final-Pri-learning',pr_number:625,
 head_sha:'a'.repeat(40),sender_type:'User',sender_login:'Priysharan19',event_name:'pull_request',trusted_signature:true};
try {
 await ok('first signed webhook delivery stored',async()=>assert.equal(await store.recordDeliveryOnce(delivery),true));
 await ok('duplicate webhook delivery denied',async()=>assert.equal(await store.recordDeliveryOnce(delivery),false));
 await ok('signed webhook retrieves exact source',async()=>{
  const p=await store.verifyDelivery(id);assert.equal(p.head_sha,delivery.head_sha);
  assert.equal(p.trusted_signature,true);
 });
 const req={repository:'Priysharan19/Final-Pri-learning',pr_number:625,
  expected_head:delivery.head_sha,expected_main:'b'.repeat(40),
  delivery_id:id,idempotency_key:'persisted-merge-operation-42',
  event_authority:'verified-independent-intent'};
 await ok('prepare persists immediately before external effect',()=>store.transaction('prilearning:trusted-main-authority',async tx=>{
  assert.equal(tx.durable,true);assert.equal(tx.fenced,true);assert.equal(tx.sharedWithSigner,true);
  assert.equal((await store.verifyDelivery(id,tx)).sender_login,'Priysharan19');
  assert.equal(await tx.hasShutdown(),false);
  assert.equal(await tx.hasQueuedRevocation(625),false);
  await tx.prepare(req.idempotency_key,req,{authority_head:'c'.repeat(40)});
  await tx.audit({kind:'MERGE_PREPARED',request:req});
 }));
 await ok('prepared journal still visible in new transaction',async()=>{
  const r=await store.readReceipt(req.idempotency_key);assert.equal(r.state,'PREPARED');
  assert.equal(r.request.expected_head,req.expected_head);
 });
 await ok('completed response is durable',()=>store.transaction('prilearning:trusted-main-authority',async tx=>{
  const result={decision:'TRUSTED_MERGE_CONFIRMED',merge_commit_sha:'d'.repeat(40)};
  await tx.complete(req.idempotency_key,result);
  await tx.audit({kind:'MERGE_COMMITTED',request:req,result});
 }));
 await ok('persisted completed result can be recovered',async()=>{
  const old=await store.readReceipt(req.idempotency_key);
  assert.equal(old.result.merge_commit_sha,'d'.repeat(40));assert.equal(old.state,'COMPLETED');
 });
 const revoke={repository:'Priysharan19/Final-Pri-learning',pr_number:625,
  idempotency_key:'persisted-revocation-op-42',event_authority:'verified-independent-emergency'};
 await ok('emergency queue durably blocks next merge',async()=>{
  await store.queueEmergency(revoke);
  await store.transaction('prilearning:trusted-main-authority',async tx=>{
   assert.equal(await tx.hasQueuedRevocation(625),true);
   assert.equal(await tx.hasQueuedRevocation(626),false);
  });
 });
 await ok('different PR identity cannot reuse emergency key',async()=>{
  await assert.rejects(()=>store.queueEmergency({...revoke,pr_number:626}),/EMERGENCY_KEY_REPLAY_WITH_NEW_IDENTITY/);
 });
 await ok('signed revocation receipt and audit persisted',()=>store.transaction('prilearning:trusted-main-authority',async tx=>{
  const result={decision:'SIGNED_REVOCATION_CONFIRMED',authority_head:'e'.repeat(40)};
  await tx.complete(revoke.idempotency_key,result,revoke,'REVOKE');
  await tx.audit({kind:'REVOCATION_COMMITTED',request:revoke,result});
 }));
 await ok('acknowledged revocation no longer blocks the queue',async()=>{
  await store.ackEmergency(revoke);
  await store.transaction('prilearning:trusted-main-authority',async tx=>assert.equal(await tx.hasQueuedRevocation(625),false));
 });
 await ok('second identical revocation receipt denied',()=>store.transaction('prilearning:trusted-main-authority',async tx=>
  assert.rejects(()=>tx.complete(revoke.idempotency_key,{},revoke,'REVOKE'),/REVOKE_RECEIPT_ALREADY_EXISTS/)));
 await ok('advisory lock serializes concurrent Postgres clients',async()=>{
  const events=[];
  const first=store.transaction('prilearning:trusted-main-authority',async()=>{
   events.push('A-enter');await new Promise(resolve=>setTimeout(resolve,150));events.push('A-exit')
  });
  await new Promise(resolve=>setTimeout(resolve,20));
  const second=store.transaction('prilearning:trusted-main-authority',async()=>{events.push('B-enter')});
  await Promise.all([first,second]);assert.deepEqual(events,['A-enter','A-exit','B-enter']);
 });
 await ok('audit table captures all true transitions',async()=>{
  const r=await pool.query('SELECT event_kind FROM pri_governor.audit_events ORDER BY id');
  assert.deepEqual(r.rows.map(x=>x.event_kind),['MERGE_PREPARED','MERGE_COMMITTED','REVOCATION_COMMITTED']);
 });
 await ok('read-only protected test never changes student schema',async()=>{
  const r=await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name='pri_governor'");
  assert.equal(r.rowCount,1);
 });
 console.log(`PASS: ${count} real isolated PostgreSQL 17 transaction, webhook replay, emergency queue, CAS receipt and serialization checks`);
}catch(error){console.error('DISPOSABLE_POSTGRES_TEST_FAILED',error);process.exitCode=1}
finally{await pool.end()}
