// A trusted merger App is the SOLE ref updater. The signer worker and merger
// share an external durable serial transaction store. This is an executable
// fail-closed controller contract, NOT activated infrastructure.
// Never execute this module from candidate PR code or a writable PR workflow.
const REPOSITORY = 'Priysharan19/Final-Pri-learning';
const SHA = /^[0-9a-f]{40}$/i;
const MSG = 'PRI_SERIAL_MERGE_DENIED_';
const assert = (test, reason) => { if (!test) throw new Error(MSG + reason); };
const equal = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const safeId = id => typeof id==='string' && /^[A-Za-z0-9_-]{16,128}$/.test(id);
export const TRUSTED_MERGE_REPO = REPOSITORY;

// Fail closed unless GitHub itself restricts *all* updates to the exact
// independently governed merger App. A green check is not sufficient.
export function verifyExclusiveMainUpdate({rulesets, branchProtection, mergerAppId,
  signerAppId, verifierAppId}) {
  assert([mergerAppId,signerAppId,verifierAppId].every(Number.isSafeInteger) &&
    new Set([mergerAppId,signerAppId,verifierAppId]).size===3,
    'APP_IDENTITIES_NOT_INDEPENDENT');
  assert(Array.isArray(rulesets) && rulesets.length>0,'BRANCH_RULESETS_NOT_READ');
  const effective = rulesets.filter(r=>r.enforcement==='active' &&
    r.target==='branch' && r.conditions?.ref_name?.include?.includes('refs/heads/main') &&
    !r.conditions?.ref_name?.exclude?.includes('refs/heads/main'));
  const restricted=effective.filter(r=>r.rules?.some(x=>x.type==='update'));
  assert(restricted.length>0,'MAIN_UPDATES_NOT_EXCLUSIVE');
  for(const rule of restricted) {
    assert(equal(rule.bypass_actors,[{actor_id:mergerAppId,actor_type:'Integration',bypass_mode:'always'}]),
      'UNTRUSTED_UPDATE_BYPASS');
    assert(rule.rules.some(x=>x.type==='deletion') && rule.rules.some(x=>x.type==='non_fast_forward'),
      'UPDATE_RULESET_MISSING_IMMUTABILITY');
  }
  assert(branchProtection?.required_status_checks?.strict===true &&
    branchProtection?.required_pull_request_reviews?.required_approving_review_count>=1 &&
    branchProtection?.required_pull_request_reviews?.dismiss_stale_reviews===true &&
    branchProtection?.required_pull_request_reviews?.require_last_push_approval===true &&
    branchProtection?.enforce_admins?.enabled===true,
    'MAIN_BRANCH_PROTECTION_CHANGED');
  const checks=branchProtection.required_status_checks.checks;
  assert(Array.isArray(checks) && checks.some(c=>c.app_id===verifierAppId &&
    c.context==='Pri Trusted Governor / Source Authorization'),
    'DEDICATED_VERIFIER_CHECK_NOT_REQUIRED');
  assert(checks.every(c=>Number.isSafeInteger(c.app_id)&&c.app_id>0),
    'REQUIRED_CHECK_HAS_UNPINNED_APP');
  return {ruleset_ids:restricted.map(r=>r.id),merger_app:mergerAppId,
    signer_app:signerAppId,verifier_app:verifierAppId};
}

const recordError = err => String(err?.message||'UNKNOWN_FAILURE').replace(/[\r\n]/g,' ').slice(0,160);
function requireDependencies(deps) {
  for(const method of ['transaction','readReceipt','queueEmergency','ackEmergency','verifyDelivery'])
    assert(typeof deps.store?.[method]==='function','DURABLE_TRANSACTIONS_UNAVAILABLE');
  for(const method of ['read','merge','readMerged'])
    assert(typeof deps.github?.[method]==='function','GITHUB_READER_OR_MERGER_UNAVAILABLE');
  for(const method of ['read','revoke'])
    assert(typeof deps.authority?.[method]==='function','SIGNED_AUTHORITY_UNAVAILABLE');
  assert(typeof deps.evaluate==='function','INDEPENDENT_POLICY_EVALUATOR_UNAVAILABLE');
  assert(typeof deps.readRules==='function','TRUSTED_RULESET_READER_UNAVAILABLE');
  assert(deps.runtime?.independentlyDeployed===true &&
    deps.runtime?.trustedProtectedMain===true &&
    deps.runtime?.exclusiveMergerApp===true &&
    deps.runtime?.allSignerWritesSerialized===true &&
    deps.runtime?.verifiedAppPositiveAndUserNegative===true &&
    deps.runtime?.trustedCheckPublicationActive===true,
    'NOT_LIVE_CERTIFIED');
}
const requestShape = req => {
  assert(req?.repository===REPOSITORY && Number.isSafeInteger(req.pr_number) && req.pr_number>0 &&
    SHA.test(req.expected_head||'') && SHA.test(req.expected_main||'') &&
    safeId(req.delivery_id) && safeId(req.idempotency_key) &&
    req.event_authority==='verified-independent-intent',
    'INVALID_AUTHENTICATED_INTENT');
};
const sameRequest=(a,b)=>equal({repository:a.repository,pr_number:a.pr_number,
  expected_head:a.expected_head,expected_main:a.expected_main},
  {repository:b.repository,pr_number:b.pr_number,
  expected_head:b.expected_head,expected_main:b.expected_main});

