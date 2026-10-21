// Dedicated signer transaction adapter. The actual signing/CAS authority
// must be an independently deployed protected-main implementation. This
// module does not accept a caller-provided source verdict or private key.
// Shares the exact durable Postgres transaction lock with trusted merger.
const SHA=/^[0-9a-f]{40}$/i;
const REPO='Priysharan19/Final-Pri-learning';
const DOMAIN='prilearning:trusted-main-authority';
const goodKey=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(x);
const ensure=(v,m)=>{if(!v)throw Error('PRI_SIGNER_DENIED_'+m)};
export function createSerializedSigner({store,authority,approve,runtime}){
  ensure(typeof store?.transaction==='function'&&typeof store?.queueEmergency==='function'
    && typeof store?.ackEmergency==='function','DURABLE_LOCK_NOT_AVAILABLE');
  ensure(typeof authority?.read==='function' && typeof authority?.apply==='function',
    'SIGNED_AUTHORITY_ADAPTER_MISSING');
  ensure(typeof approve==='function','INDEPENDENT_APPROVAL_VERIFIER_MISSING');
  ensure(runtime?.independentlyDeployed===true && runtime?.protectedMainSource===true
    && runtime?.sameLockAsMerger===true && runtime?.signedAuthorityInstalled===true,
    'LIVE_SIGNER_NOT_CERTIFIED');
  async function transact(req){
    ensure(req?.repository===REPO && goodKey(req.idempotency_key) &&
      Number.isSafeInteger(req.issue_number)&&req.issue_number>0 &&
      Number.isSafeInteger(req.pr_number)&&req.pr_number>0 &&
      ['GRANT','RENEW','RELEASE','REVOKE'].includes(req.operation) &&
      SHA.test(req.expected_main||'') && SHA.test(req.expected_authority||'') &&
      Number.isSafeInteger(req.approved_run_id) && req.approved_run_id>0,'EXACT_SIGNED_INTENT_REQUIRED');
    const revocation=req.operation==='REVOKE';
    const emergency={repository:REPO,pr_number:req.pr_number,
      idempotency_key:req.idempotency_key,event_authority:'verified-independent-emergency'};
    // Emergency barrier is durable BEFORE acquiring the shared lock. If the
    // signed revocation fails its queue stays pending to deny stale merges.
    if(revocation)await store.queueEmergency(emergency);
    return store.transaction(DOMAIN,async tx=>{
      ensure(tx.durable && tx.fenced && tx.sharedWithSigner,
        'DURABLE_SIGNER_MERGER_FENCE_MISSING');
      ensure(!(await tx.hasShutdown())||revocation,'EMERGENCY_SHUTDOWN_ACTIVE');
      if(!revocation)ensure(!(await tx.hasQueuedRevocation(req.pr_number)),
        'REVOCATION_PENDING');
      const independent=await approve(req,tx);
      ensure(independent?.decision==='INDEPENDENT_PROTECTED_RUN_APPROVED' &&
        independent.run_id===req.approved_run_id &&
        independent.main_sha===req.expected_main,
        'NO_GENUINE_INDEPENDENT_RUN_APPROVAL');
      const before=await authority.read(tx);
      ensure(before?.verified===true && before.main_sha===req.expected_main &&
        before.authority_head===req.expected_authority,
        'SIGNED_AUTHORITY_OR_MAIN_STALE');
      // The real adapter must execute the protected signer CAS and verify the
      // authentic GitHub result. The request cannot carry its own verdict.
      const result=await authority.apply(req,tx);
      ensure(result?.decision==='SIGNED_LEDGER_CAS_COMMITTED' &&
        result.operation===req.operation && result.issue_number===req.issue_number &&
        SHA.test(result.authority_head||''),'SIGNED_CAS_NOT_VERIFIED');
      const after=await authority.read(tx);
      ensure(after.verified===true && after.main_sha===req.expected_main &&
        after.authority_head===result.authority_head &&
        (after.authority_head!==before.authority_head || result.already_revoked===true),
        'POST_SIGNED_CAS_PROVENANCE_UNVERIFIED');
      await tx.audit({kind:revocation?'REVOCATION_SIGNED_CAS_CONFIRMED':'SIGNER_SIGNED_CAS_CONFIRMED',
        operation:req.operation,issue_number:req.issue_number,main_sha:req.expected_main,
        authority_before:before.authority_head,authority_after:result.authority_head});
      if(revocation)await store.ackEmergency(emergency);
      return {decision:'SIGNED_AUTHORITY_CONFIRMED',authority_head:after.authority_head,
        issue_number:req.issue_number,operation:req.operation};
    });
  }
  return {transact};
}
