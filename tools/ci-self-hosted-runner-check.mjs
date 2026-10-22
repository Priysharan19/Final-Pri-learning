#!/usr/bin/env node
// SELF-HOSTED RUNNER CONTRACT (GitHub issue #227).
//
// Pri Learning is a public repository. GitHub's secure-use guidance says a
// self-hosted runner on a public repository can be compromised by untrusted
// workflow code, so the only self-hosted lane (the Pri Mac) is reachable solely
// by the owner, by manual dispatch, for an exact SHA on main, on a one-job
// runner whose label is fresh for that run. Every workflow whose job is not on
// a GitHub-hosted image is held to that contract here:
//
//   1. triggers: workflow_dispatch only (no pull_request, pull_request_target,
//      push, issue_comment, schedule, workflow_run, ...);
//   2. required inputs `sha` and `runner_label`;
//   3. top-level `permissions: contents: read` and no write scope anywhere;
//   4. the self-hosted job `needs` a GitHub-hosted guard job that validates the
//      SHA (40 hex) and label (pri-mac-<16 hex), requires the repository owner
//      and the canonical repository, and proves the SHA is reachable from main;
//   5. runs-on includes self-hosted, macOS, ARM64 and `${{ inputs.runner_label }}`;
//   6. its first step is actions/checkout of `${{ inputs.sha }}` with
//      persist-credentials: false, the second asserts `git rev-parse HEAD`
//      equals the dispatched SHA, and there is no other checkout;
//   7. no `${{ }}` expression inside any `run:` script (inputs go through env),
//      no `secrets.` and no persisted credentials.
//
// It also checks scripts/pri-mac-runner-once.sh statically (JIT/ephemeral,
// admin refusal, exit-trap cleanup, no credential in output or argv) and
// behaviourally against a fake runner tarball (no network, no GitHub), and
// proves every rule with a negative fixture so the checker cannot pass vacuously.
// Dependency-free and line-oriented, like tools/ci-workflow-policy-check.mjs.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const MAC_WORKFLOW = 'pri-mac-v1-acceptance.yml';
const RUNNER_SCRIPT = path.join(ROOT, 'scripts', 'pri-mac-runner-once.sh');
const CANONICAL_REPO = 'Priysharan19/Final-Pri-learning';
const LABEL_INPUT = '${{ inputs.runner_label }}';
const SHA_INPUT = '${{ inputs.sha }}';
const GITHUB_HOSTED = /^(ubuntu|macos|windows)-[0-9a-z][0-9a-z.-]*$/;
const STATUS_LINE = 'status="$(gh api "repos/$REPO/compare/$INPUT_SHA...main" --jq \'.status + " " + (.behind_by | tostring)\')"';
const escapeRe = s => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
// A run-script line that is exactly `line` (or starts with it when prefix).
const hasLine = (run, line, prefix = false) =>
  new RegExp(`^\\s*${escapeRe(line)}${prefix ? '' : '\\s*$'}`, 'm').test(run ?? '');

