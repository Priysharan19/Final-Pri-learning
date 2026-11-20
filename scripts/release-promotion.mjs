// Issue #623: disabled release boundary. No CLI, network writer, token lookup,
// Railway invocation or production ref mutation. A later independently reviewed
// activation must supply trusted GitHub/host observations and a protected writer.
import { createHash, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { realpathSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REPO = 'Priysharan19/Final-Pri-learning';
const TARGET = 'refs/heads/deploy/production';
const FIXTURE = 'refs/heads/fixture-production';
const MAX_AGE = 15 * 60_000;
const MAX_INTENT = 60 * 60_000;
const fail = msg => { throw new Error(msg); };
const require = (ok, msg) => { if (!ok) fail(msg); };
const iso = v => typeof v === 'string' ? Date.parse(v) : NaN;
const fresh = (v, now, limit = MAX_AGE) => Number.isFinite(iso(v)) && iso(v) <= now && now - iso(v) <= limit;
const dbFields = d => [d?.engine, d?.schema, d?.billingSchema, d?.volumeId, d?.backupDigest, d?.restoreDigest, d?.rollbackCompatible];
const intentBytes = m => Buffer.from(JSON.stringify(['pri-promotion-v1', REPO, TARGET, m.candidate, m.expectedOld, m.evidenceDigest, m.stagingDeploymentId, m.createdAt, m.expiresAt, ...dbFields(m.database)]));
export const intentDigest = m => createHash('sha256').update(intentBytes(m)).digest('hex');

// All observations must originate from a trusted, read-only adapter, never a
// workflow_dispatch flag or a submitted manifest. Existing buildDossier() is
// the nomination/soak/owner-GO authority; do not replace its gates with this.
// Public keys and their identities must be supplied by protected runtime config,
// never by the manifest. No production keys are provisioned by this module.
export function validatePromotion({ manifest: m, observed: o, approvals, trust, now = Date.now() }) {
  require(m && o && trust && Array.isArray(approvals), 'missing promotion evidence');
  require(SHA.test(m.candidate) && SHA.test(m.expectedOld) && m.candidate !== m.expectedOld, 'invalid candidate or old pointer');
  require(DIGEST.test(m.evidenceDigest) && m.evidenceDigest === o.evidenceDigest, 'evidence digest mismatch');
  require(fresh(m.createdAt, now, MAX_INTENT) && iso(m.expiresAt) > now && iso(m.expiresAt) - iso(m.createdAt) <= MAX_INTENT, 'expired or invalid intent');
  require(fresh(o.checkedAt, now), 'stale live observations');
  require(o.repository === REPO && o.target === TARGET && o.mainTip === m.candidate && o.oldPointer === m.expectedOld && o.fastForward === true, 'wrong repository, main, pointer or ancestry');
  require(o.dossier?.sha === m.candidate && o.dossier.verdict === 'GO-READY' && o.dossier.nomination?.ok === true && Array.isArray(o.dossier.rows) && o.dossier.rows.length > 0 && o.dossier.rows.every(r => r.ok === true || r.ok === null), 'existing dossier is not GO-ready');
  require(o.mainIntegrity === true && o.requiredChecks === true && o.independentHeadReview === true && o.stagingProof === true, 'missing exact-source gate');
  require(typeof m.stagingDeploymentId === 'string' && m.stagingDeploymentId.length > 0 && o.staging?.deploymentId === m.stagingDeploymentId && o.staging.healthSha === m.candidate && o.staging.readySha === m.candidate && o.staging.webSha === m.candidate && o.staging.ready === true && o.staging.engine === 'postgres', 'staging identity/readiness mismatch');
  const d = m.database;
  require(['sqlite', 'postgres'].includes(d?.engine) && Number.isSafeInteger(d.schema) && d.schema > 0 && Number.isSafeInteger(d.billingSchema) && d.billingSchema > 0 && typeof d.volumeId === 'string' && d.volumeId.length > 0 && DIGEST.test(d.backupDigest) && DIGEST.test(d.restoreDigest) && d.rollbackCompatible === true, 'missing backup, restore or rollback proof');
  require(JSON.stringify(dbFields(d)) === JSON.stringify(dbFields(o.database)) && o.database?.backupVerified === true && o.database?.restoreVerified === true && fresh(o.database.checkedAt, now), 'production database evidence changed or stale');
  const digest = intentDigest(m);
  require(approvals.length === 2 && trust.owner?.id && trust.reviewer?.id && trust.owner.id !== trust.reviewer.id && trust.owner.key && trust.reviewer.key, 'independent approval identities required');
  const keyId = k => { require(k?.type === 'public' && k.asymmetricKeyType === 'ed25519', 'trusted Ed25519 public key required'); return k.export({ type: 'spki', format: 'der' }).toString('hex'); };
  require(keyId(trust.owner.key) !== keyId(trust.reviewer.key), 'independent approval keys required');
  for (const role of ['owner', 'reviewer']) {
    const a = approvals.find(a => a.role === role);
    require(a && a.id === trust[role].id && a.decision === 'GO' && a.digest === digest && fresh(a.at, now, MAX_INTENT) && iso(a.at) >= iso(m.createdAt), 'missing, stale or mismatched ' + role + ' approval');
    const bytes = Buffer.from(JSON.stringify(['pri-promotion-approval-v1', role, a.id, a.decision, a.digest, a.at]));
    require(typeof a.signature === 'string' && verify(null, bytes, trust[role].key, Buffer.from(a.signature, 'base64')), 'invalid ' + role + ' signature');
  }
  // Signatures are necessary but not a substitute for actual protected-environment
  // approval. Activation must authenticate this independently from GitHub.
  require(o.protectedEnvironmentApproved === true && o.environmentApprovalDigest === digest && o.environmentReviewerId === trust.reviewer.id, 'missing independent protected-environment approval');
  return { candidate: m.candidate, expectedOld: m.expectedOld, digest };
}

// Read-only composition with the existing release dossier, not a replacement.
// Activation will need the trusted observation adapter, including authenticated
// protected-environment approval and immutable artifact/backup provenance.
export async function preparePromotion({ manifest, approvals, trust, readObservations, dossierOptions, runId, read }) {
  const { buildDossier } = await import('./release-dossier.mjs');
  const { observeGitHubRelease, observeEnvironmentApproval, releaseEvidenceDigest } = await import('./release-promotion-github.mjs');
  const dossier = await buildDossier({ ...dossierOptions, sha: manifest.candidate });
  const github = await observeGitHubRelease({ candidate: manifest.candidate, expectedOld: manifest.expectedOld, read });
  const observed = await readObservations(manifest.candidate, dossier, github.provenance);
  const { observeIndiaCoreHost } = await import('./release-promotion-host.mjs');
  const staging = await observeIndiaCoreHost({ candidate: manifest.candidate, role: 'staging', metadata: observed.stagingDeployment });
  const environment = await observeEnvironmentApproval({ candidate: manifest.candidate, digest: intentDigest(manifest), runId, ownerId: trust.owner.id, reviewerId: trust.reviewer.id, read });
  const evidenceDigest = releaseEvidenceDigest(github.provenance, observed.externalEvidenceDigest);
  return validatePromotion({ manifest, approvals, trust, observed: { ...observed, ...github, ...environment, staging, dossier, evidenceDigest } });
}

// Deliberately hard-disabled. A separate reviewed activation must establish the
// protected environment, trusted runtime and the scoped App token issuer.
const PRODUCTION_ACTIVATED = false;
const PRODUCTION_REMOTE = 'https://github.com/Priysharan19/Final-Pri-learning.git';
export function promoteProduction(options = {}) {
  require(PRODUCTION_ACTIVATED, 'production promotion disabled: independent review and administrator activation required');
  return options.withReleaseLock(() => runPromotionAttempt({
    prepare: () => preparePromotion(options),
    write: approved => writeProductionPointer(approved, options),
    observe: async approved => {
      const { observeIndiaCoreHost } = await import('./release-promotion-host.mjs');
      const facts = await options.waitForProduction(approved.candidate);
      const proof = await observeIndiaCoreHost({ candidate: approved.candidate, role: 'production', metadata: facts.deployment });
      return { ...proof, studentSmoke: facts.studentSmoke === true };
    },
    audit: options.audit,
    freeze: options.freezeAndAlert
  }));
}

// The same state transition used in the disposable rehearsal. A failed audit
// before the write blocks it. After an attempted write, every uncertainty
// freezes releases and asks the operator to assess recovery. No automatic
// retry, ref reversal, database restore or guessed success.
export async function runPromotionAttempt({ prepare, write, observe, audit, freeze }) {
  require([prepare, write, observe, audit, freeze].every(f => typeof f === 'function'), 'missing trusted release operator adapter');
  const approved = await prepare();
  require(approved && SHA.test(approved.candidate) && SHA.test(approved.expectedOld) && approved.candidate !== approved.expectedOld && DIGEST.test(approved.digest), 'invalid approved release intent');
  const event = phase => ({ phase, candidate: approved.candidate, expectedOld: approved.expectedOld, digest: approved.digest, at: new Date().toISOString() });
  await audit(event('PREPARED'));
  let phase = 'POINTER_ATTEMPT';
  try {
    require(await write(approved) === approved.candidate, 'pointer not verified');
    phase = 'POINTER_CONFIRMED';
    await audit(event(phase));
    const proof = await observe(approved);
    require(deploymentVerdict(approved.candidate, proof).ok, 'deployment verification failed');
    phase = 'DEPLOYMENT_VERIFIED';
    await audit({ ...event(phase), deploymentId: proof.deploymentId });
    return { ok: true, ...approved, deploymentId: proof.deploymentId };
  } catch {
    // Both calls are attempted even if the other throws. Do not log raw provider
    // errors or credentials; a failed alert is itself an operator-visible stop.
    const record = { ...event('FROZEN'), failedPhase: phase, autoRollback: false };
    const outcomes = await Promise.allSettled([Promise.resolve().then(() => freeze(record)), Promise.resolve().then(() => audit(record))]);
    fail(outcomes.some(r => r.status === 'rejected') ? 'release stopped; freeze/alert or audit failed: manual incident action required' : 'release stopped and frozen; independent rollback assessment required');
  }
}

// No production operation is reachable while PRODUCTION_ACTIVATED is false.
// The protected job must supply a fresh read-only credential and mint the
// narrowly scoped, expiring installation token only after prepare + audit.
async function writeProductionPointer(approved, { readToken, openWriter }) {
  const temp = mkdtempSync(join(realpathSync(tmpdir()), 'pri-release-source-'));
  const askpass = join(temp, 'askpass');
  const credential = t => typeof t === 'string' && /^[A-Za-z0-9_]+$/.test(t) && t.length >= 20;
  const gitWith = token => args => execFileSync('git', args, { cwd: temp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, env: { PATH: process.env.PATH, HOME: temp, LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: askpass, PRI_RELEASE_TOKEN: token } }).trim();
  let writer = null;
  try {
    require(credential(readToken) && typeof openWriter === 'function', 'missing read-only credential or protected token issuer');
    writeFileSync(askpass, '#!/bin/sh\ncase "$1" in *Username*) printf "%s\\n" x-access-token ;; *Password*) printf "%s\\n" "$PRI_RELEASE_TOKEN" ;; *) exit 1 ;; esac\n', { mode: 0o700 });
    const readGit = gitWith(readToken);
    readGit(['init', '--bare', '--quiet']);
    readGit(['fetch', '--no-tags', '--no-recurse-submodules', PRODUCTION_REMOTE, 'refs/heads/main:refs/heads/release-source', TARGET + ':refs/heads/previous-prod']);
    require(readGit(['rev-parse', 'refs/heads/release-source']) === approved.candidate && readGit(['rev-parse', 'refs/heads/previous-prod']) === approved.expectedOld, 'source or pointer shifted after approval');
    readGit(['merge-base', '--is-ancestor', approved.expectedOld, approved.candidate]);
    writer = await openWriter(approved);
    require(credential(writer?.token) && writer.repository === REPO && writer.permissions?.contents === 'write' && typeof writer.close === 'function' && iso(writer.expiresAt) > Date.now() && iso(writer.expiresAt) - Date.now() <= MAX_INTENT, 'missing scoped short-lived release token');
    return exactGitPush({ git: gitWith(writer.token), remote: PRODUCTION_REMOTE, target: TARGET, approved });
  } finally {
    try { if (typeof writer?.close === 'function') await writer.close(); }
    finally { rmSync(temp, { recursive: true, force: true }); }
  }
}

// Real Git transport rehearsal ONLY, confined to local temporary repositories.
// The pre-push hook validates the old OID advertised by receive-pack. The Git
// protocol then performs its own atomic old-OID check. Never pass --force or
// --force-with-lease: an ordinary push must also enforce fast-forward ancestry.
export function rehearsePromotion({ source, remote, manifest, observed, approvals, trust, now }) {
  const approved = validatePromotion({ manifest, observed, approvals, trust, now });
  const temp = realpathSync(tmpdir());
  const contained = p => { const absolute = realpathSync(p); const rel = relative(temp, absolute); require(rel && !rel.startsWith('..') && !isAbsolute(rel), 'fixture must be under temporary storage'); return absolute; };
  source = contained(source); remote = contained(remote);
  const git = (args, cwd = source) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  require(git(['rev-parse', '--is-bare-repository'], remote) === 'true', 'fixture receiver must be bare');
  exactGitPush({ git, remote, target: FIXTURE, approved });
  return approved;
}

// Private shared transport. The approved old OID must match both a fresh
// advertisement and the pre-push hook. receive-pack checks that same old OID
// within the ref transaction. There is no force flag or retry path.
function exactGitPush({ git, remote, target, approved }) {
  require(target === FIXTURE || target === TARGET, 'unexpected ref target');
  const pointer = () => git(['ls-remote', '--refs', remote, target]);
  require(pointer() === approved.expectedOld + '\t' + target, 'pointer race');
  git(['merge-base', '--is-ancestor', approved.expectedOld, approved.candidate]);
  const hooks = mkdtempSync(join(realpathSync(tmpdir()), 'pri-promotion-hook-'));
  try {
    writeFileSync(join(hooks, 'pre-push'), '#!/bin/sh\nset -eu\ncount=0\nwhile read -r local_ref local_oid remote_ref remote_oid; do\n  [ "$local_oid" = "' + approved.candidate + '" ] && [ "$remote_ref" = "' + target + '" ] && [ "$remote_oid" = "' + approved.expectedOld + '" ] || exit 1\n  count=$((count+1))\ndone\n[ "$count" -eq 1 ]\n', { mode: 0o700 });
    git(['-c', 'core.hooksPath=' + hooks, 'push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', remote, approved.candidate + ':' + target]);
    require(pointer() === approved.candidate + '\t' + target, 'post-push identity mismatch');
    return approved.candidate;
  } finally { rmSync(hooks, { recursive: true, force: true }); }
}

// Post-deployment check: failure freezes further releases, never rewinds a ref
// or restores a database. Caller must page the operator and assess compatibility.
export function deploymentVerdict(candidate, proof) {
  const ok = SHA.test(candidate) && proof?.deploymentState === 'SUCCESS' && proof.service === 'Final-Pri-learning' && proof.environment === 'production' && typeof proof.deploymentId === 'string' && proof.deploymentId.length > 0 && proof.deploymentSha === candidate && proof.healthSha === candidate && proof.readySha === candidate && proof.webSha === candidate && proof.ready === true && proof.schemaCompatible === true && proof.persistenceVerified === true && proof.studentSmoke === true;
  return { ok: !!ok, freeze: !ok, autoRollback: false };
}
