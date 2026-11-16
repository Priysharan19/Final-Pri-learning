// Durable Postgres coordinator. Requires a *dedicated* control-plane DB role
// and independent deployment; no production student DB is used here.
// The same lock domain MUST serialize signer revoke and merger operations.
// A prepared receipt commits before the external GitHub merge API call.
import {TRUSTED_MERGE_REPO} from './pri-serial-merge-controller.mjs';
const LOCK_ID='7518340032108741123'; // stable signed 64-bit advisory lock key
const fail=(c,m)=>{if(!c)throw Error('PRI_POSTGRES_CONTROL_DENIED_'+m)};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPostgresControlStore(pool) {
  fail(pool && typeof pool.connect==='function' && typeof pool.query==='function',
    'DEDICATED_POOL_UNAVAILABLE');
  const run=async(sql,parameters=[])=>await pool.query(sql,parameters);
  const scoped=async(conn,sql,parameters=[])=>await conn.query(sql,parameters);
  return {
    async recordDeliveryOnce(proof) {
      fail(uuid.test(proof?.delivery_id||'') && proof.repository===TRUSTED_MERGE_REPO &&
        proof.trusted_signature===true && proof.sender_type==='User',
        'UNTRUSTED_DELIVERY_INSERT');
      const result=await run(`INSERT INTO pri_governor.webhook_deliveries
        (delivery_id,repository,pr_number,head_sha,sender_type,sender_login,event_name,trusted_signature)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT (delivery_id) DO NOTHING`,
        [proof.delivery_id,proof.repository,proof.pr_number,proof.head_sha,proof.sender_type,
          proof.sender_login,proof.event_name]);
      return result.rowCount===1;
    },
    async verifyDelivery(id,tx) {
      fail(uuid.test(id||''),'MALFORMED_DELIVERY_ID');
      const query=tx?.query || run;
      const r=await query(`SELECT repository,pr_number,head_sha,sender_type,sender_login,trusted_signature
        FROM pri_governor.webhook_deliveries WHERE delivery_id=$1`,[id]);
      return r.rows[0] || null;
    },
    async queueEmergency(req) {
      fail(req?.repository===TRUSTED_MERGE_REPO && Number.isSafeInteger(req.pr_number) &&
        req.pr_number>0 && req.event_authority==='verified-independent-emergency',
        'UNTRUSTED_EMERGENCY');
      const r=await run(`INSERT INTO pri_governor.emergency_queue(idempotency_key,repository,pr_number)
        VALUES($1,$2,$3) ON CONFLICT(idempotency_key) DO NOTHING`,
        [req.idempotency_key,req.repository,req.pr_number]);
      if(r.rowCount===0) {
        const old=await run(`SELECT repository,pr_number FROM pri_governor.emergency_queue
          WHERE idempotency_key=$1`,[req.idempotency_key]);
        fail(old.rows[0]?.repository===req.repository && old.rows[0]?.pr_number===req.pr_number,
          'EMERGENCY_KEY_REPLAY_WITH_NEW_IDENTITY');
      }
    },
    async ackEmergency(req) {
      const r=await run(`UPDATE pri_governor.emergency_queue
        SET state='ACKED',acknowledged_at=now()
        WHERE idempotency_key=$1 AND repository=$2 AND pr_number=$3`,
        [req.idempotency_key,req.repository,req.pr_number]);
      fail(r.rowCount===1,'EMERGENCY_NOT_PERSISTED');
    },
    async readReceipt(key,tx) {
      const query=tx?.query || run;
      const r=await query(`SELECT operation,state,request_json AS request,proof_json AS proof,
        result_json AS result,reason FROM pri_governor.merge_receipts WHERE idempotency_key=$1`,[key]);
      return r.rows[0]||null;
    },
    async transaction(domain,callback) {
      fail(domain==='prilearning:trusted-main-authority','WRONG_LOCK_DOMAIN');
      const client=await pool.connect();
      let locked=false;
      try {
        await scoped(client,'SELECT pg_advisory_lock($1::bigint)',[LOCK_ID]);
        locked=true;
        const query=(sql,params=[])=>scoped(client,sql,params);
        const tx={durable:true,fenced:true,sharedWithSigner:true,query,
          async hasShutdown() {
            const x=await query('SELECT emergency_shutdown FROM pri_governor.control WHERE id=1');
            fail(x.rows.length===1,'CONTROL_ROW_MISSING');
            return x.rows[0].emergency_shutdown===true;
          },
          async hasQueuedRevocation(pr) {
            const x=await query(`SELECT 1 FROM pri_governor.emergency_queue
              WHERE state='PENDING' AND pr_number=$1 LIMIT 1`,[pr]);
            return x.rowCount>0;
          },
          async prepare(key,req,proof) {
            const result=await query(`INSERT INTO pri_governor.merge_receipts
              (idempotency_key,operation,state,request_json,proof_json)
              VALUES($1,'MERGE','PREPARED',$2::jsonb,$3::jsonb) ON CONFLICT DO NOTHING`,
              [key,JSON.stringify(req),JSON.stringify(proof)]);
            fail(result.rowCount===1,'DUPLICATE_PREPARED_RECEIPT');
          },
          async complete(key,result,req=null,operation=null) {
            if(operation==='REVOKE') {
              const r=await query(`INSERT INTO pri_governor.merge_receipts
                (idempotency_key,operation,state,request_json,result_json)
                VALUES($1,'REVOKE','COMPLETED',$2::jsonb,$3::jsonb)
                ON CONFLICT DO NOTHING`,[key,JSON.stringify(req),JSON.stringify(result)]);
              fail(r.rowCount===1,'REVOKE_RECEIPT_ALREADY_EXISTS');
            } else {
              const r=await query(`UPDATE pri_governor.merge_receipts SET state='COMPLETED',
                result_json=$2::jsonb,updated_at=now()
                WHERE idempotency_key=$1 AND operation='MERGE' AND state='PREPARED'`,
                [key,JSON.stringify(result)]);
              fail(r.rowCount===1,'PREPARED_RECEIPT_MISSING');
            }
          },
          async deny(key,reason) {
            const r=await query(`UPDATE pri_governor.merge_receipts
              SET state='DENIED',reason=$2,updated_at=now()
              WHERE idempotency_key=$1 AND state='PREPARED'`,[key,reason]);
            fail(r.rowCount===1,'DENIAL_RECEIPT_NOT_FOUND');
          },
          async audit(event) {
            fail(event?.kind && /^(?:MERGE_|REVOCATION_|SIGNER_SIGNED_CAS_CONFIRMED$)/.test(event.kind),
              'AUDIT_KIND_MALFORMED');
            await query(`INSERT INTO pri_governor.audit_events(event_kind,payload_json)
              VALUES($1,$2::jsonb)`,[event.kind,JSON.stringify(event)]);
          }
        };
        return await callback(tx);
      } finally {
        if(locked) {
          try {await scoped(client,'SELECT pg_advisory_unlock($1::bigint)',[LOCK_ID]);}
          catch {client.release(true);throw Error('PRI_POSTGRES_CONTROL_DENIED_LOCK_LOST');}
        }
        client.release();
      }
    }
  };
}
