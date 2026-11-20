// Issue #623: read-only GitHub evidence adapter. No write API or credentials
// passed to candidate code. Only the protected release host may call this.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const REPO = 'Priysharan19/Final-Pri-learning';
const ID = 1341661316;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const required = ['Suites, coverage and accuracy gates', 'Production account, sync and commercial schema', 'Browser suites (end-to-end and accessibility)', 'Client build and offline-first boundary', 'Build container and prove persistent health'];
const insist = (truth, reason) => { if (!truth) throw new Error(reason); };
export const readGitHub = async path => JSON.parse(execFileSync('gh', ['api', '--method', 'GET', 'repos/' + REPO + '/' + path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
const direct = async (read, path, key) => {
  const data = await read(path + (path.includes('?') ? '&' : '?') + 'per_page=100');
  insist(Array.isArray(data[key]) && Number.isSafeInteger(data.total_count) && data.total_count === data[key].length, 'missing or incomplete ' + key);
  return data[key];
};
// List APIs without total_count: exactly 100 may be truncated, so deny rather
// than silently discard an older rejection or another merge/review.
const smallList = async (read, path) => { const rows = await read(path + '?per_page=100'); insist(Array.isArray(rows) && rows.length < 100, 'incomplete GitHub evidence list'); return rows; };
const sameRepo = r => r?.repository?.id === ID && r?.head_repository?.id === ID;
const terminal = r => r.status === 'completed' && r.conclusion === 'success';
function latest(runs, path, sha, branch, events) {
  const rows = runs.filter(r => r.path === path && r.head_sha === sha && r.head_branch === branch && events.includes(r.event) && sameRepo(r));
  insist(rows.length > 0, 'missing trusted workflow ' + path);
  rows.sort((a,b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id);
  const r = rows[0];
  insist(terminal(r) && Number.isSafeInteger(r.id) && Number.isFinite(Date.parse(r.updated_at)), 'workflow not green: ' + path);
  return r;
}
export async function observeGitHubRelease({ candidate, expectedOld, read = readGitHub }) {
  insist(typeof candidate === 'string' && typeof expectedOld === 'string' && SHA.test(candidate) && SHA.test(expectedOld) && candidate !== expectedOld, 'invalid candidate/old pointer');
  const [main, prod, comparison, prs] = await Promise.all([read('branches/main'), read('branches/deploy/production'), read('compare/' + expectedOld + '...' + candidate), smallList(read, 'commits/' + candidate + '/pulls')]);
  insist(main.name === 'main' && main.protected === true && main.commit?.sha === candidate && prod.name === 'deploy/production' && prod.protected === true && prod.commit?.sha === expectedOld, 'branch identity or protection changed');
  insist(comparison.status === 'ahead' && comparison.merge_base_commit?.sha === expectedOld && comparison.behind_by === 0 && comparison.ahead_by > 0, 'candidate is not a strict fast-forward');
  const matches = prs.filter(p => p.merge_commit_sha === candidate && p.merged_at && p.base?.ref === 'main' && p.base.repo?.id === ID && p.head?.repo?.id === ID && p.head.ref?.startsWith('task/train-') && SHA.test(p.head.sha));
  insist(matches.length === 1, 'no unique protected train merge');
  const p = matches[0];
  insist(Number.isSafeInteger(p.number) && Number.isSafeInteger(p.user?.id) && Number.isFinite(Date.parse(p.merged_at)), 'invalid merge metadata');
  const [runs, prRuns, checks, reviews] = await Promise.all([direct(read,'actions/runs?head_sha=' + candidate,'workflow_runs'), direct(read,'actions/runs?head_sha=' + p.head.sha + '&event=pull_request','workflow_runs'), direct(read,'commits/' + candidate + '/check-runs?filter=latest','check_runs'), smallList(read,'pulls/' + p.number + '/reviews')]);
  const checkIds = required.map(name => {
    const found = checks.filter(c => c.name === name && c.head_sha === candidate && c.app?.slug === 'github-actions');
    insist(found.length === 1 && terminal(found[0]) && Number.isSafeInteger(found[0].id), 'missing or failing required check: ' + name);
    return found[0].id;
  });
  const own = prRuns.filter(r => sameRepo(r) && r.head_sha === p.head.sha && r.head_branch === p.head.ref && r.event === 'pull_request');
  const byWorkflow = new Map();
  for (const run of own.sort((a,b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.id - b.id)) byWorkflow.set(run.workflow_id,run);
  insist(byWorkflow.size > 0 && [...byWorkflow.values()].every(r => r.status === 'completed' && ['success','skipped','neutral'].includes(r.conclusion) && Date.parse(r.updated_at) <= Date.parse(p.merged_at)), 'train had late, failed or incomplete workflow evidence');
  latest(own,'.github/workflows/ci.yml',p.head.sha,p.head.ref,['pull_request']);
  latest(own,'.github/workflows/codeql.yml',p.head.sha,p.head.ref,['pull_request']);
  const latestReviews = new Map();
  for (const review of reviews.filter(v => ['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(v.state)).sort((a,b) => Date.parse(a.submitted_at)-Date.parse(b.submitted_at) || a.id-b.id)) latestReviews.set(review.user?.id,review);
  let independent = null;
  for (const v of latestReviews.values()) {
    if (v.state !== 'APPROVED' || v.commit_id !== p.head.sha || v.user?.type !== 'User' || !Number.isSafeInteger(v.user.id) || v.user.id === p.user.id || !/^[A-Za-z0-9-]+$/.test(v.user.login || '') || !(Date.parse(v.submitted_at) <= Date.parse(p.merged_at))) continue;
    const permission = await read('collaborators/' + v.user.login + '/permission');
    if (['admin','maintain','write'].includes(permission.permission) && permission.user?.id === v.user.id) { independent = v; break; }
  }
  insist(independent && Number.isSafeInteger(independent.id), 'no authenticated independent exact-head approval before merge');
  const ci = latest(runs,'.github/workflows/ci.yml',candidate,'main',['push']);
  const security = latest(runs,'.github/workflows/codeql.yml',candidate,'main',['push','workflow_dispatch']);
  const container = latest(runs,'.github/workflows/deployment-image.yml',candidate,'main',['push','workflow_dispatch']);
  const integrity = latest(runs,'.github/workflows/main-integrity.yml',candidate,'main',['push']);
  const proof = latest(runs,'.github/workflows/release-staging-proof.yml',candidate,'main',['workflow_run']);
  insist(Date.parse(proof.created_at) >= Date.parse(integrity.updated_at), 'staging proof predates integrity');
  const artifacts = await direct(read,'actions/runs/' + proof.id + '/artifacts','artifacts');
  const selected = artifacts.filter(a => a.name === 'staging-proof-' + proof.id && a.expired === false && /^sha256:[a-f0-9]{64}$/.test(a.digest || '') && Number.isSafeInteger(a.id));
  insist(selected.length === 1, 'missing immutable staging proof artifact digest');
  return { repository: REPO, target: 'refs/heads/deploy/production', mainTip: candidate, oldPointer: expectedOld, fastForward: true, mainIntegrity: true, requiredChecks: true, independentHeadReview: true, stagingProof: true, provenance: { pr: p.number, headSha: p.head.sha, reviewId: independent.id, reviewerId: independent.user.id, checkIds, ci: ci.id, security: security.id, container: container.id, integrity: integrity.id, proof: proof.id, artifact: selected[0].id, artifactDigest: selected[0].digest } };
}
// Future activation must bind the immutable digest to the protected job run
// title and exact SHA. Only authenticated GitHub environment review history
// from that first attempt counts; an owner-dispatched input is NOT approval.
export async function observeEnvironmentApproval({ candidate, digest, runId, ownerId, reviewerId, read = readGitHub }) {
  insist(SHA.test(candidate) && DIGEST.test(digest) && Number.isSafeInteger(runId) && Number.isSafeInteger(ownerId) && Number.isSafeInteger(reviewerId) && ownerId !== reviewerId, 'invalid environment approval identity');
  const run = await read('actions/runs/' + runId);
  insist(run.id === runId && sameRepo(run) && run.path === '.github/workflows/production-promotion.yml' && run.head_sha === candidate && run.head_branch === 'main' && run.event === 'workflow_dispatch' && run.run_attempt === 1 && run.status === 'in_progress' && run.actor?.id === ownerId && run.triggering_actor?.id === ownerId && run.display_title === 'Production Promotion · ' + digest, 'untrusted or mismatched production approval run');
  const history = await read('actions/runs/' + runId + '/approvals');
  insist(Array.isArray(history) && history.length < 100, 'missing or truncated environment history');
  const relevant = history.filter(v => v.environments?.some(e => e.name === 'production'));
  insist(relevant.length === 1 && relevant[0].state === 'approved' && relevant[0].user?.type === 'User' && relevant[0].user.id === reviewerId, 'missing independent production environment approval');
  return { protectedEnvironmentApproved: true, environmentApprovalDigest: digest, environmentReviewerId: reviewerId };
}
export function releaseEvidenceDigest(provenance, externalDigest) {
  insist(DIGEST.test(externalDigest), 'missing verified external evidence digest');
  return createHash('sha256').update(JSON.stringify(['pri-release-github-v1', provenance.pr, provenance.headSha, provenance.reviewId, provenance.reviewerId, provenance.checkIds, provenance.ci, provenance.security, provenance.container, provenance.integrity, provenance.proof, provenance.artifact, provenance.artifactDigest, externalDigest])).digest('hex');
}
