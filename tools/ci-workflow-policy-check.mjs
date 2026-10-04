#!/usr/bin/env node
// CI WORKFLOW POLICY — supply-chain floor for every GitHub Actions workflow:
//   1. a top-level `permissions:` block (least privilege; jobs widen explicitly);
//   2. every `uses:` pinned to a full 40-hex commit SHA with a `# vX.Y.Z`
//      version comment (Dependabot refreshes both together);
//   3. no `pull_request_target` workflow that checks out the pull request's
//      head (`github.event.pull_request.head.*` / `github.head_ref`) — that is
//      the privileged-token-meets-untrusted-code pattern; untrusted builds run
//      on `pull_request` and hand privileged consumers an artifact
//      (.github/workflows/pri-agent-derived-sync.yml → pri-agent-derived-apply.yml);
//   4. a `pull_request_target` workflow may not install or run npm from the
//      candidate at all.
// Deliberately dependency-free: the checks are line-oriented so they run from a
// bare Node install before any package tree is installed.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

const SHA_REF = /^[0-9a-f]{40}$/;
const VERSION_COMMENT = /#\s*v?\d+(\.\d+){0,2}(\S*)?\s*$/;
const PR_HEAD_REF = /github\.(event\.pull_request\.head\.(sha|ref)|head_ref)/;

const files = readdirSync(WORKFLOWS).filter(name => /\.ya?ml$/.test(name)).sort();
let passed = 0;
const failures = [];
function check(condition, message) {
  if (condition) passed += 1;
  else failures.push(message);
}

function stripComment(line) {
  // Good enough for `uses:`/`ref:` values, which never contain a quoted '#'.
  const idx = line.indexOf(' #');
  return idx === -1 ? line : line.slice(0, idx);
}

for (const name of files) {
  const source = readFileSync(path.join(WORKFLOWS, name), 'utf8');
  const lines = source.split(/\r?\n/);

  // 1. top-level permissions (column 0).
  check(lines.some(line => /^permissions:\s*(\S.*)?$/.test(line)),
    `${name}: missing top-level permissions: block`);

  // 2. pinned actions.
  for (const [i, raw] of lines.entries()) {
    const m = raw.match(/^\s*(?:-\s*)?uses:\s*(.+)$/);
    if (!m) continue;
    const value = m[1].trim();
    const where = `${name}:${i + 1}`;
    const spec = stripComment(value).trim().replace(/^['"]|['"]$/g, '');
    if (spec.startsWith('./')) {
      check(true, `${where}: local action`);
      continue;
    }
    if (spec.startsWith('docker://')) {
      check(/@sha256:[0-9a-f]{64}$/.test(spec), `${where}: docker action must be pinned by digest: ${spec}`);
      continue;
    }
    const at = spec.lastIndexOf('@');
    const ref = at === -1 ? '' : spec.slice(at + 1);
    check(SHA_REF.test(ref), `${where}: action is not pinned to a full commit SHA: ${spec}`);
    check(VERSION_COMMENT.test(value), `${where}: pinned action needs a trailing "# vX.Y.Z" version comment: ${value}`);
  }

  // 3./4. pull_request_target hygiene.
  const usesTarget = lines.some(line => /^\s*pull_request_target:/.test(line));
  if (usesTarget) {
    const headCheckout = lines.some((line, i) =>
      /^\s*ref:\s*/.test(line) && PR_HEAD_REF.test(line) &&
      lines.slice(Math.max(0, i - 6), i).some(prev => /uses:\s*['"]?actions\/checkout@/.test(prev)));
    check(!headCheckout, `${name}: pull_request_target workflow checks out the pull request head — move the untrusted build to pull_request and consume an artifact via workflow_run`);
    check(!lines.some(line => /^\s*run:.*\bnpm\s+(ci|install|run|exec)\b/.test(line) || /^\s+npm\s+(ci|install|run|exec)\b/.test(line)),
      `${name}: pull_request_target workflow must not install or run npm`);
    check(!lines.some(line => /^\s*working-directory:\s*candidate\s*$/.test(line)),
      `${name}: pull_request_target workflow must not run inside the candidate checkout`);
  } else {
    check(true, `${name}: no pull_request_target`);
  }

  // A workflow_run consumer must gate on the originating repository and never
  // persist credentials into a checkout (the push token is scoped to a step).
  if (lines.some(line => /^\s*workflow_run:/.test(line))) {
    check(/head_repository\.full_name\s*==\s*github\.repository/.test(source),
      `${name}: workflow_run consumer must require head_repository.full_name == github.repository`);
    check(!/persist-credentials:\s*true/.test(source),
      `${name}: workflow_run consumer must not persist credentials into a checkout`);
  }
}

check(files.length >= 30, `expected the full workflow set, found ${files.length}`);

const total = passed + failures.length;
if (failures.length) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`CI WORKFLOW POLICY: FAIL — ${passed}/${total} checks across ${files.length} workflows`);
  process.exit(1);
}
console.log(`CI WORKFLOW POLICY: PASS — ${passed}/${total} checks across ${files.length} workflows — every workflow declares least-privilege permissions, every action is SHA-pinned, no privileged workflow executes pull-request code`);
