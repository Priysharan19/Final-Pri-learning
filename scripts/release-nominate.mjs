#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · nominate a release SHA (docs/release/release-policy.md,
// docs/release/production-cutover-checklist.md §0)
//
// Read-only. Given one `main` SHA it checks, and prints a line for each:
//
//   · the commit exists and is on origin/main (git);
//   · every GitHub Actions run on that exact SHA has completed and none
//     failed — EVERY run, scheduled and agent workflows included (a red
//     "Pri App Health Agent" run on the tip blocks nomination until it is
//     green or rerun; this is deliberate: the tool does not decide which
//     workflows are code gates); the four required CI contexts and the
//     Production Container job are present and green (gh api — the operator's
//     own gh login, no token is read or stored here; listings are paginated so
//     a SHA with more than 100 runs or check runs cannot hide a context);
//   · staging (/v1/health, /v1/ready, /release.json) serves exactly that SHA on
//     Postgres, ready, at the schema versions THAT commit's
//     server/platform/schemaVersions.js states;
//   · the promotion would be a fast-forward of deploy/production.
//
// When everything holds it prints the promotion commands from
// release-policy.md with the SHA filled in. It NEVER runs them: pushing
// deploy/production needs the approval the release record names and the 24 h
// staging soak (docs/operations/postgres-cutover.md §4.5–§4.6), and both are a
// person's decision.
//
//   node scripts/release-nominate.mjs <40-hex main SHA> [--no-fetch] [--json]
//     [--staging https://pri-learning-staging-staging.up.railway.app]
//     [--production https://final-pri-learning-production.up.railway.app]
//     [--repo Priysharan19/Final-Pri-learning]
//
// Exit 0 nominated · 1 a check failed · 2 usage or a dependency (git, gh).
// ─────────────────────────────────────────────────────────────────────────────
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;
const REQUEST_TIMEOUT_MS = 15_000;

export const DEFAULT_REPO = 'Priysharan19/Final-Pri-learning';
export const STAGING_ORIGIN = 'https://pri-learning-staging-staging.up.railway.app';
export const PRODUCTION_ORIGIN = 'https://final-pri-learning-production.up.railway.app';

/** The required pre-merge contexts of release-policy.md, plus the container job of §0. */
export const REQUIRED_CONTEXTS = Object.freeze([
  'Suites, coverage and accuracy gates',
  'Production account, sync and commercial schema',
  'Browser suites (end-to-end and accessibility)',
  'Client build and offline-first boundary'
]);
export const CONTAINER_CONTEXT = 'Build container and prove persistent health';
/** A conclusion that leaves a run green. Anything else on the SHA refuses the nomination. */
export const GREEN = new Set(['success', 'skipped']);

export function parseArgs(argv) {
  const args = { sha: null, fetch: true, json: false, staging: STAGING_ORIGIN, production: PRODUCTION_ORIGIN, repo: DEFAULT_REPO };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--no-fetch') { args.fetch = false; continue; }
    if (flag === '--json') { args.json = true; continue; }
    if (['--staging', '--production', '--repo'].includes(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      args[flag.slice(2)] = value;
      i += 1;
      continue;
    }
    if (flag.startsWith('--')) throw new Error(`Unknown argument: ${flag}`);
    if (args.sha) throw new Error('Give exactly one SHA');
    args.sha = flag;
  }
  if (!args.sha) throw new Error('A 40-hex main SHA is required');
  return args;
}

/** The two version constants of server/platform/schemaVersions.js at a commit. */
export function parseSchemaVersions(source) {
  const schema = String(source).match(/^export const SCHEMA_VERSION\s*=\s*(\d+)\s*;/m);
  const billing = String(source).match(/^export const BILLING_SCHEMA_VERSION\s*=\s*(\d+)\s*;/m);
  if (!schema || !billing) throw new Error('schemaVersions.js at that commit does not declare both versions');
  return { schemaVersion: Number(schema[1]), billingSchemaVersion: Number(billing[1]) };
}

/**
 * Workflow runs on the SHA (GET /repos/{repo}/actions/runs?head_sha=). Runs
 * GitHub creates for Dependabot's own version updates ("dynamic/…") are not
 * about this commit's code and are listed, not counted.
 */
