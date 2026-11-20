import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validatePromotion, rehearsePromotion, promoteProduction, deploymentVerdict, intentDigest } from '../scripts/release-promotion.mjs';

const now = Date.parse('2026-11-20T00:00:00Z');
const at = new Date(now - 1000).toISOString();
const a = 'a'.repeat(40), b = 'b'.repeat(40), hash = 'c'.repeat(64);
const keys = [generateKeyPairSync('ed25519'), generateKeyPairSync('ed25519')];
function fixture(old = a, candidate = b) {
  const database = { engine: 'sqlite', schema: 17, billingSchema: 6, volumeId: 'fixture-volume', backupDigest: hash, restoreDigest: 'd'.repeat(64), rollbackCompatible: true };
  const manifest = { candidate, expectedOld: old, evidenceDigest: hash, stagingDeploymentId: 'fixture-staging', createdAt: at, expiresAt: new Date(now + 1000).toISOString(), database };
  const trust = { owner: { id: 'owner-fixture', key: keys[0].publicKey }, reviewer: { id: 'reviewer-fixture', key: keys[1].publicKey } };
  const digest = intentDigest(manifest);
  const approvals = ['owner', 'reviewer'].map((role, i) => {
    const row = { role, id: trust[role].id, decision: 'GO', digest, at };
    row.signature = sign(null, Buffer.from(JSON.stringify(['pri-promotion-approval-v1', role, row.id, row.decision, row.digest, row.at])), keys[i].privateKey).toString('base64'); return row;
  });
  const observed = { repository: 'Priysharan19/Final-Pri-learning', target: 'refs/heads/deploy/production', mainTip: candidate, oldPointer: old, fastForward: true, evidenceDigest: hash, checkedAt: at, dossier: { sha: candidate, verdict: 'GO-READY', nomination: { ok: true }, rows: [{ ok: true }] }, mainIntegrity: true, requiredChecks: true, independentHeadReview: true, stagingProof: true, staging: { deploymentId: 'fixture-staging', healthSha: candidate, readySha: candidate, webSha: candidate, ready: true, engine: 'postgres' }, database: { ...database, backupVerified: true, restoreVerified: true, checkedAt: at }, protectedEnvironmentApproved: true, environmentApprovalDigest: digest, environmentReviewerId: trust.reviewer.id };
  return { manifest, observed, approvals, trust, now };
}
test('valid synthetic exact-bound two-party intent', () => assert.equal(validatePromotion(fixture()).candidate, b));
for (const [name, mutate] of Object.entries({
  'wrong SHA': x => x.manifest.candidate = a,
  'old pointer changed': x => x.observed.oldPointer = b,
  'not fast forward': x => x.observed.fastForward = false,
  'main moved': x => x.observed.mainTip = a,
  'stale observations': x => x.observed.checkedAt = '2020-01-01T00:00:00Z',
  'expired intent': x => x.manifest.expiresAt = at,
  'stale dossier': x => x.observed.dossier.sha = a,
  'red dossier': x => x.observed.dossier.verdict = 'NO-GO',
  'failed Main Integrity': x => x.observed.mainIntegrity = false,
  'missing CI': x => x.observed.requiredChecks = false,
  'missing head review': x => x.observed.independentHeadReview = false,
  'missing staging proof': x => x.observed.stagingProof = false,
  'wrong staging web': x => x.observed.staging.webSha = a,
  'wrong staging schema engine': x => x.observed.staging.engine = 'sqlite',
  'no restore': x => x.observed.database.restoreVerified = false,
  'backup changed': x => x.observed.database.backupDigest = 'f'.repeat(64),
  'rollback incompatible': x => x.manifest.database.rollbackCompatible = false,
  'forged signature': x => x.approvals[0].signature = x.approvals[1].signature,
  'same approver': x => x.trust.reviewer.id = x.trust.owner.id,
  'same approval key': x => x.trust.reviewer.key = x.trust.owner.key,
  'missing reviewer': x => x.approvals.pop(),
  'wrong signed digest': x => x.approvals[0].digest = 'f'.repeat(64),
  'wrong approval time': x => x.approvals[0].at = '2020-01-01T00:00:00Z',
  'missing environment approval': x => x.observed.protectedEnvironmentApproved = false,
  'environment approves different intent': x => x.observed.environmentApprovalDigest = 'f'.repeat(64)
})) test('reject ' + name, () => { const x = fixture(); mutate(x); assert.throws(() => validatePromotion(x)); });

