// Reuse the existing deployment verifier for India/free-launch only. Metadata
// comes from a trusted, read-only Railway observation adapter, not the intent.
const SHA = /^[a-f0-9]{40}$/;
const fail = reason => { throw new Error(reason); };
const insist = (truth, reason) => { if (!truth) fail(reason); };
const targets = Object.freeze({
  staging: { origin: 'https://pri-learning-staging-staging.up.railway.app', service: 'pri-learning-staging', engine: 'postgres' },
  production: { origin: 'https://final-pri-learning-production.up.railway.app', service: 'Final-Pri-learning' }
});
const productNames = ['appleMonthly','appleAnnual','googleMonthly','googleAnnual','webMonthly','webAnnual'];
export function freeLaunchProblems(billing) {
  const problems = [];
  if (billing?.webCheckout?.configured !== false) problems.push('web checkout not proven off');
  if (!productNames.every(k => billing?.products?.[k] === null)) problems.push('native/web payment products not proven absent');
  if (billing?.display?.currency !== 'INR' || !['monthly','annual','trialDays'].every(k => billing?.display?.[k] === null)) problems.push('paid prices/trial not proven absent');
  return problems;
}
export async function observeIndiaCoreHost({ candidate, role, metadata, fetchImpl = globalThis.fetch, verifyImpl }) {
  const t = Object.hasOwn(targets,role) ? targets[role] : null;
  insist(t && typeof candidate === 'string' && SHA.test(candidate), 'invalid host role or candidate');
  insist(metadata?.environment === role && metadata.service === t.service && metadata.sha === candidate && metadata.state === 'SUCCESS' && typeof metadata.id === 'string' && metadata.id.trim() && ['sqlite','postgres'].includes(metadata.engine) && (!t.engine || t.engine === metadata.engine), 'unverified Railway deployment metadata');
  if (metadata.engine === 'sqlite') insist(metadata.persistenceVerified === true, 'SQLite volume not independently verified');
  const captured = new Map();
  // Capture the very responses used by the established verifier, avoiding a
  // second inconsistent snapshot and refusing redirects to another service.
  const read = async (url, options = {}) => {
    insist(new URL(url).origin === t.origin, 'wrong release origin');
    const response = await fetchImpl(url, {...options, redirect:'error', credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(15000)});
    const body = await response.json();
    captured.set(new URL(url).pathname,{ status:response.status, body });
    return { status:response.status, json:async()=>body };
  };
  const verifyDeployment = verifyImpl || (await import('../tools/verify-deployment.mjs')).verifyDeployment;
  const report = await verifyDeployment({ origin:t.origin, sha:candidate, engine:metadata.engine, edition:'priyabhata', persistentStorageProven:metadata.engine === 'sqlite' && metadata.persistenceVerified === true, authEmailProven:true, requireHandwriting:true, fetchImpl:read });
  insist(report?.ok === true, 'existing deployment verifier did not pass');
  const at = path => { const row = captured.get(path); insist(row?.status === 200, 'missing successful '+path); return row.body; };
  const health = at('/v1/health'), ready = at('/v1/ready'), web = at('/release.json'), features = at('/features.json'), billing = at('/v1/billing/config');
  insist(health?.releaseIdentity?.releaseSha === candidate && ready?.releaseSha === candidate && web?.releaseSha === candidate && ready?.ready === true && health?.edition === 'priyabhata' && features?.edition === 'priyabhata', 'strict India host identity mismatch');
  const problems = freeLaunchProblems(billing); insist(problems.length === 0, 'free launch: '+problems.join('; '));
  return { deploymentId:metadata.id, deploymentSha:metadata.sha, deploymentState:metadata.state, service:metadata.service, environment:metadata.environment, healthSha:health.releaseIdentity.releaseSha, readySha:ready.releaseSha, webSha:web.releaseSha, ready:true, engine:metadata.engine, schemaCompatible:true, persistenceVerified:metadata.engine === 'postgres' || metadata.persistenceVerified === true };
}