export function evaluateRuns(runs) {
  const relevant = [], ignored = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    (String(run?.path || '').startsWith('dynamic/') ? ignored : relevant).push(run);
  }
  const pending = relevant.filter(run => run.status !== 'completed');
  const red = relevant.filter(run => run.status === 'completed' && !GREEN.has(run.conclusion));
  return { relevant, ignored, pending, red, ok: relevant.length > 0 && pending.length === 0 && red.length === 0 };
}

/** The newest check run of each name (a rerun replaces an earlier attempt). */
export function latestCheckRuns(checkRuns) {
  const latest = new Map();
  for (const run of Array.isArray(checkRuns) ? checkRuns : []) {
    const name = String(run?.name || '');
    const stamp = Date.parse(run?.completed_at || run?.started_at || 0) || 0;
    const prior = latest.get(name);
    if (!prior || stamp >= prior.stamp) latest.set(name, { run, stamp });
  }
  return new Map([...latest].map(([name, { run }]) => [name, run]));
}

export function promotionCommands(sha, { productionOrigin = PRODUCTION_ORIGIN } = {}) {
  return [
    'git fetch origin',
    `git merge-base --is-ancestor ${sha} origin/main          # must succeed`,
    `git merge-base --is-ancestor origin/deploy/production ${sha}   # fast-forward only`,
    `git push origin ${sha}:refs/heads/deploy/production   # OPERATOR ONLY: requires signed release authorization; never run from CI`,
    `curl -s ${productionOrigin}/v1/health   # releaseIdentity.releaseSha == ${sha}`,
    `npm run verify:deployment -- --origin ${productionOrigin} --sha ${sha} --engine sqlite --persistent-storage-proven --auth-email-proven`
  ];
}

