#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · nominate a release SHA (docs/release/release-policy.md,
// docs/release/production-cutover-checklist.md §0, postgres-cutover.md §4.6)
//
// Read-only. Given one `main` SHA it checks, and prints a line for each:
//
//   · the commit exists and is on origin/main (git);
//   · every GitHub Actions workflow that ran on that exact SHA has completed
//     green — scheduled and agent workflows included (a red "Pri App Health
//     Agent" run on the tip blocks nomination until it is green; this is
//     deliberate: the tool does not decide which workflows are code gates).
//     One verdict per (workflow, event): the NEWEST run of each decides, so a
//     flaky scheduled run that a later schedule on the same SHA passed is
//     listed as superseded and not counted, while a workflow whose newest run
//     is still red keeps blocking (a genuine failure reproduces on the rerun).
//     The four required CI contexts and the Production Container job are
//     present and green (gh api — the operator's own gh login, no token is read
//     or stored here; listings are paginated so a SHA with more than 100 runs
//     or check runs cannot hide a context);
//   · staging (/v1/health, /v1/ready, /release.json) serves exactly that SHA on
//     Postgres, ready, at the schema versions THAT commit's
//     server/platform/schemaVersions.js states;
//   · the promotion would be a fast-forward of deploy/production;
//   · the database engine production serves is known, because the printed
//     verify command takes the DEPLOYED engine (never a hard-coded one; pass
//     --production-engine for a promotion that follows the Postgres cutover in
//     the same window, docs/operations/postgres-cutover.md §4.6 step 6);
//   · at the RELEASE stage (the default), the release evidence exists for this
//     exact SHA: the strict Release Candidate gates (release-candidate.yml) ran
//     and passed on exactly this commit — a run counts only when GitHub
//     attributes it to the SHA, its run name names the same SHA (the workflow
//     checks out that exact commit and fails if it got another), and both
//     blocking jobs concluded `success`, never `skipped`; every case of the
//     physical-device matrix is `pass` on real hardware
//     (docs/release/device-matrix.md "device-complete"; `blocked` rows are
//     recorded, never omitted and never acceptance); and a real-human
//     evaluation of the server reader names this SHA, clears Gate C's floors
//     (READER_FLOORS) and is backed by the cloud-reader artifact of that
//     Release Candidate run (tools/ink-cloud-reader-eval.mjs). Neither evidence
//     row is a reminder any more: a
//     missing one refuses the nomination unless a public-release override
//     record (--override, format below) waives it by name AND links an
//     approving GitHub comment or issue by a repository admin that names this
//     SHA and the waived requirements. The override is printed with the result and
//     copied into the GO/NO-GO dossier (scripts/release-dossier.mjs).
//     `--candidate` runs everything except the evidence rows, for §4.6 step 1
//     before the TestFlight/Play build exists; it never prints the promotion.
//
// When everything holds it prints the promotion commands from
// release-policy.md with the SHA filled in. It NEVER runs them: pushing
// deploy/production needs the approval the release record names and the 24 h
// staging soak (docs/operations/postgres-cutover.md §4.5–§4.6), and both are a
// person's decision.
//
//   node scripts/release-nominate.mjs <40-hex main SHA> [--candidate] [--no-fetch] [--json]
//     [--override docs/release/evidence/go-no-go/<sha>.override.json]
//     [--production-engine postgres|sqlite]
//     [--staging https://pri-learning-staging-staging.up.railway.app]
//     [--production https://final-pri-learning-production.up.railway.app]
//     [--repo Priysharan19/Final-Pri-learning]
//
// Override record (JSON): { "sha": "<40-hex>", "scope": "public-release" | "internal-test-track",
//   "waives": ["device-matrix" | "reader-evidence", …], "by": "<named human>", "githubLogin": "<login>",
//   "approval": "https://github.com/<repo>/issues/<n>#issuecomment-<id>", "at": "<ISO date-time>",
//   "reason": "<why this release goes without it>" }
// The JSON file is not the authority; the approval is: that comment, or an issue opened from a
// prefilled link ("approval": "https://github.com/<repo>/issues/<n>"). It must be written by
// `githubLogin`, an admin of the repository, after the commit, never edited (an issue also never
// closed), hold no other approval line, and its first line must be exactly
//   Pri-Evidence-Waiver: <sha> scope=public-release target=deploy/production waives=<sorted,comma list>
// An `internal-test-track` exception (TestFlight / Play internal) never waives release-stage evidence.
// Evidence class of such an approval: GITHUB-ACCOUNT-AUTHENTICATED. GitHub proves the account, not
// the person: anything holding that account's token can post as it, so the owner posts it in the
// GitHub web UI themself, and the dossier never calls it more than that.
//
// Exit 0 nominated · 1 a check failed · 2 usage or a dependency (git, gh).
// ─────────────────────────────────────────────────────────────────────────────
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { DEFAULT_LEDGER, NOT_A_HUMAN, readLedger, summarise } from './device-matrix-record.mjs';

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;
const REQUEST_TIMEOUT_MS = 15_000;

