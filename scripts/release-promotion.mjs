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
export async function preparePromotion({ manifest, approvals, trust, readObservations, dossierOptions }) {
  const { buildDossier } = await import('./release-dossier.mjs');
  const dossier = await buildDossier({ ...dossierOptions, sha: manifest.candidate });
  const observed = await readObservations(manifest.candidate, dossier);
  return validatePromotion({ manifest, approvals, trust, observed: { ...observed, dossier } });
}

// Deliberately hard-disabled, even if env vars or record fields request activation.
export function promoteProduction() { fail('production promotion disabled: independent review and administrator activation required'); }

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
  require(git(['rev-parse', FIXTURE], remote) === approved.expectedOld, 'fixture pointer race');
  git(['merge-base', '--is-ancestor', approved.expectedOld, approved.candidate]);
  const hooks = mkdtempSync(join(temp, 'pri-promotion-hook-'));
  try {
    writeFileSync(join(hooks, 'pre-push'), '#!/bin/sh\nset -eu\ncount=0\nwhile read -r local_ref local_oid remote_ref remote_oid; do\n  [ "$local_oid" = "' + approved.candidate + '" ] && [ "$remote_ref" = "' + FIXTURE + '" ] && [ "$remote_oid" = "' + approved.expectedOld + '" ] || exit 1\n  count=$((count+1))\ndone\n[ "$count" -eq 1 ]\n', { mode: 0o700 });
    git(['-c', 'core.hooksPath=' + hooks, 'push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', remote, approved.candidate + ':' + FIXTURE]);
    require(git(['rev-parse', FIXTURE], remote) === approved.candidate, 'fixture post-push identity mismatch');
    return approved;
  } finally { rmSync(hooks, { recursive: true, force: true }); }
}

// Post-deployment check: failure freezes further releases, never rewinds a ref
// or restores a database. Caller must page the operator and assess compatibility.
export function deploymentVerdict(candidate, proof) {
  const ok = SHA.test(candidate) && proof?.deploymentState === 'SUCCESS' && proof.service === 'Final-Pri-learning' && proof.environment === 'production' && typeof proof.deploymentId === 'string' && proof.deploymentId.length > 0 && proof.deploymentSha === candidate && proof.healthSha === candidate && proof.readySha === candidate && proof.webSha === candidate && proof.ready === true && proof.schemaCompatible === true && proof.persistenceVerified === true && proof.studentSmoke === true;
  return { ok: !!ok, freeze: !ok, autoRollback: false };
}