// ---------------------------------------------------------------- YAML-ish ---
const indentOf = line => line.match(/^ */)[0].length;
const isBlank = line => /^\s*(#.*)?$/.test(line);

function stripComment(value) {
  const v = value.trim();
  if (/^['"]/.test(v)) {
    const q = v[0];
    const end = v.indexOf(q, 1);
    return end === -1 ? v : v.slice(0, end + 1);
  }
  const idx = v.search(/\s#/);
  return (idx === -1 ? v : v.slice(0, idx)).trim();
}

function scalar(value) {
  return stripComment(value ?? '').replace(/^(['"])(.*)\1$/, '$2').trim();
}

function flowList(value) {
  const v = stripComment(value ?? '');
  if (!/^\[.*\]$/.test(v)) return v ? [scalar(v)] : [];
  return v.slice(1, -1).split(',').map(s => scalar(s)).filter(Boolean);
}

// Mapping entries at the shallowest indentation of `lines`.
function entries(lines) {
  const content = lines.filter(l => !isBlank(l));
  if (!content.length) return [];
  const level = Math.min(...content.map(indentOf));
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isBlank(line) || indentOf(line) !== level) continue;
    const m = line.match(/^\s*(['"]?)([A-Za-z0-9_.-]+)\1:(?:\s+(.*))?$/);
    if (!m) continue;
    const sub = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (!isBlank(lines[j]) && indentOf(lines[j]) <= level) break;
      sub.push(lines[j]);
    }
    out.push({ key: m[2], value: m[3] ?? '', sub });
  }
  return out;
}

const get = (list, key) => list.find(e => e.key === key);
const text = entry => (entry ? [entry.value, ...entry.sub].join('\n') : '');

// Sequence items at the shallowest indentation; each item's first line has its
// dash replaced by spaces so the item's keys share one indentation.
function items(lines) {
  const content = lines.filter(l => !isBlank(l));
  if (!content.length) return [];
  const level = Math.min(...content.map(indentOf));
  const out = [];
  let current = null;
  for (const line of lines) {
    if (!isBlank(line) && indentOf(line) === level && /^\s*-(\s|$)/.test(line)) {
      current = [line.replace(/^(\s*)-(\s|$)/, (_, sp) => `${sp}  `)];
      out.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return out;
}

function listValue(entry) {
  if (!entry) return [];
  if (entry.value && !/^[|>]/.test(entry.value)) return flowList(entry.value);
  return items(entry.sub).map(item => scalar(item.join('\n').trim()));
}

function runsOnLabels(entry) {
  if (!entry) return [];
  if (entry.value) return flowList(entry.value);
  const map = entries(entry.sub);
  if (map.length) return ['<runner-group>', ...listValue(get(map, 'labels'))];
  return listValue(entry);
}

export function isGitHubHosted(labels) {
  return labels.length === 1 && GITHUB_HOSTED.test(labels[0]);
}

function parseWorkflow(source) {
  const lines = source.split(/\r?\n/);
  const top = entries(lines);
  const jobs = entries(get(top, 'jobs')?.sub ?? []).map(job => {
    const body = entries(job.sub);
    const steps = items(get(body, 'steps')?.sub ?? []).map(item => {
      const fields = entries(item);
      return {
        fields,
        uses: scalar(get(fields, 'uses')?.value ?? ''),
        with: entries(get(fields, 'with')?.sub ?? []),
        env: entries(get(fields, 'env')?.sub ?? []),
        run: get(fields, 'run') ? text(get(fields, 'run')) : null,
        raw: item.join('\n')
      };
    });
    const labels = runsOnLabels(get(body, 'runs-on'));
    return {
      id: job.key,
      body,
      raw: job.sub.join('\n'),
      labels,
      hosted: isGitHubHosted(labels),
      needs: listValue(get(body, 'needs')),
      ifText: text(get(body, 'if')).replace(/\s+/g, ' '),
      steps
    };
  });
  return { lines, top, jobs };
}

function triggers(top) {
  const on = top.find(e => e.key === 'on' || e.key === 'true');
  if (!on) return [];
  if (on.value) return flowList(on.value);
  const map = entries(on.sub).map(e => e.key);
  return map.length ? map : listValue(on);
}

// --------------------------------------------------------------- contract ---
export function analyzeWorkflow(name, source) {
  const failures = [];
  const fail = msg => failures.push(`${name}: ${msg}`);
  const wf = parseWorkflow(source);
  const selfHosted = wf.jobs.filter(job => !job.hosted);
  if (!selfHosted.length) return { selfHosted: false, failures };

  const on = triggers(wf.top);
  const extra = on.filter(t => t !== 'workflow_dispatch');
  if (!on.includes('workflow_dispatch')) fail('a self-hosted workflow must be triggered by workflow_dispatch');
  if (extra.length) fail(`a self-hosted workflow may only be triggered by workflow_dispatch; found ${extra.join(', ')}`);

  const onEntry = wf.top.find(e => e.key === 'on' || e.key === 'true');
  const dispatch = entries(onEntry?.sub ?? []).find(e => e.key === 'workflow_dispatch');
  const inputs = entries(get(entries(dispatch?.sub ?? []), 'inputs')?.sub ?? []);
  for (const input of ['sha', 'runner_label']) {
    const fields = entries(get(inputs, input)?.sub ?? []);
    if (scalar(get(fields, 'required')?.value) !== 'true') fail(`workflow_dispatch input "${input}" must exist with required: true`);
  }

  const perms = get(wf.top, 'permissions');
  const permEntries = entries(perms?.sub ?? []);
  if (!perms || perms.value || scalar(get(permEntries, 'contents')?.value) !== 'read' ||
      permEntries.some(e => !['read', 'none'].includes(scalar(e.value)))) {
    fail('top-level permissions must be a block granting contents: read (read/none scopes only)');
  }
  if (/^\s*[a-z-]+:\s*write\b/m.test(source) || /write-all/.test(source)) fail('no permission may be write in a self-hosted workflow');
  if (/persist-credentials:\s*true/.test(source)) fail('credentials must never be persisted into a checkout');
  if (/\bsecrets\./.test(source)) fail('a self-hosted workflow must not read repository secrets');
  if (/^\s*(-\s+)?['"]?continue-on-error['"]?\s*:/m.test(source)) fail('continue-on-error is forbidden in a self-hosted workflow (it would turn a failed guard into a pass)');

  for (const job of wf.jobs) {
    for (const [i, step] of job.steps.entries()) {
      if (step.run !== null && /\$\{\{/.test(step.run)) {
        fail(`job ${job.id} step ${i + 1}: no \${{ }} expression inside a run script; pass inputs through env`);
      }
      if (step.run !== null && (/\|\|\s*(true|:)\s*($|[;)}#])/m.test(step.run) || /^\s*set \+e\b/m.test(step.run))) {
        fail(`job ${job.id} step ${i + 1}: a run script may not swallow failures (|| true, || :, set +e)`);
      }
    }
  }

  const ownerGate = [
    "github.event_name == 'workflow_dispatch'",
    `github.repository == '${CANONICAL_REPO}'`,
    'github.actor == github.repository_owner',
    'github.triggering_actor == github.repository_owner',
    "github.ref == 'refs/heads/main'"
  ];
  const envIs = (step, key, value) => scalar(get(step?.env ?? [], key)?.value) === value;
  const firstLineSafe = run => /^\s*set -euo pipefail\s*$/.test((run ?? '').split('\n').find(l => l.trim() && !/^\s*[|>][-+]?\s*$/.test(l)) ?? '');

  for (const job of selfHosted) {
    const where = `job ${job.id}`;
    for (const label of ['self-hosted', 'macOS', 'ARM64', LABEL_INPUT]) {
      if (!job.labels.includes(label)) fail(`${where}: runs-on must include ${label} (got [${job.labels.join(', ')}])`);
    }
    for (const needle of [...ownerGate, "startsWith(inputs.runner_label, 'pri-mac-')"]) {
      if (!job.ifText.includes(needle)) fail(`${where}: job if: must require ${needle}`);
    }
    if (!get(job.body, 'timeout-minutes')) fail(`${where}: must set timeout-minutes`);

    const guards = job.needs.map(id => wf.jobs.find(j => j.id === id)).filter(j => j && j.hosted);
    if (!guards.length) {
      fail(`${where}: must need a GitHub-hosted guard job`);
    } else {
      const missing = guard => {
        const steps = guard.steps.filter(s => s.run !== null);
        const step = steps.find(s => hasLine(s.run, STATUS_LINE)) ?? steps[0];
        const run = step?.run ?? '';
        const code = guard.raw.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
        return [
          ...ownerGate.map(n => [`if: ${n}`, guard.ifText.includes(n)]),
          ['a run script starting with set -euo pipefail', firstLineSafe(run)],
          ['fail() that exits 1', hasLine(run, 'fail() { echo "::error::$*"; exit 1; }')],
          ['env INPUT_SHA bound to inputs.sha', envIs(step, 'INPUT_SHA', SHA_INPUT)],
          ['env REPO / REPO_OWNER / ACTOR / TRIGGERING_ACTOR bound to the github context',
            envIs(step, 'REPO', '${{ github.repository }}') && envIs(step, 'REPO_OWNER', '${{ github.repository_owner }}') &&
            envIs(step, 'ACTOR', '${{ github.actor }}') && envIs(step, 'TRIGGERING_ACTOR', '${{ github.triggering_actor }}')],
          ['the canonical repository assertion', hasLine(run, `[[ "$REPO" == '${CANONICAL_REPO}' ]] || fail `, true)],
          ['the owner actor assertion', hasLine(run, '[[ "$ACTOR" == "$REPO_OWNER" && "$TRIGGERING_ACTOR" == "$REPO_OWNER" ]] || fail ', true)],
          ['the exact 40-hex SHA check', hasLine(run, '[[ "$INPUT_SHA" =~ ^[0-9a-f]{40}$ ]] || fail ', true)],
          ['the compare/<sha>...main reachability query', hasLine(run, STATUS_LINE)],
          ["the exact identical/ahead reachability assertion", hasLine(run, `[[ "$status" == 'identical 0' || "$status" == 'ahead 0' ]] || fail `, true)],
          ['no step-level if: on guard steps', guard.steps.every(s => !get(s.fields, 'if'))],
          ['no access to the runner label (it must stay private until the Mac job starts)', !/runner_label/.test(code)]
        ].filter(([, ok]) => !ok).map(([what]) => what);
      };
      const best = guards.map(missing).sort((a, b) => a.length - b.length)[0];
      if (best.length) fail(`${where}: guard job lacks ${best.join('; ')}`);
    }

    const checkouts = job.steps.filter(s => /^actions\/checkout@/.test(s.uses));
    const first = job.steps[0];
    if (!first || !/^actions\/checkout@/.test(first.uses)) {
      fail(`${where}: the first step must be actions/checkout`);
    } else {
      if (scalar(get(first.with, 'ref')?.value) !== SHA_INPUT) fail(`${where}: checkout must use ref: ${SHA_INPUT}`);
      if (scalar(get(first.with, 'persist-credentials')?.value) !== 'false') fail(`${where}: checkout must set persist-credentials: false`);
    }
    if (checkouts.length !== 1) fail(`${where}: exactly one checkout is allowed (found ${checkouts.length})`);
    if (job.steps.slice(0, 3).some(s => get(s.fields, 'if'))) fail(`${where}: the checkout, HEAD and isolation steps may not carry a step-level if:`);

    const second = job.steps[1];
    const shaVar = second?.env.find(e => scalar(e.value) === SHA_INPUT)?.key;
    const asserts = shaVar && second.run &&
      new RegExp(`"\\$\\(git rev-parse HEAD\\)"\\s*==?\\s*"\\$\\{?${shaVar}\\}?"`).test(second.run);
    if (!asserts) fail(`${where}: the step right after checkout must assert "$(git rev-parse HEAD)" = the dispatched SHA (via env bound to ${SHA_INPUT})`);

    const third = job.steps[2];
    const iso = third?.run ?? '';
    const isolation = [
      ['set -euo pipefail first', firstLineSafe(iso)],
      ['env EXPECTED_LABEL bound to inputs.runner_label', envIs(third, 'EXPECTED_LABEL', LABEL_INPUT)],
      ['the exact pri-mac-<16 hex> label check', hasLine(iso, '[[ "$EXPECTED_LABEL" =~ ^pri-mac-[0-9a-f]{16}$ ]] || { ', true)],
      ['RUNNER_NAME == label', hasLine(iso, 'test "$RUNNER_NAME" = "$EXPECTED_LABEL"')],
      ['the non-root check', hasLine(iso, 'test "$(id -u)" -ne 0')],
      ['the macOS admin refusal', /^\s*if id -Gn \| tr ' ' '\\n' \| grep -qx 'admin'; then\n(?:[^\n]*\n)?\s*exit 1\n\s*fi\s*$/m.test(iso)],
      ['the PriLearningLauncher workspace refusal', /^\s*case "\$GITHUB_WORKSPACE:\$RUNNER_TEMP" in\n\s*\*PriLearningLauncher\*\)[^\n]*exit 1 ;;\n\s*esac\s*$/m.test(iso)],
      ['the JIT credential leak check', hasLine(iso, 'test -z "${ACTIONS_RUNNER_INPUT_JITCONFIG:-}"')],
      ['the registration token leak check', hasLine(iso, 'test -z "${ACTIONS_RUNNER_INPUT_TOKEN:-}"')]
    ].filter(([, ok]) => !ok).map(([what]) => what);
    if (isolation.length) fail(`${where}: the third step (runner isolation) lacks ${isolation.join('; ')}`);
  }
  return { selfHosted: true, failures };
}

// ---------------------------------------------------------- runner script ---
export function analyzeRunnerScript(source) {
  const failures = [];
  const need = (ok, msg) => { if (!ok) failures.push(`pri-mac-runner-once.sh: ${msg}`); };
  const code = source.split('\n').map(l => (/^\s*#/.test(l) ? '' : l)).join('\n');
  need(/^set -euo pipefail$/m.test(code), 'must use set -euo pipefail');
  need(/generate-jitconfig/.test(code) || /--ephemeral/.test(code), 'must register a JIT or --ephemeral runner');
  need(/id -Gn/.test(code) && /grep -qx 'admin'/.test(code) && /refusing to run as macOS admin/.test(code), 'must refuse a macOS admin account');
  need(/PRI_RUNNER_ALLOW_ADMIN/.test(code), 'the admin override must be the documented PRI_RUNNER_ALLOW_ADMIN variable');
  need(/PriLearningLauncher/.test(code) && /rev-parse --is-inside-work-tree/.test(code), 'must refuse a runner root inside the launcher clone or any git work tree');
  need(/mktemp -d/.test(code), 'must create a fresh mktemp work directory per run');
  need(/\[\[ -e "\$dir\/\.git" \]\] && return 0/.test(code) && /if inside_git_tree "\$root"/.test(code), 'the git work-tree refusal must walk parent directories for .git, independent of git');
  need(/PRI_RUNNER_JOB_WAIT_SECONDS:-900/.test(code) && /no job was assigned within/.test(code) && /exit 3/.test(code), 'run must stop an idle runner after PRI_RUNNER_JOB_WAIT_SECONDS (default 900)');
  need(/kill_tree "\$RUNNER_PID"/.test(code), 'cleanup must stop the runner process tree');
  need(/^\s*trap cleanup_run EXIT$/m.test(code), 'must install the cleanup trap on EXIT');
  need(/rm -f "\$RUNNER_DIR\/\.credentials" "\$RUNNER_DIR\/\.credentials_rsaparams" "\$RUNNER_DIR\/\.runner"/.test(code), 'cleanup must delete .credentials, .credentials_rsaparams and .runner');
  need(/rm -rf "\$RUN_DIR"/.test(code), 'cleanup must delete the work directory');
  need(/_diag/.test(code) && /REDACTED/.test(code), 'must preserve _diag logs with credentials redacted');
  need(/\^pri-mac-\[0-9a-f\]\{16\}\$/.test(code) && /openssl rand -hex 8/.test(code), 'labels must be pri-mac-<16 hex> from openssl rand');
  need(!/^\s*set -[a-z]*x|set -o xtrace/m.test(code), 'must never enable xtrace (it would print credentials)');
  for (const [i, line] of code.split('\n').entries()) {
    if (/\b(echo|printf|note|die|tee)\b/.test(line) && /\$\{?(jit_config|ACTIONS_RUNNER_INPUT_\w+|token|TOKEN|RUNNER_TOKEN)\b/.test(line)) {
      failures.push(`pri-mac-runner-once.sh:${i + 1}: must never print a runner credential`);
    }
    if (/--(jitconfig|token)\b[ =]+["']?\$/.test(line)) {
      failures.push(`pri-mac-runner-once.sh:${i + 1}: a credential must never be passed in argv (visible in ps)`);
    }
  }
  return failures;
}

function sh(args, { env, input } = {}) {
  const r = spawnSync('bash', [RUNNER_SCRIPT, ...args], { env, input, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function behaviour(check) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pri-mac-runner-check-'));
  try {
    const home = path.join(tmp, 'home');
    const bin = path.join(tmp, 'bin');
    mkdirSync(home);
    mkdirSync(bin);
    const shim = (groups) => {
      writeFileSync(path.join(bin, 'id'), `#!/usr/bin/env bash\ncase "\${1:-}" in -u) echo 501;; -un) echo pri-ci;; -Gn) echo '${groups}';; *) echo 'uid=501(pri-ci)';; esac\n`);
      chmodSync(path.join(bin, 'id'), 0o755);
    };
    const baseEnv = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` };
    delete baseEnv.PRI_RUNNER_ALLOW_ADMIN;
    delete baseEnv.PRI_RUNNER_ROOT;
    const label = 'pri-mac-0123456789abcdef';
    const jit = randomBytes(96).toString('base64');

    const fresh = sh(['label'], { env: baseEnv });
    check(fresh.status === 0 && /^pri-mac-[0-9a-f]{16}\n$/.test(fresh.stdout), 'label prints a fresh pri-mac-<16 hex> label');
    const again = sh(['label'], { env: baseEnv });
    check(again.stdout !== fresh.stdout, 'two labels are different');

    for (const bad of ['pri-mac-static', 'pri-mac-0123456789ABCDEF', 'pri-learning-mac-trusted-manual', '']) {
      check(sh(['run', bad], { env: baseEnv, input: jit }).status === 2, `run refuses label "${bad}"`);
    }

    shim('staff admin everyone');
    const admin = sh(['run', label], { env: baseEnv, input: jit });
    check(admin.status === 2 && /refusing to run as macOS admin/.test(admin.stderr), 'run refuses a macOS admin account');
    const adminWrongOverride = sh(['run', label], { env: { ...baseEnv, PRI_RUNNER_ALLOW_ADMIN: '1' }, input: jit });
    check(/refusing to run as macOS admin/.test(adminWrongOverride.stderr), 'a casual override value does not bypass the admin refusal');

    shim('staff everyone');
    const repo = path.join(tmp, 'clone');
    mkdirSync(repo);
    spawnSync('git', ['init', '-q', repo]);
    const inGit = sh(['run', label], { env: { ...baseEnv, PRI_RUNNER_ROOT: path.join(repo, 'runner') }, input: jit });
    check(inGit.status === 2 && /inside a git work tree/.test(inGit.stderr), 'run refuses a root inside a git work tree');
    const launcher = path.join(tmp, 'PriLearningLauncher', 'runner');
    const inLauncher = sh(['run', label], { env: { ...baseEnv, PRI_RUNNER_ROOT: launcher }, input: jit });
    check(inLauncher.status === 2 && /PriLearningLauncher/.test(inLauncher.stderr) && !existsSync(launcher), 'run refuses (and does not create) a root inside PriLearningLauncher');
    const dot = sh(['run', label], { env: { ...baseEnv, PRI_RUNNER_ROOT: path.join(home, '.ssh', 'runner') }, input: jit });
    check(dot.status === 2 && /dot-directory/.test(dot.stderr), 'run refuses a root inside a $HOME dot-directory');
    const homeRoot = sh(['run', label], { env: { ...baseEnv, PRI_RUNNER_ROOT: home }, input: jit });
    check(homeRoot.status === 2 && /\$HOME itself/.test(homeRoot.stderr), 'run refuses $HOME itself as the root');
    // git may be absent or refuse another user's repository ("dubious
    // ownership", exit 128): the work-tree refusal must not depend on it.
    const noGitBin = path.join(tmp, 'bin-nogit');
    mkdirSync(noGitBin);
    writeFileSync(path.join(noGitBin, 'git'), '#!/usr/bin/env bash\necho "fatal: detected dubious ownership" >&2\nexit 128\n');
    chmodSync(path.join(noGitBin, 'git'), 0o755);
    const noGitEnv = { ...baseEnv, PATH: `${noGitBin}:${baseEnv.PATH}` };
    const otherRepo = path.join(tmp, 'other-users-clone');
    mkdirSync(path.join(otherRepo, '.git'), { recursive: true });
    const dubious = sh(['run', label], { env: { ...noGitEnv, PRI_RUNNER_ROOT: path.join(otherRepo, 'a', 'runner') }, input: jit });
    check(dubious.status === 2 && /inside a git work tree/.test(dubious.stderr), 'run refuses a root under a .git directory even when git itself fails');
    const worktree = path.join(tmp, 'linked-worktree');
    mkdirSync(worktree);
    writeFileSync(path.join(worktree, '.git'), 'gitdir: /elsewhere/.git/worktrees/x\n');
    const linked = sh(['run', label], { env: { ...noGitEnv, PRI_RUNNER_ROOT: path.join(worktree, 'runner') }, input: jit });
    check(linked.status === 2 && /inside a git work tree/.test(linked.stderr), 'run refuses a root under a .git file (linked worktree)');

    // A fake actions/runner release: records what it received, writes the
    // files a real runner writes, and a diagnostic log containing secrets.
    const dist = path.join(tmp, 'dist');
    mkdirSync(dist);
    writeFileSync(path.join(dist, 'run.sh'), [
      '#!/usr/bin/env bash',
      'set -eu',
      'test -n "${ACTIONS_RUNNER_INPUT_JITCONFIG:-}" || exit 41',
      'for a in "$@"; do case "$a" in *"$ACTIONS_RUNNER_INPUT_JITCONFIG"*) exit 42;; esac; done',
      'printf %s "$ACTIONS_RUNNER_INPUT_JITCONFIG" | shasum -a 256 | cut -d" " -f1 > "$PRI_FAKE_SEEN"',
      'pwd -P > "$PRI_FAKE_RUNDIR"',
      'printf x > .credentials; printf x > .credentials_rsaparams; printf x > .runner',
      'mkdir -p _diag _work/repo',
      'printf "config %s\\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz0123\\nusing ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345\\nsettings token=unquotedtok123 jitconfig: unquotedjit456, password = unquotedpw789\\nJob pri-mac completed\\n" "$ACTIONS_RUNNER_INPUT_JITCONFIG" > _diag/Runner_1.log',
      'if [ -n "${PRI_FAKE_HANG:-}" ]; then sleep 300 & echo $! > "$PRI_FAKE_CHILD"; wait; fi',
      'printf "job\\n" > _diag/Worker_1.log',
      'exit "${PRI_FAKE_EXIT:-0}"',
      ''
    ].join('\n'));
    chmodSync(path.join(dist, 'run.sh'), 0o755);
    const tarball = path.join(tmp, 'actions-runner-osx-arm64-fake.tar.gz');
    spawnSync('tar', ['-czf', tarball, '-C', dist, '.']);
    const sha = createHash('sha256').update(readFileSync(tarball)).digest('hex');
    const root = path.join(tmp, 'pri-runner');
    const runEnv = {
      ...baseEnv,
      PRI_RUNNER_ROOT: root,
      PRI_RUNNER_TARBALL: tarball,
      PRI_RUNNER_TARBALL_SHA256: sha,
      PRI_FAKE_SEEN: path.join(tmp, 'seen'),
      PRI_FAKE_RUNDIR: path.join(tmp, 'rundir')
    };

    const wrongSha = sh(['run', label], { env: { ...runEnv, PRI_RUNNER_TARBALL_SHA256: '0'.repeat(64) }, input: jit });
    check(wrongSha.status === 2 && /SHA-256 mismatch/.test(wrongSha.stderr), 'run refuses a runner tarball whose SHA-256 does not match');
    const noJit = sh(['run', label], { env: runEnv, input: 'not a jit config\n' });
    check(noJit.status === 2 && /did not contain an encoded JIT/.test(noJit.stderr), 'run refuses stdin that is not a JIT config');

    const ok = sh(['run', label], { env: runEnv, input: `${jit}\n` });
    check(ok.status === 0, `run completes one fake job (exit ${ok.status}: ${ok.stderr.trim().split('\n').pop()})`);
    check(ok.stdout.includes(`PRI_RUNNER_LABEL=${label}`), 'run prints the label for the dispatch');
    check(!ok.stdout.includes(jit) && !ok.stderr.includes(jit), 'run never prints the JIT config');
    check(existsSync(runEnv.PRI_FAKE_SEEN) &&
      readFileSync(runEnv.PRI_FAKE_SEEN, 'utf8').trim() === createHash('sha256').update(jit).digest('hex'),
    'the runner receives the JIT config through ACTIONS_RUNNER_INPUT_JITCONFIG, not argv');
    const runDir = existsSync(runEnv.PRI_FAKE_RUNDIR) ? readFileSync(runEnv.PRI_FAKE_RUNDIR, 'utf8').trim() : '';
    check(runDir.includes(`${path.sep}runs${path.sep}run.`) && !existsSync(runDir) && !existsSync(path.dirname(runDir)),
      'the fresh run directory (with .credentials, .runner and _work) is deleted after the job');
    check(readdirSync(path.join(root, 'runs')).length === 0, 'no run directory survives');
    const diagDirs = readdirSync(path.join(root, 'diag')).filter(d => d.startsWith(`${label}-`));
    const diagLog = diagDirs.length === 1 ? readFileSync(path.join(root, 'diag', diagDirs[0], 'Runner_1.log'), 'utf8') : '';
    check(/Job pri-mac completed/.test(diagLog), '_diag logs are preserved outside the work directory');
    check(!diagLog.includes(jit) && !/ghp_[A-Za-z0-9]/.test(diagLog) && !/abcdefghijklmnopqrstuvwxyz0123/.test(diagLog) &&
      /REDACTED-JITCONFIG/.test(diagLog), 'preserved _diag logs are redacted (JIT config, GitHub token, bearer token)');
    check(/settings token=\[REDACTED\] jitconfig: \[REDACTED\], password = \[REDACTED\]/.test(diagLog) && !/unquoted(tok|jit|pw)/.test(diagLog),
      'unquoted token=, jitconfig: and password = values are redacted too');

    rmSync(runEnv.PRI_FAKE_RUNDIR, { force: true });
    const failed = sh(['run', label], { env: { ...runEnv, PRI_FAKE_EXIT: '7' }, input: `${jit}\n` });
    const failedDir = existsSync(runEnv.PRI_FAKE_RUNDIR) ? readFileSync(runEnv.PRI_FAKE_RUNDIR, 'utf8').trim() : '';
    check(failed.status === 7 && failedDir && !existsSync(failedDir), 'a failed job still deletes the run directory and propagates the exit status');

    check(sh(['run', label], { env: { ...runEnv, PRI_RUNNER_JOB_WAIT_SECONDS: '15m' }, input: `${jit}\n` }).status === 2,
      'run refuses a non-numeric PRI_RUNNER_JOB_WAIT_SECONDS');
    rmSync(runEnv.PRI_FAKE_RUNDIR, { force: true });
    const childFile = path.join(tmp, 'child');
    const started = Date.now();
    const idle = sh(['run', label], { env: { ...runEnv, PRI_FAKE_HANG: '1', PRI_FAKE_CHILD: childFile, PRI_RUNNER_JOB_WAIT_SECONDS: '2' }, input: `${jit}\n` });
    const idleDir = existsSync(runEnv.PRI_FAKE_RUNDIR) ? readFileSync(runEnv.PRI_FAKE_RUNDIR, 'utf8').trim() : '';
    const child = existsSync(childFile) ? Number(readFileSync(childFile, 'utf8').trim()) : 0;
    let childAlive = false;
    if (child) { try { process.kill(child, 0); childAlive = true; } catch { childAlive = false; } }
    check(idle.status === 3 && /no job was assigned within 2s/.test(idle.stderr) && Date.now() - started < 30000,
      `an idle runner with no job assigned is stopped after PRI_RUNNER_JOB_WAIT_SECONDS (exit ${idle.status})`);
    check(child > 0 && !childAlive, 'the timeout kills the whole runner process tree');
    check(idleDir && !existsSync(idleDir) && readdirSync(path.join(root, 'runs')).length === 0, 'the timeout still deletes the run directory');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------- main ---
let passed = 0;
const failures = [];
const check = (ok, message) => { if (ok) passed += 1; else failures.push(message); };

// 1. Every real workflow: classify; every self-hosted one must meet the contract.
const files = readdirSync(WORKFLOWS).filter(n => /\.ya?ml$/.test(n)).sort();
const selfHostedFiles = [];
for (const name of files) {
  const result = analyzeWorkflow(name, readFileSync(path.join(WORKFLOWS, name), 'utf8'));
  if (result.selfHosted) selfHostedFiles.push(name);
  for (const f of result.failures) check(false, f);
  if (!result.failures.length) passed += 1;
}
if (files.includes(MAC_WORKFLOW)) {
  check(selfHostedFiles.includes(MAC_WORKFLOW), `${MAC_WORKFLOW} must be classified as self-hosted`);
}

// 2. Negative fixtures: each mutation of the real Mac workflow must be rejected.
const macPath = path.join(WORKFLOWS, MAC_WORKFLOW);
if (existsSync(macPath)) {
  const mac = readFileSync(macPath, 'utf8');
  const mutate = (label, from, to, expect) => {
    const mutated = typeof from === 'function' ? from(mac) : mac.replace(from, to);
    check(mutated !== mac, `fixture "${label}" must actually change the workflow`);
    const r = analyzeWorkflow(`fixture(${label})`, mutated);
    check(r.selfHosted && r.failures.some(f => expect.test(f)), `fixture "${label}" must be rejected (${expect}); got: ${r.failures.join(' | ') || 'no failure'}`);
  };
  const onDispatch = 'on:\n  workflow_dispatch:\n';
  for (const trigger of ['pull_request', 'pull_request_target', 'push', 'issue_comment', 'schedule', 'workflow_run', 'merge_group']) {
    mutate(`${trigger} trigger`, onDispatch, `on:\n  ${trigger}:\n  workflow_dispatch:\n`, /only be triggered by workflow_dispatch/);
  }
  mutate('inline pull_request trigger', s => s.replace(/on:\n  workflow_dispatch:\n    inputs:[\s\S]*?\n\npermissions:/, 'on: [workflow_dispatch, pull_request]\n\npermissions:'), null, /only be triggered by workflow_dispatch/);
  mutate('sha input optional', /(      sha:\n[^\n]*\n        required: )true/, '$1false', /input "sha"/);
  mutate('runner_label input missing', /      runner_label:\n[^\n]*\n[^\n]*\n[^\n]*\n/, '', /input "runner_label"/);
  mutate('top-level contents: write', 'permissions:\n  contents: read\n', 'permissions:\n  contents: write\n', /contents: read|write/);
  mutate('top-level write-all', 'permissions:\n  contents: read\n', 'permissions: write-all\n', /permissions/);
  mutate('job-level write', '    timeout-minutes: 90\n', '    timeout-minutes: 90\n    permissions:\n      contents: write\n', /no permission may be write/);
  mutate('persisted credentials', 'persist-credentials: false', 'persist-credentials: true', /persist/);
  mutate('checkout of main instead of the SHA', 'ref: ${{ inputs.sha }}', 'ref: main', /ref: \$\{\{ inputs\.sha \}\}/);
  mutate('HEAD assertion removed', /      - name: Assert HEAD is exactly[\s\S]*?\n\n/, '', /git rev-parse HEAD/);
  mutate('HEAD assertion against a constant', '"$(git rev-parse HEAD)" = "$EXPECTED_SHA"', '"$(git rev-parse HEAD)" = "$GITHUB_SHA"', /git rev-parse HEAD/);
  mutate('static label only', `'${LABEL_INPUT}'`, 'pri-mac-static', /runs-on must include \$\{\{ inputs\.runner_label \}\}/);
  mutate('legacy static runner label', /runs-on: \[self-hosted[^\]]*\]/, 'runs-on: [pri-learning-mac-trusted-manual]', /runs-on must include self-hosted/);
  mutate('expression runs-on', /runs-on: \[self-hosted[^\]]*\]/, 'runs-on: ${{ inputs.runner_label }}', /runs-on must include self-hosted/);
  mutate('guard not needed', '    needs: guard\n', '', /must need a GitHub-hosted guard job/);
  mutate('guard on self-hosted', /(  guard:\n[\s\S]*?)runs-on: ubuntu-latest/, '$1runs-on: [self-hosted, macOS, ARM64]', /must need a GitHub-hosted guard job|runs-on must include/);
  mutate('guard without owner check', s => s.replace(/      github\.actor == github\.repository_owner &&\n/g, ''), null, /github\.actor == github\.repository_owner/);
  mutate('guard without canonical repository', s => s.replace(/      github\.repository == 'Priysharan19\/Final-Pri-learning' &&\n/g, ''), null, /github\.repository ==/);
  mutate('guard without SHA regex', '[[ "$INPUT_SHA" =~ ^[0-9a-f]{40}$ ]]', '[[ -n "$INPUT_SHA" ]]', /40-hex SHA check/);
  mutate('weakened label regex', '[[ "$EXPECTED_LABEL" =~ ^pri-mac-[0-9a-f]{16}$ ]]', '[[ "$EXPECTED_LABEL" =~ ^pri-mac- ]]', /exact pri-mac-<16 hex> label check/);
  mutate('label check removed', /          \[\[ "\$EXPECTED_LABEL" =~[^\n]*\n/, '', /exact pri-mac-<16 hex> label check/);
  mutate('continue-on-error on the guard step', '      - name: Validate inputs, owner,', '      - continue-on-error: true\n        name: Validate inputs, owner,', /continue-on-error/);
  mutate('job-level continue-on-error', '    timeout-minutes: 90\n', '    timeout-minutes: 90\n    continue-on-error: true\n', /continue-on-error/);
  mutate('|| true on reachability', `--jq '.status + " " + (.behind_by | tostring)')"`, `--jq '.status + " " + (.behind_by | tostring)')" || true`, /swallow failures|reachability query/);
  mutate('|| : on reachability assertion', `[[ "$status" == 'identical 0' || "$status" == 'ahead 0' ]] || fail`, `[[ "$status" == 'identical 0' || "$status" == 'ahead 0' ]] || :; true || fail`, /swallow failures|identical\/ahead/);
  mutate('status test replaced by true', /          \[\[ "\$status" == 'identical 0'[^\n]*\n/, '          true\n', /identical\/ahead reachability assertion/);
  mutate('status accepts diverged', `"$status" == 'ahead 0' ]]`, `"$status" == 'ahead 0' || "$status" == diverged* ]]`, /identical\/ahead reachability assertion/);
  mutate('set +e in guard', '          fail() { echo', '          set +e\n          fail() { echo', /swallow failures/);
  mutate('triggering_actor removed from both ifs', s => s.replace(/      github\.triggering_actor == github\.repository_owner &&\n/g, ''), null, /github\.triggering_actor == github\.repository_owner/);
  mutate('triggering_actor removed from the guard if only', s => s.replace('      github.triggering_actor == github.repository_owner &&\n', ''), null, /guard job lacks if: github\.triggering_actor/);
  mutate('ref main removed from both ifs', s => s.replace(/      github\.ref == 'refs\/heads\/main'( &&)?\n/g, (m, and) => (and ? '' : '      true\n')), null, /github\.ref == 'refs\/heads\/main'/);
  mutate('label shape check removed from the Mac if', " &&\n      startsWith(inputs.runner_label, 'pri-mac-')", '', /startsWith\(inputs\.runner_label/);
  mutate('label passed into the guard', '          INPUT_SHA: ${{ inputs.sha }}\n', '          INPUT_SHA: ${{ inputs.sha }}\n          INPUT_LABEL: ${{ inputs.runner_label }}\n', /runner label/);
  mutate('guard echoes the label', '          echo "Trusted dispatch: $INPUT_SHA is on main"', '          echo "Trusted dispatch: $INPUT_SHA is on main for ${{ inputs.runner_label }}"', /runner label|expression inside a run script/);
  mutate('guard step skipped', '      - name: Validate inputs, owner,', '      - if: false\n        name: Validate inputs, owner,', /no step-level if/);
  mutate('isolation step skipped', '      - name: Verify one-job runner isolation', '      - if: false\n        name: Verify one-job runner isolation', /step-level if/);
  mutate('admin refusal removed', /          if id -Gn[\s\S]*?\n          fi\n/, '', /macOS admin refusal/);
  mutate('admin refusal neutered', /(          if id -Gn[^\n]*\n[^\n]*\n)            exit 1\n/, '$1            true\n', /macOS admin refusal/);
  mutate('JIT leak check removed', '          test -z "${ACTIONS_RUNNER_INPUT_JITCONFIG:-}"\n', '', /JIT credential leak check/);
  mutate('launcher refusal removed', /          case "\$GITHUB_WORKSPACE[\s\S]*?esac\n/, '', /PriLearningLauncher workspace refusal/);
  mutate('RUNNER_NAME check removed', '          test "$RUNNER_NAME" = "$EXPECTED_LABEL"\n', '', /RUNNER_NAME == label/);
  mutate('guard without main reachability', /          status="\$\(gh api[^\n]*\n/, '', /reachability/);
  mutate('input interpolated into run', '          set -euo pipefail\n          fail()', '          set -euo pipefail\n          echo "${{ inputs.sha }}"\n          fail()', /no \$\{\{ \}\} expression inside a run script/);
  mutate('secret read', '          GH_TOKEN: ${{ github.token }}', '          GH_TOKEN: ${{ secrets.PAT }}', /secrets/);
  mutate('second checkout', '      - name: Canonical native source', '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n        with:\n          persist-credentials: false\n\n      - name: Canonical native source', /exactly one checkout/);
  mutate('no timeout', '    timeout-minutes: 90\n', '', /timeout-minutes/);
}

// 3. Classification fixtures: hosted workflows are out of scope; any other
//    runs-on (an expression, a runner group, a custom label) is held to the contract.
const hostedPr = 'name: x\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n  b:\n    runs-on: macos-15\n    steps:\n      - run: echo ok\n';
check(!analyzeWorkflow('hosted', hostedPr).selfHosted, 'a GitHub-hosted pull_request workflow is not self-hosted');
for (const runsOn of ['${{ matrix.os }}', '[self-hosted, macOS]', 'pri-learning-mac-trusted-manual', '\n      group: pri-mac\n      labels: [self-hosted]']) {
  const r = analyzeWorkflow('custom', hostedPr.replace('runs-on: ubuntu-latest', `runs-on: ${runsOn}`));
  check(r.selfHosted && r.failures.some(f => /only be triggered by workflow_dispatch/.test(f)), `a pull_request workflow on runs-on ${runsOn.trim()} must be rejected`);
}

// 4. The owner runner script.
const script = readFileSync(RUNNER_SCRIPT, 'utf8');
for (const f of analyzeRunnerScript(script)) check(false, f);
passed += 1;
for (const [label, from, to] of [
  ['admin refusal removed', /  if id -Gn[\s\S]*?\n  fi\n/, ''],
  ['trap removed', '  trap cleanup_run EXIT\n', ''],
  ['credential echoed', '  printf \'PRI_RUNNER_LABEL=%s\\n\' "$label"\n', '  echo "$jit_config"\n'],
  ['credential in argv', 'ACTIONS_RUNNER_INPUT_JITCONFIG="$jit_config" ./run.sh', './run.sh --jitconfig "$jit_config"'],
  ['xtrace enabled', 'set -euo pipefail\n', 'set -euxo pipefail\n'],
  ['no fresh work dir', 'mktemp -d', 'echo'],
  ['credentials kept', '"$RUNNER_DIR/.credentials" ', ''],
  ['no idle timeout', '      exit 3\n', '      break\n'],
  ['git-only work-tree check', 'if inside_git_tree "$root" || git', 'if git']
]) {
  const mutated = script.replace(from, to);
  check(mutated !== script, `script fixture "${label}" must actually change the script`);
  check(analyzeRunnerScript(mutated).length > 0, `script fixture "${label}" must be rejected`);
}
const syntax = spawnSync('bash', ['-n', RUNNER_SCRIPT], { encoding: 'utf8' });
check(syntax.status === 0, `bash -n scripts/pri-mac-runner-once.sh: ${syntax.stderr}`);
const shellcheck = spawnSync('shellcheck', ['-x', RUNNER_SCRIPT], { encoding: 'utf8' });
let shellcheckNote = 'shellcheck not installed (skipped)';
if (!shellcheck.error) {
  check(shellcheck.status === 0, `shellcheck scripts/pri-mac-runner-once.sh:\n${shellcheck.stdout}`);
  shellcheckNote = 'shellcheck clean';
}

// 5. Behaviour against a fake runner tarball (no network).
behaviour(check);

const total = passed + failures.length;
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`SELF-HOSTED RUNNER CONTRACT: FAIL — ${passed}/${total} checks`);
  process.exit(1);
}
console.log(`SELF-HOSTED RUNNER CONTRACT: PASS — ${passed}/${total} checks; ${files.length} workflows scanned, self-hosted: ${selfHostedFiles.join(', ') || 'none'}; every self-hosted lane is owner-dispatch-only for an exact SHA on main via a guard job, read-only, credential-free and routed by a fresh one-job label; runner script refuses admin/launcher/git roots, never prints or argv-passes its credential, and deletes its work directory; ${shellcheckNote}`);
