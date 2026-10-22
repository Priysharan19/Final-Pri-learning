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
const SWALLOW = [
  /\|\|\s*(true|:)\s*($|[;)}#])/m,
  /\|\|\s*\{?\s*(exit|return)\b/,
  /\bexit\s+0\b/,
  /^\s*set\s+(\+e\b|\+o\s+errexit)/m,
  /(^|[\s;])trap\b/m
];
const STATUS_LINE = 'status="$(gh api "repos/$REPO/compare/$INPUT_SHA...main" --jq \'.status + " " + (.behind_by | tostring)\')"';
const escapeRe = s => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
// A run-script line that is exactly `line` (or starts with it when prefix).
const hasLine = (run, line, prefix = false) =>
  new RegExp(`^\\s*${escapeRe(line)}${prefix ? '' : '\\s*$'}`, 'm').test(run ?? '');

// ------------------------------------------------------------ canonical ---
// The reviewed text of the guard job and of the Mac job up to and including
// its third step (checkout, HEAD assertion, isolation), compared exactly after
// trailing-whitespace normalisation. A deny-list cannot enumerate every way a
// shell script can exit 0 early (`exit`, `exec true`, `if false; then`, a
// heredoc, `shell: true {0}`, ...), so ANY edit to these blocks must change
// this checker too, which puts it in front of an independent reviewer.
const CANONICAL_GUARD_JOB = `  guard:
    name: Trusted dispatch guard (owner, repository, SHA on main, runner label)
    # Never allocate the Pri Mac for PRs, forks, branches, bots or schedules.
    # This job deliberately never receives the runner label.
    if: >-
      github.event_name == 'workflow_dispatch' &&
      github.repository == 'Priysharan19/Final-Pri-learning' &&
      github.actor == github.repository_owner &&
      github.triggering_actor == github.repository_owner &&
      github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Validate inputs, owner, canonical repository and that the SHA is on main
        shell: bash
        env:
          GH_TOKEN: \${{ github.token }}
          INPUT_SHA: \${{ inputs.sha }}
          EVENT_NAME: \${{ github.event_name }}
          REPO: \${{ github.repository }}
          REPO_OWNER: \${{ github.repository_owner }}
          ACTOR: \${{ github.actor }}
          TRIGGERING_ACTOR: \${{ github.triggering_actor }}
          DISPATCH_REF: \${{ github.ref }}
        run: |
          set -euo pipefail
          fail() { echo "::error::$*"; exit 1; }
          [[ "$EVENT_NAME" == 'workflow_dispatch' ]] || fail "only a manual dispatch may reach the Pri Mac"
          [[ "$REPO" == 'Priysharan19/Final-Pri-learning' ]] || fail "refusing non-canonical repository $REPO (forks never reach the Pri Mac)"
          [[ "$ACTOR" == "$REPO_OWNER" && "$TRIGGERING_ACTOR" == "$REPO_OWNER" ]] || fail "only the repository owner may dispatch the Pri Mac lane"
          [[ "$DISPATCH_REF" == 'refs/heads/main' ]] || fail "dispatch from main only (got $DISPATCH_REF)"
          [[ "$INPUT_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "sha must be a full 40-hex lowercase commit SHA"
          # compare/{sha}...main: "identical" or "ahead" with behind_by 0 means
          # the SHA is main itself or an ancestor of main. A fork or unmerged
          # branch commit is "diverged"/"behind" and is refused.
          status="$(gh api "repos/$REPO/compare/$INPUT_SHA...main" --jq '.status + " " + (.behind_by | tostring)')"
          [[ "$status" == 'identical 0' || "$status" == 'ahead 0' ]] || fail "sha $INPUT_SHA is not reachable from main ($status)"
          echo "Trusted dispatch: $INPUT_SHA is on main"
`;
const CANONICAL_MAC_JOB_HEAD = `  apple-v1:
    name: iPhone + iPad native acceptance on Pri Mac
    needs: guard
    # Defence in depth: the same owner/repository/ref gate as the guard job,
    # plus a shape check of the label (the exact check is RUNNER_NAME below).
    if: >-
      github.event_name == 'workflow_dispatch' &&
      github.repository == 'Priysharan19/Final-Pri-learning' &&
      github.actor == github.repository_owner &&
      github.triggering_actor == github.repository_owner &&
      github.ref == 'refs/heads/main' &&
      startsWith(inputs.runner_label, 'pri-mac-')
    # The per-run label exists only while the owner's one-job runner is up.
    runs-on: [self-hosted, macOS, ARM64, '\${{ inputs.runner_label }}']
    timeout-minutes: 90
    env:
      CI: 'true'
      HOMEBREW_NO_AUTO_UPDATE: '1'
    steps:
      - name: Checkout the dispatched SHA without persisting credentials
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
        with:
          ref: \${{ inputs.sha }}
          persist-credentials: false
          clean: true

      - name: Assert HEAD is exactly the dispatched SHA before any repository code runs
        shell: bash
        env:
          EXPECTED_SHA: \${{ inputs.sha }}
        run: |
          set -euo pipefail
          if ! test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"; then
            echo "::error::checked-out HEAD $(git rev-parse HEAD) is not the dispatched SHA $EXPECTED_SHA"
            exit 1
          fi
          test -z "$(git status --porcelain)"

      - name: Verify one-job runner isolation and clean release identity
        shell: bash
        env:
          EXPECTED_LABEL: \${{ inputs.runner_label }}
        run: |
          set -euo pipefail
          [[ "$EXPECTED_LABEL" =~ ^pri-mac-[0-9a-f]{16}$ ]] || { echo "::error::runner_label is not a pri-mac-<16 hex> label"; exit 1; }
          test "$RUNNER_NAME" = "$EXPECTED_LABEL"
          test "$RUNNER_OS" = 'macOS'
          test "$RUNNER_ARCH" = 'ARM64'
          test "$GITHUB_REF" = 'refs/heads/main'
          test "$GITHUB_REPOSITORY" = 'Priysharan19/Final-Pri-learning'
          test "$(uname -m)" = 'arm64'
          # Isolation: never root, never a macOS admin, never inside the launcher clone.
          test "$(id -u)" -ne 0
          if id -Gn | tr ' ' '\\n' | grep -qx 'admin'; then
            echo "::error::runner account $(id -un) is a macOS admin; use the non-admin pri-ci account"
            exit 1
          fi
          case "$GITHUB_WORKSPACE:$RUNNER_TEMP" in
            *PriLearningLauncher*) echo "::error::job workspace is inside the PriLearningLauncher clone"; exit 1 ;;
          esac
          # The one-job runner credential must not leak into the job environment.
          test -z "\${ACTIONS_RUNNER_INPUT_JITCONFIG:-}"
          test -z "\${ACTIONS_RUNNER_INPUT_TOKEN:-}"
          id -un
          test -f ios/PriLearning.swiftpm/Package.swift
          test -f scripts/iphone-journey.mjs
          node --version
          npm --version
          xcodebuild -version
          git rev-parse HEAD
          df -h .
`;

// ---------------------------------------------------------------- YAML-ish ---
const indentOf = line => line.match(/^ */)[0].length;
// The one mapping-key grammar used by every parser here (quoted or plain key,
// optional inline value or trailing comment).
const KEY_LINE = /^(\s*)(['"]?)([A-Za-z0-9_.-]+)\2:(?:\s+(.*))?$/;
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
    const m = line.match(KEY_LINE);
    if (!m) continue;
    const sub = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (!isBlank(lines[j]) && indentOf(lines[j]) <= level) break;
      sub.push(lines[j]);
    }
    out.push({ key: m[3], value: m[4] ?? '', sub });
  }
  return out;
}

