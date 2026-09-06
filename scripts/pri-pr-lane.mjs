#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANUAL_NON_WRITER_PATHS = new Set(['README.md', 'docs/RELEASE.md']);

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
  console.error('Usage: pri-pr-lane.mjs classify [base] | simulate <paths...>');
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
} else {
  usage();
  process.exit(2);
}

console.log(JSON.stringify(result));