test('production entry point hard-disabled', () => assert.throws(() => promoteProduction(fixture()), /disabled/));
test('real disposable Git push: non-force exact-old acceptance, stale replay denied, divergent commit denied', () => {
  const root = mkdtempSync(join(tmpdir(), 'pri-promotion-test-')); const source = join(root, 'source'), remote = join(root, 'receiver');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    mkdirSync(source); mkdirSync(remote); git(source, 'init', '-q'); git(remote, 'init', '--bare', '-q');
    git(source, 'config', 'user.name', 'Fixture'); git(source, 'config', 'user.email', 'fixture@example.test');
    git(source, 'commit', '--allow-empty', '-qm', 'old'); const old = git(source, 'rev-parse', 'HEAD');
    git(source, 'push', remote, 'HEAD:refs/heads/fixture-production');
    git(source, 'commit', '--allow-empty', '-qm', 'new'); const candidate = git(source, 'rev-parse', 'HEAD');
    const request = { ...fixture(old, candidate), source, remote };
    assert.equal(rehearsePromotion(request).candidate, candidate);
    assert.throws(() => rehearsePromotion(request), /pointer race/);
    git(source, 'checkout', '--detach', old); git(source, 'commit', '--allow-empty', '-qm', 'divergent'); const divergent = git(source, 'rev-parse', 'HEAD');
    assert.throws(() => rehearsePromotion({ ...fixture(candidate, divergent), source, remote }), /merge-base/);
    assert.equal(git(remote, 'rev-parse', 'refs/heads/fixture-production'), candidate);
    git(source, 'checkout', '--detach', candidate); git(source, 'commit', '--allow-empty', '-qm', 'concurrent'); const concurrent = git(source, 'rev-parse', 'HEAD');
    git(source, 'push', remote, concurrent + ':refs/heads/fixture-race');
    git(source, 'checkout', '--detach', candidate); git(source, 'commit', '--allow-empty', '-qm', 'approved next'); const next = git(source, 'rev-parse', 'HEAD');
    // Receiver changes the pointer AFTER sender advertised/read the old OID,
    // but before receive-pack commits its ref transaction. This must reject.
    writeFileSync(join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nset -eu\nunset GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES\ngit update-ref refs/heads/fixture-production ' + concurrent + ' ' + candidate + '\n', { mode: 0o700 });
    assert.throws(() => rehearsePromotion({ ...fixture(candidate, next), source, remote }), /push/);
    assert.equal(git(remote, 'rev-parse', 'refs/heads/fixture-production'), concurrent);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('postdeploy failure freezes, no automatic rollback', () => {
  const p = { deploymentState: 'SUCCESS', service: 'Final-Pri-learning', environment: 'production', deploymentId: 'fixture', deploymentSha: b, healthSha: b, readySha: b, webSha: b, ready: true, schemaCompatible: true, persistenceVerified: true, studentSmoke: true };
  assert.deepEqual(deploymentVerdict(b, p), { ok: true, freeze: false, autoRollback: false });
  for (const change of [{ webSha: a }, { deploymentState: 'FAILED' }, { schemaCompatible: false }, { studentSmoke: false }, { persistenceVerified: false }]) assert.deepEqual(deploymentVerdict(b, { ...p, ...change }), { ok: false, freeze: true, autoRollback: false });
});

// GitHub REST fixtures: observations must be independently reconstructed from
// API payloads, rather than allowing submitted records to assert green flags.
import { observeGitHubRelease, observeEnvironmentApproval, releaseEvidenceDigest } from '../scripts/release-promotion-github.mjs';
const repoId = 1341661316, head = 'd'.repeat(40), earlier = '2026-11-19T22:00:00Z', merged = '2026-11-19T23:00:00Z', after = '2026-11-19T23:30:00Z';
function githubFixture() {
  const repos = { repository: { id: repoId }, head_repository: { id: repoId } };
  function run(id,path,sha = b,branch = 'main',event = 'push',time = after) { return { ...repos, id, workflow_id: id, path: '.github/workflows/' + path + '.yml', head_sha: sha, head_branch: branch, event, status: 'completed', conclusion: 'success', updated_at: time, created_at: time }; }
  const runs = [run(1,'ci'),run(2,'codeql'),run(3,'deployment-image'),run(4,'main-integrity'),run(5,'release-staging-proof',b,'main','workflow_run','2026-11-19T23:40:00Z')];
  const prRuns = [run(6,'ci',head,'task/train-fixture','pull_request',earlier),run(7,'codeql',head,'task/train-fixture','pull_request',earlier)];
  const checkNames = ['Suites, coverage and accuracy gates','Production account, sync and commercial schema','Browser suites (end-to-end and accessibility)','Client build and offline-first boundary','Build container and prove persistent health'];
  const checks = checkNames.map((name,i)=>({id:20+i,name,head_sha:b,app:{slug:'github-actions'},status:'completed',conclusion:'success'}));
  const reviews = [{id:30,user:{id:2,type:'User',login:'reviewer-fixture'},state:'APPROVED',submitted_at:earlier,commit_id:head}];
  const artifacts = [{id:40,name:'staging-proof-5',expired:false,digest:'sha256:' + hash}];
  const environmentRun = {...run(50,'production-promotion',b,'main','workflow_dispatch'),run_attempt:1,status:'in_progress',actor:{id:1},triggering_actor:{id:1},display_title:'Production Promotion · ' + hash};
  const history = [{environments:[{name:'production'}],state:'approved',user:{id:2,type:'User'}}];
  const data = {
    'branches/main':{name:'main',protected:true,commit:{sha:b}}, 'branches/deploy/production':{name:'deploy/production',protected:true,commit:{sha:a}},
    ['compare/'+a+'...'+b]:{status:'ahead',merge_base_commit:{sha:a},behind_by:0,ahead_by:1},
    ['commits/'+b+'/pulls?per_page=100']:[{number:9,user:{id:1},merge_commit_sha:b,merged_at:merged,base:{ref:'main',repo:{id:repoId}},head:{sha:head,ref:'task/train-fixture',repo:{id:repoId}}}],
    ['actions/runs?head_sha='+b+'&per_page=100']:{total_count:runs.length,workflow_runs:runs},
    ['actions/runs?head_sha='+head+'&event=pull_request&per_page=100']:{total_count:prRuns.length,workflow_runs:prRuns},
    ['commits/'+b+'/check-runs?filter=latest&per_page=100']:{total_count:checks.length,check_runs:checks},
    'pulls/9/reviews?per_page=100':reviews,'collaborators/reviewer-fixture/permission':{permission:'write',user:{id:2}},
    'actions/runs/5/artifacts?per_page=100':{total_count:1,artifacts},'actions/runs/50':environmentRun,'actions/runs/50/approvals':history
  };
  const read = async p => { assert.ok(Object.hasOwn(data,p), 'unexpected read ' + p); return structuredClone(data[p]); };
  return {data,runs,prRuns,checks,reviews,artifacts,environmentRun,history,read};
}
test('read-only GitHub verifies exact train, check contexts, independent review and artifact', async()=>{
  const f=githubFixture(); const o=await observeGitHubRelease({candidate:b,expectedOld:a,read:f.read});
  assert.equal(o.provenance.reviewId,30); assert.equal(o.provenance.artifact,40);
  assert.notEqual(releaseEvidenceDigest(o.provenance,hash),releaseEvidenceDigest(o.provenance,'e'.repeat(64)));
});
for(const [name,mutate] of Object.entries({
  'source branch no longer frozen':f=>f.data['branches/main'].commit.sha=a,
  'staging workflow spoofed':f=>f.runs[4].head_repository.id=99,
  'required check skipped':f=>f.checks[0].conclusion='skipped',
  'check from another app':f=>f.checks[0].app.slug='untrusted',
  'late train workflow completion':f=>f.prRuns[0].updated_at=after,
  'failed train workflow':f=>f.prRuns[1].conclusion='failure',
  'review by author':f=>f.reviews[0].user.id=1,
  'review on stale head':f=>f.reviews[0].commit_id=a,
  'review after merge':f=>f.reviews[0].submitted_at=after,
  'comment not approval':f=>f.reviews[0].state='COMMENTED',
  'Main Integrity red':f=>f.runs[3].conclusion='failure',
  'staging proof skipped':f=>f.runs[4].conclusion='skipped',
  'expired proof artifact':f=>f.artifacts[0].expired=true,
  'absent artifact digest':f=>delete f.artifacts[0].digest,
  'truncated evidence':f=>f.data['actions/runs?head_sha='+b+'&per_page=100'].total_count=999
})) test('GitHub rejects '+name,async()=>{const f=githubFixture();mutate(f);await assert.rejects(observeGitHubRelease({candidate:b,expectedOld:a,read:f.read}));});
test('environment approval bound to actual run and separate reviewer',async()=>{
  const f=githubFixture(); const o=await observeEnvironmentApproval({candidate:b,digest:hash,runId:50,ownerId:1,reviewerId:2,read:f.read});assert.equal(o.environmentReviewerId,2);
  for(const mutate of [x=>x.environmentRun.run_attempt=2,x=>x.environmentRun.display_title='wrong',x=>x.history[0].user.id=1,x=>x.history[0].state='rejected',x=>x.history.length=0]) { const y=githubFixture();mutate(y);await assert.rejects(observeEnvironmentApproval({candidate:b,digest:hash,runId:50,ownerId:1,reviewerId:2,read:y.read})); }
});
