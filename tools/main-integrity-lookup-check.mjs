#!/usr/bin/env node
// MAIN INTEGRITY LOOKUP — the provenance audit's shell script, run against a
// stub GitHub API.
//
// .github/workflows/main-integrity.yml asks GET /commits/{sha}/pulls which
// merged pull request produced a main commit. That listing is eventually
// consistent: run 39046063072 started 3 s after #515 merged, saw an empty
// list and reported e1d0f08c2 as "not the recorded merge result of a merged
// pull request" (the same call returns #515 today). The workflow now retries
// the lookup 5 × 10 s before declaring that. This check extracts the step's
// script from the workflow file verbatim and runs it with `curl` and `sleep`
// replaced by stubs, so the retry, its bound, and the unchanged rules — every
// latest workflow on the exact PR head complete and green, CI successful —
// are each exercised deterministically. Needs bash and jq (both on the
// hosted ubuntu image).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'main-integrity.yml');

let passed = 0;
const failures = [];
const check = (condition, message) => { if (condition) passed += 1; else failures.push(message); };

// jq is a precondition of the workflow itself; on CI its absence is a failure.
if (spawnSync('jq', ['--version'], { encoding: 'utf8' }).status !== 0) {
  if (process.env.CI) { console.error('MAIN INTEGRITY LOOKUP: FAIL — jq is not installed on this runner'); process.exit(1); }
  console.log('MAIN INTEGRITY LOOKUP: SKIPPED — jq is not installed here (CI runs it)');
  process.exit(0);
}

// ── the step's script, verbatim ──────────────────────────────────────────────
function extractRunBlock(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(l => /^\s*run:\s*\|\s*$/.test(l));
  if (start < 0) throw new Error('main-integrity.yml has no `run: |` block');
  const first = lines.slice(start + 1).find(l => l.trim() !== '');
  const indent = first.match(/^\s*/)[0];
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') { body.push(''); continue; }
    if (!line.startsWith(indent)) break;
    body.push(line.slice(indent.length));
  }
  return body.join('\n') + '\n';
}
const workflow = readFileSync(WORKFLOW, 'utf8');
const script = extractRunBlock(workflow);
check(/set -euo pipefail/.test(script), 'the audit script fails closed (set -euo pipefail)');
check(/for attempt in 1 2 3 4 5; do/.test(script) && /sleep 10/.test(script), 'the merged-PR lookup retries 5 × 10 s');
check(/not the recorded merge result of a merged pull request/.test(script), 'an unrecorded commit is still refused after the retries');

// ── a stub GitHub API and a stub clock ───────────────────────────────────────
const SHA = 'e1d0f08c2000000000000000000000000000abcd';
const HEAD = '95930d70a000000000000000000000000000beef';
const pullsJson = (base = 'main') => JSON.stringify([{
  number: 515, html_url: 'https://github.com/o/r/pull/515', merged_at: '2026-10-17T15:40:11Z', merge_commit_sha: SHA,
  base: { ref: base }, head: { sha: HEAD },
}]);
const run = (id, name, status, conclusion, updated = '2026-10-17T15:30:00Z') => ({ workflow_id: id, name, status, conclusion, updated_at: updated });
const runsJson = runs => JSON.stringify({ workflow_runs: runs });
const GREEN = [run(1, 'CI', 'completed', 'success'), run(2, 'Native Ink', 'completed', 'success'), run(3, 'CodeQL', 'completed', 'skipped')];

const scratch = mkdtempSync(path.join(tmpdir(), 'pri-main-integrity-'));
const bin = path.join(scratch, 'bin');
mkdirSync(bin);
writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
# Stub GitHub API: the URL is the last argument; everything else is ignored.
url="\${@: -1}"
case "$url" in
  */commits/*/pulls)
    n=$(cat "$STUB_STATE/pulls-calls" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$STUB_STATE/pulls-calls"
    if [ "$n" -le "\${STUB_PULLS_EMPTY_UNTIL:-0}" ]; then echo '[]'; else cat "$STUB_STATE/pulls.json"; fi ;;
  */actions/runs*) echo "$url" >> "$STUB_STATE/runs-urls"; cat "$STUB_STATE/runs.json" ;;
  *) echo "stub curl: unexpected url $url" >&2; exit 22 ;;
