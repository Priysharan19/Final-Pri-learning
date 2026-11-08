#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exact-SHA GO/NO-GO dossier (issue #686 steps 25, 27, 28, 30;
// docs/operations/postgres-cutover.md §4.6; docs/release/release-policy.md)
//
// One record for one commit. The dossier gathers, for exactly one `main` SHA:
//
//   · the release-stage nomination (scripts/release-nominate.mjs: every
//     workflow green, required contexts, staging serves the SHA on Postgres,
//     fast-forward, device matrix and reader evidence or a recorded override);
//   · step 25 — the Release Staging Proof run on the SHA concluded success, and
//     a 24 h soak on staging at the SHA under a merge freeze: the soak window
//     in the operator's record is at least 24 h, staging served the SHA before
//     it began, no incident is recorded, and origin/main has not moved past the
//     SHA (a later merge redeploys staging and voids the soak, §4.6);
//   · staging acceptance A–D by a named human (tools/acceptance);
//   · the physical-device matrix rows for the SHA (PHYSICAL-HUMAN /
//     BLOCKED-EXTERNAL) and the real-human reader evaluation naming the SHA;
//   · step 23 — the gates only people can close (examiner, counsel, security,
//     native build, store, production data), each PASS with a named person or
//     else NO-GO. The production-data gate is the owner's D27 Yes for the
//     cutover window, so it is authenticated like the GO: gates.data.approval
//     links a GitHub comment or issue by a repository admin, unedited, posted
//     after the commit and the freeze, holding the line
//     `Pri-Production-Data-YES: <sha> target=production-postgres`;
//   · step 28 — the owner's GO, recorded in the record for exactly this SHA by
//     a named human AND posted as a GitHub comment by a repository admin that
//     contains the line `Pri-Release-GO: <sha> target=deploy/production`
//     (go.approval links it, go.githubLogin names the account). The comment is
//     the authority, not the file: it must be unedited and posted after the
//     soak ended and after the candidate was frozen (a GO given before the
//     evidence existed is stale). The generator never writes a GO; it verifies
//     one. Evidence class: GITHUB-ACCOUNT-AUTHENTICATED (the account, not the
//     person — the owner posts it themself in the GitHub web UI);
//   · step 29 — the promotion commands the nomination printed, by hand;
//   · step 30 — after the promotion, whether a later merge to `main` reached
//     staging unaided with a green Release Staging Proof (the no-repeat
//     pipeline). Before the promotion this section says "not yet".
//
// Verdict: GO-READY only when every gating row holds, including the owner's
// recorded GO for this SHA; otherwise NO-GO with the reasons. GO-READY is not
// a promotion: nothing here pushes, deploys or changes a setting.
//
// The record (docs/release/evidence/go-no-go/<sha>.json) holds the facts only
// people supply: soak times, who watched, who tested, the gate sign-offs, the
// owner's decision. `template <sha>` prints an empty one. Everything else is
// read from git, GitHub, the hosts and the evidence ledgers at run time.
//
//   node scripts/release-dossier.mjs <40-hex main SHA> [--record <path>] [--out <path>] [--json]
//     [--no-fetch] [--production-engine postgres|sqlite] [--staging <origin>] [--production <origin>] [--repo owner/name]
//   node scripts/release-dossier.mjs template <40-hex main SHA>
//
// Exit 0 GO-READY · 1 NO-GO · 2 usage or a dependency (git, gh).
// ─────────────────────────────────────────────────────────────────────────────
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  APPROVAL_EVIDENCE_CLASS, DEFAULT_READER_EVAL_DIR, DEFAULT_REPO, ENGINES, GREEN, PRODUCTION_ORIGIN, STAGING_ORIGIN,
  dataYesMarker, defaultGhGraphql, deviceEvidence, evaluateRuns, getJson, ghAll, goMarker, nominate, readerEvidence, verifyApproval
} from './release-nominate.mjs';
import { DEFAULT_LEDGER, NOT_A_HUMAN, reportMarkdown } from './device-matrix-record.mjs';

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;
const GH_PAGE = 100;