async function defaultGit(args) {
  const { stdout } = await execFileP('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

async function defaultGh(path) {
  const { stdout } = await execFileP('gh', ['api', path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
}

const GH_PAGE = 100;
const GH_MAX_PAGES = 20;
/**
 * Every item of a paginated GitHub list: `path` already carries per_page=100;
 * pages are fetched until one comes back short. A list that is still full at
 * GH_MAX_PAGES is refused (thrown) rather than silently truncated, so the
 * caller fails closed instead of missing a context.
 */
export async function ghAll(gh, path, key) {
  const items = [];
  for (let page = 1; page <= GH_MAX_PAGES; page += 1) {
    const body = await gh(`${path}&page=${page}`);
    const chunk = Array.isArray(body?.[key]) ? body[key] : [];
    items.push(...chunk);
    if (chunk.length < GH_PAGE) return items;
  }
  throw new Error(`${key}: more than ${GH_MAX_PAGES * GH_PAGE} items on one SHA; refusing to decide on a truncated list`);
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body };
}

/**
 * Returns { ok, sha, results: [{ ok, label, detail? }], promotion: [commands] }.
 * A failed check is a row, not a throw; a missing dependency (git/gh absent)
 * throws with .code 'DEPENDENCY'.
 */
export async function nominate({
  sha,
  repo = DEFAULT_REPO,
  stagingOrigin = STAGING_ORIGIN,
  productionOrigin = PRODUCTION_ORIGIN,
  fetchOrigin = true,
  git = defaultGit,
  gh = defaultGh,
  fetchImpl = globalThis.fetch,
  now = Date.now()
} = {}) {
  const results = [];
  const check = (ok, label, detail) => { results.push({ ok: !!ok, label, ...(detail ? { detail: String(detail) } : {}) }); return !!ok; };
  const info = (label, detail) => results.push({ ok: null, label, ...(detail ? { detail: String(detail) } : {}) });
  const expected = String(sha || '').trim().toLowerCase();
  if (!check(SHA.test(expected), 'nominated SHA is a full 40-hex commit', sha)) return { ok: false, sha: expected, results, promotion: [] };

  // ── git ────────────────────────────────────────────────────────────────────
  if (fetchOrigin) {
    try { await git(['fetch', '-q', 'origin']); check(true, 'origin fetched'); }
    catch (error) { check(false, 'origin fetched', error?.message || String(error)); }
  }
  let commitKnown = false;
  try { await git(['rev-parse', '--verify', '--quiet', `${expected}^{commit}`]); commitKnown = true; }
  catch { /* reported below */ }
  check(commitKnown, 'commit exists in this clone', commitKnown ? undefined : 'git fetch origin, or check the SHA');
  let onMain = false;
  if (commitKnown) {
    try { await git(['merge-base', '--is-ancestor', expected, 'origin/main']); onMain = true; }
    catch { onMain = false; }
  }
  check(onMain, 'SHA is on origin/main');
  if (onMain) {
    try {
      const tip = (await git(['rev-parse', 'origin/main'])).trim();
      const behind = tip === expected ? 0 : Number((await git(['rev-list', '--count', `${expected}..origin/main`])).trim());
      info('position on origin/main', behind === 0 ? 'the tip of origin/main' : `${behind} commit(s) behind the tip ${tip.slice(0, 12)} (allowed: a certified SHA need not be the tip)`);
    } catch { /* informational only */ }
  }
  let versions = null;
  if (commitKnown) {
    try { versions = parseSchemaVersions(await git(['show', `${expected}:server/platform/schemaVersions.js`])); }
    catch (error) { check(false, 'schema versions readable at that commit', error?.message || String(error)); }
  }
  if (versions) info('schema versions this commit expects', `schema ${versions.schemaVersion} / billing ${versions.billingSchemaVersion}`);

  // ── GitHub Actions on exactly this SHA ─────────────────────────────────────
  try {
    const runs = await ghAll(gh, `repos/${repo}/actions/runs?head_sha=${expected}&per_page=${GH_PAGE}`, 'workflow_runs');
    const verdict = evaluateRuns(runs);
    const describe = list => list.map(run => `${run.name}: ${run.status}${run.conclusion ? '/' + run.conclusion : ''}`).join('; ');
    check(verdict.relevant.length > 0, 'GitHub Actions ran on this SHA', verdict.relevant.length ? `${verdict.relevant.length} run(s)` : 'no workflow run has this head SHA');
    check(verdict.pending.length === 0, 'every workflow run on this SHA has completed', verdict.pending.length ? `still running: ${describe(verdict.pending)}` : undefined);
    check(verdict.red.length === 0, 'no workflow run on this SHA failed or was cancelled', verdict.red.length ? describe(verdict.red) : undefined);
    if (verdict.ignored.length) info('Dependabot version-update runs listed, not counted', String(verdict.ignored.length));
  } catch (error) {
    if (error?.code === 'ENOENT') throw Object.assign(new Error('gh (GitHub CLI) is not installed or not on PATH'), { code: 'DEPENDENCY' });
    check(false, 'GitHub Actions runs readable (gh api)', error?.message || String(error));
  }
  try {
    const checks = latestCheckRuns(await ghAll(gh, `repos/${repo}/commits/${expected}/check-runs?per_page=${GH_PAGE}`, 'check_runs'));
    for (const name of REQUIRED_CONTEXTS) {
      const run = checks.get(name);
      check(run?.status === 'completed' && run?.conclusion === 'success', `required context green: ${name}`,
        run ? `${run.status}${run.conclusion ? '/' + run.conclusion : ''}` : 'no check run with this name on this SHA');
    }
    const container = checks.get(CONTAINER_CONTEXT);
    check(container?.status === 'completed' && container?.conclusion === 'success', `Production Container green: ${CONTAINER_CONTEXT}`,
      container ? `${container.status}${container.conclusion ? '/' + container.conclusion : ''}`
        : 'deployment-image.yml is path-filtered and did not run on this SHA; dispatch it while main is at this SHA, or nominate a SHA it ran on (checklist §0)');
  } catch (error) {
    if (error?.code === 'ENOENT') throw Object.assign(new Error('gh (GitHub CLI) is not installed or not on PATH'), { code: 'DEPENDENCY' });
    check(false, 'GitHub check runs readable (gh api)', error?.message || String(error));
  }

  // ── staging serves exactly this SHA ────────────────────────────────────────
  try {
    const [health, ready, web] = await Promise.all([
      getJson(fetchImpl, `${stagingOrigin}/v1/health`),
      getJson(fetchImpl, `${stagingOrigin}/v1/ready`),
      getJson(fetchImpl, `${stagingOrigin}/release.json`)
    ]);
    const h = health.body || {}, r = ready.body || {};
    check(health.status === 200 && h.ok === true && h.service === 'pri-learning-platform', 'staging /v1/health answers as pri-learning-platform', `status ${health.status}`);
    const running = h.releaseIdentity?.releaseSha;
    check(running === expected, 'staging runs the nominated SHA', `running ${running || 'unknown'}`);
    check(web.status === 200 && web.body?.releaseSha === expected, 'staging web bundle (release.json) is the nominated SHA', `web ${web.body?.releaseSha || 'unknown'}`);
    check(h.database?.engine === 'postgres', 'staging database engine is postgres', `running ${h.database?.engine || 'unknown'}`);
    if (versions) {
      const dbSchema = r.checks?.database?.schemaVersion ?? h.schemaVersion;
      const dbBilling = r.checks?.database?.billingSchemaVersion ?? h.billingSchemaVersion;
      check(String(dbSchema) === String(versions.schemaVersion), `staging schema_version is ${versions.schemaVersion}`, `running ${dbSchema}`);
      check(String(dbBilling) === String(versions.billingSchemaVersion), `staging billing_schema_version is ${versions.billingSchemaVersion}`, `running ${dbBilling}`);
    }
    const readyDetail = [r.state, ...(r.failing || []), ...(r.degraded || []).map(code => `degraded:${code}`)].filter(Boolean).join(' ');
    check(ready.status === 200 && r.ready === true, 'staging /v1/ready says the replica can serve', readyDetail || `status ${ready.status}`);
    const built = Date.parse(h.releaseIdentity?.buildTimestamp || '');
    if (Number.isFinite(built)) {
      const hours = (now - built) / 3_600_000;
      info('staging build age (a lower bound on the soak; the 24 h clock starts at the staging deploy, from the operator\'s record)', `${hours.toFixed(1)} h since buildTimestamp`);
    }
  } catch (error) {
    check(false, 'staging reachable', error?.message || String(error));
  }

  // ── the promotion would be a fast-forward ──────────────────────────────────
  if (commitKnown) {
    let pointer = null;
    try { pointer = (await git(['rev-parse', '--verify', '--quiet', 'origin/deploy/production'])).trim(); } catch { pointer = null; }
    if (pointer) {
      let ff = false;
      try { await git(['merge-base', '--is-ancestor', pointer, expected]); ff = true; } catch { ff = false; }
      check(ff, 'deploy/production → SHA is a fast-forward', `deploy/production at ${pointer.slice(0, 12)}${ff ? '' : ' is not an ancestor; moving the pointer backwards is break-glass (release-policy.md)'}`);
    } else {
      info('deploy/production', 'not fetched in this clone; the promotion commands check it again');
    }
  }
  try {
    const live = await getJson(fetchImpl, `${productionOrigin}/v1/health`);
    const running = live.body?.releaseIdentity?.releaseSha;
    info('production currently serves', running ? `${running}${running === expected ? ' (already this SHA)' : ''}` : `unknown (status ${live.status})`);
  } catch { info('production currently serves', 'unreachable from here'); }

  const ok = results.every(item => item.ok !== false);
  return { ok, sha: expected, results, promotion: ok ? promotionCommands(expected, { productionOrigin }) : [] };
}

async function main() {
  let args;
  const usage = 'Usage: node scripts/release-nominate.mjs <40-hex main SHA> [--no-fetch] [--json] [--staging <origin>] [--production <origin>] [--repo owner/name]';
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
  let report;
  try {
    report = await nominate({ sha: args.sha, repo: args.repo, stagingOrigin: args.staging, productionOrigin: args.production, fetchOrigin: args.fetch });
  } catch (error) {
    console.error(error?.message || String(error));
    process.exit(2);
  }
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const item of report.results) {
      const mark = item.ok === null ? '·' : item.ok ? '✓' : '✗';
      console.log(`  ${mark} ${item.label}${item.detail ? `  (${item.detail})` : ''}`);
    }
    const passed = report.results.filter(item => item.ok === true).length;
    const counted = report.results.filter(item => item.ok !== null).length;
    if (report.ok) {
      console.log(`NOMINATION: PASS — ${report.sha} — ${passed}/${counted} checks`);
      console.log('');
      console.log('This tool pushed nothing. Production still uses SQLite on /data; never infer a Postgres cutover. Before promoting: the 24 h clean staging soak (docs/operations/postgres-cutover.md §4.5),');
      console.log('acceptance A–D on staging (tools/acceptance/staging-acceptance.mjs), the device matrix (docs/release/device-matrix.md),');
      console.log('and the approval the release record names (ios/PriLearning.swiftpm/RELEASE.md §11). Then, by hand:');
      console.log('');
      for (const line of report.promotion) console.log(`  ${line}`);
    } else {
      console.log(`NOMINATION: FAIL — ${report.sha} — ${passed}/${counted} checks`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