// Signer and merger handlers MUST call store.transaction on the same durable
// lock domain; a GitHub check green before a later REVOKE is not an unlock.
export function createSerialMergeController(deps) {
  requireDependencies(deps);
  const domain='prilearning:trusted-main-authority';
  async function merge(req) {
    requestShape(req);
    return deps.store.transaction(domain,async tx=>{
      assert(tx.durable===true && tx.fenced===true && tx.sharedWithSigner===true,
        'NO_DURABLE_SHARED_LOCK');
      const previous=await deps.store.readReceipt(req.idempotency_key,tx);
      if(previous) {
        assert(sameRequest(previous.request,req),'IDEMPOTENCY_KEY_REPLAY_WITH_NEW_SOURCE');
        if(previous.state==='COMPLETED')return {...previous.result,idempotent:true};
        assert(previous.state==='PREPARED','UNEXPECTED_PERSISTED_MERGE_STATE');
        // GitHub can have merged successfully immediately before our process
        // crashed. Do not attempt the merge twice until it is reconciled.
        const remote=await deps.github.readMerged(req.pr_number,tx);
        if(remote.merged) {
          assert(remote.head_sha===req.expected_head &&
            remote.base_before===req.expected_main && SHA.test(remote.merge_commit_sha||''),
            'MERGED_REMOTE_SOURCE_NOT_MATCHING_PREPARED_INTENT');
          const result={decision:'MERGE_RECOVERED',merge_commit_sha:remote.merge_commit_sha,
            pr_number:req.pr_number,head_sha:req.expected_head,main_before:req.expected_main};
          await tx.complete(req.idempotency_key,result);await tx.audit({kind:'MERGE_RECOVERED',request:req,result});
          return result;
        }
        // A PREPARED event with no merge is treated as cancelled; any retry
        // must re-enter a fresh independently authorized intent and revalidate.
        await tx.deny(req.idempotency_key,'INTERRUPTED_MERGE_UNRESOLVED');
        throw Error(MSG+'INTERRUPTED_MERGE_REQUIRES_FRESH_AUTHORIZATION');
      }
      const delivery=await deps.store.verifyDelivery(req.delivery_id,tx);
      assert(delivery?.trusted_signature===true && delivery.repository===REPOSITORY &&
        delivery.pr_number===req.pr_number && delivery.head_sha===req.expected_head &&
        delivery.sender_type==='User' && typeof delivery.sender_login==='string',
        'WEBHOOK_DELIVERY_UNVERIFIED_OR_STALE');
      assert(!(await tx.hasShutdown()) && !(await tx.hasQueuedRevocation(req.pr_number)),
        'REVOCATION_OR_SHUTDOWN_PENDING');
      const rules=await deps.readRules();
      const physical=verifyExclusiveMainUpdate(rules);
      const current=await deps.github.read(req.pr_number,tx);
      assert(current.repo===REPOSITORY && current.pr_number===req.pr_number &&
        current.head===req.expected_head && current.main===req.expected_main &&
        current.base_ref==='main' && current.open===true && current.draft===false,
        'LIVE_PR_HEAD_OR_MAIN_CHANGED');
      const snapshot=await deps.authority.read(tx);
      assert(snapshot?.verified===true && SHA.test(snapshot.head||''),
        'SIGNER_LEDGER_UNVERIFIED');
      // The actual policy comes ONLY from protected-main code: current-head
      // human review, source provenance, manual scope, routes and required CI.
      const proof=await deps.evaluate({request:req,current,snapshot,physical,tx});
      assert(proof?.decision==='SOURCE_REVIEW_POLICY_VERIFIED' &&
        proof.head===req.expected_head && proof.main_sha===req.expected_main &&
        proof.authority_head===snapshot.head && proof.trusted_evaluator===true,
        'POLICY_NOT_INDEPENDENTLY_VERIFIED');
      assert(!(await tx.hasShutdown()) && !(await tx.hasQueuedRevocation(req.pr_number)),
        'REVOCATION_BEFORE_MERGE');
      // The token and App's ruleset bypass cannot come from this PR.
      const updated=await deps.github.read(req.pr_number,tx);
      const afterLedger=await deps.authority.read(tx);
      assert(updated.head===req.expected_head && updated.main===req.expected_main &&
        updated.repo===REPOSITORY && updated.open===true &&
        afterLedger.verified===true && afterLedger.head===snapshot.head,
        'AUTHORITY_OR_PR_CHANGED_AT_COMMIT_BOUNDARY');
      assert(!(await tx.hasShutdown()) && !(await tx.hasQueuedRevocation(req.pr_number)),
        'REVOCATION_AT_COMMIT_BOUNDARY');
      await tx.prepare(req.idempotency_key,req,{policy:proof,authority_head:snapshot.head});
      let merged;
      try {
        merged=await deps.github.merge({pr_number:req.pr_number,expected_head:req.expected_head,
          expected_main:req.expected_main,method:'merge',trustedAppId:physical.merger_app},tx);
      }catch(err) {
        // No blind retry, since GitHub may have committed then lost response.
        await tx.audit({kind:'MERGE_OUTCOME_UNKNOWN',request:req,error:recordError(err)});
        throw Error(MSG+'MERGE_RESULT_REQUIRES_RECONCILIATION');
      }
      assert(merged?.merged===true && SHA.test(merged.merge_commit_sha||''),
        'MERGE_RESULT_INVALID_RECONCILIATION_REQUIRED');
      const remote=await deps.github.readMerged(req.pr_number,tx);
      assert(remote.merged===true && remote.head_sha===req.expected_head &&
        remote.base_before===req.expected_main && remote.merge_commit_sha===merged.merge_commit_sha,
        'POST_MERGE_PROVENANCE_DIFFERENT');
      const result={decision:'TRUSTED_MERGE_CONFIRMED',pr_number:req.pr_number,
        head_sha:req.expected_head,main_before:req.expected_main,
        merge_commit_sha:merged.merge_commit_sha,authority_before:snapshot.head};
      await tx.complete(req.idempotency_key,result);
      await tx.audit({kind:'MERGE_COMMITTED',request:req,result});
      return result;
    });
  }
  async function revoke(req) {
    assert(req?.repository===REPOSITORY && Number.isSafeInteger(req.pr_number) && req.pr_number>0 &&
      safeId(req.idempotency_key) && req.event_authority==='verified-independent-emergency',
      'INVALID_AUTHENTICATED_REVOCATION');
    // Emergency intent must be durably queued *before* taking the shared lock.
    // A prior queued revocation bars a subsequent merge; an already acquired
    // merge lock linearizes before the revocation's eventual ledger append.
    await deps.store.queueEmergency(req);
    await deps.store.transaction(domain,async tx=>{
      assert(tx.durable===true && tx.fenced===true && tx.sharedWithSigner===true,
        'NO_DURABLE_SHARED_LOCK');
      const old=await deps.store.readReceipt(req.idempotency_key,tx);
      if(old) {
        assert(old.operation==='REVOKE' && old.state==='COMPLETED' &&
          old.request.pr_number===req.pr_number, 'REVOKE_IDEMPOTENCY_REPLAY');
        await deps.store.ackEmergency(req);
        return;
      }
      const result=await deps.authority.revoke(req,tx);
      assert(result?.committed===true && SHA.test(result.authority_head||''),
        'REVOCATION_NOT_SIGNED');
      await tx.complete(req.idempotency_key,
        {decision:'SIGNED_REVOCATION_CONFIRMED',authority_head:result.authority_head},req,'REVOKE');
      await tx.audit({kind:'REVOCATION_COMMITTED',request:req,result});
      await deps.store.ackEmergency(req);
    });
  }
  return {merge,revoke};
}