export const DOSSIER_DIR = join(ROOT, 'docs', 'release', 'evidence', 'go-no-go');
export const SOAK_HOURS = 24;
export const PROOF_WORKFLOW = 'Release Staging Proof';
export const GATE_STATUSES = Object.freeze(['PASS', 'BLOCKED', 'NOT_RECORDED']);
/** Step 23: the gates no script can close. Each must be PASS, by a named person, or the dossier is NO-GO. */
export const EXTERNAL_GATES = Object.freeze([
  { id: 'examiner', label: 'Independent examiner result (#499): marking policy and content at this SHA', ref: 'docs/release/EXAMINER-REQUEST.md' },
  { id: 'counsel', label: 'Written advice from Indian counsel: consent, notices, rights and the legal operator', ref: 'docs/legal/counsel/' },
  { id: 'security', label: 'Security review of this SHA: no release-blocking regression', ref: 'docs/security/acceptance.md' },
  { id: 'native', label: 'Native archive validated and TestFlight / Play internal build of this exact SHA', ref: 'ios/PriLearning.swiftpm/RELEASE.md §11' },
  { id: 'store', label: 'Store readiness: listings, privacy labels, Paid Apps Agreement, demo accounts', ref: 'docs/release/store/' },
  { id: 'data', label: 'Production database at this commit\'s schema, backup restore-tested, owner Yes for the window', ref: 'docs/operations/postgres-cutover.md §4.6 step 6' }
]);

export function recordTemplate(sha) {
  const gate = { status: 'NOT_RECORDED', by: '', at: '', evidence: '' };
  return {
    format: 'pri-go-no-go-record', version: 1, sha,
    candidate: { frozenAt: '', by: '', note: 'Step 21: the moment this SHA became the candidate and who declared the merge freeze.' },
    stagingProof: { result: '', runUrl: '', at: '' },
    soak: { startedAt: '', endedAt: '', watchedBy: '', incidents: 'none', mergeFreezeDeclaredBy: '' },
    acceptance: { result: '', report: '', tester: '', at: '' },
    gates: Object.fromEntries(EXTERNAL_GATES.map(g => [g.id, g.id === 'data' ? { ...gate, githubLogin: '', approval: '' } : { ...gate }])),
    overrides: null,
    reviews: [],
    go: { decision: null, by: '', githubLogin: '', approval: '', at: '', sha, statement: '' }
  };
}

export function parseArgs(argv) {
  const args = { command: 'build', sha: null, record: null, out: null, json: false, fetch: true, productionEngine: null, staging: STAGING_ORIGIN, production: PRODUCTION_ORIGIN, repo: DEFAULT_REPO };
  const rest = [...argv];
  if (rest[0] === 'template') { args.command = 'template'; rest.shift(); }
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    if (flag === '--no-fetch') { args.fetch = false; continue; }
    if (flag === '--json') { args.json = true; continue; }
    if (['--record', '--out', '--staging', '--production', '--repo', '--production-engine'].includes(flag)) {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      if (flag === '--production-engine') {
        if (!ENGINES.includes(value)) throw new Error('--production-engine must be postgres or sqlite');
        args.productionEngine = value;
      } else args[flag.slice(2)] = value;
      i += 1;
      continue;
    }
    if (flag.startsWith('--')) throw new Error(`Unknown argument: ${flag}`);
    if (args.sha) throw new Error('Give exactly one SHA');
    args.sha = flag;
  }
  if (!args.sha || !SHA.test(args.sha.toLowerCase())) throw new Error('A 40-hex main SHA is required');
  args.sha = args.sha.toLowerCase();
  if (!args.record) args.record = join(DOSSIER_DIR, `${args.sha}.json`);
  if (!args.out) args.out = join(DOSSIER_DIR, `${args.sha}.md`);
  return args;
}

const human = value => { const name = String(value || '').trim(); return name.length >= 3 && !NOT_A_HUMAN.test(name) ? name : null; };
const iso = value => { const t = Date.parse(String(value || '')); return Number.isFinite(t) ? t : null; };