export const DEFAULT_REPO = 'Priysharan19/Final-Pri-learning';
export const STAGING_ORIGIN = 'https://pri-learning-staging-staging.up.railway.app';
export const PRODUCTION_ORIGIN = 'https://final-pri-learning-production.up.railway.app';
/** Where tools/ink-cloud-reader-eval.mjs writes real-human evaluations of the server reader. */
export const DEFAULT_READER_EVAL_DIR = join(ROOT, 'handwriting', 'v17', 'cloud-reader-eval');
/** The evidence a release-stage nomination requires; each may be waived only by a recorded override naming it. */
export const EVIDENCE_REQUIREMENTS = Object.freeze(['device-matrix', 'reader-evidence']);
export const OVERRIDE_SCOPES = Object.freeze(['public-release', 'internal-test-track']);
export const RELEASE_TARGET = 'deploy/production';
export const APPROVAL_EVIDENCE_CLASS = 'GITHUB-ACCOUNT-AUTHENTICATED';
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const APPROVAL_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(?:issues|pull)\/([1-9]\d*)#issuecomment-([1-9]\d*)$/;
// An approval may also be the body of an issue opened from a prefilled link (one click: GitHub can
// prefill a new issue, never a comment). Same checks; an edited body is read through GraphQL.
const ISSUE_APPROVAL_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)$/;
/** Every approval line starts with one of these; a post that holds two approves nothing. */
const APPROVAL_LINE = /Pri-(?:Release-GO|Production-Data-YES|Evidence-Waiver):/g;
/** True for a link verifyApproval can read: an issue or PR comment, or an issue. */
export function approvalLinkShape(url) { return APPROVAL_URL.test(String(url || '').trim()) || ISSUE_APPROVAL_URL.test(String(url || '').trim()); }

/** The exact line an evidence waiver's approval comment must contain. */
export function waiverMarker(sha, waives) {
  return `Pri-Evidence-Waiver: ${sha} scope=public-release target=${RELEASE_TARGET} waives=${[...new Set(waives.map(String))].sort().join(',')}`;
}
/** The exact line the owner's GO must contain (scripts/release-dossier.mjs). */
export function goMarker(sha) {
  return `Pri-Release-GO: ${sha} target=${RELEASE_TARGET}`;
}
/** The exact line the owner's production-data Yes must contain (D27, Step 24; the dossier's data gate). */
export function dataYesMarker(sha) {
  return `Pri-Production-Data-YES: ${sha} target=production-postgres`;
}

/**
 * Authenticates a release approval through GitHub instead of trusting a name typed into a file.
 * The approval is either a comment (`…/issues/<n>#issuecomment-<id>`, on an issue or PR) or the body
 * of an issue (`…/issues/<n>`, so a prefilled new-issue link makes it one click). Either way: it is in
 * this repository; its author is `githubLogin`, a User (not a bot) with admin permission; it was
 * posted after the commit it approves and never edited; its first non-blank line is exactly `marker`,
 * where the post shows it first (never under other text, in an HTML comment or in a code block); and
 * it holds no other approval line, so one post approves one thing. An issue must also be open and
 * never have been closed: closing it withdraws the approval. Returns { ok, problems, login,
 * createdAt, url, kind: 'comment' | 'issue' }.
 */
