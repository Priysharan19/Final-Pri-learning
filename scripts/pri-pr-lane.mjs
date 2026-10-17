#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANUAL_NON_WRITER_PATHS = new Set(['README.md', 'docs/RELEASE.md']);
// Dependabot may only touch npm manifests/lockfiles of the npm trees and
// re-pin existing workflow actions. Manifest contents are NOT inspected here:
// review and required CI gate them. A workflow change qualifies only when
// every hunk swaps pin lines one for one, each pair naming the same action at
// the same indentation with only the SHA and `# tag` changed.
const DEPENDENCY_MANIFEST = /^(?:(?:client|server|ad)\/)?package(?:-lock)?\.json$/;
const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/;
// Spaces and tabs only: a bare CR would let YAML see an extra line.
const WORKFLOW_PIN_LINE = /^([ \t]*(?:-[ \t]+)?)uses:[ \t]*([A-Za-z0-9_-][\w.-]*\/[\w./-]+)@([0-9a-f]{40})(?:[ \t]+#[ \t]*v?[\w.+-]+)?[ \t]*$/;

function changedFiles(base = 'origin/main') {
  // --no-renames lists both sides of a rename, so a deleted path is never hidden.
  const text = execFileSync('git', ['diff', '--name-only', '--no-renames', `${base}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8'
  }).trim();
  return text ? text.split('\n').filter(Boolean) : [];
}

function isManualNonWriterPath(file) {
  return MANUAL_NON_WRITER_PATHS.has(file);
}

function workflowDiff(base, file) {
  return execFileSync('git', ['diff', '-U0', '--no-renames', `${base}...HEAD`, '--', file], { cwd: ROOT, encoding: 'utf8' });
}

// Returns the reasons a unified -U0 diff of one workflow file is not a pure
// pin swap; an empty list means every hunk only re-pins existing actions.
function nonPinWorkflowChanges(diffText) {
  const problems = [];
  const hunks = [];
  let hunk = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('@@')) { hunk = { removed: [], added: [] }; hunks.push(hunk); continue; }
    if (!hunk) {
      if (/^(?:new|deleted) file mode|^Binary files|^(?:old|new) mode/.test(line)) problems.push(line);
      continue;
    }
    if (line.startsWith('\\')) continue;
    if (line.startsWith('-')) hunk.removed.push(line.slice(1));
    else if (line.startsWith('+')) hunk.added.push(line.slice(1));
  }
  if (!hunks.length && !problems.length && diffText.trim()) problems.push('no reviewable hunks');
  for (const { removed, added } of hunks) {
    if (removed.length !== added.length) { problems.push(`hunk changes ${removed.length} line(s) into ${added.length}`); continue; }
    removed.forEach((before, i) => {
      const a = WORKFLOW_PIN_LINE.exec(before), b = WORKFLOW_PIN_LINE.exec(added[i]);
      if (!a || !b) problems.push(`not a pin line: ${(a ? added[i] : before).trim()}`);
      else if (a[1] !== b[1] || a[2] !== b[2]) problems.push(`pin swaps action or indentation: ${before.trim()} -> ${added[i].trim()}`);
    });
  }
  return problems;
}

// workflowDiffText = null is a path-only simulation (simulate-dependency);
// the real classifier always supplies the diff text.
function classifyDependency(files, workflowDiffText = null) {
  if (!files.length) return { lane: 'empty', authorized: false, files: [] };
  const outside = files.filter(file => !DEPENDENCY_MANIFEST.test(file) && !WORKFLOW_FILE.test(file));
  const unpinned = files.filter(file => workflowDiffText && WORKFLOW_FILE.test(file))
    .flatMap(file => {
      const text = workflowDiffText(file);
      // A listed workflow with no diff text is unexplained: fail closed.
      if (!text.trim()) return [`${file}: empty diff`];
      return nonPinWorkflowChanges(text).map(problem => `${file}: ${problem}`);
    });
  if (outside.length || unpinned.length) {
    return { lane: 'governed-required', authorized: false, files, outside_dependency_paths: outside, non_pin_workflow_lines: unpinned };
  }
  return { lane: 'dependency-update', authorized: false, files };
}

function classify(files) {
  if (!files.length) return { lane: 'empty', authorized: false, files: [] };
  const manual = files.filter(isManualNonWriterPath);
  const governed = files.filter(file => !isManualNonWriterPath(file));
  if (governed.length === 0) {
    return {
      lane: 'manual-docs',
      authorized: false,
      files,
      manual_files: manual,
      governed_files: []
    };
  }
  return {
    lane: 'governed-required',
    authorized: false,
    files,
    manual_files: manual,
    governed_files: governed
  };
}

function usage() {
  console.error('Usage: pri-pr-lane.mjs classify [base] | simulate <paths...> | classify-dependency [base] | simulate-dependency <paths...> | simulate-workflow-diff <diff-file>');
}

const [command, ...args] = process.argv.slice(2);
let result;
if (command === 'classify') {
  result = classify(changedFiles(args[0] || 'origin/main'));
} else if (command === 'simulate') {
  if (!args.length) {
    usage();
    process.exit(2);
  }
  result = classify(args);
} else if (command === 'classify-dependency') {
  const base = args[0] || 'origin/main';
  result = classifyDependency(changedFiles(base), file => workflowDiff(base, file));
} else if (command === 'simulate-dependency') {
  if (!args.length) {
    usage();
    process.exit(2);
  }
  result = classifyDependency(args);
} else if (command === 'simulate-workflow-diff') {
  // simulate-workflow-diff <diff-file>: classify one workflow's -U0 diff text.
  if (args.length !== 1) {
    usage();
    process.exit(2);
  }
  const file = '.github/workflows/simulated.yml';
  result = classifyDependency([file], () => readFileSync(path.resolve(args[0]), 'utf8'));
} else {
  usage();
  process.exit(2);
}

console.log(JSON.stringify(result));
