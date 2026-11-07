import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createWebhookIngress} from './pri-webhook-ingress.mjs';
import {createPostgresControlStore} from './pri-postgres-control-store.mjs';
const require=createRequire(new URL('../../server/package.json',import.meta.url));
const {Pool}=require('pg');
const url=process.env.PRI_ISOLATED_TEST_POSTGRES_URL;
if(!/^postgresql?:\/\/127\.0\.0\.1:55439\//.test(url||''))
  throw Error('TEST_ONLY_DISPOSABLE_LOOPBACK_POSTGRES_ALLOWED');
const pool=new Pool({connectionString:url,max:4});
const store=createPostgresControlStore(pool);
const secret='github-hmac-test-secret-'+('z'.repeat(48));
const app=createWebhookIngress({store,secret});
const event={action:'opened',repository:{full_name:'Priysharan19/Final-Pri-learning'},
  pull_request:{number:626,head:{sha:'a'.repeat(40)}},sender:{type:'User',login:'Kalp-Bajpai'}};
const payload=JSON.stringify(event);
let total=0;
const check=async(title,fn)=>{await fn();total++};
const post=async({body=payload,id=randomUUID(),signature=null,eventName='pull_request',contentType='application/json'}={})=>{
  const sig=signature||'sha256='+createHmac('sha256',secret).update(body).digest('hex');
  const response=await fetch(`http://127.0.0.1:${app.address().port}/webhooks/github`,{
    method:'POST',headers:{'content-type':contentType,'x-github-event':eventName,
      'x-github-delivery':id,'x-hub-signature-256':sig},body});
  return {status:response.status,json:await response.json(),id};
};
try{
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  await check('health is inert and does not authorize',async()=>{
    const response=await fetch(`http://127.0.0.1:${app.address().port}/healthz`);
    assert.equal(response.status,200);
    assert.equal((await response.json()).code,'WEBHOOK_INGRESS_ALIVE_NOT_ACTIVATED');
  });
  let accepted;
  await check('authentic HMAC PR payload recorded exactly once in actual Postgres',async()=>{
    accepted=await post();assert.equal(accepted.status,202);
    assert.equal(accepted.json.code,'VERIFIED_DELIVERY_RECORDED_NOT_AUTHORIZED');
    const saved=await store.verifyDelivery(accepted.id);
    assert.equal(saved.repository,'Priysharan19/Final-Pri-learning');
    assert.equal(saved.pr_number,626);assert.equal(saved.sender_login,'Kalp-Bajpai');
  });
  await check('replay of same GitHub delivery ID rejected with 409',async()=>{
    const replay=await post({id:accepted.id});assert.equal(replay.status,409);
  });
  await check('valid HMAC but different source cannot overwrite stored delivery',async()=>{
    const tampered=JSON.stringify({...event,pull_request:{number:999,head:{sha:'f'.repeat(40)}}});
    assert.equal((await post({id:accepted.id,body:tampered})).status,409);
    assert.equal((await store.verifyDelivery(accepted.id)).pr_number,626);
  });
  await check('invalid HMAC never persisted',async()=>{
    const id=randomUUID();assert.equal((await post({id,signature:'sha256='+'0'.repeat(64)})).status,400);
    assert.equal(await store.verifyDelivery(id),null);
  });
  await check('tampered content with mismatched valid signature denied',async()=>{
    const id=randomUUID(),sig='sha256='+createHmac('sha256',secret).update(payload).digest('hex');
    assert.equal((await post({id,body:payload+' ',signature:sig})).status,400);
    assert.equal(await store.verifyDelivery(id),null);
  });
  await check('HMAC-authenticated wrong repository denied',async()=>{
    const id=randomUUID(),bad=JSON.stringify({...event,repository:{full_name:'attacker/repo'}});
    assert.equal((await post({id,body:bad})).status,400);
    assert.equal(await store.verifyDelivery(id),null);
  });
  await check('unsupported GitHub event denied',async()=>{
    assert.equal((await post({eventName:'push'})).status,400);
  });
  await check('unsupported pull request action denied',async()=>{
    const bad=JSON.stringify({...event,action:'closed'});
    assert.equal((await post({body:bad})).status,400);
  });
  await check('untrusted content-type denied',async()=>{
    assert.equal((await post({contentType:'text/plain'})).status,400);
  });
  await check('oversized webhook body denied',async()=>{
    const b='a'.repeat(1048576);
    assert.equal((await post({body:b})).status,413);
  });
  await check('no merge, signer or App-check publishing endpoint is exposed',async()=>{
    for(const path of ['/merge','/grant','/revoke','/webhooks/github/merge']){
      const r=await fetch(`http://127.0.0.1:${app.address().port}${path}`,{method:'POST'});
      assert.equal(r.status,404);
    }
  });
  console.log(`PASS: ${total} real loopback HTTP + PostgreSQL signed-ingress / replay / inactive-authority checks (NOT live GitHub certificate)`);
}catch(err){console.error('ISOLATED_INGRESS_PROOF_FAILED',err);process.exitCode=1;}
finally{await new Promise(resolve=>app.close(resolve));await pool.end();}
