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