const get = (list, key) => list.find(e => e.key === key);

// Raw lines of each job (key line included), keyed by job id, using the same
// key grammar and indentation rule as entries(), so every job the parser sees
// has a block. `order` lists job ids as they appear; `keyLine` keeps the raw
// key line so the checker can require it verbatim.
function jobBlocks(lines) {
  const out = new Map();
  const order = [];
  const start = lines.findIndex(l => { const m = l.match(KEY_LINE); return m && m[1] === '' && m[3] === 'jobs'; });
  if (start === -1) return { blocks: out, order, jobsLine: null };
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (!isBlank(lines[i]) && indentOf(lines[i]) === 0) break;
    body.push(lines[i]);
  }
  const content = body.filter(l => !isBlank(l));
  const level = content.length ? Math.min(...content.map(indentOf)) : 0;
  let id = null;
  for (const l of body) {
    const m = !isBlank(l) && indentOf(l) === level ? l.match(KEY_LINE) : null;
    if (m) {
      id = m[3];
      order.push(id);
      out.set(id, { keyLine: l, lines: [] });
    }
    if (id) out.get(id).lines.push(l);
  }
  return { blocks: out, order, jobsLine: lines[start] };
}

// Every mapping key that appears twice at the same level, anywhere outside
// block scalars; and flow mappings, whose keys this parser cannot see.
function duplicateKeys(lines, where = '') {
  const found = [];
  const seen = new Set();
  for (const e of entries(lines)) {
    if (seen.has(e.key)) found.push(`${where}${e.key}`);
    seen.add(e.key);
    if (/^\{/.test(stripComment(e.value))) found.push(`${where}${e.key} (flow mapping)`);
    if (/^[|>]/.test(e.value) || !e.sub.length) continue;
    const list = items(e.sub);
    if (list.length) list.forEach((item, i) => found.push(...duplicateKeys(item, `${where}${e.key}[${i}].`)));
    else found.push(...duplicateKeys(e.sub, `${where}${e.key}.`));
  }
  return found;
}
// An if: expression without the YAML comment lines that follow it.
const ifSource = entry => (entry ? [entry.value, ...entry.sub.filter(l => !/^\s*#/.test(l))].join('\n') : '');
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
      ifText: ifSource(get(body, 'if')).replace(/\s+/g, ' '),
      ifNorm: ifSource(get(body, 'if')).replace(/\s+/g, ' ').trim().replace(/^[>|][-+]? */, '').replace(/^\$\{\{\s*(.*?)\s*\}\}$/, '$1').trim(),
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

// ----------------------------------------------------------- grammar lint ---
// The parsers above only understand plain `key:` lines; anything else would be
// skipped, so a key YAML (and GitHub) still reads -- `  evil :`, `"env":`,
// `"ev\x69l":`, `? env` -- could hide a job, a trigger, an env or a permission
// from every check. This lint runs on EVERY workflow before classification and
// fails closed: each non-blank, non-comment line outside a block scalar must be
// a plain `key:` (optionally after `- `, nothing between the key and the colon),
// a `- ` sequence item holding a plain scalar or single-line flow sequence, or
// block-scalar content. The one other construct the repository uses -- a
// single-line flow mapping of plain keys to scalars, e.g. a matrix include or
// `with: {node-version: '24'}` -- is allowed narrowly (no quoted keys, no
// nesting, no duplicates) and is still banned outright in a self-hosted workflow.
const PLAIN_KEY_LINE = /^( *)((?:- )?)([A-Za-z0-9_.-]+):(?: (.*))?$/;
const ITEM_LINE = /^( *)- (.*)$/;
const BLOCK_SCALAR = /^[|>][-+0-9]*(?: +#.*)?$/;
const QUOTED = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*")/;

function plainScalarOk(raw) {
  const v = raw.trim();
  if (v === '') return true;
  if (/^[?{!&*%@`|>,\]}#-]/.test(v) && !/^-[0-9A-Za-z]/.test(v)) return false;
  const q = v.match(QUOTED);
  if (q) return /^(\s+#.*)?$/.test(v.slice(q[0].length));
  return !/:(\s|$)/.test(v.replace(/\s+#.*$/, ''));
}

function flowSequenceOk(v) {
  const inner = v.replace(/'(?:[^']|'')*'|"(?:[^"\\]|\\.)*"/g, "''");
  return /^\[[^[\]{}]*\](\s+#.*)?$/.test(inner) && !/:(\s|$)/.test(inner);
}

function flowMappingOk(v) {
  const m = v.match(/^\{(.*)\}(\s+#.*)?$/);
  if (!m) return false;
  const parts = [];
  let cur = '';
  let quote = null;
  for (const ch of m[1]) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if ('{}[]'.includes(ch)) return false;
    if (ch === ',') { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (quote) return false;
  parts.push(cur);
  const seen = new Set();
  for (const part of parts) {
    const kv = part.trim().match(/^([A-Za-z0-9_.-]+): (.*)$/);
    if (!kv || seen.has(kv[1]) || !plainScalarOk(kv[2]) || /#/.test(kv[2].replace(QUOTED, ''))) return false;
    seen.add(kv[1]);
  }
  return true;
}

const valueOk = raw => {
  const v = raw.trim();
  if (v.startsWith('[')) return flowSequenceOk(v);
  if (v.startsWith('{')) return flowMappingOk(v);
  return plainScalarOk(v);
};

export function lintWorkflowGrammar(name, source) {
  const failures = [];
  const lines = source.replace(/^﻿/, '').split('\n').map(l => l.replace(/\r$/, ''));
  const bad = (i, why) => failures.push(`${name}:${i + 1}: grammar: ${why}: ${JSON.stringify(lines[i].slice(0, 100))}`);
  let blockAt = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (blockAt >= 0) {
      if (/^\s*$/.test(line) || indentOf(line) > blockAt) continue;
      blockAt = -1;
    }
    if (/^\s*$/.test(line) || /^ *#/.test(line)) continue;
    if (/^ *\t/.test(line) || /\t/.test(line.match(/^[ \t]*/)[0])) { bad(i, 'tab in indentation'); continue; }
    const key = line.match(PLAIN_KEY_LINE);
    if (key) {
      const value = key[4] ?? '';
      if (BLOCK_SCALAR.test(value)) { blockAt = key[1].length + key[2].length; continue; }
      if (!valueOk(value)) bad(i, 'value must be a plain or quoted scalar, a single-line flow sequence, or a narrow flow mapping');
      continue;
    }
    const item = line.match(ITEM_LINE);
    if (item) {
      if (BLOCK_SCALAR.test(item[2])) { blockAt = item[1].length; continue; }
      if (!valueOk(item[2])) bad(i, 'sequence item must hold a plain key, scalar, flow sequence or narrow flow mapping');
      continue;
    }
    if (/^ *-$/.test(line)) continue;
    bad(i, 'not a plain `key:` line, `- ` item or block-scalar content (quoted, escaped or complex key, space before the colon, or a multi-line scalar)');
  }
  return failures;
}

// --------------------------------------------------------------- contract ---
export function analyzeWorkflow(name, source) {
  const failures = [];
  const fail = msg => failures.push(`${name}: ${msg}`);
  const wf = parseWorkflow(source);
  const selfHosted = wf.jobs.filter(job => !job.hosted);
  if (!selfHosted.length) return { selfHosted: false, failures };

  // Reviewed blocks must match exactly; nothing may be added around them.
  const normText = t => t.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
  const firstDiff = (got, want) => {
    const g = got.split('\n'), w = want.split('\n');
    for (let i = 0; i < Math.max(g.length, w.length); i += 1) {
      if (g[i] !== w[i]) return `line ${i + 1}: expected ${JSON.stringify(w[i] ?? '<end>')}, got ${JSON.stringify(g[i] ?? '<end>')}`;
    }
    return 'identical';
  };
  const { blocks, order, jobsLine } = jobBlocks(wf.lines);
  // Never skip a comparison silently: every parsed job must have a raw block,
  // and the layout must be exactly `jobs:`, `  guard:` then `  apple-v1:`.
  if (jobsLine !== 'jobs:') fail(`the jobs key line must be exactly "jobs:" (got ${JSON.stringify(jobsLine)})`);
  for (const job of wf.jobs) {
    if (!blocks.has(job.id)) fail(`job ${job.id}: could not locate its raw block; refusing to skip the canonical comparison`);
  }
  for (const [id, want] of [['guard', '  guard:'], ['apple-v1', '  apple-v1:']]) {
    const b = blocks.get(id);
    if (b && b.keyLine !== want) fail(`job ${id}: its key line must be exactly ${JSON.stringify(want)} (got ${JSON.stringify(b.keyLine)})`);
  }
  if (order.indexOf('guard') !== 0 || order.indexOf('apple-v1') !== 1) {
    fail(`jobs must start with guard then apple-v1, in that order (got ${order.join(', ')})`);
  }
  const guardBlock = blocks.get('guard')?.lines;
  const macBlock = blocks.get('apple-v1')?.lines;
  if (selfHosted.map(j => j.id).join(',') !== 'apple-v1') {
    fail(`the only self-hosted job allowed is apple-v1 (got ${selfHosted.map(j => j.id).join(', ')}); a new self-hosted lane needs a reviewed change to this checker`);
  }
  if (!guardBlock) {
    fail('the guard job is missing');
  } else if (normText(guardBlock.join('\n')) !== normText(CANONICAL_GUARD_JOB)) {
    fail(`the guard job must match the reviewed canonical text exactly (${firstDiff(normText(guardBlock.join('\n')), normText(CANONICAL_GUARD_JOB))})`);
  }
  if (!macBlock) {
    fail('the apple-v1 job is missing');
  } else {
    const stepStarts = macBlock.map((l, i) => (/^      - /.test(l) ? i : -1)).filter(i => i >= 0);
    const head = normText(macBlock.slice(0, stepStarts[3] ?? macBlock.length).join('\n'));
    if (head !== normText(CANONICAL_MAC_JOB_HEAD)) {
      fail(`the Mac job up to its third step (checkout, HEAD assertion, isolation) must match the reviewed canonical text exactly (${firstDiff(head, normText(CANONICAL_MAC_JOB_HEAD))})`);
    }
  }
  const topKeys = wf.top.map(e => e.key);
  const extraTop = topKeys.filter(k => !['name', 'on', 'permissions', 'concurrency', 'jobs'].includes(k));
  if (extraTop.length) fail(`top-level keys other than name/on/permissions/concurrency/jobs are forbidden (found ${extraTop.join(', ')})`);
  if (/^\s*(-\s+)?['"]?defaults['"]?\s*:/m.test(source)) fail('defaults: is forbidden at top and job level (it can replace the shell of every run step)');
  const macJob = wf.jobs.find(j => j.id === 'apple-v1');
  if (macJob) {
    const extraKeys = macJob.body.map(e => e.key).filter(k => !['name', 'needs', 'if', 'runs-on', 'timeout-minutes', 'env', 'steps'].includes(k));
    if (extraKeys.length) fail(`job apple-v1: keys other than name/needs/if/runs-on/timeout-minutes/env/steps are forbidden (found ${extraKeys.join(', ')})`);
  }
  for (const dup of duplicateKeys(wf.lines)) fail(`duplicate key ${dup} (YAML keeps only one of them)`);
  for (const job of wf.jobs) {
    for (const [i, step] of job.steps.entries()) {
      const shell = get(step.fields, 'shell');
      if (shell && scalar(shell.value) !== 'bash') fail(`job ${job.id} step ${i + 1}: shell must be bash (got ${scalar(shell.value) || 'a block'})`);
    }
  }

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
  if (/continue-on-error/.test(source)) fail('continue-on-error is forbidden in a self-hosted workflow (it would turn a failed guard into a pass)');
  if (/^\s*(-\s+)?['"]?<<['"]?\s*:/m.test(source)) fail('YAML merge keys (<<:) are forbidden in a self-hosted workflow');
  if (/(?::|^\s*-)\s+[&*][A-Za-z_][A-Za-z0-9_-]*(\s|$)/m.test(source)) fail('YAML anchors and aliases are forbidden in a self-hosted workflow');

  for (const job of wf.jobs) {
    for (const [i, step] of job.steps.entries()) {
      if (step.run !== null && /\$\{\{/.test(step.run)) {
        fail(`job ${job.id} step ${i + 1}: no \${{ }} expression inside a run script; pass inputs through env`);
      }
      if (step.run !== null && SWALLOW.some(re => re.test(step.run))) {
        fail(`job ${job.id} step ${i + 1}: a run script may not swallow failures (|| true, || :, || exit, || return, exit 0, set +e, trap)`);
      }
    }
    const failDefs = job.steps.reduce((n, st) => n + ((st.run ?? '').match(/(^|[\s;])(function\s+)?fail\s*\(\s*\)/g) ?? []).length, 0);
    if (failDefs > 1) fail(`job ${job.id}: fail() may be defined only once (found ${failDefs})`);
  }

  const ownerGate = [
    "github.event_name == 'workflow_dispatch'",
    `github.repository == '${CANONICAL_REPO}'`,
    'github.actor == github.repository_owner',
    'github.triggering_actor == github.repository_owner',
    "github.ref == 'refs/heads/main'"
  ];
  const GUARD_IF = ownerGate.join(' && ');
  const MAC_IF = `${GUARD_IF} && startsWith(inputs.runner_label, 'pri-mac-')`;
  const envIs = (step, key, value) => scalar(get(step?.env ?? [], key)?.value) === value;
  const firstLineSafe = run => /^\s*set -euo pipefail\s*$/.test((run ?? '').split('\n').find(l => l.trim() && !/^\s*[|>][-+]?\s*$/.test(l)) ?? '');

  for (const job of selfHosted) {
    const where = `job ${job.id}`;
    for (const label of ['self-hosted', 'macOS', 'ARM64', LABEL_INPUT]) {
      if (!job.labels.includes(label)) fail(`${where}: runs-on must include ${label} (got [${job.labels.join(', ')}])`);
    }
    // Exact match: always(), !cancelled(), failure(), success() || ... or any
    // || would let the job run without (or around) the guard.
    if (job.ifNorm !== MAC_IF) fail(`${where}: job if: must be exactly "${MAC_IF}" (got "${job.ifNorm}")`);
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
          [`if: exactly "${GUARD_IF}" (got "${guard.ifNorm}")`, guard.ifNorm === GUARD_IF],
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
  need(/setpgrp\(0, 0\)/.test(code) && /kill "-\$sig" -- "-\$RUNNER_PGID"/.test(code), 'the runner must run in its own process group and cleanup must signal the group');
  need(/signal_runner TERM "\$pids"/.test(code) && /signal_runner KILL "\$pids"/.test(code), 'cleanup must TERM the runner and escalate to KILL');
  need(/survived cleanup/.test(code), 'cleanup must report surviving runner processes');
  need(/\.\/run\.sh <\/dev\/null >"\$CONSOLE_LOG" 2>&1 &/.test(code), "the runner's stdin/stdout/stderr must not be the terminal");
  need(/redact_file "\$CONSOLE_LOG"/.test(code), "the runner's console log must be kept redacted");
  need(/ENVIRON\["PRI_SWEEP_DIR"\]/.test(code) && !/pgrep -f/.test(code), 'the run-directory sweep must match paths as fixed strings, not regexes');
  need(/-d cwd/.test(code) && /\/proc\/\[0-9\]\*/.test(code) && /^\s*pids_with_cwd_in_run_dir$/m.test(code) && /^\s*pids_naming_run_dir$/m.test(code),
    'the sweep must include processes that name the run directory or have their working directory in it');
  need(/^\s*stop_runner && stopped=0$/m.test(code), 'the exit trap must stop the runner');
  need(/^\s*trap '' INT TERM HUP$/m.test(code), 'cleanup must ignore a second Ctrl-C');
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

// Run argv on a fresh pseudo-terminal (stdin, stdout and stderr all the pty),
// copy its output to stdout and exit with its status. Self-contained instead of
// pty.spawn, whose stdin handling hangs on some Python versions (macOS 3.9).
const PTY_DRIVER = [
  'import os, pty, select, sys',
  'pid, fd = pty.fork()',
  'if pid == 0:',
  '    os.execvp(sys.argv[1], sys.argv[1:])',
  'status = None',
  'while True:',
  '    ready, _, _ = select.select([fd], [], [], 0.2)',
  '    if ready:',
  '        try:',
  '            data = os.read(fd, 65536)',
  '        except OSError:',
  '            data = b""',
  '        if not data:',
  '            break',
  '        sys.stdout.buffer.write(data)',
  '    elif status is None:',
  '        done, st = os.waitpid(pid, os.WNOHANG)',
  '        if done:',
  '            status = st',
  '    else:',
  '        break',
  'if status is None:',
  '    status = os.waitpid(pid, 0)[1]',
  'sys.stdout.flush()',
  'sys.exit(os.WEXITSTATUS(status) if os.WIFEXITED(status) else 128)'
].join('\n');

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
    // Assembled at run time so the repository secret scan never sees a JWT-shaped literal.
    const fakeJwt = tail => ['ey' + 'JhbGciOiJub25lIn0', 'ey' + 'Jzd' + tail + 'In0', 'bm90LWEtc2lnbmF0dXJl'].join('.');
    const dist = path.join(tmp, 'dist');
    mkdirSync(dist);
    writeFileSync(path.join(dist, 'run.sh'), [
      '#!/usr/bin/env bash',
      'set -eu',
      'test -n "${ACTIONS_RUNNER_INPUT_JITCONFIG:-}" || exit 41',
      'for a in "$@"; do case "$a" in *"$ACTIONS_RUNNER_INPUT_JITCONFIG"*) exit 42;; esac; done',
      'printf %s "$ACTIONS_RUNNER_INPUT_JITCONFIG" | shasum -a 256 | cut -d" " -f1 > "$PRI_FAKE_SEEN"',
      'pwd -P > "$PRI_FAKE_RUNDIR"',
      'if [ -n "${PRI_FAKE_TTY:-}" ]; then t=""; [ -t 0 ] && t="$t stdin"; [ -t 1 ] && t="$t stdout"; [ -t 2 ] && t="$t stderr"; printf "%s" "$t" > "$PRI_FAKE_TTY"; fi',
      'echo "Connected to GitHub"; echo "Listening for Jobs"; echo "console token=consoletok999"',
      'if [ -n "${PRI_FAKE_DELAY:-}" ]; then sleep "$PRI_FAKE_DELAY"; fi',
      'printf x > .credentials; printf x > .credentials_rsaparams; printf x > .runner',
      'mkdir -p _diag _work/repo',
      `printf "config %s\\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz0123\\nusing ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345\\nheader x-api-secret='sqval123' done\nsettings token=unquotedtok123 jitconfig: unquotedjit456, password = unquotedpw789\\nenv RUNNER_TOKEN=runnertokval1 mytoken=mytokval2\\nACTIONS_RUNTIME_TOKEN: ${fakeJwt('eDE')}\\nsaw ${fakeJwt('eTI')} in prose\\nJob pri-mac completed\\n" "$ACTIONS_RUNNER_INPUT_JITCONFIG" > _diag/Runner_1.log`,
      'if [ -n "${PRI_FAKE_HANG:-}" ]; then sleep 300 & echo $! > "$PRI_FAKE_CHILD"; wait; fi',
      // A TERM-ignoring child in the group, and a double-forked one that left the group.
      'if [ -n "${PRI_FAKE_STUBBORN:-}" ]; then',
      '  bash -c \'trap "" TERM; while :; do sleep 1; done\' & echo $! > "$PRI_FAKE_CHILD"',
      '  ( perl -e \'setpgrp(0, 0); $SIG{TERM} = "IGNORE"; open(my $f, ">", $ARGV[1]) or die; print $f $$; close $f; sleep 300\' "$(pwd -P)" "$PRI_FAKE_ESCAPED" & )',
      // ...and one that left the group with only its working directory inside the run directory.
      '  ( cd _work && perl -e \'setpgrp(0, 0); $SIG{TERM} = "IGNORE"; open(my $f, ">", $ARGV[0]) or die; print $f $$; close $f; exec "sleep", "300"\' "$PRI_FAKE_CWD_ESCAPED" & )',
      '  sleep 300',
      'fi',
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

    const ok = sh(['run', label], { env: { ...runEnv, PRI_FAKE_DELAY: '2' }, input: `${jit}\n` });
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
    check(/x-api-secret='\[REDACTED\]' done/.test(diagLog) && !/sqval123/.test(diagLog), 'single-quoted secret values are redacted');
    check(/runner is listening for jobs/.test(ok.stderr), 'run reports when the runner is listening (from its private console log)');
    const consoleLog = diagDirs.length === 1 && existsSync(path.join(root, 'diag', diagDirs[0], 'runner-console.log'))
      ? readFileSync(path.join(root, 'diag', diagDirs[0], 'runner-console.log'), 'utf8') : '';
    check(/Listening for Jobs/.test(consoleLog) && /console token=\[REDACTED\]/.test(consoleLog) && !/consoletok999/.test(consoleLog) &&
      !ok.stdout.includes('Listening for Jobs'),
    "the runner's console goes to a redacted log in the kept diag, not to the terminal");
    check(/RUNNER_TOKEN=\[REDACTED\] mytoken=\[REDACTED\]/.test(diagLog) && /ACTIONS_RUNTIME_TOKEN: \[REDACTED-JWT\]/.test(diagLog) &&
      /saw \[REDACTED-JWT\] in prose/.test(diagLog) && !/runnertokval1|mytokval2|eyJ/.test(diagLog),
    'prefixed keys (RUNNER_TOKEN=, mytoken=) and dotted JWTs are redacted');

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

    const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
    const readPid = f => (existsSync(f) ? Number(readFileSync(f, 'utf8').trim()) : 0);
    const escapedFile = path.join(tmp, 'escaped');
    const cwdEscapedFile = path.join(tmp, 'cwd-escaped');
    rmSync(childFile, { force: true });
    const stubborn = sh(['run', label], { env: { ...runEnv, PRI_FAKE_STUBBORN: '1', PRI_FAKE_CHILD: childFile, PRI_FAKE_ESCAPED: escapedFile, PRI_FAKE_CWD_ESCAPED: cwdEscapedFile, PRI_RUNNER_JOB_WAIT_SECONDS: '2' }, input: `${jit}\n` });
    const stubbornChild = readPid(childFile);
    const escaped = readPid(escapedFile);
    const cwdEscaped = readPid(cwdEscapedFile);
    check(stubborn.status === 3 && /sending KILL/.test(stubborn.stderr) && /no runner process is left running/.test(stubborn.stderr),
      `a runner tree that ignores TERM is KILLed after 10 s and cleanup says nothing is left (exit ${stubborn.status})`);
    check(stubbornChild > 0 && !alive(stubbornChild), 'a TERM-ignoring child in the runner process group does not survive cleanup');
    check(escaped > 0 && !alive(escaped), 'a double-forked child that left the process group (but names the run directory) does not survive cleanup');
    check(cwdEscaped > 0 && !alive(cwdEscaped), 'a child that left the process group with only its working directory in the run directory does not survive cleanup');
    for (const pid of [stubbornChild, escaped, cwdEscaped]) if (pid && alive(pid)) process.kill(pid, 'SIGKILL');

    // Under a real terminal (as with sudo's pty), the runner must not own it:
    // a background process group writing to or configuring the tty would be
    // stopped by SIGTTOU.
    const py = spawnSync('python3', ['-c', 'import sys'], { encoding: 'utf8' });
    if (py.error || py.status !== 0) {
      check(true, 'python3 not available: pty check skipped');
    } else {
      const ttyFile = path.join(tmp, 'runner-tty');
      const controlFile = path.join(tmp, 'control-tty');
      const ptyRun = spawnSync('python3', ['-c', PTY_DRIVER,
        'bash', '-c', '[ -t 1 ] && echo tty > "$PRI_CONTROL"; printf "%s\\n" "$PRI_TEST_JIT" | bash "$0" run "$1"', RUNNER_SCRIPT, label],
      { env: { ...runEnv, PRI_FAKE_TTY: ttyFile, PRI_CONTROL: controlFile, PRI_TEST_JIT: jit }, input: '', encoding: 'utf8', timeout: 60000 });
      const control = existsSync(controlFile) ? readFileSync(controlFile, 'utf8').trim() : '';
      const runnerTty = existsSync(ttyFile) ? readFileSync(ttyFile, 'utf8').trim() : 'missing';
      check(ptyRun.status === 0 && control === 'tty' && runnerTty === '',
        `under a terminal the runner's stdin/stdout/stderr are not the tty (control: ${control || 'none'}; runner tty: ${runnerTty || 'none'}; exit ${ptyRun.status})`);
      check(!(ptyRun.stdout ?? '').includes(jit), 'the JIT config never reaches the terminal');
    }
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
const lintedFiles = [];
for (const name of files) {
  const source = readFileSync(path.join(WORKFLOWS, name), 'utf8');
  const grammar = lintWorkflowGrammar(name, source);
  for (const f of grammar) check(false, f);
  if (!grammar.length) { passed += 1; lintedFiles.push(name); }
  const result = analyzeWorkflow(name, source);
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
  mutate('triggering_actor removed from the guard if only', s => s.replace('      github.triggering_actor == github.repository_owner &&\n', ''), null, /guard job lacks if: exactly/);
  const MAC_IF_HEAD = "    if: >-\n      github.event_name == 'workflow_dispatch' &&\n";
  const atMac = (s, to) => { const i = s.lastIndexOf(MAC_IF_HEAD); return s.slice(0, i) + to + s.slice(i + MAC_IF_HEAD.length); };
  const atGuard = (s, to) => s.replace(MAC_IF_HEAD, to);
  const macIf = /job apple-v1: job if: must be exactly/;
  mutate('always() on the Mac job', s => atMac(s, "    if: >-\n      always() && github.event_name == 'workflow_dispatch' &&\n"), null, macIf);
  mutate('!cancelled() on the Mac job', s => atMac(s, "    if: >-\n      !cancelled() && (needs.guard.result != 'x' || true) && github.event_name == 'workflow_dispatch' &&\n"), null, macIf);
  mutate('|| true appended to the Mac if', s => s.replace("      startsWith(inputs.runner_label, 'pri-mac-')\n", "      startsWith(inputs.runner_label, 'pri-mac-') || true\n"), null, macIf);
  mutate('failure() || on the Mac job', s => atMac(s, "    if: >-\n      failure() || github.event_name == 'workflow_dispatch' &&\n"), null, macIf);
  mutate('success() || on the Mac job', s => atMac(s, "    if: >-\n      success() || github.event_name == 'workflow_dispatch' &&\n"), null, macIf);
  mutate('guard if widened', s => s.replace("      github.ref == 'refs/heads/main'\n    runs-on: ubuntu-latest", "      github.ref == 'refs/heads/main' || github.actor != ''\n    runs-on: ubuntu-latest"), null, /guard job lacks if: exactly/);
  mutate('always() on the guard', s => atGuard(s, "    if: >-\n      always() && github.event_name == 'workflow_dispatch' &&\n"), null, /guard job lacks if: exactly/);
  mutate('trap exit 0 in the guard', '          fail() { echo', '          trap "exit 0" EXIT\n          fail() { echo', /swallow failures/);
  mutate('fail() redefined', '          [[ "$EVENT_NAME" ==', '          fail() { echo "::warning::$*"; }\n          [[ "$EVENT_NAME" ==', /fail\(\) may be defined only once/);
  mutate('function fail redefined', '          [[ "$EVENT_NAME" ==', '          function fail() { :; }\n          [[ "$EVENT_NAME" ==', /fail\(\) may be defined only once|swallow/);
  mutate('|| exit 0 on reachability', `--jq '.status + " " + (.behind_by | tostring)')"`, `--jq '.status + " " + (.behind_by | tostring)')" || exit 0`, /swallow failures|reachability query/);
  mutate('exit 0 at the end of the guard', '          echo "Trusted dispatch: $INPUT_SHA is on main"', '          echo "Trusted dispatch: $INPUT_SHA is on main"\n          exit 0', /swallow failures/);
  mutate('set +o errexit', '          fail() { echo', '          set +o errexit\n          fail() { echo', /swallow failures/);
  mutate('merge key on the guard step', '      - name: Validate inputs, owner,', '      - <<: {timeout-minutes: 1}\n        name: Validate inputs, owner,', /merge keys/);
  mutate('merge key with continue-on-error', '      - name: Validate inputs, owner,', '      - <<: {continue-on-error: true}\n        name: Validate inputs, owner,', /merge keys|continue-on-error/);
  mutate('anchor and alias', s => s.replace('    timeout-minutes: 5\n', '    timeout-minutes: &t 5\n').replace('    timeout-minutes: 90\n', '    timeout-minutes: *t\n'), null, /anchors and aliases/);
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

  // Round 3: early exits and dead code that a deny-list cannot enumerate are
  // caught by the exact canonical text of the guard job and the Mac job head.
  const canon = /must match the reviewed canonical text exactly/;
  const afterGuardSetE = '          set -euo pipefail\n          fail()';
  for (const [label, stmt] of [['bare exit', 'exit'], ['exit 00', 'exit 00'], ['exit $((0))', 'exit $((0))'], ['exec true', 'exec true']]) {
    mutate(`${label} at the top of the guard`, afterGuardSetE, `          set -euo pipefail\n          ${stmt}\n          fail()`, canon);
  }
  mutate('guard checks inside if false', s => s.replace('          [[ "$EVENT_NAME" ==', '          if false; then\n          [[ "$EVENT_NAME" ==').replace('          echo "Trusted dispatch:', '          fi\n          echo "Trusted dispatch:'), null, canon);
  mutate('guard checks inside a heredoc', s => s.replace('          [[ "$EVENT_NAME" ==', "          : <<'SKIP'\n          [[ \"$EVENT_NAME\" ==").replace('          echo "Trusted dispatch:', '          SKIP\n          echo "Trusted dispatch:'), null, canon);
  mutate('HEAD assertion behind if false &&', 'if ! test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"; then', 'if false && ! test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"; then', canon);
  mutate('isolation checks inside if false', s => s.replace('          test "$RUNNER_NAME" = "$EXPECTED_LABEL"\n', '          if false; then\n          test "$RUNNER_NAME" = "$EXPECTED_LABEL"\n').replace('          id -un\n', '          fi\n          id -un\n'), null, canon);
  mutate("shell: 'true {0}' on the guard step", '        shell: bash\n        env:\n          GH_TOKEN', "        shell: 'true {0}'\n        env:\n          GH_TOKEN", /shell must be bash|canonical/);
  mutate("shell: 'true {0}' on the isolation step", /(      - name: Verify one-job runner isolation[^\n]*\n)        shell: bash\n/, "$1        shell: 'true {0}'\n", /shell must be bash|canonical/);
  mutate('top-level defaults', 'permissions:\n  contents: read\n', 'permissions:\n  contents: read\n\ndefaults:\n  run:\n    shell: true {0}\n', /defaults: is forbidden/);
  mutate('job-level defaults on the Mac job', s => s.replace('    timeout-minutes: 90\n', '    timeout-minutes: 90\n    defaults:\n      run:\n        shell: true {0}\n'), null, /defaults: is forbidden/);
  mutate('job-level defaults after the Mac steps', s => `${s}    defaults:\n      run:\n        shell: true {0}\n`, null, /defaults: is forbidden/);
  mutate('duplicate if: after the Mac steps', s => `${s}    if: always()\n`, null, /duplicate key jobs\.apple-v1\.if/);
  mutate('duplicate if: in the guard', "      github.ref == 'refs/heads/main'\n    runs-on: ubuntu-latest\n", "      github.ref == 'refs/heads/main'\n    runs-on: ubuntu-latest\n    if: always()\n", /duplicate key jobs\.guard\.if|canonical/);
  mutate('duplicate run: in the HEAD step', s => s.replace('          test -z "$(git status --porcelain)"\n', '          test -z "$(git status --porcelain)"\n        run: "true"\n'), null, /duplicate key|canonical/);
  mutate('non-bash shell on a later step', '        run: npm run test:ink:bridge\n', '        run: npm run test:ink:bridge\n        shell: sh\n', /shell must be bash/);
  mutate('flow mapping', 'concurrency:\n  group: pri-mac-v1-${{ github.ref }}\n  cancel-in-progress: false\n', 'concurrency: {group: a, group: b}\n', /flow mapping/);
  mutate('top-level env (BASH_ENV)', 'permissions:\n  contents: read\n', 'permissions:\n  contents: read\n\nenv:\n  BASH_ENV: ./evil.sh\n', /top-level keys other than/);
  mutate('a second self-hosted job name', '  apple-v1:\n', '  apple-v2:\n', /only self-hosted job allowed is apple-v1/);

  // Round 4: the raw job layout must be exactly what the parser sees.
  const macFirst = (src, macKey = '  apple-v1:', guardKey = '  guard:') => {
    const g = src.indexOf('\n  guard:\n') + 1;
    const m = src.indexOf('\n  apple-v1:\n') + 1;
    const guardText = src.slice(g, m).replace(/^  guard:\n/, `${guardKey}\n`);
    const macText = src.slice(m).replace(/^  apple-v1:\n/, `${macKey}\n`);
    return `${src.slice(0, g)}${macText.endsWith('\n') ? macText : `${macText}\n`}${guardText}`;
  };
  const headBypass = s => s.replace('if ! test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"; then', 'if false && ! test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"; then');
  mutate('"apple-v1": placed before guard, with the HEAD bypass', s => macFirst(headBypass(s), '  "apple-v1":'), null, /key line must be exactly "  apple-v1:"|canonical/);
  mutate('"apple-v1": before guard (layout only)', s => macFirst(s, '  "apple-v1":'), null, /key line must be exactly "  apple-v1:"/);
  mutate('apple-v1: with a trailing comment', '  apple-v1:\n', '  apple-v1: # x\n', /key line must be exactly "  apple-v1:"/);
  mutate('apple-v1: with a trailing comment and the HEAD bypass', s => headBypass(s).replace('  apple-v1:\n', '  apple-v1: # mac\n'), null, /key line must be exactly "  apple-v1:"/);
  mutate("'guard': quoted", '  guard:\n', "  'guard':\n", /key line must be exactly "  guard:"/);
  mutate('Mac job placed first', s => macFirst(s), null, /must start with guard then apple-v1/);
  mutate('jobs: with a trailing comment', '\njobs:\n', '\njobs: # all\n', /jobs key line must be exactly/);
}

// 3. Classification fixtures: hosted workflows are out of scope; any other
//    runs-on (an expression, a runner group, a custom label) is held to the contract.
const hostedPr = 'name: x\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n  b:\n    runs-on: macos-15\n    steps:\n      - run: echo ok\n';
check(!analyzeWorkflow('hosted', hostedPr).selfHosted, 'a GitHub-hosted pull_request workflow is not self-hosted');
for (const runsOn of ['${{ matrix.os }}', '[self-hosted, macOS]', 'pri-learning-mac-trusted-manual', '\n      group: pri-mac\n      labels: [self-hosted]']) {
  const r = analyzeWorkflow('custom', hostedPr.replace('runs-on: ubuntu-latest', `runs-on: ${runsOn}`));
  check(r.selfHosted && r.failures.some(f => /only be triggered by workflow_dispatch/.test(f)), `a pull_request workflow on runs-on ${runsOn.trim()} must be rejected`);
}

// 3b. Grammar fixtures: keys the line parsers would skip must be rejected
//     before classification, in a brand-new workflow and in the Mac workflow.
const fullCheck = (name, src) => [...lintWorkflowGrammar(name, src), ...analyzeWorkflow(name, src).failures];
const evilPr = key => `name: evil\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n${key}\n    runs-on: [self-hosted, macOS, ARM64, pri-mac-0123456789abcdef]\n    steps:\n      - run: echo hi\n`;
for (const [label, src] of [
  ['new PR workflow with job key `  evil :`', evilPr('  evil :')],
  ['new PR workflow with `jobs :`', evilPr('  evil:').replace('\njobs:\n', '\njobs :\n')],
  ['new PR workflow with an escaped key "ev\\x69l":', evilPr('  "ev\\x69l":')],
  ["new PR workflow with a single-quoted key 'evil':", evilPr("  'evil':")],
  ['new PR workflow with `? evil` complex key', evilPr('  ? evil\n  :')],
  ['new PR workflow with `on :`', evilPr('  evil:').replace('\non:\n', '\non :\n')],
  ['tab indentation', evilPr('  evil:').replace('    steps:', '\tsteps:')]
]) {
  const f = fullCheck('fixture', src);
  check(f.some(x => /grammar:/.test(x)), `grammar fixture "${label}" must be rejected; got: ${f.join(' | ') || 'no failure'}`);
}
if (existsSync(macPath)) {
  const mac = readFileSync(macPath, 'utf8');
  const top = 'permissions:\n  contents: read\n';
  for (const [label, from, to] of [
    ['top-level `env :` with PATH', top, `${top}\nenv :\n  PATH: /tmp/evil:/usr/bin:/bin\n`],
    ['top-level `"env" :` with BASH_ENV', top, `${top}\n"env" :\n  BASH_ENV: ./evil.sh\n`],
    ['top-level `"env":` with BASH_ENV', top, `${top}\n"env":\n  BASH_ENV: ./evil.sh\n`],
    ['top-level `? env` complex key', top, `${top}\n? env\n: {PATH: /tmp/evil}\n`],
    ['top-level `actions : write`', top, 'permissions:\n  contents: read\n  actions : write\n'],
    ['job-level `permissions :` / `contents : write`', '    timeout-minutes: 90\n', '    timeout-minutes: 90\n    permissions :\n      contents : write\n'],
    ['`container :` after the Mac steps', null, '    container :\n      image: evil/image\n'],
    ['flow mapping with a quoted key', top, `${top}\nenv: {"PATH": /tmp/evil}\n`],
    ['flow mapping with a duplicate key', top, `${top}\nenv: {A: 1, A: 2}\n`],
    ['nested flow mapping', top, `${top}\nenv: {A: {B: 1}}\n`],
    ['anchor on a value', '    timeout-minutes: 90\n', '    timeout-minutes: &t 90\n']
  ]) {
    const mutated = from === null ? `${mac}${to}` : mac.replace(from, to);
    check(mutated !== mac, `grammar fixture "${label}" must actually change the workflow`);
    const f = fullCheck('fixture', mutated);
    check(f.some(x => /grammar:/.test(x)), `grammar fixture "${label}" must be rejected by the grammar lint; got: ${f.join(' | ') || 'no failure'}`);
  }
}
// The narrow flow-mapping allowance still accepts the repository's own forms.
for (const ok of [
  "          - { api: 36, profile: pixel_tablet, expect: product, target: google_apis, webviewFlags: \"--disable-gpu-compositing\" }",
  "        with: {python-version: '3.12', cache: pip, cache-dependency-path: tools/ink-foundation/requirements.txt}",
  "    branches: [main, 'release/**']"
]) {
  check(lintWorkflowGrammar('ok', `jobs:\n  a:\n    steps:\n${ok}\n`).length === 0, `grammar lint accepts ${ok.trim()}`);
}

// 4. The owner runner script.
const script = readFileSync(RUNNER_SCRIPT, 'utf8');
for (const f of analyzeRunnerScript(script)) check(false, f);
passed += 1;
for (const [label, from, to] of [
  ['admin refusal removed', /  if id -Gn[\s\S]*?\n  fi\n/, ''],
  ['trap removed', '  trap cleanup_run EXIT\n', ''],
  ['credential echoed', '  printf \'PRI_RUNNER_LABEL=%s\\n\' "$label"\n', '  echo "$jit_config"\n'],
  ['credential in argv', `' "$RUNNER_DIR" ./run.sh </dev/null`, `' "$RUNNER_DIR" ./run.sh --jitconfig "$jit_config" </dev/null`],
  ['runner owns the terminal', `./run.sh </dev/null >"$CONSOLE_LOG" 2>&1 &`, './run.sh &'],
  ['regex sweep', `PRI_SWEEP_DIR="$RUN_DIR" awk 'index($0, ENVIRON["PRI_SWEEP_DIR"]) { print $1 }'`, 'pgrep -f -- "$RUN_DIR"'],
  ['no cwd sweep', '      pids_with_cwd_in_run_dir\n', ''],
  ['xtrace enabled', 'set -euo pipefail\n', 'set -euxo pipefail\n'],
  ['no fresh work dir', 'mktemp -d', 'echo'],
  ['credentials kept', '"$RUNNER_DIR/.credentials" ', ''],
  ['no idle timeout', '      exit 3\n', '      break\n'],
  ['git-only work-tree check', 'if inside_git_tree "$root" || git', 'if git'],
  ['no KILL escalation', '      signal_runner KILL "$pids"\n', '      true\n'],
  ['no process group', '    setpgrp(0, 0) or die "setpgrp: $!\\n";\n', ''],
  ['interruptible cleanup', "  trap '' INT TERM HUP\n", '']
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
console.log(`SELF-HOSTED RUNNER CONTRACT: PASS — ${passed}/${total} checks; ${files.length} workflows scanned (${lintedFiles.length} grammar-clean), self-hosted: ${selfHostedFiles.join(', ') || 'none'}; every self-hosted lane is owner-dispatch-only for an exact SHA on main via a guard job, read-only, credential-free and routed by a fresh one-job label; runner script refuses admin/launcher/git roots, never prints or argv-passes its credential, and deletes its work directory; ${shellcheckNote}`);