esac
`);
writeFileSync(path.join(bin, 'sleep'), '#!/usr/bin/env bash\necho "$1" >> "$STUB_STATE/sleeps"\n');
chmodSync(path.join(bin, 'curl'), 0o755);
chmodSync(path.join(bin, 'sleep'), 0o755);
const scriptPath = path.join(scratch, 'main-integrity.sh');
writeFileSync(scriptPath, script);

function audit({ emptyUntil = 0, pulls = pullsJson(), runs = runsJson(GREEN) }) {
  const state = mkdtempSync(path.join(scratch, 'state-'));
  writeFileSync(path.join(state, 'pulls.json'), pulls);
  writeFileSync(path.join(state, 'runs.json'), runs);
  const result = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_STATE: state, STUB_PULLS_EMPTY_UNTIL: String(emptyUntil),
      GH_TOKEN: 'stub-token', REPO: 'o/r', SHA, API: 'https://api.github.example',
    },
  });
  const read = f => (existsSync(path.join(state, f)) ? readFileSync(path.join(state, f), 'utf8').trim() : '');
  return {
    status: result.status, out: `${result.stdout}\n${result.stderr}`,
    sleeps: read('sleeps').split('\n').filter(Boolean), pullsCalls: Number(read('pulls-calls') || 0), runsLookups: read('runs-urls').split('\n').filter(Boolean),
  };
}

// 1. The listing lags, then names the PR: the audit waits and passes.
{
  const r = audit({ emptyUntil: 2 });
  check(r.status === 0, `a listing that lags two reads is tolerated (exit ${r.status})\n${r.out}`);
  check(r.pullsCalls === 3, `the lookup was asked three times (${r.pullsCalls})`);
  check(JSON.stringify(r.sleeps) === '["10","10"]', `it waited 10 s between attempts, twice (${JSON.stringify(r.sleeps)})`);
  check(/attempt 1 of 5/.test(r.out) && /attempt 2 of 5/.test(r.out) && !/attempt 3 of 5/.test(r.out), 'each retry is announced with its number');
  check(/Found merged PR #515/.test(r.out) && new RegExp(`Exact PR head: ${HEAD}`).test(r.out), 'the merged PR and its exact head are reported');
  check(/Main integrity verified/.test(r.out), 'the audit then verifies the head as before');
  check(r.runsLookups.length === 1 && r.runsLookups[0].includes(`head_sha=${HEAD}`) && r.runsLookups[0].includes('event=pull_request'), 'the workflow runs are read for the exact PR head, pull_request event');
}

// 2. The listing never names a PR: still refused, after exactly five attempts.
{
  const r = audit({ emptyUntil: 99 });
  check(r.status === 1, `a commit no merged PR produced is refused (exit ${r.status})`);
  check(/::error::main commit .* is not the recorded merge result of a merged pull request targeting main/.test(r.out), 'with the direct-push error');
  check(r.pullsCalls === 5, `after five lookups (${r.pullsCalls})`);
  check(JSON.stringify(r.sleeps) === '["10","10","10","10"]', `and four 10 s waits — none after the last attempt (${JSON.stringify(r.sleeps)})`);
  check(r.runsLookups.length === 0, 'no workflow evidence is read for a commit with no PR');
}

// 3. A merged PR into another base with the same merge sha does not count.
{
  const r = audit({ pulls: pullsJson('develop') });
  check(r.status === 1 && /not the recorded merge result/.test(r.out) && r.pullsCalls === 5, 'a PR merged into another branch is not provenance for main');
}

// 4. The rules on the PR head are unchanged: pending, failing and CI-less heads fail.
{
  const r = audit({ runs: runsJson([run(1, 'CI', 'completed', 'success'), run(2, 'Native Ink', 'in_progress', null)]) });
  check(r.status === 1 && /merged while 1 latest workflow\(s\) were still pending/.test(r.out), 'a merge while Native Ink was in progress is refused');
  check(r.sleeps.length === 0 && r.pullsCalls === 1, 'a listing that answers at once costs no wait');
}
{
  const r = audit({ runs: runsJson([run(1, 'CI', 'completed', 'success'), run(2, 'Native Ink', 'completed', 'failure')]) });
  check(r.status === 1 && /merged with 1 latest workflow\(s\) in a failing\/cancelled\/timed-out state/.test(r.out), 'a merge over a failed Native Ink is refused');
}
{
  const r = audit({ runs: runsJson([run(2, 'Native Ink', 'completed', 'success')]) });
  check(r.status === 1 && /has no successful completed CI workflow/.test(r.out), 'a head without a successful CI run is refused');
}
{
  // Only the latest run per workflow counts: an older cancelled CI run is superseded by a later success.
  const r = audit({ runs: runsJson([run(1, 'CI', 'completed', 'cancelled', '2026-10-17T15:00:00Z'), run(1, 'CI', 'completed', 'success', '2026-10-17T15:30:00Z')]) });
  check(r.status === 0 && /Latest PR workflows measured: 1/.test(r.out), 'a superseded run of the same workflow does not count against the head');
}
{
  const r = audit({ runs: runsJson([]) });
  check(r.status === 1 && /no pull-request workflow evidence exists/.test(r.out), 'a head with no workflow runs at all is refused');
}

// 5. Everything green at once: no wait, pass.
{
  const r = audit({});
  check(r.status === 0 && r.sleeps.length === 0 && r.pullsCalls === 1, `a consistent listing passes without waiting (exit ${r.status}, sleeps ${r.sleeps.length})`);
}

rmSync(scratch, { recursive: true, force: true });

const total = passed + failures.length;
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`MAIN INTEGRITY LOOKUP: FAIL — ${passed}/${total} checks`);
  process.exit(1);
}
console.log(`MAIN INTEGRITY LOOKUP: PASS — ${passed}/${total} checks — the merged-PR lookup retries 5 × 10 s, a commit with no merged PR is still refused, and every latest workflow on the exact PR head must be complete and green.`);