export async function verifyApproval({ approval, githubLogin, sha, marker, repo = DEFAULT_REPO, gh = defaultGh, ghGraphql = defaultGhGraphql, git = defaultGit, now = Date.now() }) {
  const problems = [];
  const url = String(approval || '').trim();
  const asComment = APPROVAL_URL.exec(url);
  const asIssue = asComment ? null : ISSUE_APPROVAL_URL.exec(url);
  const parsed = asComment || asIssue;
  const kind = asComment ? 'comment' : 'issue';
  const what = asComment ? 'approval comment' : 'approval issue';
  const login = String(githubLogin || '').trim();
  if (!parsed) problems.push(`approval must link the approving comment (https://github.com/${repo}/issues/<n>#issuecomment-<id>) or issue (https://github.com/${repo}/issues/<n>)`);
  else if (parsed[1].toLowerCase() !== String(repo).toLowerCase()) problems.push(`${what} is in ${parsed[1]}, not ${repo}`);
  if (!GITHUB_LOGIN.test(login)) problems.push('githubLogin must be the approver\'s GitHub login');
  if (problems.length) return { ok: false, problems, login: null, createdAt: null, url, kind };
  let author = '', type = '', createdText = '', edited = false, body = '';
  if (asComment) {
    const [, , number, id] = asComment;
    let comment = null;
    try { comment = await gh(`repos/${repo}/issues/comments/${id}`); }
    catch (error) { return { ok: false, problems: [`approval comment ${id} could not be read from GitHub: ${error?.message || error}`], login: null, createdAt: null, url, kind }; }
    author = String(comment?.user?.login || '');
    type = comment?.user?.type || '';
    createdText = comment?.created_at || '';
    const created = Date.parse(createdText);
    const updated = Date.parse(comment?.updated_at || createdText);
    edited = Number.isFinite(created) && Number.isFinite(updated) && updated !== created;
    body = comment?.body || '';
    if (!String(comment?.issue_url || '').endsWith(`/issues/${number}`)) problems.push(`approval comment ${id} does not belong to #${number}`);
  } else {
    const [, , number] = asIssue;
    const [owner, name] = String(repo).split('/');
    let issue = null;
    try {
      const data = await ghGraphql(ISSUE_QUERY, { owner, name, number: Number(number) });
      issue = data?.repository?.issue ?? null;
    } catch (error) { return { ok: false, problems: [`approval issue #${number} could not be read from GitHub: ${error?.message || error}`], login: null, createdAt: null, url, kind }; }
    // For a number that is a pull request GraphQL answers a NOT_FOUND error (caught above) or null, so a PR body never stands in for an issue.
    if (!issue) return { ok: false, problems: [`#${number} is not an issue of ${repo} (a pull request or a missing issue cannot carry an approval in its body)`], login: null, createdAt: null, url, kind };
    author = String(issue.author?.login || '');
    type = issue.author?.__typename || '';
    createdText = issue.createdAt || '';
    edited = issue.lastEditedAt !== null && issue.lastEditedAt !== undefined;
    body = issue.body || '';
    // Closing an approval issue withdraws it; one closed and reopened is not taken back either.
    if (issue.state !== 'OPEN') problems.push(`approval issue #${number} is ${String(issue.state || 'in an unknown state').toLowerCase()}: closing an approval issue withdraws it; open a new one`);
    else if (issue.timelineItems?.totalCount !== 0) problems.push(`approval issue #${number} was closed and reopened; a withdrawn approval is not taken back: open a new one`);
  }
  if (author.toLowerCase() !== login.toLowerCase()) problems.push(`${what} was written by ${author || '(unknown)'}, not ${login}`);
  if (type !== 'User') problems.push(`${what} author is a ${type || 'unknown'} account, not a person's User account`);
  const created = Date.parse(createdText);
  if (!Number.isFinite(created)) problems.push(`${what} has no creation time`);
  else {
    if (edited) problems.push(`${what} was edited after it was posted; post a new ${kind} rather than editing one`);
    if (created > now) problems.push(`${what} is dated in the future`);
  }
  const first = String(body).split(/\r?\n/).map(line => line.trim()).find(line => line !== '');
  const approvalLines = (String(body).match(APPROVAL_LINE) || []).length;
  if (first !== marker) problems.push(`${what} does not start with the exact line: ${marker}`);
  if (approvalLines > 1) problems.push(`${what} holds ${approvalLines} approval lines; one post approves one thing`);
  try {
    const permission = await gh(`repos/${repo}/collaborators/${encodeURIComponent(author || login)}/permission`);
    if (permission?.permission !== 'admin') problems.push(`${author || login} has ${permission?.permission || 'no'} permission on ${repo}; a release approval needs a repository admin`);
  } catch (error) { problems.push(`${author || login}'s permission on ${repo} could not be read: ${error?.message || error}`); }
  try {
    const committed = Date.parse(String(await git(['show', '-s', '--format=%cI', sha])).trim());
    if (!Number.isFinite(committed)) problems.push(`the commit time of ${sha} could not be read`);
    else if (Number.isFinite(created) && created < committed) problems.push(`${what} (${createdText}) predates the commit it approves; a stale approval cannot carry to a newer SHA`);
  } catch (error) { problems.push(`the commit time of ${sha} could not be read: ${error?.message || error}`); }
  return { ok: problems.length === 0, problems, login: author || null, createdAt: Number.isFinite(created) ? created : null, url, kind };
}
const ISSUE_QUERY = 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){number author{login __typename} createdAt lastEditedAt state timelineItems(first:1,itemTypes:[CLOSED_EVENT,REOPENED_EVENT]){totalCount} body}}}';
export const ENGINES = Object.freeze(['postgres', 'sqlite']);
export const STAGES = Object.freeze(['candidate', 'release']);

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
  const args = { sha: null, fetch: true, json: false, stage: 'release', override: null, productionEngine: null, staging: STAGING_ORIGIN, production: PRODUCTION_ORIGIN, repo: DEFAULT_REPO };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--no-fetch') { args.fetch = false; continue; }
    if (flag === '--json') { args.json = true; continue; }
    if (flag === '--candidate') { args.stage = 'candidate'; continue; }
    if (['--staging', '--production', '--repo', '--override', '--production-engine'].includes(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      if (flag === '--production-engine') {
        if (!ENGINES.includes(value)) throw new Error('--production-engine must be postgres or sqlite');
        args.productionEngine = value;
      } else if (flag === '--override') args.override = value;
      else args[flag.slice(2)] = value;
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

/** One group per workflow and event: a schedule's later run supersedes its earlier one; a push run never stands in for a pull_request run. */
export function runGroupKey(run) {
  const workflow = run?.workflow_id !== undefined && run?.workflow_id !== null ? `id:${run.workflow_id}` : `path:${run?.path || run?.name || ''}`;
  return `${workflow}|${run?.event || ''}`;
}
function runStamp(run) { return Date.parse(run?.run_started_at || run?.created_at || run?.updated_at || 0) || 0; }
function newerRun(a, b) {
  const sa = runStamp(a), sb = runStamp(b);
  if (sa !== sb) return sa > sb;
  const na = Number(a?.run_number) || 0, nb = Number(b?.run_number) || 0;
  if (na !== nb) return na > nb;
  return (Number(a?.run_attempt) || 0) > (Number(b?.run_attempt) || 0);
}

/**
 * Workflow runs on the SHA (GET /repos/{repo}/actions/runs?head_sha=). Runs
 * GitHub creates for Dependabot's own version updates ("dynamic/…") are not
 * about this commit's code and are listed, not counted. Of the remaining runs
 * the newest per (workflow, event) decides: an older red run of the same
 * workflow and event on the same SHA is superseded (listed, not counted); a
 * workflow whose newest run is red or still running blocks.
 */
export function evaluateRuns(runs) {
  const relevant = [], ignored = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    (String(run?.path || '').startsWith('dynamic/') ? ignored : relevant).push(run);
  }
  const newest = new Map();
  for (const run of relevant) {
    const key = runGroupKey(run);
    const prior = newest.get(key);
    if (!prior || newerRun(run, prior)) newest.set(key, run);
  }
  const latest = [...newest.values()];
  const superseded = relevant.filter(run => !latest.includes(run));
  const pending = latest.filter(run => run.status !== 'completed');
  const red = latest.filter(run => run.status === 'completed' && !GREEN.has(run.conclusion));
  return { relevant, ignored, latest, superseded, pending, red, ok: latest.length > 0 && pending.length === 0 && red.length === 0 };
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

/**
 * The promotion commands of release-policy.md. `engine` is the database engine
 * production serves after the promotion — read from the live host, or given
 * with --production-engine when the Postgres cutover happens in the same
 * window. The verify command never hard-codes an engine.
 */
export function promotionCommands(sha, { productionOrigin = PRODUCTION_ORIGIN, engine } = {}) {
  if (!ENGINES.includes(engine)) throw new Error('promotionCommands needs the production engine (postgres or sqlite)');
  const storage = engine === 'sqlite' ? ' --persistent-storage-proven' : '';
  return [
    'git fetch origin',
    `git merge-base --is-ancestor ${sha} origin/main          # must succeed`,
    `git merge-base --is-ancestor origin/deploy/production ${sha}   # fast-forward only`,
    `git push origin ${sha}:refs/heads/deploy/production   # OPERATOR ONLY: requires signed release authorization; never run from CI`,
    `curl -s ${productionOrigin}/v1/health   # releaseIdentity.releaseSha == ${sha}`,
    `npm run verify:deployment -- --origin ${productionOrigin} --sha ${sha} --engine ${engine}${storage} --auth-email-proven`
  ];
}

/**
 * The device matrix at this SHA. Device-complete means every case of every family is `pass`
 * (docs/release/device-matrix.md "Reading the report"; V1 scope §22.1/§22.4: real-device
 * certification for each device class). A `blocked` row is recorded and reported, never omitted,
 * but it is not acceptance: a family blocked for lack of hardware leaves the matrix incomplete,
 * and only an authenticated public-release waiver (a founder-approved platform scope change) can
 * release without it, visibly.
 */
export function deviceEvidence(sha, { ledger = DEFAULT_LEDGER } = {}) {
  const summary = summarise(readLedger(ledger), { sha });
  const { counts, rows } = summary;
  const families = new Map();
  for (const row of rows) {
    const family = families.get(row.family) || { family: row.family, label: row.familyLabel, pass: 0, other: 0 };
    if (row.latest?.result === 'pass') family.pass += 1; else family.other += 1;
    families.set(row.family, family);
  }
  const incompleteFamilies = [...families.values()].filter(f => f.other > 0).map(f => f.family);
  const ok = rows.length > 0 && counts.pass === rows.length;
  const detail = `pass ${counts.pass} · fail ${counts.fail} · blocked ${counts.blocked} · not run ${counts['not run']} of ${rows.length}`
    + (ok ? ' · device-complete' : ` · not device-complete: ${incompleteFamilies.join(', ')} not all pass${counts.blocked ? ' (blocked is recorded, never acceptance)' : ''}`);
  return { ok, counts, total: rows.length, summary, incompleteFamilies, detail };
}

/**
 * Gate C's measurable floors (handwriting/v12/PRODUCTION_STANDARD.md), the numbers
 * client/test/ink-release-evidence-gate.mjs enforces on the committed corpus. A
 * reader report clears them or it is not release evidence; release-candidate.yml
 * only uploads the measurement, so the floors are applied here. Never lower them
 * to pass a release: collect the evidence.
 */
export const READER_FLOORS = Object.freeze({ split: 'test', minWriters: 20, minLines: 1000, minExactPct: 98.0, minCharPct: 99.5, minWorstWriterExactPct: 90.0 });

/**
 * Why a real-human reader report does not clear READER_FLOORS (empty when it does).
 * The exact rate is recomputed from the counts, with every provider error counted
 * as a misread: an expression the reader never answered was not read correctly.
 */
export function readerFloorProblems(report) {
  const problems = [];
  const corpus = report?.corpus || {};
  const results = report?.results || {};
  const writers = Number(corpus.writers);
  const lines = Number(results.lines);
  const exact = Number(results.exact);
  const errors = results.providerErrors === undefined ? 0 : Number(results.providerErrors);
  if (corpus.split !== READER_FLOORS.split) problems.push(`split ${corpus.split ?? '(none)'}, not the writer-disjoint ${READER_FLOORS.split} split`);
  if (!(Number.isInteger(writers) && writers >= READER_FLOORS.minWriters)) problems.push(`${Number.isFinite(writers) ? writers : '?'} writer(s), floor ${READER_FLOORS.minWriters}`);
  if (!(Number.isInteger(lines) && lines >= READER_FLOORS.minLines)) problems.push(`${Number.isFinite(lines) ? lines : '?'} expression(s) read, floor ${READER_FLOORS.minLines}`);
  if (!(Number.isInteger(errors) && errors >= 0)) problems.push('providerErrors is not a count');
  const counted = Number.isInteger(lines) && Number.isInteger(exact) && Number.isInteger(errors) && exact >= 0 && exact <= lines && errors >= 0 && lines + errors > 0;
  const exactPct = counted ? 100 * exact / (lines + errors) : NaN;
  if (!(exactPct >= READER_FLOORS.minExactPct)) problems.push(`exact ${Number.isFinite(exactPct) ? exactPct.toFixed(2) : '?'}% (provider errors count as misreads), floor ${READER_FLOORS.minExactPct}%`);
  const charPct = results.charPct === null || results.charPct === undefined ? NaN : Number(results.charPct);
  if (!(charPct >= READER_FLOORS.minCharPct)) problems.push(`characters ${Number.isFinite(charPct) ? charPct : '?'}%, floor ${READER_FLOORS.minCharPct}%`);
  const worst = results.worstWriterExactPct === null || results.worstWriterExactPct === undefined ? NaN : Number(results.worstWriterExactPct);
  if (!(worst >= READER_FLOORS.minWorstWriterExactPct)) problems.push(`worst writer ${Number.isFinite(worst) ? worst : '?'}%, floor ${READER_FLOORS.minWorstWriterExactPct}%`);
  return problems;
}

/**
 * A real-human evaluation of the server reader that names this exact SHA
 * (tools/ink-cloud-reader-eval.mjs records `releaseSha`) and clears READER_FLOORS.
 * Dry runs are labelled synthetic and never count; a report under the floors is
 * named with every shortfall, never accepted. nominate() additionally binds the
 * report to the exact-SHA Release Candidate run that measured it.
 */
export function readerEvidence(sha, { dir = DEFAULT_READER_EVAL_DIR } = {}) {
  const files = existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.json')).sort() : [];
  const reports = [];
  for (const file of files) {
    try { reports.push({ file, report: JSON.parse(readFileSync(join(dir, file), 'utf8')) }); } catch { reports.push({ file, report: null }); }
  }
  const real = reports.filter(entry => entry.report?.evidenceClass === 'real-human');
  const atSha = real.filter(entry => String(entry.report?.releaseSha || '').toLowerCase() === sha);
  const best = atSha.at(-1);
  if (!best) {
    return { ok: false, file: null, report: null, detail: real.length
      ? `${real.length} real-human report(s) under ${dir} but none records releaseSha ${sha}`
      : 'NOT MEASURED: no real-human cloud-reader evaluation exists (tools/ink-cloud-reader-eval.mjs; needs the server key in the environment)' };
  }
  const writers = Number(best.report?.corpus?.writers) || 0;
  const results = best.report?.results || {};
  const lines = Number(results.lines) || 0;
  const problems = readerFloorProblems(best.report);
  return {
    ok: problems.length === 0, file: best.file, report: best.report, problems,
    detail: `${best.file}: ${writers} writer(s), exact lines ${results.exact ?? '?'}/${lines}, measured ${best.report.measuredAt || '?'}`
      + (problems.length ? ` · below Gate C floors: ${problems.join('; ')}` : ' · clears Gate C floors')
  };
}

/** The workflow whose strict gates a release must pass on its exact SHA, and its blocking jobs. */
export const RELEASE_CANDIDATE_WORKFLOW = '.github/workflows/release-candidate.yml';
export const RELEASE_CANDIDATE_JOBS = Object.freeze([
  'Handwriting release gates (strict, blocking)',
  'Build, exact release identity and cross-platform matrix'
]);
/** The run name release-candidate.yml gives a run: the exact commit it checked out (and verified). */
export function releaseCandidateTitle(sha) { return `Release Candidate · ${sha}`; }
/** The artifact release-candidate.yml uploads when it measured the cloud reader on that commit. */
export function readerArtifactName(sha) { return `cloud-reader-eval-${sha}`; }

/**
 * The newest Release Candidate run that tested exactly `sha`, or null. A run is
 * about `sha` only when GitHub attributes it to `sha` (head_sha: the event's
 * commit, whose copy of the workflow ran) AND its run name names `sha` (the
 * commit the run checked out). A run dispatched with another `release_sha`, or
 * by a version of the workflow without that binding, is never about `sha`.
 */
export function releaseCandidateRun(runs, sha) {
  let newest = null;
  for (const run of Array.isArray(runs) ? runs : []) {
    if (String(run?.path || '').split('@')[0] !== RELEASE_CANDIDATE_WORKFLOW) continue;
    if (run?.head_sha !== sha || run?.display_title !== releaseCandidateTitle(sha)) continue;
    if (!newest || newerRun(run, newest)) newest = run;
  }
  return newest;
}

/** Reads and validates an override record. `problems` is empty when it may waive evidence for `sha`. */
export function loadOverride(path, sha) {
  const problems = [];
  let record = null;
  try { record = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { problems.push(`${path}: ${error?.code === 'ENOENT' ? 'no such file' : 'not JSON'}`); }
  if (record && (typeof record !== 'object' || Array.isArray(record))) { problems.push('override must be a JSON object'); record = null; }
  const waives = Array.isArray(record?.waives) ? record.waives.map(String) : [];
  const by = String(record?.by || '').trim();
  const reason = String(record?.reason || '').trim();
  const at = String(record?.at || '').trim();
  const scope = String(record?.scope || '').trim();
  const githubLogin = String(record?.githubLogin || '').trim();
  const approval = String(record?.approval || '').trim();
  if (record) {
    if (!OVERRIDE_SCOPES.includes(scope)) problems.push(`override needs "scope": ${OVERRIDE_SCOPES.join(' or ')}`);
    if (!GITHUB_LOGIN.test(githubLogin)) problems.push('override needs "githubLogin": the approver\'s GitHub login');
    if (!approvalLinkShape(approval)) problems.push('override needs "approval": the link to the approving GitHub comment (…/issues/<n>#issuecomment-<id>) or issue (…/issues/<n>)');
    if (String(record.sha || '').toLowerCase() !== sha) problems.push(`override names sha ${record.sha || '(none)'}, not the nominated ${sha}`);
    if (!waives.length) problems.push('override waives nothing (waives: [])');
    for (const item of waives) if (!EVIDENCE_REQUIREMENTS.includes(item)) problems.push(`unknown evidence requirement ${JSON.stringify(item)}; known: ${EVIDENCE_REQUIREMENTS.join(', ')}`);
    if (!by) problems.push('override needs "by": the named human who accepts the release without this evidence');
    else if (NOT_A_HUMAN.test(by)) problems.push(`"by" ${JSON.stringify(by)} does not name a human (the word ${JSON.stringify(by.match(NOT_A_HUMAN)[0])} marks an agent, CI or placeholder)`);
    if (!Number.isFinite(Date.parse(at))) problems.push('override needs "at": an ISO date-time');
    if (reason.length < 20) problems.push('override needs "reason" of at least 20 characters');
  }
  return { path, problems, sha, waives: problems.length ? [] : waives, by, at, reason, scope, githubLogin, approval };
}

async function defaultGit(args) {
  const { stdout } = await execFileP('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

/** One GraphQL query through the operator's own gh login (gh api graphql); returns `data`. */
export async function defaultGhGraphql(query, variables = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) args.push(typeof value === 'number' ? '-F' : '-f', `${key}=${value}`);
  const { stdout } = await execFileP('gh', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  if (parsed?.errors?.length) throw new Error(parsed.errors.map(e => e?.message || 'GraphQL error').join('; '));
  return parsed?.data;
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

export async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body };
}

/**
 * Returns { ok, sha, stage, results: [{ ok, label, detail? }], promotion: [commands],
 * engine, overrides: [{ requirement, by, at, reason, path }] }.
 * A failed check is a row, not a throw; a missing dependency (git/gh absent)
 * throws with .code 'DEPENDENCY'.
 */
export async function nominate({
  sha,
  stage = 'release',
  repo = DEFAULT_REPO,
  stagingOrigin = STAGING_ORIGIN,
  productionOrigin = PRODUCTION_ORIGIN,
  productionEngine = null,
  overridePath = null,
  deviceLedger = DEFAULT_LEDGER,
  readerEvalDir = DEFAULT_READER_EVAL_DIR,
  fetchOrigin = true,
  git = defaultGit,
  gh = defaultGh,
  ghGraphql = defaultGhGraphql,
  fetchImpl = globalThis.fetch,
  now = Date.now()
} = {}) {
  if (!STAGES.includes(stage)) throw new Error(`stage must be one of ${STAGES.join(', ')}`);
  if (productionEngine !== null && !ENGINES.includes(productionEngine)) throw new Error('productionEngine must be postgres or sqlite');
  const results = [];
  const overrides = [];
  const check = (ok, label, detail) => { results.push({ ok: !!ok, label, ...(detail ? { detail: String(detail) } : {}) }); return !!ok; };
  const info = (label, detail) => results.push({ ok: null, label, ...(detail ? { detail: String(detail) } : {}) });
  const expected = String(sha || '').trim().toLowerCase();
  const refused = () => ({ ok: false, sha: expected, stage, results, promotion: [], engine: null, overrides });
  if (!check(SHA.test(expected), 'nominated SHA is a full 40-hex commit', sha)) return refused();

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
  let runsOnSha = [];
  try {
    const runs = await ghAll(gh, `repos/${repo}/actions/runs?head_sha=${expected}&per_page=${GH_PAGE}`, 'workflow_runs');
    runsOnSha = runs;
    const verdict = evaluateRuns(runs);
    const describe = list => list.map(run => `${run.name}${run.event ? ` [${run.event}]` : ''}: ${run.status}${run.conclusion ? '/' + run.conclusion : ''}`).join('; ');
    check(verdict.latest.length > 0, 'GitHub Actions ran on this SHA', verdict.latest.length ? `${verdict.latest.length} workflow(s) by event, ${verdict.relevant.length} run(s)` : 'no workflow run has this head SHA');
    check(verdict.pending.length === 0, 'every workflow run on this SHA has completed', verdict.pending.length ? `still running: ${describe(verdict.pending)}` : undefined);
    check(verdict.red.length === 0, 'no workflow run on this SHA failed or was cancelled', verdict.red.length ? describe(verdict.red) : undefined);
    if (verdict.superseded.length) info('earlier runs superseded by a later run of the same workflow and event (listed, not counted)', describe(verdict.superseded));
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
  let stagingEngine = null;
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
    stagingEngine = h.database?.engine || null;
    check(stagingEngine === 'postgres', 'staging database engine is postgres', `running ${stagingEngine || 'unknown'}`);
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

  // ── the engine production serves (the verify command takes the deployed engine) ──
  let liveEngine = null;
  try {
    const live = await getJson(fetchImpl, `${productionOrigin}/v1/health`);
    const running = live.body?.releaseIdentity?.releaseSha;
    liveEngine = ENGINES.includes(live.body?.database?.engine) ? live.body.database.engine : null;
    info('production currently serves', running ? `${running}${running === expected ? ' (already this SHA)' : ''} on ${liveEngine || 'an unknown engine'}` : `unknown (status ${live.status})`);
  } catch { info('production currently serves', 'unreachable from here'); }
  const engine = productionEngine || liveEngine;
  check(ENGINES.includes(engine), 'production database engine known for the verify command',
    engine ? `${engine}${productionEngine ? ' (given with --production-engine)' : ' (as production serves now)'}`
      : 'production unreachable and no --production-engine given; pass --production-engine postgres|sqlite');
  if (engine === 'sqlite' && stagingEngine === 'postgres') {
    info('production still serves SQLite', 'the Postgres cutover (postgres-cutover.md §4.6 step 6) is a separate owner decision; for a promotion that follows the cutover in the same window run again with --production-engine postgres');
  }

  // ── release evidence for exactly this SHA (release stage) ──────────────────
  if (stage === 'candidate') {
    info('release evidence', 'not checked at the candidate stage (--candidate); the release-stage run requires the device matrix and the reader evidence for this SHA, or a recorded override, and only it prints the promotion');
  } else {
    // ── the strict Release Candidate gates ran on exactly this SHA ───────────
    // PR CI runs the physical-evidence and real-ink gates advisory; only
    // release-candidate.yml makes them blocking, so a release needs its run on
    // this commit — attributed, named and checked out as this SHA, both
    // blocking jobs `success` (a skipped or cancelled job proves nothing).
    const rc = releaseCandidateRun(runsOnSha, expected);
    let rcGreen = check(rc?.status === 'completed' && rc?.conclusion === 'success',
      'strict Release Candidate gates passed on exactly this SHA (release-candidate.yml)',
      rc ? `run ${rc.id}${rc.html_url ? ` ${rc.html_url}` : ''}: ${rc.status}${rc.conclusion ? '/' + rc.conclusion : ''}`
        : `no run named "${releaseCandidateTitle(expected)}" is attributed to this SHA: dispatch release-candidate.yml on main while main is at this SHA (release_sha empty or equal to it), or push a v* tag at it. A run that checked out another commit, or a workflow version without the exact-SHA binding, never counts`);
    let rcArtifacts = null;
    if (rcGreen) {
      try {
        const jobs = await ghAll(gh, `repos/${repo}/actions/runs/${rc.id}/jobs?per_page=${GH_PAGE}`, 'jobs');
        for (const name of RELEASE_CANDIDATE_JOBS) {
          const job = jobs.find(item => item?.name === name);
          rcGreen = check(job?.status === 'completed' && job?.conclusion === 'success', `Release Candidate job passed (not skipped): ${name}`,
            job ? `${job.status}${job.conclusion ? '/' + job.conclusion : ''}` : 'no job with this name in the run') && rcGreen;
        }
      } catch (error) { rcGreen = check(false, 'Release Candidate jobs readable (gh api)', error?.message || String(error)); }
      try { rcArtifacts = await ghAll(gh, `repos/${repo}/actions/runs/${rc.id}/artifacts?per_page=${GH_PAGE}`, 'artifacts'); }
      catch (error) { rcArtifacts = null; info('Release Candidate artifacts unreadable', error?.message || String(error)); }
    }
    // A reader report is release evidence only when the exact-SHA Release
    // Candidate run measured it: that run uploaded cloud-reader-eval-<sha>, and
    // the report was measured inside that run's window. The local file is the
    // artifact's JSON (gh run download <run> -n cloud-reader-eval-<sha>).
    const boundReader = evidence => {
      if (!evidence.ok) return evidence;
      const unbound = why => ({ ...evidence, ok: false, detail: `${evidence.detail} · not bound to an exact-SHA Release Candidate measurement: ${why}` });
      if (!rcGreen) return unbound('no passing Release Candidate run on this SHA');
      const name = readerArtifactName(expected);
      const artifact = (rcArtifacts || []).find(item => item?.name === name && item?.expired !== true);
      if (!artifact) return unbound(`run ${rc.id} has no unexpired artifact ${name} (dispatch it with measure_cloud_reader)`);
      const measured = Date.parse(evidence.report?.measuredAt || '');
      const from = Date.parse(rc.run_started_at || rc.created_at || '');
      const to = Date.parse(rc.updated_at || '');
      if (!(Number.isFinite(measured) && Number.isFinite(from) && Number.isFinite(to) && measured >= from && measured <= to)) {
        return unbound(`report measuredAt ${evidence.report?.measuredAt || '?'} is outside run ${rc.id} (${rc.run_started_at || '?'} – ${rc.updated_at || '?'}): use the JSON of artifact ${name}`);
      }
      return { ...evidence, detail: `${evidence.detail} · measured by Release Candidate run ${rc.id} (artifact ${name}, id ${artifact.id ?? '?'})` };
    };

    let override = null;
    let overrideUsable = false;
    if (overridePath) {
      override = loadOverride(resolve(overridePath), expected);
      const wellFormed = check(override.problems.length === 0, 'evidence override is well-formed and names this SHA',
        override.problems.length ? override.problems.join('; ') : `${override.path}: ${override.scope}; waives ${override.waives.join(', ')}; by ${override.by} (${override.githubLogin}) at ${override.at}`);
      if (wellFormed) {
        const publicScope = check(override.scope === 'public-release', 'evidence override is a public-release waiver',
          override.scope === 'public-release' ? 'scope public-release' : `scope ${override.scope}: an internal test-track exception is never approval for a public production release; it waives nothing here`);
        if (publicScope) {
          const auth = await verifyApproval({ approval: override.approval, githubLogin: override.githubLogin, sha: expected, marker: waiverMarker(expected, override.waives), repo, gh, ghGraphql, git, now });
          override.verified = auth;
          overrideUsable = check(auth.ok, `evidence override approved on GitHub by a repository admin (${APPROVAL_EVIDENCE_CLASS})`,
            auth.ok ? `${auth.url} by ${auth.login} at ${new Date(auth.createdAt).toISOString()}` : auth.problems.join('; '));
        }
      }
    }
    const waived = requirement => overrideUsable && override?.waives.includes(requirement) === true;
    const requirementRow = (requirement, label, evidence) => {
      if (evidence.ok) { check(true, label, evidence.detail); return; }
      if (waived(requirement)) {
        overrides.push({ requirement, by: override.by, githubLogin: override.verified.login, approval: override.verified.url, approvedAt: new Date(override.verified.createdAt).toISOString(), evidenceClass: APPROVAL_EVIDENCE_CLASS, at: override.at, reason: override.reason, path: override.path, state: evidence.detail });
        info(`${label} — WAIVED by recorded override`, `${evidence.detail}; by ${override.by} (${override.verified.login}, ${override.verified.url}) at ${override.at}: ${override.reason}`);
        return;
      }
      check(false, label, `${evidence.detail}; ${requirement === 'device-matrix' ? 'record every case as pass with scripts/device-matrix-record.mjs (blocked rows are recorded, never acceptance)' : 'measure the cloud reader in the Release Candidate run of this SHA (measure_cloud_reader) and use its artifact'}, or waive it by name in an --override record`);
    };
    requirementRow('device-matrix', 'device matrix complete for this SHA (every case pass on real hardware)', deviceEvidence(expected, { ledger: deviceLedger }));
    requirementRow('reader-evidence', 'real-human reader evaluation recorded for this SHA', boundReader(readerEvidence(expected, { dir: readerEvalDir })));
  }

  const ok = results.every(item => item.ok !== false);
  const promotion = ok && stage === 'release' ? promotionCommands(expected, { productionOrigin, engine }) : [];
  return { ok, sha: expected, stage, results, promotion, engine: ok ? engine : null, overrides };
}

async function main() {
  let args;
  const usage = 'Usage: node scripts/release-nominate.mjs <40-hex main SHA> [--candidate] [--no-fetch] [--json] [--override <record.json>] [--production-engine postgres|sqlite] [--staging <origin>] [--production <origin>] [--repo owner/name]';
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
  let report;
  try {
    report = await nominate({ sha: args.sha, stage: args.stage, repo: args.repo, stagingOrigin: args.staging, productionOrigin: args.production, productionEngine: args.productionEngine, overridePath: args.override, fetchOrigin: args.fetch });
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
    const title = report.stage === 'candidate' ? 'CANDIDATE' : 'NOMINATION';
    if (report.ok && report.stage === 'candidate') {
      console.log(`${title}: PASS — ${report.sha} — ${passed}/${counted} checks (release evidence not yet required)`);
      console.log('');
      console.log('This tool pushed nothing and printed no promotion. Next: staging acceptance A–D, the device matrix on the TestFlight / Play build of this SHA, the 24 h soak,');
      console.log('then `node scripts/release-nominate.mjs <sha>` without --candidate and `node scripts/release-dossier.mjs <sha>` (postgres-cutover.md §4.6).');
    } else if (report.ok) {
      console.log(`${title}: PASS — ${report.sha} — ${passed}/${counted} checks`);
      if (report.overrides.length) {
        console.log('');
        console.log('OVERRIDE RECORDED — this nomination stands on a waiver, not on the evidence:');
        for (const item of report.overrides) console.log(`  · ${item.requirement}: waived by ${item.by} at ${item.at} (${item.path}) — ${item.reason}`);
      }
      console.log('');
      console.log(`This tool pushed nothing. The verify command below takes the engine production serves (${report.engine}); a Postgres cutover is never inferred from a promotion (postgres-cutover.md §4.6 step 6).`);
      console.log('Before promoting: the 24 h clean staging soak (§4.5) under a merge freeze, acceptance A–D on staging (tools/acceptance/staging-acceptance.mjs),');
      console.log('the GO/NO-GO dossier for this exact SHA (scripts/release-dossier.mjs) and the approval the release record names (ios/PriLearning.swiftpm/RELEASE.md §11). Then, by hand:');
      console.log('');
      for (const line of report.promotion) console.log(`  ${line}`);
    } else {
      console.log(`${title}: FAIL — ${report.sha} — ${passed}/${counted} checks`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
