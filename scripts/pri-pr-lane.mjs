#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANUAL_NON_WRITER_PATHS = new Set(['README.md', 'docs/RELEASE.md']);
// Dependabot may only move dependency pins: npm manifests/lockfiles of the
// three npm trees and the `uses:` pins of workflow files. Anything else in a
// Dependabot PR falls back to the governed lane.
const DEPENDENCY_MANIFEST = /^(?:(?:client|server|ad)\/)?package(?:-lock)?\.json$/;
const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const WORKFLOW_PIN_LINE = /^\s*(?:-\s+)?uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}(?:\s+#\s*\S+)?\s*$/;

function changedFiles(base = 'origin/main') {
  const text = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8'
  }).trim();
  return text ? text.split('\n').filter(Boolean) : [];
}

function isManualNonWriterPath(file) {
  return MANUAL_NON_WRITER_PATHS.has(file);
}

function changedWorkflowLines(base, file) {
  const text = execFileSync('git', ['diff', '-U0', `${base}...HEAD`, '--', file], { cwd: ROOT, encoding: 'utf8' });
  return text.split('\n').filter(line => /^[+-](?![+-]{2})/.test(line)).map(line => line.slice(1));
}

function classifyDependency(files, workflowLines = () => []) {
  if (!files.length) return { lane: 'empty', authorized: false, files: [] };
  const outside = files.filter(file => !DEPENDENCY_MANIFEST.test(file) && !WORKFLOW_FILE.test(file));
  const unpinned = files.filter(file => WORKFLOW_FILE.test(file))
    .flatMap(file => workflowLines(file).filter(line => !WORKFLOW_PIN_LINE.test(line)).map(line => `${file}: ${line.trim()}`));
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
  console.error('Usage: pri-pr-lane.mjs classify [base] | simulate <paths...> | classify-dependency [base] | simulate-dependency <paths...>');
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
  result = classifyDependency(changedFiles(base), file => changedWorkflowLines(base, file));
} else if (command === 'simulate-dependency') {
  if (!args.length) {
    usage();
    process.exit(2);
  }
  result = classifyDependency(args);
} else {
  usage();
  process.exit(2);
}

console.log(JSON.stringify(result));
