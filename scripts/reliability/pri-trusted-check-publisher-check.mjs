import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac,createVerify} from 'node:crypto';
import {appJWT,webhookEvidence,recordVerifiedWebhook,activationGate} from './pri-trusted-check-publisher.mjs';
const R='Priysharan19/Final-Pri-learning', head='c'.repeat(40);
const key='a-sufficiently-long-secret-for-tests-with-independent-key-custody';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const body=JSON.stringify({repository:{full_name:R},action:'synchronize',sender:{login:'Priysharan19',type:'User'},pull_request:{number:45,head:{sha:head}}});
const sign=raw=>'sha256='+createHmac('sha256',key).update(raw).digest('hex');
const policy={enforce_admins:{enabled:true},required_status_checks:{strict:true,checks:[{context:'Pri Trusted Governor / Source Authorization',app_id:101}]},required_pull_request_reviews:{required_approving_review_count:1,dismiss_stale_reviews:true,require_last_push_approval:true}};
const good={appId:101,repositoryAppId:101,branch:policy,head,mainSha:'d'.repeat(40)};
let total=0;
const ok=(name,fn)=>{fn();total++};
const deny=(name,regex,fn)=>ok(name,()=>assert.throws(fn,regex));
ok('JWT signed by dedicated RSA private key',()=>{
 const jwt=appJWT(101,privateKey.export({type:'pkcs8',format:'pem'}));
 const [h,p,s]=jwt.split('.');
 assert.equal(JSON.parse(Buffer.from(p,'base64url')).iss,'101');
 const verifier=createVerify('RSA-SHA256');verifier.update(h+'.'+p);verifier.end();
 assert.ok(verifier.verify(publicKey,Buffer.from(s,'base64url')));
});
ok('independent signed latest push actor',()=>assert.equal(webhookEvidence(body,sign(body),key,45,head).actor,'Priysharan19'));
deny('edited webhook payload',/WEBHOOK_SIGNATURE_INVALID/,()=>webhookEvidence(body+' ',sign(body),key,45,head));
deny('forged webhook token',/WEBHOOK_SIGNATURE_INVALID/,()=>webhookEvidence(body,'sha256='+'0'.repeat(64),key,45,head));
deny('wrong source SHA',/WEBHOOK_PROVENANCE_MISMATCH/,()=>webhookEvidence(body,sign(body),key,45,'e'.repeat(40)));
deny('wrong PR number',/WEBHOOK_PROVENANCE_MISMATCH/,()=>webhookEvidence(body,sign(body),key,46,head));
for(const action of ['edited','review_requested','closed']) {
 const altered=JSON.stringify({...JSON.parse(body),action});
 deny('non-push event '+action,/WEBHOOK_PROVENANCE_MISMATCH/,()=>webhookEvidence(altered,sign(altered),key,45,head));
}
for(const mod of [{appId:99},{repositoryAppId:99},{branch:{...policy,enforce_admins:{enabled:false}}},
 {branch:{...policy,required_pull_request_reviews:{...policy.required_pull_request_reviews,required_approving_review_count:0}}},
 {branch:{...policy,required_status_checks:{...policy.required_status_checks,checks:[]}}}]) {
 deny('deny incorrect app/protection configuration',/TRUSTED_APP_IDENTITY_MISMATCH|BRANCH_PROTECTION_TOO_WEAK|INDEPENDENT_APP_REQUIRED_CHECK_NOT_ENFORCED/,
  ()=>activationGate({...good,...mod}));
}
deny('even fully protected config fails pending actual serial merge interlock',/SERIAL_MERGE_AND_REVOCATION_INTERLOCK_NOT_ACTIVATED/,()=>activationGate(good));
deny('invalid head sha',/SOURCE_SHA_REQUIRED/,()=>activationGate({...good,head:'short'}));
const deliveries=new Map();
const store={recordDeliveryOnce:async proof=>{
 if(deliveries.has(proof.delivery_id))return false;
 deliveries.set(proof.delivery_id,proof);return true;
}};
const envelope={raw:body,signature:sign(body),secret:key,
 deliveryId:'123e4567-e89b-42d3-a456-426614174000',eventName:'pull_request',
 prNumber:45,head,store};
const persisted=await recordVerifiedWebhook(envelope);
assert.equal(persisted.trusted_signature,true);assert.equal(deliveries.size,1);total++;
await assert.rejects(()=>recordVerifiedWebhook(envelope),/WEBHOOK_DELIVERY_REPLAY_DETECTED/);total++;
await assert.rejects(()=>recordVerifiedWebhook({...envelope,deliveryId:'not-a-valid-header'}),/WEBHOOK_DELIVERY_HEADER_INVALID/);total++;
await assert.rejects(()=>recordVerifiedWebhook({...envelope,deliveryId:'123e4567-e89b-42d3-a456-426614174001',signature:'sha256='+'0'.repeat(64)}),/WEBHOOK_SIGNATURE_INVALID/);total++;
assert.equal(deliveries.size,1);
console.log(`PASS: ${total} independent App JWT, webhook provenance, durable replay-denial and activation fail-closed assertions`);