/** Shape problems of the operator record; an empty list means the record can be evaluated (not that it passes). */
export function recordProblems(record, sha) {
  const problems = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['record must be a JSON object'];
  if (String(record.sha || '').toLowerCase() !== sha) problems.push(`record names sha ${record.sha || '(none)'}, not ${sha}`);
  for (const key of ['candidate', 'stagingProof', 'soak', 'acceptance', 'gates', 'go']) if (!record[key] || typeof record[key] !== 'object') problems.push(`record.${key} must be an object (run: node scripts/release-dossier.mjs template ${sha})`);
  for (const gate of EXTERNAL_GATES) {
    const status = record.gates?.[gate.id]?.status;
    if (status !== undefined && !GATE_STATUSES.includes(status)) problems.push(`gates.${gate.id}.status must be one of ${GATE_STATUSES.join(', ')}`);
  }
  if (record.go && record.go.decision !== null && record.go.decision !== undefined && !['GO', 'NO-GO'].includes(record.go.decision)) problems.push('go.decision must be GO, NO-GO or null');
  return problems;
}

async function defaultGit(args) {
  const { stdout } = await execFileP('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}
async function defaultGh(path) {
  const { stdout } = await execFileP('gh', ['api', path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
}

const fmtHours = ms => `${(ms / 3_600_000).toFixed(1)} h`;

/**
 * Builds the dossier. Returns { sha, verdict, reasons, rows, nomination, markdown, generatedAt }.
 * `rows`: { step, ok (true | false | null), label, detail, who, evidenceClass }.
 * Only rows with ok === false make the verdict NO-GO; ok === null rows inform.
 */
export async function buildDossier({
  sha,
  record,
  recordPath = null,
  repo = DEFAULT_REPO,
  stagingOrigin = STAGING_ORIGIN,
  productionOrigin = PRODUCTION_ORIGIN,
  productionEngine = null,
  deviceLedger = DEFAULT_LEDGER,
  readerEvalDir = DEFAULT_READER_EVAL_DIR,
  fetchOrigin = true,
  git = defaultGit,
  gh = defaultGh,
  ghGraphql = defaultGhGraphql,
  fetchImpl = globalThis.fetch,
  nominateImpl = nominate,
  now = Date.now()
}) {
  const expected = String(sha || '').trim().toLowerCase();
  if (!SHA.test(expected)) throw new Error('a 40-hex SHA is required');
  const rows = [];
  const row = (step, ok, label, detail, extra = {}) => { rows.push({ step, ok: ok === null ? null : !!ok, label, detail: detail ? String(detail) : '', who: extra.who || '', evidenceClass: extra.evidenceClass || '' }); return ok; };
  const generatedAt = new Date(now).toISOString();

  // ── the record ─────────────────────────────────────────────────────────────
  const problems = recordProblems(record, expected);
  row('record', problems.length === 0, 'operator record is well-formed and names this SHA', problems.length ? problems.join('; ') : (recordPath ? relative(ROOT, recordPath) : 'in-memory record'));
  const rec = problems.length ? recordTemplate(expected) : record;

  // ── step 21: candidate frozen ──────────────────────────────────────────────
  const frozenAt = iso(rec.candidate?.frozenAt), frozenBy = human(rec.candidate?.by);
  row(21, frozenAt !== null && frozenBy !== null && frozenAt <= now, 'candidate SHA frozen and the merge freeze declared by a named person',
    frozenAt !== null && frozenBy ? `${rec.candidate.frozenAt} by ${frozenBy}` : 'candidate.frozenAt / candidate.by not recorded', { who: frozenBy || '' });

  // ── nomination at the release stage ────────────────────────────────────────
  const overridePath = rec.overrides ? resolve(ROOT, String(rec.overrides)) : null;
  const nomination = await nominateImpl({ sha: expected, stage: 'release', repo, stagingOrigin, productionOrigin, productionEngine, overridePath, deviceLedger, readerEvalDir, fetchOrigin, git, gh, ghGraphql, fetchImpl, now });
  row('nominate', nomination.ok, 'release-stage nomination passes (scripts/release-nominate.mjs)',
    `${nomination.results.filter(r => r.ok === true).length}/${nomination.results.filter(r => r.ok !== null).length} checks${nomination.ok ? '' : '; failed: ' + nomination.results.filter(r => r.ok === false).map(r => r.label).join('; ')}`);

  // ── step 25a: Release Staging Proof on this SHA ────────────────────────────
  let runsOnSha = [];
  try {
    runsOnSha = await ghAll(gh, `repos/${repo}/actions/runs?head_sha=${expected}&per_page=${GH_PAGE}`, 'workflow_runs');
    const proof = evaluateRuns(runsOnSha.filter(run => run?.name === PROOF_WORKFLOW));
    const green = proof.latest.filter(run => run.status === 'completed' && GREEN.has(run.conclusion));
    row(25, green.length > 0 && proof.red.length === 0 && proof.pending.length === 0, `${PROOF_WORKFLOW} concluded success on this SHA (verify:deployment 14/14 on staging)`,
      proof.latest.length ? proof.latest.map(run => `${run.event || 'run'}: ${run.status}/${run.conclusion || '…'}${run.html_url ? ' ' + run.html_url : ''}`).join('; ') : `no ${PROOF_WORKFLOW} run has this head SHA (dispatch it, or wait for Main Integrity to trigger it)`);
  } catch (error) {
    if (error?.code === 'ENOENT') throw Object.assign(new Error('gh (GitHub CLI) is not installed or not on PATH'), { code: 'DEPENDENCY' });
    row(25, false, `${PROOF_WORKFLOW} concluded success on this SHA (verify:deployment 14/14 on staging)`, error?.message || String(error));
  }
  row(25, null, 'staging proof as recorded by the operator', [rec.stagingProof?.result, rec.stagingProof?.runUrl, rec.stagingProof?.at].filter(Boolean).join(' · ') || 'stagingProof not recorded');

  // ── step 25b: the 24 h soak under a merge freeze ───────────────────────────
  const soakStart = iso(rec.soak?.startedAt), soakEnd = iso(rec.soak?.endedAt), watcher = human(rec.soak?.watchedBy);
  const incidents = rec.soak?.incidents;
  const noIncident = incidents === undefined || incidents === null || incidents === 'none' || incidents === '' || (Array.isArray(incidents) && incidents.length === 0);
  const soakLong = soakStart !== null && soakEnd !== null && soakEnd - soakStart >= SOAK_HOURS * 3_600_000 && soakEnd <= now;
  row(25, soakLong, `soak window of at least ${SOAK_HOURS} h recorded and ended`,
    soakStart !== null && soakEnd !== null ? `${rec.soak.startedAt} → ${rec.soak.endedAt} (${fmtHours(soakEnd - soakStart)})${soakEnd > now ? '; ends in the future' : ''}` : 'soak.startedAt / soak.endedAt not recorded');
  row(25, watcher !== null, 'soak watched by a named person', watcher || 'soak.watchedBy does not name a human', { who: watcher || '' });
  row(25, noIncident, 'no /v1 500, pool error or unexplained 503 during the soak (§4.5)', noIncident ? 'none recorded' : `incidents recorded: ${Array.isArray(incidents) ? incidents.join('; ') : incidents} — fix, then restart the soak`);
  let built = null;
  try {
    const health = await getJson(fetchImpl, `${stagingOrigin}/v1/health`);
    built = iso(health.body?.releaseIdentity?.buildTimestamp);
    const servesSha = health.body?.releaseIdentity?.releaseSha === expected;
    row(25, servesSha && built !== null && soakStart !== null && built <= soakStart, 'staging served this SHA before the soak began (buildTimestamp ≤ soak start)',
      `staging serves ${health.body?.releaseIdentity?.releaseSha || 'unknown'}, built ${health.body?.releaseIdentity?.buildTimestamp || 'unknown'}`);
  } catch (error) { row(25, false, 'staging served this SHA before the soak began (buildTimestamp ≤ soak start)', error?.message || String(error)); }
  let tip = null, ahead = null;
  try {
    tip = (await git(['rev-parse', 'origin/main'])).trim();
    ahead = tip === expected ? 0 : Number((await git(['rev-list', '--count', `${expected}..origin/main`])).trim());
    row(25, ahead === 0, 'merge freeze held: origin/main has not moved past the SHA (a later merge redeploys staging and voids the soak)',
      ahead === 0 ? 'origin/main is this SHA' : `${ahead} commit(s) on origin/main after the SHA (tip ${tip.slice(0, 12)}); the soak clock belongs to one SHA (§4.6)`);
  } catch (error) { row(25, false, 'merge freeze held: origin/main has not moved past the SHA', error?.message || String(error)); }

  // ── §4.6 step 3: staging acceptance A–D ────────────────────────────────────
  const tester = human(rec.acceptance?.tester);
  row('acceptance', rec.acceptance?.result === 'PASS' && tester !== null, 'staging acceptance A–D passed, run by a named human (tools/acceptance/staging-acceptance.mjs)',
    rec.acceptance?.result ? `${rec.acceptance.result}${tester ? ' by ' + tester : ' (tester not a named human)'}${rec.acceptance.report ? ' · ' + rec.acceptance.report : ''}${rec.acceptance.at ? ' · ' + rec.acceptance.at : ''}` : 'acceptance not recorded',
    { who: tester || '', evidenceClass: 'real mailbox / synthetic pictures / test accounts (the report labels each step)' });

  // ── evidence ledgers (also inside the nomination; shown here in full) ──────
  const device = deviceEvidence(expected, { ledger: deviceLedger });
  row('device', null, 'physical-device matrix for this SHA', device.detail, { evidenceClass: 'PHYSICAL-HUMAN (pass/fail) · BLOCKED-EXTERNAL (blocked)' });
  const reader = readerEvidence(expected, { dir: readerEvalDir });
  row('reader', null, 'real-human evaluation of the server reader for this SHA', reader.detail, { evidenceClass: reader.ok ? 'real-human' : 'NOT MEASURED' });
  for (const item of nomination.overrides) row('override', null, `OVERRIDE: ${item.requirement} waived`, `${item.state}; by ${item.by} (${item.githubLogin}, ${item.approval}, approved ${item.approvedAt}) at ${item.at}: ${item.reason} (${relative(ROOT, item.path)})`, { who: item.by, evidenceClass: item.evidenceClass });

  // ── step 23: gates only people can close ───────────────────────────────────
  for (const gate of EXTERNAL_GATES) {
    const entry = rec.gates?.[gate.id] || {};
    const by = human(entry.by), at = iso(entry.at);
    let ok = entry.status === 'PASS' && by !== null && at !== null && at <= now;
    let approvalNote = '';
    let evidenceClass = '';
    if (gate.id === 'data' && ok) {
      // D27: the owner's Yes for the irreversible data step, authenticated on GitHub, for this SHA,
      // given after the candidate was frozen (a Yes before the freeze approved another window).
      const auth = await verifyApproval({ approval: entry.approval, githubLogin: entry.githubLogin, sha: expected, marker: dataYesMarker(expected), repo, gh, ghGraphql, git, now });
      const premature = auth.ok && frozenAt !== null && auth.createdAt < frozenAt;
      ok = auth.ok && !premature;
      evidenceClass = APPROVAL_EVIDENCE_CLASS;
      approvalNote = auth.ok
        ? (premature ? ` · the owner's Yes (${new Date(auth.createdAt).toISOString()}) predates the candidate freeze; post a new one for this window` : ` · owner's Yes ${auth.url} by ${auth.login} at ${new Date(auth.createdAt).toISOString()}`)
        : ` · the owner's D27 Yes does not hold: ${auth.problems.join('; ')}`;
    }
    row(23, ok, gate.label, ok ? `PASS by ${by} at ${entry.at}${entry.evidence ? ' · ' + entry.evidence : ''}${approvalNote}` : `${entry.status || 'NOT_RECORDED'}${entry.status === 'PASS' && !by ? ' (by does not name a human)' : ''}${entry.status === 'PASS' && at === null ? ' (at is not an ISO date-time)' : ''}${entry.evidence ? ' · ' + entry.evidence : ''}${approvalNote} — ${gate.ref}`, { who: by || '', evidenceClass });
  }

  // ── step 26: no release controller; the promotion is an owner fast-forward ─
  row(26, null, 'release controller', 'none: the promotion is one fast-forward of deploy/production by the approver the release record names (release-policy.md); branch protection refuses a commit without the four green contexts');

  // ── step 28: the owner's GO for exactly this SHA ───────────────────────────
  const go = rec.go || {};
  const goBy = human(go.by), goAt = iso(go.at);
  const goRecorded = go.decision === 'GO' && String(go.sha || '').toLowerCase() === expected && goBy !== null && goAt !== null && goAt <= now && String(go.statement || '').trim().length > 0;
  let goAuth = null;
  if (go.decision === 'GO') goAuth = await verifyApproval({ approval: go.approval, githubLogin: go.githubLogin, sha: expected, marker: goMarker(expected), repo, gh, ghGraphql, git, now });
  // A GO is an answer to the evidence: given before the soak ended or before the SHA was frozen,
  // it approved something that did not exist yet.
  const approvedAt = goAuth?.ok ? goAuth.createdAt : null;
  const goPremature = approvedAt !== null && ((soakEnd !== null && approvedAt < soakEnd) || (frozenAt !== null && approvedAt < frozenAt));
  const goOk = goRecorded && goAuth?.ok === true && !goPremature;
  row(28, goOk, 'owner GO for exactly this SHA, approved on GitHub by a repository admin after the soak',
    go.decision === 'GO'
      ? (goOk ? `GO by ${goBy} (${goAuth.login}, ${goAuth.url} at ${new Date(approvedAt).toISOString()}): ${String(go.statement).trim()}`
        : `GO recorded but ${[String(go.sha || '').toLowerCase() !== expected ? `for sha ${go.sha || '(none)'}, not this one` : null, !goBy ? 'go.by does not name a human' : null, goAt === null ? 'go.at is not an ISO date-time' : null, goAt !== null && goAt > now ? 'go.at is in the future' : null, !String(go.statement || '').trim() ? 'go.statement is empty' : null, goAuth && !goAuth.ok ? `the GitHub approval does not hold: ${goAuth.problems.join('; ')}` : null, goPremature ? `the GitHub approval (${new Date(approvedAt).toISOString()}) predates ${soakEnd !== null && approvedAt < soakEnd ? 'the end of the soak' : 'the candidate freeze'}: a GO given before the evidence existed is stale` : null].filter(Boolean).join('; ')}`)
      : go.decision === 'NO-GO' ? `NO-GO by ${go.by || '?'} at ${go.at || '?'}: ${go.statement || ''}` : 'not recorded (go.decision is null); only the owner records it, in the record file and as a GitHub comment, for this exact SHA',
    { who: goBy || '', evidenceClass: go.decision === 'GO' ? APPROVAL_EVIDENCE_CLASS : '' });

  // ── step 30: after the promotion, the pipeline works unaided ───────────────
  let prodSha = null;
  try { const live = await getJson(fetchImpl, `${productionOrigin}/v1/health`); prodSha = live.body?.releaseIdentity?.releaseSha || null; } catch { prodSha = null; }
  if (prodSha !== expected) {
    row(30, null, 'no-repeat pipeline certified (a later merge reached staging unaided with a green proof)', `not yet: production serves ${prodSha || 'unknown'}, not this SHA; re-run this dossier after the promotion and the next merge`);
  } else if (!tip || tip === expected) {
    row(30, null, 'no-repeat pipeline certified (a later merge reached staging unaided with a green proof)', 'not yet: production serves this SHA and origin/main has not moved; re-run after the next merge to main');
  } else {
    try {
      const [stagingHealth, tipRuns] = await Promise.all([
        getJson(fetchImpl, `${stagingOrigin}/v1/health`),
        ghAll(gh, `repos/${repo}/actions/runs?head_sha=${tip}&per_page=${GH_PAGE}`, 'workflow_runs')
      ]);
      const stagingSha = stagingHealth.body?.releaseIdentity?.releaseSha;
      const proof = evaluateRuns(tipRuns.filter(run => run?.name === PROOF_WORKFLOW));
      const proofGreen = proof.latest.length > 0 && proof.red.length === 0 && proof.pending.length === 0;
      const certified = stagingSha === tip && proofGreen;
      row(30, null, `no-repeat pipeline ${certified ? 'CERTIFIED' : 'not yet certified'} (a later merge reached staging unaided with a green proof)`,
        `production serves this SHA; origin/main tip ${tip.slice(0, 12)} (${ahead} commit(s) later); staging serves ${stagingSha || 'unknown'}; ${PROOF_WORKFLOW} on the tip: ${proof.latest.length ? proof.latest.map(run => `${run.status}/${run.conclusion || '…'}`).join(', ') : 'no run yet'}`);
    } catch (error) { row(30, null, 'no-repeat pipeline (a later merge reached staging unaided with a green proof)', `could not be read: ${error?.message || error}`); }
  }

  const failing = rows.filter(r => r.ok === false);
  const verdict = failing.length === 0 ? 'GO-READY' : 'NO-GO';
  const reasons = failing.map(r => r.label);
  const result = { sha: expected, verdict, reasons, rows, nomination, generatedAt, recordPath: recordPath ? relative(ROOT, recordPath) : null };
  result.markdown = renderMarkdown(result, { device, reader });
  return result;
}

function mark(ok) { return ok === null ? '·' : ok ? 'PASS' : 'FAIL'; }
// Untrusted text (ledger notes, report fields, record entries, API details)
// reaches the Markdown only through these. CommonMark ends a line at \r\n, a
// bare \r or \n, so every line ending (and the other vertical separators) is
// flattened first: a detail such as `ok\r\r# GO CERTIFIED` can never open a
// forged heading or table row. A line that starts with untrusted text has its
// leading block marker escaped so it cannot become a heading, quote or list.
// In a table cell, backslashes go before pipes: `x\\| PASS |` stays inside its
// own cell and can never add a forged column to the GO/NO-GO table.
export const LINE_BREAKS = /\r\n|[\r\n\u000b\u000c\u0085\u2028\u2029]/g;
export function inline(text) { return String(text ?? '').replace(LINE_BREAKS, ' '); }
export function cell(text) { return inline(text).replace(/\\/g, '\\\\').replace(/\|/g, '\\|'); }
export function para(text) { return inline(text).replace(/^(\s*)([#>*+=|`~<_-])/, '$1\\$2').replace(/^(\s*\d+)([.)])/, '$1\\$2'); }

export function renderMarkdown(result, { device, reader } = {}) {
  const { sha, verdict, reasons, rows, nomination, generatedAt, recordPath } = result;
  const by = step => rows.filter(r => r.step === step);
  const table = list => ['| Result | Check | Evidence | Who |', '|---|---|---|---|', ...list.map(r => `| ${mark(r.ok)} | ${cell(r.label)} | ${cell(r.detail)} | ${cell(r.who)} |`)].join('\n');
  const lines = [];
  lines.push(`# GO/NO-GO dossier — \`${sha}\``, '');
  lines.push(`Generated ${generatedAt} by \`node scripts/release-dossier.mjs ${sha}\`${recordPath ? ` from \`${recordPath}\`` : ''}. One record for one exact commit (issue #686 steps 25, 27, 28 and 30; \`docs/operations/postgres-cutover.md\` §4.6). It pushes nothing, deploys nothing and authorises nothing: GO is the owner's recorded decision (step 28), and the promotion is step 29, by hand.`, '');
  lines.push(`## Verdict: **${verdict}**`, '');
  if (verdict === 'NO-GO') { lines.push('Not ready because:', '', ...reasons.map(r => `- ${para(r)}`), ''); }
  else lines.push('Every gating row holds for this exact SHA, including the owner\'s recorded GO. The promotion commands in step 29 are run by hand by the approver the release record names.', '');
  lines.push('## Record and candidate (step 21)', '', table([...by('record'), ...by(21)]), '');
  lines.push('## Release-stage nomination (`scripts/release-nominate.mjs`)', '', table(by('nominate')), '');
  lines.push('| | Nomination row | Detail |', '|---|---|---|', ...nomination.results.map(r => `| ${r.ok === null ? '·' : r.ok ? '✓' : '✗'} | ${cell(r.label)} | ${cell(r.detail || '')} |`), '');
  lines.push('## Step 25 — staging proof and the 24 h soak under a merge freeze', '', table(by(25)), '');
  lines.push('## Staging acceptance A–D (§4.6 step 3)', '', table(by('acceptance')), '');
  lines.push('## Physical-device matrix for this SHA', '', ...by('device').map(r => `${para(r.detail)} — evidence class: ${inline(r.evidenceClass)}`), '');
  if (device?.summary) lines.push(reportMarkdown(device.summary), '');
  lines.push('## Server reader evidence for this SHA', '', ...by('reader').map(r => `${para(r.detail)} — evidence class: ${inline(r.evidenceClass)}`), '');
  const overrides = by('override');
  lines.push('## Overrides', '', overrides.length ? table(overrides) : 'None: the nomination stands on the evidence, not on a waiver.', '');
  lines.push('## Step 23 — gates only people can close', '', table(by(23)), '');
  lines.push('## Step 26 — release controller', '', ...by(26).map(r => para(r.detail)), '');
  lines.push('## Step 28 — owner GO for exactly this SHA', '', table(by(28)), '');
  lines.push('## Step 29 — promotion, by hand, after GO', '');
  if (verdict === 'GO-READY' && nomination.promotion.length) lines.push('```bash', ...nomination.promotion, '```', '');
  else lines.push('Not printed: the dossier is NO-GO. The nomination prints the commands once every row holds.', '');
  lines.push('## Step 30 — the no-repeat pipeline (after the promotion)', '', table(by(30)), '');
  lines.push('## Evidence classes', '', '- **deterministic**: git, GitHub Actions conclusions, host `/v1/health` and `/v1/ready` reads, the committed ledgers.', '- **PHYSICAL-HUMAN**: a device-matrix pass or fail recorded by a named tester on real hardware; **BLOCKED-EXTERNAL**: a case recorded as not runnable.', '- **real-human**: a cloud-reader evaluation of the committed real-ink corpus against the live provider; a dry run is labelled synthetic and never counts.', '- **person**: a sign-off, a soak watch, an acceptance run or the owner\'s GO, each with the name recorded. The generator verifies the record; it never supplies a name.', '', 'Nothing in this dossier is a store submission, a legal opinion, an examiner result or a benchmark claim; those rows only record that such a result was given, by whom and where it lives.', '');
  return lines.join('\n');
}

async function main() {
  const usage = 'Usage: node scripts/release-dossier.mjs <40-hex main SHA> [--record <path>] [--out <path>] [--json] [--no-fetch] [--production-engine postgres|sqlite] [--staging <origin>] [--production <origin>] [--repo owner/name]\n       node scripts/release-dossier.mjs template <40-hex main SHA>';
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
  if (args.command === 'template') {
    const text = JSON.stringify(recordTemplate(args.sha), null, 2) + '\n';
    if (existsSync(args.record)) { console.error(`${args.record} already exists; not overwriting`); process.exit(2); }
    mkdirSync(dirname(args.record), { recursive: true });
    writeFileSync(args.record, text);
    console.log(`wrote ${relative(ROOT, args.record)} — fill in the facts only people supply, then run: node scripts/release-dossier.mjs ${args.sha}`);
    process.exit(0);
  }
  let record = null;
  try { record = JSON.parse(readFileSync(args.record, 'utf8')); }
  catch (error) { console.error(`${args.record}: ${error?.code === 'ENOENT' ? 'no such record; start one with: node scripts/release-dossier.mjs template ' + args.sha : 'not JSON'}`); process.exit(2); }
  let result;
  try {
    result = await buildDossier({ sha: args.sha, record, recordPath: args.record, repo: args.repo, stagingOrigin: args.staging, productionOrigin: args.production, productionEngine: args.productionEngine, fetchOrigin: args.fetch });
  } catch (error) { console.error(error?.message || String(error)); process.exit(2); }
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, result.markdown);
  if (args.json) console.log(JSON.stringify({ ...result, markdown: undefined, out: relative(ROOT, args.out) }, null, 2));
  else {
    for (const r of result.rows) console.log(`  ${r.ok === null ? '·' : r.ok ? '✓' : '✗'} [${r.step}] ${r.label}${r.detail ? `  (${r.detail})` : ''}`);
    console.log(`DOSSIER: ${result.verdict} — ${result.sha} — written to ${relative(ROOT, args.out)}`);
    if (result.verdict === 'NO-GO') for (const reason of result.reasons) console.log(`  - ${reason}`);
    else console.log('GO-READY is not a promotion. Step 29 is run by hand by the approver the release record names.');
  }
  process.exit(result.verdict === 'GO-READY' ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
